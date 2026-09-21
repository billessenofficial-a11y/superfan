import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, FlaskConical, Headphones, Plug } from "lucide-react";
import { requireArtistContext } from "@/lib/auth/context";
import { fanDisplayName } from "@/lib/fans/display";
import { getStreamingOverview } from "@/lib/streaming/queries";
import { cn, formatDate, formatNumber, formatPercent } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { LevelBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Stat } from "@/components/shared/stat";
import { ProviderIcon } from "@/components/shared/provider-icon";
import { PageHeader } from "@/components/dashboard/page-header";
import { StreamsChart } from "@/components/dashboard/charts/streams-chart";

export const metadata = { title: "Streaming · Superfan" };

function Trend({ value }: { value: number | null }) {
  if (value == null) return <span className="text-subtle">new</span>;
  const positive = value >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 tabular", positive ? "text-success" : "text-danger")}>
      {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {formatPercent(value)}
    </span>
  );
}

export default async function StreamingPage() {
  const ctx = await requireArtistContext();
  const data = await getStreamingOverview(ctx.artist.id);

  if (!data) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Streaming" description="Streams, listeners and followers from Spotify, next to the fans behind them." />
        <EmptyState
          icon={<Headphones />}
          title="Spotify is not connected."
          description="Connect Spotify to see streams, monthly listeners, followers and top tracks here. Until partner access is approved the integration runs on sample data."
          actions={
            <Button asChild variant="accent">
              <Link href="/app/integrations">
                <Plug /> Connect Spotify
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const linkedShare = data.fans.identified > 0 ? (data.fans.linked / data.fans.identified) * 100 : 0;
  const maxTrack = data.topTracks[0]?.streams || 1;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Streaming"
        description={`Spotify · last ${data.window} days · updated ${formatDate(data.lastUpdated, { month: "short", day: "numeric" })}`}
        actions={
          data.isSample ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning">
              <FlaskConical className="size-3.5" /> Sample data
            </span>
          ) : undefined
        }
      />

      {data.isSample ? (
        <p className="mb-4 -mt-2 text-xs text-muted-foreground">
          Modeled on what Spotify for Artists reports. Live sync switches on once Spotify partner access is approved; the layout, scoring and fan linking below already work the same way.
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Streams" value={formatNumber(data.streams.value, { compact: true })} growth={data.streams.growth} hint={`vs. previous ${data.window} days`} />
        <Stat label="Monthly listeners" value={formatNumber(data.monthlyListeners.value, { compact: true })} growth={data.monthlyListeners.growth} hint="Rolling 28-day unique listeners" />
        <Stat label="Followers" value={formatNumber(data.followers.value, { compact: true })} growth={data.followers.growth} hint={`${data.followers.delta >= 0 ? "+" : ""}${formatNumber(data.followers.delta)} in ${data.window} days`} />
        <Stat label="Saves" value={formatNumber(data.saves.value, { compact: true })} growth={data.saves.growth} hint="Tracks saved to libraries" />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>Daily streams</CardTitle>
              <CardDescription>Last 90 days</CardDescription>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-spotify" /> Streams
            </span>
          </CardHeader>
          <CardContent className="pt-3">
            <StreamsChart data={data.series} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top tracks</CardTitle>
            <CardDescription>Streams, last {data.window} days</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <ol className="flex flex-col gap-2.5">
              {data.topTracks.map((t, i) => (
                <li key={t.title} className="flex items-center gap-3 text-sm">
                  <span className="tabular w-4 text-xs text-subtle">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-3">
                      <span className="truncate font-medium">{t.title}</span>
                      <span className="tabular shrink-0 text-xs text-muted-foreground">{formatNumber(t.streams, { compact: true })}</span>
                    </span>
                    <span className="mt-1 block h-1.5 rounded-full bg-muted">
                      <span className="block h-1.5 rounded-full bg-spotify" style={{ width: `${Math.max(3, (t.streams / maxTrack) * 100)}%` }} />
                    </span>
                  </span>
                  <span className="w-14 text-right text-[11px]">
                    <Trend value={t.growth} />
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Linked listeners</CardTitle>
            <CardDescription>Fans who verified Spotify from their passport</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="flex items-end gap-3">
              <span className="tabular text-4xl font-semibold leading-none tracking-tight">{formatNumber(data.fans.linked)}</span>
              <span className="pb-0.5 text-sm text-muted-foreground">of {formatNumber(data.fans.identified)} identified fans</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-2 rounded-full bg-spotify" style={{ width: `${Math.min(100, linkedShare)}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{formatPercent(linkedShare, 0)} linked</p>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-muted/60 px-3 py-2.5">
                <dt className="text-[11px] font-medium uppercase tracking-wider text-subtle">Active listeners</dt>
                <dd className="tabular mt-1 text-lg font-semibold leading-none">{formatNumber(data.fans.active)}</dd>
                <dd className="mt-1 text-[11px] text-muted-foreground">streamed in the last {data.window} days</dd>
              </div>
              <div className="rounded-xl bg-muted/60 px-3 py-2.5">
                <dt className="text-[11px] font-medium uppercase tracking-wider text-subtle">Verified plays</dt>
                <dd className="tabular mt-1 text-lg font-semibold leading-none">{formatNumber(data.fans.plays)}</dd>
                <dd className="mt-1 text-[11px] text-muted-foreground">counted toward scores, capped weekly</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">
              Listening feeds the engagement dimension at 5 points per weekly roll-up, capped at 25 per week, so streams never outrank a ticket or a purchase.{" "}
              <Link href="/app/settings?tab=scoring" className="font-medium text-accent hover:underline">
                Scoring rules
              </Link>
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>Heaviest listeners</CardTitle>
              <CardDescription>Linked fans with the most verified plays, last {data.window} days</CardDescription>
            </div>
            <Link href="/app/activity?filter=streaming" className="text-xs text-accent hover:underline">
              Listening activity
            </Link>
          </CardHeader>
          <CardContent className="px-0 pt-2 pb-2">
            {data.fans.top.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-subtle">No linked fans have streamed in this window yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.fans.top.map((f) => {
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
                            {f.topTrack ? `Mostly ${f.topTrack}` : "Streaming"} · score {formatNumber(f.score)}
                          </span>
                        </span>
                        <span className="flex items-center gap-1.5 text-sm font-semibold tabular">
                          <ProviderIcon provider="spotify" size={13} className="text-spotify" />
                          {formatNumber(f.plays)}
                          <span className="text-xs font-normal text-subtle">plays</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
