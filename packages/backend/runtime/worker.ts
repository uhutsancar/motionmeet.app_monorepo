import "dotenv/config";
import type { ChannelModel, RecoveringChannelModel } from "amqplib";
import client from "prom-client";
import { checkDatabaseHealth, connectDatabase, disconnectDatabase } from "../configs/database.js";
import { loadEnvironment } from "../configs/environment.js";
import { EVENT_CONSUMERS } from "../messaging/consumers.js";
import { startDirectOutboxRelay, startOutboxRelay, type OutboxRelay } from "../messaging/outboxRelay.js";
import { startConsumer, type RunningConsumer } from "../messaging/rabbitConsumer.js";
import { connectBroker, declareTopology } from "../messaging/rabbitmq.js";
import { preparePublisherChannel, publishOutboxBatch, type OutboxPublisherChannel } from "../messaging/rabbitPublisher.js";
import { registry } from "../observability/metrics.js";
import { startOpsServer } from "../observability/opsServer.js";
import { outboxBacklog } from "../services/outboxService.js";
import { logger, safeErrorMetadata } from "../utils/logger.js";
import { installShutdownHandlers } from "./lifecycle.js";

/**
 * The worker process: drains the outbox and, with the broker transport,
 * consumes events. It owns no HTTP API; its health and metrics are on the ops
 * port. Several workers may run at once - outbox claims skip each other's
 * rows, and a queue shared by several consumers is load-balanced by RabbitMQ.
 */
export const runWorker = async (): Promise<void> => {
  const environment = loadEnvironment();
  await connectDatabase();

  // Backlog figures are read at scrape time, here only: one worker reporting
  // them is enough, and the API should not query the outbox per scrape.
  let backlogCache: { at: number; value: Awaited<ReturnType<typeof outboxBacklog>> } | null = null;
  const backlog = async (): Promise<Awaited<ReturnType<typeof outboxBacklog>>> => {
    if (!backlogCache || Date.now() - backlogCache.at > 5_000) backlogCache = { at: Date.now(), value: await outboxBacklog() };
    return backlogCache.value;
  };
  new client.Gauge({ name: "motionmeet_outbox_pending", help: "Outbox rows waiting to be delivered.", registers: [registry], async collect() { this.set((await backlog()).pending); } });
  new client.Gauge({ name: "motionmeet_outbox_dead", help: "Outbox rows parked after exhausting their attempts.", registers: [registry], async collect() { this.set((await backlog()).dead); } });
  new client.Gauge({ name: "motionmeet_outbox_oldest_pending_seconds", help: "Age of the oldest undelivered outbox row.", registers: [registry], async collect() { this.set((await backlog()).oldestPendingSeconds); } });

  const inFlight = new Set<Promise<void>>();
  let broker: RecoveringChannelModel | null = null;
  let currentModel: ChannelModel | null = null;
  let publisher: OutboxPublisherChannel | null = null;
  let consumers: RunningConsumer[] = [];
  let stopping = false;
  let relay: OutboxRelay;

  if (environment.outboxTransport === "direct") {
    relay = startDirectOutboxRelay();
  } else {
    const prefetch = Math.min(Math.max(Number(process.env.RABBITMQ_PREFETCH) || 10, 1), 500);
    broker = await connectBroker(async (model) => {
      const setup = await model.createChannel();
      await declareTopology(setup, EVENT_CONSUMERS);
      await setup.close();
      const nextPublisher = preparePublisherChannel(await model.createConfirmChannel());
      const nextConsumers = await Promise.all(EVENT_CONSUMERS.map((consumer) => startConsumer(model, consumer, { prefetch, inFlight })));
      // A channel the broker closes on its own (a protocol error, a deleted
      // queue) is not recovered by the connection. Closing the connection
      // hands the whole set to the recovery loop, which rebuilds it.
      for (const channel of [nextPublisher.channel, ...nextConsumers.map(({ channel: consumerChannel }) => consumerChannel)]) {
        channel.on("close", () => {
          if (stopping || currentModel !== model) return;
          logger.warn("broker_channel_closed_unexpectedly");
          void model.close().catch(() => undefined);
        });
        channel.on("error", (error: Error) => logger.error("broker_channel_error", safeErrorMetadata(error)));
      }
      model.on("close", () => {
        if (currentModel !== model) return;
        currentModel = null;
        publisher = null;
        consumers = [];
      });
      currentModel = model;
      publisher = nextPublisher;
      consumers = nextConsumers;
    });
    relay = startOutboxRelay({
      name: "rabbitmq",
      batchSize: 100,
      // Without a broker the rows wait in PostgreSQL; nothing is claimed.
      drainOnce: (limit) => (publisher ? publishOutboxBatch(publisher, { limit }) : Promise.resolve(0)),
    });
  }

  const opsServer = environment.metricsPort
    ? startOpsServer(environment.metricsPort, async () => {
      const database = await checkDatabaseHealth();
      const brokerReady = environment.outboxTransport === "direct" || Boolean(currentModel && publisher);
      return { ready: database && brokerReady, database, broker: environment.outboxTransport === "direct" ? "not-used" : brokerReady ? "connected" : "disconnected", consumers: consumers.map(({ consumer }) => consumer.name) };
    })
    : null;

  installShutdownHandlers("worker", async () => {
    stopping = true;
    // 1. No new outbox claims; the batch in progress completes.
    await relay.stop();
    // 2. No new deliveries; unacknowledged prefetched messages return to the
    //    queue when the channel closes.
    await Promise.allSettled(consumers.map(({ channel, consumerTag }) => channel.cancel(consumerTag)));
    // 3. Events already being applied finish and acknowledge.
    await Promise.allSettled([...inFlight]);
    await broker?.close().catch(() => undefined);
    await new Promise<void>((resolve) => (opsServer ? opsServer.close(() => resolve()) : resolve()));
    await disconnectDatabase();
  });
  logger.info("worker_started", { outboxTransport: environment.outboxTransport, consumers: EVENT_CONSUMERS.map((consumer) => consumer.name) });
};
