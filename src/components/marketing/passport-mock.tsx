import { Sparkles } from "lucide-react";
import { SegmentedMeter } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/** Collectible passport tier card mock. */
export function PassportMock({ className }: { className?: string }) {
  return (
    <div className={cn("artist-gradient relative overflow-hidden rounded-3xl p-6 text-white shadow-2xl shadow-violet-500/25", className)}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_80%_0%,rgba(255,255,255,0.14),transparent)]" />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/60">Luma Vale · Fan Passport</p>
          <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.2em] text-white/70">Gold · Level 7</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight">Superfan</p>
        </div>
        <span className="flex size-10 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20">
          <Sparkles className="size-5" />
        </span>
      </div>
      <div className="relative mt-6 flex items-end justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/50">Superfan score</p>
          <p className="tabular text-3xl font-semibold tracking-tight">7,240</p>
        </div>
        <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium">Top 2%</span>
      </div>
      <div className="relative mt-4">
        <SegmentedMeter value={72} segments={18} color="#fff" />
        <div className="mt-2 flex items-center justify-between text-[11px] text-white/70">
          <span>760 points to Icon</span>
          <span className="tabular">7,240 / 8,000</span>
        </div>
      </div>
      <div className="relative mt-5 flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/10">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/50">Reward points</p>
          <p className="tabular text-xl font-semibold">1,850</p>
        </div>
        <span className="text-[11px] text-white/70">Spendable on rewards</span>
      </div>
    </div>
  );
}
