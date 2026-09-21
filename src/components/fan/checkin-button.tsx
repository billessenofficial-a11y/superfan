"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Award, PartyPopper, QrCode, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { checkInAction } from "@/lib/actions/fan";
import { formatNumber } from "@/lib/utils";

type Result = { eventName: string; points: number; scoreDelta: number; levelUp: boolean; levelName: string | null; newBadges: string[]; slug: string | null };

const CODE_MESSAGES: Record<string, string> = {
  already_checked_in: "You're already checked in to this show. Enjoy it!",
  window_closed: "Check-in isn't open right now. Come back closer to showtime.",
  cancelled: "This event was cancelled.",
  expired_token: "This QR code has been replaced. Ask staff for the current one.",
  invalid_token: "This QR code is not valid. Ask staff for the current one.",
};

export function CheckinButton({ token, points, fallbackSlug, disabled, disabledReason }: { token: string; points: number; fallbackSlug: string; disabled?: boolean; disabledReason?: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [result, setResult] = React.useState<Result | null>(null);
  const [blocked, setBlocked] = React.useState<string | null>(null);

  if (result) {
    return (
      <div className="artist-gradient relative overflow-hidden rounded-3xl p-6 text-white animate-rise">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_80%_0%,rgba(255,255,255,0.16),transparent)]" />
        <div className="relative">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
            <PartyPopper className="size-6" />
          </span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">You&apos;re in.</h2>
          <p className="mt-1 text-white/80">
            Checked in at {result.eventName}. <span className="tabular font-semibold text-white">+{formatNumber(result.points)} points</span>
          </p>
          <ul className="mt-5 space-y-2 text-sm">
            {result.scoreDelta > 0 ? (
              <li className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
                <TrendingUp className="size-4" /> Superfan Score <span className="tabular font-semibold">+{formatNumber(result.scoreDelta)}</span>
              </li>
            ) : null}
            {result.levelUp && result.levelName ? (
              <li className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
                <Award className="size-4" /> Level up! You&apos;re now <span className="font-semibold">{result.levelName}</span>
              </li>
            ) : null}
            {result.newBadges.map((b) => (
              <li key={b} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
                <Award className="size-4" /> New badge: <span className="font-semibold">{b}</span>
              </li>
            ))}
          </ul>
          <Button asChild size="lg" className="mt-6 w-full bg-white text-black hover:bg-white/90">
            <Link href={`/fan/${result.slug ?? fallbackSlug}`}>
              Open your passport <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {blocked ? <div className="rounded-xl border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning">{blocked}</div> : null}
      <Button
        variant="artist"
        size="xl"
        className="w-full"
        loading={pending}
        disabled={disabled}
        onClick={() =>
          start(async () => {
            const res = await checkInAction({ token });
            if (!res.ok) {
              const msg = (res.code && CODE_MESSAGES[res.code]) || res.error;
              setBlocked(msg);
              toast.error(msg);
              return;
            }
            setResult(res.data);
            router.refresh();
          })
        }
      >
        {pending ? null : <QrCode />}
        Confirm check-in · +{formatNumber(points)} points
      </Button>
      {disabled && disabledReason ? <p className="text-center text-xs text-muted-foreground">{disabledReason}</p> : null}
    </div>
  );
}
