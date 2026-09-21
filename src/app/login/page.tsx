import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getSessionUser } from "@/lib/auth/session";
import { features, isDemoMode } from "@/lib/env";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ mode?: string; next?: string; error?: string; artist?: string }> }) {
  const params = await searchParams;
  const user = await getSessionUser();
  const mode = params.mode === "fan" ? "fan" : "artist";
  const next = params.next && params.next.startsWith("/") ? params.next : mode === "fan" ? "/fan" : "/app";
  if (user) redirect(next);

  const errorMessage =
    params.error === "expired_link"
      ? "That sign-in link has expired. Request a new one below."
      : params.error === "invalid_link"
        ? "That sign-in link is not valid."
        : null;

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 text-white">★</span>
          Superfan
        </Link>
        <Link href={mode === "fan" ? "/login" : "/login?mode=fan"} className="text-xs text-muted-foreground hover:text-foreground">
          {mode === "fan" ? "I'm an artist or team member" : "I'm a fan"}
        </Link>
      </header>
      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-balance">{mode === "fan" ? "Your fan passport is waiting" : "Sign in to Superfan"}</h1>
            <p className="mt-2 text-sm text-muted-foreground text-balance">
              {mode === "fan" ? "Sign in to see your status, points and rewards." : "Know your real fans."}
            </p>
          </div>
          {errorMessage ? <div className="mb-4 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">{errorMessage}</div> : null}
          <LoginForm
            mode={mode}
            next={next}
            artistName={params.artist}
            demo={isDemoMode && !features.supabaseAuth ? { enabled: true, artistEmail: "maya@lumavale.demo", fanEmail: "james@superfan.demo" } : undefined}
          />
        </div>
      </div>
    </main>
  );
}
