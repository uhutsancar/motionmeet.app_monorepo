import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { sql } from "kysely";
import { database } from "../configs/database.js";
import { logger, safeErrorMetadata } from "./logger.js";

/**
 * How long a lease stands without renewal. A runner that dies frees its tasks
 * after this long; the shortest schedule is five minutes, so nothing is
 * skipped because of it.
 */
export const LEASE_TTL_SECONDS = 60;
const RENEW_EVERY_MS = (LEASE_TTL_SECONDS * 1000) / 3;

/**
 * Runs `task` only if no other process holds the lease called `name`.
 *
 * A row in `scheduler_leases` with an expiry (migration 020), taken with one
 * conditional upsert and renewed while the task runs. It replaced a
 * session-level advisory lock, which needs the same server connection from
 * lock to unlock: through a pooler in transaction mode (PgBouncer) it could be
 * taken and released on different connections, and it pinned a pooled
 * connection for the whole task besides. A lease works through any pooler and
 * holds nothing between its statements.
 *
 * It is still PostgreSQL, never Redis, so there is no "lock service down, run
 * everywhere" fallback. If renewal fails the task keeps running and another
 * runner may start it after the lease expires; every task works in SKIP LOCKED
 * batches, so an overlap costs duplicate effort, never wrong data.
 *
 * Returns whether the task ran.
 */
export const runExclusive = async (name: string, task: () => Promise<void>): Promise<boolean> => {
  const holder = `${hostname()}:${process.pid}:${randomUUID()}`.slice(0, 200);
  const { rows } = await sql<{ holder: string }>`
    insert into scheduler_leases (name, holder, expires_at, acquired_at)
    values (${name}, ${holder}, now() + make_interval(secs => ${LEASE_TTL_SECONDS}), now())
    on conflict (name) do update set holder = excluded.holder, expires_at = excluded.expires_at, acquired_at = excluded.acquired_at
      where scheduler_leases.expires_at < now()
    returning holder`.execute(database);
  if (rows[0]?.holder !== holder) return false;

  const renewal = setInterval(() => {
    void sql`update scheduler_leases set expires_at = now() + make_interval(secs => ${LEASE_TTL_SECONDS}) where name = ${name} and holder = ${holder}`
      .execute(database)
      .then((result) => { if (!Number(result.numAffectedRows ?? 0)) logger.warn("scheduler_lease_lost", { lease: name }); })
      .catch((error: unknown) => { logger.warn("scheduler_lease_renewal_failed", { lease: name, ...safeErrorMetadata(error) }); });
  }, RENEW_EVERY_MS);
  renewal.unref();
  try {
    await task();
    return true;
  } finally {
    clearInterval(renewal);
    await sql`delete from scheduler_leases where name = ${name} and holder = ${holder}`.execute(database).catch(() => undefined);
  }
};
