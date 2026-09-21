import Link from "next/link";
import { ArtistOnboarding } from "@/components/onboarding/artist-onboarding";
import { getArtistContext, requireUser } from "@/lib/auth/context";

export const metadata = { title: "Create your artist workspace" };

export default async function OnboardingPage() {
  await requireUser("/onboarding");
  const ctx = await getArtistContext();
  return (
    <main className="dark min-h-dvh bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 text-white">★</span>
          Superfan
        </Link>
        {ctx ? (
          <Link href="/app" className="text-xs text-muted-foreground hover:text-foreground">
            Back to {ctx.artist.name}
          </Link>
        ) : (
          <form action="/auth/signout" method="post">
            <button className="text-xs text-muted-foreground hover:text-foreground">Sign out</button>
          </form>
        )}
      </header>
      <div className="flex items-center justify-center px-4 py-12 sm:py-20">
        <ArtistOnboarding hasArtist={Boolean(ctx)} />
      </div>
    </main>
  );
}
