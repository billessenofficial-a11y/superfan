import { env, features } from "@/lib/env";
import { EVENT_TYPES, type FanEventInput } from "@/lib/events/types";
import type {
  AuthorizationContext,
  CallbackContext,
  ConnectedAccount,
  IntegrationAdapter,
  IntegrationRow,
  ProviderAvailability,
  WebhookContext,
} from "./types";

const GRAPH_VERSION = "v21.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

/** Scopes needed to read comments, messages and mentions on the artist's professional account. */
export const INSTAGRAM_SCOPES = [
  "instagram_basic",
  "instagram_manage_comments",
  "instagram_manage_messages",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_metadata",
];

/**
 * Instagram (via Meta Graph API) — artist professional account.
 *
 * Captures direct interactions with the artist's own account: comments on
 * the artist's media, DMs to the account (where permitted) and mentions.
 * It never tracks a fan's likes, views or unrelated Instagram activity; the
 * platform does not expose that and Superfan does not want it.
 */
export const instagramAdapter: IntegrationAdapter = {
  provider: "instagram",
  displayName: "Instagram",
  description: "Comments, messages and mentions on your professional account.",
  capabilities: ["Comments on your posts & Reels", "Direct messages to your account", "Mentions of your account"],
  doesNotTrack: ["Posts a fan likes", "Reels a fan watches", "Any activity outside your account"],

  availability(): ProviderAvailability {
    if (features.instagram) {
      return { mode: "live", experimental: false, scope: "artist", note: "Connect an Instagram Professional account via Meta." };
    }
    return {
      mode: "mock",
      experimental: false,
      scope: "artist",
      note: "META_APP_ID / META_APP_SECRET are not configured. A mock account can be connected to demo live comment ingestion.",
    };
  },

  getAuthorizationUrl(ctx: AuthorizationContext) {
    if (!features.instagram) return null;
    const params = new URLSearchParams({
      client_id: env.META_APP_ID!,
      redirect_uri: ctx.redirectUri,
      state: ctx.state,
      scope: INSTAGRAM_SCOPES.join(","),
      response_type: "code",
    });
    return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
  },

  async handleCallback(ctx: CallbackContext): Promise<ConnectedAccount> {
    if (!features.instagram) throw new Error("Instagram is not configured");
    // 1. short-lived user token
    const tokenRes = await fetch(
      `${GRAPH}/oauth/access_token?${new URLSearchParams({
        client_id: env.META_APP_ID!,
        client_secret: env.META_APP_SECRET!,
        redirect_uri: ctx.redirectUri,
        code: ctx.code,
      })}`,
    );
    const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: { message: string } };
    if (!tokenJson.access_token) throw new Error(tokenJson.error?.message ?? "Meta did not return an access token");

    // 2. exchange for a long-lived token (~60 days)
    const longRes = await fetch(
      `${GRAPH}/oauth/access_token?${new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: env.META_APP_ID!,
        client_secret: env.META_APP_SECRET!,
        fb_exchange_token: tokenJson.access_token,
      })}`,
    );
    const longJson = (await longRes.json()) as { access_token?: string; expires_in?: number };
    const userToken = longJson.access_token ?? tokenJson.access_token;

    // 3. find the page + linked Instagram business account
    const pagesRes = await fetch(`${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,profile_picture_url}&access_token=${userToken}`);
    const pages = (await pagesRes.json()) as {
      data?: { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username: string; profile_picture_url?: string } }[];
    };
    const page = pages.data?.find((p) => p.instagram_business_account);
    if (!page?.instagram_business_account) {
      throw new Error("No Instagram Professional account is linked to your Facebook Pages. Link one in Instagram settings, then reconnect.");
    }

    return {
      externalAccountId: page.instagram_business_account.id,
      externalAccountName: `@${page.instagram_business_account.username}`,
      accessToken: page.access_token, // page token is what the IG APIs use
      tokenExpiresAt: longJson.expires_in ? new Date(Date.now() + longJson.expires_in * 1000) : null,
      scopes: INSTAGRAM_SCOPES,
      settings: { pageId: page.id, pageName: page.name, avatarUrl: page.instagram_business_account.profile_picture_url ?? null },
    };
  },

  async afterConnect(_integration: IntegrationRow, account: ConnectedAccount) {
    if (!features.instagram || !account.accessToken) return;
    const pageId = String(account.settings?.pageId ?? "");
    if (!pageId) return;
    // Subscribe the page to Instagram webhook fields. The app-level webhook
    // (callback URL + verify token) is configured once in the Meta dashboard.
    await fetch(`${GRAPH}/${pageId}/subscribed_apps`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ subscribed_fields: "comments,mentions,messages", access_token: account.accessToken }),
    }).catch(() => undefined);
  },

  async mockConnect(): Promise<ConnectedAccount> {
    return {
      externalAccountId: "17841400000000001",
      externalAccountName: "@lumavale",
      scopes: INSTAGRAM_SCOPES,
      settings: { pageName: "Luma Vale", mock: true },
    };
  },

  async disconnect() {
    // Tokens are wiped by the store; Meta permissions can be revoked by the user in Facebook settings.
  },

  /**
   * Normalize a Meta webhook payload for the `instagram` object into events.
   * Handles `changes` (comments, mentions) and `messaging` (DMs).
   */
  async normalizeWebhook(payload: unknown, ctx: WebhookContext): Promise<FanEventInput[]> {
    const body = payload as MetaWebhookBody;
    if (body?.object !== "instagram" || !Array.isArray(body.entry)) return [];
    const artistAccountId = ctx.integration?.externalAccountId ?? null;
    const out: FanEventInput[] = [];

    for (const entry of body.entry) {
      for (const change of entry.changes ?? []) {
        const v = change.value ?? {};
        if (change.field === "comments" && v.from?.id && v.id) {
          if (artistAccountId && v.from.id === artistAccountId) continue; // artist replying to fans
          out.push({
            artistId: ctx.artistId,
            source: "instagram",
            type: EVENT_TYPES.instagramComment,
            sourceEventId: `comment:${v.id}`,
            occurredAt: entry.time ? new Date(entry.time * 1000) : new Date(),
            identity: { provider: "instagram", externalUserId: v.from.id, username: v.from.username, displayName: v.from.username },
            metadata: { commentId: v.id, mediaId: v.media?.id ?? null, mediaType: v.media?.media_product_type ?? null, text: v.text ?? "", parentId: v.parent_id ?? null },
            summary: v.media?.media_product_type === "REELS" ? "Commented on an Instagram Reel" : "Commented on an Instagram post",
          });
        }
        if (change.field === "mentions" && v.comment_id && v.media_id) {
          // Mentions payloads do not carry the commenter reliably; the resolver
          // will attach the identity when the comment webhook arrives.
          out.push({
            artistId: ctx.artistId,
            source: "instagram",
            type: EVENT_TYPES.instagramMention,
            sourceEventId: `mention:${v.comment_id}`,
            occurredAt: entry.time ? new Date(entry.time * 1000) : new Date(),
            identity: v.from?.id ? { provider: "instagram", externalUserId: v.from.id, username: v.from.username } : undefined,
            metadata: { commentId: v.comment_id, mediaId: v.media_id },
            summary: "Mentioned the artist on Instagram",
          });
        }
      }
      for (const msg of entry.messaging ?? []) {
        const senderId = msg.sender?.id;
        if (!senderId || !msg.message?.mid) continue;
        if (artistAccountId && senderId === artistAccountId) continue;
        if (msg.message.is_echo) continue;
        out.push({
          artistId: ctx.artistId,
          source: "instagram",
          type: EVENT_TYPES.instagramDm,
          sourceEventId: `dm:${msg.message.mid}`,
          occurredAt: msg.timestamp ? new Date(msg.timestamp) : new Date(),
          identity: { provider: "instagram", externalUserId: senderId },
          // Deliberately store only that a message happened, not its content.
          metadata: { messageId: msg.message.mid, hasAttachments: Boolean(msg.message.attachments?.length) },
          summary: "Sent a direct message",
        });
      }
    }
    return out.filter((e) => e.identity || e.type === EVENT_TYPES.instagramMention);
  },
};

type MetaWebhookBody = {
  object?: string;
  entry?: {
    id?: string;
    time?: number;
    changes?: {
      field?: string;
      value?: {
        id?: string;
        text?: string;
        parent_id?: string;
        from?: { id?: string; username?: string };
        media?: { id?: string; media_product_type?: string };
        comment_id?: string;
        media_id?: string;
      };
    }[];
    messaging?: {
      sender?: { id?: string };
      recipient?: { id?: string };
      timestamp?: number;
      message?: { mid?: string; text?: string; is_echo?: boolean; attachments?: unknown[] };
    }[];
  }[];
};

/**
 * Reply to a comment via the Graph API (used by "Comment VIP to join" campaigns).
 * Only works with a live connection; the mock adapter logs instead.
 */
export async function replyToInstagramComment(integration: IntegrationRow, accessToken: string | null, commentId: string, message: string) {
  if (integration.isMock || !accessToken) {
    console.info(`[instagram:mock] reply to ${commentId}: ${message}`);
    return { ok: true, mock: true };
  }
  const res = await fetch(`${GRAPH}/${commentId}/replies`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ message, access_token: accessToken }),
  });
  return { ok: res.ok, mock: false };
}
