import { readFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPgliteHandle, type PgliteHandle } from "@/lib/db/pglite";
import { EquipmentRepository } from "@/lib/equipment/repository";
import { MochilaRepositoryError } from "@/lib/mochilas/repository";
import { upsertEquipmentCatalog } from "@/lib/import/equipment";
import { parseEquipmentFilters } from "@/lib/validation/equipment";

import {
  makeAdventure,
  makeArmor,
  makeTool,
  makeWeapon,
} from "./fixtures";

const MIGRATION_FILES = [
  "001_create_magias.sql",
  "002_auth_and_grimoires.sql",
  "003_equipment_and_arsenal.sql",
  "004_mochilas.sql",
];

let handle: PgliteHandle;
let repository: EquipmentRepository;

async function createUser(email: string): Promise<string> {
  const rows = await handle.client.query<{ id: string }>(
    "INSERT INTO public.usuarios (name, email) VALUES ($1, $2) RETURNING id",
    ["Aventureiro de teste", email],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("Usuário de teste não foi criado.");
  return id;
}

beforeAll(async () => {
  handle = createPgliteHandle(null);
  for (const filename of MIGRATION_FILES) {
    await handle.exec(
      await readFile(
        path.join(process.cwd(), "src", "lib", "db", "migrations", filename),
        "utf8",
      ),
    );
  }

  await upsertEquipmentCatalog(handle.client, [
    makeWeapon({
      slug: "adaga",
      nome: "Adaga",
      categoria: "Simples Corpo a Corpo",
      dano: "1d4",
      tipoDano: "Perfurante",
      propriedades: ["Acuidade", "Leve", "Arremesso (Alcance 6/18)"],
      maestria: "Ágil",
      peso: "0,5 kg",
      custo: "2 PO",
    }),
    makeWeapon({
      slug: "arco-longo",
      nome: "Arco Longo",
      categoria: "Marcial à Distância",
      dano: "1d8",
      tipoDano: "Perfurante",
      propriedades: ["Munição (Alcance 45/180)", "Pesada", "Duas mãos"],
      maestria: "Lentidão",
      peso: "1 kg",
      custo: "50 PO",
    }),
    makeArmor({
      slug: "armadura-de-couro",
      nome: "Armadura de Couro",
      categoria: "Leve",
      classeArmadura: "11 + modificador de Des",
      forca: null,
      furtividade: null,
      peso: "5 kg",
      custo: "10 PO",
    }),
    makeArmor({
      slug: "escudo",
      nome: "Escudo",
      categoria: "Escudo",
      classeArmadura: "+2",
      forca: null,
      furtividade: null,
      peso: "3 kg",
      custo: "10 PO",
    }),
    makeTool({
      slug: "ferramentas-de-ladrao",
      nome: "Ferramentas de Ladrão",
      categoria: "Outras Ferramentas",
      atributo: "Destreza",
      descricao: "Ferramentas para abrir fechaduras e desarmar armadilhas.",
      peso: "0,5 kg",
      custo: "25 PO",
    }),
    makeAdventure({
      slug: "pocao-de-cura",
      nome: "Poção de Cura",
      descricao: "Um líquido vermelho que recupera pontos de vida.",
      peso: "0,25 kg",
      custo: "50 PO",
    }),
  ]);

  repository = new EquipmentRepository(handle.client);
});

afterAll(async () => {
  await handle.close();
});

describe("equipment repository", () => {
  it("lists the full catalog with real facets and default category ordering", async () => {
    const page = await repository.searchEquipment(parseEquipmentFilters({}));

    expect(page.total).toBe(6);
    expect(page.page).toBe(1);
    expect(page.pageCount).toBe(1);
    expect(page.items.map((item) => item.slug)).toEqual([
      "adaga",
      "arco-longo",
      "armadura-de-couro",
      "escudo",
      "ferramentas-de-ladrao",
      "pocao-de-cura",
    ]);

    expect(page.facets.tipos).toEqual([
      { valor: "arma", total: 2 },
      { valor: "armadura", total: 2 },
      { valor: "ferramenta", total: 1 },
      { valor: "aventura", total: 1 },
    ]);
    expect(page.facets.armas.tipos).toEqual([
      { valor: "simples", total: 1 },
      { valor: "marcial", total: 1 },
    ]);
    expect(page.facets.armas.alcances).toEqual([
      { valor: "corpo-a-corpo", total: 1 },
      { valor: "distancia", total: 1 },
    ]);
    expect(page.facets.armaduras).toEqual([
      { valor: "Leve", total: 1 },
      { valor: "Média", total: 0 },
      { valor: "Pesada", total: 0 },
      { valor: "Escudo", total: 1 },
    ]);
    expect(page.typeTotals).toEqual([
      { valor: "arma", total: 2 },
      { valor: "armadura", total: 2 },
      { valor: "ferramenta", total: 1 },
      { valor: "aventura", total: 1 },
    ]);
  });

  it("combines OR within a weapon group and AND between groups", async () => {
    const result = await repository.searchEquipment(
      parseEquipmentFilters(
        new URLSearchParams(
          "tipo=arma&arma=simples&arma=marcial&alcance=distancia",
        ),
      ),
    );

    expect(result.total).toBe(1);
    expect(result.items[0]?.slug).toBe("arco-longo");
    expect(result.typeTotals).toEqual([
      { valor: "arma", total: 1 },
      { valor: "armadura", total: 0 },
      { valor: "ferramenta", total: 0 },
      { valor: "aventura", total: 0 },
    ]);
  });

  it("filters armor categories and ignores weapon filters for armor", async () => {
    const filters = parseEquipmentFilters(
      new URLSearchParams(
        "tipo=armadura&armadura=leve&armadura=escudo&arma=marcial",
      ),
    );

    expect(filters.armas).toEqual([]);
    expect(filters.armaduras).toEqual(["leve", "escudo"]);

    const result = await repository.searchEquipment(filters);
    expect(result.total).toBe(2);
    expect(result.items.map((item) => item.slug).sort()).toEqual([
      "armadura-de-couro",
      "escudo",
    ]);
  });

  it("searches accents, names, categories, descriptions and properties", async () => {
    const accented = await repository.searchEquipment(
      parseEquipmentFilters(new URLSearchParams("q=pocao")),
    );
    const description = await repository.searchEquipment(
      parseEquipmentFilters(new URLSearchParams("q=desarmar")),
    );
    const properties = await repository.searchEquipment(
      parseEquipmentFilters(new URLSearchParams("q=arremesso")),
    );

    expect(accented.items.map((item) => item.slug)).toEqual(["pocao-de-cura"]);
    expect(description.items.map((item) => item.slug)).toEqual([
      "ferramentas-de-ladrao",
    ]);
    expect(properties.items.map((item) => item.slug)).toEqual(["adaga"]);
  });

  it("paginates and sorts deterministically by name", async () => {
    const page = await repository.searchEquipment(
      parseEquipmentFilters(new URLSearchParams("sort=nome-asc&limit=2&page=2")),
    );

    expect(page.total).toBe(6);
    expect(page.pageCount).toBe(3);
    expect(page.items.map((item) => item.nome)).toEqual([
      "Armadura de Couro",
      "Escudo",
    ]);

    const descending = await repository.searchEquipment(
      parseEquipmentFilters(new URLSearchParams("sort=nome-desc&limit=2")),
    );
    expect(descending.items.map((item) => item.nome)).toEqual([
      "Poção de Cura",
      "Ferramentas de Ladrão",
    ]);
  });

  it("loads a single item by slug and reports missing slugs", async () => {
    const item = await repository.getEquipmentBySlug("arco-longo");
    expect(item).toMatchObject({
      slug: "arco-longo",
      nome: "Arco Longo",
      tipo: "arma",
      categoria: "Marcial à Distância",
      dano: "1d8",
      maestria: "Lentidão",
    });
    expect(await repository.getEquipmentBySlug("nao-existe")).toBeNull();
  });

  it("keeps the database id stable across idempotent upserts", async () => {
    const [first] = await upsertEquipmentCatalog(handle.client, [
      makeWeapon({ slug: "item-estavel", nome: "Item Estável" }),
    ]);
    const [second] = await upsertEquipmentCatalog(handle.client, [
      makeWeapon({ slug: "item-estavel", nome: "Item Renomeado" }),
    ]);

    expect(first?.inserted).toBe(true);
    expect(second?.inserted).toBe(false);
    expect(second?.id).toBe(first?.id);
    expect((await repository.getEquipmentBySlug("item-estavel"))?.nome).toBe(
      "Item Renomeado",
    );
  });
});

describe("arsenal repository isolation", () => {
  it("saves idempotently and isolates each user's collection", async () => {
    const owner = await createUser("arsenal-dono@example.com");
    const other = await createUser("arsenal-outro@example.com");

    const afterFirstSave = await repository.saveItem(owner, "adaga");
    expect(afterFirstSave.totalUnique).toBe(1);
    expect(afterFirstSave.reserved.total).toBe(1);
    expect(afterFirstSave.items[0]?.slug).toBe("adaga");

    const afterSecondSave = await repository.saveItem(owner, "adaga");
    expect(afterSecondSave.totalUnique).toBe(1);

    expect(await repository.isSaved(owner, "adaga")).toBe(true);
    expect(await repository.isSaved(other, "adaga")).toBe(false);
    expect((await repository.getArsenalSnapshot(other)).totalUnique).toBe(0);
    expect((await repository.getArsenalSnapshot(other)).items).toEqual([]);
  });

  it("removes only the selected user's association and preserves the catalog", async () => {
    const owner = await createUser("arsenal-remocao@example.com");
    const other = await createUser("arsenal-remocao-outro@example.com");

    await repository.saveItem(owner, "escudo");
    await repository.saveItem(other, "escudo");
    await repository.saveItem(owner, "pocao-de-cura");

    const afterRemove = await repository.removeItem(owner, "escudo");
    expect(afterRemove.items.map((item) => item.slug)).toEqual(["pocao-de-cura"]);
    expect(await repository.isSaved(other, "escudo")).toBe(true);
    expect((await repository.getEquipmentBySlug("escudo"))?.nome).toBe("Escudo");
    expect((await repository.searchEquipment(parseEquipmentFilters({}))).total).toBe(7);
  });

  it("rejects saving or removing items that are not in the catalog", async () => {
    const user = await createUser("arsenal-invalido@example.com");

    await expect(repository.saveItem(user, "item-inexistente")).rejects.toBeInstanceOf(
      MochilaRepositoryError,
    );
    await expect(repository.removeItem(user, "item-inexistente")).rejects.toMatchObject({
      code: "not-found",
    });
  });
});
