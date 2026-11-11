import "server-only";

import { DatabaseConfigError, createDbClient } from "@/lib/db/factory";
import type { DbClient } from "@/lib/db/types";

export { DatabaseConfigError, createDbClient } from "@/lib/db/factory";
export type { DatabaseRow, DbClient } from "@/lib/db/types";

let singleton: DbClient | null = null;

function readDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new DatabaseConfigError(
      "DATABASE_URL não configurada. Defina a conexão do NeonDB no ambiente do servidor.",
    );
  }
  return url;
}

export function getDb(): DbClient {
  if (!singleton) {
    singleton = createDbClient(readDatabaseUrl());
  }
  return singleton;
}

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}
