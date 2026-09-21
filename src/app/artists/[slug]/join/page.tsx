import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, Gift, ShieldCheck, Sparkles } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { JoinSubmitButton } from "@/components/fan/join-button";
import { Logo } from "@/components/marketing/logo";
import { Avatar } from "@/components/ui/avatar";
import { joinArtistAction } from "@/lib/actions/fan";
import { getFanContext } from "@/lib/auth/context";
import { features, isDemoMode } from "@/lib/env";
import { getMembership } from "@/lib/fan/membership";
import { getArtistPublic } from "@/lib/fan/passport";
import { accentStyle } from "@/lib/fan/progress";
import { formatNumber } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ ref?: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const data = await getArtistPublic(slug);
  return { title: data ? `Join ${data.artist.name}` : "Join" };
}

const BENEFITS = [
  { icon: <Sparkles className="size-4" />, title: "A passport that grows with you", body: "Superfan Level and Score reflect every verified show, purchase and interaction." },
  { icon: <Gift className="size-4" />, title: "Reward Points to spend", body: "Early access, merch drops and experiences reserved for real fans." },
  { icon: <CalendarDays className="size-4" />, title: "Check in at shows", body: "Scan the QR at the venue for points and badges." },
];

export default async function JoinPage({ params, searchParams }: Props) {
  const [{ slug }, { ref: rawRef }] = await Promise.all([params, searchParams]);
  const data = await getArtistPublic(slug);
  if (!data) notFound();
  const { artist, stats } = data;
  const ref = rawRef ? rawRef.toUpperCase().slice(0, 20) : null;
  const selfHref = `/artists/${slug}/join${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`;

  const ctx = await getFanContext();
  if (ctx) {
    const membership = await getMembership(artist.id, ctx.fan.id);
    if (membership?.joinedAt) redirect(`/fan/${slug}`);
  }

  async function join() {
    "use server";
    await joinArtistAction({ slug, ref });
  }

  return (
    <main className="min-h-dvh bg-background text-foreground" style={accentStyle(artist.accentColor)}>
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <Link href={`/artists/${slug}`} className="text-xs text-muted-foreground hover:text-foreground">
          Back to {artist.name}
        </Link>
      </header>

      <div className="mx-auto max-w-md px-4 pb-16 pt-4 sm:px-6">
        <div className="artist-gradient relative overflow-hidden rounded-3xl p-6 text-white animate-rise">
          <div className="flex items-center gap-3">
            <Avatar src={artist.avatarUrl} name={artist.name} size={52} rounded="xl" className="ring-2 ring-white/20" />
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/60">Fan Passport</p>
              <p className="truncate text-xl font-semibold tracking-tight">{artist.name}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-white/80">
            Join {formatNumber(stats.joined)} {stats.joined === 1 ? "fan" : "fans"} already in the club. Your passport tracks your status, points and rewards with {artist.name}.
          </p>
          {ref ? (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium">
              <Sparkles className="size-3" /> Invited by a friend · code {ref}
            </p>
          ) : null}
        </div>

        <div className="card-surface mt-4 p-6 animate-rise" style={{ animationDelay: "80ms" }}>
          {ctx ? (
            <>
              <h1 className="text-xl font-semibold tracking-tight">Join {artist.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Signed in as <span className="font-medium text-foreground">{ctx.fan.email ?? ctx.user.email}</span>.
              </p>
              <ul className="mt-5 space-y-4">
                {BENEFITS.map((b) => (
                  <li key={b.title} className="flex gap-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-artist/10 text-artist">{b.icon}</span>
                    <div>
                      <p className="text-sm font-medium">{b.title}</p>
                      <p className="text-xs text-muted-foreground">{b.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <form action={join} className="mt-6">
                <JoinSubmitButton artistName={artist.name} />
              </form>
              <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-4 text-subtle">
                <ShieldCheck className="mt-0.5 size-3 shrink-0" />
                By joining you agree that {artist.name} can see your activity with them (shows, purchases, engagement) to recognize and reward you. You can export or delete your data any time.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold tracking-tight">Your fan passport is waiting</h1>
              <p className="mt-1 text-sm text-muted-foreground">Sign in with your email to join {artist.name}&apos;s fan club. No password needed.</p>
              <ul className="mt-5 space-y-3">
                {BENEFITS.map((b) => (
                  <li key={b.title} className="flex items-center gap-3 text-sm">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-artist/10 text-artist [&>svg]:size-3.5">{b.icon}</span>
                    {b.title}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <LoginForm mode="fan" next={selfHref} artistName={artist.name} demo={isDemoMode && !features.supabaseAuth ? { enabled: true, artistEmail: "maya@lumavale.demo", fanEmail: "james@superfan.demo" } : undefined} />
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
