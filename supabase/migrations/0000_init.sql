CREATE TYPE "public"."artist_event_status" AS ENUM('draft', 'upcoming', 'live', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."badge_rarity" AS ENUM('common', 'uncommon', 'rare', 'epic', 'legendary');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'scheduled', 'live', 'ended');--> statement-breakpoint
CREATE TYPE "public"."campaign_type" AS ENUM('challenge', 'reward_drop', 'vip_access', 'promo_code', 'fan_survey', 'event');--> statement-breakpoint
CREATE TYPE "public"."challenge_status" AS ENUM('draft', 'active', 'ended', 'archived');--> statement-breakpoint
CREATE TYPE "public"."challenge_type" AS ENUM('manual', 'quiz', 'referral', 'event_checkin', 'promo_code', 'link_visit', 'form_submission', 'purchase');--> statement-breakpoint
CREATE TYPE "public"."claim_token_status" AS ENUM('active', 'used', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."event_source" AS ENUM('instagram', 'shopify', 'superfan', 'csv', 'spotify', 'tiktok', 'ticketmaster', 'manual');--> statement-breakpoint
CREATE TYPE "public"."fulfillment_type" AS ENUM('digital', 'physical', 'access', 'lottery', 'manual');--> statement-breakpoint
CREATE TYPE "public"."identity_provider" AS ENUM('email', 'phone', 'instagram', 'shopify', 'spotify', 'tiktok', 'ticketmaster', 'discord');--> statement-breakpoint
CREATE TYPE "public"."import_row_status" AS ENUM('pending', 'imported', 'skipped', 'failed');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('pending', 'mapping', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."integration_provider" AS ENUM('instagram', 'shopify', 'spotify', 'tiktok', 'ticketmaster');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('connected', 'syncing', 'action_required', 'expired', 'rate_limited', 'failed', 'disconnected');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'admin', 'marketing', 'community', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."point_transaction_type" AS ENUM('CHECKIN', 'REFERRAL', 'CHALLENGE', 'PURCHASE', 'PROMO_CODE', 'SIGNUP', 'CAMPAIGN', 'REDEMPTION', 'REDEMPTION_REFUND', 'MANUAL_ADJUSTMENT');--> statement-breakpoint
CREATE TYPE "public"."redemption_status" AS ENUM('pending', 'fulfilled', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."referral_status" AS ENUM('pending', 'qualified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."reward_status" AS ENUM('draft', 'active', 'paused', 'ended', 'archived');--> statement-breakpoint
CREATE TYPE "public"."score_dimension" AS ENUM('engagement', 'commerce', 'attendance', 'advocacy', 'community', 'recency');--> statement-breakpoint
CREATE TYPE "public"."event_verification" AS ENUM('verified', 'self_reported', 'artist_verified', 'imported');--> statement-breakpoint
CREATE TYPE "public"."webhook_status" AS ENUM('received', 'processing', 'processed', 'failed');--> statement-breakpoint
CREATE TABLE "artist_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "member_role" DEFAULT 'viewer' NOT NULL,
	"invited_by_user_id" uuid,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artist_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" DEFAULT 'viewer' NOT NULL,
	"invited_by_user_id" uuid,
	"invited_email" text,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"genre" text,
	"country" text,
	"bio" text,
	"avatar_url" text,
	"banner_url" text,
	"accent_color" text DEFAULT '#8b5cf6' NOT NULL,
	"follower_count" integer DEFAULT 0 NOT NULL,
	"score_weights" jsonb DEFAULT '{"commerce":25,"attendance":25,"engagement":15,"advocacy":20,"community":15}'::jsonb NOT NULL,
	"score_targets" jsonb DEFAULT '{"commerce":2500,"attendance":2500,"engagement":1200,"advocacy":1500,"community":600}'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by_user_id" uuid,
	"onboarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"last_sign_in_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artist_fans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"fan_id" uuid NOT NULL,
	"superfan_score" integer DEFAULT 0 NOT NULL,
	"dimension_raw" jsonb DEFAULT '{"commerce":0,"attendance":0,"engagement":0,"advocacy":0,"community":0}'::jsonb NOT NULL,
	"dimension_scores" jsonb DEFAULT '{"commerce":0,"attendance":0,"engagement":0,"advocacy":0,"community":0,"recency":0}'::jsonb NOT NULL,
	"reward_points_cached" integer DEFAULT 0 NOT NULL,
	"level_id" uuid,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone,
	"joined_at" timestamp with time zone,
	"lifetime_spend_cents" integer DEFAULT 0 NOT NULL,
	"orders_count" integer DEFAULT 0 NOT NULL,
	"events_attended_count" integer DEFAULT 0 NOT NULL,
	"referrals_count" integer DEFAULT 0 NOT NULL,
	"instagram_interactions_count" integer DEFAULT 0 NOT NULL,
	"challenges_completed_count" integer DEFAULT 0 NOT NULL,
	"referral_code" text NOT NULL,
	"first_source" "event_source",
	"is_blocked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fan_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fan_id" uuid,
	"artist_id" uuid,
	"provider" "identity_provider" NOT NULL,
	"external_user_id" text NOT NULL,
	"username" text,
	"display_name" text,
	"avatar_url" text,
	"claimed" boolean DEFAULT false NOT NULL,
	"claimed_at" timestamp with time zone,
	"verified" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fan_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"fan_id" uuid NOT NULL,
	"author_user_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fan_tag_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"fan_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fan_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#a78bfa' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email" text,
	"email_verified_at" timestamp with time zone,
	"phone" text,
	"phone_verified_at" timestamp with time zone,
	"first_name" text,
	"last_name" text,
	"avatar_url" text,
	"city" text,
	"region" text,
	"country" text,
	"timezone" text,
	"consented_at" timestamp with time zone,
	"privacy_policy_version" text,
	"communication_preferences" jsonb DEFAULT '{"email":true,"sms":false}'::jsonb NOT NULL,
	"merged_into_fan_id" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fan_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"fan_id" uuid,
	"identity_id" uuid,
	"source" "event_source" NOT NULL,
	"type" text NOT NULL,
	"source_event_id" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"verification" "event_verification" DEFAULT 'verified' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"artist_id" uuid,
	"external_event_id" text,
	"topic" text,
	"payload" jsonb NOT NULL,
	"headers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "webhook_status" DEFAULT 'received' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"produced_event_count" integer DEFAULT 0 NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fan_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"name" text NOT NULL,
	"min_score" integer NOT NULL,
	"sort_order" integer NOT NULL,
	"color" text DEFAULT '#a78bfa' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_point_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"fan_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"transaction_type" "point_transaction_type" NOT NULL,
	"source_id" text,
	"description" text NOT NULL,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "score_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"fan_id" uuid NOT NULL,
	"event_id" uuid,
	"rule_id" uuid,
	"rule_key" text,
	"dimension" "score_dimension" NOT NULL,
	"points" integer NOT NULL,
	"reason" text NOT NULL,
	"actor_user_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "score_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"category" text NOT NULL,
	"dimension" "score_dimension" NOT NULL,
	"points" integer NOT NULL,
	"per_unit" boolean DEFAULT false NOT NULL,
	"cap_points" integer,
	"cap_window" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "score_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"fan_id" uuid NOT NULL,
	"snapshot_date" date NOT NULL,
	"score" integer NOT NULL,
	"level_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artist_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"venue" text,
	"city" text,
	"region" text,
	"country" text,
	"image_url" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"status" "artist_event_status" DEFAULT 'upcoming' NOT NULL,
	"checkin_opens_at" timestamp with time zone,
	"checkin_closes_at" timestamp with time zone,
	"checkin_points" integer DEFAULT 500 NOT NULL,
	"checkin_secret" text NOT NULL,
	"checkin_secret_rotated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"requires_staff_verification" boolean DEFAULT false NOT NULL,
	"ticketmaster_event_id" text,
	"capacity" integer,
	"checkins_count" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"icon" text DEFAULT 'award' NOT NULL,
	"rarity" "badge_rarity" DEFAULT 'common' NOT NULL,
	"criteria" jsonb DEFAULT '{"kind":"manual"}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challenge_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"challenge_id" uuid NOT NULL,
	"fan_id" uuid NOT NULL,
	"submission" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"points_awarded" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" "challenge_type" DEFAULT 'manual' NOT NULL,
	"status" "challenge_status" DEFAULT 'draft' NOT NULL,
	"points" integer DEFAULT 100 NOT NULL,
	"is_major" boolean DEFAULT false NOT NULL,
	"image_url" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"max_completions" integer,
	"campaign_id" uuid,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"fan_id" uuid NOT NULL,
	"verification" "event_verification" DEFAULT 'verified' NOT NULL,
	"method" text DEFAULT 'qr' NOT NULL,
	"verified_by_user_id" uuid,
	"checked_in_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fan_badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"fan_id" uuid NOT NULL,
	"badge_id" uuid NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"referrer_fan_id" uuid NOT NULL,
	"referred_fan_id" uuid NOT NULL,
	"status" "referral_status" DEFAULT 'pending' NOT NULL,
	"referral_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"qualified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reward_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"reward_id" uuid NOT NULL,
	"fan_id" uuid NOT NULL,
	"points_spent" integer NOT NULL,
	"status" "redemption_status" DEFAULT 'pending' NOT NULL,
	"fulfillment_note" text,
	"fulfilled_at" timestamp with time zone,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"image_url" text,
	"point_cost" integer NOT NULL,
	"inventory" integer,
	"redeemed_count" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"minimum_level_id" uuid,
	"minimum_score" integer,
	"location_restriction" text,
	"fulfillment_type" "fulfillment_type" DEFAULT 'digital' NOT NULL,
	"status" "reward_status" DEFAULT 'draft' NOT NULL,
	"max_per_fan" integer DEFAULT 1 NOT NULL,
	"campaign_id" uuid,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"fan_id" uuid NOT NULL,
	"response" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "campaign_type" NOT NULL,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"segment_id" uuid,
	"minimum_score" integer,
	"minimum_level_id" uuid,
	"capacity" integer,
	"participants_count" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"challenge_id" uuid,
	"reward_id" uuid,
	"event_id" uuid,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"artist_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"raw" jsonb NOT NULL,
	"status" "import_row_status" DEFAULT 'pending' NOT NULL,
	"fan_id" uuid,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"source_label" text,
	"status" "import_status" DEFAULT 'pending' NOT NULL,
	"mapping" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"headers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"processed_count" integer DEFAULT 0 NOT NULL,
	"imported_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_by_user_id" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"rules" jsonb NOT NULL,
	"cached_count" integer,
	"cached_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"artist_id" uuid,
	"user_id" uuid,
	"fan_id" uuid,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid,
	"actor_user_id" uuid,
	"actor_label" text,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_magic_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"redirect_to" text,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"identity_id" uuid NOT NULL,
	"provider" "identity_provider" NOT NULL,
	"token_hash" text NOT NULL,
	"status" "claim_token_status" DEFAULT 'active' NOT NULL,
	"claimed_by_fan_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"status" "integration_status" DEFAULT 'disconnected' NOT NULL,
	"external_account_id" text,
	"external_account_name" text,
	"access_token_encrypted" text,
	"refresh_token_encrypted" text,
	"token_expires_at" timestamp with time zone,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_mock" boolean DEFAULT false NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_event_at" timestamp with time zone,
	"last_error" text,
	"connected_by_user_id" uuid,
	"connected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"user_id" uuid,
	"provider" "integration_provider" NOT NULL,
	"state" text NOT NULL,
	"code_verifier" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artist_invites" ADD CONSTRAINT "artist_invites_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_invites" ADD CONSTRAINT "artist_invites_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_members" ADD CONSTRAINT "artist_members_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_members" ADD CONSTRAINT "artist_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_members" ADD CONSTRAINT "artist_members_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artists" ADD CONSTRAINT "artists_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_fans" ADD CONSTRAINT "artist_fans_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_fans" ADD CONSTRAINT "artist_fans_fan_id_fans_id_fk" FOREIGN KEY ("fan_id") REFERENCES "public"."fans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fan_identities" ADD CONSTRAINT "fan_identities_fan_id_fans_id_fk" FOREIGN KEY ("fan_id") REFERENCES "public"."fans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fan_identities" ADD CONSTRAINT "fan_identities_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fan_notes" ADD CONSTRAINT "fan_notes_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fan_notes" ADD CONSTRAINT "fan_notes_fan_id_fans_id_fk" FOREIGN KEY ("fan_id") REFERENCES "public"."fans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fan_notes" ADD CONSTRAINT "fan_notes_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fan_tag_assignments" ADD CONSTRAINT "fan_tag_assignments_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fan_tag_assignments" ADD CONSTRAINT "fan_tag_assignments_tag_id_fan_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."fan_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fan_tag_assignments" ADD CONSTRAINT "fan_tag_assignments_fan_id_fans_id_fk" FOREIGN KEY ("fan_id") REFERENCES "public"."fans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fan_tags" ADD CONSTRAINT "fan_tags_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fans" ADD CONSTRAINT "fans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fan_events" ADD CONSTRAINT "fan_events_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fan_events" ADD CONSTRAINT "fan_events_fan_id_fans_id_fk" FOREIGN KEY ("fan_id") REFERENCES "public"."fans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fan_events" ADD CONSTRAINT "fan_events_identity_id_fan_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."fan_identities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fan_levels" ADD CONSTRAINT "fan_levels_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_point_transactions" ADD CONSTRAINT "reward_point_transactions_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_point_transactions" ADD CONSTRAINT "reward_point_transactions_fan_id_fans_id_fk" FOREIGN KEY ("fan_id") REFERENCES "public"."fans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_point_transactions" ADD CONSTRAINT "reward_point_transactions_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_ledger" ADD CONSTRAINT "score_ledger_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_ledger" ADD CONSTRAINT "score_ledger_fan_id_fans_id_fk" FOREIGN KEY ("fan_id") REFERENCES "public"."fans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_ledger" ADD CONSTRAINT "score_ledger_event_id_fan_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."fan_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_ledger" ADD CONSTRAINT "score_ledger_rule_id_score_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."score_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_ledger" ADD CONSTRAINT "score_ledger_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_rules" ADD CONSTRAINT "score_rules_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_snapshots" ADD CONSTRAINT "score_snapshots_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_snapshots" ADD CONSTRAINT "score_snapshots_fan_id_fans_id_fk" FOREIGN KEY ("fan_id") REFERENCES "public"."fans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_events" ADD CONSTRAINT "artist_events_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_events" ADD CONSTRAINT "artist_events_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "badges" ADD CONSTRAINT "badges_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_completions" ADD CONSTRAINT "challenge_completions_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_completions" ADD CONSTRAINT "challenge_completions_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_completions" ADD CONSTRAINT "challenge_completions_fan_id_fans_id_fk" FOREIGN KEY ("fan_id") REFERENCES "public"."fans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_checkins" ADD CONSTRAINT "event_checkins_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_checkins" ADD CONSTRAINT "event_checkins_event_id_artist_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."artist_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_checkins" ADD CONSTRAINT "event_checkins_fan_id_fans_id_fk" FOREIGN KEY ("fan_id") REFERENCES "public"."fans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_checkins" ADD CONSTRAINT "event_checkins_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fan_badges" ADD CONSTRAINT "fan_badges_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fan_badges" ADD CONSTRAINT "fan_badges_fan_id_fans_id_fk" FOREIGN KEY ("fan_id") REFERENCES "public"."fans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fan_badges" ADD CONSTRAINT "fan_badges_badge_id_badges_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_fan_id_fans_id_fk" FOREIGN KEY ("referrer_fan_id") REFERENCES "public"."fans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_fan_id_fans_id_fk" FOREIGN KEY ("referred_fan_id") REFERENCES "public"."fans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_reward_id_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."rewards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_fan_id_fans_id_fk" FOREIGN KEY ("fan_id") REFERENCES "public"."fans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_participants" ADD CONSTRAINT "campaign_participants_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_participants" ADD CONSTRAINT "campaign_participants_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_participants" ADD CONSTRAINT "campaign_participants_fan_id_fans_id_fk" FOREIGN KEY ("fan_id") REFERENCES "public"."fans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_segment_id_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."segments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_fan_id_fans_id_fk" FOREIGN KEY ("fan_id") REFERENCES "public"."fans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segments" ADD CONSTRAINT "segments_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segments" ADD CONSTRAINT "segments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_fan_id_fans_id_fk" FOREIGN KEY ("fan_id") REFERENCES "public"."fans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_tokens" ADD CONSTRAINT "claim_tokens_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_tokens" ADD CONSTRAINT "claim_tokens_identity_id_fan_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."fan_identities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_tokens" ADD CONSTRAINT "claim_tokens_claimed_by_fan_id_fans_id_fk" FOREIGN KEY ("claimed_by_fan_id") REFERENCES "public"."fans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_connected_by_user_id_users_id_fk" FOREIGN KEY ("connected_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artist_invites_artist_idx" ON "artist_invites" USING btree ("artist_id");--> statement-breakpoint
CREATE UNIQUE INDEX "artist_invites_token_idx" ON "artist_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "artist_members_artist_user_idx" ON "artist_members" USING btree ("artist_id","user_id");--> statement-breakpoint
CREATE INDEX "artist_members_user_idx" ON "artist_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "artists_slug_idx" ON "artists" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "artist_fans_artist_fan_idx" ON "artist_fans" USING btree ("artist_id","fan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "artist_fans_referral_code_idx" ON "artist_fans" USING btree ("artist_id","referral_code");--> statement-breakpoint
CREATE INDEX "artist_fans_artist_score_idx" ON "artist_fans" USING btree ("artist_id","superfan_score");--> statement-breakpoint
CREATE INDEX "artist_fans_artist_last_active_idx" ON "artist_fans" USING btree ("artist_id","last_active_at");--> statement-breakpoint
CREATE INDEX "artist_fans_artist_level_idx" ON "artist_fans" USING btree ("artist_id","level_id");--> statement-breakpoint
CREATE INDEX "artist_fans_fan_idx" ON "artist_fans" USING btree ("fan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fan_identities_provider_external_artist_idx" ON "fan_identities" USING btree ("provider","external_user_id",coalesce("artist_id", '00000000-0000-0000-0000-000000000000'::uuid));--> statement-breakpoint
CREATE INDEX "fan_identities_fan_idx" ON "fan_identities" USING btree ("fan_id");--> statement-breakpoint
CREATE INDEX "fan_identities_artist_idx" ON "fan_identities" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "fan_identities_username_idx" ON "fan_identities" USING btree ("provider",lower("username"));--> statement-breakpoint
CREATE INDEX "fan_notes_artist_fan_idx" ON "fan_notes" USING btree ("artist_id","fan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fan_tag_assignments_tag_fan_idx" ON "fan_tag_assignments" USING btree ("tag_id","fan_id");--> statement-breakpoint
CREATE INDEX "fan_tag_assignments_artist_fan_idx" ON "fan_tag_assignments" USING btree ("artist_id","fan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fan_tags_artist_name_idx" ON "fan_tags" USING btree ("artist_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "fans_email_idx" ON "fans" USING btree (lower("email")) WHERE "fans"."email" is not null and "fans"."merged_into_fan_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "fans_phone_idx" ON "fans" USING btree ("phone") WHERE "fans"."phone" is not null and "fans"."merged_into_fan_id" is null;--> statement-breakpoint
CREATE INDEX "fans_user_idx" ON "fans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fans_name_idx" ON "fans" USING btree ("last_name","first_name");--> statement-breakpoint
CREATE UNIQUE INDEX "fan_events_idempotency_idx" ON "fan_events" USING btree ("artist_id","source","source_event_id");--> statement-breakpoint
CREATE INDEX "fan_events_artist_idx" ON "fan_events" USING btree ("artist_id","occurred_at");--> statement-breakpoint
CREATE INDEX "fan_events_fan_idx" ON "fan_events" USING btree ("fan_id","occurred_at");--> statement-breakpoint
CREATE INDEX "fan_events_type_idx" ON "fan_events" USING btree ("artist_id","type");--> statement-breakpoint
CREATE INDEX "fan_events_source_idx" ON "fan_events" USING btree ("artist_id","source");--> statement-breakpoint
CREATE INDEX "fan_events_identity_idx" ON "fan_events" USING btree ("identity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_provider_external_idx" ON "webhook_events" USING btree ("provider","external_event_id") WHERE "webhook_events"."external_event_id" is not null;--> statement-breakpoint
CREATE INDEX "webhook_events_status_idx" ON "webhook_events" USING btree ("status","received_at");--> statement-breakpoint
CREATE INDEX "webhook_events_artist_idx" ON "webhook_events" USING btree ("artist_id","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "fan_levels_artist_sort_idx" ON "fan_levels" USING btree ("artist_id","sort_order");--> statement-breakpoint
CREATE INDEX "fan_levels_artist_min_idx" ON "fan_levels" USING btree ("artist_id","min_score");--> statement-breakpoint
CREATE INDEX "reward_point_tx_artist_fan_idx" ON "reward_point_transactions" USING btree ("artist_id","fan_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reward_point_tx_source_idx" ON "reward_point_transactions" USING btree ("artist_id","transaction_type","source_id") WHERE "reward_point_transactions"."source_id" is not null and "reward_point_transactions"."transaction_type" <> 'MANUAL_ADJUSTMENT';--> statement-breakpoint
CREATE INDEX "score_ledger_artist_fan_idx" ON "score_ledger" USING btree ("artist_id","fan_id");--> statement-breakpoint
CREATE INDEX "score_ledger_event_idx" ON "score_ledger" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "score_ledger_rule_window_idx" ON "score_ledger" USING btree ("artist_id","fan_id","rule_key","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "score_rules_artist_key_idx" ON "score_rules" USING btree ("artist_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "score_snapshots_artist_fan_date_idx" ON "score_snapshots" USING btree ("artist_id","fan_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "artist_events_artist_starts_idx" ON "artist_events" USING btree ("artist_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "badges_artist_key_idx" ON "badges" USING btree (coalesce("artist_id", '00000000-0000-0000-0000-000000000000'::uuid),"key");--> statement-breakpoint
CREATE UNIQUE INDEX "challenge_completions_challenge_fan_idx" ON "challenge_completions" USING btree ("challenge_id","fan_id");--> statement-breakpoint
CREATE INDEX "challenge_completions_artist_fan_idx" ON "challenge_completions" USING btree ("artist_id","fan_id");--> statement-breakpoint
CREATE INDEX "challenges_artist_status_idx" ON "challenges" USING btree ("artist_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "event_checkins_event_fan_idx" ON "event_checkins" USING btree ("event_id","fan_id");--> statement-breakpoint
CREATE INDEX "event_checkins_artist_fan_idx" ON "event_checkins" USING btree ("artist_id","fan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fan_badges_artist_fan_badge_idx" ON "fan_badges" USING btree ("artist_id","fan_id","badge_id");--> statement-breakpoint
CREATE INDEX "fan_badges_artist_badge_idx" ON "fan_badges" USING btree ("artist_id","badge_id");--> statement-breakpoint
CREATE UNIQUE INDEX "referrals_artist_referred_idx" ON "referrals" USING btree ("artist_id","referred_fan_id");--> statement-breakpoint
CREATE INDEX "referrals_artist_referrer_idx" ON "referrals" USING btree ("artist_id","referrer_fan_id");--> statement-breakpoint
CREATE INDEX "reward_redemptions_artist_fan_idx" ON "reward_redemptions" USING btree ("artist_id","fan_id");--> statement-breakpoint
CREATE INDEX "reward_redemptions_reward_idx" ON "reward_redemptions" USING btree ("reward_id");--> statement-breakpoint
CREATE INDEX "rewards_artist_status_idx" ON "rewards" USING btree ("artist_id","status");--> statement-breakpoint
CREATE INDEX "campaign_participants_campaign_fan_idx" ON "campaign_participants" USING btree ("campaign_id","fan_id");--> statement-breakpoint
CREATE INDEX "campaigns_artist_status_idx" ON "campaigns" USING btree ("artist_id","status");--> statement-breakpoint
CREATE INDEX "import_rows_import_idx" ON "import_rows" USING btree ("import_id","row_number");--> statement-breakpoint
CREATE INDEX "imports_artist_idx" ON "imports" USING btree ("artist_id","created_at");--> statement-breakpoint
CREATE INDEX "segments_artist_idx" ON "segments" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "analytics_events_name_idx" ON "analytics_events" USING btree ("name","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_artist_idx" ON "audit_logs" USING btree ("artist_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_magic_links_hash_idx" ON "auth_magic_links" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "claim_tokens_hash_idx" ON "claim_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "claim_tokens_identity_idx" ON "claim_tokens" USING btree ("identity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integrations_artist_provider_idx" ON "integrations" USING btree ("artist_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_states_state_idx" ON "oauth_states" USING btree ("state");