import Link from "next/link";
import { eq } from "drizzle-orm";
import { CalendarDays, CheckCircle2, MapPin, QrCode } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { CheckinButton } from "@/components/fan/checkin-button";
import { Logo } from "@/components/marketing/logo";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { artists } from "@/db/schema";
import { getFanContext } from "@/lib/auth/context";
import { CheckinError, checkinWindow, resolveCheckinToken, type ArtistEvent } from "@/lib/checkins";
import { features, isDemoMode } from "@/lib/env";
import { accentStyle } from "@/lib/fan/progress";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/utils";

export const metadata = { title: "Check in" };

type Props = { params: Promise<{ token: string }> };

function Shell({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <main className="min-h-dvh bg-background text-foreground" style={accentStyle(accent)}>
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <Link href="/fan" className="text-xs text-muted-foreground hover:text-foreground">
          My passports
        </Link>
      </header>
      <div className="mx-auto max-w-md px-4 pb-16 pt-4 sm:px-6">{children}</div>
    </main>
  );
}

export default async function CheckinPage({ params }: Props) {
  const { token } = await params;

  let event: ArtistEvent;
  try {
    event = await resolveCheckinToken(db, token);
  } catch (err) {
    const message = err instanceof CheckinError && err.code === "expired_token" ? "This QR code has been replaced. Ask staff for the current one." : "This QR code is not valid. Ask staff for the current one.";
    return (
      <Shell>
        <div className="card-surface flex flex-col items-center px-6 py-12 text-center animate-rise">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <QrCode className="size-6" />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-balance">{message}</h1>
          <Button asChild className="mt-6" variant="secondary">
            <Link href="/fan">Go to my passports</Link>
          </Button>
        </div>
      </Shell>
    );
  }

  const [artist] = await db.select({ name: artists.name, slug: artists.slug, avatarUrl: artists.avatarUrl, accentColor: artists.accentColor }).from(artists).where(eq(artists.id, event.artistId)).limit(1);
  const win = checkinWindow(event);
  const ctx = await getFanContext();

  const windowState = win.open
    ? { label: "Check-in open", variant: "success" as const, note: `Closes ${formatRelative(win.closesAt)}` }
    : win.reason === "cancelled"
      ? { label: "Cancelled", variant: "danger" as const, note: "This event was cancelled." }
      : win.reason === "not_yet"
        ? { label: "Opens soon", variant: "warning" as const, note: `Check-in opens ${formatRelative(win.opensAt)} (${formatDateTime(win.opensAt)}).` }
        : { label: "Closed", variant: "outline" as const, note: "Check-in for this event has closed." };

  return (
    <Shell accent={artist?.accentColor}>
      <div className="flex items-center gap-3 animate-rise">
        <Avatar src={artist?.avatarUrl} name={artist?.name ?? "Artist"} size={44} rounded="xl" />
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-artist">{artist?.name ?? "Show"}</p>
          <h1 className="text-xl font-semibold tracking-tight">Check in at the show</h1>
        </div>
      </div>

      <div className="card-surface mt-5 overflow-hidden animate-rise" style={{ animationDelay: "60ms" }}>
        {event.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.imageUrl} alt="" className="h-36 w-full object-cover" />
        ) : (
          <div className="artist-gradient h-24 w-full" />
        )}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">{event.name}</h2>
            <Badge variant={windowState.variant}>{windowState.label}</Badge>
          </div>
          <dl className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <MapPin className="size-4 shrink-0" />
              <dd>{[event.venue, event.city].filter(Boolean).join(" · ") || "Venue TBA"}</dd>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 shrink-0" />
              <dd>{formatDateTime(event.startsAt)}</dd>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0" />
              <dd>
                <span className="tabular font-medium text-foreground">+{formatNumber(event.checkinPoints)} points</span> for checking in
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-subtle">{windowState.note}</p>
        </div>
      </div>

      <div className="mt-4 animate-rise" style={{ animationDelay: "120ms" }}>
        {ctx ? (
          <CheckinButton token={token} points={event.checkinPoints} fallbackSlug={artist?.slug ?? ""} disabled={!win.open} disabledReason={win.open ? undefined : windowState.note} />
        ) : (
          <div className="card-surface p-6">
            <h2 className="text-lg font-semibold tracking-tight">Sign in to check in</h2>
            <p className="mt-1 text-sm text-muted-foreground">You&apos;ll come right back here.</p>
            <div className="mt-5">
              <LoginForm mode="fan" next={`/checkin/${token}`} artistName={artist?.name} demo={isDemoMode && !features.supabaseAuth ? { enabled: true, artistEmail: "maya@lumavale.demo", fanEmail: "james@superfan.demo" } : undefined} />
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
