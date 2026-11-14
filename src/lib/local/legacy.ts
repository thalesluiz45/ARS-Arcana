import { getDatabase, isIndexedDbAvailable } from "@/lib/local/database";
import { RESERVED_GRIMOIRE_ID } from "@/lib/validation/grimoire";

export const LEGACY_CLEANUP_PENDING_KEY = "ars-arcana:legacy-cleanup-pending";

export type LegacyListDataSummary = {
  hasData: boolean;
  namedGrimoires: number;
  savedSpells: number;
};

const EMPTY_SUMMARY: LegacyListDataSummary = {
  hasData: false,
  namedGrimoires: 0,
  savedSpells: 0,
};

/**
 * Checks only the old list stores. `cache_magias` is a catalog snapshot cache
 * and must never be treated as user data.
 */
export async function inspectLegacyListData(): Promise<LegacyListDataSummary> {
  if (!isIndexedDbAvailable()) return EMPTY_SUMMARY;

  const db = await getDatabase();
  const transaction = db.transaction(["listas_salvas", "magias_salvas"], "readonly");
  const [lists, associations] = await Promise.all([
    transaction.objectStore("listas_salvas").getAll(),
    transaction.objectStore("magias_salvas").getAll(),
  ]);
  await transaction.done;

  const namedGrimoires = lists.filter(
    (list) => !list.reservada && list.id !== RESERVED_GRIMOIRE_ID,
  ).length;

  return {
    hasData: namedGrimoires > 0 || associations.length > 0,
    namedGrimoires,
    savedSpells: associations.length,
  };
}

export async function clearLegacyListData(): Promise<void> {
  const db = await getDatabase();
  const transaction = db.transaction(["listas_salvas", "magias_salvas"], "readwrite");
  await Promise.all([
    transaction.objectStore("listas_salvas").clear(),
    transaction.objectStore("magias_salvas").clear(),
  ]);
  await transaction.done;
}

export function markLegacyCleanupPending(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LEGACY_CLEANUP_PENDING_KEY, "1");
}

export function isLegacyCleanupPending(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(LEGACY_CLEANUP_PENDING_KEY) === "1";
}

export function clearLegacyCleanupPending(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LEGACY_CLEANUP_PENDING_KEY);
}
