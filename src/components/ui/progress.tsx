import * as React from "react";
import { cn, clamp } from "@/lib/utils";

export function Progress({ value, max = 100, className, barClassName, color, size = "md" }: { value: number; max?: number; className?: string; barClassName?: string; color?: string; size?: "sm" | "md" | "lg" }) {
  const pct = max > 0 ? clamp((value / max) * 100, 0, 100) : 0;
  const h = size === "sm" ? "h-1.5" : size === "lg" ? "h-3" : "h-2";
  return (
    <div className={cn("w-full overflow-hidden rounded-full bg-muted", h, className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full bg-accent transition-[width] duration-700 ease-out", barClassName)} style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

/** Segmented "███░░" style meter used on passports and score breakdowns. */
export function SegmentedMeter({ value, segments = 16, className, color }: { value: number; segments?: number; className?: string; color?: string }) {
  const filled = Math.round(clamp(value, 0, 100) / (100 / segments));
  return (
    <div className={cn("flex gap-[3px]", className)} aria-hidden>
      {Array.from({ length: segments }).map((_, i) => (
        <span
          key={i}
          className={cn("h-2 flex-1 rounded-[2px] transition-colors", i < filled ? "" : "bg-foreground/10")}
          style={i < filled ? { background: color ?? "var(--accent)", opacity: 0.65 + (i / segments) * 0.35 } : undefined}
        />
      ))}
    </div>
  );
}
