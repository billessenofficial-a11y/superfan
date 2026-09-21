import { notFound } from "next/navigation";
import { Gift } from "lucide-react";
import { RewardCard } from "@/components/fan/reward-card";
import { PassportSection } from "@/components/fan/section";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireFanContext } from "@/lib/auth/context";
import { loadPassport } from "@/lib/fan/load-passport";
import { formatDateTime, formatNumber } from "@/lib/utils";

export const metadata = { title: "Rewards" };

const STATUS: Record<string, { label: string; variant: "success" | "warning" | "outline" }> = {
  fulfilled: { label: "Fulfilled", variant: "success" },
  pending: { label: "Pending", variant: "warning" },
  cancelled: { label: "Cancelled", variant: "outline" },
};

export default async function RewardsPage({ params }: { params: Promise<{ artistSlug: string }> }) {
  const { artistSlug } = await params;
  const { fan } = await requireFanContext(`/fan/${artistSlug}/rewards`);
  const passport = await loadPassport(fan.id, artistSlug);
  if (!passport || !passport.membership) notFound();
  const { membership, rewards, redemptions } = passport;
  const balance = membership.rewardPointsCached;
  const eligibleCount = rewards.filter((r) => r.eligibility.eligible).length;

  return (
    <div className="space-y-6">
      <div className="artist-gradient rounded-3xl p-5 text-white animate-rise">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/60">Reward points</p>
        <p className="tabular mt-1 text-4xl font-semibold tracking-tight">{formatNumber(balance)}</p>
        <p className="mt-1 text-sm text-white/70">
          {eligibleCount > 0 ? `${eligibleCount} ${eligibleCount === 1 ? "reward" : "rewards"} unlocked right now.` : "Earn points at shows, through challenges and by inviting friends."}
        </p>
      </div>

      <PassportSection title="Rewards">
        {rewards.length === 0 ? (
          <EmptyState icon={<Gift />} title="No rewards yet" description={`${passport.artist.name} hasn't published any rewards. Keep earning points so you're ready when they drop.`} compact />
        ) : (
          <ul className="space-y-3">
            {rewards.map(({ reward, eligibility }) => (
              <RewardCard
                key={reward.id}
                slug={artistSlug}
                balance={balance}
                eligible={eligibility.eligible}
                reason={eligibility.message}
                reward={{
                  id: reward.id,
                  name: reward.name,
                  description: reward.description,
                  imageUrl: reward.imageUrl,
                  pointCost: reward.pointCost,
                  inventory: reward.inventory,
                  redeemedCount: reward.redeemedCount,
                  fulfillmentType: reward.fulfillmentType,
                  endsAt: reward.endsAt,
                }}
              />
            ))}
          </ul>
        )}
      </PassportSection>

      <PassportSection title="Your redemptions">
        {redemptions.length === 0 ? (
          <div className="card-surface px-4 py-6 text-center text-sm text-muted-foreground">Nothing redeemed yet.</div>
        ) : (
          <ul className="card-surface divide-y divide-border">
            {redemptions.map(({ redemption, reward }) => {
              const s = STATUS[redemption.status] ?? STATUS.pending;
              return (
                <li key={redemption.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-artist/10 text-artist">
                    <Gift className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate text-sm font-medium">{reward.name}</p>
                    <p className="text-[11px] text-subtle">
                      {formatDateTime(redemption.redeemedAt)} · <span className="tabular">−{formatNumber(redemption.pointsSpent)} pts</span>
                      {redemption.fulfillmentNote ? ` · ${redemption.fulfillmentNote}` : ""}
                    </p>
                  </div>
                  <Badge variant={s.variant}>{s.label}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </PassportSection>
    </div>
  );
}
