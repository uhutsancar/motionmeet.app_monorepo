import cron from "node-cron";
import mongoose from "mongoose";
import Story from "../models/Story.js";
import StoryView from "../models/StoryView.js";
import { extractS3Key } from "../utils/s3Utils.js";
import { runWithRedisLock } from "../configs/redis.js";
import UploadReservation from "../models/UploadReservation.js";
import {
  processMediaDeletionJobs,
  queueMediaDeletions,
} from "../services/mediaDeletionService.js";
import { processOutboxEvents } from "../services/outboxService.js";

const deleteExpiredStories = async () => {
  // Medya kuyruğu, StoryView ve Story silme işlemi aynı transaction'dadır.
  const now = new Date();
  let deleted = 0;

  while (true) {
    const expiredStories = await Story.find({ expiresAt: { $lte: now } })
      .select("media_url +media_key")
      .sort({ expiresAt: 1 })
      .limit(200);
    if (!expiredStories.length) break;

    const storyIds = expiredStories.map((story) => story._id);
    const keys = expiredStories
      .map((story) => story.media_key || extractS3Key(story.media_url))
      .filter(Boolean);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await queueMediaDeletions(keys, { session });
        await StoryView.deleteMany(
          { storyId: { $in: storyIds } },
          { session }
        );
        const result = await Story.deleteMany(
          { _id: { $in: storyIds }, expiresAt: { $lte: now } },
          { session }
        );
        deleted += result.deletedCount;
      });
    } finally {
      await session.endSession();
    }
  }

  if (deleted) console.log(`Deleted ${deleted} expired stories (media queued).`);
};

const deleteAbandonedUploads = async () => {
  while (true) {
    const session = await mongoose.startSession();
    let claimed = 0;
    try {
      await session.withTransaction(async () => {
        const reservations = await UploadReservation.find({
          expiresAt: { $lt: new Date() },
        })
          .sort({ expiresAt: 1, _id: 1 })
          .limit(200)
          .session(session);
        if (!reservations.length) return;
        claimed = reservations.length;
        await queueMediaDeletions(
          reservations.map((reservation) => reservation.key),
          { session }
        );
        await UploadReservation.deleteMany(
          { _id: { $in: reservations.map((reservation) => reservation._id) } },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }
    if (!claimed) break;
  }
};

const deleteQueuedMedia = async () => {
  while ((await processMediaDeletionJobs()) === 200) {
    // Continue in bounded batches while due work remains.
  }
};

const processOutbox = async () => {
  while ((await processOutboxEvents()) === 200) {
    // Continue in bounded batches while due work remains.
  }
};

export const initCronJobs = () => {
  if (process.env.RUN_SCHEDULED_JOBS === "false") {
    console.log("Background cron jobs disabled for this process.");
    return [];
  }

  const storyTask = cron.schedule("*/5 * * * *", () => {
    void runWithRedisLock("expired-stories", 4 * 60, deleteExpiredStories)
      .catch((error) =>
        console.error("Error in story deletion cron:", error.message)
      );
  });

  const abandonedUploadTask = cron.schedule("*/15 * * * *", () => {
    void runWithRedisLock(
      "abandoned-uploads",
      14 * 60,
      deleteAbandonedUploads
    ).catch((error) =>
      console.error("Error in abandoned upload cleanup:", error.message)
    );
  });

  const mediaDeletionTask = cron.schedule("*/10 * * * *", () => {
    void deleteQueuedMedia().catch((error) =>
      console.error("Error in queued media deletion:", error.message)
    );
  });

  const outboxTask = cron.schedule("* * * * *", () => {
    void processOutbox().catch((error) =>
      console.error("Error in outbox processor:", error.message)
    );
  });

  console.log("Background cron jobs initialized successfully.");
  return [
    storyTask,
    abandonedUploadTask,
    mediaDeletionTask,
    outboxTask,
  ];
};
