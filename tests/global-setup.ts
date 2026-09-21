import "dotenv/config";
import { runMigrations } from "../scripts/migrate";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/superfan_test";

export default async function setup() {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  Object.assign(process.env, { NODE_ENV: "test" });
  await runMigrations(TEST_DATABASE_URL);
}
