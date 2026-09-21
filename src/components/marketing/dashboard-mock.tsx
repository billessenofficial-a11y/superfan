import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

const METRICS = [
  { label: "Identified fans", value: "184K", growth: "+12.4%" },
  { label: "Superfans", value: "8.9K", growth: "+8.1%" },
  { label: "Revenue linked", value: "$482K", growth: "+21.7%" },
  { label: "Active this month", value: "31K", growth: "+5.2%" },
];

const FANS = [
  { name: "James Rellera", city: "Los Angeles", level: "Icon", score: "7,586", color: "#f472b6" },
  { name: "Priya Anand", city: "Toronto", level: "Superfan", score: "6,120", color: "#f59e0b" },
  { name: "Mateo Cruz", city: "Austin", level: "Superfan", score: "5,480", color: "#f59e0b" },
  { name: "Sofia Lindqvist", city: "Berlin", level: "Dedicated", score: "3,110", color: "#34d399" },
];

const SERIES = [12, 14, 13, 17, 19, 18, 22, 25, 24, 28, 31, 30, 34, 38, 41, 40, 45, 49, 52, 58];

function Sparkline({ className }: { className?: string }) {
  const w = 320;
  const h = 72;
  const max = Math.max(...SERIES);
  const min = Math.min(...SERIES);
  const pts = SERIES.map((v, i) => [(i / (SERIES.length - 1)) * w, h - ((v - min) / (max - min)) * (h - 8) - 4] as const);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `M0,${h} L${line} L${w},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("h-16 w-full", className)} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" />
      <polyline points={line} fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" fill="#a78bfa" stroke="#09090b" strokeWidth="2" />
    </svg>
  );
}

/** Pure JSX/CSS mock of the artist dashboard for the marketing hero. */
export function DashboardMock({ className }: { className?: string }) {
  return (
    <div className={cn("dark relative overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b0e] text-foreground shadow-2xl shadow-violet-500/10", className)}>
      <div className="pointer-events-none absolute -top-24 right-0 size-72 rounded-full bg-violet-500/20 blur-3xl" />
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[11px] font-semibold text-white">LV</span>
          <div className="leading-tight">
            <p className="text-xs font-semibold">Drake</p>
            <p className="text-[10px] text-subtle">Overview · Last 30 days</p>
          </div>
        </div>
        <div className="hidden items-center gap-1 sm:flex">
          {["Fans", "Segments", "Rewards"].map((t, i) => (
            <span key={t} className={cn("rounded-full px-2.5 py-1 text-[11px]", i === 0 ? "bg-white/10 text-foreground" : "text-subtle")}>
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 sm:gap-3 sm:p-4">
        {METRICS.map((m) => (
          <div key={m.label} className="rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-subtle">{m.label}</p>
            <div className="mt-1 flex items-end justify-between gap-2">
              <span className="tabular text-xl font-semibold tracking-tight sm:text-2xl">{m.value}</span>
              <span className="mb-0.5 inline-flex items-center gap-0.5 rounded-full bg-success-soft px-1.5 py-0.5 text-[10px] font-medium text-success tabular">
                <ArrowUpRight className="size-2.5" />
                {m.growth}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 px-3 pb-3 sm:grid-cols-5 sm:px-4 sm:pb-4">
        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3 sm:col-span-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">Identified fans</p>
            <span className="text-[10px] text-subtle">Weekly</span>
          </div>
          <Sparkline className="mt-2" />
        </div>
        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3 sm:col-span-2">
          <p className="text-xs font-medium">Top superfans</p>
          <ul className="mt-2 divide-y divide-white/5">
            {FANS.map((f) => (
              <li key={f.name} className="flex items-center gap-2.5 py-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-600 to-zinc-800 text-[10px] font-semibold text-white">
                  {f.name
                    .split(" ")
                    .map((p) => p[0])
                    .join("")}
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-xs font-medium">{f.name}</p>
                  <p className="truncate text-[10px] text-subtle">{f.city}</p>
                </div>
                <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ color: f.color, background: `color-mix(in oklab, ${f.color} 16%, transparent)` }}>
                  {f.level}
                </span>
                <span className="tabular w-12 text-right text-xs font-semibold">{f.score}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
