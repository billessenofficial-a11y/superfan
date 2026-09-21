# Superfan

**Know your real fans.** Superfan is a B2B2C fan identity, intelligence, loyalty and rewards platform for music artists. It brings purchases, attendance, community and engagement together into one fan identity so artists can recognize and reward the people who care most — and gives every fan a collectible **Fan Passport**.

- **Artists** get a fan CRM: identified fans, Superfan Scores, levels, segments, activity, challenges, rewards, events with QR check-in, integrations and an audit trail.
- **Fans** get a passport per artist: level, Superfan Score, reward points, badges, challenges, rewards, check-ins, referrals and privacy controls.

> Product principle: we help artists recognize the people already showing up for them. Official APIs and first-party data only. No scraping.

---

## Table of contents

1. [Architecture](#architecture)
2. [Installation](#installation)
3. [Supabase setup](#supabase-setup)
4. [Database migrations](#database-migrations)
5. [Seed demo data](#seed-demo-data)
6. [Environment variables](#environment-variables)
7. [Running locally](#running-locally)
8. [Integration configuration](#integration-configuration)
9. [Webhook testing](#webhook-testing)
10. [Deployment to Vercel](#deployment-to-vercel)
11. [Known API limitations](#known-api-limitations)
12. [Enabling experimental providers](#enabling-experimental-providers)
13. [Tests](#tests)

---

## Architecture

```
Provider (Instagram / Shopify / CSV / Superfan native / Spotify / TikTok)
   ↓
Adapter                 src/lib/integrations/*.ts     (normalizeWebhook / sync)
   ↓
Normalized FanEvent     src/lib/events/types.ts
   ↓
Event store             ingestEvent() — src/lib/events/ingest.ts   (idempotent)
   ↓
Identity resolver       src/lib/identity/resolver.ts  (email > phone > provider id > shadow fan)
   ↓
Scoring engine          src/lib/scoring/engine.ts     (rules, caps, dimensions, levels)
   ↓
Fan profile             artist_fans (cached read model), score_ledger + reward_point_transactions (append-only)
```

**Stack:** Next.js 16 App Router · React 19 · TypeScript · Tailwind v4 · Drizzle ORM · PostgreSQL (Supabase) · Supabase Auth (magic links) · Resend · Recharts · Zod · Vitest.

**Key design decisions**

| Concern | Approach |
| --- | --- |
| Two separate systems | `score_ledger` (Superfan Score, not spendable) and `reward_point_transactions` (spendable points). Both append-only; caches on `artist_fans` are always derivable. |
| Idempotency | `fan_events` is unique on `(artist_id, source, source_event_id)`; a deterministic hash is generated when a provider has no event id. Raw webhooks are stored in `webhook_events` with `received → processing → processed/failed`. |
| Identity | One canonical `fans` row; many `fan_identities`. Matching priority: explicit claim → verified email → verified phone → provider-stable id → artist-approved manual merge. Never by name or fuzzy match. Unclaimed Instagram commenters get a **shadow fan** that merges into the real person when they claim via a signed link. |
| Scoring | Per-artist `score_rules` (cloned from defaults), per-rule caps (e.g. Instagram comments ≤100/week), five dimension sub-scores 0–100, weighted total, configurable levels. Refunds reverse the original order's score. |
| Multi-tenancy | Every artist-owned table carries `artist_id`. The server derives the active artist from the user's `artist_members` row (never from the browser). Row Level Security policies exist for Supabase client access; ledgers block `UPDATE`/`DELETE` at the DB level. |
| Auth | Supabase Auth magic links when configured; otherwise a built-in local magic-link provider (links print to the console) so the app runs with only Postgres. |
| Integrations | `IntegrationAdapter` interface; live OAuth when credentials exist, realistic **mock adapter** otherwise, feature flags derived from env. Never fakes production API access. |

**Repository layout**

```
src/app/            routes (marketing, /login, /onboarding, /app/** artist dashboard, /fan/** passport, /claim, /checkin, /api/webhooks/**)
src/lib/            domain logic (events, identity, scoring, points, rewards, challenges, referrals, checkins, claims, csv, integrations, segments, actions)
src/db/schema/      Drizzle schema (source of truth) → supabase/migrations/*.sql
src/components/     UI (ui primitives, dashboard, fans, programs, fan passport, marketing)
scripts/            migrate, seed, reset
tests/              Vitest integration tests against a real Postgres
```

---

## Installation

Requirements: Node 20+, PostgreSQL 15+ (local or Supabase).

```bash
git clone <repo> superfan && cd superfan
npm install
cp .env.example .env.local
```

With a local Postgres running on `localhost:5432` (user/password `postgres`), the defaults in `.env.example` work as-is:

```bash
createdb superfan
npm run db:setup      # migrate + seed demo data
npm run dev           # http://localhost:3000
```

Sign in at `/login`. In demo mode (`SUPERFAN_DEMO_MODE=true`, no Supabase) the login page offers one-click demo accounts:

- Artist dashboard → `maya@drake.demo`
- Fan passport → `james@superfan.demo`

Magic links for any other email print to the server console.

---

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. **Database** → copy the connection string (use the direct connection on port 5432 for migrations; the transaction pooler on 6543 works for the app) into `DATABASE_URL`.
3. **Project settings → API** → copy the URL and anon key into `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the service role key into `SUPABASE_SERVICE_ROLE_KEY` (server only).
4. **Authentication → URL configuration** → set Site URL to your app URL and add `https://<your-app>/auth/callback` to Redirect URLs.
5. **Authentication → Providers → Email** → enable, and configure Resend (or another SMTP provider) as the custom SMTP sender for production volume.
6. Run migrations (below). The RLS migration is Supabase-aware: it uses the existing `auth.uid()` on Supabase and creates a stub on plain Postgres.

Storage (avatars/banners) uses Supabase Storage when configured; the MVP accepts image URLs and ships with SVG demo art.

---

## Database migrations

Migrations live in `supabase/migrations/` and are generated from the Drizzle schema in `src/db/schema/`.

```bash
npm run db:migrate         # apply pending migrations (tracked in drizzle.__drizzle_migrations)
npm run db:generate        # after editing src/db/schema/*, generate a new SQL migration
npm run db:reset           # DEV ONLY: drop everything and re-apply
```

`0000_init.sql` creates all tables and indexes; `0001_rls_and_functions.sql` adds helper functions, `updated_at` triggers, append-only ledger triggers, integrity constraints and Row Level Security policies. The Supabase CLI (`supabase db push`) can apply the same files.

---

## Seed demo data

```bash
npm run db:seed
```

Creates a demo workspace for **Drake** (demo data only, nothing real) with ~500 fans, realistic score distribution (Listener → Icon), ~300 Instagram interactions, ~160 orders, 7 concerts (past + tonight + upcoming), ~100 attendees, 80 referrals, 6 challenges, 8 rewards, segments, campaigns, team members, mock Instagram/Shopify connections and 30+ days of activity — all created through the real ingestion pipeline. It also prints a ready-to-use **claim link** for an unclaimed Instagram commenter so you can demo `/claim/[token]`.

The artist dashboard includes a development-only **Generate demo event** menu (Instagram comment, merch order, concert check-in, referral, challenge completion, reward redemption) that pushes synthetic events through the same path as real webhooks.

---

## Environment variables

See [`.env.example`](.env.example). Everything except `DATABASE_URL` is optional; missing credentials feature-flag the corresponding capability off or switch it to the mock adapter.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `NEXT_PUBLIC_APP_URL` | Public base URL (used in magic links, QR codes, referral links, OAuth callbacks) |
| `SUPERFAN_DEMO_MODE` | Enables demo sign-in and the Generate Demo Event menu. Explicit opt-in; never set it on a deployment holding real fan data |
| `SUPERFAN_SIGNING_SECRET` | HMAC secret for claim/check-in tokens and local sessions (`openssl rand -hex 32`) |
| `SUPERFAN_ENCRYPTION_KEY` | 32-byte hex key for encrypting provider tokens at rest |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase Auth (+ admin) |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Transactional email (magic links, invites). Console fallback when unset |
| `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN` | Instagram (Meta Graph API) |
| `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `SHOPIFY_API_VERSION` | Shopify app |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | Spotify (experimental, fan-scoped) |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | TikTok Login Kit (experimental, fan-scoped) |
| `TICKETMASTER_API_KEY` | Ticketmaster Discovery API (event metadata only) |

Never commit real secrets. Provider tokens are AES-256-GCM encrypted in `integrations`.

---

## Running locally

```bash
npm run dev        # Next.js dev server
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run test       # vitest (needs Postgres; uses superfan_test by default)
npm run build      # production build
```

Tests use `TEST_DATABASE_URL` (default `postgres://postgres:postgres@localhost:5432/superfan_test`); create that database once with `createdb superfan_test`. Migrations are applied automatically before the suite runs.

---

## Integration configuration

Every provider implements `IntegrationAdapter` (`src/lib/integrations/types.ts`) and is registered in `src/lib/integrations/registry.ts`. Adapters only translate provider data into normalized `FanEvent`s; they never write scores.

### Instagram (Meta)
1. Create a Meta app with the **Instagram** product; add Facebook Login for Business.
2. Permissions: `instagram_basic`, `instagram_manage_comments`, `instagram_manage_messages`, `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`.
3. Webhooks → Instagram object → subscribe to `comments`, `mentions`, `messages`; callback URL `https://<app>/api/webhooks/meta`, verify token = `META_WEBHOOK_VERIFY_TOKEN`.
4. Add `https://<app>/api/integrations/instagram/callback` as a valid OAuth redirect URI.
5. Set `META_APP_ID` / `META_APP_SECRET` and connect from **Integrations**. Without credentials the mock adapter connects `@champagnepapi`.

Superfan only captures interactions with the artist's own professional account (comments, DMs where permitted, mentions). It never tracks what a fan likes or watches elsewhere. DM content is not stored; only that a message happened.

### Shopify
1. Create a public or custom app in the Shopify Partner dashboard. Scopes: `read_orders`, `read_customers`, `read_all_orders`.
2. App URL `https://<app>/app/integrations`, redirect URL `https://<app>/api/integrations/shopify/callback`.
3. Set `SHOPIFY_CLIENT_ID` / `SHOPIFY_CLIENT_SECRET`. Connecting registers `orders/create`, `refunds/create`, `orders/cancelled` webhook subscriptions through the **GraphQL Admin API** (no legacy REST). "Sync now" backfills recent orders.

### CSV import
Settings → Import. Upload mailing lists, merch customers, ticket buyers, attendees or fan-club members; map columns (email, first_name, last_name, phone, city, country, instagram_username, order_total, orders_count, order_date, event_name, event_date, ticket_quantity, attended, source, joined_at). Rows become `imported` events; re-running an import never double counts.

### Ticketmaster
`TICKETMASTER_API_KEY` enables Discovery API search when creating events (venues, dates). Purchase verification requires the restricted Partner API; MVP ticket verification uses CSV imports of ticket buyers, QR check-ins and staff-verified attendance.

---

## Webhook testing

Local tunnel (e.g. `ngrok http 3000`) and set `NEXT_PUBLIC_APP_URL` to the tunnel URL.

**Shopify** — sign a payload with the app secret and post it:

```bash
BODY='{"id":1001,"name":"#1001","email":"fan@example.com","processed_at":"2026-09-20T10:00:00Z","current_total_price":"85.00","currency":"USD","customer":{"id":8841,"email":"fan@example.com","first_name":"James","last_name":"Rellera"},"line_items":[{"title":"Afterlight Tour Hoodie","quantity":1,"price":"85.00"}]}'
HMAC=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SHOPIFY_CLIENT_SECRET" -binary | base64)
curl -X POST http://localhost:3000/api/webhooks/shopify \
  -H 'Content-Type: application/json' \
  -H "X-Shopify-Topic: orders/create" \
  -H "X-Shopify-Shop-Domain: drake-official.myshopify.com" \
  -H "X-Shopify-Webhook-Id: test-$(date +%s)" \
  -H "X-Shopify-Hmac-Sha256: $HMAC" \
  -d "$BODY"
```

Send it twice: the second delivery is stored as a duplicate and produces no new event.

**Meta** — sign with `sha256=<hex hmac of body using META_APP_SECRET>` in `X-Hub-Signature-256`. The GET handshake echoes `hub.challenge` when `hub.verify_token` matches.

**TikTok** — header `TikTok-Signature: t=<ts>,s=<hex hmac of "<ts>.<body>">`.

Raw deliveries are visible in the `webhook_events` table with their processing status and any error.

---

## Deployment

Works on any host that runs Next.js server code. `netlify.toml` is included; Vercel needs no config.

1. Push the repo and import it (framework preset: Next.js).
2. Add the environment variables above (at minimum `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`, `SUPERFAN_SIGNING_SECRET`, `SUPERFAN_ENCRYPTION_KEY`, Supabase and Resend keys). Leave `SUPERFAN_DEMO_MODE` unset in production.
3. Run migrations against the production database from your machine or CI: `DATABASE_URL=... npm run db:migrate`.
4. Point provider callback/webhook URLs at the production domain.
5. Webhook routes run on the Node.js runtime; keep them excluded from any auth middleware (already excluded in `src/proxy.ts`).

### Supabase as the database

- Use the **session/transaction pooler** connection string (`*.pooler.supabase.com`) for serverless hosts; the direct `db.*.supabase.co` host is IPv6-only.
- The app connects with a dedicated role that **owns** the tables (so it bypasses RLS like a service role would). Create it once, then run migrations as that role:
  ```sql
  CREATE ROLE superfan_app LOGIN PASSWORD '...';
  GRANT CREATE, CONNECT, TEMP ON DATABASE postgres TO superfan_app;
  GRANT ALL ON SCHEMA public TO superfan_app;
  ```
- RLS policies reference `auth.uid()` only through `public.auth_user_id()`, which must be created by a role with `USAGE` on the `auth` schema (`postgres` in the Supabase SQL editor). Everything else in the migrations runs as the app role.

### Hosted demo

A demo deployment is just the above plus `SUPERFAN_DEMO_MODE=true` and the seed data. Seed from a machine that can reach the database (`DATABASE_URL=... npm run db:seed`), or load a `pg_dump --data-only --inserts` of a locally seeded database.

---

## Known API limitations

- **Instagram:** the Graph API exposes interactions with the artist's professional account only. There is no access to a consumer's likes, views or activity on other accounts, and Superfan does not want it. Long-lived tokens expire (~60 days); the integration surfaces an "Instagram needs to be reconnected" state.
- **Shopify:** order data only; no browsing or abandoned-cart tracking in the MVP.
- **Spotify:** in Development Mode an app can authorize only a small allow-list of users; Extended Quota requires an established organization, a launched service and ≥250k MAU. Superfan derives only "artist appears in your top artists" and "recent listening observed", both heavily capped. It never claims lifetime stream counts.
- **TikTok:** requires developer-approved scopes; the MVP requests basic profile only. No watch history, likes or comment history.
- **Ticketmaster:** the public Discovery API provides event metadata only. Purchase history requires the Partner API and an official relationship; a partner adapter slot exists for when that is in place.

---

## Enabling experimental providers

Spotify and TikTok are **fan-scoped**: fans connect from their passport, not the artist workspace. The adapters, OAuth URL builders, token exchange and affinity-event derivation are implemented (`src/lib/integrations/spotify.ts`, `tiktok.ts`).

1. Set `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` (redirect `https://<app>/api/integrations/spotify/callback`) and/or `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET`.
2. Set the artist's Spotify artist id in Settings (`settings.spotifyArtistId`) so top-artist / recently-played matches are exact.
3. Expose the fan-side connect route once your app is approved for the required scopes — the Integrations page and fan Settings show the provider as *Experimental* with the availability note until then.
4. Scoring rules `spotify.artist_top` (lifetime cap 100) and `spotify.recent_play` (cap 25/week) are already in every artist's rule set and can be tuned in Settings → Scoring.

---

## Tests

```bash
npm test
```

Covers event idempotency (same Shopify webhook twice → one event), scoring (first/repeat purchase, refund reversal, Instagram weekly cap, Nth-concert tiers), rewards (insufficient points, inventory never negative, per-fan limits, cross-tenant), referrals (no self-referral, qualifies once), check-ins (one per fan per event, activation window, secret rotation, tampered tokens), identity claims (expired token fails, single use, shadow-fan merge), multi-tenancy (artist A cannot read artist B's fan), CSV import and segment queries.
