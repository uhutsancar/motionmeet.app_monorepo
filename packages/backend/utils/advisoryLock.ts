import { sql } from "kysely";
import { database } from "../configs/database.js";

/**
 * Fixed first key of every advisory lock this application takes, so its locks
 * cannot collide with another tool sharing the database.
 */
const LOCK_NAMESPACE = 0x6d6d; // "mm"

/**
 * Runs `task` only if no other process holds the lock called `name`.
 *
 * A PostgreSQL session-level advisory lock, held on one dedicated pooled
 * connection for as long as the task runs. This replaces a Redis lease for
 * scheduled work, for two reasons:
 *
 * - With Redis unavailable the lease used to fall back to running the task
 *   anyway, on every replica at once. PostgreSQL is the one dependency every
 *   process already needs, so there is no such fallback.
 * - A lease has a TTL that a slow run can outlive; this lock is released only
 *   when the task ends or its connection dies, so a crashed holder frees it
 *   immediately and a slow one keeps it.
 *
 * Returns whether the task ran. The task itself uses the ordinary pool; the
 * locked connection only holds the lock.
 */
export const runExclusive = async (name: string, task: () => Promise<void>): Promise<boolean> =>
  database.connection().execute(async (connection) => {
    const { rows } = await sql<{ locked: boolean }>`select pg_try_advisory_lock(${LOCK_NAMESPACE}, hashtext(${name})) as locked`.execute(connection);
    if (!rows[0]?.locked) return false;
    try {
      await task();
      return true;
    } finally {
      await sql`select pg_advisory_unlock(${LOCK_NAMESPACE}, hashtext(${name}))`.execute(connection).catch(() => undefined);
    }
  });
