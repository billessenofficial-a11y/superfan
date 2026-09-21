import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { SourceBadge, SourceIcon } from "@/components/dashboard/source-icon";
import { VerificationBadge } from "@/components/dashboard/verification-badge";
import type { listActivity } from "@/lib/dashboard/overview";
import { fanDisplayName } from "@/lib/fans/queries";
import { cn, formatMoney, formatRelative, truncate } from "@/lib/utils";

export type ActivityRowData = Awaited<ReturnType<typeof listActivity>>["rows"][number];

/**
 * A one-line, privacy-safe description of event metadata. DM contents are
 * never rendered; only the fact that a message was sent.
 */
export function activityMetaLine(event: ActivityRowData["event"]): string | null {
  const m = event.metadata ?? {};
  if (event.type.startsWith("instagram.dm")) return null;
  if (typeof m.amountCents === "number") {
    const items = Array.isArray(m.items) ? (m.items as { title?: string }[]) : [];
    const first = items[0]?.title;
    return `${formatMoney(m.amountCents)}${first ? ` · ${truncate(String(first), 40)}` : ""}${items.length > 1 ? ` +${items.length - 1}` : ""}`;
  }
  if (typeof m.refundedCents === "number") return `Refunded ${formatMoney(m.refundedCents)}`;
  if (event.type.startsWith("instagram.comment") && typeof m.text === "string" && m.text.trim()) return `“${truncate(m.text.trim(), 90)}”`;
  if (event.type === "spotify.stream" && typeof m.plays === "number") return `${m.plays} plays${typeof m.topTrack === "string" ? ` · ${m.topTrack}` : ""}`;
  if (typeof m.eventName === "string") return String(m.eventName);
  if (typeof m.points === "number" && typeof m.reason === "string") return m.reason;
  if (typeof m.sourceLabel === "string") return m.sourceLabel;
  return null;
}

export function activitySummary(event: ActivityRowData["event"]): string {
  if (event.type.startsWith("instagram.dm")) return "Sent a direct message";
  return event.summary ?? event.type.replace(/[._]/g, " ");
}

/** Compact row for the Overview stream. */
export function ActivityRowCompact({ row }: { row: ActivityRowData }) {
  const name = row.fan ? fanDisplayName(row.fan) : "Unknown fan";
  const summary = activitySummary(row.event);
  return (
    <li className="flex items-center gap-3 px-5 py-2.5">
      {row.fan ? (
        <Link href={`/app/fans/${row.fan.id}`} className="shrink-0">
          <Avatar src={row.fan.avatarUrl} name={name} size={28} />
        </Link>
      ) : (
        <Avatar name="?" size={28} />
      )}
      <p className="min-w-0 flex-1 truncate text-sm">
        {row.fan ? (
          <Link href={`/app/fans/${row.fan.id}`} className="font-medium hover:underline">
            {name}
          </Link>
        ) : (
          <span className="font-medium text-muted-foreground">{name}</span>
        )}{" "}
        <span className="text-muted-foreground">{lowerFirst(summary)}</span>
      </p>
      <span className="text-subtle">
        <SourceIcon source={row.event.source} size={13} />
      </span>
      <span className="tabular shrink-0 text-xs text-subtle">{formatRelative(row.event.occurredAt)}</span>
    </li>
  );
}

/** Full row for the Activity page. */
export function ActivityRowFull({ row, className }: { row: ActivityRowData; className?: string }) {
  const name = row.fan ? fanDisplayName(row.fan) : "Unknown fan";
  const summary = activitySummary(row.event);
  const meta = activityMetaLine(row.event);
  return (
    <li className={cn("flex items-start gap-3 px-5 py-3.5", className)}>
      {row.fan ? (
        <Link href={`/app/fans/${row.fan.id}`} className="mt-0.5 shrink-0">
          <Avatar src={row.fan.avatarUrl} name={name} size={34} />
        </Link>
      ) : (
        <Avatar name="?" size={34} className="mt-0.5" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-5">
          {row.fan ? (
            <Link href={`/app/fans/${row.fan.id}`} className="font-medium hover:underline">
              {name}
            </Link>
          ) : (
            <span className="font-medium text-muted-foreground">{name}</span>
          )}{" "}
          <span className="text-muted-foreground">{lowerFirst(summary)}</span>
        </p>
        {meta ? <p className="mt-0.5 truncate text-xs text-subtle">{meta}</p> : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <SourceBadge source={row.event.source} />
          <VerificationBadge verification={row.event.verification} />
          {row.levelName ? (
            <span className="text-[11px] text-subtle">
              · {row.levelName}
            </span>
          ) : null}
        </div>
      </div>
      <time dateTime={row.event.occurredAt.toISOString()} className="tabular shrink-0 pt-0.5 text-xs text-subtle" title={row.event.occurredAt.toLocaleString()}>
        {formatRelative(row.event.occurredAt)}
      </time>
    </li>
  );
}

function lowerFirst(s: string) {
  return s.length ? s[0].toLowerCase() + s.slice(1) : s;
}
