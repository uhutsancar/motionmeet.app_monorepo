import { sql, type Kysely } from "kysely";
import type { Database } from "../types.js";

/**
 * Idempotent comments (WP-08 of the 2026-11 audit).
 *
 * A comment request that failed after its insert committed - or whose
 * response was lost - was retried by the client as a brand-new comment. With
 * an operation id, the retry finds the comment it already made. Same shape as
 * the partial indexes of migration 002: nullable, so comments from clients
 * that send no id keep working, and unique per author only where present.
 *
 * Small table today; on a large one, build the index first with
 * `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS ...` (the statement below is
 * then a no-op).
 */
export const up = async (db: Kysely<Database>): Promise<void> => {
  await sql`ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS operation_id varchar(128)`.execute(db);
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS post_comments_user_operation_idx ON post_comments (user_id, operation_id) WHERE operation_id IS NOT NULL`.execute(db);
};

export const down = async (db: Kysely<Database>): Promise<void> => {
  await sql`DROP INDEX IF EXISTS post_comments_user_operation_idx`.execute(db);
  await sql`ALTER TABLE post_comments DROP COLUMN IF EXISTS operation_id`.execute(db);
};
