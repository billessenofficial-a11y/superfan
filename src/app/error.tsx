"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-[11px] font-medium uppercase tracking-wider text-subtle">Something went wrong</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">We hit a snag loading this page</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{error.message || "An unexpected error occurred."}</p>
      {error.digest ? <p className="mt-1 font-mono text-[11px] text-subtle">ref {error.digest}</p> : null}
      <Button className="mt-8" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
