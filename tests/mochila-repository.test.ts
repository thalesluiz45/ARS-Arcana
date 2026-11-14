import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPgliteHandle, type PgliteHandle } from "@/lib/db/pglite";
import { MochilaRepository } from "@/lib/mochilas/repository";
import { upsertEquipmentCatalog } from "@/lib/import/equipment";
import { RESERVED_MOCHILA_NAME } from "@/lib/validation/mochila";

import { makeArmor, makeWeapon } from "./fixtures";

const MIGRATION_FILES = [
  "001_create_magias.sql",
  "002_auth_and_grimoires.sql",
  "003_equipment_and_arsenal.sql",
  "004_mochilas.sql",
];

let handle: PgliteHandle;
let repository: MochilaRepository;

async function createUser(email: string): Promise<string> {
  const rows = await handle.client.query<{ id: string }>(
    "INSERT INTO public.usuarios (name, email) VALUES ($1, $2) RETURNING id",
    ["Aventureiro de teste", email],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("Usuário de teste não foi criado.");
  return id;
}

function listIds(
  associations: { equipamentoSlug: string; listaId: string }[],
  slug: string,
) {
  return associations
    .filter((association) => association.equipamentoSlug === slug)
    .map((association) => association.listaId)
    .sort();
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
    makeWeapon({ slug: "adaga", nome: "Adaga" }),
    makeArmor({ slug: "escudo", nome: "Escudo" }),
  ]);
  repository = new MochilaRepository(handle.client);
});

afterAll(async () => {
  await handle.close();
});

describe("004 migration", () => {
  it("moves existing arsenal items into the reserved mochila", async () => {
    const local = createPgliteHandle(null);
    try {
      for (const filename of MIGRATION_FILES.slice(0, 3)) {
        await local.exec(
          await readFile(
            path.join(process.cwd(), "src", "lib", "db", "migrations", filename),
            "utf8",
          ),
        );
      }

      const [equipment] = await upsertEquipmentCatalog(local.client, [
        makeWeapon({ slug: "espada-longa", nome: "Espada Longa" }),
      ]);
      const users = await local.client.query<{ id: string }>(
        "INSERT INTO public.usuarios (name, email) VALUES ($1, $2) RETURNING id",
        ["Aventureiro legado", "legado@example.com"],
      );
      const userId = users[0]!.id;
      await local.client.query(
        "INSERT INTO public.arsenal_itens (user_id, equipamento_id) VALUES ($1, $2)",
        [userId, equipment!.id],
      );

      await local.exec(
        await readFile(
          path.join(
            process.cwd(),
            "src",
            "lib",
            "db",
            "migrations",
            "004_mochilas.sql",
          ),
          "utf8",
        ),
      );

      const rows = await local.client.query<{ nome: string; slug: string }>(
        `SELECT mo.nome, e.slug
         FROM public.mochila_itens mi
         JOIN public.mochilas mo ON mo.id = mi.mochila_id
         JOIN public.equipamentos e ON e.id = mi.equipamento_id
         WHERE mo.user_id = $1`,
        [userId],
      );
      expect(rows).toEqual([{ nome: "Sem mochila", slug: "espada-longa" }]);
    } finally {
      await local.close();
    }
  });
});

describe("mochila repository", () => {
  it("creates exactly one reserved mochila per user", async () => {
    const user = await createUser("mochila-reservada@example.com");

    const first = await repository.ensureReservedMochila(user);
    const second = await repository.ensureReservedMochila(user);

    expect(first.id).toBe(second.id);
    expect(first).toMatchObject({ nome: RESERVED_MOCHILA_NAME, reservada: true });

    const snapshot = await repository.getSnapshot(user);
    expect(snapshot.lists).toHaveLength(1);
    expect(snapshot.namedMochilas).toEqual([]);
    expect(snapshot.reserved.total).toBe(0);
    expect(snapshot.totalUnique).toBe(0);
  });

  it("normalizes names and rejects duplicates and the reserved name", async () => {
    const user = await createUser("mochila-nomes@example.com");

    const kit = await repository.createMochila(user, "  Kit de exploracao  ");
    expect(kit.nome).toBe("Kit de exploracao");
    expect(kit.reservada).toBe(false);

    await expect(repository.createMochila(user, "KIT DE EXPLORACAO")).rejects.toMatchObject({
      code: "conflict",
    });
    await expect(repository.createMochila(user, RESERVED_MOCHILA_NAME)).rejects.toMatchObject({
      code: "invalid",
    });
    await expect(
      repository.renameMochila(user, kit.id, " sem mochila "),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("keeps Sem mochila exclusive and supports several named mochilas", async () => {
    const user = await createUser("mochila-selecao@example.com");
    const combate = await repository.createMochila(user, "Combate");
    const exploracao = await repository.createMochila(user, "Exploracao");

    await expect(
      repository.updateEquipmentSelection(user, "adaga", {
        mochilaIds: [combate.id],
        withoutMochila: true,
      }),
    ).rejects.toMatchObject({ code: "invalid" });

    await repository.updateEquipmentSelection(user, "adaga", {
      mochilaIds: [combate.id, exploracao.id],
      withoutMochila: false,
    });
    let snapshot = await repository.getSnapshot(user);
    expect(listIds(snapshot.associations, "adaga")).toEqual(
      [combate.id, exploracao.id].sort(),
    );
    expect(snapshot.totalUnique).toBe(1);

    await repository.updateEquipmentSelection(user, "adaga", {
      mochilaIds: [],
      withoutMochila: true,
    });
    snapshot = await repository.getSnapshot(user);
    expect(listIds(snapshot.associations, "adaga")).toEqual([snapshot.reserved.id]);

    await repository.updateEquipmentSelection(user, "adaga", {
      mochilaIds: [],
      withoutMochila: false,
    });
    snapshot = await repository.getSnapshot(user);
    expect(snapshot.totalUnique).toBe(0);
    expect(snapshot.items).toEqual([]);
  });

  it("moves items to Sem mochila only when their last named mochila is deleted", async () => {
    const user = await createUser("mochila-exclusao@example.com");
    const combate = await repository.createMochila(user, "Combate");
    const exploracao = await repository.createMochila(user, "Exploracao");

    await repository.updateEquipmentSelection(user, "adaga", {
      mochilaIds: [combate.id],
      withoutMochila: false,
    });
    await repository.updateEquipmentSelection(user, "escudo", {
      mochilaIds: [combate.id, exploracao.id],
      withoutMochila: false,
    });

    await repository.deleteMochila(user, combate.id);

    const snapshot = await repository.getSnapshot(user);
    expect(snapshot.namedMochilas.map((item) => item.id)).not.toContain(combate.id);
    expect(listIds(snapshot.associations, "adaga")).toEqual([snapshot.reserved.id]);
    expect(listIds(snapshot.associations, "escudo")).toEqual([exploracao.id]);
    expect(snapshot.reserved.total).toBe(1);
  });

  it("isolates reads and writes between users and rejects unknown identifiers", async () => {
    const owner = await createUser("mochila-dono@example.com");
    const intruder = await createUser("mochila-intruso@example.com");
    const mochila = await repository.createMochila(owner, "Campanha do Dono");

    await expect(
      repository.renameMochila(intruder, mochila.id, "Invadida"),
    ).rejects.toMatchObject({ code: "not-found" });
    await expect(repository.deleteMochila(intruder, mochila.id)).rejects.toMatchObject({
      code: "not-found",
    });
    await expect(
      repository.updateEquipmentSelection(owner, "adaga", {
        mochilaIds: [randomUUID()],
        withoutMochila: false,
      }),
    ).rejects.toMatchObject({ code: "not-found" });
    await expect(
      repository.updateEquipmentSelection(owner, "item-inexistente", {
        mochilaIds: [],
        withoutMochila: false,
      }),
    ).rejects.toMatchObject({ code: "not-found" });

    const ownerSnapshot = await repository.getSnapshot(owner);
    expect(ownerSnapshot.namedMochilas.map((item) => item.id)).toContain(mochila.id);
    expect((await repository.getSnapshot(intruder)).namedMochilas).toEqual([]);
  });
});
