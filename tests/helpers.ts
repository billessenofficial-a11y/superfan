import { randomUUID } from "node:crypto";
import { createDb } from "@/db";
import { users } from "@/db/schema";
import { createArtist } from "@/lib/artists/create";

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/superfan_test";
Object.assign(process.env, { NODE_ENV: "test" });

export const testDb = createDb(process.env.DATABASE_URL);
export const db = testDb.db;

export async function closeTestDb() {
  await testDb.close();
}

export async function makeUser(email = `${randomUUID()}@test.superfan`) {
  const [u] = await db.insert(users).values({ email, displayName: "Test User" }).returning();
  return u;
}

export async function makeArtist(overrides: Partial<Parameters<typeof createArtist>[1]> = {}) {
  const owner = await makeUser();
  const artist = await createArtist(db, {
    name: overrides.name ?? "Test Artist",
    slug: overrides.slug ?? `artist-${randomUUID().slice(0, 8)}`,
    createdByUserId: owner.id,
    ...overrides,
  });
  return { artist, owner };
}

export function uniqueEmail(prefix = "fan") {
  return `${prefix}-${randomUUID().slice(0, 8)}@test.superfan`;
}
