import type { integrations } from "@/db/schema";
import type { FanEventInput } from "@/lib/events/types";

export type IntegrationProvider = "instagram" | "shopify" | "spotify" | "tiktok" | "ticketmaster";
export type IntegrationRow = typeof integrations.$inferSelect;
export type IntegrationStatus = IntegrationRow["status"];

/**
 * How a provider can be used in this deployment, derived from configured
 * credentials and platform constraints.
 *
 *  - live: real OAuth + API calls
 *  - mock: realistic adapter that emits synthetic events (demo / dev)
 *  - unavailable: architecture exists but the provider cannot be used yet
 */
export type ProviderAvailability = {
  mode: "live" | "mock" | "unavailable";
  experimental: boolean;
  /** Human explanation shown on the Integrations page. */
  note: string;
  /** Who connects: the artist workspace or an individual fan. */
  scope: "artist" | "fan";
};

export type ConnectedAccount = {
  externalAccountId: string;
  externalAccountName: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date | null;
  scopes?: string[];
  settings?: Record<string, unknown>;
};

export type AuthorizationContext = {
  artistId: string;
  state: string;
  redirectUri: string;
  /** Provider-specific extra input, e.g. Shopify shop domain. */
  params?: Record<string, string>;
  codeVerifier?: string;
};

export type CallbackContext = AuthorizationContext & { code: string };

export type SyncResult = {
  produced: number;
  duplicates: number;
  note?: string;
};

export type WebhookContext = {
  integration: IntegrationRow | null;
  artistId: string;
  headers: Record<string, string>;
};

/**
 * Every provider implements this interface. Adapters only translate provider
 * data into normalized FanEvents; they never write scores or points.
 */
export interface IntegrationAdapter {
  readonly provider: IntegrationProvider;
  readonly displayName: string;
  readonly description: string;
  readonly capabilities: string[];
  readonly doesNotTrack: string[];

  availability(): ProviderAvailability;

  /** OAuth authorization URL, or null when the provider is not configured. */
  getAuthorizationUrl?(ctx: AuthorizationContext): string | null;
  /** Exchange an OAuth code for tokens + account info. */
  handleCallback?(ctx: CallbackContext): Promise<ConnectedAccount>;
  /** Called after an account is connected (register webhooks, first sync). */
  afterConnect?(integration: IntegrationRow, account: ConnectedAccount): Promise<void>;

  /** Mock connection used when credentials are absent (demo mode). */
  mockConnect?(artistId: string): Promise<ConnectedAccount>;

  disconnect(integration: IntegrationRow): Promise<void>;
  sync?(integration: IntegrationRow): Promise<SyncResult>;
  normalizeWebhook?(payload: unknown, ctx: WebhookContext): Promise<FanEventInput[]>;
}
