import MediaDeletionJob from "../models/MediaDeletionJob.js";
import { deleteFromS3 } from "../utils/s3Utils.js";

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

const recordFailure = async (job, error) => {
  if (error?.code === "INVALID_S3_KEY") {
    await MediaDeletionJob.deleteOne({ _id: job._id });
    return;
  }
  const attempts = job.attempts + 1;
  const retryDelayMs = Math.min(24 * 60 * 60 * 1000, 2 ** attempts * 60_000);
  await MediaDeletionJob.updateOne(
    { _id: job._id },
    {
      $set: {
        attempts,
        nextAttemptAt: new Date(Date.now() + retryDelayMs),
        lastError: String(error?.message || "S3 deletion failed").slice(0, 500),
      },
    }
  );
};

export const processMediaDeletionJobs = async ({ limit = 200 } = {}) => {
  const jobs = await MediaDeletionJob.find({
    nextAttemptAt: { $lte: new Date() },
  })
    .sort({ nextAttemptAt: 1 })
    .limit(limit);

  for (const job of jobs) {
    try {
      await deleteFromS3(job.key);
      await MediaDeletionJob.deleteOne({ _id: job._id });
    } catch (error) {
      await recordFailure(job, error);
    }
  }

  return jobs.length;
};

export const deleteMediaOrQueue = async (keys) => {
  const values = uniqueKeys(keys);
  if (!values.length) return;
  await queueMediaDeletions(values);

  const jobs = await MediaDeletionJob.find({ key: { $in: values } });
  for (const job of jobs) {
    try {
      await deleteFromS3(job.key);
      await MediaDeletionJob.deleteOne({ _id: job._id });
    } catch (error) {
      await recordFailure(job, error);
    }
  }
};
