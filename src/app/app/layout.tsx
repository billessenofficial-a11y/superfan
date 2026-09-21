import Link from "next/link";
import { cookies } from "next/headers";
import { requireArtistContext } from "@/lib/auth/context";
import { isDemoMode } from "@/lib/env";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { SidebarNav } from "@/components/dashboard/sidebar";
import { ArtistSwitcher, MobileTopbar, UserMenu } from "@/components/dashboard/topbar";
import { DemoMenu } from "@/components/dashboard/demo-menu";
import { FanSearch } from "@/components/dashboard/fan-search";
import { APP_SHELL_ID, ThemeSync, ThemeToggle } from "@/components/dashboard/theme-toggle";

export const dynamic = "force-dynamic";

/**
 * Runs before the shell paints so a "system" theme never flashes the wrong
 * colors. The class is also set server-side for the explicit themes.
 */
const SYSTEM_THEME_SCRIPT = `(function(){var s=document.currentScript&&document.currentScript.parentElement;if(!s)return;s.classList.toggle('dark',window.matchMedia('(prefers-color-scheme: dark)').matches);})()`;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [ctx, cookieStore] = await Promise.all([requireArtistContext(), cookies()]);
  const theme = parseTheme(cookieStore.get(THEME_COOKIE)?.value);
  const shell = {
    artist: { id: ctx.artist.id, name: ctx.artist.name, slug: ctx.artist.slug, avatarUrl: ctx.artist.avatarUrl },
    memberships: ctx.memberships,
    user: { email: ctx.user.email, displayName: ctx.user.displayName, avatarUrl: ctx.user.avatarUrl },
    role: ctx.role,
    demoMode: isDemoMode,
    theme,
  };

  return (
    <div
      id={APP_SHELL_ID}
      data-theme={theme}
      className={cn("min-h-dvh bg-background text-foreground", theme !== "light" && "dark")}
      style={{ ["--artist-accent" as string]: ctx.artist.accentColor }}
      suppressHydrationWarning
    >
      {theme === "system" ? <script dangerouslySetInnerHTML={{ __html: SYSTEM_THEME_SCRIPT }} /> : null}
      <ThemeSync theme={theme} />
      <MobileTopbar {...shell} />
      <div className="flex">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-background px-3 py-4 lg:flex">
          <ArtistSwitcher artist={shell.artist} memberships={shell.memberships} />
          <div className="mt-4">
            <FanSearch />
          </div>
          <div className="mt-4 flex-1 overflow-y-auto">
            <SidebarNav />
          </div>
          {isDemoMode ? (
            <div className="mb-3">
              <DemoMenu />
            </div>
          ) : null}
          <div className="flex items-center justify-between rounded-xl px-2 py-1.5">
            <Link href="/" className="flex items-center gap-2 text-xs font-semibold tracking-tight text-muted-foreground hover:text-foreground">
              <span className="flex size-5 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-pink-500 text-[10px] text-white">★</span>
              Superfan
            </Link>
            <div className="flex items-center gap-1">
              <ThemeToggle theme={theme} />
              <UserMenu user={shell.user} role={shell.role} />
            </div>
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
