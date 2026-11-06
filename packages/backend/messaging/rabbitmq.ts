import { connect, type Channel, type ChannelModel, type RecoveringChannelModel } from "amqplib";
import { loadEnvironment } from "../configs/environment.js";
import { logger, safeErrorMetadata } from "../utils/logger.js";
import type { EventConsumer } from "./consumers.js";
import { EVENTS_EXCHANGE, EVENT_CATALOG, routingKeyFor } from "./events.js";

/**
 * Broker topology, declared idempotently by every process that connects.
 *
 *   motionmeet.events (topic, durable)
 *     └─ <type>.v<version> ─► motionmeet.<consumer>            one queue per consumer
 *                                ├─ (fails) ─► motionmeet.<consumer>.retry.<n>   TTL n, then back
 *                                └─ (gives up / poison) ─► motionmeet.<consumer>.dead
 *
 * Each consumer owns its queue, so one event fans out to every consumer that
 * subscribes to it; several workers on the same queue share its load. Retries
 * wait in per-tier TTL queues whose dead-letter target is the consumer queue,
 * which needs no delayed-message plugin. The main queue's own dead-letter
 * target is the `.dead` queue, which catches anything the broker gives up on
 * (a quorum queue's delivery limit, for a consumer that crashes before it can
 * acknowledge).
 *
 * Arguments of an existing queue cannot be changed by re-declaring it - the
 * broker refuses with PRECONDITION_FAILED - so changing any of these is a
 * migration, described in docs/operations/RUNBOOKS.md.
 */

/** Wait before each retry; the length is the number of retries before `.dead`. */
export const RETRY_DELAYS_MS = [10_000, 60_000, 300_000, 1_800_000] as const;
/** Broker-side cap on redeliveries of one message, for crash loops before ack. */
const DELIVERY_LIMIT = 10;

export const queueNameFor = (consumer: Pick<EventConsumer, "name">): string => `motionmeet.${consumer.name}`;
export const retryQueueName = (queue: string, tier: number): string => `${queue}.retry.${tier}`;
export const deadQueueName = (queue: string): string => `${queue}.dead`;

const queueType = (): "quorum" | "classic" => (process.env.RABBITMQ_QUEUE_TYPE === "classic" ? "classic" : "quorum");

export const declareTopology = async (channel: Channel, consumers: readonly EventConsumer[]): Promise<void> => {
  const type = queueType();
  await channel.assertExchange(EVENTS_EXCHANGE, "topic", { durable: true });
  for (const consumer of consumers) {
    const queue = queueNameFor(consumer);
    await channel.assertQueue(deadQueueName(queue), { durable: true, arguments: { "x-queue-type": type } });
    await channel.assertQueue(queue, {
      durable: true,
      arguments: {
        "x-queue-type": type,
        "x-dead-letter-exchange": "",
        "x-dead-letter-routing-key": deadQueueName(queue),
        ...(type === "quorum" ? { "x-delivery-limit": DELIVERY_LIMIT } : {}),
      },
    });
    for (const [tier, delay] of RETRY_DELAYS_MS.entries()) {
      await channel.assertQueue(retryQueueName(queue, tier), {
        durable: true,
        arguments: { "x-queue-type": type, "x-message-ttl": delay, "x-dead-letter-exchange": "", "x-dead-letter-routing-key": queue },
      });
    }
    for (const eventType of consumer.eventTypes) {
      for (const version of EVENT_CATALOG[eventType].versions) {
        await channel.bindQueue(queue, EVENTS_EXCHANGE, routingKeyFor(eventType, version));
      }
    }
  }
};

/**
 * A self-healing broker connection. `onConnected` runs after the first
 * connection and after every reconnection, with a fresh model - channels do
 * not survive a reconnect, so whatever needs one is (re)built there. The
 * process starts without waiting for the broker: until it connects, readiness
 * reports it and outbox rows simply stay in PostgreSQL.
 */
export const connectBroker = async (onConnected: (model: ChannelModel) => Promise<void>): Promise<RecoveringChannelModel> => {
  const environment = loadEnvironment();
  if (!environment.rabbitmqUrl) throw new Error("RABBITMQ_URL is not configured");
  // A heartbeat notices a half-open TCP connection (a NAT or proxy dropping it
  // silently) within a minute instead of at the next publish.
  const url = new URL(environment.rabbitmqUrl);
  if (!url.searchParams.has("heartbeat")) url.searchParams.set("heartbeat", "30");
  const model = await connect(url.toString(), {
    timeout: 10_000,
    clientProperties: { connection_name: `motionmeet-${environment.processRole}-${process.pid}` },
    recovery: {
      initialDelay: 500,
      maxDelay: 30_000,
      waitForConnect: false,
      setup: async (fresh: ChannelModel) => {
        logger.info("broker_connected");
        await onConnected(fresh);
      },
    },
  });
  model.on("disconnect", (error: Error) => logger.warn("broker_disconnected", safeErrorMetadata(error)));
  model.on("reconnect-scheduled", (info: { attempt: number; delay: number }) => logger.info("broker_reconnect_scheduled", { attempt: info.attempt, delayMs: info.delay }));
  model.on("error", (error: Error) => logger.error("broker_error", safeErrorMetadata(error)));
  return model;
};
