import { database, type DatabaseTransaction } from "../configs/database.js";

export interface QuotaReservation {
  userId: string;
  bucket: string;
  limit: number;
  getCurrentCount: () => Promise<number>;
  transaction: DatabaseTransaction;
  expiresAt?: Date | null;
}

export const reserveQuota = async ({ userId, bucket, limit, getCurrentCount, transaction, expiresAt = null }: QuotaReservation): Promise<boolean> => {
  if (limit === -1) return true;
  const currentCount = await getCurrentCount();
  await transaction.insertInto("usage_counters").values({
    legacy_mongo_id: null, user_id: userId, bucket, count: currentCount, expires_at: expiresAt,
  }).onConflict((conflict) => conflict.columns(["user_id", "bucket"]).doNothing()).execute();
  const updated = await transaction.updateTable("usage_counters").set((expression) => ({ count: expression("count", "+", 1) }))
    .where("user_id", "=", userId).where("bucket", "=", bucket).where("count", "<", limit).returning("id").executeTakeFirst();
  return Boolean(updated);
};

export const releaseQuota = async (userId: string, bucket: string, transaction?: DatabaseTransaction): Promise<void> => {
  const executor = transaction ?? database;
  await executor.updateTable("usage_counters").set((expression) => ({ count: expression.fn<number>("greatest", [expression("count", "-", 1), expression.val(0)]) }))
    .where("user_id", "=", userId).where("bucket", "=", bucket).execute();
};

export const workoutBucket = (date = new Date()): string => `workouts:${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
export const routineBucket = "routines:lifetime";
export const dailyBucket = (type: string, date = new Date()): string => `${type}:${date.toISOString().slice(0, 10)}`;
export const shortLivedUsageExpiry = (date = new Date()): Date => { const result = new Date(date); result.setUTCDate(result.getUTCDate() + 2); return result; };
export const monthlyUsageExpiry = (date = new Date()): Date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 18, 1));
