import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn, formatPercent } from "@/lib/utils";

export function Stat({
  label,
  value,
  growth,
  hint,
  className,
  size = "md",
}: {
  label: string;
  value: React.ReactNode;
  growth?: number | null;
  hint?: React.ReactNode;
  className?: string;
  size?: "md" | "lg";
}) {
  const positive = (growth ?? 0) >= 0;
  return (
    <div className={cn("card-surface flex flex-col gap-2 px-5 py-4", className)}>
      <span className="text-[11px] font-medium uppercase tracking-wider text-subtle">{label}</span>
      <div className="flex items-end justify-between gap-3">
        <span className={cn("tabular font-semibold tracking-tight leading-none", size === "lg" ? "text-4xl" : "text-[28px]")}>{value}</span>
        {growth != null ? (
          <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular", positive ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
            {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {formatPercent(growth)}
          </span>
        ) : null}
      </div>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}
