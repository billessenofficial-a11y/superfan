import { and, eq, or, sql, type SQL } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { artistFans, fans, type SegmentCondition, type SegmentGroup, type SegmentNode } from "@/db/schema";
import { z } from "zod";

/**
 * Field catalog for the segment builder. Every field maps to a SQL expression
 * evaluated against `artist_fans af JOIN fans f`.
 */
export type SegmentFieldType = "text" | "number" | "money" | "days" | "boolean" | "level" | "tag" | "event" | "source";

export type SegmentField = {
  key: string;
  label: string;
  group: string;
  type: SegmentFieldType;
  operators: SegmentCondition["operator"][];
};

const TEXT_OPS: SegmentCondition["operator"][] = ["eq", "neq", "contains", "not_contains", "is_known", "is_unknown"];
const NUM_OPS: SegmentCondition["operator"][] = ["eq", "neq", "gt", "lt", "gte", "lte"];
const KNOWN_OPS: SegmentCondition["operator"][] = ["is_known", "is_unknown"];

export const SEGMENT_FIELDS: SegmentField[] = [
  { key: "city", label: "City", group: "Location", type: "text", operators: TEXT_OPS },
  { key: "region", label: "Region / State", group: "Location", type: "text", operators: TEXT_OPS },
  { key: "country", label: "Country", group: "Location", type: "text", operators: TEXT_OPS },

  { key: "superfan_score", label: "Superfan Score", group: "Status", type: "number", operators: NUM_OPS },
  { key: "level", label: "Level", group: "Status", type: "level", operators: ["eq", "neq", "gte", "lte"] },
  { key: "reward_points", label: "Reward Points", group: "Status", type: "number", operators: NUM_OPS },
  { key: "last_active_days", label: "Days since last active", group: "Status", type: "days", operators: NUM_OPS },
  { key: "member_days", label: "Days since first seen", group: "Status", type: "days", operators: NUM_OPS },
  { key: "joined", label: "Joined fan club", group: "Status", type: "boolean", operators: KNOWN_OPS },

  { key: "lifetime_spend", label: "Lifetime spend ($)", group: "Commerce", type: "money", operators: NUM_OPS },
  { key: "orders_count", label: "Orders", group: "Commerce", type: "number", operators: NUM_OPS },
  { key: "shopify_customer", label: "Shopify customer", group: "Commerce", type: "boolean", operators: KNOWN_OPS },

  { key: "events_attended", label: "Concerts attended", group: "Attendance", type: "number", operators: NUM_OPS },
  { key: "attended_event", label: "Attended specific event", group: "Attendance", type: "event", operators: ["eq", "neq"] },
  { key: "upcoming_ticket", label: "Has ticket to upcoming event", group: "Attendance", type: "event", operators: ["eq", "neq"] },

  { key: "instagram_interactions", label: "Instagram interactions", group: "Engagement", type: "number", operators: NUM_OPS },
  { key: "instagram_username", label: "Instagram username", group: "Engagement", type: "text", operators: TEXT_OPS },
  { key: "referrals_count", label: "Referrals", group: "Engagement", type: "number", operators: NUM_OPS },
  { key: "challenges_completed", label: "Challenges completed", group: "Engagement", type: "number", operators: NUM_OPS },

  { key: "email", label: "Email", group: "Identity", type: "text", operators: TEXT_OPS },
  { key: "phone", label: "Phone", group: "Identity", type: "text", operators: KNOWN_OPS },
  { key: "tag", label: "Tag", group: "Identity", type: "tag", operators: ["eq", "neq"] },
  { key: "source", label: "First source", group: "Identity", type: "source", operators: ["eq", "neq"] },
];

const fieldByKey = new Map(SEGMENT_FIELDS.map((f) => [f.key, f]));

/* ───────────────────────── Validation ───────────────────────── */

const conditionSchema: z.ZodType<SegmentCondition> = z.object({
  kind: z.literal("condition"),
  field: z.string().refine((k) => fieldByKey.has(k), "Unknown field"),
  operator: z.enum(["eq", "neq", "gt", "lt", "gte", "lte", "contains", "not_contains", "is_known", "is_unknown"]),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
});

export const segmentGroupSchema: z.ZodType<SegmentGroup> = z.lazy(() =>
  z.object({
    kind: z.literal("group"),
    match: z.enum(["all", "any"]),
    children: z.array(z.union([conditionSchema, segmentGroupSchema])).max(50),
  }),
);

/* ───────────────────────── SQL compilation ───────────────────────── */

function numberValue(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) throw new Error("Expected a number");
  return n;
}

function compare(expr: SQL, op: SegmentCondition["operator"], value: SQL): SQL {
  switch (op) {
    case "eq":
      return sql`${expr} = ${value}`;
    case "neq":
      return sql`${expr} <> ${value}`;
    case "gt":
      return sql`${expr} > ${value}`;
    case "lt":
      return sql`${expr} < ${value}`;
    case "gte":
      return sql`${expr} >= ${value}`;
    case "lte":
      return sql`${expr} <= ${value}`;
    default:
      throw new Error(`Operator ${op} not supported here`);
  }
}

function textCondition(expr: SQL, op: SegmentCondition["operator"], value: unknown): SQL {
  const v = String(value ?? "").trim().toLowerCase();
  switch (op) {
    case "eq":
      return sql`lower(${expr}) = ${v}`;
    case "neq":
      return sql`coalesce(lower(${expr}), '') <> ${v}`;
    case "contains":
      return sql`lower(${expr}) like ${"%" + v + "%"}`;
    case "not_contains":
      return sql`coalesce(lower(${expr}), '') not like ${"%" + v + "%"}`;
    case "is_known":
      return sql`${expr} is not null and ${expr} <> ''`;
    case "is_unknown":
      return sql`(${expr} is null or ${expr} = '')`;
    default:
      throw new Error(`Operator ${op} not valid for text`);
  }
}

function conditionToSql(c: SegmentCondition): SQL {
  const field = fieldByKey.get(c.field);
  if (!field) throw new Error(`Unknown segment field ${c.field}`);
  const af = artistFans;
  const f = fans;

  switch (c.field) {
    case "city":
      return textCondition(sql`${f.city}`, c.operator, c.value);
    case "region":
      return textCondition(sql`${f.region}`, c.operator, c.value);
    case "country":
      return textCondition(sql`${f.country}`, c.operator, c.value);
    case "email":
      return textCondition(sql`${f.email}`, c.operator, c.value);
    case "phone":
      return textCondition(sql`${f.phone}`, c.operator, c.value);

    case "superfan_score":
      return compare(sql`${af.superfanScore}`, c.operator, sql`${numberValue(c.value)}`);
    case "reward_points":
      return compare(sql`${af.rewardPointsCached}`, c.operator, sql`${numberValue(c.value)}`);
    case "orders_count":
      return compare(sql`${af.ordersCount}`, c.operator, sql`${numberValue(c.value)}`);
    case "events_attended":
      return compare(sql`${af.eventsAttendedCount}`, c.operator, sql`${numberValue(c.value)}`);
    case "instagram_interactions":
      return compare(sql`${af.instagramInteractionsCount}`, c.operator, sql`${numberValue(c.value)}`);
    case "referrals_count":
      return compare(sql`${af.referralsCount}`, c.operator, sql`${numberValue(c.value)}`);
    case "challenges_completed":
      return compare(sql`${af.challengesCompletedCount}`, c.operator, sql`${numberValue(c.value)}`);
    case "lifetime_spend":
      return compare(sql`${af.lifetimeSpendCents}`, c.operator, sql`${Math.round(numberValue(c.value) * 100)}`);
    case "last_active_days":
      return compare(
        sql`extract(epoch from (now() - coalesce(${af.lastActiveAt}, ${af.firstSeenAt}))) / 86400`,
        c.operator,
        sql`${numberValue(c.value)}`,
      );
    case "member_days":
      return compare(sql`extract(epoch from (now() - ${af.firstSeenAt})) / 86400`, c.operator, sql`${numberValue(c.value)}`);

    case "joined":
      return c.operator === "is_known" ? sql`${af.joinedAt} is not null` : sql`${af.joinedAt} is null`;

    case "level": {
      const levelId = String(c.value ?? "");
      const rank = sql`(select fl.sort_order from fan_levels fl where fl.id = ${af.levelId})`;
      const target = sql`(select fl2.sort_order from fan_levels fl2 where fl2.id = ${levelId}::uuid)`;
      if (c.operator === "eq") return sql`${af.levelId} = ${levelId}::uuid`;
      if (c.operator === "neq") return sql`coalesce(${af.levelId}::text, '') <> ${levelId}`;
      return compare(sql`coalesce(${rank}, -1)`, c.operator, target);
    }

    case "tag": {
      const tagId = String(c.value ?? "");
      const exists = sql`exists (select 1 from fan_tag_assignments ta where ta.fan_id = ${af.fanId} and ta.artist_id = ${af.artistId} and ta.tag_id = ${tagId}::uuid)`;
      return c.operator === "eq" ? exists : sql`not ${exists}`;
    }

    case "source": {
      const src = String(c.value ?? "");
      return c.operator === "eq" ? sql`${af.firstSource} = ${src}::event_source` : sql`coalesce(${af.firstSource}::text, '') <> ${src}`;
    }

    case "shopify_customer": {
      const exists = sql`exists (select 1 from fan_identities fi where fi.fan_id = ${af.fanId} and fi.provider = 'shopify' and (fi.artist_id = ${af.artistId} or fi.artist_id is null))`;
      return c.operator === "is_known" ? exists : sql`not ${exists}`;
    }

    case "instagram_username": {
      const expr = sql`(select fi.username from fan_identities fi where fi.fan_id = ${af.fanId} and fi.provider = 'instagram' order by fi.claimed desc, fi.last_seen_at desc nulls last limit 1)`;
      return textCondition(expr, c.operator, c.value);
    }

    case "attended_event": {
      const eventId = String(c.value ?? "");
      const exists = sql`exists (select 1 from event_checkins ec where ec.fan_id = ${af.fanId} and ec.event_id = ${eventId}::uuid)`;
      return c.operator === "eq" ? exists : sql`not ${exists}`;
    }

    case "upcoming_ticket": {
      const eventId = String(c.value ?? "");
      const exists = sql`exists (select 1 from fan_events fe where fe.fan_id = ${af.fanId} and fe.artist_id = ${af.artistId} and fe.type = 'csv.ticket_purchase' and fe.metadata->>'eventId' = ${eventId})`;
      return c.operator === "eq" ? exists : sql`not ${exists}`;
    }
  }
  throw new Error(`Unhandled segment field ${c.field}`);
}

/** Compile a rule tree into a WHERE fragment for `artist_fans af JOIN fans f`. */
export function compileSegment(node: SegmentNode): SQL {
  if (node.kind === "condition") return conditionToSql(node);
  if (node.children.length === 0) return sql`true`;
  const parts = node.children.map(compileSegment);
  const combined = node.match === "all" ? and(...parts) : or(...parts);
  return combined ?? sql`true`;
}

export async function countSegment(tx: DbOrTx, artistId: string, rules: SegmentGroup): Promise<number> {
  const where = compileSegment(rules);
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(artistFans)
    .innerJoin(fans, eq(fans.id, artistFans.fanId))
    .where(and(eq(artistFans.artistId, artistId), sql`${fans.mergedIntoFanId} is null`, where));
  return row?.count ?? 0;
}

export function describeCondition(c: SegmentCondition, lookups: { levels?: Map<string, string>; tags?: Map<string, string>; events?: Map<string, string> } = {}): string {
  const field = fieldByKey.get(c.field);
  const label = field?.label ?? c.field;
  const opText: Record<SegmentCondition["operator"], string> = {
    eq: "=",
    neq: "≠",
    gt: ">",
    lt: "<",
    gte: "≥",
    lte: "≤",
    contains: "contains",
    not_contains: "does not contain",
    is_known: "is known",
    is_unknown: "is unknown",
  };
  if (c.operator === "is_known" || c.operator === "is_unknown") return `${label} ${opText[c.operator]}`;
  let value = String(c.value ?? "");
  if (field?.type === "level") value = lookups.levels?.get(value) ?? value;
  if (field?.type === "tag") value = lookups.tags?.get(value) ?? value;
  if (field?.type === "event") value = lookups.events?.get(value) ?? value;
  if (field?.type === "money") value = `$${value}`;
  return `${label} ${opText[c.operator]} ${value}`;
}

export const EMPTY_SEGMENT: SegmentGroup = { kind: "group", match: "all", children: [] };
