import { and, eq } from "drizzle-orm";
import { db as defaultDb, type DbOrTx } from "@/db";
import { artistFans } from "@/db/schema";

/** The fan's relationship with an artist, or null when they have not joined / been seen. */
export async function getMembership(artistId: string, fanId: string, conn: DbOrTx = defaultDb) {
  const [row] = await conn
    .select({ id: artistFans.id, joinedAt: artistFans.joinedAt, superfanScore: artistFans.superfanScore })
    .from(artistFans)
    .where(and(eq(artistFans.artistId, artistId), eq(artistFans.fanId, fanId)))
    .limit(1);
  return row ?? null;
}
