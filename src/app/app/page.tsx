import Link from "next/link";
import { ArrowRight, Instagram, Upload, Users } from "lucide-react";
import { requireArtistContext } from "@/lib/auth/context";
import { getEngagementSources, getFanGrowthSeries, getLevelDistribution, getOverviewMetrics, getRecentSuperfans, getTopCities, listActivity } from "@/lib/dashboard/overview";
import { fanDisplayName } from "@/lib/fans/queries";
import { formatMoney, formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { LevelBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Stat } from "@/components/shared/stat";
import { PageHeader } from "@/components/dashboard/page-header";
import { ActivityRowCompact } from "@/components/dashboard/activity-feed";
import { FanGrowthChart } from "@/components/dashboard/charts/fan-growth-chart";
import { EngagementSourcesChart } from "@/components/dashboard/charts/engagement-sources-chart";
import { LevelDistributionChart } from "@/components/dashboard/charts/level-distribution-chart";

export const metadata = { title: "Overview · Superfan" };

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default async function OverviewPage() {
  const ctx = await requireArtistContext();
  const artistId = ctx.artist.id;
  const firstName = ctx.user.displayName?.trim().split(/\s+/)[0] || ctx.user.email.split("@")[0];

  const metrics = await getOverviewMetrics(artistId);

  if (metrics.identified.value === 0) {
    return (
      <div className="animate-fade-in">
        <PageHeader title={`${greeting()}, ${firstName} 👋`} description="Here's what your fanbase is doing." />
        <EmptyState
          icon={<Users />}
          title="No fans yet."
          description="Connect an integration or import your existing fan list to get started."
          actions={
            <>
              <Button asChild variant="accent">
                <Link href="/app/integrations">
                  <Instagram /> Connect Instagram
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/app/settings?tab=import">
                  <Upload /> Import CSV
                </Link>
              </Button>
            </>
          }
        />
      </div>
    );
  }

  const [growth, sources, levels, cities, superfans, activity] = await Promise.all([
    getFanGrowthSeries(artistId, 30),
    getEngagementSources(artistId),
    getLevelDistribution(artistId),
    getTopCities(artistId, 5),
    getRecentSuperfans(artistId, 6),
    listActivity(artistId, { page: 1, pageSize: 12 }),
  ]);

  return (
    <div className="animate-fade-in">
      <PageHeader title={`${greeting()}, ${firstName} 👋`} description="Here's what your fanbase is doing." />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Identified fans" value={formatNumber(metrics.identified.value)} growth={metrics.identified.growth} hint="vs. 30 days ago" />
        <Stat label="Superfans" value={formatNumber(metrics.superfans.value)} growth={metrics.superfans.growth} hint={`Score ${formatNumber(metrics.superfanThreshold)}+`} />
        <Stat label="30-day active" value={formatNumber(metrics.active30.value)} growth={metrics.active30.growth} hint="vs. previous 30 days" />
        <Stat label="Revenue linked" value={formatMoney(metrics.revenue.valueCents, { compact: true })} growth={metrics.revenue.growth} hint={`${formatMoney(metrics.revenue.last30Cents, { compact: true })} in the last 30 days`} />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>Fan growth</CardTitle>
              <CardDescription>Identified fans, last 30 days</CardDescription>
            </div>
            <span className="tabular text-xs text-subtle">+{formatNumber(growth.reduce((s, d) => s + d.newFans, 0))} new</span>
          </CardHeader>
          <CardContent className="pt-3">
            <FanGrowthChart data={growth} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Engagement sources</CardTitle>
            <CardDescription>Share of interactions, last 30 days</CardDescription>
          </CardHeader>
          <CardContent className="pt-3">
            {sources.length ? <EngagementSourcesChart data={sources} /> : <p className="py-8 text-center text-sm text-subtle">No engagement yet in the last 30 days.</p>}
          </CardContent>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Fan level distribution</CardTitle>
            <CardDescription>Where your fans sit today</CardDescription>
          </CardHeader>
          <CardContent className="pt-3">
            <LevelDistributionChart data={levels} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top cities</CardTitle>
            <CardDescription>Where your fanbase lives</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            {cities.length === 0 ? (
              <p className="py-8 text-center text-sm text-subtle">No location data yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] font-medium uppercase tracking-wider text-subtle">
                    <th className="pb-2 text-left font-medium">City</th>
                    <th className="pb-2 text-right font-medium">Fans</th>
                    <th className="pb-2 text-right font-medium" title="Score 1,500+">Engaged</th>
                    <th className="pb-2 text-right font-medium">Attended</th>
                    <th className="pb-2 text-right font-medium" title="Spent over $150">$150+</th>
                  </tr>
                </thead>
                <tbody>
                  {cities.map((c) => (
                    <tr key={`${c.city}-${c.country}`} className="border-t border-border">
                      <td className="py-2 pr-2">
                        <Link href={`/app/fans?city=${encodeURIComponent(c.city ?? "")}`} className="font-medium hover:underline">
                          {c.city}
                        </Link>
                        {c.country ? <span className="ml-1 text-xs text-subtle">{c.country}</span> : null}
                      </td>
                      <td className="tabular py-2 text-right font-medium">{formatNumber(c.fans)}</td>
                      <td className="tabular py-2 text-right text-muted-foreground">{formatNumber(c.engaged)}</td>
                      <td className="tabular py-2 text-right text-muted-foreground">{formatNumber(c.attended)}</td>
                      <td className="tabular py-2 text-right text-muted-foreground">{formatNumber(c.spenders)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>Recent superfans</CardTitle>
              <CardDescription>Top-tier fans active lately</CardDescription>
            </div>
            <Link href={`/app/fans?minScore=${metrics.superfanThreshold}`} className="text-xs text-accent hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="px-0 pt-2 pb-2">
            {superfans.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-subtle">No superfans yet — they will show up here as scores climb.</p>
            ) : (
              <ul>
                {superfans.map((f) => {
                  const name = fanDisplayName(f);
                  return (
                    <li key={f.fanId}>
                      <Link href={`/app/fans/${f.fanId}`} className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-muted/60">
                        <Avatar src={f.avatarUrl} name={name} size={34} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{name}</span>
                            <LevelBadge name={f.levelName} color={f.levelColor} />
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {f.city ? `${f.city} · ` : ""}
                            {f.latest ?? "No recent activity"}
                          </span>
                        </span>
                        <span className="tabular text-sm font-semibold">{formatNumber(f.score)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Activity stream</CardTitle>
              <CardDescription>Verified fan activity as it happens</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/app/activity">
                All activity <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0 pt-2 pb-2">
            {activity.rows.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-subtle">Nothing yet. Activity will appear here as integrations sync.</p>
            ) : (
              <ul className="divide-y divide-border">
                {activity.rows.map((row) => (
                  <ActivityRowCompact key={row.event.id} row={row} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
