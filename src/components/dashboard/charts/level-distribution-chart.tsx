"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART, tooltipContent } from "./chart-tooltip";
import { formatNumber } from "@/lib/utils";

export type LevelBucket = { id: string; name: string; color: string; minScore: number; count: number };

const renderTooltip = tooltipContent((p) => ({
  title: `${String(p.name)} · ${formatNumber(Number(p.minScore))}+ score`,
  rows: [{ label: "Fans", value: formatNumber(Number(p.count)), color: String(p.color) }],
}));

export function LevelDistributionChart({ data }: { data: LevelBucket[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 4, bottom: 0, left: 0 }} barCategoryGap="28%">
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ ...CHART.axisFont, fill: "var(--muted-foreground)" }} interval={0} />
          <YAxis hide domain={[0, "dataMax"]} />
          <Tooltip content={renderTooltip} cursor={{ fill: "var(--muted)", opacity: 0.6 }} isAnimationActive={false} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={56}>
            {data.map((d) => (
              <Cell key={d.id} fill={d.color} />
            ))}
            <LabelList
              dataKey="count"
              position="top"
              offset={6}
              style={{ fontSize: 11, fill: "var(--muted-foreground)", fontVariantNumeric: "tabular-nums" }}
              formatter={(v: unknown) => (total > 0 && typeof v === "number" ? `${Math.round((v / total) * 100)}%` : "")}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
