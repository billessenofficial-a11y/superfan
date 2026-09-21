import { and, eq, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { artistFans, rewardPointTransactions } from "@/db/schema";

export type PointTransactionType = typeof rewardPointTransactions.$inferInsert.transactionType;

export class InsufficientPointsError extends Error {
  constructor(
    public readonly balance: number,
    public readonly required: number,
  ) {
    super(`Insufficient points: balance ${balance}, required ${required}`);
    this.name = "InsufficientPointsError";
  }
}

/** Recompute the cached balance from the ledger and return it. */
export async function refreshPointBalance(tx: DbOrTx, artistId: string, fanId: string): Promise<number> {
  const [row] = await tx
    .select({ balance: sql<number>`coalesce(sum(${rewardPointTransactions.amount}), 0)::int` })
    .from(rewardPointTransactions)
    .where(and(eq(rewardPointTransactions.artistId, artistId), eq(rewardPointTransactions.fanId, fanId)));
  const balance = row?.balance ?? 0;
  await tx
    .update(artistFans)
    .set({ rewardPointsCached: balance })
    .where(and(eq(artistFans.artistId, artistId), eq(artistFans.fanId, fanId)));
  return balance;
}

export async function getPointBalance(tx: DbOrTx, artistId: string, fanId: string): Promise<number> {
  const [row] = await tx
    .select({ balance: sql<number>`coalesce(sum(${rewardPointTransactions.amount}), 0)::int` })
    .from(rewardPointTransactions)
    .where(and(eq(rewardPointTransactions.artistId, artistId), eq(rewardPointTransactions.fanId, fanId)));
  return row?.balance ?? 0;
}

export type AwardPointsInput = {
  artistId: string;
  fanId: string;
  amount: number;
  type: PointTransactionType;
  /** Idempotency key within (artist, type). Re-awarding the same source is a no-op. */
  sourceId?: string | null;
  description: string;
  actorUserId?: string | null;
};

export type AwardResult = { applied: boolean; balance: number; transactionId: string | null };

/**
 * Append a positive ledger row. Idempotent on (artistId, type, sourceId).
 */
export async function awardPoints(tx: DbOrTx, input: AwardPointsInput): Promise<AwardResult> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error("awardPoints requires a positive integer amount");
  }
  const [row] = await tx
    .insert(rewardPointTransactions)
    .values({
      artistId: input.artistId,
      fanId: input.fanId,
      amount: input.amount,
      transactionType: input.type,
      sourceId: input.sourceId ?? null,
      description: input.description,
      actorUserId: input.actorUserId ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: rewardPointTransactions.id });
  const balance = await refreshPointBalance(tx, input.artistId, input.fanId);
  return { applied: Boolean(row), balance, transactionId: row?.id ?? null };
}

export type SpendPointsInput = {
  artistId: string;
  fanId: string;
  amount: number;
  type: PointTransactionType;
  sourceId?: string | null;
  description: string;
  actorUserId?: string | null;
};

/**
 * Append a negative ledger row after locking the fan's balance row.
 * Throws InsufficientPointsError when the balance would go negative.
 */
export async function spendPoints(tx: DbOrTx, input: SpendPointsInput): Promise<AwardResult> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error("spendPoints requires a positive integer amount");
  }
  // Serialize concurrent spends for this fan.
  await tx
    .select({ id: artistFans.id })
    .from(artistFans)
    .where(and(eq(artistFans.artistId, input.artistId), eq(artistFans.fanId, input.fanId)))
    .for("update");

  const balance = await getPointBalance(tx, input.artistId, input.fanId);
  if (balance < input.amount) throw new InsufficientPointsError(balance, input.amount);

  const [row] = await tx
    .insert(rewardPointTransactions)
    .values({
      artistId: input.artistId,
      fanId: input.fanId,
      amount: -input.amount,
      transactionType: input.type,
      sourceId: input.sourceId ?? null,
      description: input.description,
      actorUserId: input.actorUserId ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: rewardPointTransactions.id });
  const newBalance = await refreshPointBalance(tx, input.artistId, input.fanId);
  return { applied: Boolean(row), balance: newBalance, transactionId: row?.id ?? null };
}

/** Manual adjustment by a team member; may be positive or negative. Always audited by the caller. */
export async function adjustPoints(
  tx: DbOrTx,
  input: { artistId: string; fanId: string; amount: number; reason: string; actorUserId: string | null },
): Promise<AwardResult> {
  if (!Number.isInteger(input.amount) || input.amount === 0) {
    throw new Error("adjustPoints requires a non-zero integer amount");
  }
  if (input.amount < 0) {
    return spendPoints(tx, {
      artistId: input.artistId,
      fanId: input.fanId,
      amount: -input.amount,
      type: "MANUAL_ADJUSTMENT",
      description: input.reason,
      actorUserId: input.actorUserId,
    });
  }
  return awardPoints(tx, {
    artistId: input.artistId,
    fanId: input.fanId,
    amount: input.amount,
    type: "MANUAL_ADJUSTMENT",
    description: input.reason,
    actorUserId: input.actorUserId,
  });
}
