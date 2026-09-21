import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { ActivityRow, summarize, type ActivityItem } from "@/components/fan/activity-row";
import { EmptyState } from "@/components/ui/empty-state";
import { requireFanContext } from "@/lib/auth/context";
import { loadPassport } from "@/lib/fan/load-passport";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Activity" };

function dayKey(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function dayLabel(ts: number) {
  const today = dayKey(new Date());
  const diff = Math.round((today - ts) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  const d = new Date(ts);
  return formatDate(d, { weekday: "short", month: "short", day: "numeric", ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) });
}

export default async function ActivityPage({ params }: { params: Promise<{ artistSlug: string }> }) {
  const { artistSlug } = await params;
  const { fan } = await requireFanContext(`/fan/${artistSlug}/activity`);
  const passport = await loadPassport(fan.id, artistSlug);
  if (!passport || !passport.membership) notFound();

  const items: ActivityItem[] = [
    ...passport.timeline.map((e): ActivityItem => ({ kind: "event", id: e.id, at: e.occurredAt, source: e.source, summary: summarize(e.type, e.summary), verification: e.verification })),
    ...passport.pointTransactions.map((t): ActivityItem => ({ kind: "points", id: t.id, at: t.createdAt, amount: t.amount, description: t.description })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const groups = new Map<number, ActivityItem[]>();
  for (const item of items) {
    const key = dayKey(item.at);
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="text-sm text-muted-foreground">Everything that counts toward your status with {passport.artist.name}.</p>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<Sparkles />} title="No activity yet" description="Check in at a show, complete a challenge or invite a friend and it will show up here." compact />
      ) : (
        <div className="space-y-6">
          {[...groups.entries()].map(([ts, list], i) => (
            <section key={ts} className="animate-rise" style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}>
              <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-subtle">{dayLabel(ts)}</h2>
              <ul className="card-surface divide-y divide-border">
                {list.map((item) => (
                  <ActivityRow key={`${item.kind}-${item.id}`} item={item} relative={false} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
