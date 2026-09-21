import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "./logo";

export function SiteNav({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 glass">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#how" className="transition-colors hover:text-foreground">
            How it works
          </a>
          <a href="#artists" className="transition-colors hover:text-foreground">
            For artists
          </a>
          {signedIn ? (
            <Link href="/fan" className="transition-colors hover:text-foreground">
              My passport
            </Link>
          ) : (
            <Link href="/login" className="transition-colors hover:text-foreground">
              Sign in
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-2">
          {signedIn ? (
            <>
              <Button asChild variant="ghost" size="sm" className="md:hidden">
                <Link href="/fan">My passport</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/app">Open dashboard</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="md:hidden">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/login">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
