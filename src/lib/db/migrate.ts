import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { Pool } from "pg";

import { createPgliteHandle, parsePgliteConnectionString } from "@/lib/db/pglite";
import type { DatabaseRow } from "@/lib/db/types";

const MIGRATIONS_DIR = path.join(process.cwd(), "src", "lib", "db", "migrations");

export type MigrationResult = {
  applied: string[];
  skipped: string[];
};

type MigrationRow = { filename: string };

type MigrationTarget = {
  query: <T extends DatabaseRow = DatabaseRow>(text: string, params?: unknown[]) => Promise<T[]>;
  exec: (sql: string) => Promise<void>;
  close: () => Promise<void>;
};

async function createMigrationTarget(connectionString: string): Promise<MigrationTarget> {
  if (connectionString.startsWith("pglite:")) {
    const handle = createPgliteHandle(parsePgliteConnectionString(connectionString) ?? null);
    return {
      query: handle.client.query,
      exec: handle.exec,
      close: handle.close,
    };
  }

  const pool = new Pool({ connectionString, max: 1 });
  const client = await pool.connect();

  return {
    async query<T extends DatabaseRow = DatabaseRow>(text: string, params: unknown[] = []) {
      const result = await client.query(text, params);
      return result.rows as T[];
    },
    async exec(sql: string) {
      await client.query(sql);
    },
    async close() {
      client.release();
      await pool.end();
    },
  };
}

export async function runMigrations(connectionString: string): Promise<MigrationResult> {
  const target = await createMigrationTarget(connectionString);

  try {
    await target.exec(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((file) => file.endsWith(".sql"))
      .sort((left, right) => left.localeCompare(right));

    const appliedRows = await target.query<MigrationRow>(
      "SELECT filename FROM public.schema_migrations",
    );
    const applied = new Set(appliedRows.map((row) => row.filename));

    const result: MigrationResult = { applied: [], skipped: [] };

    for (const filename of files) {
      if (applied.has(filename)) {
        result.skipped.push(filename);
        continue;
      }

      const sql = await readFile(path.join(MIGRATIONS_DIR, filename), "utf8");
      await target.exec("BEGIN");
      try {
        await target.exec(sql);
        await target.query("INSERT INTO public.schema_migrations (filename) VALUES ($1)", [
          filename,
        ]);
        await target.exec("COMMIT");
        result.applied.push(filename);
      } catch (error) {
        await target.exec("ROLLBACK");
        throw new Error(`Falha ao aplicar a migração ${filename}.`, { cause: error });
      }
    }

    return result;
  } finally {
    await target.close();
  }
}
