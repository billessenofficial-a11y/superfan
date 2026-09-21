import { env, features } from "@/lib/env";
import type { IntegrationAdapter, ProviderAvailability } from "./types";

export type DiscoveredEvent = {
  id: string;
  name: string;
  url: string | null;
  startsAt: string | null;
  venue: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  imageUrl: string | null;
};

/**
 * Ticketmaster.
 *
 * The public Discovery API provides event, attraction and venue metadata.
 * It does not give access to anyone's purchase history; that requires the
 * restricted Partner API and an official Ticketmaster relationship. MVP
 * ticket verification therefore relies on CSV imports of ticket buyers,
 * QR check-ins and manually verified attendance. The Partner adapter slot
 * exists here for when that relationship is in place.
 */
export const ticketmasterAdapter: IntegrationAdapter = {
  provider: "ticketmaster",
  displayName: "Ticketmaster",
  description: "Event discovery for your tour dates. Purchase verification requires partner access.",
  capabilities: ["Search your upcoming events, venues and dates", "Pre-fill Superfan events from tour listings"],
  doesNotTrack: ["Who bought tickets (Partner API only)", "Historical ticket purchases"],

  availability(): ProviderAvailability {
    if (features.ticketmasterDiscovery) return { mode: "live", experimental: false, scope: "artist", note: "Event Discovery enabled. Purchase verification requires partner access — import ticket buyers via CSV." };
    return { mode: "mock", experimental: false, scope: "artist", note: "Set TICKETMASTER_API_KEY to search real events. Sample events are shown until then. Purchase verification requires partner access." };
  },

  async mockConnect() {
    return { externalAccountId: "discovery", externalAccountName: "Event Discovery", settings: { mock: true } };
  },

  async disconnect() {},
};

const SAMPLE_EVENTS: DiscoveredEvent[] = [
  { id: "sample-1", name: "Drake — Iceman Tour", url: null, startsAt: new Date(Date.now() + 12 * 86400_000).toISOString(), venue: "Kia Forum", city: "Los Angeles", region: "CA", country: "US", imageUrl: null },
  { id: "sample-2", name: "Drake — Iceman Tour", url: null, startsAt: new Date(Date.now() + 19 * 86400_000).toISOString(), venue: "Madison Square Garden", city: "New York", region: "NY", country: "US", imageUrl: null },
  { id: "sample-3", name: "Drake — Iceman Tour", url: null, startsAt: new Date(Date.now() + 33 * 86400_000).toISOString(), venue: "The O2", city: "London", region: null, country: "GB", imageUrl: null },
];

/** Search events by keyword using the Discovery API; falls back to samples without a key. */
export async function searchTicketmasterEvents(keyword: string, size = 10): Promise<{ events: DiscoveredEvent[]; live: boolean }> {
  if (!features.ticketmasterDiscovery) {
    const q = keyword.trim().toLowerCase();
    return { events: SAMPLE_EVENTS.filter((e) => !q || e.name.toLowerCase().includes(q)), live: false };
  }
  const params = new URLSearchParams({ apikey: env.TICKETMASTER_API_KEY!, keyword, size: String(size), classificationName: "music", sort: "date,asc" });
  const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params.toString()}`, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Ticketmaster Discovery API responded ${res.status}`);
  const json = (await res.json()) as {
    _embedded?: { events?: { id: string; name: string; url?: string; dates?: { start?: { dateTime?: string; localDate?: string } }; images?: { url: string; width: number }[]; _embedded?: { venues?: { name?: string; city?: { name?: string }; state?: { stateCode?: string }; country?: { countryCode?: string } }[] } }[] };
  };
  const events = (json._embedded?.events ?? []).map((e) => {
    const v = e._embedded?.venues?.[0];
    const img = (e.images ?? []).sort((a, b) => b.width - a.width)[0];
    return {
      id: e.id,
      name: e.name,
      url: e.url ?? null,
      startsAt: e.dates?.start?.dateTime ?? e.dates?.start?.localDate ?? null,
      venue: v?.name ?? null,
      city: v?.city?.name ?? null,
      region: v?.state?.stateCode ?? null,
      country: v?.country?.countryCode ?? null,
      imageUrl: img?.url ?? null,
    };
  });
  return { events, live: true };
}
