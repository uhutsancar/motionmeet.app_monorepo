import MediaDeletionJob from "../models/MediaDeletionJob.js";
import { deleteFromS3 } from "../utils/s3Utils.js";
import crypto from "node:crypto";

const uniqueKeys = (keys) => [
  ...new Set(keys.filter((key) => typeof key === "string" && key.length)),
];

export const queueMediaDeletions = async (keys, options = {}) => {
  const values = uniqueKeys(keys);
  if (!values.length) return;
  await MediaDeletionJob.bulkWrite(
    values.map((key) => ({
      updateOne: {
        filter: { key },
        update: {
          $setOnInsert: {
            key,
            attempts: 0,
            nextAttemptAt: new Date(),
            lastError: "",
          },
        },
        upsert: true,
      },
    })),
    options
  );
};

const recordFailure = async (job, claimToken, error) => {
  if (error?.code === "INVALID_S3_KEY") {
    await MediaDeletionJob.deleteOne({ _id: job._id, claimToken });
    return;
  }
  const attempts = job.attempts + 1;
  const retryDelayMs = Math.min(24 * 60 * 60 * 1000, 2 ** attempts * 60_000);
  await MediaDeletionJob.updateOne(
    { _id: job._id, claimToken },
    {
      $set: {
        attempts,
        nextAttemptAt: new Date(Date.now() + retryDelayMs),
        lastError: String(error?.message || "S3 deletion failed").slice(0, 500),
        claimToken: null,
        claimUntil: null,
      },
    }
  );
};

/**
 * @param {{limit?: number, keys?: string[]}} [options]
 */
export const processMediaDeletionJobs = async ({
  limit = 200,
  keys,
} = {}) => {
  let processed = 0;
  while (processed < limit) {
    const now = new Date();
    const claimToken = crypto.randomUUID();
    const job = await MediaDeletionJob.findOneAndUpdate(
      {
        ...(keys?.length ? { key: { $in: keys } } : {}),
        nextAttemptAt: { $lte: now },
        $or: [
          { claimUntil: null },
          { claimUntil: { $exists: false } },
          { claimUntil: { $lte: now } },
        ],
      },
      {
        $set: {
          claimToken,
          claimUntil: new Date(now.getTime() + 60_000),
        },
      },
      { new: true, sort: { nextAttemptAt: 1, _id: 1 } }
    );
    if (!job) break;
    try {
      await deleteFromS3(job.key);
      await MediaDeletionJob.deleteOne({ _id: job._id, claimToken });
    } catch (error) {
      await recordFailure(job, claimToken, error);
    }
    processed += 1;
  }

  return processed;
};

export const deleteMediaOrQueue = async (keys) => {
  const values = uniqueKeys(keys);
  if (!values.length) return;
  await queueMediaDeletions(values);
  await processMediaDeletionJobs({ limit: values.length, keys: values });
};
