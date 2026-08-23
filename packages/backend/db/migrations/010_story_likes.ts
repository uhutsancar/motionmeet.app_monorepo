import { sql, type Kysely } from "kysely";
import type { Database } from "../types.js";

/**
 * Story reactions.
 *
 * A heart on a story used to be sent as a direct message, which put "❤️" in the
 * inbox and gave the author no way to tell a reaction from a reply. It is a
 * like now: one row per (story, member) so tapping twice removes it, and one
 * activity row so the author is told without the conversation being touched.
 *
 * `notifications.story_id` is deliberately nullable and `ON DELETE CASCADE`:
 * stories expire after a day and are deleted, and the activity row goes with
 * the target it points at rather than being left dangling. The dedupe index is
 * rebuilt to include it so a story like and a post like from the same actor are
 * distinct subjects — without it the two would collapse onto one row, because
 * `post_id` is NULL on both under `NULLS NOT DISTINCT`.
 */
export const up = async (db: Kysely<Database>): Promise<void> => {
  await sql.raw(`
    CREATE TABLE IF NOT EXISTS story_likes (
      story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (story_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS story_likes_user_idx ON story_likes (user_id, story_id);

    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'story_like';

    ALTER TABLE notifications
      ADD COLUMN IF NOT EXISTS story_id uuid REFERENCES stories(id) ON DELETE CASCADE;

    DROP INDEX IF EXISTS notifications_dedupe_idx;
    CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_idx
      ON notifications (user_id, actor_id, type, post_id, story_id) NULLS NOT DISTINCT;
  `).execute(db);
};

export const down = async (db: Kysely<Database>): Promise<void> => {
  // The enum label stays: Postgres cannot drop one, and an unused label costs
  // nothing.
  await sql.raw(`
    DROP INDEX IF EXISTS notifications_dedupe_idx;
    DELETE FROM notifications WHERE type = 'story_like';
    ALTER TABLE notifications DROP COLUMN IF EXISTS story_id;
    CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_idx
      ON notifications (user_id, actor_id, type, post_id) NULLS NOT DISTINCT;
    DROP TABLE IF EXISTS story_likes;
  `).execute(db);
};
