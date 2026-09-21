import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-[11px] font-medium uppercase tracking-wider text-subtle">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">This page doesn&apos;t exist</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">The link may be old, or the artist may have changed their URL.</p>
      <Button asChild className="mt-8">
        <Link href="/">Back to Superfan</Link>
      </Button>
    </main>
  );
}
