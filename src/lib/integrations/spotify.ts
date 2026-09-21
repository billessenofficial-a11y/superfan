import { env, features } from "@/lib/env";
import { EVENT_TYPES, type FanEventInput } from "@/lib/events/types";
import { seedSampleStreaming } from "@/lib/streaming/queries";
import type { AuthorizationContext, CallbackContext, ConnectedAccount, IntegrationAdapter, ProviderAvailability } from "./types";

export const SPOTIFY_SCOPES = ["user-top-read", "user-read-recently-played"];

/**
 * Spotify — experimental.
 *
 * Two halves, neither generally available yet:
 *
 *  1. Artist-level streaming metrics (streams, listeners, followers, top
 *     tracks). Spotify for Artists has no public API, so until a partner
 *     integration exists the adapter connects in mock mode and fills the
 *     `streaming_daily` table with clearly-labelled sample data. That lets
 *     the dashboard be designed and demoed against realistic shapes.
 *  2. Fan-level listening. Fans authorize Superfan to read their top artists
 *     and recently played tracks. In Development Mode an app can only
 *     authorize a handful of allow-listed users; Extended Quota requires an
 *     established, launched service.
 *
 * We never claim lifetime stream counts per fan; only "artist appears in
 * your top artists" and weekly play roll-ups are derived, both heavily capped
 * by the scoring rules.
 */
export const spotifyAdapter: IntegrationAdapter = {
  provider: "spotify",
  displayName: "Spotify",
  description: "Streams, listeners, followers and top tracks, plus verified listening from fans who link Spotify.",
  capabilities: ["Daily streams, listeners and followers", "Top tracks", "Artist appears in fan's top artists", "Weekly play roll-ups per linked fan"],
  doesNotTrack: ["Lifetime stream counts per fan", "Full listening history", "Playlists or library"],

  availability(): ProviderAvailability {
    if (features.spotify) {
      return { mode: "live", experimental: true, scope: "artist", note: "Configured. Fan linking is limited to users allow-listed in your Spotify app (Development Mode) or approved via Extended Quota. Artist metrics still need Spotify for Artists partner access." };
    }
    return {
      mode: "mock",
      experimental: true,
      scope: "artist",
      note: "Spotify for Artists has no public API yet. Connect in sample mode to see the streaming dashboard with generated data; live sync activates once partner access and SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET are in place.",
    };
  },

  async mockConnect(): Promise<ConnectedAccount> {
    return {
      externalAccountId: "spotify:artist:sample",
      externalAccountName: "Spotify for Artists (sample)",
      scopes: [],
      settings: { sample: true },
    };
  },

  async seedSample(artistId: string) {
    await seedSampleStreaming(artistId);
  },

  getAuthorizationUrl(ctx: AuthorizationContext) {
    if (!features.spotify) return null;
    const params = new URLSearchParams({
      client_id: env.SPOTIFY_CLIENT_ID!,
      response_type: "code",
      redirect_uri: ctx.redirectUri,
      state: ctx.state,
      scope: SPOTIFY_SCOPES.join(" "),
      ...(ctx.codeVerifier ? { code_challenge_method: "S256", code_challenge: ctx.codeVerifier } : {}),
    });
    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  },

  async handleCallback(ctx: CallbackContext): Promise<ConnectedAccount> {
    if (!features.spotify) throw new Error("Spotify is not configured");
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Basic ${Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString("base64")}`,
      },
      body: new URLSearchParams({ grant_type: "authorization_code", code: ctx.code, redirect_uri: ctx.redirectUri }),
    });
    const json = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string };
    if (!json.access_token) throw new Error(json.error_description ?? "Spotify did not return an access token");
    const me = (await (await fetch("https://api.spotify.com/v1/me", { headers: { authorization: `Bearer ${json.access_token}` } })).json()) as { id: string; display_name?: string; images?: { url: string }[] };
    return {
      externalAccountId: me.id,
      externalAccountName: me.display_name ?? me.id,
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      tokenExpiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
      scopes: SPOTIFY_SCOPES,
      settings: { avatarUrl: me.images?.[0]?.url ?? null },
    };
  },

  async disconnect() {},
};

/**
 * Derive affinity events for one fan from their Spotify data. Called by the
 * fan-side sync with a valid user access token.
 */
export async function spotifyAffinityEvents(input: {
  artistId: string;
  fanId: string;
  spotifyUserId: string;
  accessToken: string;
  /** The artist's Spotify artist id (artists.settings.spotifyArtistId). */
  spotifyArtistId: string | null;
  artistName: string;
}): Promise<FanEventInput[]> {
  const headers = { authorization: `Bearer ${input.accessToken}` };
  const out: FanEventInput[] = [];
  const matches = (a: { id?: string; name?: string }) =>
    (input.spotifyArtistId && a.id === input.spotifyArtistId) || (!input.spotifyArtistId && a.name?.toLowerCase() === input.artistName.toLowerCase());

  const top = (await (await fetch("https://api.spotify.com/v1/me/top/artists?limit=50&time_range=medium_term", { headers })).json()) as { items?: { id: string; name: string }[] };
  const rank = top.items?.findIndex(matches) ?? -1;
  if (rank >= 0) {
    const month = new Date().toISOString().slice(0, 7);
    out.push({
      artistId: input.artistId,
      fanId: input.fanId,
      source: "spotify",
      type: EVENT_TYPES.spotifyArtistTop,
      sourceEventId: `top:${input.spotifyUserId}:${month}`,
      verification: "verified",
      metadata: { rank: rank + 1, timeRange: "medium_term" },
      summary: "Artist appears in Spotify top artists",
    });
  }

  const recent = (await (await fetch("https://api.spotify.com/v1/me/player/recently-played?limit=50", { headers })).json()) as { items?: { played_at: string; track: { id: string; name: string; artists: { id: string; name: string }[] } }[] };
  for (const item of recent.items ?? []) {
    if (!item.track.artists.some(matches)) continue;
    out.push({
      artistId: input.artistId,
      fanId: input.fanId,
      source: "spotify",
      type: EVENT_TYPES.spotifyRecentPlay,
      sourceEventId: `play:${input.spotifyUserId}:${item.track.id}:${item.played_at}`,
      occurredAt: new Date(item.played_at),
      verification: "verified",
      metadata: { trackId: item.track.id, trackName: item.track.name },
      summary: `Listened to ${item.track.name}`,
    });
  }
  return out;
}
