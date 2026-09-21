"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART, tooltipContent } from "./chart-tooltip";
import { formatNumber } from "@/lib/utils";

export type EngagementSource = { label: string; count: number; share: number };

/** Fixed hue per source so colors follow the entity, never its rank. */
const SOURCE_COLORS: Record<string, string> = {
  Instagram: "#e879f9",
  Shopify: "#4ade80",
  Events: "#fbbf24",
  Referrals: "#60a5fa",
  Challenges: "#fb923c",
  Rewards: "#f472b6",
  Superfan: "var(--accent)",
  Imports: "#94a3b8",
  Spotify: "#22c55e",
  TikTok: "#67e8f9",
  Ticketmaster: "#818cf8",
  Manual: "#a1a1aa",
};

export function sourceColor(label: string) {
  return SOURCE_COLORS[label] ?? "var(--muted-foreground)";
}

const renderTooltip = tooltipContent((p) => ({
  title: String(p.label),
  rows: [
    { label: "Interactions", value: formatNumber(Number(p.count)), color: sourceColor(String(p.label)) },
    { label: "Share", value: `${Number(p.share)}%` },
  ],
}));

export function EngagementSourcesChart({ data }: { data: EngagementSource[] }) {
  const rows = data.slice(0, 7);
  const height = Math.max(120, rows.length * 34);
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }} barCategoryGap={8}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="label" width={84} axisLine={false} tickLine={false} tick={{ ...CHART.axisFont, fill: "var(--muted-foreground)" }} />
            <Tooltip content={renderTooltip} cursor={{ fill: "var(--muted)", opacity: 0.6 }} isAnimationActive={false} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={18}>
              {rows.map((r) => (
                <Cell key={r.label} fill={sourceColor(r.label)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-1 sm:min-w-[9rem]">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: sourceColor(r.label) }} />
              {r.label}
            </span>
            <span className="tabular font-medium">{r.share}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
