-- ─────────────────────────────────────────────────────────────
-- Superfan: helper functions, triggers and Row Level Security
--
-- The application server connects with a privileged role (Supabase
-- service role / database owner) and enforces tenancy in code by
-- deriving artist_id from the authenticated user's membership.
-- RLS is defense-in-depth for any access through PostgREST / the
-- Supabase client with a user JWT.
-- ─────────────────────────────────────────────────────────────

-- On plain Postgres (local dev, CI) the `auth` schema does not exist.
-- Create a compatible stub so policies compile. On Supabase the real
-- function already exists and is left untouched.
CREATE SCHEMA IF NOT EXISTS auth;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE AS $f$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $f$;
  END IF;
END $$;--> statement-breakpoint

-- ── updated_at maintenance ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;--> statement-breakpoint

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','artists','fans','artist_fans','fan_identities','score_rules',
    'challenges','rewards','artist_events','segments','campaigns','imports','integrations'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_set_updated_at ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
END $$;--> statement-breakpoint

-- ── membership helpers ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_artist_member(target_artist uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.artist_members m
    WHERE m.artist_id = target_artist AND m.user_id = auth.uid()
  )
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.current_fan_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.id FROM public.fans f WHERE f.user_id = auth.uid() AND f.merged_into_fan_id IS NULL LIMIT 1
$$;--> statement-breakpoint

-- ── ledger integrity ───────────────────────────────────────────
-- Ledgers are append-only: block UPDATE / DELETE at the database level.
-- The only permitted change is re-pointing fan_id during an explicit fan
-- merge (every other column must be untouched).
CREATE OR REPLACE FUNCTION public.reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND (to_jsonb(NEW) - 'fan_id') = (to_jsonb(OLD) - 'fan_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Table % is append-only', TG_TABLE_NAME;
END $$;--> statement-breakpoint

DROP TRIGGER IF EXISTS score_ledger_append_only ON public.score_ledger;--> statement-breakpoint
CREATE TRIGGER score_ledger_append_only BEFORE UPDATE OR DELETE ON public.score_ledger
  FOR EACH ROW EXECUTE FUNCTION public.reject_mutation();--> statement-breakpoint
DROP TRIGGER IF EXISTS reward_point_tx_append_only ON public.reward_point_transactions;--> statement-breakpoint
CREATE TRIGGER reward_point_tx_append_only BEFORE UPDATE OR DELETE ON public.reward_point_transactions
  FOR EACH ROW EXECUTE FUNCTION public.reject_mutation();--> statement-breakpoint

-- Inventory can never go negative.
ALTER TABLE public.rewards DROP CONSTRAINT IF EXISTS rewards_inventory_non_negative;--> statement-breakpoint
ALTER TABLE public.rewards ADD CONSTRAINT rewards_inventory_non_negative
  CHECK (inventory IS NULL OR inventory >= 0);--> statement-breakpoint
ALTER TABLE public.rewards DROP CONSTRAINT IF EXISTS rewards_redeemed_within_inventory;--> statement-breakpoint
ALTER TABLE public.rewards ADD CONSTRAINT rewards_redeemed_within_inventory
  CHECK (inventory IS NULL OR redeemed_count <= inventory);--> statement-breakpoint

-- A fan cannot refer themself.
ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS referrals_no_self_referral;--> statement-breakpoint
ALTER TABLE public.referrals ADD CONSTRAINT referrals_no_self_referral
  CHECK (referrer_fan_id <> referred_fan_id);--> statement-breakpoint

-- ── Row Level Security ─────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  -- Artist-owned tables: members of the artist can read; writes go through the
  -- server. Fans get scoped read access to their own rows where it makes sense.
  FOREACH t IN ARRAY ARRAY[
    'artist_fans','fan_identities','fan_notes','fan_tags','fan_tag_assignments',
    'fan_events','webhook_events','score_rules','score_ledger','score_snapshots',
    'reward_point_transactions','fan_levels','fan_badges','challenges',
    'challenge_completions','rewards','reward_redemptions','artist_events',
    'event_checkins','referrals','segments','campaigns','campaign_participants',
    'imports','import_rows','integrations','oauth_states','claim_tokens','audit_logs'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_member_select ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_member_select ON public.%I FOR SELECT USING (public.is_artist_member(artist_id))',
      t, t
    );
  END LOOP;
END $$;--> statement-breakpoint

-- Fan-visible rows (their own passport data).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'artist_fans','fan_events','score_ledger','reward_point_transactions','fan_badges',
    'challenge_completions','reward_redemptions','event_checkins'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_fan_select ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_fan_select ON public.%I FOR SELECT USING (fan_id = public.current_fan_id())',
      t, t
    );
  END LOOP;
END $$;--> statement-breakpoint

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS referrals_fan_select ON public.referrals;--> statement-breakpoint
CREATE POLICY referrals_fan_select ON public.referrals FOR SELECT
  USING (referrer_fan_id = public.current_fan_id());--> statement-breakpoint

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS users_self ON public.users;--> statement-breakpoint
CREATE POLICY users_self ON public.users FOR SELECT USING (id = auth.uid());--> statement-breakpoint

ALTER TABLE public.fans ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS fans_self ON public.fans;--> statement-breakpoint
CREATE POLICY fans_self ON public.fans FOR SELECT USING (user_id = auth.uid());--> statement-breakpoint
DROP POLICY IF EXISTS fans_member_select ON public.fans;--> statement-breakpoint
CREATE POLICY fans_member_select ON public.fans FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.artist_fans af WHERE af.fan_id = fans.id AND public.is_artist_member(af.artist_id))
);--> statement-breakpoint

ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS artists_public_read ON public.artists;--> statement-breakpoint
CREATE POLICY artists_public_read ON public.artists FOR SELECT USING (true);--> statement-breakpoint

ALTER TABLE public.artist_members ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS artist_members_self ON public.artist_members;--> statement-breakpoint
CREATE POLICY artist_members_self ON public.artist_members FOR SELECT
  USING (user_id = auth.uid() OR public.is_artist_member(artist_id));--> statement-breakpoint

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS badges_read ON public.badges;--> statement-breakpoint
CREATE POLICY badges_read ON public.badges FOR SELECT USING (true);--> statement-breakpoint

ALTER TABLE public.artist_invites ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.auth_magic_links ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
