import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { oauthStates } from "@/db/schema";
import { track } from "@/lib/audit";
import { randomToken } from "@/lib/crypto";
import { appUrl } from "@/lib/env";
import { getAdapter } from "./registry";
import { getIntegration, markDisconnected, saveConnectedAccount, setIntegrationStatus } from "./store";
import type { IntegrationProvider } from "./types";

export class IntegrationError extends Error {
  constructor(
    public readonly code: "unknown_provider" | "not_available" | "invalid_state" | "callback_failed" | "not_connected",
    message: string,
  ) {
    super(message);
    this.name = "IntegrationError";
  }
}

export function callbackUrl(provider: IntegrationProvider) {
  return appUrl(`/api/integrations/${provider}/callback`);
}

/**
 * Begin connecting a provider for an artist. Returns either a redirect URL
 * (live OAuth) or completes a mock connection immediately.
 */
export async function startConnect(input: {
  artistId: string;
  provider: IntegrationProvider;
  userId: string;
  params?: Record<string, string>;
}): Promise<{ kind: "redirect"; url: string } | { kind: "connected"; mock: boolean }> {
  const adapter = getAdapter(input.provider);
  if (!adapter) throw new IntegrationError("unknown_provider", "Unknown provider.");
  const availability = adapter.availability();
  await track(db, "integration_started", { artistId: input.artistId, userId: input.userId }, { provider: input.provider, mode: availability.mode });

  if (availability.mode === "live" && adapter.getAuthorizationUrl) {
    const state = randomToken(24);
    const codeVerifier = randomToken(32);
    await db.insert(oauthStates).values({
      artistId: input.artistId,
      userId: input.userId,
      provider: input.provider,
      state,
      codeVerifier,
      metadata: input.params ?? {},
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });
    const url = adapter.getAuthorizationUrl({ artistId: input.artistId, state, redirectUri: callbackUrl(input.provider), params: input.params, codeVerifier });
    if (!url) throw new IntegrationError("not_available", "This provider needs more information to connect (e.g. a shop domain).");
    return { kind: "redirect", url };
  }

  if (availability.mode === "mock" && adapter.mockConnect) {
    const account = await adapter.mockConnect(input.artistId);
    await saveConnectedAccount({ artistId: input.artistId, provider: input.provider, account, isMock: true, connectedByUserId: input.userId });
    await adapter.seedSample?.(input.artistId);
    return { kind: "connected", mock: true };
  }

  throw new IntegrationError("not_available", availability.note);
}

/** Complete an OAuth callback. The state is single-use and bound to the artist. */
export async function completeConnect(input: { provider: IntegrationProvider; state: string; code: string; params?: Record<string, string> }) {
  const adapter = getAdapter(input.provider);
  if (!adapter?.handleCallback) throw new IntegrationError("unknown_provider", "Unknown provider.");
  const [state] = await db
    .select()
    .from(oauthStates)
    .where(and(eq(oauthStates.state, input.state), eq(oauthStates.provider, input.provider), gt(oauthStates.expiresAt, new Date())))
    .limit(1);
  if (!state) throw new IntegrationError("invalid_state", "This connection attempt expired. Please try again.");
  await db.delete(oauthStates).where(eq(oauthStates.id, state.id));

  try {
    const account = await adapter.handleCallback({
      artistId: state.artistId,
      state: state.state,
      code: input.code,
      redirectUri: callbackUrl(input.provider),
      params: { ...(state.metadata as Record<string, string>), ...(input.params ?? {}) },
      codeVerifier: state.codeVerifier ?? undefined,
    });
    const row = await saveConnectedAccount({ artistId: state.artistId, provider: input.provider, account, isMock: false, connectedByUserId: state.userId });
    await adapter.afterConnect?.(row, account);
    return { artistId: state.artistId, integration: row };
  } catch (err) {
    throw new IntegrationError("callback_failed", err instanceof Error ? err.message : "The provider rejected the connection.");
  }
}

export async function disconnectProvider(input: { artistId: string; provider: IntegrationProvider; userId: string }) {
  const adapter = getAdapter(input.provider);
  const existing = await getIntegration(input.artistId, input.provider);
  if (!existing) throw new IntegrationError("not_connected", "Not connected.");
  await adapter?.disconnect(existing);
  return markDisconnected({ artistId: input.artistId, provider: input.provider, actorUserId: input.userId });
}

export async function syncProvider(input: { artistId: string; provider: IntegrationProvider }) {
  const adapter = getAdapter(input.provider);
  const existing = await getIntegration(input.artistId, input.provider);
  if (!existing || existing.status === "disconnected") throw new IntegrationError("not_connected", "Not connected.");
  if (!adapter?.sync) return { produced: 0, duplicates: 0, note: "This provider is event-driven; nothing to sync." };
  await setIntegrationStatus(existing.id, { status: "syncing" });
  try {
    const result = await adapter.sync(existing);
    await setIntegrationStatus(existing.id, { status: "connected", lastSyncedAt: new Date(), lastError: null });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    const status = err instanceof Error && err.name === "ShopifyRateLimited" ? "rate_limited" : /401|403|expired|invalid.*token/i.test(message) ? "expired" : "failed";
    await setIntegrationStatus(existing.id, { status, lastError: message });
    throw err;
  }
}
