import crypto from "node:crypto";
import { sql } from "kysely";
import { database, type DatabaseTransaction } from "../configs/database.js";
import type { OutboxEventType, OutboxPayload, Row } from "../db/types.js";
import { applyEventOnce, consumersFor } from "../messaging/consumers.js";
import { isKnownEventType, toDomainEvent } from "../messaging/events.js";
import { childContext, currentContext, runWithContext } from "../observability/context.js";
import { eventHandleDuration, eventsConsumed, outboxPublishDuration, outboxPublished } from "../observability/metrics.js";
import { logger, safeErrorMetadata } from "../utils/logger.js";

/**
 * The transactional outbox.
 *
 * A domain write and the event announcing it are inserted in one PostgreSQL
 * transaction, so an event exists exactly when its change committed. Getting
 * it out - to the in-process consumers (`direct`) or to RabbitMQ - happens
 * afterwards from these rows, which is why a broker outage can delay an event
 * but never lose one: the row stays until delivery is confirmed.
 */

type Executor = DatabaseTransaction | typeof database;
export type OutboxRow = Row<"outbox_events">;

/** After this many failed attempts a row is parked as `dead` for an operator. */
export const MAX_OUTBOX_ATTEMPTS = 10;
const MAX_BACKOFF_MS = 3_600_000;

/**
 * Every time this module compares or stamps is PostgreSQL's `now()`, never the
 * process clock: rows get their defaults from the database, and several
 * replicas with slightly different clocks must agree on what is due and whose
 * lease has run out.
 */
const databaseNow = sql<Date>`now()`;
const databaseNowPlus = (ms: number) => sql<Date>`now() + make_interval(secs => ${ms / 1000})`;

export const enqueueOutboxEvent = async (executor: Executor, { type, aggregateId, payload }: { type: OutboxEventType; aggregateId: string; payload: OutboxPayload }): Promise<void> => {
  await executor.insertInto("outbox_events").values({
    legacy_mongo_id: null, type, aggregate_id: aggregateId, payload, status: "pending", attempts: 0,
    next_attempt_at: databaseNow, claim_token: null, claim_until: null, last_error: "",
    // The trace of the request that caused it, so the worker's log lines for
    // this event can be found from the API line that produced it.
    correlation_id: currentContext()?.traceId ?? null,
  }).execute();
};

/**
 * Claims up to `limit` due rows for one caller. Rows another claimer holds are
 * skipped, not waited on, so any number of publishers can run side by side; a
 * claim whose holder died is taken over once its lease runs out.
 */
export const claimOutboxBatch = async ({ limit, leaseMs }: { limit: number; leaseMs: number }): Promise<{ token: string; events: OutboxRow[] }> => {
  const token = crypto.randomUUID();
  const events = await database.updateTable("outbox_events")
    .set({ status: "processing", claim_token: token, claim_until: databaseNowPlus(leaseMs) })
    .where("id", "in", (expression) => expression.selectFrom("outbox_events").select("id")
      .where("next_attempt_at", "<=", databaseNow)
      .where((inner) => inner.or([inner("status", "=", "pending"), inner.and([inner("status", "=", "processing"), inner("claim_until", "<=", databaseNow)])]))
      .orderBy("next_attempt_at").orderBy("id").limit(limit).forUpdate().skipLocked())
    .returningAll()
    .execute();
  // RETURNING has no order; the claim does, and handing rows on in it keeps
  // the oldest first. Consumers must not depend on order regardless.
  events.sort((left, right) => new Date(left.next_attempt_at).getTime() - new Date(right.next_attempt_at).getTime() || left.id.localeCompare(right.id));
  return { token, events };
};

/** Delivered: kept for audit until the retention sweep removes it. */
export const markOutboxPublished = async (token: string, ids: readonly string[]): Promise<void> => {
  if (!ids.length) return;
  await database.updateTable("outbox_events")
    .set({ status: "published", published_at: databaseNow, claim_token: null, claim_until: null, last_error: "" })
    .where("id", "in", [...ids]).where("claim_token", "=", token).execute();
};

/** Exponential, capped, with ±20 % jitter so a burst of failures does not retry in lockstep. */
export const outboxBackoffMs = (attempts: number, random: () => number = Math.random): number =>
  Math.round(Math.min(MAX_BACKOFF_MS, 2 ** attempts * 15_000) * (0.8 + random() * 0.4));

const errorText = (error: unknown): string => (error instanceof Error ? error.message : "Outbox delivery failed").slice(0, 500);

/** Not delivered: back to `pending` after a backoff, or `dead` once attempts run out. */
export const releaseOutboxEvent = async (token: string, event: OutboxRow, error: unknown): Promise<"retry" | "dead"> => {
  const attempts = event.attempts + 1;
  const dead = attempts >= MAX_OUTBOX_ATTEMPTS;
  await database.updateTable("outbox_events").set({
    status: dead ? "dead" : "pending", attempts, claim_token: null, claim_until: null,
    next_attempt_at: databaseNowPlus(dead ? 0 : outboxBackoffMs(attempts)), last_error: errorText(error),
  }).where("id", "=", event.id).where("claim_token", "=", token).execute();
  if (dead) logger.error("outbox_event_dead", { eventId: event.event_id, eventType: event.type, attempts });
  return dead ? "dead" : "retry";
};

/**
 * Handles one claimed batch in this process, through the same consumers and
 * the same idempotency records the RabbitMQ worker uses. This is the
 * `OUTBOX_TRANSPORT=direct` path: no broker, the original single-process
 * behaviour, and the fallback if the broker path has to be switched off.
 */
export const dispatchOutboxDirect = async ({ limit = 50 }: { limit?: number } = {}): Promise<number> => {
  // Long enough for a batch of slow SMTP sends; a shorter lease would let a
  // second dispatcher take the batch over mid-send.
  const { token, events } = await claimOutboxBatch({ limit, leaseMs: 5 * 60_000 });
  if (!events.length) return 0;
  const endBatch = outboxPublishDuration.startTimer({ transport: "direct" });
  const delivered: string[] = [];
  for (const row of events) {
    await runWithContext(childContext({ traceId: row.correlation_id }), async () => {
      try {
        // An event this build does not know may come from a newer release
        // during a rollback; it is retried and parked, never silently dropped.
        if (!isKnownEventType(row.type)) throw new Error(`Unknown outbox event type: ${row.type}`);
        const event = toDomainEvent(row);
        for (const consumer of consumersFor(row.type)) {
          const endHandle = eventHandleDuration.startTimer({ consumer: consumer.name });
          const outcome = await applyEventOnce(consumer, event).finally(endHandle);
          eventsConsumed.inc({ consumer: consumer.name, outcome });
        }
        delivered.push(row.id);
        outboxPublished.inc({ transport: "direct", event_type: row.type, outcome: "published" });
      } catch (error: unknown) {
        logger.warn("outbox_dispatch_failed", { eventId: row.event_id, eventType: row.type, ...safeErrorMetadata(error) });
        const outcome = await releaseOutboxEvent(token, row, error);
        outboxPublished.inc({ transport: "direct", event_type: row.type, outcome });
      }
    });
  }
  await markOutboxPublished(token, delivered);
  endBatch();
  return events.length;
};

/**
 * Removes history that has served its purpose, in bounded batches so a large
 * backlog never becomes one long-locking DELETE. `processed_events` is kept
 * well past the longest redelivery window (outbox backoff tops out at an hour
 * per attempt), so a late duplicate still finds its record.
 */
export const purgeOutboxHistory = async ({ publishedRetentionDays = 7, processedRetentionDays = 14, batchSize = 1000 } = {}): Promise<{ outbox: number; processed: number }> => {
  const publishedBefore = new Date(Date.now() - publishedRetentionDays * 86_400_000);
  const processedBefore = new Date(Date.now() - processedRetentionDays * 86_400_000);
  let outbox = 0;
  let processed = 0;
  for (;;) {
    const deleted = await database.deleteFrom("outbox_events").where("id", "in", (expression) => expression.selectFrom("outbox_events").select("id")
      .where("status", "=", "published").where("published_at", "<", publishedBefore).limit(batchSize)).executeTakeFirst();
    const count = Number(deleted.numDeletedRows);
    outbox += count;
    if (count < batchSize) break;
  }
  for (;;) {
    const deleted = await sql`delete from processed_events where ctid in (select ctid from processed_events where processed_at < ${processedBefore} limit ${batchSize})`.execute(database);
    const count = Number(deleted.numAffectedRows ?? 0);
    processed += count;
    if (count < batchSize) break;
  }
  return { outbox, processed };
};

/**
 * Puts dead rows back in the queue - after the cause has been fixed, which is
 * the operator's call (docs/operations/RUNBOOKS.md). Consumers are idempotent,
 * so redriving an event some consumer already applied is safe.
 */
export const redriveDeadOutboxEvents = async ({ eventIds }: { eventIds?: readonly string[] } = {}): Promise<number> => {
  let query = database.updateTable("outbox_events")
    .set({ status: "pending", attempts: 0, next_attempt_at: databaseNow, last_error: "", claim_token: null, claim_until: null })
    .where("status", "=", "dead");
  if (eventIds?.length) query = query.where("event_id", "in", [...eventIds]);
  const result = await query.executeTakeFirst();
  return Number(result.numUpdatedRows);
};

/** Backlog figures for metrics and readiness: what is waiting, what is parked, and how old the oldest waiting row is. */
export const outboxBacklog = async (): Promise<{ pending: number; dead: number; oldestPendingSeconds: number }> => {
  const row = await database.selectFrom("outbox_events")
    .select((expression) => [
      expression.fn.countAll<string>().filterWhere("status", "in", ["pending", "processing"]).as("pending"),
      expression.fn.countAll<string>().filterWhere("status", "=", "dead").as("dead"),
      expression.fn.min("created_at").filterWhere("status", "in", ["pending", "processing"]).as("oldest"),
    ])
    .executeTakeFirstOrThrow();
  const oldest = row.oldest ? new Date(row.oldest as Date).getTime() : null;
  return { pending: Number(row.pending), dead: Number(row.dead), oldestPendingSeconds: oldest ? Math.max(0, (Date.now() - oldest) / 1000) : 0 };
};
