import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, ChevronRight, Gift, ListChecks, Lock, PartyPopper, QrCode } from "lucide-react";
import { ActivityRow, summarize, type ActivityItem } from "@/components/fan/activity-row";
import { BadgeIcon } from "@/components/fan/badge-icon";
import { ReferralCard } from "@/components/fan/referral-card";
import { PassportSection } from "@/components/fan/section";
import { TierCard } from "@/components/fan/tier-card";
import { ProviderIcon } from "@/components/shared/provider-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SegmentedMeter } from "@/components/ui/progress";
import { db } from "@/db";
import { getArtistBySlug } from "@/lib/artists/create";
import { requireFanContext } from "@/lib/auth/context";
import { loadPassport } from "@/lib/fan/load-passport";
import { DIMENSION_LABELS, firstNameOf, nextShow } from "@/lib/fan/progress";
import { DIMENSIONS, REFERRAL_POINTS_DEFAULT } from "@/lib/scoring/defaults";
import { cn, formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/utils";

type Props = { params: Promise<{ artistSlug: string }>; searchParams: Promise<{ welcome?: string }> };

export async function generateMetadata({ params }: Props) {
  const { artistSlug } = await params;
  const artist = await getArtistBySlug(db, artistSlug);
  return { title: artist ? `${artist.name} passport` : "Passport" };
}

export default async function PassportPage({ params, searchParams }: Props) {
  const [{ artistSlug }, { welcome }] = await Promise.all([params, searchParams]);
  const { fan } = await requireFanContext(`/fan/${artistSlug}`);
  const passport = await loadPassport(fan.id, artistSlug);
  if (!passport || !passport.membership) notFound();
  const { artist, membership, challenges, rewards, events, badges, identities, referrals, timeline, pointTransactions, topPercent } = passport;
  const base = `/fan/${artistSlug}`;

  const show = nextShow(events);
  const topChallenge = challenges.find((c) => !c.completed) ?? null;
  const unlockedReward = rewards.find((r) => r.eligibility.eligible) ?? null;
  const earnedBadges = badges.filter((b) => b.earnedAt);
  const referralPoints = typeof artist.settings.referralPoints === "number" ? artist.settings.referralPoints : REFERRAL_POINTS_DEFAULT;

  const recent: ActivityItem[] = [
    ...timeline.map((e): ActivityItem => ({ kind: "event", id: e.id, at: e.occurredAt, source: e.source, summary: summarize(e.type, e.summary), verification: e.verification })),
    ...pointTransactions.map((t): ActivityItem => ({ kind: "points", id: t.id, at: t.createdAt, amount: t.amount, description: t.description })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 5);

  const identityFor = (provider: string) => identities.find((i) => i.provider === provider && i.claimed);
  const instagram = identityFor("instagram");
  const shopify = identityFor("shopify");
  const spotify = identityFor("spotify");
  const tiktok = identityFor("tiktok");

  return (
    <div className="space-y-6">
      {welcome === "1" ? (
        <div className="flex items-center gap-3 rounded-2xl bg-artist/10 px-4 py-3 text-sm animate-rise">
          <PartyPopper className="size-5 shrink-0 text-artist" />
          <p>
            <span className="font-semibold">Welcome to the club.</span> Your passport is live. Check in at shows, complete challenges and invite friends to climb the levels.
          </p>
        </div>
      ) : null}

      <div className="animate-rise">
        <h1 className="text-2xl font-semibold tracking-tight">Hey {firstNameOf(fan)} 👋</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          You&apos;re in the top {topPercent}% of identified {artist.name} fans.
        </p>
      </div>

      <TierCard passport={passport} className="animate-rise" />

      {show ? (
        <Link href={`${base}#events`} className="card-surface flex items-center gap-4 p-4 animate-rise">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-artist text-white">
            <QrCode className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-artist">{show.window.open ? "Happening now" : "Coming up"}</p>
            <p className="truncate text-sm font-semibold">
              {show.checkedIn ? "You're checked in" : "Check in at the show"} · <span className="tabular">+{formatNumber(show.event.checkinPoints)} points</span>
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {show.event.name} · {formatDateTime(show.event.startsAt)}
              {show.checkedIn ? "" : " · Scan the QR at the venue"}
            </p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-subtle" />
        </Link>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {topChallenge ? (
          <Link href={`${base}/challenges`} className="card-surface group flex flex-col p-4 animate-rise">
            <div className="flex items-center gap-2">
              <ListChecks className="size-4 text-artist" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-subtle">Challenge</span>
              <Badge variant="artist" className="ml-auto tabular">
                +{formatNumber(topChallenge.challenge.points)} pts
              </Badge>
            </div>
            <p className="mt-2 text-sm font-semibold">{topChallenge.challenge.title}</p>
            {topChallenge.challenge.description ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{topChallenge.challenge.description}</p> : null}
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-artist">
              Complete it <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ) : null}
        {unlockedReward ? (
          <Link href={`${base}/rewards`} className="card-surface group flex flex-col p-4 animate-rise">
            <div className="flex items-center gap-2">
              <Gift className="size-4 text-artist" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-subtle">Unlocked reward</span>
              <Badge variant="success" className="ml-auto tabular">
                {formatNumber(unlockedReward.reward.pointCost)} pts
              </Badge>
            </div>
            <p className="mt-2 text-sm font-semibold">{unlockedReward.reward.name}</p>
            {unlockedReward.reward.description ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{unlockedReward.reward.description}</p> : null}
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-artist">
              Redeem now <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ) : rewards.length > 0 ? (
          <Link href={`${base}/rewards`} className="card-surface group flex flex-col p-4 animate-rise">
            <div className="flex items-center gap-2">
              <Gift className="size-4 text-artist" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-subtle">Next reward</span>
              <Lock className="ml-auto size-3.5 text-subtle" />
            </div>
            <p className="mt-2 text-sm font-semibold">{rewards[0].reward.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{rewards[0].eligibility.message ?? "Keep going to unlock this."}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-artist">
              See all rewards <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ) : null}
      </div>

      <PassportSection title="Score breakdown">
        <div className="card-surface p-4">
          <ul className="space-y-3">
            {DIMENSIONS.map((d) => {
              const value = membership.dimensionScores[d] ?? 0;
              return (
                <li key={d}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{DIMENSION_LABELS[d]}</span>
                    <span className="tabular font-medium">{Math.round(value)}</span>
                  </div>
                  <SegmentedMeter value={value} segments={16} color="var(--artist-accent)" />
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[11px] text-subtle">Each dimension is scored 0–100 from verified activity. Superfan Score is the weighted total.</p>
        </div>
      </PassportSection>

      <PassportSection title="Your status">
        <dl className="card-surface grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
          {[
            { label: "Member since", value: formatDate(membership.joinedAt ?? membership.firstSeenAt, { month: "short", year: "numeric" }) },
            { label: "Shows attended", value: formatNumber(membership.eventsAttendedCount) },
            { label: "Lifetime spend", value: formatMoney(membership.lifetimeSpendCents) },
            { label: "Referrals", value: formatNumber(referrals.qualified) },
          ].map((s) => (
            <div key={s.label} className="px-4 py-3">
              <dt className="text-[10px] font-medium uppercase tracking-wider text-subtle">{s.label}</dt>
              <dd className="tabular mt-0.5 text-lg font-semibold tracking-tight">{s.value}</dd>
            </div>
          ))}
        </dl>
      </PassportSection>

      <div className="animate-rise">
        <ReferralCard link={referrals.link} artistName={artist.name} points={referralPoints} qualified={referrals.qualified} pending={referrals.pending} />
      </div>

      {events.some((e) => e.isUpcoming) ? (
        <PassportSection title="Shows" id="events">
          <ul className="card-surface divide-y divide-border">
            {events
              .filter((e) => e.isUpcoming)
              .slice(0, 4)
              .map(({ event, checkedIn, window }) => (
                <li key={event.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex w-11 shrink-0 flex-col items-center rounded-xl bg-muted py-1 leading-tight">
                    <span className="text-[10px] font-medium uppercase text-subtle">{formatDate(event.startsAt, { month: "short" })}</span>
                    <span className="tabular text-base font-semibold">{formatDate(event.startsAt, { day: "numeric" })}</span>
                  </div>
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate text-sm font-medium">{event.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{[event.venue, event.city].filter(Boolean).join(" · ") || "Venue TBA"}</p>
                  </div>
                  {checkedIn ? (
                    <Badge variant="success">Checked in</Badge>
                  ) : window.open ? (
                    <Badge variant="artist">
                      <QrCode /> Scan to check in
                    </Badge>
                  ) : (
                    <span className="tabular text-xs text-subtle">+{formatNumber(event.checkinPoints)}</span>
                  )}
                </li>
              ))}
          </ul>
        </PassportSection>
      ) : null}

      <PassportSection title="Recent activity" href={`${base}/activity`}>
        {recent.length === 0 ? (
          <div className="card-surface px-4 py-8 text-center text-sm text-muted-foreground">Nothing yet. Check in at a show or complete a challenge to get started.</div>
        ) : (
          <ul className="card-surface divide-y divide-border">
            {recent.map((item) => (
              <ActivityRow key={`${item.kind}-${item.id}`} item={item} />
            ))}
          </ul>
        )}
      </PassportSection>

      <PassportSection title={`Badges · ${earnedBadges.length} of ${badges.length}`} href={`${base}/badges`}>
        <div className="card-surface flex gap-3 overflow-x-auto px-4 py-4 scrollbar-none">
          {badges.slice(0, 8).map(({ badge, earnedAt }) => (
            <div key={badge.id} className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-center">
              <span className={cn("flex size-12 items-center justify-center rounded-2xl", earnedAt ? "bg-artist text-white shadow-md shadow-artist/30" : "bg-muted text-subtle")}>
                {earnedAt ? <BadgeIcon icon={badge.icon} className="size-5" /> : <Lock className="size-4" />}
              </span>
              <span className={cn("line-clamp-2 text-[10px] leading-3", earnedAt ? "font-medium" : "text-subtle")}>{badge.name}</span>
            </div>
          ))}
        </div>
      </PassportSection>

      <PassportSection title="Connections" href="/fan/settings" hrefLabel="Manage">
        <ul className="card-surface divide-y divide-border">
          {[
            { provider: "email", label: "Email", value: fan.email ?? "", connected: Boolean(fan.email) },
            { provider: "instagram", label: "Instagram", value: instagram?.username ? `@${instagram.username}` : "Not connected", connected: Boolean(instagram) },
            { provider: "shopify", label: "Shopify", value: shopify ? (shopify.username ?? "Connected") : "Not connected", connected: Boolean(shopify) },
            { provider: "spotify", label: "Spotify", value: spotify ? (spotify.username ?? "Connected") : "Experimental", connected: Boolean(spotify) },
            { provider: "tiktok", label: "TikTok", value: tiktok?.username ? `@${tiktok.username}` : "Not connected", connected: Boolean(tiktok) },
          ].map((c) => (
            <li key={c.provider} className="flex items-center gap-3 px-4 py-2.5">
              <span className={cn("flex size-7 items-center justify-center rounded-lg", c.connected ? "bg-artist/10 text-artist" : "bg-muted text-subtle")}>
                <ProviderIcon provider={c.provider} size={14} />
              </span>
              <span className="w-20 text-sm font-medium">{c.label}</span>
              <span className={cn("min-w-0 flex-1 truncate text-xs", c.connected ? "text-muted-foreground" : "text-subtle")}>{c.value}</span>
              {c.connected ? <span className="text-xs text-success">✓</span> : null}
            </li>
          ))}
        </ul>
      </PassportSection>

      <div className="flex items-center justify-center gap-2 pt-2 text-[11px] text-subtle">
        <CalendarDays className="size-3" /> Passport issued {formatDate(membership.joinedAt ?? membership.firstSeenAt, { month: "long", day: "numeric", year: "numeric" })}
      </div>
      <div className="text-center">
        <Button asChild variant="link" size="sm">
          <Link href={`/artists/${artistSlug}`}>View {artist.name}&apos;s public page</Link>
        </Button>
      </div>
    </div>
  );
}
