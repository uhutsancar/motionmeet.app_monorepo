import "./testDatabase.js";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { connectDatabase, database, disconnectDatabase } from "../../configs/database.js";
import { disconnectRedis, initializeRedis } from "../../configs/redis.js";
import { canAccessPost, canViewStoriesOf, evaluateMessagePermission } from "../../services/accessControlService.js";
import { createPost, getFeedPostsForUser } from "../../services/postService.js";
import { acceptFollowRequest, removeFollower, requestFollow } from "../../services/relationshipService.js";
import { createStory } from "../../services/storyService.js";
import { updateUser } from "../../services/userService.js";

/**
 * "Remove follower" (WP-12 of the 2026-11 audit, D-08): the only way for an
 * account - private above all - to take back access it once granted. Against
 * real PostgreSQL and Redis, so the follower's cached home feed is covered.
 */
if (!process.env.REDIS_URL) throw new Error("Remove-follower tests need REDIS_URL (see docker-compose.test.yml)");

const runId = randomUUID().slice(0, 8);
const userIds: string[] = [];
const FIRST = { cursor: null, rawCursor: null, limit: 50 };
const newUser = async (name: string): Promise<string> => {
  const row = await database.insertInto("users").values({
    legacy_mongo_id: null, email: `${name}-${runId}@example.test`, full_name: `${name} member`, username: `${name}_${runId}`, password_hash: "test-hash",
  }).returning("id").executeTakeFirstOrThrow();
  userIds.push(row.id);
  return row.id;
};
const counts = async (id: string) => database.selectFrom("users").select(["followers_count", "following_count"]).where("id", "=", id).executeTakeFirstOrThrow();

test.before(async () => { await connectDatabase(); assert.ok(await initializeRedis(), "Redis must be reachable"); });
test.after(async () => {
  if (userIds.length) await database.deleteFrom("users").where("id", "in", userIds).execute();
  await disconnectRedis(); await disconnectDatabase();
});

test("a removed follower loses a private account's posts, stories, cached feed entries and messaging", async () => {
  const owner = await newUser("rfowner"); const follower = await newUser("rffollower");
  await updateUser(owner, { "privacy.publicProfile": false });
  await requestFollow(follower, owner);
  assert.equal(await acceptFollowRequest(owner, follower), true);
  await requestFollow(owner, follower); // mutual: messaging a private account needs it
  const post = await createPost({ user: owner, operationId: randomUUID(), content: "for followers", media: [], post_type: "text", visibility: "followers" });
  await createStory({ user: owner, operationId: randomUUID(), content: "story", media_url: "", media_key: "", media_type: "text", background_color: "#000000", overlays: [] });

  assert.equal(await canAccessPost({ user: owner, visibility: "followers" }, follower), true);
  assert.equal(await canViewStoriesOf(follower, owner), true);
  assert.ok((await getFeedPostsForUser(follower, FIRST, "following")).items.some((item) => item.id === post.id), "in the feed, and now cached");
  assert.equal((await evaluateMessagePermission({ id: follower }, owner)).allowed, true);
  const before = { owner: await counts(owner), follower: await counts(follower) };

  assert.equal(await removeFollower(owner, follower), true);

  assert.equal(await canAccessPost({ user: owner, visibility: "followers" }, follower), false);
  assert.equal(await canViewStoriesOf(follower, owner), false);
  assert.ok(!(await getFeedPostsForUser(follower, FIRST, "following")).items.some((item) => item.id === post.id), "gone from the cached feed at once");
  assert.equal((await evaluateMessagePermission({ id: follower }, owner)).allowed, false, "no longer a mutual follow");
  assert.equal((await counts(owner)).followers_count, before.owner.followers_count - 1);
  assert.equal((await counts(follower)).following_count, before.follower.following_count - 1);
  // The owner still follows the removed member; only one direction is cut.
  assert.equal((await counts(owner)).following_count, before.owner.following_count);
});

test("removing a follower twice, or someone who never followed, changes nothing", async () => {
  const owner = await newUser("rfidem"); const follower = await newUser("rfidemf"); const stranger = await newUser("rfstranger");
  await requestFollow(follower, owner); // public account: followed at once
  assert.equal(await removeFollower(owner, follower), true);
  const after = await counts(owner);
  assert.equal(await removeFollower(owner, follower), false);
  assert.equal(await removeFollower(owner, stranger), false);
  assert.deepEqual(await counts(owner), after);
});

test("removing someone also drops their pending follow request", async () => {
  const owner = await newUser("rfpend"); const asker = await newUser("rfasker");
  await updateUser(owner, { "privacy.publicProfile": false });
  assert.equal(await requestFollow(asker, owner), "requested");
  await removeFollower(owner, asker);
  assert.equal((await database.selectFrom("follow_requests").selectAll().where("requester_id", "=", asker).where("target_id", "=", owner).execute()).length, 0);
  assert.equal((await database.selectFrom("notifications").selectAll().where("user_id", "=", owner).where("actor_id", "=", asker).where("type", "=", "follow_request").execute()).length, 0);
});
