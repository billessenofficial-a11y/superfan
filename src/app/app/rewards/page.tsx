import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { fanLevels, fans, rewardRedemptions, rewards } from "@/db/schema";
import { can, requireArtistContext } from "@/lib/auth/context";
import { RewardsView } from "@/components/programs/rewards-view";

export const metadata = { title: "Rewards · Superfan" };

export default async function RewardsPage() {
  const ctx = await requireArtistContext();
  const artistId = ctx.artist.id;

  const [rewardRows, levels, redemptions] = await Promise.all([
    db
      .select()
      .from(rewards)
      .where(and(eq(rewards.artistId, artistId), ne(rewards.status, "archived")))
      .orderBy(desc(rewards.createdAt)),
    db.select().from(fanLevels).where(eq(fanLevels.artistId, artistId)).orderBy(fanLevels.sortOrder),
    db
      .select({
        id: rewardRedemptions.id,
        rewardId: rewardRedemptions.rewardId,
        rewardName: rewards.name,
        pointsSpent: rewardRedemptions.pointsSpent,
        status: rewardRedemptions.status,
        redeemedAt: rewardRedemptions.redeemedAt,
        fulfilledAt: rewardRedemptions.fulfilledAt,
        fulfillmentNote: rewardRedemptions.fulfillmentNote,
        fanId: rewardRedemptions.fanId,
        fanFirstName: fans.firstName,
        fanLastName: fans.lastName,
        fanEmail: fans.email,
        fanAvatarUrl: fans.avatarUrl,
      })
      .from(rewardRedemptions)
      .innerJoin(rewards, eq(rewards.id, rewardRedemptions.rewardId))
      .innerJoin(fans, eq(fans.id, rewardRedemptions.fanId))
      .where(eq(rewardRedemptions.artistId, artistId))
      .orderBy(desc(rewardRedemptions.redeemedAt))
      .limit(200),
  ]);

  return <RewardsView rewards={rewardRows} levels={levels} redemptions={redemptions} canManage={can(ctx.role, "manageRewards")} />;
}
