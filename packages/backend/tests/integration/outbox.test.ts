import "./testDatabase.js";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { sql } from "kysely";
import { connectDatabase, database, disconnectDatabase } from "../../configs/database.js";
import { applyEventOnce, type EventConsumer } from "../../messaging/consumers.js";
import { toDomainEvent } from "../../messaging/events.js";
import { dispatchOutboxDirect, enqueueOutboxEvent, MAX_OUTBOX_ATTEMPTS, redriveDeadOutboxEvents } from "../../services/outboxService.js";
import { createPost } from "../../services/postService.js";
import { runExclusive } from "../../utils/advisoryLock.js";

test.before(connectDatabase);
test.after(disconnectDatabase);

const drain = async (): Promise<void> => { while (await dispatchOutboxDirect({ limit: 50 }) > 0) { /* until empty */ } };

test("P1-QUEUE-001: a profile update reaches the author's posts through the outbox, once", { timeout: 60_000 }, async () => {
  const runId = randomUUID().slice(0, 8);
  const user = await database.insertInto("users").values({ legacy_mongo_id: null, email: `outbox-${runId}@example.test`, full_name: "Before Name", username: `outbox_${runId}`, password_hash: "test-hash" }).returning("id").executeTakeFirstOrThrow();
  try {
    await database.insertInto("posts").values({ legacy_mongo_id: null, user_id: user.id, operation_id: `outbox-post-${runId}`, author_full_name: "Before Name", author_username: `outbox_${runId}`, content: "x", workout_id: null }).execute();
    await database.updateTable("users").set({ full_name: "After Name" }).where("id", "=", user.id).execute();
    await enqueueOutboxEvent(database, { type: "user.profile.updated", aggregateId: user.id, payload: { full_name: "After Name" } });
    await drain();

    const post = await database.selectFrom("posts").select("author_full_name").where("user_id", "=", user.id).executeTakeFirstOrThrow();
    assert.equal(post.author_full_name, "After Name");
    const row = await database.selectFrom("outbox_events").selectAll().where("aggregate_id", "=", user.id).executeTakeFirstOrThrow();
    assert.equal(row.status, "published");
    assert.ok(row.published_at);
    const processed = await database.selectFrom("processed_events").select("consumer").where("event_id", "=", row.event_id).execute();
    assert.deepEqual(processed.map(({ consumer }) => consumer), ["profile-projection"]);
  } finally {
    await database.deleteFrom("outbox_events").where("aggregate_id", "=", user.id).execute();
    await database.deleteFrom("users").where("id", "=", user.id).execute();
  }
});

test("P1-QUEUE-002/003: concurrent and repeated deliveries of one event apply it once", async () => {
  let applied = 0;
  const consumer: EventConsumer = { name: `it-dedup-${randomUUID().slice(0, 8)}`, eventTypes: ["user.profile.updated"], kind: "transactional", apply: async () => { applied += 1; } };
  const event = toDomainEvent({ event_id: randomUUID(), type: "user.profile.updated", schema_version: 1, aggregate_id: "agg", created_at: new Date(), correlation_id: null, payload: {} });
  try {
    const outcomes = await Promise.all(Array.from({ length: 8 }, () => applyEventOnce(consumer, event)));
    assert.equal(applied, 1);
    assert.equal(outcomes.filter((outcome) => outcome === "applied").length, 1);
    assert.equal(await applyEventOnce(consumer, event), "duplicate");
  } finally {
    await database.deleteFrom("processed_events").where("consumer", "=", consumer.name).execute();
  }
});

test("a failed apply leaves no processed record, so the retry still applies it", async () => {
  let calls = 0;
  const consumer: EventConsumer = { name: `it-rollback-${randomUUID().slice(0, 8)}`, eventTypes: ["user.profile.updated"], kind: "transactional", apply: async () => { calls += 1; if (calls === 1) throw new Error("transient"); } };
  const event = toDomainEvent({ event_id: randomUUID(), type: "user.profile.updated", schema_version: 1, aggregate_id: "agg", created_at: new Date(), correlation_id: null, payload: {} });
  try {
    await assert.rejects(applyEventOnce(consumer, event), /transient/);
    assert.equal(await applyEventOnce(consumer, event), "applied");
    assert.equal(calls, 2);
  } finally {
    await database.deleteFrom("processed_events").where("consumer", "=", consumer.name).execute();
  }
});

test("an event nobody can handle is retried with backoff, parked as dead, and can be redriven", async () => {
  const aggregateId = `it-dead-${randomUUID()}`;
  // A type from a hypothetical newer release; the column accepts its shape.
  await sql`insert into outbox_events (type, aggregate_id, payload) values ('test.future_event', ${aggregateId}, '{}'::jsonb)`.execute(database);
  try {
    await drain();
    let row = await database.selectFrom("outbox_events").selectAll().where("aggregate_id", "=", aggregateId).executeTakeFirstOrThrow();
    assert.equal(row.status, "pending");
    assert.equal(row.attempts, 1);
    assert.ok(new Date(row.next_attempt_at).getTime() > Date.now(), "backed off into the future");
    assert.match(row.last_error, /Unknown outbox event type/);

    // Due by the database's clock, which is the one the claim compares with: a
    // test process a few milliseconds ahead of PostgreSQL (Docker Desktop's VM
    // clock drifts) would otherwise write a time that is not due yet.
    await database.updateTable("outbox_events").set({ attempts: MAX_OUTBOX_ATTEMPTS - 1, next_attempt_at: sql<Date>`now()` }).where("id", "=", row.id).execute();
    await drain();
    row = await database.selectFrom("outbox_events").selectAll().where("id", "=", row.id).executeTakeFirstOrThrow();
    assert.equal(row.status, "dead");

    assert.equal(await redriveDeadOutboxEvents({ eventIds: [row.event_id] }), 1);
    row = await database.selectFrom("outbox_events").selectAll().where("id", "=", row.id).executeTakeFirstOrThrow();
    assert.equal(row.status, "pending");
    assert.equal(row.attempts, 0);
  } finally {
    await database.deleteFrom("outbox_events").where("aggregate_id", "=", aggregateId).execute();
  }
});

test("P1-DEPLOY-002: a scheduled task runs in one process at a time", async () => {
  const name = `it-lock-${randomUUID()}`;
  let release!: () => void;
  const holding = new Promise<void>((resolve) => { release = resolve; });
  let started!: () => void;
  const hasStarted = new Promise<void>((resolve) => { started = resolve; });
  const first = runExclusive(name, async () => { started(); await holding; });
  await hasStarted;
  assert.equal(await runExclusive(name, async () => assert.fail("must not run while held")), false);
  release();
  assert.equal(await first, true);
  // Released with the task, so the next run gets it.
  assert.equal(await runExclusive(name, async () => undefined), true);
});

test("P0-PUBLISH-003: each post_media row records its own file's type and size", async () => {
  const runId = randomUUID().slice(0, 8);
  const user = await database.insertInto("users").values({ legacy_mongo_id: null, email: `media-${runId}@example.test`, full_name: "Media User", username: `media_${runId}`, password_hash: "test-hash" }).returning("id").executeTakeFirstOrThrow();
  try {
    const post = await createPost({
      user: user.id, operationId: `media-${runId}`, content: "", post_type: "video", visibility: "public",
      media: [
        { url: "https://cdn.example.test/a.jpg", key: `posts/${user.id}/a.jpg`, contentType: "image/jpeg", sizeBytes: 1234 },
        { url: "https://cdn.example.test/b.mov", key: `posts/${user.id}/b.mov`, contentType: "video/quicktime", sizeBytes: 98765 },
      ],
    });
    const rows = await database.selectFrom("post_media").select(["position", "media_type", "mime_type", "file_size", "width"]).where("post_id", "=", post.id).orderBy("position").execute();
    assert.deepEqual(rows.map((row) => ({ ...row, file_size: Number(row.file_size) })), [
      { position: 0, media_type: "image", mime_type: "image/jpeg", file_size: 1234, width: null },
      { position: 1, media_type: "video", mime_type: "video/quicktime", file_size: 98765, width: null },
    ]);
  } finally {
    await database.deleteFrom("users").where("id", "=", user.id).execute();
  }
});
