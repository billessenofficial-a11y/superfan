import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { BadgeIcon, RARITY_LABELS } from "@/components/fan/badge-icon";
import { requireFanContext } from "@/lib/auth/context";
import { loadPassport } from "@/lib/fan/load-passport";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Badges" };

export default async function BadgesPage({ params }: { params: Promise<{ artistSlug: string }> }) {
  const { artistSlug } = await params;
  const { fan } = await requireFanContext(`/fan/${artistSlug}/badges`);
  const passport = await loadPassport(fan.id, artistSlug);
  if (!passport || !passport.membership) notFound();
  const { badges } = passport;
  const earned = badges.filter((b) => b.earnedAt).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Badges</h1>
        <p className="text-sm text-muted-foreground">
          {earned} of {badges.length} earned. Milestones you collect by showing up.
        </p>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {badges.map(({ badge, earnedAt, rarityPercent }, i) => (
          <li key={badge.id} className={cn("card-surface flex flex-col items-center p-4 text-center animate-rise", !earnedAt && "opacity-70")} style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
            <span className={cn("relative flex size-16 items-center justify-center rounded-3xl", earnedAt ? "artist-gradient text-white shadow-lg shadow-artist/30" : "bg-muted text-subtle")}>
              <BadgeIcon icon={badge.icon} className="size-7" />
              {!earnedAt ? (
                <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-card text-subtle shadow ring-1 ring-border">
                  <Lock className="size-3" />
                </span>
              ) : null}
            </span>
            <p className="mt-3 text-sm font-semibold">{badge.name}</p>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">{badge.description}</p>
            <p className={cn("mt-2 text-[10px] font-medium uppercase tracking-wider", earnedAt ? "text-artist" : "text-subtle")}>{RARITY_LABELS[badge.rarity] ?? badge.rarity}</p>
            <p className="mt-1 text-[11px] text-subtle">{earnedAt ? `Earned ${formatDate(earnedAt, { month: "short", day: "numeric", year: "numeric" })}` : `${rarityPercent}% of fans earned this`}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
