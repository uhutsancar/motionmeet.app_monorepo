import { sql, type Kysely } from "kysely";
import type { Database } from "../types.js";

/**
 * Leases for scheduled tasks (utils/advisoryLock.ts).
 *
 * Scheduled tasks were kept to one runner with a session-level advisory lock,
 * held on a pooled connection for the length of the task. Behind a pooler in
 * transaction mode - PgBouncer in front of most managed PostgreSQL - a
 * session lock is taken on whichever server connection serves that statement
 * and released on another one, or never: two runners, or a task that never
 * runs again. A row with an expiry works the same through any pooler and
 * holds no connection while the task runs.
 */
export const up = async (db: Kysely<Database>): Promise<void> => {
  await sql`
    CREATE TABLE IF NOT EXISTS scheduler_leases (
      name varchar(200) PRIMARY KEY,
      holder varchar(200) NOT NULL,
      expires_at timestamptz NOT NULL,
      acquired_at timestamptz NOT NULL DEFAULT now()
    )`.execute(db);
};

export const down = async (db: Kysely<Database>): Promise<void> => {
  await sql`DROP TABLE IF EXISTS scheduler_leases`.execute(db);
};
