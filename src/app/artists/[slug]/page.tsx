import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, Gift, ListChecks, MapPin, Sparkles } from "lucide-react";
import { ArtistBanner } from "@/components/fan/artist-banner";
import { Logo } from "@/components/marketing/logo";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getFanContext } from "@/lib/auth/context";
import { getMembership } from "@/lib/fan/membership";
import { getArtistPublic } from "@/lib/fan/passport";
import { accentStyle } from "@/lib/fan/progress";
import { formatDate, formatNumber } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ ref?: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const data = await getArtistPublic(slug);
  return { title: data ? `${data.artist.name} Fan Club` : "Artist" };
}

export default async function ArtistPage({ params, searchParams }: Props) {
  const [{ slug }, { ref }] = await Promise.all([params, searchParams]);
  const data = await getArtistPublic(slug);
  if (!data) notFound();
  const { artist, stats, upcoming, levels } = data;

  const ctx = await getFanContext();
  const membership = ctx ? await getMembership(artist.id, ctx.fan.id) : null;
  const isMember = Boolean(membership?.joinedAt);
  const joinHref = `/artists/${slug}/join${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`;

  return (
    <main className="min-h-dvh bg-background text-foreground" style={accentStyle(artist.accentColor)}>
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-4 sm:px-6">
        <Logo className="rounded-full bg-background/70 px-3 py-1.5 glass" />
        <Link href={ctx ? "/fan" : "/login?mode=fan"} className="rounded-full bg-background/70 px-3 py-1.5 text-xs font-medium glass hover:bg-background">
          {ctx ? "My passports" : "Sign in"}
        </Link>
      </header>

      <ArtistBanner src={artist.bannerUrl} name={artist.name} className="h-56 sm:h-80" />

      <div className="mx-auto -mt-14 max-w-2xl px-4 pb-24 sm:px-6">
        <div className="flex items-end gap-4 animate-rise">
          <Avatar src={artist.avatarUrl} name={artist.name} size={88} rounded="xl" className="ring-4 ring-background shadow-xl" />
          <div className="min-w-0 pb-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{artist.name}</h1>
            <p className="text-sm text-muted-foreground">
              {artist.genre ? `${artist.genre} · ` : ""}
              {formatNumber(stats.joined)} {stats.joined === 1 ? "fan" : "fans"} in the club
            </p>
          </div>
        </div>

        <section className="mt-8 animate-rise" style={{ animationDelay: "60ms" }}>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-artist">You&apos;re more than a follower.</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Turn your fandom into status, rewards and experiences.</h2>
          {artist.bio ? <p className="mt-3 text-sm text-muted-foreground">{artist.bio}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-medium shadow-sm ring-1 ring-border">
              <Gift className="size-3.5 text-artist" /> {stats.activeRewards} active {stats.activeRewards === 1 ? "reward" : "rewards"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-medium shadow-sm ring-1 ring-border">
              <ListChecks className="size-3.5 text-artist" /> {stats.activeChallenges} active {stats.activeChallenges === 1 ? "challenge" : "challenges"}
            </span>
            {upcoming.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-medium shadow-sm ring-1 ring-border">
                <CalendarDays className="size-3.5 text-artist" /> {upcoming.length} upcoming {upcoming.length === 1 ? "show" : "shows"}
              </span>
            ) : null}
          </div>
          <div className="mt-6">
            {isMember ? (
              <Button asChild variant="artist" size="lg" className="w-full sm:w-auto">
                <Link href={`/fan/${slug}`}>
                  Open your passport <ArrowRight />
                </Link>
              </Button>
            ) : (
              <Button asChild variant="artist" size="lg" className="w-full sm:w-auto">
                <Link href={joinHref}>
                  Join {artist.name}&apos;s Fan Club <ArrowRight />
                </Link>
              </Button>
            )}
            <p className="mt-2 text-xs text-subtle">Free. Sign in with your email, no password needed.</p>
          </div>
        </section>

        <section className="mt-10 grid gap-3 sm:grid-cols-3">
          {[
            { icon: <Sparkles className="size-4" />, title: "Earn status", body: "Your Superfan Score grows with every verified show, purchase and interaction." },
            { icon: <Gift className="size-4" />, title: "Unlock rewards", body: "Spend Reward Points on early access, merch drops and experiences." },
            { icon: <CalendarDays className="size-4" />, title: "Check in at shows", body: "Scan the QR at the venue to collect points and badges." },
          ].map((f) => (
            <div key={f.title} className="card-surface p-4">
              <span className="flex size-8 items-center justify-center rounded-xl bg-artist/10 text-artist">{f.icon}</span>
              <p className="mt-3 text-sm font-semibold">{f.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>

        {upcoming.length > 0 ? (
          <section className="mt-10">
            <h3 className="text-base font-semibold tracking-tight">Upcoming shows</h3>
            <ul className="mt-3 divide-y divide-border card-surface">
              {upcoming.map((e) => (
                <li key={e.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-muted py-1.5 leading-tight">
                    <span className="text-[10px] font-medium uppercase text-subtle">{formatDate(e.startsAt, { month: "short" })}</span>
                    <span className="tabular text-lg font-semibold">{formatDate(e.startsAt, { day: "numeric" })}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.name}</p>
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <MapPin className="size-3 shrink-0" />
                      {[e.venue, e.city].filter(Boolean).join(" · ") || "Venue TBA"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {levels.length > 0 ? (
          <section className="mt-10">
            <h3 className="text-base font-semibold tracking-tight">Levels</h3>
            <p className="mt-1 text-sm text-muted-foreground">Status you earn by showing up. It can&apos;t be bought.</p>
            <ol className="mt-3 card-surface divide-y divide-border">
              {levels.map((l, i) => (
                <li key={l.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex size-8 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ background: l.color }}>
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm font-medium">{l.name}</span>
                  <span className="tabular text-xs text-muted-foreground">{l.minScore === 0 ? "Start here" : `${formatNumber(l.minScore)}+ score`}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <p className="mt-10 text-center text-[11px] text-subtle">Official APIs and first-party data only. You control what&apos;s connected and can leave any time.</p>
      </div>
    </main>
  );
}
