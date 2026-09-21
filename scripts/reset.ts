import "dotenv/config";
import { createDb } from "../src/db";
import { runMigrations } from "./migrate";

/**
 * Drops every table in the public schema and re-applies migrations.
 * Development only.
 */
async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to reset a production database");
  const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/superfan";
  const { sql, close } = createDb(url);
  try {
    await sql.unsafe(`
      DROP SCHEMA IF EXISTS public CASCADE;
      DROP SCHEMA IF EXISTS drizzle CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO public;
    `);
  } finally {
    await close();
  }
  await runMigrations(url);
  console.log("✔ database reset");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
