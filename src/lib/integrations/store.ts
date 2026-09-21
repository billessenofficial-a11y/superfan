import { and, eq } from "drizzle-orm";
import { db as defaultDb, type DbOrTx } from "@/db";
import { integrations } from "@/db/schema";
import { audit, track } from "@/lib/audit";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import type { ConnectedAccount, IntegrationProvider, IntegrationRow, IntegrationStatus } from "./types";

export async function getIntegration(artistId: string, provider: IntegrationProvider, conn: DbOrTx = defaultDb) {
  const [row] = await conn
    .select()
    .from(integrations)
    .where(and(eq(integrations.artistId, artistId), eq(integrations.provider, provider)))
    .limit(1);
  return row ?? null;
}

export async function listIntegrations(artistId: string, conn: DbOrTx = defaultDb) {
  return conn.select().from(integrations).where(eq(integrations.artistId, artistId));
}

/** Decrypted access token for server-side API calls. Never send to the client. */
export function accessTokenOf(row: IntegrationRow): string | null {
  return row.accessTokenEncrypted ? decryptSecret(row.accessTokenEncrypted) : null;
}

export function refreshTokenOf(row: IntegrationRow): string | null {
  return row.refreshTokenEncrypted ? decryptSecret(row.refreshTokenEncrypted) : null;
}

export async function saveConnectedAccount(
  input: {
    artistId: string;
    provider: IntegrationProvider;
    account: ConnectedAccount;
    isMock: boolean;
    connectedByUserId: string | null;
  },
  conn: DbOrTx = defaultDb,
) {
  const values = {
    artistId: input.artistId,
    provider: input.provider,
    status: "connected" as IntegrationStatus,
    externalAccountId: input.account.externalAccountId,
    externalAccountName: input.account.externalAccountName,
    accessTokenEncrypted: input.account.accessToken ? encryptSecret(input.account.accessToken) : null,
    refreshTokenEncrypted: input.account.refreshToken ? encryptSecret(input.account.refreshToken) : null,
    tokenExpiresAt: input.account.tokenExpiresAt ?? null,
    scopes: input.account.scopes ?? [],
    settings: input.account.settings ?? {},
    isMock: input.isMock,
    lastError: null,
    connectedByUserId: input.connectedByUserId,
    connectedAt: new Date(),
  };
  const [row] = await conn
    .insert(integrations)
    .values(values)
    .onConflictDoUpdate({ target: [integrations.artistId, integrations.provider], set: values })
    .returning();

  await audit(conn, {
    artistId: input.artistId,
    actorUserId: input.connectedByUserId,
    action: "integration.connected",
    targetType: "integration",
    targetId: row.id,
    metadata: { provider: input.provider, account: input.account.externalAccountName, mock: input.isMock },
  });
  await track(conn, "integration_connected", { artistId: input.artistId, userId: input.connectedByUserId }, { provider: input.provider, mock: input.isMock });
  return row;
}

export async function setIntegrationStatus(
  id: string,
  patch: { status: IntegrationStatus; lastError?: string | null; lastSyncedAt?: Date; lastEventAt?: Date },
  conn: DbOrTx = defaultDb,
) {
  const [row] = await conn.update(integrations).set(patch).where(eq(integrations.id, id)).returning();
  return row ?? null;
}

export async function touchIntegrationEvent(artistId: string, provider: IntegrationProvider, conn: DbOrTx = defaultDb) {
  await conn
    .update(integrations)
    .set({ lastEventAt: new Date() })
    .where(and(eq(integrations.artistId, artistId), eq(integrations.provider, provider)));
}

export async function markDisconnected(
  input: { artistId: string; provider: IntegrationProvider; actorUserId: string | null },
  conn: DbOrTx = defaultDb,
) {
  const [row] = await conn
    .update(integrations)
    .set({
      status: "disconnected",
      accessTokenEncrypted: null,
      refreshTokenEncrypted: null,
      tokenExpiresAt: null,
      lastError: null,
    })
    .where(and(eq(integrations.artistId, input.artistId), eq(integrations.provider, input.provider)))
    .returning();
  if (row) {
    await audit(conn, {
      artistId: input.artistId,
      actorUserId: input.actorUserId,
      action: "integration.disconnected",
      targetType: "integration",
      targetId: row.id,
      metadata: { provider: input.provider },
    });
  }
  return row ?? null;
}

/** Human-readable explanation for each integration state (never "Error 400"). */
export function describeStatus(provider: IntegrationProvider, status: IntegrationStatus, lastError?: string | null) {
  const names: Record<IntegrationProvider, string> = {
    instagram: "Instagram",
    shopify: "Shopify",
    spotify: "Spotify",
    tiktok: "TikTok",
    ticketmaster: "Ticketmaster",
  };
  const name = names[provider];
  switch (status) {
    case "connected":
      return { title: "Connected", detail: "Events are flowing into Superfan.", tone: "success" as const };
    case "syncing":
      return { title: "Syncing", detail: `Importing recent activity from ${name}.`, tone: "info" as const };
    case "action_required":
      return { title: "Action required", detail: lastError ?? `${name} needs additional permissions.`, tone: "warning" as const };
    case "expired":
      return {
        title: `${name} needs to be reconnected`,
        detail: provider === "instagram" ? "Meta has expired the account authorization." : `The ${name} authorization has expired.`,
        tone: "warning" as const,
      };
    case "rate_limited":
      return { title: "Rate limited", detail: `${name} is throttling requests. Syncing will resume automatically.`, tone: "warning" as const };
    case "failed":
      return { title: "Sync failed", detail: lastError ?? `The last sync with ${name} did not complete.`, tone: "danger" as const };
    case "disconnected":
    default:
      return { title: "Not connected", detail: `Connect ${name} to start capturing activity.`, tone: "neutral" as const };
  }
}
