import { z } from "zod";

export const EVENT_SOURCES = [
  "instagram",
  "shopify",
  "superfan",
  "csv",
  "spotify",
  "tiktok",
  "ticketmaster",
  "manual",
] as const;
export type EventSource = (typeof EVENT_SOURCES)[number];

export const VERIFICATIONS = ["verified", "self_reported", "artist_verified", "imported"] as const;
export type Verification = (typeof VERIFICATIONS)[number];

export const IDENTITY_PROVIDERS = [
  "email",
  "phone",
  "instagram",
  "shopify",
  "spotify",
  "tiktok",
  "ticketmaster",
  "discord",
] as const;
export type IdentityProvider = (typeof IDENTITY_PROVIDERS)[number];

/** Known event types. Integrations may emit others; unknown types are stored but not scored. */
export const EVENT_TYPES = {
  instagramComment: "instagram.comment.created",
  instagramDm: "instagram.dm.received",
  instagramMention: "instagram.mention.created",

  shopifyOrderCreated: "shopify.order.created",
  shopifyOrderRefunded: "shopify.order.refunded",

  eventCheckedIn: "event.checked_in",
  eventAttendanceImported: "event.attendance_imported",

  fanSignup: "fan.signup",
  fanJoined: "fan.joined",
  fanReferralCompleted: "fan.referral.completed",
  fanLevelReached: "fan.level_reached",
  fanBadgeEarned: "fan.badge_earned",
  fanIdentityClaimed: "fan.identity_claimed",

  challengeCompleted: "challenge.completed",
  rewardRedeemed: "reward.redeemed",
  promoCodeEntered: "promo_code.entered",

  spotifyArtistTop: "spotify.artist_top",
  spotifyRecentPlay: "spotify.recent_play_observed",
  /** Weekly roll-up of a fan's plays of the artist's catalogue. */
  spotifyStream: "spotify.stream",
  tiktokConnected: "tiktok.connected",

  csvMerchPurchase: "csv.merch_purchase",
  csvTicketPurchase: "csv.ticket_purchase",
  csvFanImported: "csv.fan_imported",

  manualScoreAdjustment: "manual.score_adjustment",
  manualAttendanceVerified: "manual.attendance_verified",
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES] | (string & {});

/**
 * The universal normalized event that every adapter produces and the
 * ingestion service consumes. Exactly one of fanId / identity / email / phone
 * should be present to resolve the actor; if none resolve, the event is
 * stored against the identity only.
 */
export const fanEventInputSchema = z.object({
  artistId: z.string().uuid(),
  source: z.enum(EVENT_SOURCES),
  type: z.string().min(1).max(120),
  /** Provider event id. When absent, a deterministic hash is generated. */
  sourceEventId: z.string().min(1).max(255).optional(),
  occurredAt: z.coerce.date().optional(),
  verification: z.enum(VERIFICATIONS).default("verified"),
  metadata: z.record(z.string(), z.unknown()).default({}),
  summary: z.string().max(300).optional(),

  fanId: z.string().uuid().optional(),
  email: z.string().email().optional(),
  phone: z.string().min(5).max(32).optional(),
  identity: z
    .object({
      provider: z.enum(IDENTITY_PROVIDERS),
      externalUserId: z.string().min(1).max(255),
      username: z.string().max(255).optional(),
      displayName: z.string().max(255).optional(),
      avatarUrl: z.string().url().optional(),
      /** Whether the provider vouches for this identity (e.g. Shopify customer email). */
      verified: z.boolean().default(true),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  /** Profile hints used when a new fan has to be created. */
  profile: z
    .object({
      firstName: z.string().max(120).optional(),
      lastName: z.string().max(120).optional(),
      city: z.string().max(120).optional(),
      region: z.string().max(120).optional(),
      country: z.string().max(120).optional(),
      avatarUrl: z.string().url().optional(),
    })
    .optional(),
});

export type FanEventInput = z.input<typeof fanEventInputSchema>;
export type ParsedFanEventInput = z.output<typeof fanEventInputSchema>;

/** Public shape of a stored event (mirrors the PRD's FanEvent type). */
export type FanEvent = {
  id: string;
  artistId: string;
  fanId?: string | null;
  externalIdentityId?: string | null;
  source: EventSource;
  type: string;
  sourceEventId?: string | null;
  occurredAt: string;
  metadata: Record<string, unknown>;
  verification: Verification;
  summary?: string | null;
  createdAt: string;
};

/** Providers whose external ids are scoped to the artist's own account. */
export const ARTIST_SCOPED_PROVIDERS: ReadonlySet<IdentityProvider> = new Set([
  "instagram",
  "shopify",
  "ticketmaster",
]);
