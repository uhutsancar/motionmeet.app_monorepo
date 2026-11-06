import cron, { type ScheduledTask } from "node-cron";
import { database, withTransaction } from "../configs/database.js";
import { extractS3Key } from "../utils/s3Utils.js";
import { runExclusive } from "../utils/advisoryLock.js";
import { processMediaDeletionJobs, queueMediaDeletions } from "../services/mediaDeletionService.js";
import { purgeOutboxHistory } from "../services/outboxService.js";
import { purgeMessageTombstones } from "../services/messageService.js";
import { scheduledTaskDuration, scheduledTaskRuns } from "../observability/metrics.js";
import { childContext, runWithContext } from "../observability/context.js";
import { logger, safeErrorMetadata } from "../utils/logger.js";

/**
 * Retention periods (WP-13 of the 2026-11 audit; docs/database.md has the
 * full table). Nothing below kept data for a reason once these have passed:
 * an expired or revoked session cannot be refreshed, a used or expired reset
 * token cannot be redeemed, a read notification was seen, and a fix that has
 * not been refreshed for a month says nothing about where the member is.
 */
const SESSION_RETENTION_DAYS = 7;
const USED_RESET_TOKEN_RETENTION_DAYS = 1;
const READ_NOTIFICATION_RETENTION_DAYS = 180;
/** D-07: coordinates not refreshed for this long are wiped; the settings stay. */
const STALE_LOCATION_DAYS = 30;
const RETENTION_BATCH = 1_000;
const daysAgo = (days: number): Date => new Date(Date.now() - days * 86_400_000);

/**
 * Deletes in claimed batches (SKIP LOCKED), so a large backlog never holds a
 * long transaction or blocks the rows other work is touching.
 */
const deleteInBatches = async (claim: (transaction: Parameters<Parameters<typeof withTransaction>[0]>[0]) => Promise<string[]>, remove: (transaction: Parameters<Parameters<typeof withTransaction>[0]>[0], ids: string[]) => Promise<unknown>): Promise<number> => {
  let total = 0;
  for (;;) {
    const removed = await withTransaction(async (transaction) => {
      const ids = await claim(transaction);
      if (ids.length) await remove(transaction, ids);
      return ids.length;
    });
    total += removed;
    if (removed < RETENTION_BATCH) return total;
  }
};

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

const purgeTombstones = async (): Promise<void> => {
  const purged = await purgeMessageTombstones();
  if (purged) logger.info("message_tombstones_purged", { purged });
};

export const deleteExpiredSessions = async (): Promise<void> => {
  const cutoff = daysAgo(SESSION_RETENTION_DAYS);
  const deleted = await deleteInBatches(
    async (transaction) => (await transaction.selectFrom("sessions").select("id")
      .where((expression) => expression.or([expression("expires_at", "<", cutoff), expression("revoked_at", "<", cutoff)]))
      .orderBy("id").forUpdate().skipLocked().limit(RETENTION_BATCH).execute()).map((row) => row.id),
    (transaction, ids) => transaction.deleteFrom("sessions").where("id", "in", ids).execute(),
  );
  if (deleted) logger.info("expired_sessions_deleted", { deleted });
};

export const deleteSpentResetTokens = async (): Promise<void> => {
  const usedBefore = daysAgo(USED_RESET_TOKEN_RETENTION_DAYS);
  const deleted = await deleteInBatches(
    async (transaction) => (await transaction.selectFrom("password_reset_tokens").select("id")
      .where((expression) => expression.or([expression("expires_at", "<", new Date()), expression("consumed_at", "<", usedBefore)]))
      .orderBy("id").forUpdate().skipLocked().limit(RETENTION_BATCH).execute()).map((row) => row.id),
    (transaction, ids) => transaction.deleteFrom("password_reset_tokens").where("id", "in", ids).execute(),
  );
  if (deleted) logger.info("password_reset_tokens_deleted", { deleted });
};

/** Unread activity is kept however old: the member has not seen it yet. */
export const purgeReadNotifications = async (): Promise<void> => {
  const cutoff = daysAgo(READ_NOTIFICATION_RETENTION_DAYS);
  const deleted = await deleteInBatches(
    async (transaction) => (await transaction.selectFrom("notifications").select("id")
      .where("read_at", "is not", null).where("created_at", "<", cutoff)
      .orderBy("id").forUpdate().skipLocked().limit(RETENTION_BATCH).execute()).map((row) => row.id),
    (transaction, ids) => transaction.deleteFrom("notifications").where("id", "in", ids).execute(),
  );
  if (deleted) logger.info("read_notifications_deleted", { deleted });
};

/**
 * D-07: a position not refreshed for 30 days is reduced to the placeholder a
 * member has before their first fix - coordinates 0/0, no accuracy, no city,
 * timestamp at the epoch - so it is unusable for search, while the member's
 * Nearby settings stay as they chose them. Nearby already ignores fixes older
 * than 7 days; this removes the coordinates themselves. Counts only, never
 * coordinates, go to the log.
 */
export const wipeStaleLocations = async (): Promise<void> => {
  const cutoff = daysAgo(STALE_LOCATION_DAYS);
  const wiped = await deleteInBatches(
    async (transaction) => (await transaction.selectFrom("user_locations").select("user_id")
      .where("location_updated_at", "<", cutoff)
      .where((expression) => expression.or([expression("latitude", "<>", 0), expression("longitude", "<>", 0), expression("location_updated_at", ">", new Date(0))]))
      .orderBy("user_id").forUpdate().skipLocked().limit(RETENTION_BATCH).execute()).map((row) => row.user_id),
    (transaction, ids) => transaction.updateTable("user_locations")
      .set({ latitude: 0, longitude: 0, accuracy_meters: null, city_id: null, location_updated_at: new Date(0) })
      .where("user_id", "in", ids).execute(),
  );
  if (wiped) logger.info("stale_locations_wiped", { wiped });
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
  { name: "message-tombstone-retention", schedule: "23 4 * * *", run: purgeTombstones },
  { name: "expired-sessions", schedule: "7 * * * *", run: deleteExpiredSessions },
  { name: "password-reset-tokens", schedule: "37 * * * *", run: deleteSpentResetTokens },
  { name: "notifications-retention", schedule: "53 4 * * *", run: purgeReadNotifications },
  { name: "stale-location-wipe", schedule: "13 5 * * *", run: wipeStaleLocations },
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
