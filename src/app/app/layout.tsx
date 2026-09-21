import Link from "next/link";
import { requireArtistContext } from "@/lib/auth/context";
import { isDemoMode } from "@/lib/env";
import { SidebarNav } from "@/components/dashboard/sidebar";
import { ArtistSwitcher, MobileTopbar, UserMenu } from "@/components/dashboard/topbar";
import { DemoMenu } from "@/components/dashboard/demo-menu";
import { FanSearch } from "@/components/dashboard/fan-search";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireArtistContext();
  const shell = {
    artist: { id: ctx.artist.id, name: ctx.artist.name, slug: ctx.artist.slug, avatarUrl: ctx.artist.avatarUrl },
    memberships: ctx.memberships,
    user: { email: ctx.user.email, displayName: ctx.user.displayName, avatarUrl: ctx.user.avatarUrl },
    role: ctx.role,
    demoMode: isDemoMode,
  };

  return (
    <div className="dark min-h-dvh bg-background text-foreground" style={{ ["--artist-accent" as string]: ctx.artist.accentColor }}>
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
            <UserMenu user={shell.user} role={shell.role} />
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
