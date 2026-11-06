import "./testDatabase.js";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { connectDatabase, database, disconnectDatabase } from "../../configs/database.js";
import { getFeedPostsForUser } from "../../services/postService.js";

test.before(connectDatabase);
test.after(disconnectDatabase);

/**
 * FEED-05 and the home feed's visibility rules, pinned before and after the
 * audience-first rewrite: who sees what, hidden workouts, and a cursor walk
 * that neither repeats nor skips. No Redis here, so every page is a query.
 */
test("FEED-05: the home feed shows exactly the allowed posts, newest first, across pages", async () => {
  const runId = randomUUID().slice(0, 8);
  const newUser = async (name: string, showWorkouts = true): Promise<string> => (await database.insertInto("users")
    .values({ legacy_mongo_id: null, email: `${name}-${runId}@example.test`, full_name: `Feed ${name}`, username: `feed_${name}_${runId}`, password_hash: "test-hash", privacy_show_workouts_on_feed: showWorkouts })
    .returning("id").executeTakeFirstOrThrow()).id;
  const viewer = await newUser("viewer");
  const followee = await newUser("followee", false);
  const connection = await newUser("connection");
  const stranger = await newUser("stranger");
  const userIds = [viewer, followee, connection, stranger];
  try {
    await database.insertInto("user_follows").values({ follower_id: viewer, followee_id: followee }).execute();
    await database.insertInto("connections").values({ legacy_mongo_id: null, from_user_id: connection, to_user_id: viewer, pair_key: [connection, viewer].sort().join(":"), status: "accepted" }).execute();

    let minute = 0;
    const post = async (author: string, label: string, visibility: "public" | "followers" | "private", postType: "text" | "workout" = "text"): Promise<{ id: string; label: string }> => {
      minute += 1;
      const row = await database.insertInto("posts").values({
        legacy_mongo_id: null, user_id: author, operation_id: `${label}-${runId}`, author_full_name: "x", author_username: "x",
        content: label, post_type: postType, visibility, workout_id: null, created_at: new Date(Date.UTC(2026, 0, 1, 12, minute)),
      }).returning("id").executeTakeFirstOrThrow();
      return { id: row.id, label };
    };
    const expected = [
      await post(viewer, "own private", "private"),
      await post(viewer, "own workout", "public", "workout"),
      await post(followee, "followee public", "public"),
      await post(followee, "followee followers", "followers"),
      await post(connection, "connection followers", "followers"),
      await post(connection, "connection public", "public"),
    ];
    const hidden = [
      await post(followee, "followee private", "private"),
      await post(followee, "followee hidden workout", "public", "workout"),
      await post(stranger, "stranger public", "public"),
      await post(connection, "connection private", "private"),
    ];
    // Newest first.
    const expectedOrder = [...expected].reverse().map(({ label }) => label);

    const firstPage = await getFeedPostsForUser(viewer, { cursor: null, rawCursor: null, limit: 50 }, "following");
    assert.deepEqual(firstPage.items.map((item) => item.content), expectedOrder);
    assert.equal(firstPage.nextCursor, null);
    for (const { id, label } of hidden) assert.ok(!firstPage.items.some((item) => item.id === id), `${label} must not be in the feed`);

    // Walk two at a time: same posts, same order, nothing twice.
    const walked: string[] = [];
    let rawCursor: string | null = null;
    for (let pageNumber = 0; pageNumber < 10; pageNumber += 1) {
      const cursor = rawCursor ? JSON.parse(Buffer.from(rawCursor, "base64url").toString("utf8")) as { date: string; id: string } : null;
      const page = await getFeedPostsForUser(viewer, { cursor: cursor ? { date: new Date(cursor.date), id: cursor.id } : null, rawCursor, limit: 2 }, "following");
      walked.push(...page.items.map((item) => item.content));
      rawCursor = page.nextCursor;
      if (!rawCursor) break;
    }
    assert.deepEqual(walked, expectedOrder);
  } finally {
    await database.deleteFrom("users").where("id", "in", userIds).execute();
  }
});
