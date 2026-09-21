import type { FanDetail } from "@/lib/fans/queries";
import { SourceIcon, SOURCE_LABELS } from "@/components/dashboard/source-icon";
import { VerificationBadge } from "@/components/dashboard/verification-badge";
import { formatDate, formatMoney, truncate } from "@/lib/utils";

type TimelineEvent = FanDetail["timeline"][number];

/** Privacy-safe one-liner for metadata: order amounts, comment text, never DM content. */
function metaLine(e: TimelineEvent): string | null {
  const m = e.metadata ?? {};
  if (e.type.startsWith("instagram.dm")) return null;
  if (typeof m.amountCents === "number") {
    const items = Array.isArray(m.items) ? (m.items as { title?: string; quantity?: number }[]) : [];
    const list = items
      .slice(0, 2)
      .map((i) => `${i.quantity && i.quantity > 1 ? `${i.quantity}× ` : ""}${i.title ?? ""}`)
      .filter(Boolean)
      .join(", ");
    return `${formatMoney(m.amountCents)}${list ? ` · ${truncate(list, 60)}` : ""}${items.length > 2 ? ` +${items.length - 2} more` : ""}`;
  }
  if (typeof m.refundedCents === "number") return `Refunded ${formatMoney(m.refundedCents)}`;
  if (e.type.startsWith("instagram.comment") && typeof m.text === "string" && m.text.trim()) return `“${truncate(m.text.trim(), 120)}”`;
  if (typeof m.points === "number" && typeof m.reason === "string") return `${m.points > 0 ? "+" : ""}${m.points} ${String(m.dimension ?? "")} · ${m.reason}`;
  if (typeof m.eventName === "string" && !e.summary?.includes(String(m.eventName))) return String(m.eventName);
  if (typeof m.sourceLabel === "string") return String(m.sourceLabel);
  if (typeof m.score === "number" && e.type === "fan.level_reached") return `Score ${m.score.toLocaleString()}`;
  return null;
}

function summaryFor(e: TimelineEvent): string {
  if (e.type.startsWith("instagram.dm")) return "Sent a direct message";
  return e.summary ?? e.type.replace(/[._]/g, " ");
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function dayLabel(d: Date) {
  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000));
  const k = dayKey(d);
  if (k === today) return "Today";
  if (k === yesterday) return "Yesterday";
  return formatDate(d, { weekday: "short", month: "short", day: "numeric", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

export function FanTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-subtle">No verified activity yet.</p>;
  }
  const groups: { key: string; label: string; items: TimelineEvent[] }[] = [];
  for (const e of events) {
    const key = dayKey(e.occurredAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(e);
    else groups.push({ key, label: dayLabel(e.occurredAt), items: [e] });
  }
  return (
    <div className="flex flex-col">
      {groups.map((g) => (
        <section key={g.key}>
          <h4 className="sticky top-0 z-10 bg-card/95 px-5 py-2 text-[11px] font-medium uppercase tracking-wider text-subtle backdrop-blur">{g.label}</h4>
          <ol className="relative ml-[2.15rem] border-l border-border">
            {g.items.map((e) => {
              const meta = metaLine(e);
              return (
                <li key={e.id} className="relative pl-6 pr-5 pb-4 last:pb-3">
                  <span className="absolute -left-[13px] top-0.5 flex size-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground" title={SOURCE_LABELS[e.source] ?? e.source}>
                    <SourceIcon source={e.source} size={12} />
                  </span>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-sm font-medium leading-5">{summaryFor(e)}</p>
                    <time dateTime={e.occurredAt.toISOString()} className="tabular text-xs text-subtle">
                      {formatDate(e.occurredAt, { hour: "numeric", minute: "2-digit" })}
                    </time>
                  </div>
                  {meta ? <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p> : null}
                  <div className="mt-1.5">
                    <VerificationBadge verification={e.verification} />
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
