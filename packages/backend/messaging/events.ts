import type { OutboxEventType, OutboxPayload, Row } from "../db/types.js";

/**
 * The envelope every domain event travels in, on the broker and between the
 * outbox and its consumers. Versioned: a consumer that receives a
 * `schemaVersion` it does not know parks the message instead of guessing.
 *
 * What goes in `payload` is deliberately small - ids and the few fields a
 * consumer cannot re-read - and never a presigned URL, a token, a message
 * body, an email address or a coordinate. Consumers look current state up
 * in PostgreSQL rather than trusting a snapshot that may be stale on arrival.
 */
export interface DomainEvent {
  eventId: string;
  eventType: OutboxEventType;
  schemaVersion: number;
  aggregateId: string;
  occurredAt: string;
  /** W3C trace id of the request that caused the event, when there was one. */
  correlationId: string | null;
  payload: OutboxPayload;
}

export const EVENTS_EXCHANGE = "motionmeet.events";

/**
 * Every event type, with the schema versions this build can read. The
 * outbox column is free text checked only for shape, so this list - not the
 * database - is the registry; ADR 002 explains why.
 */
export const EVENT_CATALOG: Readonly<Record<OutboxEventType, { versions: readonly number[] }>> = {
  "user.profile.updated": { versions: [1] },
  "connection.requested": { versions: [1] },
  "media.uploaded": { versions: [1] },
};

export const isKnownEventType = (value: unknown): value is OutboxEventType =>
  typeof value === "string" && Object.hasOwn(EVENT_CATALOG, value);

/** Topic routing key: the type plus its schema version, e.g. `user.profile.updated.v1`. */
export const routingKeyFor = (eventType: OutboxEventType, schemaVersion: number): string =>
  `${eventType}.v${schemaVersion}`;

export const toDomainEvent = (row: Pick<Row<"outbox_events">, "event_id" | "type" | "schema_version" | "aggregate_id" | "created_at" | "correlation_id" | "payload">): DomainEvent => ({
  eventId: row.event_id,
  eventType: row.type,
  schemaVersion: row.schema_version,
  aggregateId: row.aggregate_id,
  occurredAt: new Date(row.created_at).toISOString(),
  correlationId: row.correlation_id,
  payload: row.payload,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isScalar = (value: unknown): value is string | number | boolean | null =>
  value === null || ["string", "number", "boolean"].includes(typeof value);

/**
 * An envelope read off the wire, or null when it is not one this build can
 * process - malformed, an unknown type, or a schema version it does not read.
 * Null sends the message to the dead-letter queue: retrying cannot fix it.
 */
export const parseDomainEvent = (raw: unknown): DomainEvent | null => {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.eventId !== "string" || !UUID.test(value.eventId)) return null;
  if (!isKnownEventType(value.eventType)) return null;
  if (typeof value.schemaVersion !== "number" || !EVENT_CATALOG[value.eventType].versions.includes(value.schemaVersion)) return null;
  if (typeof value.aggregateId !== "string" || !value.aggregateId || value.aggregateId.length > 128) return null;
  if (typeof value.occurredAt !== "string" || Number.isNaN(Date.parse(value.occurredAt))) return null;
  if (value.correlationId !== null && typeof value.correlationId !== "string") return null;
  if (!value.payload || typeof value.payload !== "object" || Array.isArray(value.payload)) return null;
  const payload = value.payload as Record<string, unknown>;
  if (!Object.values(payload).every(isScalar)) return null;
  return {
    eventId: value.eventId,
    eventType: value.eventType,
    schemaVersion: value.schemaVersion,
    aggregateId: value.aggregateId,
    occurredAt: value.occurredAt,
    correlationId: value.correlationId as string | null,
    payload: payload as OutboxPayload,
  };
};
