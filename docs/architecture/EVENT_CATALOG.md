# Event catalogue

Source of truth in code: `packages/backend/messaging/events.ts` (types and
versions) and `messaging/consumers.ts` (who handles what). A test fails if a
catalogued type has no consumer.

Envelope (JSON, `contentType: application/json`, AMQP `messageId` = `eventId`):

```ts
{ eventId: uuid, eventType: string, schemaVersion: number, aggregateId: string,
  occurredAt: ISO-8601, correlationId: W3C trace id | null, payload: { [key]: string | number | boolean | null } }
```

Routing key on `motionmeet.events` (topic): `<eventType>.v<schemaVersion>`.
The W3C `traceparent` header carries the originating request's trace.

| Event | Producer (same transaction as) | Payload | Consumer → queue | Kind / delivery | Privacy |
|---|---|---|---|---|---|
| `user.profile.updated` v1 | `userService.updateUser` when name, username or picture changes | changed fields (informational; consumer re-reads `users`) | `profile-projection` → `motionmeet.profile-projection` | transactional, exactly-once effect | public profile fields only |
| `connection.requested` v1 | `userService.createConnection` | `senderId`, `recipientId` | `connection-request-email` → `motionmeet.connection-request-email` | external (SMTP), at-least-once; no-op with `EMAIL_ENABLED=false` | ids only; email address read at send time, never in the event |
| `media.uploaded` v1 | `postService.createPost` when the post has images | `postId` | `media-metadata` → `motionmeet.media-metadata` | external (S3 read), idempotent update of rows still missing a width | ids only; no URLs, keys or presigned links |

## Retry and failure

| Where | Policy |
|---|---|
| Outbox → broker / direct | exponential backoff from 30 s, ±20 % jitter, capped at 1 h; `dead` after 10 attempts |
| Consumer, transient error | `<queue>.retry.0..3`: 10 s, 1 min, 5 min, 30 min, then `<queue>.dead` |
| Consumer, permanent error, malformed envelope, unknown version | straight to `<queue>.dead` with `x-mm-error`, `x-mm-consumer`, `x-mm-failed-at` |
| Consumer crashes before ack | broker redelivers; quorum `x-delivery-limit: 10` then `.dead` |

## Retention

`published` outbox rows: 7 days. `processed_events`: 14 days. Both purged by
the `event-history-retention` scheduled task in batches of 1000.

## Adding an event

1. Add the type to `OutboxEventType` (`db/types.ts`) and `EVENT_CATALOG`.
2. Write it with `enqueueOutboxEvent(transaction, …)` inside the domain
   transaction. Payload: ids and scalars only — no secrets, tokens, URLs,
   message bodies, emails or coordinates.
3. Add a consumer in `messaging/consumers.ts` (unique, permanent `name`).
4. A new schema version is a new routing key; keep reading the old version
   until no producer of it is deployed.
