import type { ConfirmChannel, Message } from "amqplib";
import { claimOutboxBatch, markOutboxPublished, releaseOutboxEvent, type OutboxRow } from "../services/outboxService.js";
import { formatTraceparent, newSpanId } from "../observability/context.js";
import { outboxPublishDuration, outboxPublished } from "../observability/metrics.js";
import { logger, safeErrorMetadata } from "../utils/logger.js";
import { EVENTS_EXCHANGE, routingKeyFor, toDomainEvent } from "./events.js";

/**
 * A confirm channel for publishing outbox rows, plus the ids the broker has
 * handed back as unroutable. With `mandatory` set, a message no queue is bound
 * for is returned *and then* confirmed - the confirm alone would report it as
 * delivered - so the return has to be tracked to know it was not.
 */
export interface OutboxPublisherChannel {
  channel: ConfirmChannel;
  returned: Set<string>;
}

export const preparePublisherChannel = (channel: ConfirmChannel): OutboxPublisherChannel => {
  const returned = new Set<string>();
  channel.on("return", (message: Message) => {
    const id: unknown = message.properties.messageId;
    if (typeof id === "string") returned.add(id);
  });
  return { channel, returned };
};

const publishOne = (channel: ConfirmChannel, row: OutboxRow): Promise<Error | null> => new Promise((resolve) => {
  const event = toDomainEvent(row);
  try {
    channel.publish(EVENTS_EXCHANGE, routingKeyFor(event.eventType, event.schemaVersion), Buffer.from(JSON.stringify(event)), {
      persistent: true,
      mandatory: true,
      contentType: "application/json",
      messageId: event.eventId,
      type: event.eventType,
      appId: "motionmeet",
      timestamp: Math.floor(Date.now() / 1000),
      headers: event.correlationId ? { traceparent: formatTraceparent({ traceId: event.correlationId, spanId: newSpanId() }) } : {},
    }, (error: unknown) => resolve(error ? (error instanceof Error ? error : new Error("Broker rejected the message")) : null));
  } catch (error: unknown) {
    // The channel closed between the claim and the publish.
    resolve(error instanceof Error ? error : new Error("Publish failed"));
  }
});

/**
 * Publishes one claimed batch and records the outcome of each row.
 *
 * A row becomes `published` only after the broker has confirmed it (persisted
 * to a durable queue) and not returned it. Everything else goes back to
 * `pending` with a backoff. If the process dies after the confirm but before
 * that update, the lease expires and the row is published again - which is
 * why every consumer deduplicates on the event id.
 */
export const publishOutboxBatch = async ({ channel, returned }: OutboxPublisherChannel, { limit = 100 }: { limit?: number } = {}): Promise<number> => {
  const { token, events } = await claimOutboxBatch({ limit, leaseMs: 60_000 });
  if (!events.length) return 0;
  const endBatch = outboxPublishDuration.startTimer({ transport: "rabbitmq" });
  const outcomes = await Promise.all(events.map(async (row) => ({ row, error: await publishOne(channel, row) })));
  const delivered: string[] = [];
  for (const { row, error } of outcomes) {
    const unroutable = returned.delete(row.event_id);
    if (!error && !unroutable) {
      delivered.push(row.id);
      outboxPublished.inc({ transport: "rabbitmq", event_type: row.type, outcome: "published" });
      continue;
    }
    const reason = error ?? new Error(`No queue is bound for ${row.type}`);
    logger.warn("outbox_publish_failed", { eventId: row.event_id, eventType: row.type, unroutable, ...safeErrorMetadata(reason) });
    const outcome = await releaseOutboxEvent(token, row, reason);
    outboxPublished.inc({ transport: "rabbitmq", event_type: row.type, outcome });
  }
  await markOutboxPublished(token, delivered);
  endBatch();
  return events.length;
};
