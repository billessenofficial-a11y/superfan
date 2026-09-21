import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { artistEvents, artistFans, fanLevels, fanTags } from "@/db/schema";

/** Everything the segment builder needs for its selects, plus the fan total for the share bar. */
export async function getSegmentBuilderData(artistId: string) {
  const [levels, tags, events, [{ total }]] = await Promise.all([
    db.select({ id: fanLevels.id, name: fanLevels.name, color: fanLevels.color }).from(fanLevels).where(eq(fanLevels.artistId, artistId)).orderBy(fanLevels.sortOrder),
    db.select({ id: fanTags.id, name: fanTags.name, color: fanTags.color }).from(fanTags).where(eq(fanTags.artistId, artistId)).orderBy(fanTags.name),
    db.select({ id: artistEvents.id, name: artistEvents.name, startsAt: artistEvents.startsAt }).from(artistEvents).where(eq(artistEvents.artistId, artistId)).orderBy(desc(artistEvents.startsAt)).limit(100),
    db.select({ total: sql<number>`count(*)::int` }).from(artistFans).where(eq(artistFans.artistId, artistId)),
  ]);
  return { options: { levels, tags, events }, totalFans: total };
}
