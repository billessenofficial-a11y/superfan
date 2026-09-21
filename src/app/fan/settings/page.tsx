import Link from "next/link";
import { eq } from "drizzle-orm";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { DataControls } from "@/components/fan/settings/data-controls";
import { ExperimentalConnections, type ExperimentalProvider } from "@/components/fan/settings/experimental-connections";
import { ConnectedIdentities, type IdentityItem } from "@/components/fan/settings/identities";
import { ProfileForm } from "@/components/fan/settings/profile-form";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { artists, fanIdentities } from "@/db/schema";
import { requireFanContext } from "@/lib/auth/context";
import { ADAPTERS } from "@/lib/integrations/registry";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Settings" };

export default async function FanSettingsPage() {
  const { fan } = await requireFanContext("/fan/settings");

  const rows = await db
    .select({ identity: fanIdentities, artistName: artists.name })
    .from(fanIdentities)
    .leftJoin(artists, eq(artists.id, fanIdentities.artistId))
    .where(eq(fanIdentities.fanId, fan.id))
    .orderBy(fanIdentities.provider);

  const identities: IdentityItem[] = rows.map(({ identity, artistName }) => ({
    id: identity.id,
    provider: identity.provider,
    username: identity.username,
    displayName: identity.displayName,
    claimed: identity.claimed,
    claimedAt: identity.claimedAt,
    artistName,
  }));

  const experimental: ExperimentalProvider[] = (["spotify", "tiktok"] as const).map((provider) => {
    const adapter = ADAPTERS[provider];
    return {
      provider,
      description: adapter.description,
      capabilities: adapter.capabilities,
      doesNotTrack: adapter.doesNotTrack,
      availability: adapter.availability(),
      connected: identities.some((i) => i.provider === provider && i.claimed),
    };
  });

  return (
    <main className="mx-auto max-w-lg px-4 pb-16 sm:max-w-2xl sm:px-6">
      <header className="flex items-center gap-2 py-4">
        <Button asChild variant="ghost" size="icon-sm" aria-label="Back" className="-ml-2">
          <Link href="/fan">
            <ChevronLeft />
          </Link>
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
      </header>

      <div className="space-y-4">
        <ProfileForm profile={{ firstName: fan.firstName, lastName: fan.lastName, city: fan.city, country: fan.country, email: fan.email, communicationPreferences: fan.communicationPreferences }} />
        <ConnectedIdentities identities={identities} />
        <ExperimentalConnections providers={experimental} />
        <DataControls />

        <p className="flex items-start gap-2 px-1 text-[11px] leading-4 text-subtle">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {fan.consentedAt ? `You agreed to the privacy policy${fan.privacyPolicyVersion ? ` (version ${fan.privacyPolicyVersion})` : ""} on ${formatDate(fan.consentedAt, { month: "long", day: "numeric", year: "numeric" })}.` : "You haven't joined a fan club yet, so no consent is on record."}{" "}
            Superfan only uses official APIs and first-party data. We never scrape.
          </span>
        </p>
      </div>
    </main>
  );
}
