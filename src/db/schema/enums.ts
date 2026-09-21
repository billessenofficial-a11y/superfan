import { pgEnum } from "drizzle-orm/pg-core";

export const eventSourceEnum = pgEnum("event_source", [
  "instagram",
  "shopify",
  "superfan",
  "csv",
  "spotify",
  "tiktok",
  "ticketmaster",
  "manual",
]);

export const verificationEnum = pgEnum("event_verification", [
  "verified",
  "self_reported",
  "artist_verified",
  "imported",
]);

export const memberRoleEnum = pgEnum("member_role", [
  "owner",
  "admin",
  "marketing",
  "community",
  "viewer",
]);

export const identityProviderEnum = pgEnum("identity_provider", [
  "email",
  "phone",
  "instagram",
  "shopify",
  "spotify",
  "tiktok",
  "ticketmaster",
  "discord",
]);

export const integrationProviderEnum = pgEnum("integration_provider", [
  "instagram",
  "shopify",
  "spotify",
  "tiktok",
  "ticketmaster",
]);

export const integrationStatusEnum = pgEnum("integration_status", [
  "connected",
  "syncing",
  "action_required",
  "expired",
  "rate_limited",
  "failed",
  "disconnected",
]);

export const webhookStatusEnum = pgEnum("webhook_status", [
  "received",
  "processing",
  "processed",
  "failed",
]);

export const scoreDimensionEnum = pgEnum("score_dimension", [
  "engagement",
  "commerce",
  "attendance",
  "advocacy",
  "community",
  "recency",
]);

export const pointTransactionTypeEnum = pgEnum("point_transaction_type", [
  "CHECKIN",
  "REFERRAL",
  "CHALLENGE",
  "PURCHASE",
  "PROMO_CODE",
  "SIGNUP",
  "CAMPAIGN",
  "REDEMPTION",
  "REDEMPTION_REFUND",
  "MANUAL_ADJUSTMENT",
]);

export const fulfillmentTypeEnum = pgEnum("fulfillment_type", [
  "digital",
  "physical",
  "access",
  "lottery",
  "manual",
]);

export const rewardStatusEnum = pgEnum("reward_status", [
  "draft",
  "active",
  "paused",
  "ended",
  "archived",
]);

export const redemptionStatusEnum = pgEnum("redemption_status", [
  "pending",
  "fulfilled",
  "cancelled",
]);

export const challengeTypeEnum = pgEnum("challenge_type", [
  "manual",
  "quiz",
  "referral",
  "event_checkin",
  "promo_code",
  "link_visit",
  "form_submission",
  "purchase",
]);

export const challengeStatusEnum = pgEnum("challenge_status", [
  "draft",
  "active",
  "ended",
  "archived",
]);

export const referralStatusEnum = pgEnum("referral_status", [
  "pending",
  "qualified",
  "rejected",
]);

export const campaignTypeEnum = pgEnum("campaign_type", [
  "challenge",
  "reward_drop",
  "vip_access",
  "promo_code",
  "fan_survey",
  "event",
]);

export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "scheduled",
  "live",
  "ended",
]);

export const artistEventStatusEnum = pgEnum("artist_event_status", [
  "draft",
  "upcoming",
  "live",
  "completed",
  "cancelled",
]);

export const importStatusEnum = pgEnum("import_status", [
  "pending",
  "mapping",
  "processing",
  "completed",
  "failed",
]);

export const importRowStatusEnum = pgEnum("import_row_status", [
  "pending",
  "imported",
  "skipped",
  "failed",
]);

export const badgeRarityEnum = pgEnum("badge_rarity", [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
]);

export const claimTokenStatusEnum = pgEnum("claim_token_status", [
  "active",
  "used",
  "revoked",
]);
