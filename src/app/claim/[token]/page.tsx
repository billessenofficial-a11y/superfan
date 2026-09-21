import Link from "next/link";
import { AtSign, BadgeCheck, Clock, Link2Off, ShieldAlert, Sparkles } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { ClaimButton } from "@/components/fan/claim-button";
import { Logo } from "@/components/marketing/logo";
import { ProviderIcon, PROVIDER_LABELS } from "@/components/shared/provider-icon";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { getFanContext } from "@/lib/auth/context";
import { ClaimError, previewClaim, type ClaimPreview } from "@/lib/claims";
import { features, isDemoMode } from "@/lib/env";
import { accentStyle } from "@/lib/fan/progress";
import { formatMoney, formatNumber } from "@/lib/utils";

export const metadata = { title: "Claim your activity" };

type Props = { params: Promise<{ token: string }> };

const ERRORS: Record<ClaimError["code"], { title: string; body: string; icon: React.ReactNode }> = {
  expired: { title: "This link has expired.", body: "Comment again to get a new one.", icon: <Clock className="size-6" /> },
  used: { title: "This link has already been used.", body: "If that was you, your activity is already on your passport.", icon: <BadgeCheck className="size-6" /> },
  revoked: { title: "This link was revoked.", body: "The artist withdrew this claim link. Comment again to get a new one.", icon: <Link2Off className="size-6" /> },
  invalid: { title: "This link is not valid.", body: "Check that you copied the whole link, or comment again to get a new one.", icon: <Link2Off className="size-6" /> },
  not_found: { title: "We couldn't find that account.", body: "The activity behind this link is no longer available.", icon: <Link2Off className="size-6" /> },
  already_claimed: { title: "This account has already been claimed.", body: "If you think that's a mistake, reach out to the artist's team.", icon: <ShieldAlert className="size-6" /> },
};

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

export default async function ClaimPage({ params }: Props) {
  const { token } = await params;

  let preview: ClaimPreview;
  try {
    preview = await previewClaim(db, token);
  } catch (err) {
    const code: ClaimError["code"] = err instanceof ClaimError ? err.code : "invalid";
    const meta = ERRORS[code];
    return (
      <Shell>
        <div className="card-surface flex flex-col items-center px-6 py-12 text-center animate-rise">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">{meta.icon}</span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-balance">{meta.title}</h1>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground text-balance">{meta.body}</p>
          <Button asChild className="mt-6" variant="secondary">
            <Link href="/fan">Go to my passports</Link>
          </Button>
        </div>
      </Shell>
    );
  }

  const ctx = await getFanContext();
  const { artist, identity, activity } = preview;
  const label = PROVIDER_LABELS[identity.provider] ?? identity.provider;
  const handle = identity.username ? `@${identity.username}` : (identity.displayName ?? `${label} account`);

  return (
    <Shell accent={artist.accentColor}>
      <div className="flex items-center gap-3 animate-rise">
        <Avatar src={artist.avatarUrl} name={artist.name} size={44} rounded="xl" />
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-artist">{artist.name}</p>
          <h1 className="text-xl font-semibold tracking-tight">We found activity that may belong to you.</h1>
        </div>
      </div>

      <div className="card-surface mt-5 overflow-hidden animate-rise" style={{ animationDelay: "60ms" }}>
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="relative">
            <Avatar src={identity.avatarUrl} name={identity.displayName ?? identity.username ?? label} size={48} />
            <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-card text-foreground shadow ring-1 ring-border">
              <ProviderIcon provider={identity.provider} size={13} />
            </span>
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="flex items-center gap-1 truncate text-base font-semibold tracking-tight">
              {identity.username ? <AtSign className="size-3.5 text-subtle" /> : null}
              {identity.username ?? handle}
            </p>
            <p className="text-xs text-muted-foreground">
              {label}
              {identity.displayName && identity.username ? ` · ${identity.displayName}` : ""}
            </p>
          </div>
        </div>
        {activity ? (
          <dl className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
            {[
              { label: "Score", value: formatNumber(activity.score) },
              { label: "Interactions", value: formatNumber(activity.interactions) },
              { label: "Shows", value: formatNumber(activity.eventsAttended) },
              { label: "Spend", value: formatMoney(activity.lifetimeSpendCents) },
            ].map((s) => (
              <div key={s.label} className="px-4 py-3">
                <dt className="text-[10px] font-medium uppercase tracking-wider text-subtle">{s.label}</dt>
                <dd className="tabular mt-0.5 text-lg font-semibold tracking-tight">{s.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="px-5 py-4 text-sm text-muted-foreground">Claiming links this {label} account to your passport so future activity counts toward your status.</p>
        )}
      </div>

      <div className="card-surface mt-4 p-6 animate-rise" style={{ animationDelay: "120ms" }}>
        <h2 className="text-lg font-semibold tracking-tight">Claim this activity?</h2>
        {ctx ? (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              It will be added to your passport as <span className="font-medium text-foreground">{ctx.fan.email ?? ctx.user.email}</span>.
            </p>
            <div className="mt-5">
              <ClaimButton token={token} fallbackSlug={artist.slug} />
            </div>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted-foreground">Sign in with your email to add it to your passport. You&apos;ll come right back here.</p>
            <div className="mt-5">
              <LoginForm mode="fan" next={`/claim/${token}`} artistName={artist.name} demo={isDemoMode && !features.supabaseAuth ? { enabled: true, artistEmail: "maya@drake.demo", fanEmail: "james@superfan.demo" } : undefined} />
            </div>
          </>
        )}
        <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-4 text-subtle">
          <Sparkles className="mt-0.5 size-3 shrink-0" />
          Only activity from official {label} APIs is included. We never scrape.
        </p>
      </div>
    </Shell>
  );
}
