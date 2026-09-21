import Link from "next/link";
import { ArrowRight, ArrowUpRight, ArrowDownRight, FlaskConical } from "lucide-react";
import type { StreamingOverview } from "@/lib/streaming/queries";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProviderIcon } from "@/components/shared/provider-icon";
import { StreamsChart } from "@/components/dashboard/charts/streams-chart";

function Growth({ value }: { value: number | null }) {
  if (value == null) return null;
  const positive = value >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular", positive ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
      {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {formatPercent(value)}
    </span>
  );
}

/** Overview card: last 28 days of Spotify streams with the headline numbers and top tracks. */
export function StreamingSummaryCard({ data, className }: { data: StreamingOverview; className?: string }) {
  const last28 = data.series.slice(-28);
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded-md bg-spotify/15 text-spotify">
              <ProviderIcon provider="spotify" size={12} />
            </span>
            Spotify streams
          </CardTitle>
          <CardDescription>
            Last {data.window} days
            {data.isSample ? (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-warning-soft px-1.5 py-0.5 text-[10px] font-medium text-warning">
                <FlaskConical className="size-2.5" /> Sample data
              </span>
            ) : null}
          </CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/app/streaming">
            Streaming <ArrowRight />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="grid gap-5 pt-3 sm:grid-cols-[1fr_11rem]">
        <div>
          <div className="flex items-end gap-3">
            <span className="tabular text-[28px] font-semibold leading-none tracking-tight">{formatNumber(data.streams.value, { compact: true })}</span>
            <Growth value={data.streams.growth} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatNumber(data.monthlyListeners.value, { compact: true })} monthly listeners · {formatNumber(data.followers.value, { compact: true })} followers
          </p>
          <div className="mt-3 -mx-1">
            <StreamsChart data={last28} compact />
          </div>
        </div>
        <ol className="flex flex-col gap-2 self-start">
          {data.topTracks.slice(0, 4).map((t, i) => (
            <li key={t.title} className="flex items-center gap-2 text-xs">
              <span className="tabular w-3 text-subtle">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{t.title}</span>
                <span className="mt-0.5 block h-1 rounded-full bg-muted">
                  <span className="block h-1 rounded-full bg-spotify" style={{ width: `${Math.max(4, (t.streams / (data.topTracks[0]?.streams || 1)) * 100)}%` }} />
                </span>
              </span>
              <span className="tabular text-muted-foreground">{formatNumber(t.streams, { compact: true })}</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
