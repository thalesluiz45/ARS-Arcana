import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";

import { createPgliteHandle, parsePgliteConnectionString } from "@/lib/db/pglite";
import type { DatabaseRow, DbClient } from "@/lib/db/types";

export class DatabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigError";
  }
}

function isNeonHost(connectionString: string): boolean {
  try {
    return /(^|\.)neon\.tech$/i.test(new URL(connectionString).hostname);
  } catch {
    return false;
  }
}

/**
 * The Neon serverless driver is used for hosted Neon databases. A standard
 * PostgreSQL connection (local development or an isolated test database) uses
 * node-postgres instead. `pglite:` URLs open the embedded PostgreSQL used for
 * local development. The repository only depends on the small DbClient
 * interface, so every adapter shares the same queries.
 */
export function createDbClient(connectionString: string): DbClient {
  if (connectionString.startsWith("pglite:")) {
    const handle = createPgliteHandle(parsePgliteConnectionString(connectionString) ?? null);
    return { ...handle.client, close: handle.close };
  }

  if (isNeonHost(connectionString)) {
    const sql = neon(connectionString);
    return {
      async query<T extends DatabaseRow = DatabaseRow>(text: string, params: unknown[] = []) {
        const rows = (await sql.query(text, params)) as T[];
        return rows;
      },
    };
  }

  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  return {
    async query<T extends DatabaseRow = DatabaseRow>(text: string, params: unknown[] = []) {
      const result = await pool.query(text, params);
      return result.rows as T[];
    },
    async close() {
      await pool.end();
    },
  };
}
