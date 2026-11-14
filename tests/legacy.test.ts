// @vitest-environment jsdom
import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getDatabase, resetLocalDatabaseForTests } from "@/lib/local/database";
import {
  LEGACY_CLEANUP_PENDING_KEY,
  clearLegacyCleanupPending,
  clearLegacyListData,
  inspectLegacyListData,
  isLegacyCleanupPending,
  markLegacyCleanupPending,
} from "@/lib/local/legacy";
import { spellSchema } from "@/lib/validation/spell";

import { makeSpell } from "./fixtures";

const SPELL_ID = "11111111-1111-4111-8111-111111111111";
const NOW = "2026-01-01T00:00:00.000Z";

function legacyGrimoire(id: string, nome: string, reservada = false) {
  return { id, nome, criadaEm: NOW, atualizadaEm: NOW, reservada };
}

beforeEach(async () => {
  await resetLocalDatabaseForTests();
  window.localStorage.clear();
});

afterEach(async () => {
  await resetLocalDatabaseForTests();
  window.localStorage.clear();
});

describe("legacy IndexedDB list data", () => {
  it("detects only named grimoires and saved-spell associations", async () => {
    const db = await getDatabase();
    await db.put("listas_salvas", legacyGrimoire("sem-grimorio", "Sem grimório", true));
    expect(await inspectLegacyListData()).toMatchObject({
      hasData: false,
      namedGrimoires: 0,
      savedSpells: 0,
    });

    await db.put("listas_salvas", legacyGrimoire("combate", "Combate"));
    await db.put("magias_salvas", {
      listaId: "combate",
      magiaId: SPELL_ID,
      salvaEm: NOW,
    });

    expect(await inspectLegacyListData()).toEqual({
      hasData: true,
      namedGrimoires: 1,
      savedSpells: 1,
    });
  });

  it("clears list stores but preserves the catalog snapshot cache", async () => {
    const db = await getDatabase();
    const spell = spellSchema.parse({
      ...makeSpell(),
      id: SPELL_ID,
      criadoEm: NOW,
      atualizadoEm: NOW,
    });

    await db.put("listas_salvas", legacyGrimoire("combate", "Combate"));
    await db.put("magias_salvas", {
      listaId: "combate",
      magiaId: SPELL_ID,
      salvaEm: NOW,
    });
    await db.put("cache_magias", {
      magiaId: SPELL_ID,
      snapshot: spell,
      cachedAt: NOW,
      expiresAt: "2026-01-08T00:00:00.000Z",
    });

    await clearLegacyListData();

    expect(await db.getAll("listas_salvas")).toEqual([]);
    expect(await db.getAll("magias_salvas")).toEqual([]);
    expect(await db.get("cache_magias", SPELL_ID)).toMatchObject({
      magiaId: SPELL_ID,
    });
    expect(await inspectLegacyListData()).toEqual({
      hasData: false,
      namedGrimoires: 0,
      savedSpells: 0,
    });
  });

  it("tracks the explicit cleanup confirmation flag", () => {
    expect(isLegacyCleanupPending()).toBe(false);
    expect(window.localStorage.getItem(LEGACY_CLEANUP_PENDING_KEY)).toBeNull();

    markLegacyCleanupPending();
    expect(isLegacyCleanupPending()).toBe(true);

    clearLegacyCleanupPending();
    expect(isLegacyCleanupPending()).toBe(false);
    expect(window.localStorage.getItem(LEGACY_CLEANUP_PENDING_KEY)).toBeNull();
  });

  it("reports no legacy data when IndexedDB is unavailable", async () => {
    const original = Object.getOwnPropertyDescriptor(window, "indexedDB");
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      value: undefined,
    });

    try {
      expect(await inspectLegacyListData()).toEqual({
        hasData: false,
        namedGrimoires: 0,
        savedSpells: 0,
      });
    } finally {
      if (original) Object.defineProperty(window, "indexedDB", original);
    }
  });
});
