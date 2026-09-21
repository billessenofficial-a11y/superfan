import { Badge } from "@/components/ui/badge";

type Variant = "default" | "outline" | "accent" | "success" | "warning" | "danger" | "info";

const STATUS: Record<string, { label: string; variant: Variant }> = {
  active: { label: "Active", variant: "success" },
  live: { label: "Live", variant: "success" },
  connected: { label: "Connected", variant: "success" },
  fulfilled: { label: "Fulfilled", variant: "success" },
  upcoming: { label: "Upcoming", variant: "info" },
  scheduled: { label: "Scheduled", variant: "info" },
  syncing: { label: "Syncing", variant: "info" },
  draft: { label: "Draft", variant: "outline" },
  archived: { label: "Archived", variant: "outline" },
  paused: { label: "Paused", variant: "warning" },
  pending: { label: "Pending", variant: "warning" },
  mapping: { label: "Needs mapping", variant: "warning" },
  processing: { label: "Processing", variant: "info" },
  ended: { label: "Ended", variant: "default" },
  completed: { label: "Completed", variant: "default" },
  cancelled: { label: "Cancelled", variant: "danger" },
  failed: { label: "Failed", variant: "danger" },
};

/** Consistent pill for entity statuses across rewards, challenges, events, campaigns. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const meta = STATUS[status] ?? { label: status, variant: "outline" as Variant };
  return (
    <Badge variant={meta.variant} className={className}>
      {meta.label}
    </Badge>
  );
}
