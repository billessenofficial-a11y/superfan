import { Coins } from "lucide-react";
import { SourceIcon, SOURCE_LABELS, VerificationMark } from "@/components/fan/source-icon";
import { cn, formatDateTime, formatNumber, formatRelative } from "@/lib/utils";

export type ActivityItem =
  | { kind: "event"; id: string; at: Date; source: string; summary: string; verification: string }
  | { kind: "points"; id: string; at: Date; amount: number; description: string };

/** Human summary for an event without one, derived from the type key. */
export function summarize(type: string, summary: string | null): string {
  if (summary) return summary;
  const tail = type.split(".").slice(1).join(" ").replace(/_/g, " ");
  return tail ? tail[0].toUpperCase() + tail.slice(1) : type;
}

export function ActivityRow({ item, relative = true }: { item: ActivityItem; relative?: boolean }) {
  const when = relative ? formatRelative(item.at) : formatDateTime(item.at);
  if (item.kind === "points") {
    const positive = item.amount >= 0;
    return (
      <li className="flex items-center gap-3 px-4 py-3">
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl", positive ? "bg-artist/10 text-artist" : "bg-muted text-muted-foreground")}>
          <Coins className="size-4" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm">
            <span className={cn("tabular font-semibold", positive ? "text-artist" : "text-foreground")}>
              {positive ? "+" : "−"}
              {formatNumber(Math.abs(item.amount))} points
            </span>
            <span className="text-muted-foreground"> · {item.description}</span>
          </p>
          <p className="text-[11px] text-subtle">{when}</p>
        </div>
      </li>
    );
  }
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
        <SourceIcon source={item.source} size={15} />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-medium">{item.summary}</p>
        <p className="text-[11px] text-subtle">
          {SOURCE_LABELS[item.source] ?? item.source} · {when}
        </p>
      </div>
      <VerificationMark verification={item.verification} />
    </li>
  );
}
