"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART, tooltipContent } from "./chart-tooltip";
import { formatDate, formatNumber } from "@/lib/utils";

export type StreamsPoint = { date: string; streams: number; listeners?: number };

const SPOTIFY = "var(--spotify)";

const renderTooltip = tooltipContent((p) => ({
  title: formatDate(String(p.date), { month: "short", day: "numeric", year: "numeric" }),
  rows: [
    { label: "Streams", value: formatNumber(Number(p.streams)), color: SPOTIFY },
    ...(typeof p.listeners === "number" ? [{ label: "Monthly listeners", value: formatNumber(Number(p.listeners), { compact: true }) }] : []),
  ],
}));

/**
 * Daily streams as an area chart. `compact` drops the axes for the overview
 * card so the shape reads as a sparkline.
 */
export function StreamsChart({ data, compact = false, height }: { data: StreamsPoint[]; compact?: boolean; height?: number }) {
  const max = data.length ? Math.max(...data.map((d) => d.streams)) : 0;
  const min = data.length ? Math.min(...data.map((d) => d.streams)) : 0;
  const pad = Math.max(1, Math.round((max - min) * 0.15));
  return (
    <div style={{ height: height ?? (compact ? 96 : 240) }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: compact ? 0 : 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="streamsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SPOTIFY} stopOpacity={0.32} />
              <stop offset="100%" stopColor={SPOTIFY} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" hide={compact} axisLine={false} tickLine={false} tick={CHART.axisFont} interval="preserveStartEnd" minTickGap={56} tickFormatter={(v: string) => formatDate(v)} />
          <YAxis hide={compact} width={48} axisLine={false} tickLine={false} tick={CHART.axisFont} domain={[Math.max(0, min - pad), max + pad]} tickCount={4} tickFormatter={(v: number) => formatNumber(v, { compact: true })} />
          <Tooltip content={renderTooltip} cursor={{ stroke: CHART.grid, strokeWidth: 1 }} isAnimationActive={false} />
          <Area type="monotone" dataKey="streams" stroke={SPOTIFY} strokeWidth={2} fill="url(#streamsFill)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)", fill: SPOTIFY }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
