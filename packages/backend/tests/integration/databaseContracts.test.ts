import "./testDatabase.js";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { sql } from "kysely";
import { connectDatabase, database, disconnectDatabase } from "../../configs/database.js";
import { hydratePosts } from "../../repositories/postRepository.js";
import { createMessage } from "../../services/messageService.js";
import { createStory } from "../../services/storyService.js";

const runId = randomUUID().slice(0, 8);
const userIds: string[] = [];

before(async () => { await connectDatabase(); });
after(async () => {
  if (userIds.length) await database.deleteFrom("users").where("id", "in", userIds).execute();
  await disconnectDatabase();
});

test("PostgreSQL declares cursor, relationship, and expiry indexes", async () => {
  const result = await sql<{ indexname: string }>`select indexname from pg_indexes where schemaname = 'public'`.execute(database);
  const names = new Set(result.rows.map((row) => row.indexname));
  for (const name of [
    "stories_expiry_idx", "messages_conversation_cursor_idx", "posts_user_cursor_idx",
    "workouts_user_cursor_idx", "user_follows_follower_idx", "connections_recipient_idx",
  ]) assert.ok(names.has(name), `missing PostgreSQL index: ${name}`);
});

test("relationship self-edges are rejected by database constraints", async () => {
  const id = randomUUID(); userIds.push(id);
  await database.insertInto("users").values({ legacy_mongo_id: null, email: `constraint-${runId}@example.test`, full_name: "Constraint User", username: `constraint_${runId}`, password_hash: "test-hash" }).execute();
  const inserted = await database.selectFrom("users").select("id").where("email", "=", `constraint-${runId}@example.test`).executeTakeFirstOrThrow();
  userIds[userIds.length - 1] = inserted.id;
  await assert.rejects(
    database.insertInto("user_follows").values({ follower_id: inserted.id, followee_id: inserted.id }).execute(),
    (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && error.code === "23514"),
  );
});

test("internal object-storage keys are never serialized by public hydrators", async () => {
  const first = await database.insertInto("users").values({ legacy_mongo_id: null, email: `media-a-${runId}@example.test`, full_name: "Media A", username: `media_a_${runId}`, password_hash: "test-hash" }).returning("id").executeTakeFirstOrThrow();
  const second = await database.insertInto("users").values({ legacy_mongo_id: null, email: `media-b-${runId}@example.test`, full_name: "Media B", username: `media_b_${runId}`, password_hash: "test-hash" }).returning("id").executeTakeFirstOrThrow();
  userIds.push(first.id, second.id);
  const postRow = await database.insertInto("posts").values({ legacy_mongo_id: null, user_id: first.id, operation_id: `contract-post-${runId}`, author_full_name: "Media A", author_username: `media_a_${runId}`, content: "media", post_type: "image", visibility: "public", workout_id: null }).returningAll().executeTakeFirstOrThrow();
  await database.insertInto("post_media").values({ legacy_mongo_id: null, post_id: postRow.id, position: 0, url: "https://example.invalid/post.png", object_key: "posts/private-key.png", media_type: "image", mime_type: "image/png", file_size: null, width: null, height: null, duration_seconds: null }).execute();
  const post = (await hydratePosts([postRow]))[0];
  const story = await createStory({ user: first.id, operationId: `contract-story-${runId}`, content: "", media_url: "https://example.invalid/story.png", media_key: "stories/private-key.png", media_type: "image", background_color: "", overlays: [] });
  const message = await createMessage({ from_user_id: first.id, to_user_id: second.id, operationId: `contract-message-${runId}`, text: "hello", message_type: "text", media_url: "", media_key: "messages/private-key.png" });
  assert.ok(post);
  assert.equal("image_keys" in post, false);
  assert.equal("media_key" in story, false);
  assert.equal("media_key" in message, false);
  assert.equal(JSON.stringify([post, story, message]).includes("private-key"), false);
});
