import Link from "next/link";
import { Activity, ChevronLeft, ChevronRight } from "lucide-react";
import { requireArtistContext } from "@/lib/auth/context";
import { listActivity, type ActivityFilters } from "@/lib/dashboard/overview";
import { cn, formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { ActivityRowFull } from "@/components/dashboard/activity-feed";
import { ActivityRefresh } from "@/components/dashboard/activity-refresh";

export const metadata = { title: "Activity · Superfan" };

type Chip = { key: string; label: string; filter: Pick<ActivityFilters, "type" | "source"> };

const CHIPS: Chip[] = [
  { key: "all", label: "All", filter: {} },
  { key: "instagram", label: "Instagram", filter: { source: "instagram" } },
  { key: "commerce", label: "Commerce", filter: { type: "shopify." } },
  { key: "streaming", label: "Streaming", filter: { source: "spotify" } },
  { key: "events", label: "Events", filter: { type: "event." } },
  { key: "referrals", label: "Referrals", filter: { type: "fan.referral." } },
  { key: "challenges", label: "Challenges", filter: { type: "challenge." } },
  { key: "rewards", label: "Rewards", filter: { type: "reward." } },
  { key: "signups", label: "Signups", filter: { type: "fan.joined" } },
];

const PAGE_SIZE = 30;

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ filter?: string; page?: string }> }) {
  const ctx = await requireArtistContext();
  const sp = await searchParams;
  const chip = CHIPS.find((c) => c.key === sp.filter) ?? CHIPS[0];
  const page = Math.max(1, Number(sp.page) || 1);

  const result = await listActivity(ctx.artist.id, { ...chip.filter, page, pageSize: PAGE_SIZE });
  const href = (p: number, key = chip.key) => {
    const q = new URLSearchParams();
    if (key !== "all") q.set("filter", key);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `/app/activity?${s}` : "/app/activity";
  };

  return (
    <div className="animate-fade-in">
      <ActivityRefresh />
      <PageHeader
        title="Activity"
        description={
          <>
            <span className="tabular">{formatNumber(result.total)}</span> {chip.key === "all" ? "events" : `${chip.label.toLowerCase()} events`} · refreshes every 20s
          </>
        }
      />

      <nav className="scrollbar-none -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Filter activity">
        {CHIPS.map((c) => (
          <Link
            key={c.key}
            href={href(1, c.key)}
            className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors", c.key === chip.key ? "border-transparent bg-foreground text-background" : "border-border-strong text-muted-foreground hover:bg-muted hover:text-foreground")}
            aria-current={c.key === chip.key ? "page" : undefined}
          >
            {c.label}
          </Link>
        ))}
      </nav>

      {result.rows.length === 0 ? (
        <EmptyState
          icon={<Activity />}
          title={chip.key === "all" ? "No activity yet." : `No ${chip.label.toLowerCase()} activity yet.`}
          description={chip.key === "all" ? "Verified fan actions from your integrations will stream in here in real time." : "Try another filter, or connect the relevant integration."}
          actions={
            chip.key === "all" ? (
              <Button asChild variant="accent">
                <Link href="/app/integrations">Connect an integration</Link>
              </Button>
            ) : (
              <Button asChild variant="secondary">
                <Link href="/app/activity">Show all activity</Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <ul className="card-surface divide-y divide-border overflow-hidden">
            {result.rows.map((row) => (
              <ActivityRowFull key={row.event.id} row={row} />
            ))}
          </ul>
          <div className="mt-3 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="tabular text-xs text-muted-foreground">
              Page {result.page} of {result.pages}
            </p>
            <div className="flex items-center gap-1.5">
              <Button asChild variant="outline" size="sm">
                {page <= 1 ? (
                  <span aria-disabled className="pointer-events-none opacity-50">
                    <ChevronLeft /> Newer
                  </span>
                ) : (
                  <Link href={href(page - 1)}>
                    <ChevronLeft /> Newer
                  </Link>
                )}
              </Button>
              <Button asChild variant="outline" size="sm">
                {page >= result.pages ? (
                  <span aria-disabled className="pointer-events-none opacity-50">
                    Older <ChevronRight />
                  </span>
                ) : (
                  <Link href={href(page + 1)}>
                    Older <ChevronRight />
                  </Link>
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
