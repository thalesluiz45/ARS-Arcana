import { getDatabase, LocalStorageError, type SpellCacheRecord } from "@/lib/local/database";
import { notifyLocalDataChanged } from "@/lib/local/events";
import { spellIdSchema, spellSchema, type Spell } from "@/lib/validation/spell";

export const SNAPSHOT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type CachedSpell = {
  spell: Spell;
  cachedAt: string;
  expiresAt: string;
  stale: boolean;
};

export type CachedSpellState = {
  spell: Spell | null;
  cachedAt: string | null;
  expiresAt: string | null;
  stale: boolean;
  missing: boolean;
};

function validateId(spellId: string): string {
  const parsed = spellIdSchema.safeParse(spellId);
  if (!parsed.success) {
    throw new LocalStorageError("Identificador de magia inválido.");
  }
  return parsed.data;
}

function toCachedSpell(record: SpellCacheRecord): CachedSpell | null {
  const parsed = spellSchema.safeParse(record.snapshot);
  if (!parsed.success) return null;
  return {
    spell: parsed.data,
    cachedAt: record.cachedAt,
    expiresAt: record.expiresAt,
    stale: new Date(record.expiresAt).getTime() <= Date.now(),
  };
}

export async function saveSpellSnapshot(spell: Spell, ttlMs = SNAPSHOT_TTL_MS): Promise<void> {
  const parsed = spellSchema.parse(spell);
  const now = new Date();
  const record: SpellCacheRecord = {
    magiaId: parsed.id,
    snapshot: parsed,
    cachedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
  };

  try {
    const db = await getDatabase();
    await db.put("cache_magias", record);
    notifyLocalDataChanged({ reason: "cache-updated", magiaId: parsed.id });
  } catch (error) {
    if (error instanceof LocalStorageError) throw error;
    throw new LocalStorageError("Não foi possível atualizar o cache local da magia.", {
      cause: error,
    });
  }
}

export async function saveSpellSnapshots(spells: Spell[], ttlMs = SNAPSHOT_TTL_MS): Promise<void> {
  if (spells.length === 0) return;
  try {
    const db = await getDatabase();
    const now = new Date();
    const transaction = db.transaction("cache_magias", "readwrite");
    for (const spell of spells) {
      const parsed = spellSchema.parse(spell);
      transaction.store.put({
        magiaId: parsed.id,
        snapshot: parsed,
        cachedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      });
    }
    await transaction.done;
  } catch (error) {
    if (error instanceof LocalStorageError) throw error;
    throw new LocalStorageError("Não foi possível atualizar o cache local das magias.", {
      cause: error,
    });
  }
}

export async function getSpellSnapshot(spellId: string): Promise<CachedSpell | null> {
  const validId = validateId(spellId);
  try {
    const db = await getDatabase();
    const record = await db.get("cache_magias", validId);
    return record ? toCachedSpell(record) : null;
  } catch (error) {
    if (error instanceof LocalStorageError) throw error;
    throw new LocalStorageError("Não foi possível ler o cache local da magia.", { cause: error });
  }
}

export async function getSpellSnapshots(ids: string[]): Promise<Map<string, CachedSpellState>> {
  const validIds = [...new Set(ids)].map(validateId);
  const states = new Map<string, CachedSpellState>();
  for (const id of validIds) {
    states.set(id, {
      spell: null,
      cachedAt: null,
      expiresAt: null,
      stale: false,
      missing: true,
    });
  }
  if (validIds.length === 0) return states;

  try {
    const db = await getDatabase();
    const records = await db.getAll("cache_magias");
    const requested = new Set(validIds);
    for (const record of records) {
      if (!requested.has(record.magiaId)) continue;
      const cached = toCachedSpell(record);
      if (!cached) continue;
      states.set(record.magiaId, {
        spell: cached.spell,
        cachedAt: cached.cachedAt,
        expiresAt: cached.expiresAt,
        stale: cached.stale,
        missing: false,
      });
    }
    return states;
  } catch (error) {
    if (error instanceof LocalStorageError) throw error;
    throw new LocalStorageError("Não foi possível ler o cache local das magias.", { cause: error });
  }
}

export async function fetchSpellsFromServer(
  ids: string[],
  options: { signal?: AbortSignal } = {},
): Promise<Spell[]> {
  const validIds = [...new Set(ids)].map(validateId);
  if (validIds.length === 0) return [];

  const chunks: string[][] = [];
  for (let index = 0; index < validIds.length; index += 100) {
    chunks.push(validIds.slice(index, index + 100));
  }

  const spells: Spell[] = [];
  for (const chunk of chunks) {
    const params = new URLSearchParams({ ids: chunk.join(",") });
    const response = await fetch(`/api/magias?${params.toString()}`, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: options.signal,
    });

    if (!response.ok) {
      try {
        await response.text();
      } catch {
        // The status already carries the actionable failure information.
      }
      throw new Error(`O catálogo respondeu com status ${response.status}.`);
    }

    const payload: unknown = await response.json();
    const parsed = spellSchema.array().safeParse(payload);
    if (!parsed.success) {
      throw new Error("O catálogo retornou dados em formato inesperado.");
    }
    spells.push(...parsed.data);
  }

  return spells;
}

export async function refreshSpellSnapshots(ids: string[]): Promise<Map<string, Spell>> {
  const spells = await fetchSpellsFromServer(ids);
  if (spells.length > 0) {
    await saveSpellSnapshots(spells);
  }
  return new Map(spells.map((spell) => [spell.id, spell]));
}

export async function clearExpiredSpellSnapshots(): Promise<void> {
  try {
    const db = await getDatabase();
    const transaction = db.transaction("cache_magias", "readwrite");
    const index = transaction.store.index("by-expira");
    const now = new Date().toISOString();
    let cursor = await index.openCursor(IDBKeyRange.upperBound(now));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await transaction.done;
  } catch (error) {
    if (error instanceof LocalStorageError) throw error;
    throw new LocalStorageError("Não foi possível limpar snapshots expirados.", { cause: error });
  }
}
