import { env, features } from "@/lib/env";
import { EVENT_TYPES, type FanEventInput } from "@/lib/events/types";
import type { AuthorizationContext, CallbackContext, ConnectedAccount, IntegrationAdapter, ProviderAvailability, WebhookContext } from "./types";

/** Only the basic profile scope is requested; more capabilities require TikTok approval. */
export const TIKTOK_SCOPES = ["user.info.basic"];

/**
 * TikTok — experimental, fan-scoped account link via Login Kit.
 *
 * Available data depends entirely on the scopes TikTok approves for the app.
 * Superfan does not claim access to watch history, liked videos or comment
 * history. Initial functionality is account linking only.
 */
export const tiktokAdapter: IntegrationAdapter = {
  provider: "tiktok",
  displayName: "TikTok",
  description: "Fans can link their TikTok account (basic profile).",
  capabilities: ["Basic profile (display name, avatar)", "Approved scopes only"],
  doesNotTrack: ["Watch history", "Liked videos", "Comment history"],

  availability(): ProviderAvailability {
    if (features.tiktok) return { mode: "live", experimental: true, scope: "fan", note: "Configured with basic profile scope. Additional capabilities depend on approved TikTok scopes." };
    return { mode: "unavailable", experimental: true, scope: "fan", note: "Available capabilities depend on approved TikTok scopes. Set TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET to enable account linking." };
  },

  getAuthorizationUrl(ctx: AuthorizationContext) {
    if (!features.tiktok) return null;
    const params = new URLSearchParams({
      client_key: env.TIKTOK_CLIENT_KEY!,
      response_type: "code",
      scope: TIKTOK_SCOPES.join(","),
      redirect_uri: ctx.redirectUri,
      state: ctx.state,
      ...(ctx.codeVerifier ? { code_challenge: ctx.codeVerifier, code_challenge_method: "S256" } : {}),
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
  },

  async handleCallback(ctx: CallbackContext): Promise<ConnectedAccount> {
    if (!features.tiktok) throw new Error("TikTok is not configured");
    const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: env.TIKTOK_CLIENT_KEY!,
        client_secret: env.TIKTOK_CLIENT_SECRET!,
        code: ctx.code,
        grant_type: "authorization_code",
        redirect_uri: ctx.redirectUri,
      }),
    });
    const json = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; open_id?: string; scope?: string; error_description?: string };
    if (!json.access_token || !json.open_id) throw new Error(json.error_description ?? "TikTok did not return an access token");
    const info = (await (
      await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url", { headers: { authorization: `Bearer ${json.access_token}` } })
    ).json()) as { data?: { user?: { display_name?: string; avatar_url?: string } } };
    return {
      externalAccountId: json.open_id,
      externalAccountName: info.data?.user?.display_name ?? json.open_id,
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      tokenExpiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
      scopes: json.scope?.split(",") ?? TIKTOK_SCOPES,
      settings: { avatarUrl: info.data?.user?.avatar_url ?? null },
    };
  },

  async disconnect() {},

  /**
   * TikTok webhook deliveries can arrive more than once; every event carries
   * an id used for idempotency. Only account-level events are handled for now.
   */
  async normalizeWebhook(payload: unknown, ctx: WebhookContext): Promise<FanEventInput[]> {
    const body = payload as { event?: string; client_key?: string; user_openid?: string; create_time?: number; content?: string };
    if (!body?.event || !body.user_openid) return [];
    if (body.event === "authorization.removed") {
      return [
        {
          artistId: ctx.artistId,
          source: "tiktok",
          type: "tiktok.authorization_removed",
          sourceEventId: `auth_removed:${body.user_openid}:${body.create_time ?? ""}`,
          identity: { provider: "tiktok", externalUserId: body.user_openid },
          metadata: {},
          summary: "Disconnected TikTok",
        },
      ];
    }
    return [];
  },
};

export function tiktokConnectedEvent(artistId: string, fanId: string, openId: string, displayName?: string): FanEventInput {
  return {
    artistId,
    fanId,
    source: "tiktok",
    type: EVENT_TYPES.tiktokConnected,
    sourceEventId: `connected:${openId}`,
    identity: { provider: "tiktok", externalUserId: openId, displayName },
    metadata: {},
    summary: "Connected TikTok",
  };
}
