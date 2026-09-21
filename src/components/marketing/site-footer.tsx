import Link from "next/link";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-2">
          <Logo />
          <p className="text-xs text-subtle">Official APIs and first-party data only. No scraping.</p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link href="/privacy" className="transition-colors hover:text-foreground">
            Privacy
          </Link>
          <Link href="/login?mode=fan" className="transition-colors hover:text-foreground">
            For fans
          </Link>
          <Link href="/artists/luma-vale" className="transition-colors hover:text-foreground">
            Demo
          </Link>
          <Link href="/login" className="transition-colors hover:text-foreground">
            Sign in
          </Link>
        </nav>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-8 text-[11px] text-subtle sm:px-6">© {new Date().getFullYear()} Superfan. Know your real fans.</div>
    </footer>
  );
}
