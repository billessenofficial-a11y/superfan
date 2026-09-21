import type { DbOrTx } from "@/db";
import { analyticsEvents, auditLogs } from "@/db/schema";

export type AuditAction =
  | "integration.connected"
  | "integration.disconnected"
  | "points.adjusted"
  | "score.adjusted"
  | "fan.merged"
  | "fan.note_added"
  | "fan.tagged"
  | "fan.attendance_verified"
  | "reward.created"
  | "reward.edited"
  | "reward.fulfilled"
  | "challenge.created"
  | "challenge.edited"
  | "event.created"
  | "event.edited"
  | "event.secret_rotated"
  | "segment.created"
  | "segment.edited"
  | "campaign.created"
  | "campaign.edited"
  | "score_rule.changed"
  | "score_weights.changed"
  | "levels.changed"
  | "csv.imported"
  | "member.invited"
  | "member.removed"
  | "artist.created"
  | "artist.updated"
  | "demo.event_generated"
  | (string & {});

export async function audit(
  tx: DbOrTx,
  input: {
    artistId: string | null;
    actorUserId: string | null;
    actorLabel?: string | null;
    action: AuditAction;
    targetType?: string | null;
    targetId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await tx.insert(auditLogs).values({
    artistId: input.artistId,
    actorUserId: input.actorUserId,
    actorLabel: input.actorLabel ?? null,
    action: input.action,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    metadata: input.metadata ?? {},
  });
}

export type ProductEvent =
  | "artist_created"
  | "integration_started"
  | "integration_connected"
  | "fan_import_completed"
  | "fan_profile_viewed"
  | "segment_created"
  | "challenge_created"
  | "reward_created"
  | "event_created"
  | "fan_joined"
  | "fan_left"
  | "challenge_completed"
  | "reward_redeemed"
  | "event_checked_in"
  | "referral_completed"
  | "identity_claimed";

/**
 * Product analytics. Only ids and non-sensitive properties are recorded;
 * never fan content (comments, DMs, addresses).
 */
export async function track(
  tx: DbOrTx,
  name: ProductEvent,
  ctx: { artistId?: string | null; userId?: string | null; fanId?: string | null },
  properties: Record<string, string | number | boolean | null> = {},
) {
  try {
    await tx.insert(analyticsEvents).values({
      name,
      artistId: ctx.artistId ?? null,
      userId: ctx.userId ?? null,
      fanId: ctx.fanId ?? null,
      properties,
    });
  } catch (err) {
    // Analytics must never break product flows.
    console.warn("[analytics] failed to record", name, err);
  }
}
