// @vitest-environment jsdom
import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetLocalDatabaseForTests } from "@/lib/local/database";
import {
  createGrimoire,
  deleteGrimoire,
  getGrimoireIdsForSpell,
  listGrimoires,
  loadLocalCollections,
  renameGrimoire,
  updateSpellSelection,
} from "@/lib/local/grimoires";
import {
  RESERVED_GRIMOIRE_ID,
  RESERVED_GRIMOIRE_NAME,
} from "@/lib/validation/grimoire";

const SPELL_A = "11111111-1111-4111-8111-111111111111";
const SPELL_B = "22222222-2222-4222-8222-222222222222";

beforeEach(async () => {
  await resetLocalDatabaseForTests();
});

afterEach(async () => {
  await resetLocalDatabaseForTests();
});

describe("local collections", () => {
  it("creates the reserved collection automatically", async () => {
    const snapshot = await loadLocalCollections();

    expect(snapshot.reserved).toMatchObject({
      id: RESERVED_GRIMOIRE_ID,
      nome: RESERVED_GRIMOIRE_NAME,
      total: 0,
    });
    expect(snapshot.namedGrimoires).toEqual([]);
    expect(snapshot.totalUnique).toBe(0);

    const lists = await listGrimoires();
    expect(lists).toHaveLength(1);
    expect(lists[0]?.reservada).toBe(true);
  });

  it("normalizes grimoire names and prevents duplicates regardless of case", async () => {
    const created = await createGrimoire("  Campanha da Floresta  ");

    expect(created.nome).toBe("Campanha da Floresta");
    expect(created.id).not.toBe(RESERVED_GRIMOIRE_ID);

    await expect(createGrimoire("campanha da floresta")).rejects.toThrow(
      "Já existe um grimório com esse nome.",
    );
    await expect(createGrimoire("   ")).rejects.toThrow("Informe um nome para o grimório.");
  });

  it("reserves the No Grimoire name for the automatic collection", async () => {
    await expect(createGrimoire(RESERVED_GRIMOIRE_NAME)).rejects.toThrow(
      "O nome “Sem grimório” é reservado.",
    );

    const created = await createGrimoire("Combate");
    await expect(renameGrimoire(created.id, "sem grimório")).rejects.toThrow(
      "O nome “Sem grimório” é reservado.",
    );
  });

  it("prevents renaming and deleting the reserved collection", async () => {
    await expect(renameGrimoire(RESERVED_GRIMOIRE_ID, "Outro nome")).rejects.toThrow(
      "A coleção “Sem grimório” não pode ser renomeada.",
    );
    await expect(deleteGrimoire(RESERVED_GRIMOIRE_ID)).rejects.toThrow(
      "A coleção “Sem grimório” não pode ser excluída.",
    );
  });

  it("keeps the No Grimoire collection exclusive from named grimoires", async () => {
    const combat = await createGrimoire("Combate");
    const support = await createGrimoire("Suporte");

    await expect(
      updateSpellSelection(SPELL_A, {
        grimoireIds: [combat.id],
        withoutGrimoire: true,
      }),
    ).rejects.toThrow("“Sem grimório” é exclusivo");

    await updateSpellSelection(SPELL_A, {
      grimoireIds: [combat.id, support.id],
      withoutGrimoire: false,
    });
    expect(new Set(await getGrimoireIdsForSpell(SPELL_A))).toEqual(
      new Set([combat.id, support.id]),
    );

    await updateSpellSelection(SPELL_A, {
      grimoireIds: [],
      withoutGrimoire: true,
    });
    expect(await getGrimoireIdsForSpell(SPELL_A)).toEqual([RESERVED_GRIMOIRE_ID]);

    await updateSpellSelection(SPELL_A, {
      grimoireIds: [support.id],
      withoutGrimoire: false,
    });
    expect(await getGrimoireIdsForSpell(SPELL_A)).toEqual([support.id]);
  });

  it("moves spells to No Grimoire when deleting their last named grimoire", async () => {
    const combat = await createGrimoire("Combate");
    const support = await createGrimoire("Suporte");

    await updateSpellSelection(SPELL_A, {
      grimoireIds: [combat.id],
      withoutGrimoire: false,
    });
    await updateSpellSelection(SPELL_B, {
      grimoireIds: [combat.id, support.id],
      withoutGrimoire: false,
    });

    await deleteGrimoire(combat.id);

    expect((await listGrimoires()).map((list) => list.id)).not.toContain(combat.id);
    expect(await getGrimoireIdsForSpell(SPELL_A)).toEqual([RESERVED_GRIMOIRE_ID]);
    expect(await getGrimoireIdsForSpell(SPELL_B)).toEqual([support.id]);

    const snapshot = await loadLocalCollections();
    expect(snapshot.totalUnique).toBe(2);
    expect(snapshot.reserved.total).toBe(1);
    expect(snapshot.namedGrimoires.find((list) => list.id === support.id)?.total).toBe(1);
  });

  it("counts unique spells across all collections without duplicates", async () => {
    const combat = await createGrimoire("Combate");
    const support = await createGrimoire("Suporte");

    await updateSpellSelection(SPELL_A, {
      grimoireIds: [combat.id, support.id],
      withoutGrimoire: false,
    });

    const snapshot = await loadLocalCollections();
    expect(snapshot.totalUnique).toBe(1);
    expect(snapshot.namedGrimoires.map((list) => [list.nome, list.total])).toEqual([
      ["Combate", 1],
      ["Suporte", 1],
    ]);
  });
});
