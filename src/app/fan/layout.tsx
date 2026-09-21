import { requireFanContext } from "@/lib/auth/context";

export const dynamic = "force-dynamic";

/**
 * Fan experience shell. Mobile-first, light theme; each artist page sets
 * --artist-accent so the passport inherits the artist's color.
 */
export default async function FanLayout({ children }: { children: React.ReactNode }) {
  await requireFanContext("/fan");
  return <div className="min-h-dvh bg-background text-foreground">{children}</div>;
}
