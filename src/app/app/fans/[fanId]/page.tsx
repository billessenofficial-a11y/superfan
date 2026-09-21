import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, ne } from "drizzle-orm";
import { Award, ChevronLeft, MapPin, Sparkles } from "lucide-react";
import { db } from "@/db";
import { artistEvents, fanTags } from "@/db/schema";
import { track } from "@/lib/audit";
import { can, requireArtistContext } from "@/lib/auth/context";
import { fanDisplayName, getFanDetail, type FanDetail } from "@/lib/fans/queries";
import { formatDate, formatDateTime, formatMoney, formatNumber, formatRelative, isUuid } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge, LevelBadge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress, SegmentedMeter } from "@/components/ui/progress";
import { Stat } from "@/components/shared/stat";
import { ProviderIcon } from "@/components/shared/provider-icon";
import { FanActions } from "@/components/fans/fan-actions";
import { FanTimeline } from "@/components/fans/fan-timeline";

export const metadata = { title: "Fan · Superfan" };

const DIMENSIONS: { key: keyof FanDetail["membership"]["dimensionScores"]; label: string; hint: string }[] = [
  { key: "commerce", label: "Commerce", hint: "Merch & orders" },
  { key: "attendance", label: "Attendance", hint: "Verified shows" },
  { key: "engagement", label: "Engagement", hint: "Comments, mentions, listening" },
  { key: "advocacy", label: "Advocacy", hint: "Referrals" },
  { key: "community", label: "Community", hint: "Challenges & membership" },
  { key: "recency", label: "Recency", hint: "How recently active" },
];

export default async function FanDetailPage({ params }: { params: Promise<{ fanId: string }> }) {
  const { fanId } = await params;
  const ctx = await requireArtistContext();
  if (!isUuid(fanId)) notFound();

  const detail = await getFanDetail(ctx.artist.id, fanId);
  if (!detail) notFound();

  // Product analytics; never blocks rendering.
  void track(db, "fan_profile_viewed", { artistId: ctx.artist.id, userId: ctx.user.id, fanId });

  const [allTags, events] = await Promise.all([
    db.select({ id: fanTags.id, name: fanTags.name, color: fanTags.color }).from(fanTags).where(eq(fanTags.artistId, ctx.artist.id)).orderBy(fanTags.name),
    db
      .select({ id: artistEvents.id, name: artistEvents.name, city: artistEvents.city, startsAt: artistEvents.startsAt })
      .from(artistEvents)
      .where(and(eq(artistEvents.artistId, ctx.artist.id), ne(artistEvents.status, "cancelled"), ne(artistEvents.status, "draft")))
      .orderBy(desc(artistEvents.startsAt))
      .limit(50),
  ]);

  const { fan, membership, level, nextLevel } = detail;
  const name = fanDisplayName(fan);
  const canEdit = can(ctx.role, "editFans");
  const canAdjust = can(ctx.role, "adjustPoints");
  const attendedIds = new Set(detail.checkins.map((c) => c.event.id));
  const ledgerByDim = new Map(detail.ledger.map((l) => [l.dimension, l.points]));

  const instagram = detail.identities.find((i) => i.provider === "instagram") ?? null;
  const shopify = detail.identities.find((i) => i.provider === "shopify") ?? null;
  const spotify = detail.identities.find((i) => i.provider === "spotify") ?? null;
  const tiktok = detail.identities.find((i) => i.provider === "tiktok") ?? null;

  const levelFloor = level?.minScore ?? 0;
  const toNext = nextLevel ? Math.max(0, nextLevel.minScore - membership.superfanScore) : 0;
  const levelProgress = nextLevel ? ((membership.superfanScore - levelFloor) / Math.max(1, nextLevel.minScore - levelFloor)) * 100 : 100;

  return (
    <div className="animate-fade-in">
      <Link href="/app/fans" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-3.5" /> All fans
      </Link>

      {/* Header */}
      <header className="card-surface relative overflow-hidden p-6">
        <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: `radial-gradient(60% 80% at 0% 0%, color-mix(in oklab, ${level?.color ?? "var(--accent)"} 18%, transparent), transparent 70%)` }} />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4 sm:gap-5">
            <Avatar src={fan.avatarUrl} name={name} size={72} className="ring-2 ring-border" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
                <LevelBadge name={level?.name} color={level?.color} />
                <Badge variant="accent">
                  <Sparkles /> Top {detail.topPercent}%
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Score <span className="tabular font-semibold text-foreground">{formatNumber(membership.superfanScore)}</span>
                {fan.city ? (
                  <>
                    <span className="mx-1.5 text-subtle">·</span>
                    <MapPin className="mr-0.5 inline size-3.5 align-[-2px]" />
                    {fan.city}
                    {fan.country ? `, ${fan.country}` : ""}
                  </>
                ) : null}
                <span className="mx-1.5 text-subtle">·</span>
                Member since {formatDate(membership.firstSeenAt, { month: "long", year: "numeric" })}
                <span className="mx-1.5 text-subtle">·</span>
                Active {formatRelative(membership.lastActiveAt)}
              </p>
              {detail.tags.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {detail.tags.map((t) => (
                    <span key={t.id} className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: `color-mix(in oklab, ${t.color} 18%, transparent)`, color: t.color }}>
                      <span className="size-1.5 rounded-full" style={{ background: t.color }} />
                      {t.name}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <FanActions
            fanId={fan.id}
            fanName={name}
            instagramUsername={instagram?.username ?? null}
            allTags={allTags}
            assignedTagIds={detail.tags.map((t) => t.id)}
            events={events.map((e) => ({ ...e, attended: attendedIds.has(e.id) }))}
            canEdit={canEdit}
            canAdjust={canAdjust}
          />
        </div>
      </header>

      {/* Stat cards */}
      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Lifetime spend" value={formatMoney(membership.lifetimeSpendCents)} hint={`${formatNumber(membership.ordersCount)} orders`} />
        <Stat label="Events attended" value={formatNumber(membership.eventsAttendedCount)} hint={detail.checkins[0] ? `Last: ${detail.checkins[0].event.name}` : "No shows yet"} />
        <Stat label="Referrals" value={formatNumber(detail.referrals.qualified)} hint={detail.referrals.pending > 0 ? `${formatNumber(detail.referrals.pending)} pending` : "Qualified referrals"} />
        <Stat label="Reward points" value={formatNumber(membership.rewardPointsCached)} hint="Spendable balance" />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Left column */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Score breakdown</CardTitle>
              <CardDescription>Sub-scores per dimension (0–100) with raw points earned.</CardDescription>
            </CardHeader>
            <CardContent className="pt-3">
              <ul className="grid gap-4 sm:grid-cols-2">
                {DIMENSIONS.map((d) => {
                  const score = membership.dimensionScores?.[d.key] ?? 0;
                  const raw = ledgerByDim.get(d.key) ?? membership.dimensionRaw?.[d.key as keyof typeof membership.dimensionRaw] ?? 0;
                  return (
                    <li key={d.key}>
                      <div className="mb-1.5 flex items-baseline justify-between">
                        <span className="text-sm font-medium">
                          {d.label} <span className="ml-1 text-xs font-normal text-subtle">{d.hint}</span>
                        </span>
                        <span className="tabular text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">{Math.round(score)}</span>/100 · {formatNumber(raw)} pts
                        </span>
                      </div>
                      <SegmentedMeter value={score} color={level?.color ?? undefined} />
                    </li>
                  );
                })}
              </ul>
              <div className="mt-6 rounded-xl border border-border bg-muted/40 p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium">{nextLevel ? `${formatNumber(toNext)} points to ${nextLevel.name}` : "Top level reached"}</span>
                  <span className="tabular text-xs text-muted-foreground">
                    {formatNumber(membership.superfanScore)}
                    {nextLevel ? ` / ${formatNumber(nextLevel.minScore)}` : ""}
                  </span>
                </div>
                <Progress value={levelProgress} color={nextLevel?.color ?? level?.color ?? undefined} />
                <div className="mt-2 flex justify-between text-[11px] text-subtle">
                  <span>{level?.name ?? "Unranked"}</span>
                  <span>{nextLevel?.name ?? ""}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>Verified activity across every connected source.</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pt-2 pb-2">
              <FanTimeline events={detail.timeline} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reward point history</CardTitle>
              <CardDescription>Every credit and debit on the spendable balance.</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pt-2 pb-2">
              {detail.pointTransactions.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-subtle">No point transactions yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {detail.pointTransactions.map((tx) => (
                    <li key={tx.id} className="flex items-center gap-3 px-5 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{tx.description}</span>
                        <span className="block text-xs text-subtle">
                          {tx.transactionType.replace(/_/g, " ").toLowerCase()} · {formatDateTime(tx.createdAt)}
                        </span>
                      </span>
                      <span className={`tabular text-sm font-semibold ${tx.amount >= 0 ? "text-success" : "text-danger"}`}>
                        {tx.amount >= 0 ? "+" : ""}
                        {formatNumber(tx.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Identity</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <ul className="flex flex-col gap-3">
                <IdentityRow provider="email" label="Email" value={fan.email ?? "Not provided"} status={fan.email ? (fan.emailVerifiedAt ? "verified" : "unverified") : "none"} />
                <IdentityRow provider="instagram" label="Instagram" value={instagram?.username ? `@${instagram.username}` : "Not connected"} status={instagram ? (instagram.claimed ? "claimed" : "unclaimed") : "none"} href={instagram?.username ? `https://instagram.com/${instagram.username}` : undefined} />
                <IdentityRow provider="shopify" label="Shopify" value={shopify ? "Connected" : "Not connected"} status={shopify ? "connected" : "none"} />
                <IdentityRow provider="spotify" label="Spotify" value={spotify ? "Connected" : "Not connected"} status={spotify ? "experimental" : "none"} />
                <IdentityRow provider="tiktok" label="TikTok" value={tiktok ? "Connected" : "Not connected"} status={tiktok ? "experimental" : "none"} />
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Badges</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              {detail.badges.length === 0 ? (
                <p className="text-sm text-subtle">No badges earned yet.</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {detail.badges.map((b) => (
                    <li key={b.badge.id} className="flex items-center gap-3">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
                        <Award className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{b.badge.name}</span>
                        <span className="block text-xs text-subtle">
                          {b.badge.rarity} · {formatDate(b.earnedAt, { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
              <CardDescription>Internal, never shown to fans.</CardDescription>
            </CardHeader>
            <CardContent className="pt-3">
              {detail.notes.length === 0 ? (
                <p className="text-sm text-subtle">No notes yet.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {detail.notes.map((n) => (
                    <li key={n.id} className="rounded-xl bg-muted/60 px-3.5 py-3">
                      <p className="whitespace-pre-wrap text-sm leading-5">{n.body}</p>
                      <p className="mt-1.5 text-[11px] text-subtle">
                        {n.author ?? n.authorEmail ?? "Team"} · {formatDateTime(n.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Redemptions</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              {detail.redemptions.length === 0 ? (
                <p className="text-sm text-subtle">No rewards redeemed yet.</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {detail.redemptions.map((r) => (
                    <li key={r.redemption.id} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{r.reward.name}</span>
                        <span className="block text-xs text-subtle">
                          {formatNumber(r.redemption.pointsSpent)} pts · {formatDate(r.redemption.redeemedAt, { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </span>
                      <Badge variant={r.redemption.status === "fulfilled" ? "success" : r.redemption.status === "cancelled" ? "outline" : "warning"}>{r.redemption.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Challenges</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              {detail.completions.length === 0 ? (
                <p className="text-sm text-subtle">No challenges completed yet.</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {detail.completions.map((c) => (
                    <li key={c.completion.id} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{c.challenge.title}</span>
                        <span className="block text-xs text-subtle">
                          {c.challenge.type.replace(/_/g, " ")} · {formatDate(c.completion.completedAt, { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </span>
                      <span className="tabular text-xs font-medium text-success">+{formatNumber(c.completion.pointsAwarded)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

type IdentityStatus = "verified" | "unverified" | "claimed" | "unclaimed" | "connected" | "experimental" | "none";

function IdentityRow({ provider, label, value, status, href }: { provider: string; label: string; value: string; status: IdentityStatus; href?: string }) {
  const badge =
    status === "verified" ? (
      <Badge variant="success">✓ Verified</Badge>
    ) : status === "claimed" ? (
      <Badge variant="success">Claimed</Badge>
    ) : status === "unclaimed" ? (
      <Badge variant="warning">Unclaimed</Badge>
    ) : status === "connected" ? (
      <Badge variant="success">Connected</Badge>
    ) : status === "experimental" ? (
      <Badge variant="info">Experimental</Badge>
    ) : status === "unverified" ? (
      <Badge variant="outline">Unverified</Badge>
    ) : null;
  return (
    <li className="flex items-center gap-3">
      <span className={`flex size-8 items-center justify-center rounded-lg bg-muted ${status === "none" ? "text-subtle" : "text-foreground"}`}>
        <ProviderIcon provider={provider} size={15} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] uppercase tracking-wide text-subtle">{label}</span>
        {href ? (
          <a href={href} target="_blank" rel="noreferrer noopener" className={`block truncate text-sm hover:underline ${status === "none" ? "text-muted-foreground" : ""}`}>
            {value}
          </a>
        ) : (
          <span className={`block truncate text-sm ${status === "none" ? "text-muted-foreground" : ""}`}>{value}</span>
        )}
      </span>
      {badge}
    </li>
  );
}
