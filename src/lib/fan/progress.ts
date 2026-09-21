import type { CSSProperties } from "react";
import type { FullPassport } from "./passport";

/** Inline style that sets the artist accent for a subtree. */
export function accentStyle(color: string | null | undefined): CSSProperties {
  return { "--artist-accent": color ?? "#8b5cf6" } as CSSProperties;
}

export type LevelProgress = {
  percent: number;
  pointsToNext: number | null;
  nextName: string | null;
  label: string;
};

/** Progress from the current level towards the next one, as a 0–100 percent. */
export function levelProgress(p: Pick<FullPassport, "membership" | "level" | "nextLevel">): LevelProgress {
  const score = p.membership.superfanScore;
  const floor = p.level?.minScore ?? 0;
  if (!p.nextLevel) return { percent: 100, pointsToNext: null, nextName: null, label: "Highest level reached" };
  const span = Math.max(1, p.nextLevel.minScore - floor);
  const percent = Math.min(100, Math.max(0, ((score - floor) / span) * 100));
  const pointsToNext = Math.max(0, p.nextLevel.minScore - score);
  return { percent, pointsToNext, nextName: p.nextLevel.name, label: `${pointsToNext.toLocaleString()} points to ${p.nextLevel.name}` };
}

export const DIMENSION_LABELS: Record<string, string> = {
  commerce: "Merch & tickets",
  attendance: "Shows attended",
  engagement: "Engagement",
  advocacy: "Referrals",
  community: "Community",
};

export function firstNameOf(fan: { firstName: string | null; email: string | null }): string {
  if (fan.firstName) return fan.firstName;
  if (fan.email) return fan.email.split("@")[0];
  return "there";
}

/** Events happening soon or with an open check-in window, for the passport hero. */
export function nextShow<T extends { event: { startsAt: Date; status: string }; window: { open: boolean }; checkedIn: boolean }>(events: T[], now = new Date()): T | null {
  const soon = now.getTime() + 48 * 3600_000;
  const candidates = events
    .filter((e) => e.event.status !== "cancelled" && e.event.status !== "completed")
    .filter((e) => e.window.open || (e.event.startsAt.getTime() >= now.getTime() - 6 * 3600_000 && e.event.startsAt.getTime() <= soon))
    .sort((a, b) => a.event.startsAt.getTime() - b.event.startsAt.getTime());
  return candidates[0] ?? null;
}
