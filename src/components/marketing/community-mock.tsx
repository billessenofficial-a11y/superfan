import { CheckCircle2, Gift, ListChecks, Lock, Ticket } from "lucide-react";

const REWARDS = [
  { name: "Early access: Afterlight tour", cost: "1,200 pts", tag: "Access", icon: <Ticket className="size-4" />, locked: false },
  { name: "Signed tour poster", cost: "900 pts", tag: "12 left", icon: <Gift className="size-4" />, locked: false },
  { name: "Soundcheck party · LA", cost: "Icon only", tag: "Level locked", icon: <Lock className="size-4" />, locked: true },
];

const CHALLENGES = [
  { title: "Afterlight lyric quiz", points: "+150", done: true },
  { title: "Bring a friend to a show", points: "+200", done: false },
  { title: "Check in at the LA show", points: "+500", done: false },
];

/** Rewards + challenges mock cards. */
export function CommunityMock() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="card-surface p-5">
        <div className="flex items-center gap-2">
          <Gift className="size-4 text-artist" />
          <p className="text-sm font-semibold">Rewards</p>
          <span className="ml-auto tabular text-xs text-muted-foreground">1,850 pts available</span>
        </div>
        <ul className="mt-4 space-y-2">
          {REWARDS.map((r) => (
            <li key={r.name} className={r.locked ? "flex items-center gap-3 rounded-2xl border border-dashed border-border px-3 py-2.5 opacity-70" : "flex items-center gap-3 rounded-2xl bg-muted px-3 py-2.5"}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-card text-artist shadow-sm">{r.icon}</span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-sm font-medium">{r.name}</p>
                <p className="text-[11px] text-subtle">{r.tag}</p>
              </div>
              <span className="tabular text-xs font-semibold">{r.cost}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="card-surface p-5">
        <div className="flex items-center gap-2">
          <ListChecks className="size-4 text-artist" />
          <p className="text-sm font-semibold">Challenges</p>
          <span className="ml-auto text-xs text-muted-foreground">1 of 3 complete</span>
        </div>
        <ul className="mt-4 space-y-2">
          {CHALLENGES.map((c) => (
            <li key={c.title} className="flex items-center gap-3 rounded-2xl bg-muted px-3 py-2.5">
              <span className={c.done ? "flex size-8 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success" : "flex size-8 shrink-0 items-center justify-center rounded-xl bg-card text-subtle shadow-sm"}>
                <CheckCircle2 className="size-4" />
              </span>
              <p className={c.done ? "min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground line-through" : "min-w-0 flex-1 truncate text-sm font-medium"}>{c.title}</p>
              <span className="tabular rounded-full bg-artist/10 px-2 py-0.5 text-[11px] font-semibold text-artist">{c.points}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
