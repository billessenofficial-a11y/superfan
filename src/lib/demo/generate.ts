import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { artistEvents, artistFans, challengeCompletions, challenges, fans, rewards } from "@/db/schema";
import { audit } from "@/lib/audit";
import { completeChallenge } from "@/lib/challenges/complete";
import { checkInFan } from "@/lib/checkins";
import { ingestEvent } from "@/lib/events/ingest";
import { EVENT_TYPES } from "@/lib/events/types";
import { fanDisplayName } from "@/lib/fans/queries";
import { recordReferral, tryQualifyReferral } from "@/lib/referrals";
import { redeemReward } from "@/lib/rewards/redeem";
import { resolveActor } from "@/lib/identity/resolver";
import { touchIntegrationEvent } from "@/lib/integrations/store";
import { awardPoints } from "@/lib/points/ledger";
import { bumpStreamingToday } from "@/lib/streaming/queries";
import { pickSampleTrack } from "@/lib/streaming/sample";

export const DEMO_EVENT_KINDS = [
  { key: "instagram_comment", label: "Instagram comment", description: "A fan comments on a post" },
  { key: "merch_order", label: "Merch order", description: "A Shopify order comes in" },
  { key: "spotify_streams", label: "Spotify streams", description: "A linked fan's weekly plays roll in and today's stream count moves" },
  { key: "concert_checkin", label: "Concert check-in", description: "A fan scans tonight's QR" },
  { key: "referral", label: "Referral", description: "A new fan joins via a referral link" },
  { key: "challenge_completion", label: "Challenge completion", description: "A fan finishes an active challenge" },
  { key: "reward_redemption", label: "Reward redemption", description: "A fan spends points on a reward" },
] as const;

export type DemoEventKind = (typeof DEMO_EVENT_KINDS)[number]["key"];

const COMMENTS = ["THIS ALBUM 😭🔥", "afterlight on repeat all week", "come to chicago pls 🙏", "the bridge on track 4 >>>", "saw you in LA last night, unreal", "need the vinyl restock!!", "who else is going to the london show", "this is the one", "crying at the outro again", "ok the visuals for this era are insane"];
const PRODUCTS = [
  { title: "Afterlight Tour Hoodie", price: 8500 },
  { title: "Afterlight Vinyl (Clear)", price: 3800 },
  { title: "Luma Vale Logo Tee", price: 3500 },
  { title: "Tour Poster (Signed)", price: 4500 },
  { title: "Afterlight Cassette", price: 1800 },
  { title: "Enamel Pin Set", price: 1600 },
];
const FIRST = ["Sarah", "Alex", "James", "Mika", "Emma", "Noah", "Priya", "Leo", "Zoe", "Mateo", "Ava", "Kai", "Nina", "Omar", "Ella"];
const LAST = ["Nguyen", "Rellera", "Okafor", "Silva", "Cohen", "Park", "Haddad", "Moreau", "Ivanova", "Bennett"];
const CITIES = ["Los Angeles", "New York", "London", "Chicago", "Toronto", "Berlin", "Austin"];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function randomFan(artistId: string, opts: { minPoints?: number } = {}) {
  const conditions = [eq(artistFans.artistId, artistId), isNull(fans.mergedIntoFanId), sql`${fans.email} is not null`];
  if (opts.minPoints) conditions.push(gt(artistFans.rewardPointsCached, opts.minPoints));
  const [row] = await db
    .select({ fan: fans, membership: artistFans })
    .from(artistFans)
    .innerJoin(fans, eq(fans.id, artistFans.fanId))
    .where(and(...conditions))
    .orderBy(sql`random()`)
    .limit(1);
  return row ?? null;
}

export type DemoResult = { title: string; detail: string; fanId: string | null; href?: string };

/**
 * Development-only: generate one realistic event through the same code path
 * a real integration would use, so the dashboard visibly reacts.
 */
export async function generateDemoEvent(artistId: string, kind: DemoEventKind, actorUserId: string | null): Promise<DemoResult> {
  const result = await run(artistId, kind);
  await audit(db, { artistId, actorUserId, action: "demo.event_generated", metadata: { kind, fanId: result.fanId } });
  return result;
}

async function run(artistId: string, kind: DemoEventKind): Promise<DemoResult> {
  switch (kind) {
    case "instagram_comment": {
      // 60% existing fan with an Instagram identity, 40% brand new commenter.
      const existing = Math.random() < 0.6 ? await randomFan(artistId) : null;
      const username = existing
        ? `${(existing.fan.firstName ?? "fan").toLowerCase()}${(existing.fan.lastName ?? "").toLowerCase().slice(0, 3)}`
        : `${pick(FIRST).toLowerCase()}.${pick(["music", "vibes", "afterlight", "lv", "live"])}${Math.floor(Math.random() * 900 + 100)}`;
      const externalUserId = existing ? `ig_demo_${existing.fan.id.slice(0, 8)}` : `ig_demo_${Date.now()}`;
      const text = pick(COMMENTS);
      const res = await ingestEvent({
        artistId,
        source: "instagram",
        type: EVENT_TYPES.instagramComment,
        sourceEventId: `demo_comment:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        identity: { provider: "instagram", externalUserId, username, displayName: existing ? fanDisplayName(existing.fan) : undefined },
        fanId: existing?.fan.id,
        metadata: { text, mediaId: `demo_media_${Math.floor(Math.random() * 20)}`, mediaType: Math.random() < 0.5 ? "REELS" : "FEED", demo: true },
        summary: "Commented on an Instagram post",
      });
      await touchIntegrationEvent(artistId, "instagram");
      return { title: `@${username} commented`, detail: `"${text}" · +${res.scoreDelta} score${res.fanCreated ? " · new unclaimed profile" : ""}`, fanId: res.fanId, href: res.fanId ? `/app/fans/${res.fanId}` : undefined };
    }

    case "merch_order": {
      const existing = Math.random() < 0.7 ? await randomFan(artistId) : null;
      const product = pick(PRODUCTS);
      const qty = Math.random() < 0.2 ? 2 : 1;
      const amountCents = product.price * qty;
      const first = existing?.fan.firstName ?? pick(FIRST);
      const last = existing?.fan.lastName ?? pick(LAST);
      const email = existing?.fan.email ?? `${first}.${last}${Math.floor(Math.random() * 999)}@example.com`.toLowerCase();
      const orderId = `${Date.now()}`.slice(-7);
      const res = await ingestEvent({
        artistId,
        source: "shopify",
        type: EVENT_TYPES.shopifyOrderCreated,
        sourceEventId: `order:demo_${orderId}`,
        email,
        identity: { provider: "shopify", externalUserId: `cust_demo_${email}`, username: email, displayName: `${first} ${last}` },
        profile: { firstName: first, lastName: last, city: existing?.fan.city ?? pick(CITIES) },
        metadata: { orderId, orderName: `#${orderId}`, amountCents, currency: "USD", items: [{ title: product.title, quantity: qty, priceCents: product.price }], demo: true },
        summary: `Purchased ${product.title}${qty > 1 ? ` ×${qty}` : ""}`,
      });
      await touchIntegrationEvent(artistId, "shopify");
      return { title: `${first} purchased ${product.title}`, detail: `$${(amountCents / 100).toFixed(2)} · +${res.scoreDelta} score · +${res.pointsAwarded} points`, fanId: res.fanId, href: res.fanId ? `/app/fans/${res.fanId}` : undefined };
    }

    case "spotify_streams": {
      const fan = await randomFan(artistId);
      if (!fan) return { title: "No fans yet", detail: "Import fans first.", fanId: null };
      const plays = 4 + Math.floor(Math.random() * 36);
      const track = pickSampleTrack();
      const res = await ingestEvent({
        artistId,
        source: "spotify",
        type: EVENT_TYPES.spotifyStream,
        sourceEventId: `stream:demo_${fan.fan.id.slice(0, 8)}:${Date.now()}`,
        fanId: fan.fan.id,
        identity: { provider: "spotify", externalUserId: `sp_demo_${fan.fan.id.slice(0, 8)}`, username: (fan.fan.firstName ?? "fan").toLowerCase(), displayName: fanDisplayName(fan.fan) },
        metadata: { plays, topTrack: track, demo: true, sample: true },
        summary: `Streamed ${track} ${plays} times this week`,
      });
      // Identified listening is a sliver of total streams; move the headline number too.
      const unidentified = 1500 + Math.floor(Math.random() * 4000);
      const today = await bumpStreamingToday(artistId, { streams: plays + unidentified, track, saves: Math.floor(unidentified * 0.02) });
      await touchIntegrationEvent(artistId, "spotify");
      return { title: `${fanDisplayName(fan.fan)} streamed ${track} ${plays}×`, detail: `+${res.scoreDelta} score · today's streams now ${today.toLocaleString("en-US")}`, fanId: fan.fan.id, href: "/app/streaming" };
    }

    case "concert_checkin": {
      const [event] = await db
        .select()
        .from(artistEvents)
        .where(and(eq(artistEvents.artistId, artistId), sql`${artistEvents.status} in ('upcoming','live')`))
        .orderBy(sql`abs(extract(epoch from (${artistEvents.startsAt} - now())))`)
        .limit(1);
      if (!event) return { title: "No event to check into", detail: "Create an event first.", fanId: null };
      for (let attempt = 0; attempt < 5; attempt++) {
        const fan = await randomFan(artistId);
        if (!fan) break;
        try {
          const res = await checkInFan({ eventId: event.id, fanId: fan.fan.id, method: "staff", verifiedByUserId: null });
          return { title: `${fanDisplayName(fan.fan)} checked in at ${event.name}`, detail: `${event.city ?? ""} · +${event.checkinPoints} points · +${res.ingest.scoreDelta} score`, fanId: fan.fan.id, href: `/app/fans/${fan.fan.id}` };
        } catch {
          continue; // already checked in — try another fan
        }
      }
      return { title: "Everyone is already checked in", detail: "Try another demo event.", fanId: null };
    }

    case "referral": {
      const referrer = await randomFan(artistId);
      if (!referrer) return { title: "No fans yet", detail: "Import fans first.", fanId: null };
      const first = pick(FIRST);
      const last = pick(LAST);
      const email = `${first}.${last}${Math.floor(Math.random() * 9999)}@example.com`.toLowerCase();
      const newFanId = await db.transaction(async (tx) => {
        const actor = await resolveActor(tx, { artistId, email, profile: { firstName: first, lastName: last, city: referrer.fan.city ?? pick(CITIES) }, source: "superfan" });
        await tx.update(fans).set({ emailVerifiedAt: new Date() }).where(eq(fans.id, actor.fanId));
        await recordReferral(tx, { artistId, code: referrer.membership.referralCode, referredFanId: actor.fanId });
        await ingestEvent({ artistId, fanId: actor.fanId, source: "superfan", type: EVENT_TYPES.fanJoined, sourceEventId: `join:${actor.fanId}`, metadata: { via: "referral", demo: true }, summary: "Joined the fan club" }, tx);
        return actor.fanId;
      });
      // A meaningful action makes the referral qualify.
      const [challenge] = await db.select().from(challenges).where(and(eq(challenges.artistId, artistId), eq(challenges.status, "active"), eq(challenges.type, "manual"))).limit(1);
      if (challenge) await completeChallenge({ artistId, fanId: newFanId, challengeId: challenge.id }).catch(() => undefined);
      const qualified = await tryQualifyReferral({ artistId, referredFanId: newFanId });
      return {
        title: `${fanDisplayName(referrer.fan)} referred ${first}`,
        detail: qualified ? "Referral qualified · +200 points to referrer" : "Referral pending until the new fan takes a meaningful action",
        fanId: referrer.fan.id,
        href: `/app/fans/${referrer.fan.id}`,
      };
    }

    case "challenge_completion": {
      const active = await db.select().from(challenges).where(and(eq(challenges.artistId, artistId), eq(challenges.status, "active"))).orderBy(desc(challenges.createdAt));
      const simple = active.filter((c) => ["manual", "quiz", "promo_code", "link_visit", "form_submission"].includes(c.type));
      if (simple.length === 0) return { title: "No active challenges", detail: "Create a challenge first.", fanId: null };
      for (let attempt = 0; attempt < 6; attempt++) {
        const fan = await randomFan(artistId);
        const challenge = pick(simple);
        if (!fan) break;
        const [done] = await db.select({ id: challengeCompletions.id }).from(challengeCompletions).where(and(eq(challengeCompletions.challengeId, challenge.id), eq(challengeCompletions.fanId, fan.fan.id))).limit(1);
        if (done) continue;
        const submission =
          challenge.type === "quiz"
            ? { answers: Object.fromEntries((challenge.config.questions ?? []).map((q) => [q.id, q.answerIndex])) }
            : challenge.type === "promo_code"
              ? { code: challenge.config.code }
              : challenge.type === "link_visit"
                ? { visited: true }
                : challenge.type === "form_submission"
                  ? { fields: Object.fromEntries((challenge.config.fields ?? []).map((f) => [f.key, f.options?.[0] ?? "Yes"])) }
                  : {};
        const res = await completeChallenge({ artistId, fanId: fan.fan.id, challengeId: challenge.id, submission });
        return { title: `${fanDisplayName(fan.fan)} completed "${challenge.title}"`, detail: `+${challenge.points} points · +${res.ingest.scoreDelta} score`, fanId: fan.fan.id, href: `/app/fans/${fan.fan.id}` };
      }
      return { title: "Everyone completed the challenges", detail: "Create a new challenge to continue.", fanId: null };
    }

    case "reward_redemption": {
      const available = await db.select().from(rewards).where(and(eq(rewards.artistId, artistId), eq(rewards.status, "active"))).orderBy(rewards.pointCost);
      if (available.length === 0) return { title: "No active rewards", detail: "Create a reward first.", fanId: null };
      for (let attempt = 0; attempt < 6; attempt++) {
        const reward = pick(available);
        const fan = await randomFan(artistId, { minPoints: reward.pointCost });
        if (!fan) {
          // Give a random fan enough points to keep the demo moving.
          const any = await randomFan(artistId);
          if (!any) break;
          await awardPoints(db, { artistId, fanId: any.fan.id, amount: reward.pointCost, type: "CAMPAIGN", sourceId: `demo_topup:${Date.now()}`, description: "Fan event bonus" });
          continue;
        }
        try {
          await redeemReward({ artistId, fanId: fan.fan.id, rewardId: reward.id });
          return { title: `${fanDisplayName(fan.fan)} redeemed ${reward.name}`, detail: `-${reward.pointCost} points`, fanId: fan.fan.id, href: `/app/fans/${fan.fan.id}` };
        } catch {
          continue;
        }
      }
      return { title: "No eligible redemption", detail: "Fans need more points or rewards are sold out.", fanId: null };
    }
  }
}
