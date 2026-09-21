import Link from "next/link";
import { ArrowRight, ChevronRight, LogOut, Settings, Sparkles } from "lucide-react";
import { Logo } from "@/components/marketing/logo";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LevelBadge } from "@/components/ui/badge";
import { requireFanContext } from "@/lib/auth/context";
import { getFanArtists } from "@/lib/fan/passport";
import { accentStyle, firstNameOf } from "@/lib/fan/progress";
import { formatNumber, formatRelative } from "@/lib/utils";

export const metadata = { title: "My passports" };

export default async function FanHomePage() {
  const { fan } = await requireFanContext("/fan");
  const memberships = await getFanArtists(fan.id);
  const joined = memberships.filter((m) => m.joinedAt);
  const seen = memberships.filter((m) => !m.joinedAt);

  return (
    <main className="mx-auto max-w-lg px-4 pb-16 sm:max-w-2xl sm:px-6">
      <header className="flex items-center justify-between py-4">
        <Logo />
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon-sm" aria-label="Settings">
            <Link href="/fan/settings">
              <Settings />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon-sm" aria-label="Sign out">
            <a href="/auth/signout">
              <LogOut />
            </a>
          </Button>
        </div>
      </header>

      <div className="mt-4 flex items-center gap-3">
        <Avatar src={fan.avatarUrl} name={[fan.firstName, fan.lastName].filter(Boolean).join(" ") || fan.email} size={48} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hey {firstNameOf(fan)} 👋</h1>
          <p className="text-sm text-muted-foreground">{joined.length === 0 ? "Your passports live here." : `${joined.length} ${joined.length === 1 ? "passport" : "passports"}`}</p>
        </div>
      </div>

      {joined.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={<Sparkles />}
          title="No passports yet"
          description="Join an artist's fan club to start earning status, points and rewards for showing up."
          actions={
            <Button asChild variant="accent">
              <Link href="/artists/luma-vale">
                Explore Luma Vale <ArrowRight />
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="mt-8 space-y-4">
          {joined.map((m, i) => (
            <li key={m.artist.id} className="animate-rise" style={{ animationDelay: `${i * 60}ms`, ...accentStyle(m.artist.accentColor) }}>
              <Link href={`/fan/${m.artist.slug}`} className="card-surface group block overflow-hidden transition-transform active:scale-[0.99]">
                <div className="relative h-24">
                  {m.artist.bannerUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.artist.bannerUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="artist-gradient size-full" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                </div>
                <div className="-mt-8 flex items-end gap-3 px-4">
                  <Avatar src={m.artist.avatarUrl} name={m.artist.name} size={56} rounded="xl" className="ring-4 ring-card shadow" />
                  <div className="min-w-0 flex-1 pb-1">
                    <p className="truncate text-base font-semibold tracking-tight">{m.artist.name}</p>
                    <LevelBadge name={m.levelName} color={m.levelColor} />
                  </div>
                  <ChevronRight className="mb-2 size-5 text-subtle transition-transform group-hover:translate-x-0.5" />
                </div>
                <dl className="mt-3 grid grid-cols-3 divide-x divide-border border-t border-border">
                  <div className="px-4 py-3">
                    <dt className="text-[10px] font-medium uppercase tracking-wider text-subtle">Score</dt>
                    <dd className="tabular text-lg font-semibold">{formatNumber(m.superfanScore)}</dd>
                  </div>
                  <div className="px-4 py-3">
                    <dt className="text-[10px] font-medium uppercase tracking-wider text-subtle">Points</dt>
                    <dd className="tabular text-lg font-semibold text-artist">{formatNumber(m.rewardPoints)}</dd>
                  </div>
                  <div className="px-4 py-3">
                    <dt className="text-[10px] font-medium uppercase tracking-wider text-subtle">Active</dt>
                    <dd className="truncate text-sm font-medium leading-7">{formatRelative(m.lastActiveAt)}</dd>
                  </div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {seen.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-sm font-semibold tracking-tight">Artists who know you</h2>
          <p className="text-xs text-muted-foreground">You have activity with these artists. Join to unlock your passport.</p>
          <ul className="mt-3 space-y-2">
            {seen.map((m) => (
              <li key={m.artist.id} className="card-surface flex items-center gap-3 px-4 py-3">
                <Avatar src={m.artist.avatarUrl} name={m.artist.name} size={36} rounded="xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.artist.name}</p>
                  <p className="text-xs text-muted-foreground">Score {formatNumber(m.superfanScore)} waiting for you</p>
                </div>
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/artists/${m.artist.slug}/join`}>Join</Link>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
