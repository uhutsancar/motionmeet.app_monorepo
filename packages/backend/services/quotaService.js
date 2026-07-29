import Usage from "../models/Usage.js";

/**
 * @param {string} userId
 * @param {string} bucket
 * @param {() => Promise<number> | import("mongoose").Query<number, any>} getCurrentCount
 * @param {{session?: import("mongoose").ClientSession | null, expiresAt?: Date | null}} [options]
 */
const ensureCounter = async (
  userId,
  bucket,
  getCurrentCount,
  { session = null, expiresAt = null } = {}
) => {
  let usage = await Usage.findOne({ userId, bucket }).session(session || null);
  if (usage) return usage;

  const currentCount = await getCurrentCount();
  usage = await Usage.findOneAndUpdate(
    { userId, bucket },
    {
      $setOnInsert: {
        userId,
        bucket,
        count: currentCount,
        expiresAt: expiresAt || null,
      },
    },
    { upsert: true, new: true, session, setDefaultsOnInsert: true }
  );
  return usage;
};

export const reserveQuota = async ({
  userId,
  bucket,
  limit,
  getCurrentCount,
  session = null,
  expiresAt = null,
}) => {
  if (limit === -1) return true;

  let usage = await ensureCounter(userId, bucket, getCurrentCount, {
    session,
    expiresAt,
  });
  if (!usage) throw new Error("Quota counter could not be initialized");

  if (usage.count >= limit) {
    const actualCount = await getCurrentCount();
    if (actualCount < usage.count) {
      usage = await Usage.findOneAndUpdate(
        { _id: usage._id },
        { count: actualCount },
        { new: true, session }
      );
    }
  }

  const reserved = await Usage.findOneAndUpdate(
    { _id: usage._id, count: { $lt: limit } },
    { $inc: { count: 1 } },
    { new: true, session }
  );
  return Boolean(reserved);
};

/**
 * @param {string} userId
 * @param {string} bucket
 * @param {{session?: import("mongoose").ClientSession | null}} [options]
 */
export const releaseQuota = async (
  userId,
  bucket,
  { session = null } = {}
) => {
  await Usage.updateOne(
    { userId, bucket, count: { $gt: 0 } },
    { $inc: { count: -1 } },
    { session }
  );
};

export const workoutBucket = (date = new Date()) =>
  `workouts:${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

export const routineBucket = "routines:lifetime";

export const dailyBucket = (type, date = new Date()) =>
  `${type}:${date.toISOString().slice(0, 10)}`;

export const shortLivedUsageExpiry = (date = new Date()) => {
  const expiresAt = new Date(date);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + 2);
  return expiresAt;
};

export const monthlyUsageExpiry = (date = new Date()) => {
  const expiresAt = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 18, 1)
  );
  return expiresAt;
};
