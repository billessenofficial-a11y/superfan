"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART, tooltipContent } from "./chart-tooltip";
import { formatDate, formatNumber } from "@/lib/utils";

export type FanGrowthPoint = { date: string; fans: number; newFans: number };

const renderTooltip = tooltipContent((p) => ({
  title: formatDate(String(p.date), { month: "short", day: "numeric", year: "numeric" }),
  rows: [
    { label: "Identified fans", value: formatNumber(Number(p.fans)), color: "var(--accent)" },
    { label: "New that day", value: `+${formatNumber(Number(p.newFans))}` },
  ],
}));

export function FanGrowthChart({ data }: { data: FanGrowthPoint[] }) {
  const min = data.length ? Math.min(...data.map((d) => d.fans)) : 0;
  const max = data.length ? Math.max(...data.map((d) => d.fans)) : 0;
  const pad = Math.max(1, Math.round((max - min) * 0.25));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="fanGrowthFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.accent} stopOpacity={0.35} />
              <stop offset="100%" stopColor={CHART.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={CHART.axisFont}
            interval="preserveStartEnd"
            minTickGap={48}
            tickFormatter={(v: string) => formatDate(v)}
          />
          <YAxis
            width={44}
            axisLine={false}
            tickLine={false}
            tick={CHART.axisFont}
            domain={[Math.max(0, min - pad), max + pad]}
            tickCount={4}
            tickFormatter={(v: number) => formatNumber(v, { compact: true })}
          />
          <Tooltip content={renderTooltip} cursor={{ stroke: CHART.grid, strokeWidth: 1 }} isAnimationActive={false} />
          <Area type="monotone" dataKey="fans" stroke={CHART.accent} strokeWidth={2} fill="url(#fanGrowthFill)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)", fill: CHART.accent }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
