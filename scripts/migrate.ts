import "dotenv/config";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "../src/db";

/**
 * Applies every migration in supabase/migrations (tracked in the
 * drizzle.__drizzle_migrations table). Safe to run repeatedly.
 */
export async function runMigrations(url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/superfan") {
  const { db, close } = createDb(url);
  try {
    await migrate(db, { migrationsFolder: "./supabase/migrations" });
  } finally {
    await close();
  }
}

if (process.argv[1] && process.argv[1].endsWith("migrate.ts")) {
  runMigrations()
    .then(() => {
      console.log("✔ migrations applied");
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
