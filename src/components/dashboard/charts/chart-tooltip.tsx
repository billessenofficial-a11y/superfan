"use client";

import type { TooltipContentProps } from "recharts";

export const CHART = {
  accent: "var(--accent)",
  muted: "var(--muted-foreground)",
  subtle: "var(--subtle)",
  grid: "var(--border)",
  axisFont: { fontSize: 11, fill: "var(--subtle)" } as const,
} as const;

type Row = { label: string; value: string; color?: string };

/** Popover-styled tooltip body shared by every chart. */
export function ChartTooltipCard({ title, rows }: { title?: React.ReactNode; rows: Row[] }) {
  return (
    <div className="min-w-[8rem] rounded-xl border border-border bg-popover px-3 py-2 text-popover-foreground shadow-xl">
      {title ? <div className="mb-1 text-[11px] font-medium text-subtle">{title}</div> : null}
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            {r.color ? <span className="size-2 rounded-full" style={{ background: r.color }} /> : null}
            {r.label}
          </span>
          <span className="tabular font-medium">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Build a Recharts `content` renderer from a formatter. Keeps the chart
 * components free of tooltip plumbing.
 */
export function tooltipContent(render: (payload: Record<string, unknown>, label: string | number | undefined) => { title?: React.ReactNode; rows: Row[] } | null) {
  return function ChartTooltip(props: TooltipContentProps) {
    if (!props.active || !props.payload?.length) return null;
    const first = props.payload[0]?.payload as Record<string, unknown> | undefined;
    if (!first) return null;
    const data = render(first, props.label);
    if (!data) return null;
    return <ChartTooltipCard title={data.title} rows={data.rows} />;
  };
}
