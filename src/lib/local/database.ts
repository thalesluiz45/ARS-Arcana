import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { Grimoire, SavedSpell } from "@/lib/validation/grimoire";
import type { Spell } from "@/lib/validation/spell";

export const LOCAL_DB_NAME = "ars-arcana";
export const LOCAL_DB_VERSION = 1;

export type SpellCacheRecord = {
  magiaId: string;
  snapshot: Spell;
  cachedAt: string;
  expiresAt: string;
};

export interface ArsArcanaDB extends DBSchema {
  listas_salvas: {
    key: string;
    value: Grimoire;
    indexes: { "by-nome": string };
  };
  magias_salvas: {
    key: [string, string];
    value: SavedSpell;
    indexes: { "by-lista": string; "by-magia": string };
  };
  cache_magias: {
    key: string;
    value: SpellCacheRecord;
    indexes: { "by-expira": string };
  };
}

export class LocalStorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "LocalStorageError";
  }
}

let databasePromise: Promise<IDBPDatabase<ArsArcanaDB>> | null = null;

export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

export function getDatabase(): Promise<IDBPDatabase<ArsArcanaDB>> {
  if (!isIndexedDbAvailable()) {
    return Promise.reject(
      new LocalStorageError(
        "O armazenamento local do navegador não está disponível. Grimórios e magias salvas não podem ser acessados.",
      ),
    );
  }

  if (!databasePromise) {
    databasePromise = openDB<ArsArcanaDB>(LOCAL_DB_NAME, LOCAL_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("listas_salvas")) {
          const store = db.createObjectStore("listas_salvas", { keyPath: "id" });
          store.createIndex("by-nome", "nome");
        }
        if (!db.objectStoreNames.contains("magias_salvas")) {
          const store = db.createObjectStore("magias_salvas", {
            keyPath: ["listaId", "magiaId"],
          });
          store.createIndex("by-lista", "listaId");
          store.createIndex("by-magia", "magiaId");
        }
        if (!db.objectStoreNames.contains("cache_magias")) {
          const store = db.createObjectStore("cache_magias", { keyPath: "magiaId" });
          store.createIndex("by-expira", "expiresAt");
        }
      },
      blocked() {
        // A connection from a previous version is keeping the upgrade blocked.
        // The UI surfaces the failure through LocalStorageError.
      },
      blocking() {
        databasePromise?.then((db) => db.close()).catch(() => undefined);
      },
      terminated() {
        databasePromise = null;
      },
    })
      .catch((error) => {
        databasePromise = null;
        throw new LocalStorageError(
          "Não foi possível abrir o armazenamento local de grimórios.",
          { cause: error },
        );
      });
  }

  return databasePromise;
}

export async function resetLocalDatabaseForTests(): Promise<void> {
  if (databasePromise) {
    const db = await databasePromise.catch(() => null);
    db?.close();
    databasePromise = null;
  }
  if (!isIndexedDbAvailable()) return;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(LOCAL_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}
