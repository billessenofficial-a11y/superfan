import "dotenv/config";
import { faker } from "@faker-js/faker";
import { and, eq, sql } from "drizzle-orm";
import { createDb, type Database } from "../src/db";
import {
  artistEvents,
  artistFans,
  artistMembers,
  campaigns,
  challenges,
  fanIdentities,
  fanTagAssignments,
  fanTags,
  fans,
  rewards,
  segments,
  users,
  type SegmentGroup,
} from "../src/db/schema";
import { createArtist, getArtistBySlug } from "../src/lib/artists/create";
import { completeChallenge } from "../src/lib/challenges/complete";
import { checkInFan, newCheckinSecret } from "../src/lib/checkins";
import { createClaimToken } from "../src/lib/claims";
import { ingestEvent } from "../src/lib/events/ingest";
import { EVENT_TYPES } from "../src/lib/events/types";
import { resolveActor } from "../src/lib/identity/resolver";
import { saveConnectedAccount } from "../src/lib/integrations/store";
import { recordReferral, tryQualifyReferral } from "../src/lib/referrals";
import { redeemReward } from "../src/lib/rewards/redeem";
import { ensureSystemBadges } from "../src/lib/scoring/engine";

/* ─────────────────────────────────────────────────────────────
 * Demo seed: the fictional artist "Luma Vale" with 500 fans and
 * ~30 days of realistic activity flowing through the real pipeline.
 * ───────────────────────────────────────────────────────────── */

faker.seed(2026);

export const DEMO = {
  artistSlug: "luma-vale",
  founderEmail: "maya@lumavale.demo",
  fanEmail: "james@superfan.demo",
};

const DAY = 86_400_000;
const now = Date.now();
const daysAgo = (d: number, jitterHours = 12) => new Date(now - d * DAY - Math.random() * jitterHours * 3600_000);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const chance = (p: number) => Math.random() < p;

const CITIES: { city: string; region: string; country: string; weight: number }[] = [
  { city: "Los Angeles", region: "CA", country: "US", weight: 22 },
  { city: "New York", region: "NY", country: "US", weight: 16 },
  { city: "London", region: "", country: "GB", weight: 12 },
  { city: "Chicago", region: "IL", country: "US", weight: 9 },
  { city: "Toronto", region: "ON", country: "CA", weight: 8 },
  { city: "Austin", region: "TX", country: "US", weight: 5 },
  { city: "Berlin", region: "", country: "DE", weight: 4 },
  { city: "Seattle", region: "WA", country: "US", weight: 4 },
  { city: "Manchester", region: "", country: "GB", weight: 3 },
  { city: "Sydney", region: "NSW", country: "AU", weight: 3 },
  { city: "Nashville", region: "TN", country: "US", weight: 3 },
  { city: "Paris", region: "", country: "FR", weight: 3 },
  { city: "Vancouver", region: "BC", country: "CA", weight: 2 },
  { city: "Atlanta", region: "GA", country: "US", weight: 2 },
  { city: "Denver", region: "CO", country: "US", weight: 2 },
  { city: "Dublin", region: "", country: "IE", weight: 2 },
];
function pickCity() {
  const total = CITIES.reduce((s, c) => s + c.weight, 0);
  let r = Math.random() * total;
  for (const c of CITIES) {
    r -= c.weight;
    if (r <= 0) return c;
  }
  return CITIES[0];
}

const PRODUCTS = [
  { title: "Afterlight Tour Hoodie", price: 8500 },
  { title: "Afterlight Vinyl (Clear)", price: 3800 },
  { title: "Luma Vale Logo Tee", price: 3500 },
  { title: "Tour Poster (Signed)", price: 4500 },
  { title: "Afterlight Cassette", price: 1800 },
  { title: "Enamel Pin Set", price: 1600 },
  { title: "Afterlight Deluxe Box Set", price: 12000 },
];
const COMMENTS = ["THIS ALBUM 😭🔥", "afterlight on repeat all week", "come to chicago pls 🙏", "the bridge on track 4 >>>", "saw you in LA last night, unreal", "need the vinyl restock!!", "who else is going to the london show", "this is the one", "crying at the outro again", "ok the visuals for this era are insane", "day one fan here 🫶", "best show of my life", "the harmonies on this!!!", "played this at my wedding", "tour dates for australia??"];

type Tier = "icon" | "superfan" | "dedicated" | "fan" | "listener";
function pickTier(): Tier {
  const r = Math.random();
  if (r < 0.03) return "icon";
  if (r < 0.12) return "superfan";
  if (r < 0.32) return "dedicated";
  if (r < 0.62) return "fan";
  return "listener";
}

async function seedFan(db: Database, artistId: string, events: { id: string; name: string; city: string | null; startsAt: Date }[], tier: Tier, index: number) {
  const first = faker.person.firstName();
  const last = faker.person.lastName();
  const loc = pickCity();
  const email = faker.internet.email({ firstName: first, lastName: last, provider: pick(["gmail.com", "icloud.com", "outlook.com", "yahoo.com", "proton.me"]) }).toLowerCase();
  const seniorityDays = tier === "icon" ? 300 + Math.random() * 200 : tier === "superfan" ? 120 + Math.random() * 250 : tier === "dedicated" ? 30 + Math.random() * 200 : Math.random() * 120;
  const joinedAt = daysAgo(seniorityDays);
  const igHandle = `${first}${pick([".", "_", ""])}${pick([last.slice(0, 4), "music", "lv", "afterlight", String(faker.number.int({ min: 1, max: 999 }))])}`.toLowerCase();
  const avatar = `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(first + last + index)}&backgroundColor=c0aede,b6e3f4,ffd5dc,d1d4f9,ffdfbf`;

  const stats = { comments: 0, orders: 0, attended: 0, referrals: 0, challenges: 0 };
  let joined = false;

  await db.transaction(async (tx) => {
    const actor = await resolveActor(tx, {
      artistId,
      email,
      profile: { firstName: first, lastName: last, city: loc.city, region: loc.region || undefined, country: loc.country, avatarUrl: avatar },
      source: "superfan",
      occurredAt: joinedAt,
    });
    const fanId = actor.fanId;
    await tx.update(fans).set({ emailVerifiedAt: joinedAt, consentedAt: joinedAt, privacyPolicyVersion: "2026-09" }).where(eq(fans.id, fanId));
    await tx.update(artistFans).set({ firstSource: pick(["superfan", "csv", "shopify", "instagram"] as const) }).where(and(eq(artistFans.artistId, artistId), eq(artistFans.fanId, fanId)));

    const joinProb = { icon: 1, superfan: 0.95, dedicated: 0.85, fan: 0.6, listener: 0.35 }[tier];
    joined = chance(joinProb);
    if (joined) {
      await ingestEvent({ artistId, fanId, source: "superfan", type: EVENT_TYPES.fanJoined, sourceEventId: `join:${fanId}`, occurredAt: joinedAt, metadata: {}, summary: "Joined the fan club" }, tx);
    } else {
      await ingestEvent({ artistId, fanId, source: "csv", type: EVENT_TYPES.csvFanImported, sourceEventId: `seed_import:${fanId}`, occurredAt: joinedAt, verification: "imported", metadata: { sourceLabel: "2025 mailing list" }, summary: "Imported from 2025 mailing list" }, tx);
    }

    // Instagram
    const commentCount = { icon: 6 + Math.floor(Math.random() * 8), superfan: 3 + Math.floor(Math.random() * 5), dedicated: chance(0.6) ? 1 + Math.floor(Math.random() * 3) : 0, fan: chance(0.3) ? 1 : 0, listener: chance(0.08) ? 1 : 0 }[tier];
    if (commentCount > 0) {
      const igId = `ig_${faker.string.numeric(15)}`;
      for (let i = 0; i < commentCount; i++) {
        const at = daysAgo(Math.random() * Math.min(45, seniorityDays + 1));
        const dm = chance(0.12);
        await ingestEvent(
          {
            artistId,
            fanId,
            source: "instagram",
            type: dm ? EVENT_TYPES.instagramDm : EVENT_TYPES.instagramComment,
            sourceEventId: `${dm ? "dm" : "comment"}:seed_${fanId.slice(0, 8)}_${i}`,
            occurredAt: at,
            identity: { provider: "instagram", externalUserId: igId, username: igHandle, displayName: `${first} ${last}`, avatarUrl: avatar },
            metadata: dm ? { messageId: `m_${i}` } : { text: pick(COMMENTS), mediaId: `media_${faker.number.int({ min: 1, max: 24 })}`, mediaType: chance(0.5) ? "REELS" : "FEED" },
            summary: dm ? "Sent a direct message" : chance(0.5) ? "Commented on an Instagram Reel" : "Commented on an Instagram post",
          },
          tx,
        );
        stats.comments++;
      }
    }

    // Merch
    const orderCount = { icon: 6 + Math.floor(Math.random() * 4), superfan: 2 + Math.floor(Math.random() * 3), dedicated: chance(0.55) ? 1 + Math.floor(Math.random() * 2) : 0, fan: chance(0.2) ? 1 : 0, listener: chance(0.04) ? 1 : 0 }[tier];
    for (let i = 0; i < orderCount; i++) {
      const items = [pick(PRODUCTS)];
      if (chance(0.3)) items.push(pick(PRODUCTS));
      const amountCents = items.reduce((s, p) => s + p.price, 0);
      const orderId = faker.string.numeric(7);
      await ingestEvent(
        {
          artistId,
          fanId,
          source: "shopify",
          type: EVENT_TYPES.shopifyOrderCreated,
          sourceEventId: `order:${orderId}`,
          occurredAt: daysAgo(Math.random() * Math.min(200, seniorityDays + 1)),
          email,
          identity: { provider: "shopify", externalUserId: `cust_${faker.string.numeric(10)}`, username: email, displayName: `${first} ${last}` },
          metadata: { orderId, orderName: `#${orderId}`, amountCents, currency: "USD", items: items.map((p) => ({ title: p.title, quantity: 1, priceCents: p.price })) },
          summary: `Purchased ${items[0].title}${items.length > 1 ? ` +${items.length - 1} more` : ""}`,
        },
        tx,
      );
      stats.orders++;
    }
    return fanId;
  });

  const [af] = await db.select({ fanId: artistFans.fanId, code: artistFans.referralCode }).from(artistFans).innerJoin(fans, eq(fans.id, artistFans.fanId)).where(and(eq(artistFans.artistId, artistId), sql`lower(${fans.email}) = ${email}`)).limit(1);
  const fanId = af.fanId;

  // Concerts (past events only)
  const past = events.filter((e) => e.startsAt.getTime() < now);
  const attendCount = { icon: past.length, superfan: chance(0.9) ? 2 + Math.floor(Math.random() * 2) : 1, dedicated: chance(0.45) ? 1 + (chance(0.3) ? 1 : 0) : 0, fan: chance(0.1) ? 1 : 0, listener: chance(0.02) ? 1 : 0 }[tier];
  const chosen = faker.helpers.arrayElements(past, Math.min(attendCount, past.length));
  for (const ev of chosen) {
    if (chance(0.7)) {
      await checkInFan({ eventId: ev.id, fanId, method: "qr", now: new Date(ev.startsAt.getTime() + 30 * 60_000) }).catch(() => undefined);
    } else {
      await ingestEvent({ artistId, fanId, source: "csv", type: EVENT_TYPES.eventAttendanceImported, sourceEventId: `attend:${ev.id}:${fanId}`, occurredAt: ev.startsAt, verification: "imported", metadata: { eventId: ev.id, eventName: ev.name, city: ev.city }, summary: `Attended ${ev.name}` });
    }
    stats.attended++;
  }

  return { fanId, email, first, last, code: af.code, tier, stats, joined };
}

async function main() {
  const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/superfan";
  const { db, close } = createDb(url);
  try {
    if (await getArtistBySlug(db, DEMO.artistSlug)) {
      console.log("Demo artist already exists. Run `npm run db:reset` first to reseed.");
      return;
    }
    console.log("Seeding demo data for Luma Vale…");
    await ensureSystemBadges(db);

    // Founder (artist owner) + a couple of team members.
    const [founder] = await db.insert(users).values({ email: DEMO.founderEmail, displayName: "Maya Chen" }).onConflictDoNothing().returning();
    const artist = await createArtist(db, {
      name: "Luma Vale",
      slug: DEMO.artistSlug,
      genre: "Alt-pop",
      country: "US",
      accentColor: "#8b5cf6",
      bio: "Alt-pop from Los Angeles. New album Afterlight out now.",
      followerCount: 2_800_000,
      isDemo: true,
      createdByUserId: founder.id,
      avatarUrl: "/demo/luma-vale.svg",
      bannerUrl: "/demo/luma-vale-banner.svg",
    });
    await db.update(artistMembers).set({ role: "owner" }).where(and(eq(artistMembers.artistId, artist.id), eq(artistMembers.userId, founder.id)));
    for (const m of [
      { email: "dev@lumavale.demo", name: "Devon Park", role: "marketing" as const },
      { email: "riley@lumavale.demo", name: "Riley Osei", role: "community" as const },
    ]) {
      const [u] = await db.insert(users).values({ email: m.email, displayName: m.name }).returning();
      await db.insert(artistMembers).values({ artistId: artist.id, userId: u.id, role: m.role, acceptedAt: new Date(), invitedByUserId: founder.id });
    }

    // Integrations (mock connections).
    await saveConnectedAccount({ artistId: artist.id, provider: "instagram", account: { externalAccountId: "17841400000000001", externalAccountName: "@lumavale", scopes: ["instagram_basic", "instagram_manage_comments", "instagram_manage_messages"], settings: { pageName: "Luma Vale" } }, isMock: true, connectedByUserId: founder.id });
    await saveConnectedAccount({ artistId: artist.id, provider: "shopify", account: { externalAccountId: "luma-store.myshopify.com", externalAccountName: "luma-store.myshopify.com", scopes: ["read_orders", "read_customers"], settings: { shopName: "Luma Vale Official Store" } }, isMock: true, connectedByUserId: founder.id });
    await saveConnectedAccount({ artistId: artist.id, provider: "ticketmaster", account: { externalAccountId: "discovery", externalAccountName: "Event Discovery" }, isMock: true, connectedByUserId: founder.id });

    // Events: two past, one tonight, one upcoming.
    const eventRows = await db
      .insert(artistEvents)
      .values([
        { artistId: artist.id, name: "Glass Hours Tour — Los Angeles", venue: "The Fonda Theatre", city: "Los Angeles", region: "CA", country: "US", startsAt: daysAgo(340, 0), status: "completed", checkinSecret: newCheckinSecret(), checkinPoints: 500, capacity: 1200, createdByUserId: founder.id },
        { artistId: artist.id, name: "Glass Hours Tour — New York", venue: "Bowery Ballroom", city: "New York", region: "NY", country: "US", startsAt: daysAgo(325, 0), status: "completed", checkinSecret: newCheckinSecret(), checkinPoints: 500, capacity: 575, createdByUserId: founder.id },
        { artistId: artist.id, name: "Glass Hours Tour — Chicago", venue: "Metro", city: "Chicago", region: "IL", country: "US", startsAt: daysAgo(310, 0), status: "completed", checkinSecret: newCheckinSecret(), checkinPoints: 500, capacity: 1100, createdByUserId: founder.id },
        { artistId: artist.id, name: "Afterlight Tour — Los Angeles", venue: "The Wiltern", city: "Los Angeles", region: "CA", country: "US", startsAt: daysAgo(24, 0), status: "completed", checkinSecret: newCheckinSecret(), checkinPoints: 500, capacity: 2300, createdByUserId: founder.id },
        { artistId: artist.id, name: "Afterlight Tour — New York", venue: "Brooklyn Steel", city: "New York", region: "NY", country: "US", startsAt: daysAgo(9, 0), status: "completed", checkinSecret: newCheckinSecret(), checkinPoints: 500, capacity: 1800, createdByUserId: founder.id },
        { artistId: artist.id, name: "Afterlight Tour — Los Angeles (Night 2)", venue: "The Wiltern", city: "Los Angeles", region: "CA", country: "US", startsAt: new Date(now + 2 * 3600_000), status: "upcoming", checkinOpensAt: new Date(now - 3600_000), checkinClosesAt: new Date(now + 8 * 3600_000), checkinSecret: newCheckinSecret(), checkinPoints: 500, capacity: 2300, createdByUserId: founder.id },
        { artistId: artist.id, name: "Afterlight Tour — London", venue: "O2 Academy Brixton", city: "London", country: "GB", startsAt: new Date(now + 21 * DAY), status: "upcoming", checkinSecret: newCheckinSecret(), checkinPoints: 500, capacity: 4900, createdByUserId: founder.id },
      ])
      .returning();
    const tonight = eventRows[5];

    // Challenges.
    const challengeRows = await db
      .insert(challenges)
      .values([
        { artistId: artist.id, title: "Join the album countdown", description: "Be part of the Afterlight countdown and unlock the first badge of the era.", type: "manual", status: "active", points: 100, createdByUserId: founder.id },
        { artistId: artist.id, title: "Check in at tonight's show", description: "Scan the QR at the venue to earn 500 points.", type: "event_checkin", status: "active", points: 500, isMajor: true, config: { eventId: tonight.id }, endsAt: new Date(now + 10 * 3600_000), createdByUserId: founder.id },
        { artistId: artist.id, title: "Refer a friend", description: "Share your link. When a friend joins and takes their first action, you both win.", type: "referral", status: "active", points: 200, config: { referralsRequired: 1 }, createdByUserId: founder.id },
        { artistId: artist.id, title: "How well do you know Afterlight?", description: "Four questions. Get them all right.", type: "quiz", status: "active", points: 150, isMajor: true, config: { passScore: 3, questions: [
          { id: "q1", question: "Which track opens Afterlight?", options: ["Glass Hours", "Neon Tide", "Afterlight", "Low Sun"], answerIndex: 1 },
          { id: "q2", question: "Where was the album recorded?", options: ["Berlin", "Los Angeles", "Nashville", "London"], answerIndex: 1 },
          { id: "q3", question: "How many tracks are on the standard edition?", options: ["10", "11", "12", "14"], answerIndex: 2 },
          { id: "q4", question: "Who features on 'Low Sun'?", options: ["No one", "Iris Wren", "The Marlows", "DJ Kest"], answerIndex: 1 },
        ] }, createdByUserId: founder.id },
        { artistId: artist.id, title: "Enter the vinyl code", description: "Find the code inside the clear vinyl sleeve.", type: "promo_code", status: "active", points: 100, config: { code: "AFTERLIGHT" }, createdByUserId: founder.id },
        { artistId: artist.id, title: "RSVP: listening party", description: "Tell us which city you'd come to for a private listening party.", type: "form_submission", status: "active", points: 100, config: { fields: [{ key: "city", label: "Which city?", type: "select", options: ["Los Angeles", "New York", "London", "Chicago", "Toronto"], required: true }, { key: "why", label: "Why should we pick you?", type: "textarea", required: false }] }, createdByUserId: founder.id },
      ])
      .returning();

    // Rewards.
    const rewardRows = await db
      .insert(rewards)
      .values([
        { artistId: artist.id, name: "Signed Afterlight poster", description: "Hand-signed 18×24 tour poster, shipped to you.", pointCost: 750, inventory: 100, fulfillmentType: "physical", status: "active", createdByUserId: founder.id },
        { artistId: artist.id, name: "Early access to tour merch", description: "24-hour early access to every drop this era.", pointCost: 1000, inventory: null, fulfillmentType: "access", status: "active", createdByUserId: founder.id },
        { artistId: artist.id, name: "Private listening party", description: "An intimate first listen of the deluxe edition, in your city.", pointCost: 2000, inventory: 50, fulfillmentType: "access", status: "active", minimumScore: 3500, createdByUserId: founder.id },
        { artistId: artist.id, name: "Meet-and-greet lottery entry", description: "One entry into the meet-and-greet draw for the next show in your city.", pointCost: 500, inventory: null, fulfillmentType: "lottery", status: "active", maxPerFan: 3, createdByUserId: founder.id },
        { artistId: artist.id, name: "Afterlight wallpaper pack", description: "Phone and desktop wallpapers from the album shoot.", pointCost: 150, inventory: null, fulfillmentType: "digital", status: "active", createdByUserId: founder.id },
        { artistId: artist.id, name: "Vinyl test pressing", description: "One of five test pressings, numbered and signed.", pointCost: 5000, inventory: 5, fulfillmentType: "physical", status: "active", minimumScore: 7000, createdByUserId: founder.id },
        { artistId: artist.id, name: "London presale code", description: "Presale access for O2 Academy Brixton.", pointCost: 400, inventory: 300, fulfillmentType: "access", status: "active", locationRestriction: "London", createdByUserId: founder.id },
        { artistId: artist.id, name: "Personal video message", description: "A 30-second video message from Luma.", pointCost: 3000, inventory: 10, fulfillmentType: "manual", status: "active", createdByUserId: founder.id },
      ])
      .returning();

    // Tags.
    const [vipTag] = await db.insert(fanTags).values([{ artistId: artist.id, name: "VIP", color: "#f59e0b" }, { artistId: artist.id, name: "Press", color: "#60a5fa" }, { artistId: artist.id, name: "Street team", color: "#34d399" }]).returning();

    // 500 fans.
    const events = eventRows.map((e) => ({ id: e.id, name: e.name, city: e.city, startsAt: e.startsAt }));
    const seeded: Awaited<ReturnType<typeof seedFan>>[] = [];
    for (let i = 0; i < 500; i++) {
      seeded.push(await seedFan(db, artist.id, events, pickTier(), i));
      if ((i + 1) % 100 === 0) console.log(`  … ${i + 1} fans`);
    }

    // Referrals: engaged fans refer newer ones (qualified when the referred fan is active).
    const referrers = seeded.filter((f) => f.tier === "icon" || f.tier === "superfan" || (f.tier === "dedicated" && chance(0.4)));
    const referredPool = seeded.filter((f) => !f.joined);
    const referredIds = new Set<string>();
    let referralsMade = 0;
    for (const referred of faker.helpers.arrayElements(referredPool, Math.min(80, referredPool.length))) {
      const referrer = pick(referrers);
      try {
        await db.transaction((tx) => recordReferral(tx, { artistId: artist.id, code: referrer.code, referredFanId: referred.fanId }));
        await ingestEvent({ artistId: artist.id, fanId: referred.fanId, source: "superfan", type: EVENT_TYPES.fanJoined, sourceEventId: `join:${referred.fanId}`, occurredAt: daysAgo(Math.random() * 25), metadata: { via: "referral" }, summary: "Joined the fan club" });
        if (chance(0.85)) {
          await completeChallenge({ artistId: artist.id, fanId: referred.fanId, challengeId: challengeRows[0].id }).catch(() => undefined);
          await tryQualifyReferral({ artistId: artist.id, referredFanId: referred.fanId });
        }
        referralsMade++;
        referredIds.add(referred.fanId);
      } catch {
        /* self-referral or already referred */
      }
    }

    // Challenge completions for engaged fans.
    for (const f of seeded) {
      const p = { icon: 0.9, superfan: 0.7, dedicated: 0.45, fan: 0.2, listener: 0.05 }[f.tier];
      if (chance(p)) await completeChallenge({ artistId: artist.id, fanId: f.fanId, challengeId: challengeRows[0].id }).catch(() => undefined);
      if (chance(p * 0.6)) await completeChallenge({ artistId: artist.id, fanId: f.fanId, challengeId: challengeRows[3].id, submission: { answers: { q1: 1, q2: 1, q3: 2, q4: 1 } } }).catch(() => undefined);
      if (chance(p * 0.4)) await completeChallenge({ artistId: artist.id, fanId: f.fanId, challengeId: challengeRows[4].id, submission: { code: "AFTERLIGHT" } }).catch(() => undefined);
      if (chance(p * 0.3)) await completeChallenge({ artistId: artist.id, fanId: f.fanId, challengeId: challengeRows[5].id, submission: { fields: { city: pick(["Los Angeles", "New York", "London"]) } } }).catch(() => undefined);
    }

    // Redemptions.
    let redemptions = 0;
    for (const f of seeded.filter((s) => s.tier === "icon" || s.tier === "superfan")) {
      if (!chance(0.5)) continue;
      const reward = pick(rewardRows.filter((r) => r.pointCost <= 1000));
      try {
        await redeemReward({ artistId: artist.id, fanId: f.fanId, rewardId: reward.id });
        redemptions++;
      } catch {
        /* not enough points */
      }
    }

    // VIP tag on the top fans.
    const top = await db.select({ fanId: artistFans.fanId }).from(artistFans).where(eq(artistFans.artistId, artist.id)).orderBy(sql`${artistFans.superfanScore} desc`).limit(25);
    await db.insert(fanTagAssignments).values(top.map((t) => ({ artistId: artist.id, tagId: vipTag.id, fanId: t.fanId }))).onConflictDoNothing();

    // The hero fan for the fan-side demo: James Rellera in Los Angeles.
    const [jamesUser] = await db.insert(users).values({ email: DEMO.fanEmail, displayName: "James Rellera" }).returning();
    const james = await db.transaction(async (tx) => {
      const actor = await resolveActor(tx, { artistId: artist.id, email: DEMO.fanEmail, profile: { firstName: "James", lastName: "Rellera", city: "Los Angeles", region: "CA", country: "US", avatarUrl: "https://api.dicebear.com/9.x/notionists/svg?seed=JamesRellera&backgroundColor=c0aede" }, source: "superfan", occurredAt: daysAgo(380) });
      await tx.update(fans).set({ userId: jamesUser.id, emailVerifiedAt: daysAgo(380), consentedAt: daysAgo(380), privacyPolicyVersion: "2026-09" }).where(eq(fans.id, actor.fanId));
      await ingestEvent({ artistId: artist.id, fanId: actor.fanId, source: "superfan", type: EVENT_TYPES.fanJoined, sourceEventId: `join:${actor.fanId}`, occurredAt: daysAgo(380), metadata: {}, summary: "Joined the fan club" }, tx);
      const igId = "ig_178912345";
      for (let i = 0; i < 18; i++) {
        await ingestEvent({ artistId: artist.id, fanId: actor.fanId, source: "instagram", type: EVENT_TYPES.instagramComment, sourceEventId: `comment:james_${i}`, occurredAt: daysAgo(1 + i * 9), identity: { provider: "instagram", externalUserId: igId, username: "jamesmusic", displayName: "James Rellera" }, metadata: { text: pick(COMMENTS), mediaId: `media_${i}`, mediaType: i % 2 ? "REELS" : "FEED" }, summary: i % 2 ? "Commented on an Instagram Reel" : "Commented on an Instagram post" }, tx);
      }
      const orders = [{ t: "Afterlight Tour Hoodie", p: 8500, d: 3 }, { t: "Afterlight Vinyl (Clear)", p: 3800, d: 40 }, { t: "Tour Poster (Signed)", p: 4500, d: 95 }, { t: "Luma Vale Logo Tee", p: 3500, d: 210 }, { t: "Afterlight Deluxe Box Set", p: 12000, d: 15 }];
      for (const o of orders) {
        const orderId = faker.string.numeric(7);
        await ingestEvent({ artistId: artist.id, fanId: actor.fanId, source: "shopify", type: EVENT_TYPES.shopifyOrderCreated, sourceEventId: `order:${orderId}`, occurredAt: daysAgo(o.d), email: DEMO.fanEmail, identity: { provider: "shopify", externalUserId: "customer_8841", username: DEMO.fanEmail, displayName: "James Rellera" }, metadata: { orderId, orderName: `#${orderId}`, amountCents: o.p, currency: "USD", items: [{ title: o.t, quantity: 1, priceCents: o.p }] }, summary: `Purchased ${o.t}` }, tx);
      }
      return actor.fanId;
    });
    for (const ev of eventRows.slice(0, 5)) await checkInFan({ eventId: ev.id, fanId: james, method: "qr", now: new Date(ev.startsAt.getTime() + 20 * 60_000) });
    await ingestEvent({ artistId: artist.id, fanId: james, source: "csv", type: EVENT_TYPES.eventAttendanceImported, sourceEventId: `attend:2025:${james}`, occurredAt: daysAgo(300), verification: "imported", metadata: { eventName: "Glass Hours Tour — Los Angeles" }, summary: "Attended Glass Hours Tour — Los Angeles" });
    for (const c of [challengeRows[0], challengeRows[3], challengeRows[4], challengeRows[5]]) {
      const submission = c.type === "quiz" ? { answers: { q1: 1, q2: 1, q3: 2, q4: 1 } } : c.type === "promo_code" ? { code: "AFTERLIGHT" } : c.type === "form_submission" ? { fields: { city: "Los Angeles", why: "Been here since Glass Hours." } } : {};
      await completeChallenge({ artistId: artist.id, fanId: james, challengeId: c.id, submission }).catch(() => undefined);
    }
    const [jamesAf] = await db.select().from(artistFans).where(and(eq(artistFans.artistId, artist.id), eq(artistFans.fanId, james)));
    for (const referred of faker.helpers.arrayElements(referredPool.filter((r) => !referredIds.has(r.fanId)), 4)) {
      try {
        await db.transaction((tx) => recordReferral(tx, { artistId: artist.id, code: jamesAf.referralCode, referredFanId: referred.fanId }));
        await ingestEvent({ artistId: artist.id, fanId: referred.fanId, source: "superfan", type: EVENT_TYPES.fanJoined, sourceEventId: `join:${referred.fanId}`, occurredAt: daysAgo(Math.random() * 20), metadata: { via: "referral" }, summary: "Joined the fan club" });
        await completeChallenge({ artistId: artist.id, fanId: referred.fanId, challengeId: challengeRows[0].id }).catch(() => undefined);
        await tryQualifyReferral({ artistId: artist.id, referredFanId: referred.fanId });
      } catch {
        /* already referred */
      }
    }
    await redeemReward({ artistId: artist.id, fanId: james, rewardId: rewardRows[1].id }).catch(() => undefined);
    await db.insert(fanTagAssignments).values({ artistId: artist.id, tagId: vipTag.id, fanId: james }).onConflictDoNothing();

    // An unclaimed Instagram commenter with a ready claim link (to demo /claim).
    const unclaimed = await ingestEvent({ artistId: artist.id, source: "instagram", type: EVENT_TYPES.instagramComment, sourceEventId: "comment:unclaimed_demo_1", occurredAt: daysAgo(0.2), identity: { provider: "instagram", externalUserId: "ig_990011", username: "sofia.afterlight", displayName: "Sofia" }, metadata: { text: "VIP 🙋‍♀️", mediaId: "media_vip" }, summary: "Commented on an Instagram post" });
    const claim = await createClaimToken(db, { artistId: artist.id, identityId: unclaimed.identityId! });

    // Segments & campaigns.
    const laRules: SegmentGroup = { kind: "group", match: "all", children: [
      { kind: "condition", field: "city", operator: "eq", value: "Los Angeles" },
      { kind: "condition", field: "superfan_score", operator: "gt", value: 3500 },
    ] };
    const { countSegment } = await import("../src/lib/segments/query");
    const [laSegment] = await db.insert(segments).values([
      { artistId: artist.id, name: "LA Superfans", description: "Los Angeles fans above Superfan level", rules: laRules, cachedCount: await countSegment(db, artist.id, laRules), cachedAt: new Date(), createdByUserId: founder.id },
      { artistId: artist.id, name: "Big spenders, no shows", description: "Spent over $150 but never attended", rules: { kind: "group", match: "all", children: [{ kind: "condition", field: "lifetime_spend", operator: "gt", value: 150 }, { kind: "condition", field: "events_attended", operator: "eq", value: 0 }] }, createdByUserId: founder.id },
      { artistId: artist.id, name: "Going quiet", description: "Superfans inactive for 21+ days", rules: { kind: "group", match: "all", children: [{ kind: "condition", field: "superfan_score", operator: "gte", value: 3500 }, { kind: "condition", field: "last_active_days", operator: "gt", value: 21 }] }, createdByUserId: founder.id },
      { artistId: artist.id, name: "London presale", description: "London fans who have joined", rules: { kind: "group", match: "all", children: [{ kind: "condition", field: "city", operator: "eq", value: "London" }, { kind: "condition", field: "joined", operator: "is_known" }] }, createdByUserId: founder.id },
    ]).returning();
    await db.insert(campaigns).values([
      { artistId: artist.id, name: "VIP LA Listening Party", description: "Private first listen of the deluxe edition.", type: "vip_access", status: "live", segmentId: laSegment.id, minimumScore: 5000, capacity: 150, startsAt: new Date(now + 7 * DAY), rewardId: rewardRows[2].id, createdByUserId: founder.id },
      { artistId: artist.id, name: "Afterlight trivia week", description: "Album week challenge.", type: "challenge", status: "live", challengeId: challengeRows[3].id, startsAt: daysAgo(3), endsAt: new Date(now + 4 * DAY), createdByUserId: founder.id },
      { artistId: artist.id, name: "London presale drop", description: "Presale codes for Brixton.", type: "promo_code", status: "scheduled", segmentId: null, startsAt: new Date(now + 2 * DAY), rewardId: rewardRows[6].id, config: { code: "BRIXTON26" }, createdByUserId: founder.id },
      { artistId: artist.id, name: "Which city next?", description: "Fan survey for the next tour leg.", type: "fan_survey", status: "draft", config: { questions: ["Which city should we add?", "Weeknight or weekend?"] }, createdByUserId: founder.id },
    ]);

    const [counts] = await db.select({ fans: sql<number>`count(*)::int`, superfans: sql<number>`count(*) filter (where ${artistFans.superfanScore} >= 3500)::int` }).from(artistFans).where(eq(artistFans.artistId, artist.id));
    const [{ identities }] = await db.select({ identities: sql<number>`count(*)::int` }).from(fanIdentities).where(eq(fanIdentities.artistId, artist.id));

    console.log(`
✔ Seeded Luma Vale
   fans: ${counts.fans}  superfans: ${counts.superfans}  identities: ${identities}
   referrals: ${referralsMade}  redemptions: ${redemptions}

Sign in (magic links print to this console when email is not configured):
   Artist dashboard → ${DEMO.founderEmail}
   Fan passport     → ${DEMO.fanEmail}

Demo claim link (unclaimed Instagram commenter @sofia.afterlight):
   ${claim.url}
`);
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
