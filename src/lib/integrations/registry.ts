import { instagramAdapter } from "./instagram";
import { shopifyAdapter } from "./shopify";
import { spotifyAdapter } from "./spotify";
import { ticketmasterAdapter } from "./ticketmaster";
import { tiktokAdapter } from "./tiktok";
import type { IntegrationAdapter, IntegrationProvider } from "./types";

export const ADAPTERS: Record<IntegrationProvider, IntegrationAdapter> = {
  instagram: instagramAdapter,
  shopify: shopifyAdapter,
  ticketmaster: ticketmasterAdapter,
  spotify: spotifyAdapter,
  tiktok: tiktokAdapter,
};

export const PROVIDER_ORDER: IntegrationProvider[] = ["instagram", "shopify", "ticketmaster", "spotify", "tiktok"];

export function getAdapter(provider: string): IntegrationAdapter | null {
  return (ADAPTERS as Record<string, IntegrationAdapter>)[provider] ?? null;
}

export function isIntegrationProvider(value: string): value is IntegrationProvider {
  return value in ADAPTERS;
}
