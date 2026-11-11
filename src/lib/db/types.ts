export type DatabaseRow = Record<string, unknown>;

/**
 * The catalog repository only depends on this minimal interface. Hosted Neon,
 * a regular PostgreSQL connection and the embedded PGlite development database
 * all provide the same behavior.
 */
export interface DbClient {
  query<T extends DatabaseRow = DatabaseRow>(text: string, params?: unknown[]): Promise<T[]>;
  close?(): Promise<void>;
}
