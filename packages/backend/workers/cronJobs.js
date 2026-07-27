import cron from "node-cron";
import Story from "../models/Story.js";
import Post from "../models/Post.js";
import User from "../models/User.js";
import { extractS3Key } from "../utils/s3Utils.js";
import { runWithRedisLock, getAndClearBufferedIncrements } from "../configs/redis.js";
import UploadReservation from "../models/UploadReservation.js";
import {
  deleteMediaOrQueue,
  processMediaDeletionJobs,
} from "../services/mediaDeletionService.js";

const deleteExpiredStories = async () => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let deleted = 0;

  while (true) {
    const expiredStories = await Story.find({ createdAt: { $lt: oneDayAgo } })
      .select("media_url +media_key")
      .sort({ createdAt: 1 })
      .limit(200);
    if (!expiredStories.length) break;

    for (const story of expiredStories) {
      const key = story.media_key || extractS3Key(story.media_url);
      await Story.deleteOne({ _id: story._id });
      if (key) await deleteMediaOrQueue([key]);
      deleted += 1;
    }
  }

  if (deleted) console.log(`Deleted ${deleted} expired stories.`);
};

const deleteAbandonedUploads = async () => {
  while (true) {
    const reservations = await UploadReservation.find({
      expiresAt: { $lt: new Date() },
    })
      .sort({ expiresAt: 1 })
      .limit(200);
    if (!reservations.length) break;
    await deleteMediaOrQueue(
      reservations.map((reservation) => reservation.key)
    );
    await UploadReservation.deleteMany({
      _id: { $in: reservations.map((reservation) => reservation._id) },
    });
  }
};

const deleteQueuedMedia = async () => {
  while ((await processMediaDeletionJobs()) === 200) {
    // Continue in bounded batches while due work remains.
  }
};

const flushRedisBuffers = async () => {
  const buffers = [
    { type: "post_likes", model: Post, field: "like_count" },
    { type: "post_comments", model: Post, field: "comment_count" },
    { type: "post_shares", model: Post, field: "share_count" },
    { type: "post_downloads", model: Post, field: "download_count" },
    { type: "followers_count", model: User, field: "followers_count" },
    { type: "following_count", model: User, field: "following_count" },
    { type: "connections_count", model: User, field: "connections_count" },
  ];

  for (const { type, model, field } of buffers) {
    const data = await getAndClearBufferedIncrements(type);
    const operations = Object.entries(data).map(([id, value]) => ({
      updateOne: {
        filter: { _id: id },
        update: { $inc: { [field]: parseInt(value, 10) } },
      }
    }));
    if (operations.length) {
      await model.bulkWrite(operations);
    }
  }
};

export const initCronJobs = () => {
  if (process.env.RUN_SCHEDULED_JOBS === "false") {
    console.log("Background cron jobs disabled for this process.");
    return [];
  }

  const storyTask = cron.schedule("0 * * * *", () => {
    void runWithRedisLock("expired-stories", 55 * 60, deleteExpiredStories)
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
    void runWithRedisLock(
      "queued-media-deletions",
      9 * 60,
      deleteQueuedMedia
    ).catch((error) =>
      console.error("Error in queued media deletion:", error.message)
    );
  });

  const flushBufferTask = cron.schedule("* * * * *", () => {
    void runWithRedisLock(
      "flush-redis-buffers",
      50,
      flushRedisBuffers
    ).catch((error) =>
      console.error("Error in flush buffer cron:", error.message)
    );
  });

  console.log("Background cron jobs initialized successfully.");
  return [
    storyTask,
    abandonedUploadTask,
    mediaDeletionTask,
    flushBufferTask,
  ];
};
