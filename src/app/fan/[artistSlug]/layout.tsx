import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Settings } from "lucide-react";
import { FanNav } from "@/components/fan/fan-nav";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { requireFanContext } from "@/lib/auth/context";
import { loadPassport } from "@/lib/fan/load-passport";
import { accentStyle, firstNameOf } from "@/lib/fan/progress";

export default async function PassportLayout({ children, params }: { children: React.ReactNode; params: Promise<{ artistSlug: string }> }) {
  const { artistSlug } = await params;
  const { fan } = await requireFanContext(`/fan/${artistSlug}`);
  const passport = await loadPassport(fan.id, artistSlug);
  if (!passport) notFound();
  if (!passport.membership) redirect(`/artists/${artistSlug}/join`);
  const { artist } = passport;

  return (
    <div className="min-h-dvh" style={accentStyle(artist.accentColor)}>
      <header className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3 sm:max-w-2xl sm:px-6">
        <Button asChild variant="ghost" size="icon-sm" aria-label="All passports" className="-ml-2">
          <Link href="/fan">
            <ChevronLeft />
          </Link>
        </Button>
        <Avatar src={artist.avatarUrl} name={artist.name} size={36} rounded="xl" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[10px] font-medium uppercase tracking-[0.18em] text-artist">Your {artist.name} passport</p>
          <p className="truncate text-sm font-semibold tracking-tight">{firstNameOf(fan)}</p>
        </div>
        <Button asChild variant="ghost" size="icon-sm" aria-label="Settings">
          <Link href="/fan/settings">
            <Settings />
          </Link>
        </Button>
      </header>
      <FanNav slug={artistSlug} />
      <div className="mx-auto max-w-lg px-4 pb-28 pt-4 sm:max-w-2xl sm:px-6 sm:pb-16">{children}</div>
    </div>
  );
}
