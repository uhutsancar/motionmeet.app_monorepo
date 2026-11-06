import cron, { type ScheduledTask } from "node-cron";
import { database, withTransaction } from "../configs/database.js";
import { extractS3Key } from "../utils/s3Utils.js";
import { runExclusive } from "../utils/advisoryLock.js";
import { processMediaDeletionJobs, queueMediaDeletions } from "../services/mediaDeletionService.js";
import { purgeOutboxHistory } from "../services/outboxService.js";
import { scheduledTaskDuration, scheduledTaskRuns } from "../observability/metrics.js";
import { childContext, runWithContext } from "../observability/context.js";
import { logger, safeErrorMetadata } from "../utils/logger.js";

/**
 * Story expiry here is housekeeping only. Every read path already filters on
 * `expires_at > now()`, so a story is gone for viewers at the 24-hour mark
 * even when this sweep runs minutes late; the sweep reclaims rows and media.
 */
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
  if (deleted) logger.info("expired_stories_deleted", { deleted });
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
const purgeEventHistory = async (): Promise<void> => {
  const purged = await purgeOutboxHistory();
  if (purged.outbox || purged.processed) logger.info("event_history_purged", purged);
};

interface TaskDefinition { name: string; schedule: string; run: () => Promise<void> }

/**
 * Every recurring job. None of them depends on another having run, and each
 * works in bounded, SKIP LOCKED batches, so a slow one delays only itself.
 *
 * The outbox is deliberately not here: it is drained continuously by the
 * outbox relay (messaging/outboxRelay.ts), not once a minute.
 */
export const SCHEDULED_TASKS: readonly TaskDefinition[] = [
  { name: "expired-stories", schedule: "*/5 * * * *", run: deleteExpiredStories },
  { name: "abandoned-uploads", schedule: "*/15 * * * *", run: deleteAbandonedUploads },
  { name: "expired-usage", schedule: "17 * * * *", run: deleteExpiredUsage },
  { name: "media-deletions", schedule: "*/10 * * * *", run: deleteQueuedMedia },
  { name: "event-history-retention", schedule: "41 3 * * *", run: purgeEventHistory },
];

/**
 * Runs one task if no other process is running it. The lock is a PostgreSQL
 * advisory lock (utils/advisoryLock.ts): with any number of scheduler or API
 * replicas, one runs it and the rest record `skipped_locked`.
 */
export const runScheduledTask = async (task: TaskDefinition): Promise<"ran" | "skipped_locked" | "failed"> =>
  runWithContext(childContext({}), async () => {
    const endTimer = scheduledTaskDuration.startTimer({ task: task.name });
    try {
      const ran = await runExclusive(`scheduled:${task.name}`, task.run);
      const outcome = ran ? "ran" : "skipped_locked";
      if (ran) endTimer();
      scheduledTaskRuns.inc({ task: task.name, outcome });
      return outcome;
    } catch (error: unknown) {
      scheduledTaskRuns.inc({ task: task.name, outcome: "failed" });
      logger.error("scheduled_task_failed", { task: task.name, ...safeErrorMetadata(error) });
      return "failed";
    }
  });

export interface CronHandle {
  /** Stops scheduling and waits for runs already in progress to finish. */
  stop: () => Promise<void>;
}

export const initCronJobs = (): CronHandle => {
  if (process.env.RUN_SCHEDULED_JOBS === "false") return { stop: async () => undefined };
  const inFlight = new Map<string, Promise<unknown>>();
  const tasks: ScheduledTask[] = SCHEDULED_TASKS.map((task) => cron.schedule(task.schedule, () => {
    // A run still going when its next tick fires is left alone rather than
    // doubled up in this process; other processes are held off by the lock.
    if (inFlight.has(task.name)) return;
    const run = runScheduledTask(task).finally(() => inFlight.delete(task.name));
    inFlight.set(task.name, run);
  }));
  logger.info("scheduled_jobs_initialized", { tasks: SCHEDULED_TASKS.map((task) => task.name) });
  return {
    stop: async () => {
      await Promise.all(tasks.map((task) => task.stop()));
      await Promise.allSettled(inFlight.values());
    },
  };
};
