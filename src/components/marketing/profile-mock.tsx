import { BadgeCheck, MapPin } from "lucide-react";
import { SegmentedMeter } from "@/components/ui/progress";

const ACTIVITY = ["Attended 3 concerts", "Bought $284 of merch", "Commented on 18 Instagram posts", "Referred 4 fans", "Completed 6 challenges"];

const DIMENSIONS = [
  { label: "Attendance", value: 92 },
  { label: "Merch", value: 78 },
  { label: "Engagement", value: 64 },
  { label: "Referrals", value: 88 },
  { label: "Community", value: 71 },
];

/** Unified fan profile mock: verified activity across sources. */
export function ProfileMock() {
  return (
    <div className="card-surface overflow-hidden">
      <div className="flex items-center gap-4 border-b border-border px-5 py-4">
        <span className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-sm font-semibold text-white">JR</span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex items-center gap-2">
            <p className="truncate text-base font-semibold tracking-tight">James Rellera</p>
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600">Superfan</span>
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3" /> Los Angeles, CA · Fan since 2024
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-medium uppercase tracking-wider text-subtle">Score</p>
          <p className="tabular text-2xl font-semibold tracking-tight">7,240</p>
        </div>
      </div>
      <div className="grid gap-5 px-5 py-4 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-subtle">Verified activity</p>
          <ul className="mt-2 space-y-2">
            {ACTIVITY.map((a) => (
              <li key={a} className="flex items-center gap-2 text-sm">
                <BadgeCheck className="size-4 text-success" />
                {a}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-subtle">Score breakdown</p>
          <ul className="mt-2 space-y-2.5">
            {DIMENSIONS.map((d) => (
              <li key={d.label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{d.label}</span>
                  <span className="tabular font-medium">{d.value}</span>
                </div>
                <SegmentedMeter value={d.value} segments={14} color="var(--artist-accent)" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
