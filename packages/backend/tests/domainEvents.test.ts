import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";
import { EVENT_CATALOG, parseDomainEvent, routingKeyFor, toDomainEvent } from "../messaging/events.js";
import { EVENT_CONSUMERS } from "../messaging/consumers.js";
import { MAX_OUTBOX_ATTEMPTS, outboxBackoffMs } from "../services/outboxService.js";

const valid = {
  eventId: "6f1c9a52-3d2b-4e0f-9a51-1b2c3d4e5f60",
  eventType: "user.profile.updated",
  schemaVersion: 1,
  aggregateId: "a3b1c2d4-0000-4000-8000-000000000001",
  occurredAt: "2026-11-06T10:00:00.000Z",
  correlationId: null,
  payload: { full_name: "Ada" },
};

test("a well-formed v1 envelope parses unchanged", () => {
  assert.deepEqual(parseDomainEvent(valid), valid);
});

test("P1-QUEUE-004: envelopes this build cannot process are rejected, not guessed at", () => {
  const broken: unknown[] = [
    null, "text", [],
    { ...valid, eventId: "not-a-uuid" },
    { ...valid, eventType: "user.deleted" },
    { ...valid, schemaVersion: 2 },
    { ...valid, aggregateId: "" },
    { ...valid, occurredAt: "yesterday" },
    { ...valid, correlationId: 5 },
    { ...valid, payload: [] },
    { ...valid, payload: { nested: { secret: true } } },
  ];
  for (const candidate of broken) assert.equal(parseDomainEvent(candidate), null);
});

test("routing keys carry the schema version", () => {
  assert.equal(routingKeyFor("connection.requested", 1), "connection.requested.v1");
});

test("an outbox row becomes an envelope with its immutable event id", () => {
  const event = toDomainEvent({
    event_id: valid.eventId, type: "connection.requested", schema_version: 1, aggregate_id: "conn-1",
    created_at: new Date(valid.occurredAt), correlation_id: "4bf92f3577b34da6a3ce929d0e0e4736", payload: { senderId: "a", recipientId: "b" },
  });
  assert.equal(event.eventId, valid.eventId);
  assert.equal(event.occurredAt, valid.occurredAt);
  assert.equal(parseDomainEvent(JSON.parse(JSON.stringify(event)))?.eventId, valid.eventId);
});

test("every catalogued event type has at least one consumer, so none is unroutable", () => {
  for (const eventType of Object.keys(EVENT_CATALOG)) {
    assert.ok(EVENT_CONSUMERS.some((consumer) => consumer.eventTypes.includes(eventType as keyof typeof EVENT_CATALOG)), eventType);
  }
  const names = EVENT_CONSUMERS.map((consumer) => consumer.name);
  assert.equal(new Set(names).size, names.length, "consumer names are durable queue names and must be unique");
});

test("outbox backoff grows, is capped at an hour, and is jittered within ±20 %", () => {
  assert.equal(outboxBackoffMs(1, () => 0.5), 30_000);
  assert.equal(outboxBackoffMs(2, () => 0.5), 60_000);
  assert.equal(outboxBackoffMs(30, () => 0.5), 3_600_000);
  assert.equal(outboxBackoffMs(1, () => 0), 24_000);
  assert.equal(outboxBackoffMs(1, () => 1), 36_000);
  assert.ok(MAX_OUTBOX_ATTEMPTS >= 5);
});
