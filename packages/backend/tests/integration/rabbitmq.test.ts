import "./testDatabase.js";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { connect, type ChannelModel } from "amqplib";
import { connectDatabase, database, disconnectDatabase } from "../../configs/database.js";
import { PermanentEventError, type EventConsumer } from "../../messaging/consumers.js";
import { EVENTS_EXCHANGE, routingKeyFor, toDomainEvent } from "../../messaging/events.js";
import { startConsumer } from "../../messaging/rabbitConsumer.js";
import { deadQueueName, declareTopology, queueNameFor, retryQueueName, RETRY_DELAYS_MS } from "../../messaging/rabbitmq.js";
import { preparePublisherChannel, publishOutboxBatch } from "../../messaging/rabbitPublisher.js";
import { enqueueOutboxEvent } from "../../services/outboxService.js";

/**
 * Runs against a real broker: RABBITMQ_URL must point at a disposable one
 * (docker compose -f docker-compose.test.yml up -d --wait rabbitmq-test).
 * Each run declares its own consumer queues and deletes them afterwards.
 */
const url = process.env.RABBITMQ_URL;
if (!url) throw new Error("RabbitMQ integration tests need RABBITMQ_URL (see docker-compose.test.yml)");

const waitFor = async (check: () => Promise<boolean>, timeoutMs: number, label: string): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail(`timed out waiting for ${label}`);
};

const runId = randomUUID().slice(0, 8);
const applied = new Map<string, number>();
/** Event ids whose first apply should fail transiently, or always fail permanently. */
const failOnce = new Set<string>();
const failForever = new Set<string>();
const consumer: EventConsumer = {
  name: `it-${runId}`,
  eventTypes: ["user.profile.updated"],
  kind: "transactional",
  apply: async (event) => {
    if (failForever.has(event.eventId)) throw new PermanentEventError("cannot ever apply");
    if (failOnce.delete(event.eventId)) throw new Error("transient failure");
    applied.set(event.eventId, (applied.get(event.eventId) ?? 0) + 1);
  },
};
const queue = queueNameFor(consumer);
const aggregateId = `it-rabbit-${runId}`;

let model: ChannelModel;
const inFlight = new Set<Promise<void>>();

test.before(async () => {
  await connectDatabase();
  model = await connect(url);
  const channel = await model.createChannel();
  await declareTopology(channel, [consumer]);
  await channel.close();
  await startConsumer(model, consumer, { prefetch: 5, inFlight });
});

test.after(async () => {
  await Promise.allSettled([...inFlight]);
  const channel = await model.createChannel();
  for (const name of [queue, deadQueueName(queue), ...RETRY_DELAYS_MS.map((_, tier) => retryQueueName(queue, tier))]) await channel.deleteQueue(name);
  await channel.close();
  await model.close();
  await database.deleteFrom("outbox_events").where("aggregate_id", "=", aggregateId).execute();
  await database.deleteFrom("processed_events").where("consumer", "=", consumer.name).execute();
  await disconnectDatabase();
});

const isProcessed = async (eventId: string): Promise<boolean> =>
  Boolean(await database.selectFrom("processed_events").select("event_id").where("consumer", "=", consumer.name).where("event_id", "=", eventId).executeTakeFirst());

test("EVT-01: a committed event waits in PostgreSQL until a broker channel exists, then is consumed once", { timeout: 30_000 }, async () => {
  await enqueueOutboxEvent(database, { type: "user.profile.updated", aggregateId, payload: {} });
  const row = await database.selectFrom("outbox_events").selectAll().where("aggregate_id", "=", aggregateId).executeTakeFirstOrThrow();
  // Nothing has published it: the API's write succeeded without the broker.
  assert.equal(row.status, "pending");

  const publisher = preparePublisherChannel(await model.createConfirmChannel());
  await waitFor(async () => (await publishOutboxBatch(publisher, { limit: 100 })) === 0
    && (await database.selectFrom("outbox_events").select("status").where("id", "=", row.id).executeTakeFirstOrThrow()).status === "published", 10_000, "outbox row to be published");
  await waitFor(() => isProcessed(row.event_id), 10_000, "consumer to apply the event");
  assert.equal(applied.get(row.event_id), 1);
  await publisher.channel.close();
});

test("EVT-02: the same event published twice has one effect", { timeout: 30_000 }, async () => {
  const event = toDomainEvent({ event_id: randomUUID(), type: "user.profile.updated", schema_version: 1, aggregate_id: aggregateId, created_at: new Date(), correlation_id: null, payload: {} });
  const channel = await model.createConfirmChannel();
  for (let copy = 0; copy < 2; copy += 1) {
    channel.publish(EVENTS_EXCHANGE, routingKeyFor(event.eventType, 1), Buffer.from(JSON.stringify(event)), { persistent: true, messageId: event.eventId });
  }
  await channel.waitForConfirms();
  await waitFor(async () => (await isProcessed(event.eventId)) && (await channel.checkQueue(queue)).messageCount === 0 && inFlight.size === 0, 10_000, "both copies to be handled");
  assert.equal(applied.get(event.eventId), 1);
  await channel.close();
});

test("EVT-04: a poison message is parked in the dead-letter queue and the queue keeps flowing", { timeout: 30_000 }, async () => {
  const channel = await model.createConfirmChannel();
  channel.sendToQueue(queue, Buffer.from("{not json"), { persistent: true, messageId: "poison" });
  const permanent = toDomainEvent({ event_id: randomUUID(), type: "user.profile.updated", schema_version: 1, aggregate_id: aggregateId, created_at: new Date(), correlation_id: null, payload: {} });
  failForever.add(permanent.eventId);
  channel.publish(EVENTS_EXCHANGE, routingKeyFor("user.profile.updated", 1), Buffer.from(JSON.stringify(permanent)), { persistent: true, messageId: permanent.eventId });
  const healthy = toDomainEvent({ event_id: randomUUID(), type: "user.profile.updated", schema_version: 1, aggregate_id: aggregateId, created_at: new Date(), correlation_id: null, payload: {} });
  channel.publish(EVENTS_EXCHANGE, routingKeyFor("user.profile.updated", 1), Buffer.from(JSON.stringify(healthy)), { persistent: true, messageId: healthy.eventId });
  await channel.waitForConfirms();

  await waitFor(async () => (await channel.checkQueue(deadQueueName(queue))).messageCount === 2, 10_000, "two dead-lettered messages");
  await waitFor(() => isProcessed(healthy.eventId), 10_000, "the healthy event behind them");
  assert.equal(applied.get(permanent.eventId), undefined);
  await channel.close();
});

test("a transient failure waits in the first retry tier and is applied when it comes back", { timeout: RETRY_DELAYS_MS[0] + 20_000 }, async () => {
  const event = toDomainEvent({ event_id: randomUUID(), type: "user.profile.updated", schema_version: 1, aggregate_id: aggregateId, created_at: new Date(), correlation_id: null, payload: {} });
  failOnce.add(event.eventId);
  const channel = await model.createConfirmChannel();
  channel.publish(EVENTS_EXCHANGE, routingKeyFor("user.profile.updated", 1), Buffer.from(JSON.stringify(event)), { persistent: true, messageId: event.eventId });
  await channel.waitForConfirms();

  await waitFor(async () => (await channel.checkQueue(retryQueueName(queue, 0))).messageCount === 1, 10_000, "the message to enter retry tier 0");
  assert.equal(await isProcessed(event.eventId), false);
  await waitFor(() => isProcessed(event.eventId), RETRY_DELAYS_MS[0] + 10_000, "the retried event to be applied");
  assert.equal(applied.get(event.eventId), 1);
  await channel.close();
});
