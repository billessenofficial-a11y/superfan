import { and, count, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { artistEvents, challengeCompletions, challenges } from "@/db/schema";
import { can, requireArtistContext } from "@/lib/auth/context";
import { ChallengesView } from "@/components/programs/challenges-view";

export const metadata = { title: "Challenges · Superfan" };

export default async function ChallengesPage() {
  const ctx = await requireArtistContext();
  const artistId = ctx.artist.id;

  const [rows, counts, events] = await Promise.all([
    db
      .select()
      .from(challenges)
      .where(and(eq(challenges.artistId, artistId), ne(challenges.status, "archived")))
      .orderBy(desc(challenges.createdAt)),
    db
      .select({ challengeId: challengeCompletions.challengeId, completions: count() })
      .from(challengeCompletions)
      .where(eq(challengeCompletions.artistId, artistId))
      .groupBy(challengeCompletions.challengeId),
    db
      .select({ id: artistEvents.id, name: artistEvents.name, city: artistEvents.city, startsAt: artistEvents.startsAt })
      .from(artistEvents)
      .where(eq(artistEvents.artistId, artistId))
      .orderBy(desc(artistEvents.startsAt)),
  ]);

  const countById = new Map(counts.map((c) => [c.challengeId, c.completions]));
  const list = rows.map((c) => ({ ...c, completions: countById.get(c.id) ?? 0 }));

  return <ChallengesView challenges={list} events={events} canManage={can(ctx.role, "manageChallenges")} />;
}
