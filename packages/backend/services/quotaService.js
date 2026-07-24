import Usage from "../models/Usage.js";

const ensureCounter = async (userId, bucket, getCurrentCount) => {
  let usage = await Usage.findOne({ userId, bucket });
  if (usage) return usage;

  const currentCount = await getCurrentCount();
  try {
    usage = await Usage.create({ userId, bucket, count: currentCount });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    usage = await Usage.findOne({ userId, bucket });
  }
  return usage;
};

export const reserveQuota = async ({
  userId,
  bucket,
  limit,
  getCurrentCount,
}) => {
  if (limit === -1) return true;

  const usage = await ensureCounter(userId, bucket, getCurrentCount);
  if (!usage) throw new Error("Quota counter could not be initialized");

  const reserved = await Usage.findOneAndUpdate(
    { _id: usage._id, count: { $lt: limit } },
    { $inc: { count: 1 } },
    { new: true }
  );
  return Boolean(reserved);
};

export const releaseQuota = async (userId, bucket) => {
  await Usage.updateOne(
    { userId, bucket, count: { $gt: 0 } },
    { $inc: { count: -1 } }
  );
};

export const workoutBucket = (date = new Date()) =>
  `workouts:${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

export const routineBucket = "routines:lifetime";
