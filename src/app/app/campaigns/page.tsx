import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { artistEvents, campaigns, challenges, fanLevels, rewards, segments } from "@/db/schema";
import { can, requireArtistContext } from "@/lib/auth/context";
import { CampaignsView } from "@/components/programs/campaigns-view";

export const metadata = { title: "Campaigns · Superfan" };

export default async function CampaignsPage() {
  const ctx = await requireArtistContext();
  const artistId = ctx.artist.id;

  const [rows, segmentRows, levels, challengeRows, rewardRows, eventRows] = await Promise.all([
    db.select().from(campaigns).where(eq(campaigns.artistId, artistId)).orderBy(desc(campaigns.createdAt)),
    db.select({ id: segments.id, name: segments.name, cachedCount: segments.cachedCount }).from(segments).where(eq(segments.artistId, artistId)).orderBy(segments.name),
    db.select({ id: fanLevels.id, name: fanLevels.name, minScore: fanLevels.minScore, color: fanLevels.color }).from(fanLevels).where(eq(fanLevels.artistId, artistId)).orderBy(fanLevels.sortOrder),
    db
      .select({ id: challenges.id, label: challenges.title, status: challenges.status })
      .from(challenges)
      .where(and(eq(challenges.artistId, artistId), ne(challenges.status, "archived")))
      .orderBy(desc(challenges.createdAt)),
    db
      .select({ id: rewards.id, label: rewards.name, status: rewards.status })
      .from(rewards)
      .where(and(eq(rewards.artistId, artistId), ne(rewards.status, "archived")))
      .orderBy(desc(rewards.createdAt)),
    db.select({ id: artistEvents.id, label: artistEvents.name, status: artistEvents.status }).from(artistEvents).where(eq(artistEvents.artistId, artistId)).orderBy(desc(artistEvents.startsAt)),
  ]);

  return (
    <CampaignsView
      campaigns={rows}
      segments={segmentRows}
      levels={levels}
      linked={{ challenges: challengeRows, rewards: rewardRows, events: eventRows }}
      canManage={can(ctx.role, "manageCampaigns")}
    />
  );
}
