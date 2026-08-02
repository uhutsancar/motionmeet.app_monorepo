import cron, { type ScheduledTask } from "node-cron";
import { database, withTransaction } from "../configs/database.js";
import { runWithRedisLock } from "../configs/redis.js";
import { extractS3Key } from "../utils/s3Utils.js";
import { processMediaDeletionJobs, queueMediaDeletions } from "../services/mediaDeletionService.js";
import { processOutboxEvents } from "../services/outboxService.js";
import { logger, safeErrorMetadata } from "../utils/logger.js";

const deleteExpiredStories = async (): Promise<void> => {
  let deleted = 0;
  while (true) {
    const claimed = await withTransaction(async (transaction) => {
      const rows = await transaction.selectFrom("stories").select(["id", "media_url", "media_key"]).where("expires_at", "<=", new Date()).orderBy("expires_at").orderBy("id").forUpdate().skipLocked().limit(200).execute();
      if (!rows.length) return 0;
      await queueMediaDeletions(rows.map((row) => row.media_key || extractS3Key(row.media_url)), { transaction });
      await transaction.deleteFrom("stories").where("id", "in", rows.map((row) => row.id)).execute();
      return rows.length;
    });
    deleted += claimed; if (claimed < 200) break;
  }
  if (deleted) console.log(`Deleted ${deleted} expired stories (media queued).`);
};

const deleteAbandonedUploads = async (): Promise<void> => {
  while (true) {
    const claimed = await withTransaction(async (transaction) => {
      const rows = await transaction.selectFrom("upload_reservations").select(["id", "object_key"]).where("expires_at", "<", new Date()).orderBy("expires_at").orderBy("id").forUpdate().skipLocked().limit(200).execute();
      if (!rows.length) return 0;
      await queueMediaDeletions(rows.map((row) => row.object_key), { transaction });
      await transaction.deleteFrom("upload_reservations").where("id", "in", rows.map((row) => row.id)).execute();
      return rows.length;
    });
    if (claimed < 200) break;
  }
};

const deleteExpiredUsage = async (): Promise<void> => { await database.deleteFrom("usage_counters").where("expires_at", "<", new Date()).execute(); };
const deleteQueuedMedia = async (): Promise<void> => { while (await processMediaDeletionJobs() === 200) { /* bounded batches */ } };
const processOutbox = async (): Promise<void> => { while (await processOutboxEvents() === 200) { /* bounded batches */ } };
const report = (label: string) => (error: unknown): void => logger.error(label, safeErrorMetadata(error));

export const initCronJobs = (): ScheduledTask[] => {
  if (process.env.RUN_SCHEDULED_JOBS === "false") return [];
  const tasks = [
    cron.schedule("*/5 * * * *", () => { void runWithRedisLock("expired-stories", 240, deleteExpiredStories).catch(report("Story cleanup failed:")); }),
    cron.schedule("*/15 * * * *", () => { void runWithRedisLock("abandoned-uploads", 840, deleteAbandonedUploads).catch(report("Upload cleanup failed:")); }),
    cron.schedule("17 * * * *", () => { void runWithRedisLock("expired-usage", 1800, deleteExpiredUsage).catch(report("Usage cleanup failed:")); }),
    cron.schedule("*/10 * * * *", () => { void deleteQueuedMedia().catch(report("Media deletion failed:")); }),
    cron.schedule("* * * * *", () => { void processOutbox().catch(report("Outbox processing failed:")); }),
  ];
  console.log("Background cron jobs initialized successfully.");
  return tasks;
};
