import type { SegmentCondition, SegmentGroup } from "@/db/schema";

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


export const EMPTY_SEGMENT: SegmentGroup = { kind: "group", match: "all", children: [] };
