import { can, requireArtistContext } from "@/lib/auth/context";
import { ADAPTERS, PROVIDER_ORDER } from "@/lib/integrations/registry";
import { describeStatus, listIntegrations } from "@/lib/integrations/store";
import { PageHeader } from "@/components/dashboard/page-header";
import { ConnectBanner } from "@/components/integrations/connect-banner";
import { IntegrationCard, type IntegrationCardData } from "@/components/integrations/integration-card";

export const metadata = { title: "Integrations · Superfan" };

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  const [ctx, sp] = await Promise.all([requireArtistContext(), searchParams]);
  const rows = await listIntegrations(ctx.artist.id);
  const byProvider = new Map(rows.map((r) => [r.provider, r]));

  const cards: IntegrationCardData[] = PROVIDER_ORDER.map((provider) => {
    const adapter = ADAPTERS[provider];
    const row = byProvider.get(provider) ?? null;
    const status = row?.status ?? "disconnected";
    const availability = adapter.availability();
    const described =
      provider === "ticketmaster" && status === "disconnected"
        ? availability.mode === "live"
          ? { title: "Event Discovery ready", detail: "Search tour dates when creating an event.", tone: "success" as const }
          : { title: "Sample mode", detail: "Sample tour dates are shown until TICKETMASTER_API_KEY is set.", tone: "neutral" as const }
        : describeStatus(provider, status, row?.lastError);
    return {
      provider,
      displayName: adapter.displayName,
      description: adapter.description,
      capabilities: adapter.capabilities,
      doesNotTrack: adapter.doesNotTrack,
      availability,
      status: described,
      connected: status !== "disconnected",
      account: row
        ? {
            status,
            externalAccountName: row.externalAccountName,
            lastEventAt: row.lastEventAt,
            lastSyncedAt: row.lastSyncedAt,
            connectedAt: row.connectedAt,
            isMock: row.isMock,
            lastError: row.lastError,
          }
        : null,
    };
  });

  const connectedCount = cards.filter((c) => c.connected).length;

  return (
    <div>
      <PageHeader title="Integrations" description={`${connectedCount} of ${cards.length} sources connected. Every source resolves to one fan identity.`} />
      <ConnectBanner connected={sp.connected} error={sp.error} />
      <div className="grid gap-4 lg:grid-cols-2">
        {cards.map((card) => (
          <IntegrationCard key={card.provider} data={card} canManage={can(ctx.role, "manageIntegrations")} />
        ))}
      </div>
    </div>
  );
}
