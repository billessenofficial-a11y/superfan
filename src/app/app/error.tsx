"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ShieldAlert } from "lucide-react";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const forbidden = /permission/i.test(error.message);
  return (
    <EmptyState
      icon={<ShieldAlert />}
      title={forbidden ? "You don't have permission to do that" : "Something went wrong"}
      description={forbidden ? "Ask a workspace admin to change your role if you need access." : error.message || "An unexpected error occurred while loading this page."}
      actions={
        <>
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="secondary">
            <Link href="/app">Back to overview</Link>
          </Button>
        </>
      }
    />
  );
}
