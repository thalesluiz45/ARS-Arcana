import { mkdir } from "node:fs/promises";
import path from "node:path";

import type { DatabaseRow, DbClient } from "@/lib/db/types";

type PGliteModule = typeof import("@electric-sql/pglite");
type PGliteInstance = InstanceType<PGliteModule["PGlite"]>;

const DEFAULT_DATA_DIR = ".data/pglite";

let modulePromise: Promise<PGliteModule> | null = null;

function loadModule(): Promise<PGliteModule> {
  modulePromise ??= import("@electric-sql/pglite");
  return modulePromise;
}

/**
 * Resolves the development database encoded in DATABASE_URL.
 *
 * Accepted forms:
 * - `pglite:` / `pglite:memory` -> in-memory database
 * - `pglite:.data/catalogo` -> persistent directory
 * - `pglite://.data/catalogo` -> same persistent directory
 *
 * PGlite is an embedded PostgreSQL used for local development and tests. It is
 * never the production data source; hosted environments use NeonDB.
 */
export function parsePgliteConnectionString(connectionString: string): string | undefined {
  if (!connectionString.startsWith("pglite:")) return undefined;
  const raw = connectionString.slice("pglite:".length).replace(/^\/\//, "").trim();
  if (!raw || raw === "memory" || raw === "memory:") return undefined;
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), raw);
}

export type PgliteHandle = {
  client: DbClient;
  exec: (sql: string) => Promise<void>;
  getInstance: () => Promise<PGliteInstance>;
  close: () => Promise<void>;
};

export function createPgliteHandle(
  dataDir: string | null = path.resolve(process.cwd(), DEFAULT_DATA_DIR),
): PgliteHandle {
  let instancePromise: Promise<PGliteInstance> | null = null;

  const getInstance = (): Promise<PGliteInstance> => {
    instancePromise ??= loadModule().then(async ({ PGlite }) => {
      if (!dataDir) return new PGlite();
      await mkdir(dataDir, { recursive: true });
      return new PGlite(dataDir);
    });
    return instancePromise;
  };

  return {
    client: {
      async query<T extends DatabaseRow = DatabaseRow>(text: string, params: unknown[] = []) {
        const db = await getInstance();
        const result = await db.query<T>(text, params);
        return result.rows;
      },
    },
    async exec(sql: string) {
      const db = await getInstance();
      await db.exec(sql);
    },
    getInstance,
    async close() {
      if (!instancePromise) return;
      const db = await instancePromise.catch(() => null);
      await db?.close();
      instancePromise = null;
    },
  };
}
