# Superfan UI conventions

Read this before building any page. The backend, actions and shared components already exist; pages are thin.

## Stack
- Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4 (tokens in `src/app/globals.css`), lucide-react icons, Recharts for charts.
- Server components by default. Fetch data in the page (or a server component) from `src/lib/**` query modules. Put interactivity in `"use client"` components under `src/components/**`.
- Mutations go through server actions in `src/lib/actions/*.ts`. Every action returns `ActionResult<T>`: `{ ok: true, data } | { ok: false, error, code?, fieldErrors? }`. Show errors with `toast.error(res.error)` from `@/components/ui/toast`. After a successful mutation call `router.refresh()` (or the action already `revalidatePath`s).
- `ActionButton` (`@/components/shared/action-button`) wraps an action with pending state, confirm and toast. Use it for one-click actions.
- Dynamic route params are Promises: `export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; }`. Same for `searchParams`.
- Never trust `artistId` from the client: pages call `requireArtistContext()` (`@/lib/auth/context`) and pass `ctx.artist.id` to queries. Fan pages call `requireFanContext()`.
- Format helpers: `formatNumber`, `formatMoney(cents)`, `formatPercent`, `formatDate`, `formatDateTime`, `formatRelative`, `initials`, `cn` from `@/lib/utils`. `fanDisplayName(fan)` from `@/lib/fans/queries`.

## Theme
- Artist dashboard (`/app/**`) renders inside a `.dark` wrapper (layout already applies it). Use semantic classes only: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `text-subtle`, `border-border`, `bg-muted`, `text-accent`, `bg-accent-soft`, `text-success/warning/danger/info` + `*-soft` backgrounds, `text-artist` / `bg-artist` (artist accent, set via `--artist-accent`).
- Cards: `<Card>` from `@/components/ui/card` or the `card-surface` utility class. Rounded-2xl, minimal borders, subtle shadow.
- Fan pages (`/fan/**`, `/artists/**`, `/claim`, `/checkin`) are light theme, mobile-first (375/390/430px). Set the artist accent on the page root: `style={{ ["--artist-accent" as string]: artist.accentColor }}`. Use `artist-gradient` for hero/tier cards (dark gradient using the accent), `gradient-text` for accent headings.
- Typography: Geist (already loaded). Headings `font-semibold tracking-tight`. Numbers use the `tabular` utility.
- Design direction: Apple Music × Linear × premium fan club. Clean, spacious, polished, subtle gradients, artwork-led, excellent empty states, smooth micro-interactions (`animate-rise`, `animate-fade-in`). Not crypto, not gaming, not generic enterprise CRM.
- Loading: add `loading.tsx` with skeletons (`Skeleton`, `CardSkeleton`, `TableSkeleton` from `@/components/ui/skeleton`) for data-heavy routes.
- Empty states: `EmptyState` from `@/components/ui/empty-state` with icon, title, description, actions (copy is in the PRD §51).

## Shared components (`src/components/ui`)
`Button` (variants: default, accent, artist, secondary, outline, ghost, subtle, danger, link; sizes: sm, default, lg, xl, icon, icon-sm; `loading`, `asChild`), `Card*`, `Input`, `Textarea`, `Label`, `Field` (label/hint/error wrapper), `Badge` (variants default/outline/accent/success/warning/danger/info/artist), `LevelBadge({name,color})`, `Avatar({src,name,size,rounded})`, `AvatarStack`, `Dialog*` + `SheetContent` (side drawer), `DropdownMenu*`, `Select*`, `Tabs*`, `Switch`, `Tooltip`, `Progress`, `SegmentedMeter` (███░░ meter), `Skeleton*`, `Table*`, `toast` + `Toaster` (mounted in root layout), `EmptyState`.

Shared (`src/components/shared`): `ActionButton`, `ProviderIcon({provider})` + `PROVIDER_LABELS`, `Stat({label,value,growth,hint})` metric tile, `CopyButton({value})`.
Dashboard (`src/components/dashboard`): `PageHeader({title,description,actions,eyebrow})`, `SectionTitle`, `FanSearch`, `DemoMenu`, `SidebarNav`.
Fan (`src/components/fan`): `FanNav({slug})` bottom tab bar.

## Data modules (read these for shapes)
- `src/lib/fans/queries.ts`: `listFans(artistId, filters)`, `getFanDetail(artistId, fanId)` (returns `FanDetail`), `topCities`, `fanDisplayName`.
- `src/lib/dashboard/overview.ts`: `getOverviewMetrics`, `getFanGrowthSeries`, `getEngagementSources`, `getLevelDistribution`, `getTopCities`, `getRecentSuperfans`, `listActivity`, `getEventTypeCounts`.
- `src/lib/segments/query.ts`: `SEGMENT_FIELDS` (field catalog incl. type + operators), `countSegment`, `describeCondition`, `EMPTY_SEGMENT`, `segmentGroupSchema`. Rule tree type `SegmentGroup` in `src/db/schema/crm.ts`.
- `src/lib/fan/passport.ts`: `getFanArtists(fanId)`, `getArtistPublic(slug)`, `getPassport(fanId, slug)` (everything for the passport: level, nextLevel, topPercent, badges w/ rarity, timeline, challenges w/ completion, rewards w/ eligibility, events w/ check-in window, referrals link, identities, pointTransactions).
- `src/lib/claims/index.ts`: `previewClaim(db, token)`; `src/lib/checkins/index.ts`: `resolveCheckinToken`, `checkinWindow`, `createCheckinToken`, `checkinUrl`.
- `src/lib/integrations/registry.ts` (`ADAPTERS`, `PROVIDER_ORDER`), `src/lib/integrations/store.ts` (`listIntegrations`, `describeStatus`), `src/lib/integrations/types.ts`.
- `src/lib/scoring/defaults.ts` (`DIMENSIONS`, defaults), `src/db/schema/*` for row types. Tables: `scoreRules`, `fanLevels`, `rewards`, `rewardRedemptions`, `challenges`, `challengeCompletions`, `artistEvents`, `eventCheckins`, `campaigns`, `segments`, `imports`, `auditLogs`, `artistMembers`, `users`, `fanTags`.
- DB access: `import { db } from "@/db"` + drizzle (`eq`, `and`, `desc`, `sql`). Always filter by `artistId`.

## Actions (`src/lib/actions`)
`auth.ts` (requestMagicLink, demoSignIn, signOutAction, switchArtist), `artist.ts` (createArtistAction, updateArtistAction, updateScoreWeights, updateScoreRules, updateLevels, inviteMember, updateMemberRole, removeMember), `fans.ts` (adjustPointsAction, adjustScoreAction, addNoteAction, createTagAction, toggleTagAction, verifyAttendanceAction, mergeFansAction, updateFanProfileByArtist, exportFansCsv), `segments.ts` (saveSegmentAction, deleteSegmentAction, previewSegmentCount, refreshSegmentCount), `rewards.ts` (saveRewardAction, setRewardStatusAction, fulfillRedemptionAction, cancelRedemptionAction), `challenges.ts` (saveChallengeAction, setChallengeStatusAction, approveManualCompletionAction), `events.ts` (saveEventAction, rotateEventSecretAction, setEventStatusAction, searchTicketmasterAction), `campaigns.ts` (saveCampaignAction, setCampaignStatusAction, deleteCampaignAction), `integrations.ts` (connectIntegrationAction → `{kind:"redirect",url}|{kind:"connected",mock}`, disconnectIntegrationAction, syncIntegrationAction), `imports.ts` (stageImportAction(FormData), runImportAction, getImportStatus), `demo.ts`, `search.ts`, `fan.ts` (joinArtistAction [redirects], completeChallengeAction, redeemRewardAction, claimIdentityAction, checkInAction, updateFanProfileAction, disconnectIdentityAction, exportMyDataAction, deleteAccountAction [redirects]).

Read an action's zod schema for its exact input shape before calling it.

## Rules
- Do not edit files outside your assigned scope except to add exports you need to your own new files. If a query is missing, add a new function in a new file under your scope (e.g. `src/lib/dashboard/<feature>.ts`) rather than editing shared modules.
- Do not run `next dev` or `next build` (another process owns the `.next` directory). Validate with `npx tsc --noEmit` and `npx eslint <your files>` and fix everything you introduced.
- Do not add dependencies.
- Keep components small; prefer server components; use `Suspense` where useful.
- Mobile: dashboard tables collapse to cards below `md`; fan pages must look great at 375px.
