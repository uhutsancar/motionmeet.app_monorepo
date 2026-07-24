import cron from "node-cron";
import Story from "../models/Story.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import sendEmail from "../configs/nodeMailer.js";
import { extractS3Key } from "../utils/s3Utils.js";
import { runWithRedisLock } from "../configs/redis.js";
import { escapeHtml } from "../utils/html.js";
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

const sendUnseenMessageEmails = async () => {
  const counts = await Message.aggregate([
    { $match: { seen: false } },
    { $group: { _id: "$to_user_id", count: { $sum: 1 } } },
  ]);
  const countByUser = new Map(
    counts.map(({ _id, count }) => [_id.toString(), count])
  );
  const users = await User.find({
    _id: { $in: [...countByUser.keys()] },
  })
    .select("email full_name")
    .lean();

  for (let index = 0; index < users.length; index += 20) {
    const batch = users.slice(index, index + 20);
    await Promise.allSettled(
      batch.map((user) =>
        sendEmail({
          to: user.email,
          subject: `You have ${countByUser.get(user._id)} unseen messages`,
          body: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
              <h2>Hi ${escapeHtml(user.full_name)},</h2>
              <p>You have ${countByUser.get(user._id)} unseen messages waiting for you.</p>
              <p>Click <a href="${process.env.FRONTEND_URL}/messages">here</a> to view them.</p>
              <p>Thanks,<br/>MotionMeet</p>
            </div>`,
        })
      )
    );
  }
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

  const unseenMessageTask = cron.schedule(
    "0 9 * * *",
    () => {
      void runWithRedisLock(
        "unseen-message-email",
        23 * 60 * 60,
        sendUnseenMessageEmails
      ).catch((error) =>
        console.error("Error in unseen messages cron:", error.message)
      );
    },
    { timezone: "Europe/Istanbul" }
  );

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

  console.log("Background cron jobs initialized successfully.");
  return [
    storyTask,
    unseenMessageTask,
    abandonedUploadTask,
    mediaDeletionTask,
  ];
};
