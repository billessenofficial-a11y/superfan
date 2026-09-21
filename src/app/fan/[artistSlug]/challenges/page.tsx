import { notFound } from "next/navigation";
import { ListChecks } from "lucide-react";
import { ChallengeCard, type ChallengeContext } from "@/components/fan/challenge-card";
import { ReferralCard } from "@/components/fan/referral-card";
import { PassportSection } from "@/components/fan/section";
import { EmptyState } from "@/components/ui/empty-state";
import { requireFanContext } from "@/lib/auth/context";
import { loadPassport } from "@/lib/fan/load-passport";
import { REFERRAL_POINTS_DEFAULT } from "@/lib/scoring/defaults";
import { formatNumber } from "@/lib/utils";

export const metadata = { title: "Challenges" };

export default async function ChallengesPage({ params }: { params: Promise<{ artistSlug: string }> }) {
  const { artistSlug } = await params;
  const { fan } = await requireFanContext(`/fan/${artistSlug}/challenges`);
  const passport = await loadPassport(fan.id, artistSlug);
  if (!passport || !passport.membership) notFound();
  const { artist, membership, challenges, events, referrals } = passport;

  const open = challenges.filter((c) => !c.completed);
  const done = challenges.filter((c) => c.completed);
  const available = open.reduce((sum, c) => sum + c.challenge.points, 0);
  const referralPoints = typeof artist.settings.referralPoints === "number" ? artist.settings.referralPoints : REFERRAL_POINTS_DEFAULT;

  const ctx: ChallengeContext = {
    slug: artistSlug,
    checkedInEventIds: events.filter((e) => e.checkedIn).map((e) => e.event.id),
    qualifiedReferrals: referrals.qualified,
    lifetimeSpendCents: membership.lifetimeSpendCents,
    referralLink: referrals.link,
  };

  const toCard = (c: (typeof challenges)[number]) => (
    <ChallengeCard
      key={c.challenge.id}
      ctx={ctx}
      completed={c.completed}
      completedAt={c.completion?.completedAt ?? null}
      challenge={{
        id: c.challenge.id,
        title: c.challenge.title,
        description: c.challenge.description,
        type: c.challenge.type,
        points: c.challenge.points,
        isMajor: c.challenge.isMajor,
        imageUrl: c.challenge.imageUrl,
        config: c.challenge.config,
        endsAt: c.challenge.endsAt,
      }}
    />
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Challenges</h1>
        <p className="text-sm text-muted-foreground">
          {open.length > 0 ? (
            <>
              {open.length} open · <span className="tabular font-medium text-artist">+{formatNumber(available)} points</span> up for grabs
            </>
          ) : (
            "You're all caught up."
          )}
        </p>
      </div>

      {challenges.length === 0 ? (
        <EmptyState icon={<ListChecks />} title="No challenges right now" description={`${artist.name} hasn't launched any challenges yet. Check back soon.`} compact />
      ) : null}

      {open.length > 0 ? (
        <PassportSection title="Open">
          <ul className="space-y-3">{open.map(toCard)}</ul>
        </PassportSection>
      ) : null}

      <div id="referral" className="animate-rise">
        <ReferralCard link={referrals.link} artistName={artist.name} points={referralPoints} qualified={referrals.qualified} pending={referrals.pending} />
      </div>

      {done.length > 0 ? (
        <PassportSection title={`Completed · ${done.length}`}>
          <ul className="space-y-3">{done.map(toCard)}</ul>
        </PassportSection>
      ) : null}
    </div>
  );
}
