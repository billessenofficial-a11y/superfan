import type { BadgeCriteria, ScoreDimensionWeights } from "@/db/schema";

export type ScoreDimension = "engagement" | "commerce" | "attendance" | "advocacy" | "community";
export type CapWindow = "day" | "week" | "month" | "lifetime";

export type DefaultScoreRule = {
  key: string;
  label: string;
  category: string;
  dimension: ScoreDimension;
  points: number;
  perUnit?: boolean;
  capPoints?: number;
  capWindow?: CapWindow;
};

/**
 * Default scoring rules. Cloned into `score_rules` for every new artist so
 * teams can tune them without affecting anyone else.
 */
export const DEFAULT_SCORE_RULES: DefaultScoreRule[] = [
  // Merch
  { key: "merch.first_purchase", label: "First purchase", category: "Merch", dimension: "commerce", points: 150 },
  { key: "merch.per_dollar", label: "Each $1 spent", category: "Merch", dimension: "commerce", points: 2, perUnit: true },
  { key: "merch.repeat_purchase", label: "Repeat purchase", category: "Merch", dimension: "commerce", points: 75 },

  // Concerts
  { key: "concert.ticket_purchase", label: "Verified ticket purchase", category: "Concerts", dimension: "attendance", points: 400 },
  { key: "concert.attendance", label: "Verified attendance", category: "Concerts", dimension: "attendance", points: 750 },
  { key: "concert.second", label: "Second concert", category: "Concerts", dimension: "attendance", points: 900 },
  { key: "concert.third_plus", label: "Third+ concert", category: "Concerts", dimension: "attendance", points: 1000 },

  // Instagram — passive engagement is capped hard so spam cannot mint superfans.
  { key: "instagram.first_comment", label: "First comment", category: "Instagram", dimension: "engagement", points: 20 },
  { key: "instagram.comment", label: "Meaningful comment", category: "Instagram", dimension: "engagement", points: 10, capPoints: 100, capWindow: "week" },
  { key: "instagram.dm", label: "DM interaction", category: "Instagram", dimension: "engagement", points: 20, capPoints: 60, capWindow: "week" },
  { key: "instagram.mention", label: "Mention", category: "Instagram", dimension: "engagement", points: 30, capPoints: 90, capWindow: "week" },

  // Referrals
  { key: "referral.successful", label: "Successful referral", category: "Referrals", dimension: "advocacy", points: 200 },

  // Challenges
  { key: "challenge.normal", label: "Normal challenge", category: "Challenges", dimension: "community", points: 100 },
  { key: "challenge.major", label: "Major challenge", category: "Challenges", dimension: "community", points: 250 },

  // Community
  { key: "community.signup", label: "Fan signup", category: "Community", dimension: "community", points: 50 },
  { key: "community.join", label: "Artist community join", category: "Community", dimension: "community", points: 100 },

  // Experimental providers (only fire when the integration is approved & connected).
  { key: "spotify.artist_top", label: "Artist appears in Spotify top artists", category: "Spotify", dimension: "engagement", points: 100, capPoints: 100, capWindow: "lifetime" },
  { key: "spotify.recent_play", label: "Streams (weekly roll-up)", category: "Spotify", dimension: "engagement", points: 5, capPoints: 25, capWindow: "week" },
  { key: "tiktok.connected", label: "Connected TikTok", category: "TikTok", dimension: "community", points: 10, capPoints: 10, capWindow: "lifetime" },
];

export const DEFAULT_WEIGHTS: ScoreDimensionWeights = {
  commerce: 25,
  attendance: 25,
  engagement: 15,
  advocacy: 20,
  community: 15,
};

/** Raw points at which the 0–100 sub-score maxes out. */
export const DEFAULT_TARGETS: ScoreDimensionWeights = {
  commerce: 2500,
  attendance: 2500,
  engagement: 1200,
  advocacy: 1500,
  community: 600,
};

export const DIMENSIONS: ScoreDimension[] = ["commerce", "attendance", "engagement", "advocacy", "community"];

export type DefaultLevel = { name: string; minScore: number; color: string };

export const DEFAULT_LEVELS: DefaultLevel[] = [
  { name: "Listener", minScore: 0, color: "#9ca3af" },
  { name: "Fan", minScore: 500, color: "#60a5fa" },
  { name: "Dedicated", minScore: 1500, color: "#34d399" },
  { name: "Superfan", minScore: 3500, color: "#f59e0b" },
  { name: "Icon", minScore: 7000, color: "#f472b6" },
];

export type DefaultBadge = {
  key: string;
  name: string;
  description: string;
  icon: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  criteria: BadgeCriteria;
};

/** System badges available to every artist. */
export const DEFAULT_BADGES: DefaultBadge[] = [
  { key: "first_show", name: "First Show", description: "Checked into your first show.", icon: "ticket", rarity: "common", criteria: { kind: "events_attended", count: 1 } },
  { key: "three_shows", name: "3 Shows", description: "Attended three shows.", icon: "music", rarity: "uncommon", criteria: { kind: "events_attended", count: 3 } },
  { key: "five_shows", name: "5 Shows", description: "Attended five shows.", icon: "flame", rarity: "rare", criteria: { kind: "events_attended", count: 5 } },
  { key: "ten_shows", name: "10 Shows", description: "Ten shows. You are part of the crew.", icon: "crown", rarity: "legendary", criteria: { kind: "events_attended", count: 10 } },
  { key: "tour_veteran", name: "Tour Veteran", description: "Attended two or more shows on tour.", icon: "map", rarity: "uncommon", criteria: { kind: "events_attended", count: 2 } },
  { key: "merch_collector", name: "Merch Collector", description: "Spent $150 or more on merch.", icon: "shopping-bag", rarity: "uncommon", criteria: { kind: "lifetime_spend_cents", amount: 15000 } },
  { key: "top_referrer", name: "Top Referrer", description: "Brought five friends into the fan club.", icon: "users", rarity: "rare", criteria: { kind: "referrals", count: 5 } },
  { key: "superfan_status", name: "Superfan", description: "Reached Superfan level.", icon: "star", rarity: "epic", criteria: { kind: "level_reached", levelSortOrder: 3 } },
];

export const POINTS_PER_DOLLAR_DEFAULT = 1;
export const SIGNUP_BONUS_POINTS = 50;
export const REFERRAL_POINTS_DEFAULT = 200;
