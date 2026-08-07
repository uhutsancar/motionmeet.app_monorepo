import { sql, type Kysely } from "kysely";
import type { Database } from "../types.js";

/**
 * Turns following into a request/accept handshake and gives the app a real
 * activity feed.
 *
 * `follow_requests` holds pending requests only. Accepting one moves the edge
 * into `user_follows` and deletes the request, so `user_follows` stays the sole
 * answer to "does A follow B" and every existing query keeps working.
 *
 * `posts.discover_rank` is a stored generated column so Keşfet can order by
 * popularity without a sort over the whole table: engagement is worth a
 * logarithmic number of days of freshness, which keeps a well-liked post above
 * newer quiet ones without freezing the feed on all-time favourites. It is a
 * pure function of columns already on the row, so it needs no trigger and can
 * back a partial index that the discover keyset walks directly.
 */
export const up = async (db: Kysely<Database>): Promise<void> => {
  await sql.raw(`
    CREATE TABLE IF NOT EXISTS follow_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (requester_id, target_id),
      CHECK (requester_id <> target_id)
    );
    CREATE INDEX IF NOT EXISTS follow_requests_target_idx ON follow_requests (target_id, created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS follow_requests_requester_idx ON follow_requests (requester_id, created_at DESC, id DESC);

    DO $$ BEGIN
      CREATE TYPE notification_type AS ENUM ('follow_request', 'follow_request_accepted', 'follow', 'post_like', 'post_comment');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE TABLE IF NOT EXISTS notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      actor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type notification_type NOT NULL,
      post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
      read_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK (user_id <> actor_id)
    );
    CREATE INDEX IF NOT EXISTS notifications_user_cursor_idx ON notifications (user_id, created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications (user_id) WHERE read_at IS NULL;
    -- One row per (recipient, actor, kind, subject). Re-liking a post refreshes
    -- the existing row instead of stacking duplicates in the activity list.
    CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_idx
      ON notifications (user_id, actor_id, type, post_id) NULLS NOT DISTINCT;

    -- The epoch is taken through an explicit UTC cast: extract(epoch from
    -- timestamptz) is only STABLE, which a generated column rejects, while the
    -- same extraction from a timestamp is IMMUTABLE and yields the identical
    -- absolute number.
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS discover_rank double precision
      GENERATED ALWAYS AS (
        ln(greatest(like_count * 3 + comment_count * 2 + share_count, 0) + 1) * 1.5
        + extract(epoch FROM (created_at AT TIME ZONE 'UTC')) / 86400.0
      ) STORED;
    CREATE INDEX IF NOT EXISTS posts_discover_rank_idx
      ON posts (discover_rank DESC, id DESC) WHERE visibility = 'public';

    DO $$ BEGIN
      CREATE TRIGGER follow_requests_set_updated_at BEFORE UPDATE ON follow_requests
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TRIGGER notifications_set_updated_at BEFORE UPDATE ON notifications
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `).execute(db);
};

export const down = async (db: Kysely<Database>): Promise<void> => {
  await sql.raw(`
    DROP INDEX IF EXISTS posts_discover_rank_idx;
    ALTER TABLE posts DROP COLUMN IF EXISTS discover_rank;
    DROP TABLE IF EXISTS notifications;
    DROP TYPE IF EXISTS notification_type;
    DROP TABLE IF EXISTS follow_requests;
  `).execute(db);
};
