import { getDatabase, LocalStorageError, type MagiaCacheRecord } from "@/lib/local/database";
import { notifyLocalDataChanged } from "@/lib/local/events";
import { magiaIdSchema, magiaSchema, type Magia } from "@/lib/validation/magia";

export const SNAPSHOT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type CachedSpell = {
  spell: Magia;
  cachedAt: string;
  expiresAt: string;
  stale: boolean;
};

export type CachedSpellState = {
  spell: Magia | null;
  cachedAt: string | null;
  expiresAt: string | null;
  stale: boolean;
  missing: boolean;
};

function validateId(magiaId: string): string {
  const parsed = magiaIdSchema.safeParse(magiaId);
  if (!parsed.success) {
    throw new LocalStorageError("Identificador de magia inválido.");
  }
  return parsed.data;
}

function toCachedSpell(record: MagiaCacheRecord): CachedSpell | null {
  const parsed = magiaSchema.safeParse(record.snapshot);
  if (!parsed.success) return null;
  return {
    spell: parsed.data,
    cachedAt: record.cachedAt,
    expiresAt: record.expiresAt,
    stale: new Date(record.expiresAt).getTime() <= Date.now(),
  };
}

export async function salvarSnapshot(magia: Magia, ttlMs = SNAPSHOT_TTL_MS): Promise<void> {
  const parsed = magiaSchema.parse(magia);
  const now = new Date();
  const record: MagiaCacheRecord = {
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

export async function salvarSnapshots(magias: Magia[], ttlMs = SNAPSHOT_TTL_MS): Promise<void> {
  if (magias.length === 0) return;
  try {
    const db = await getDatabase();
    const now = new Date();
    const transaction = db.transaction("cache_magias", "readwrite");
    for (const magia of magias) {
      const parsed = magiaSchema.parse(magia);
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

export async function obterSnapshot(magiaId: string): Promise<CachedSpell | null> {
  const validId = validateId(magiaId);
  try {
    const db = await getDatabase();
    const record = await db.get("cache_magias", validId);
    return record ? toCachedSpell(record) : null;
  } catch (error) {
    if (error instanceof LocalStorageError) throw error;
    throw new LocalStorageError("Não foi possível ler o cache local da magia.", { cause: error });
  }
}

export async function obterSnapshots(ids: string[]): Promise<Map<string, CachedSpellState>> {
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

export async function buscarSpellsNoServidor(
  ids: string[],
  options: { signal?: AbortSignal } = {},
): Promise<Magia[]> {
  const validIds = [...new Set(ids)].map(validateId);
  if (validIds.length === 0) return [];

  const chunks: string[][] = [];
  for (let index = 0; index < validIds.length; index += 100) {
    chunks.push(validIds.slice(index, index + 100));
  }

  const spells: Magia[] = [];
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
    const parsed = magiaSchema.array().safeParse(payload);
    if (!parsed.success) {
      throw new Error("O catálogo retornou dados em formato inesperado.");
    }
    spells.push(...parsed.data);
  }

  return spells;
}

export async function atualizarSnapshotsDeIds(ids: string[]): Promise<Map<string, Magia>> {
  const spells = await buscarSpellsNoServidor(ids);
  if (spells.length > 0) {
    await salvarSnapshots(spells);
  }
  return new Map(spells.map((spell) => [spell.id, spell]));
}

export async function limparSnapshotsExpirados(): Promise<void> {
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
