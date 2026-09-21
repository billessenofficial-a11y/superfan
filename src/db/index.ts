import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "@/lib/env";

export type Database = PostgresJsDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DbOrTx = Database | Transaction;

declare global {
  var __superfanSql: ReturnType<typeof postgres> | undefined;
  var __superfanDb: Database | undefined;
}

function createClient(url: string) {
  return postgres(url, {
    max: env.NODE_ENV === "production" ? 10 : 5,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    onnotice: () => {},
  });
}

/**
 * Shared Postgres client. Reused across hot reloads in development via a
 * global so we do not exhaust connections.
 */
export function getSql() {
  if (!globalThis.__superfanSql) {
    globalThis.__superfanSql = createClient(env.DATABASE_URL);
  }
  return globalThis.__superfanSql;
}

export function getDb(): Database {
  if (!globalThis.__superfanDb) {
    globalThis.__superfanDb = drizzle(getSql(), { schema });
  }
  return globalThis.__superfanDb;
}

/** Create an isolated client, e.g. for scripts and tests. */
export function createDb(url: string) {
  const sql = createClient(url);
  const db = drizzle(sql, { schema });
  return { db, sql, close: () => sql.end({ timeout: 5 }) };
}

export const db = new Proxy({} as Database, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});

export { schema };
