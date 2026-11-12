import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CatalogRepository } from "@/lib/catalog/repository";
import { runMigrations } from "@/lib/db/migrate";
import { createPgliteHandle, type PgliteHandle } from "@/lib/db/pglite";
import {
  listCatalogSlugs,
  upsertCatalog,
} from "@/lib/import/spells";
import { parseCatalogFilters } from "@/lib/validation/catalog";

import { makeSpell } from "./fixtures";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "db",
  "migrations",
  "001_create_magias.sql",
);

let handle: PgliteHandle;
let repository: CatalogRepository;

beforeAll(async () => {
  handle = createPgliteHandle(null);
  await handle.exec(await readFile(MIGRATION_PATH, "utf8"));
  repository = new CatalogRepository(handle.client);

  await upsertCatalog(handle.client, [
    makeSpell({
      slug: "bola-de-fogo",
      nome: "Bola de Fogo",
      tipo: "Evocação",
      classes: ["Feiticeiro", "Mago"],
      circulo: 3,
    }),
    makeSpell({
      slug: "ilusao-menor",
      nome: "Ilusão Menor",
      tipo: "Ilusão",
      classes: ["Bardo", "Mago"],
      circulo: 0,
      descricao: "Você cria um som ou uma imagem ilusória.",
    }),
    makeSpell({
      slug: "desejo",
      nome: "Desejo",
      tipo: "Conjuração",
      classes: ["Feiticeiro", "Mago"],
      circulo: 9,
      descricao: "A magia mais poderosa que mortais podem conjurar.",
    }),
  ]);
});

afterAll(async () => {
  await handle.close();
});

describe("catalog schema and repository", () => {
  it("accepts circles 0 and 9 and returns consistent facets", async () => {
    const page = await repository.searchSpells(parseCatalogFilters(new URLSearchParams()));

    expect(page.total).toBe(3);
    expect(page.items).toHaveLength(3);
    expect(page.facets.circulos).toEqual(
      expect.arrayContaining([
        { valor: 0, total: 1 },
        { valor: 3, total: 1 },
        { valor: 9, total: 1 },
      ]),
    );
    expect(page.facets.classes).toEqual(
      expect.arrayContaining([
        { valor: "Bardo", total: 1 },
        { valor: "Feiticeiro", total: 2 },
        { valor: "Mago", total: 3 },
      ]),
    );
  });

  it("filters by circle 0, school, and classes", async () => {
    const cantrips = await repository.searchSpells(
      parseCatalogFilters(new URLSearchParams("circulo=0")),
    );
    expect(cantrips.items.map((spell) => spell.nome)).toEqual(["Ilusão Menor"]);

    const illusion = await repository.searchSpells(
      parseCatalogFilters(new URLSearchParams("tipo=Ilus%C3%A3o")),
    );
    expect(illusion.items.map((spell) => spell.slug)).toEqual(["ilusao-menor"]);

    const bardo = await repository.searchSpells(
      parseCatalogFilters(new URLSearchParams("classe=Bardo")),
    );
    expect(bardo.items.map((spell) => spell.slug)).toEqual(["ilusao-menor"]);

    const search = await repository.searchSpells(
      parseCatalogFilters(new URLSearchParams("q=ilusa")),
    );
    expect(search.items.map((spell) => spell.slug)).toEqual(["ilusao-menor"]);
  });

  it("paginates results and sorts them stably", async () => {
    const first = await repository.searchSpells(
      parseCatalogFilters(new URLSearchParams("limit=2&sort=nome-asc")),
    );
    const second = await repository.searchSpells(
      parseCatalogFilters(new URLSearchParams("limit=2&page=2&sort=nome-asc")),
    );

    expect(first.page).toBe(1);
    expect(first.pageCount).toBe(2);
    expect(first.items.map((spell) => spell.nome)).toEqual(["Bola de Fogo", "Desejo"]);
    expect(first.nextCursor).not.toBeNull();
    expect(second.items.map((spell) => spell.nome)).toEqual(["Ilusão Menor"]);
  });

  it("looks up spells by ID and slug and preserves requested ID order", async () => {
    const all = await repository.searchSpells(parseCatalogFilters(new URLSearchParams()));
    const byName = new Map(all.items.map((spell) => [spell.nome, spell]));
    const fireball = byName.get("Bola de Fogo");
    const wish = byName.get("Desejo");

    expect(fireball).toBeDefined();
    expect(wish).toBeDefined();

    const byId = await repository.getSpellById(fireball!.id);
    expect(byId?.slug).toBe("bola-de-fogo");

    const bySlug = await repository.getSpellBySlug("desejo");
    expect(bySlug?.nome).toBe("Desejo");

    const ordered = await repository.listSpellsByIds([wish!.id, fireball!.id]);
    expect(ordered.map((spell) => spell.slug)).toEqual(["desejo", "bola-de-fogo"]);
  });

  it("preserves the ID when updating a spell by slug", async () => {
    const [before] = await upsertCatalog(handle.client, [
      makeSpell({ slug: "alarme", nome: "Alarme" }),
    ]);
    const [after] = await upsertCatalog(handle.client, [
      makeSpell({ slug: "alarme", nome: "Alarme Revisado" }),
    ]);

    expect(after.id).toBe(before!.id);
    expect(after.inserted).toBe(false);
    expect((await repository.getSpellBySlug("alarme"))?.nome).toBe("Alarme Revisado");
    expect((await listCatalogSlugs(handle.client)).filter((slug) => slug === "alarme")).toHaveLength(
      1,
    );
  });

  it("rejects out-of-range circles and empty class arrays in the database", async () => {
    const insert = (values: unknown[]) =>
      handle.client.query(
        `INSERT INTO public.magias (
          id, slug, nome, tipo, classes, circulo, descricao,
          tempo_conjuracao, alcance, duracao,
          componentes_verbal, componentes_somatico, componentes_material
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, false, false)`,
        values,
      );

    await expect(
      insert([randomUUID(), "circulo-dez", "Círculo Dez", "Evocação", ["Mago"], 10, "x", "Ação", "Toque", "Instantânea"]),
    ).rejects.toThrow();
    await expect(
      insert([randomUUID(), "sem-classes", "Sem Classes", "Evocação", [], 1, "x", "Ação", "Toque", "Instantânea"]),
    ).rejects.toThrow();
  });
});

describe("database migrations", () => {
  it("applies each migration only once", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "ars-arcana-migracao-"));
    const connectionString = `pglite:${path.join(directory, "catalogo")}`;

    try {
      const first = await runMigrations(connectionString);
      expect(first.applied).toEqual(["001_create_magias.sql"]);
      expect(first.skipped).toEqual([]);

      const second = await runMigrations(connectionString);
      expect(second.applied).toEqual([]);
      expect(second.skipped).toEqual(["001_create_magias.sql"]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
