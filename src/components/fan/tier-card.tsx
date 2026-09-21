import { Sparkles } from "lucide-react";
import { SegmentedMeter } from "@/components/ui/progress";
import type { FullPassport } from "@/lib/fan/passport";
import { levelProgress } from "@/lib/fan/progress";
import { cn, formatNumber } from "@/lib/utils";

/** The collectible tier card at the top of the passport. */
export function TierCard({ passport, className }: { passport: FullPassport; className?: string }) {
  const { artist, membership, level, levels, topPercent } = passport;
  const progress = levelProgress(passport);
  const levelIndex = level ? levels.findIndex((l) => l.id === level.id) + 1 : 0;

  return (
    <div className={cn("artist-gradient relative overflow-hidden rounded-3xl p-6 text-white shadow-2xl shadow-black/20", className)}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_85%_0%,rgba(255,255,255,0.16),transparent)]" />
      <div className="pointer-events-none absolute -bottom-16 -right-16 size-48 rounded-full border border-white/10" />
      <div className="pointer-events-none absolute -bottom-8 -right-8 size-48 rounded-full border border-white/10" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.2em] text-white/60">{artist.name} · Fan Passport</p>
          <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.2em] text-white/70">{levelIndex > 0 ? `Level ${levelIndex} of ${levels.length}` : "Unranked"}</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">{level?.name ?? "Fan"}</p>
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20">
          <Sparkles className="size-5" />
        </span>
      </div>

      <div className="relative mt-6 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/50">Superfan score</p>
          <p className="tabular text-3xl font-semibold tracking-tight">{formatNumber(membership.superfanScore)}</p>
        </div>
        <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium ring-1 ring-white/10">Top {topPercent}%</span>
      </div>

      <div className="relative mt-4">
        <SegmentedMeter value={progress.percent} segments={18} color="#fff" />
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-white/70">
          <span>{progress.label}</span>
          {passport.nextLevel ? (
            <span className="tabular">
              {formatNumber(membership.superfanScore)} / {formatNumber(passport.nextLevel.minScore)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="relative mt-5 flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/10">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/50">Reward points</p>
          <p className="tabular text-xl font-semibold">{formatNumber(membership.rewardPointsCached)}</p>
        </div>
        <span className="text-[11px] text-white/70">{formatNumber(membership.rewardPointsCached)} points available</span>
      </div>
    </div>
  );
}
