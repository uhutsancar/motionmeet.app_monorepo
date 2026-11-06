import type { ChannelModel, ConfirmChannel, ConsumeMessage, MessagePropertyHeaders } from "amqplib";
import { childContext, parseTraceparent, runWithContext } from "../observability/context.js";
import { eventHandleDuration, eventsConsumed } from "../observability/metrics.js";
import { logger, safeErrorMetadata } from "../utils/logger.js";
import { applyEventOnce, PermanentEventError, type EventConsumer } from "./consumers.js";
import { parseDomainEvent } from "./events.js";
import { deadQueueName, queueNameFor, retryQueueName, RETRY_DELAYS_MS } from "./rabbitmq.js";

const ATTEMPT_HEADER = "x-mm-attempt";
/** Broker bookkeeping that must not ride along when a message is re-sent by hand. */
const BROKER_HEADERS = /^x-(death|first-death-|last-death-|delivery-count)/;

const attemptOf = (headers: MessagePropertyHeaders | undefined): number => {
  const value = Number(headers?.[ATTEMPT_HEADER] ?? 0);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
};

/**
 * Re-sends `message` to `queue` with extra headers and waits for the broker's
 * confirm. The copy is made before the original is acknowledged, so a crash in
 * between duplicates the message (harmless: consumers deduplicate) instead of
 * losing it.
 */
const forward = (channel: ConfirmChannel, queue: string, message: ConsumeMessage, extraHeaders: Record<string, unknown>): Promise<void> => new Promise((resolve, reject) => {
  const headers = Object.fromEntries(Object.entries(message.properties.headers ?? {}).filter(([key]) => !BROKER_HEADERS.test(key)));
  channel.sendToQueue(queue, message.content, {
    persistent: true,
    contentType: message.properties.contentType,
    messageId: message.properties.messageId,
    type: message.properties.type,
    appId: message.properties.appId,
    timestamp: message.properties.timestamp,
    headers: { ...headers, ...extraHeaders },
  }, (error: unknown) => (error ? reject(error instanceof Error ? error : new Error("Forward failed")) : resolve()));
});

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export interface RunningConsumer {
  consumer: EventConsumer;
  channel: ConfirmChannel;
  consumerTag: string;
}

/**
 * Consumes one consumer's queue on its own confirm channel.
 *
 * Acknowledgement comes last, after the effect has committed (or the message
 * has been re-queued for a retry or parked as dead), never before: a worker
 * killed mid-event leaves the message unacknowledged, and the broker hands it
 * to the next worker. `inFlight` lets shutdown wait for events already started.
 */
export const startConsumer = async (model: ChannelModel, consumer: EventConsumer, { prefetch, inFlight }: { prefetch: number; inFlight: Set<Promise<void>> }): Promise<RunningConsumer> => {
  const queue = queueNameFor(consumer);
  const channel = await model.createConfirmChannel();
  await channel.prefetch(prefetch);

  const deadLetter = async (message: ConsumeMessage, reason: string): Promise<void> => {
    await forward(channel, deadQueueName(queue), message, { "x-mm-consumer": consumer.name, "x-mm-error": reason.slice(0, 300), "x-mm-failed-at": new Date().toISOString() });
    channel.ack(message);
    eventsConsumed.inc({ consumer: consumer.name, outcome: "dead" });
    logger.error("event_dead_lettered", { consumer: consumer.name, eventId: message.properties.messageId, reason: reason.slice(0, 300) });
  };

  const handle = async (message: ConsumeMessage): Promise<void> => {
    let parsed: unknown = null;
    try { parsed = JSON.parse(message.content.toString("utf8")); } catch { parsed = null; }
    const event = parseDomainEvent(parsed);
    // Retrying a message this build cannot read only burns attempts.
    if (!event || !consumer.eventTypes.includes(event.eventType)) {
      await deadLetter(message, event ? `unexpected event type ${event.eventType}` : "invalid envelope");
      return;
    }
    const traceparent = parseTraceparent(message.properties.headers?.traceparent);
    await runWithContext(childContext({ traceId: traceparent?.traceId ?? event.correlationId }), async () => {
      const attempt = attemptOf(message.properties.headers);
      const endTimer = eventHandleDuration.startTimer({ consumer: consumer.name });
      try {
        const outcome = await applyEventOnce(consumer, event);
        channel.ack(message);
        eventsConsumed.inc({ consumer: consumer.name, outcome });
      } catch (error: unknown) {
        const reason = error instanceof Error ? error.message : "Consumer failed";
        if (error instanceof PermanentEventError || attempt >= RETRY_DELAYS_MS.length) {
          await deadLetter(message, reason);
          return;
        }
        await forward(channel, retryQueueName(queue, attempt), message, { [ATTEMPT_HEADER]: attempt + 1, "x-mm-error": reason.slice(0, 300) });
        channel.ack(message);
        eventsConsumed.inc({ consumer: consumer.name, outcome: "retried" });
        logger.warn("event_retry_scheduled", { consumer: consumer.name, eventId: event.eventId, attempt: attempt + 1, delayMs: RETRY_DELAYS_MS[attempt], ...safeErrorMetadata(error) });
      } finally {
        endTimer();
      }
    });
  };

  const { consumerTag } = await channel.consume(queue, (message) => {
    // null: the broker cancelled the consumer (queue deleted); the channel's
    // close handler takes it from there.
    if (!message) return;
    const work = handle(message).catch(async (error: unknown) => {
      // Even forwarding failed (channel or broker trouble). Requeue after a
      // pause rather than spin; the queue's delivery limit parks a message
      // that keeps landing here.
      logger.error("event_handling_failed", { consumer: consumer.name, ...safeErrorMetadata(error) });
      await sleep(1_000);
      try { channel.nack(message, false, true); } catch { /* channel gone: the broker redelivers */ }
    }).finally(() => inFlight.delete(work));
    inFlight.add(work);
  }, { noAck: false });

  logger.info("consumer_started", { consumer: consumer.name, queue, prefetch });
  return { consumer, channel, consumerTag };
};
