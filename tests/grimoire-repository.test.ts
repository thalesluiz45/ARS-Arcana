import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runMigrations } from "@/lib/db/migrate";
import { createPgliteHandle, type PgliteHandle } from "@/lib/db/pglite";
import { GrimoireRepository } from "@/lib/grimoires/repository";
import { upsertCatalog } from "@/lib/import/spells";
import { RESERVED_GRIMOIRE_NAME } from "@/lib/validation/grimoire";

import { makeSpell } from "./fixtures";

let handle: PgliteHandle;
let repository: GrimoireRepository;
let spellA: string;
let spellB: string;

async function createUser(email: string): Promise<string> {
  const rows = await handle.client.query<{ id: string }>(
    "INSERT INTO public.usuarios (name, email) VALUES ($1, $2) RETURNING id",
    ["Aventureiro de teste", email],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("Usuário de teste não foi criado.");
  return id;
}

function spellIds(associations: { magiaId: string; listaId: string }[], spellId: string) {
  return associations
    .filter((association) => association.magiaId === spellId)
    .map((association) => association.listaId)
    .sort();
}

beforeAll(async () => {
  handle = createPgliteHandle(null);
  await handle.exec(
    await readFile(
      path.join(process.cwd(), "src", "lib", "db", "migrations", "001_create_magias.sql"),
      "utf8",
    ),
  );
  await handle.exec(
    await readFile(
      path.join(process.cwd(), "src", "lib", "db", "migrations", "002_auth_and_grimoires.sql"),
      "utf8",
    ),
  );

  const spells = await upsertCatalog(handle.client, [
    makeSpell({ slug: "bola-de-fogo", nome: "Bola de Fogo" }),
    makeSpell({ slug: "desejo", nome: "Desejo", circulo: 9 }),
  ]);
  spellA = spells[0]!.id;
  spellB = spells[1]!.id;
  repository = new GrimoireRepository(handle.client);
});

afterAll(async () => {
  await handle.close();
});

describe("remote grimoire repository", () => {
  it("creates exactly one reserved collection per user", async () => {
    const user = await createUser("reservado@example.com");

    const first = await repository.ensureReservedGrimoire(user);
    const second = await repository.ensureReservedGrimoire(user);

    expect(first.id).toBe(second.id);
    expect(first).toMatchObject({
      nome: RESERVED_GRIMOIRE_NAME,
      reservada: true,
    });

    const snapshot = await repository.getSnapshot(user);
    expect(snapshot.lists).toHaveLength(1);
    expect(snapshot.namedGrimoires).toEqual([]);
    expect(snapshot.reserved).toMatchObject({ total: 0 });
    expect(snapshot.totalUnique).toBe(0);
  });

  it("normalizes names, rejects duplicates case-insensitively, and reserves Sem grimório", async () => {
    const user = await createUser("nomes@example.com");

    const combat = await repository.createGrimoire(user, "  Combate  ");
    expect(combat.nome).toBe("Combate");
    expect(combat.reservada).toBe(false);

    await expect(repository.createGrimoire(user, "combate")).rejects.toMatchObject({
      code: "conflict",
    });
    await expect(repository.createGrimoire(user, RESERVED_GRIMOIRE_NAME)).rejects.toMatchObject({
      code: "invalid",
    });
    await expect(repository.renameGrimoire(user, combat.id, " sem grimório ")).rejects.toMatchObject(
      { code: "invalid" },
    );

    const other = await createUser("nomes-outro@example.com");
    const otherCombat = await repository.createGrimoire(other, "Combate");
    expect(otherCombat.id).not.toBe(combat.id);
  });

  it("isolates reads and writes between two users", async () => {
    const owner = await createUser("dono@example.com");
    const intruder = await createUser("intruso@example.com");
    const grimoire = await repository.createGrimoire(owner, "Campanha do Dono");

    await expect(
      repository.renameGrimoire(intruder, grimoire.id, "Invadido"),
    ).rejects.toMatchObject({ code: "not-found" });
    await expect(repository.deleteGrimoire(intruder, grimoire.id)).rejects.toMatchObject({
      code: "not-found",
    });

    const intruderSnapshot = await repository.getSnapshot(intruder);
    expect(intruderSnapshot.namedGrimoires.map((item) => item.id)).not.toContain(grimoire.id);

    const ownerSnapshot = await repository.getSnapshot(owner);
    expect(ownerSnapshot.namedGrimoires.map((item) => item.id)).toContain(grimoire.id);
  });

  it("keeps Sem grimório exclusive and supports multiple named grimoires", async () => {
    const user = await createUser("selecao@example.com");
    const combat = await repository.createGrimoire(user, "Combate");
    const support = await repository.createGrimoire(user, "Suporte");

    await expect(
      repository.updateSpellSelection(user, spellA, {
        grimoireIds: [combat.id],
        withoutGrimoire: true,
      }),
    ).rejects.toMatchObject({ code: "invalid" });

    await repository.updateSpellSelection(user, spellA, {
      grimoireIds: [combat.id, support.id],
      withoutGrimoire: false,
    });
    let snapshot = await repository.getSnapshot(user);
    expect(spellIds(snapshot.associations, spellA)).toEqual([combat.id, support.id].sort());

    await repository.updateSpellSelection(user, spellA, {
      grimoireIds: [],
      withoutGrimoire: true,
    });
    snapshot = await repository.getSnapshot(user);
    expect(spellIds(snapshot.associations, spellA)).toEqual([snapshot.reserved.id]);

    await repository.updateSpellSelection(user, spellA, {
      grimoireIds: [support.id],
      withoutGrimoire: false,
    });
    snapshot = await repository.getSnapshot(user);
    expect(spellIds(snapshot.associations, spellA)).toEqual([support.id]);
  });

  it("moves spells to Sem grimório only when deleting their last named grimoire", async () => {
    const user = await createUser("exclusao@example.com");
    const combat = await repository.createGrimoire(user, "Combate");
    const support = await repository.createGrimoire(user, "Suporte");

    await repository.updateSpellSelection(user, spellA, {
      grimoireIds: [combat.id],
      withoutGrimoire: false,
    });
    await repository.updateSpellSelection(user, spellB, {
      grimoireIds: [combat.id, support.id],
      withoutGrimoire: false,
    });

    await repository.deleteGrimoire(user, combat.id);

    const snapshot = await repository.getSnapshot(user);
    expect(snapshot.namedGrimoires.map((item) => item.id)).not.toContain(combat.id);
    expect(spellIds(snapshot.associations, spellA)).toEqual([snapshot.reserved.id]);
    expect(spellIds(snapshot.associations, spellB)).toEqual([support.id]);
    expect(snapshot.totalUnique).toBe(2);
    expect(snapshot.reserved.total).toBe(1);
    expect(snapshot.namedGrimoires.find((item) => item.id === support.id)?.total).toBe(1);
  });

  it("refuses to rename or delete the reserved collection", async () => {
    const user = await createUser("reservado-protegido@example.com");
    const reserved = await repository.ensureReservedGrimoire(user);

    await expect(
      repository.renameGrimoire(user, reserved.id, "Outro nome"),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(repository.deleteGrimoire(user, reserved.id)).rejects.toMatchObject({
      code: "invalid",
    });
  });

  it("rejects unknown spell and grimoire identifiers", async () => {
    const user = await createUser("desconhecidos@example.com");

    await expect(
      repository.updateSpellSelection(user, randomUUID(), {
        grimoireIds: [],
        withoutGrimoire: false,
      }),
    ).rejects.toMatchObject({ code: "not-found" });

    await expect(
      repository.updateSpellSelection(user, spellA, {
        grimoireIds: [randomUUID()],
        withoutGrimoire: false,
      }),
    ).rejects.toMatchObject({ code: "not-found" });
  });

  it("cascades account deletion through grimoires and saved spells", async () => {
    const user = await createUser("cascata@example.com");
    const grimoire = await repository.createGrimoire(user, "Temporário");
    await repository.updateSpellSelection(user, spellA, {
      grimoireIds: [grimoire.id],
      withoutGrimoire: false,
    });

    await handle.client.query("DELETE FROM public.usuarios WHERE id = $1", [user]);

    const grimoires = await handle.client.query(
      "SELECT 1 FROM public.grimorios WHERE user_id = $1",
      [user],
    );
    const associations = await handle.client.query(
      "SELECT 1 FROM public.magias_salvas WHERE grimorio_id = $1",
      [grimoire.id],
    );
    expect(grimoires).toHaveLength(0);
    expect(associations).toHaveLength(0);
  });
});

describe("auth and grimoire migrations", () => {
  it("applies both migrations idempotently through the migration runner", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "ars-arcana-auth-migracao-"));
    const connectionString = `pglite:${path.join(directory, "banco")}`;

    try {
      const first = await runMigrations(connectionString);
      expect(first.applied).toEqual([
        "001_create_magias.sql",
        "002_auth_and_grimoires.sql",
      ]);

      const second = await runMigrations(connectionString);
      expect(second.applied).toEqual([]);
      expect(second.skipped).toEqual([
        "001_create_magias.sql",
        "002_auth_and_grimoires.sql",
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
