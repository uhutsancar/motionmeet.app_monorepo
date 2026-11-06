# ADR 002 — Transactional outbox, delivered through RabbitMQ

Status: accepted, November 2026.

## Context

Events were written to `outbox_events` in the same transaction as the change
they describe, then handled once a minute in the API process and deleted.
There was no ceiling on retries, no audit of what had been handled, and no way
to hand work to another process.

## Decision

1. **The outbox stays the source of truth.** A broker publish cannot be part of
   a PostgreSQL transaction, so the row is written with the change and
   delivered afterwards. A broker outage delays events; it cannot lose one.
2. **Two transports, one set of consumers** (`OUTBOX_TRANSPORT`):
   `direct` applies events in the claiming process (no broker; the default and
   the rollback path), `rabbitmq` publishes them for the worker to consume.
   Both go through `applyEventOnce`, so switching transports cannot apply an
   event twice.
3. **Publishing** uses a confirm channel with `mandatory`. A row becomes
   `published` only when the broker confirmed it and did not return it as
   unroutable. Claims use `FOR UPDATE SKIP LOCKED` with a lease on the database
   clock; failures back off exponentially with ±20 % jitter; after 10 attempts
   the row is `dead` until an operator redrives it.
4. **Consuming** is manual-ack after the effect commits. Each consumer has a
   durable queue (`motionmeet.<consumer>`), four TTL retry queues
   (10 s, 1 min, 5 min, 30 min) that dead-letter back to it, and a `.dead`
   queue. Malformed envelopes, unknown schema versions and
   `PermanentEventError` go straight to `.dead`. Quorum queues with a delivery
   limit catch a consumer that crashes before it can acknowledge.
5. **Idempotency** is `processed_events (consumer, event_id)`. Database-only
   consumers insert it in the same transaction as their effect. Consumers with
   external effects (SMTP) check before and record after — at-least-once, a
   duplicate is possible only if the process dies between the send and the
   record.
6. **Event types are text with a CHECK on shape**, not a PostgreSQL enum: a new
   enum value cannot be used in the transaction that adds it, which would cost
   a release per event type. `messaging/events.ts` is the registry.

## Not chosen

- **Kafka** — no replay or analytics-stream need; operating it is out of
  proportion to three event types.
- **Amazon SQS** — a fine alternative on AWS; not chosen because the stack is
  self-hostable today. Only one broker may serve this purpose at a time.
- **Delayed-message plugin** — TTL + dead-letter queues need no plugin.
- **Ordering guarantees** — consumers re-read current state, so order does not
  matter; none is promised.

## Consequences

- Delivery latency went from "up to 60 s" to the relay's poll interval (1 s
  default); the RabbitMQ smoke test measured 644 ms from commit to applied.
- Changing a queue's arguments needs a migration (the broker refuses a
  re-declaration with different arguments) — see RUNBOOKS.md.
- `processed_events` and published outbox rows are purged daily (14 and 7 days).
