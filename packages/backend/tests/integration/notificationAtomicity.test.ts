import "./testDatabase.js";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { sql } from "kysely";
import { connectDatabase, database, disconnectDatabase } from "../../configs/database.js";
import { setSocketServer } from "../../realtime/socketRegistry.js";
import { createPostComment, likePost, togglePostLike } from "../../services/postInteractionService.js";
import { createPost } from "../../services/postService.js";
import { acceptFollowRequest, requestFollow } from "../../services/relationshipService.js";
import { createStory, setStoryLike } from "../../services/storyService.js";
import { updateUser } from "../../services/userService.js";

/**
 * Activity rows are written in the same transaction as the action they report
 * (WP-08 of the 2026-11 audit): if the row cannot be written, the like, the
 * comment or the follow is not there either, and the client's retry is safe.
 * The socket delivery afterwards is best effort and never fails the request.
 * Comments take an operation id, so a retried comment is not a second one.
 */
const runId = randomUUID().slice(0, 8);
const userIds: string[] = [];
const newUser = async (name: string): Promise<string> => {
  const row = await database.insertInto("users").values({
    legacy_mongo_id: null, email: `${name}-${runId}@example.test`, full_name: `${name} member`, username: `${name}_${runId}`, password_hash: "test-hash",
  }).returning("id").executeTakeFirstOrThrow();
  userIds.push(row.id);
  return row.id;
};
const publish = async (userId: string): Promise<string> =>
  (await createPost({ user: userId, operationId: randomUUID(), content: "post", media: [], post_type: "text", visibility: "public" })).id;
const notificationsFor = async (userId: string, type: string): Promise<number> =>
  Number((await database.selectFrom("notifications").select((expression) => expression.fn.countAll<string>().as("count")).where("user_id", "=", userId).where("type", "=", type as never).executeTakeFirstOrThrow()).count);

/** Makes every notification insert fail for the duration of `run`. */
const withBrokenNotifications = async (run: () => Promise<void>): Promise<void> => {
  await sql`create or replace function audit_refuse_notifications() returns trigger language plpgsql as $$ begin raise exception 'notifications are down'; end $$`.execute(database);
  await sql`create trigger audit_refuse_notifications before insert on notifications for each row execute function audit_refuse_notifications()`.execute(database);
  try { await run(); } finally {
    await sql`drop trigger if exists audit_refuse_notifications on notifications`.execute(database);
    await sql`drop function if exists audit_refuse_notifications()`.execute(database);
  }
};

test.before(async () => { await connectDatabase(); });
test.after(async () => {
  if (userIds.length) await database.deleteFrom("users").where("id", "in", userIds).execute();
  await disconnectDatabase();
});

test("a like whose notification cannot be written is not kept; the retry then records both", async () => {
  const author = await newUser("atomauthor"); const fan = await newUser("atomfan");
  const postId = await publish(author);
  await withBrokenNotifications(async () => {
    await assert.rejects(likePost(postId, fan), /notifications are down/);
  });
  assert.equal((await database.selectFrom("post_likes").selectAll().where("post_id", "=", postId).execute()).length, 0, "no like without its activity row");
  assert.equal((await database.selectFrom("posts").select("like_count").where("id", "=", postId).executeTakeFirstOrThrow()).like_count, 0);
  await likePost(postId, fan);
  assert.equal((await database.selectFrom("post_likes").selectAll().where("post_id", "=", postId).execute()).length, 1);
  assert.equal(await notificationsFor(author, "post_like"), 1);
});

test("toggling a like on records its notification in the same transaction", async () => {
  const author = await newUser("toggleauthor"); const fan = await newUser("togglefan");
  const postId = await publish(author);
  await withBrokenNotifications(async () => {
    await assert.rejects(togglePostLike(postId, fan));
  });
  assert.equal((await database.selectFrom("post_likes").selectAll().where("post_id", "=", postId).execute()).length, 0);
});

test("a comment whose notification cannot be written is not kept", async () => {
  const author = await newUser("commauthor"); const reader = await newUser("commreader");
  const postId = await publish(author);
  await withBrokenNotifications(async () => {
    await assert.rejects(createPostComment(postId, reader, "first!", { operationId: randomUUID() }));
  });
  assert.equal((await database.selectFrom("post_comments").selectAll().where("post_id", "=", postId).execute()).length, 0);
  assert.equal((await database.selectFrom("posts").select("comment_count").where("id", "=", postId).executeTakeFirstOrThrow()).comment_count, 0);
});

test("the same operation id twice is one comment", async () => {
  const author = await newUser("idemauthor"); const reader = await newUser("idemreader");
  const postId = await publish(author);
  const operationId = randomUUID();
  const first = await createPostComment(postId, reader, "only once", { operationId });
  const again = await createPostComment(postId, reader, "only once", { operationId });
  assert.equal(again.comment.id, first.comment.id);
  assert.equal(again.commentCount, 1);
  const [concurrentA, concurrentB] = await Promise.all([
    createPostComment(postId, reader, "racing", { operationId: `${operationId}-race` }),
    createPostComment(postId, reader, "racing", { operationId: `${operationId}-race` }),
  ]);
  assert.equal(concurrentA.comment.id, concurrentB.comment.id);
  assert.equal((await database.selectFrom("post_comments").selectAll().where("post_id", "=", postId).execute()).length, 2);
  assert.equal((await database.selectFrom("posts").select("comment_count").where("id", "=", postId).executeTakeFirstOrThrow()).comment_count, 2);
  assert.equal(await notificationsFor(author, "post_comment"), 1, "one activity row per actor and post, refreshed");
  // Without an operation id (older clients) every call is a new comment, as before.
  await createPostComment(postId, reader, "legacy");
  assert.equal((await database.selectFrom("post_comments").selectAll().where("post_id", "=", postId).execute()).length, 3);
});

test("follows, follow requests and accepted requests are atomic with their notifications", async () => {
  const open = await newUser("atomopen"); const locked = await newUser("atomlocked"); const fan = await newUser("atomfollower");
  await updateUser(locked, { "privacy.publicProfile": false });
  await withBrokenNotifications(async () => {
    await assert.rejects(requestFollow(fan, open));
    await assert.rejects(requestFollow(fan, locked));
  });
  assert.equal((await database.selectFrom("user_follows").selectAll().where("follower_id", "=", fan).execute()).length, 0);
  assert.equal((await database.selectFrom("follow_requests").selectAll().where("requester_id", "=", fan).execute()).length, 0);
  assert.equal((await database.selectFrom("users").select("followers_count").where("id", "=", open).executeTakeFirstOrThrow()).followers_count, 0);

  assert.equal(await requestFollow(fan, locked), "requested");
  await withBrokenNotifications(async () => {
    await assert.rejects(acceptFollowRequest(locked, fan));
  });
  assert.equal((await database.selectFrom("follow_requests").selectAll().where("requester_id", "=", fan).execute()).length, 1, "the request is still pending");
  assert.equal(await acceptFollowRequest(locked, fan), true);
  assert.equal(await notificationsFor(fan, "follow_request_accepted"), 1);
  assert.equal(await notificationsFor(locked, "follow_request"), 0, "the actionable request row is gone with the request");
});

test("a story like is atomic with its notification", async () => {
  const owner = await newUser("storyowner"); const viewer = await newUser("storyviewer");
  const story = await createStory({ user: owner, operationId: randomUUID(), content: "hi", media_url: "", media_key: "", media_type: "text", background_color: "#000000", overlays: [] });
  await withBrokenNotifications(async () => {
    await assert.rejects(setStoryLike(story.id, viewer, true, owner));
  });
  assert.equal((await database.selectFrom("story_likes").selectAll().where("story_id", "=", story.id).execute()).length, 0);
  const liked = await setStoryLike(story.id, viewer, true, owner);
  assert.equal(liked.changed, true);
  assert.equal(await notificationsFor(owner, "story_like"), 1);
});

test("a socket delivery that throws does not fail the request", async () => {
  const author = await newUser("sockauthor"); const fan = await newUser("sockfan");
  const postId = await publish(author);
  const fakeServer = (emit: () => void) => ({ on: () => undefined, to: () => ({ emit }), in: () => ({ disconnectSockets: () => undefined, fetchSockets: async () => [] }), serverSideEmit: () => undefined, sockets: { sockets: new Map() } });
  const throwing = fakeServer(() => { throw new Error("socket adapter down"); });
  setSocketServer(throwing as never);
  try {
    const result = await likePost(postId, fan);
    assert.equal(result.liked, true);
    const comment = await createPostComment(postId, fan, "still fine", { operationId: randomUUID() });
    assert.ok(comment.comment.id);
    // Delivery runs after the response; give it a moment to fail quietly.
    await new Promise((resolve) => setTimeout(resolve, 100));
  } finally {
    setSocketServer(fakeServer(() => undefined) as never);
  }
  assert.equal(await notificationsFor(author, "post_like"), 1);
});
