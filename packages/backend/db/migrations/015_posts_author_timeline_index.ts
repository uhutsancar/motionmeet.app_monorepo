import { sql, type Kysely } from "kysely";
import type { Database } from "../types.js";

/**
 * One member's posts, newest first, whatever their visibility: the read the
 * audience-first home feed makes once per followed account (see
 * `queryFollowingFeed`). The existing `posts_user_cursor_idx` leads with
 * visibility after the author, so asking for two visibilities at once
 * needed a sort per author; this one returns each author's newest page in
 * index order.
 *
 * `visibility` and `post_type` are carried in the index so the per-author
 * walk is index-only and stops at the page size: without them PostgreSQL
 * fetched every post of a popular author from the heap to filter and sort
 * it, and many members missing the feed cache at once (all following the
 * same few big accounts) queued for seconds on cold reads.
 *
 * Built without CONCURRENTLY because the migrator runs in a transaction and
 * the table is small today. On a large production table, build it by hand
 * first with `CREATE INDEX CONCURRENTLY IF NOT EXISTS ...` (the statement
 * below is then a no-op).
 */
export const up = async (db: Kysely<Database>): Promise<void> => {
  await sql`CREATE INDEX IF NOT EXISTS posts_author_timeline_idx ON posts (user_id, created_at DESC, id DESC) INCLUDE (visibility, post_type)`.execute(db);
};

export const down = async (db: Kysely<Database>): Promise<void> => {
  await sql`DROP INDEX IF EXISTS posts_author_timeline_idx`.execute(db);
};
