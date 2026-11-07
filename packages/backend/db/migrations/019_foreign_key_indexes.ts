import { sql, type Kysely } from "kysely";
import type { Database } from "../types.js";

/**
 * Indexes behind foreign keys that cascade or set null.
 *
 * PostgreSQL indexes the referenced side of a foreign key, never the
 * referencing side. When a referenced row is deleted, the constraint looks
 * for referencing rows with `WHERE <fk column> = $1`; without an index that is
 * a sequential scan of the whole referencing table, once per deleted row:
 *
 * - every deleted post, and every story the expiry sweep removes (200 per
 *   batch), scanned all of `notifications` (`post_id`, `story_id`);
 * - every deleted message scanned `conversations` (`last_message_id`);
 * - deleting an account scanned `messages` (`from_user_id`) and
 *   `notifications` (`actor_id`) once, and `posts` (`workout_id`) and
 *   `personal_records` once per workout it had logged - what pushed a long
 *   history past the statement timeout;
 * - deleting a custom exercise scanned `personal_records` and
 *   `user_exercise_daily_stats` (`exercise_id`).
 *
 * Columns that are mostly null get partial indexes; the constraint's
 * `= $1` implies `IS NOT NULL`, so the planner uses them. The location
 * dataset's own keys are left out: those rows are only replaced by the
 * importer, never deleted by traffic. `databaseContracts.test.ts` keeps this
 * list complete.
 *
 * On large tables, build each one first with `CREATE INDEX CONCURRENTLY IF
 * NOT EXISTS` and the same definition (the migrator runs in a transaction);
 * the statements below are then no-ops. See docs/operations/DEPLOYMENT.md.
 */
export const FOREIGN_KEY_INDEXES = [
  ["notifications_post_idx", "notifications (post_id) WHERE post_id IS NOT NULL"],
  ["notifications_story_idx", "notifications (story_id) WHERE story_id IS NOT NULL"],
  ["notifications_actor_idx", "notifications (actor_id)"],
  ["conversations_last_message_idx", "conversations (last_message_id) WHERE last_message_id IS NOT NULL"],
  ["messages_sender_idx", "messages (from_user_id)"],
  ["posts_workout_idx", "posts (workout_id) WHERE workout_id IS NOT NULL"],
  ["personal_records_workout_idx", "personal_records (workout_id)"],
  ["personal_records_exercise_idx", "personal_records (exercise_id)"],
  ["user_exercise_daily_stats_exercise_idx", "user_exercise_daily_stats (exercise_id)"],
] as const;

export const up = async (db: Kysely<Database>): Promise<void> => {
  for (const [name, definition] of FOREIGN_KEY_INDEXES) {
    await sql`CREATE INDEX IF NOT EXISTS ${sql.raw(name)} ON ${sql.raw(definition)}`.execute(db);
  }
};

export const down = async (db: Kysely<Database>): Promise<void> => {
  for (const [name] of [...FOREIGN_KEY_INDEXES].reverse()) {
    await sql`DROP INDEX IF EXISTS ${sql.raw(name)}`.execute(db);
  }
};
