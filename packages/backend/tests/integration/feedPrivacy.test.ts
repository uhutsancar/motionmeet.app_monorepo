import "./testDatabase.js";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { connectDatabase, database, disconnectDatabase } from "../../configs/database.js";
import { disconnectRedis, initializeRedis } from "../../configs/redis.js";
import { createPost, deletePostById, getFeedPostsForUser, getPostById } from "../../services/postService.js";
import { acceptConnection, createConnection, removeConnection, updateUser } from "../../services/userService.js";

/**
 * The feed cache is the one place a withdrawn permission could survive: a page
 * cached while the viewer could see a post. These run against a real Redis
 * (REDIS_URL, see docker-compose.test.yml) so the cached path is the one under
 * test, not the cache-less fallback.
 */
if (!process.env.REDIS_URL) throw new Error("Feed privacy tests need REDIS_URL (see docker-compose.test.yml)");

const FIRST_PAGE = { cursor: null, rawCursor: null, limit: 50 };
const runId = randomUUID().slice(0, 8);
const userIds: string[] = [];

const newUser = async (name: string): Promise<string> => {
  const row = await database.insertInto("users").values({ legacy_mongo_id: null, email: `${name}-${runId}@example.test`, full_name: name, username: `${name}_${runId}`, password_hash: "test-hash" }).returning("id").executeTakeFirstOrThrow();
  userIds.push(row.id);
  return row.id;
};
const publish = (userId: string, visibility: "public" | "followers") => createPost({ user: userId, operationId: `${visibility}-${randomUUID()}`, content: `${visibility} post`, media: [], post_type: "text", visibility });
const feedIds = async (viewerId: string, mode: "discover" | "following"): Promise<string[]> => (await getFeedPostsForUser(viewerId, FIRST_PAGE, mode)).items.map((post) => post.id);

test.before(async () => {
  await connectDatabase();
  const clients = await initializeRedis();
  assert.ok(clients, "Redis must be reachable for these tests");
});

test.after(async () => {
  if (userIds.length) await database.deleteFrom("users").where("id", "in", userIds).execute();
  await disconnectRedis();
  await disconnectDatabase();
});

test("FEED-01: an account going private disappears from cached Keşfet pages at once", async () => {
  const author = await newUser("author");
  const viewer = await newUser("viewer");
  const post = await publish(author, "public");

  assert.ok((await feedIds(viewer, "discover")).includes(post.id), "visible while public");
  // Served from the cache now; still visible.
  assert.ok((await feedIds(viewer, "discover")).includes(post.id));

  await updateUser(author, { "privacy.publicProfile": false });
  assert.ok(!(await feedIds(viewer, "discover")).includes(post.id), "a cached page must not outlive the privacy change");
});

test("FEED-02: a removed connection takes followers-only posts out of the other member's cached feed", async () => {
  const author = await newUser("friend");
  const viewer = await newUser("reader");
  const post = await publish(author, "followers");

  await createConnection(viewer, author);
  await acceptConnection(author, viewer);
  assert.ok((await feedIds(viewer, "following")).includes(post.id), "connected members see followers-only posts");
  assert.ok((await feedIds(viewer, "following")).includes(post.id), "and the page is now cached");

  assert.equal(await removeConnection(author, viewer), true);
  assert.ok(!(await feedIds(viewer, "following")).includes(post.id), "the cached page must not keep serving it");
});

test("a deleted post leaves every member's cached feed", async () => {
  const author = await newUser("poster");
  const viewer = await newUser("scroller");
  const post = await publish(author, "public");
  assert.ok((await feedIds(viewer, "discover")).includes(post.id));

  const access = await getPostById(post.id);
  assert.ok(access);
  await deletePostById(access);
  assert.ok(!(await feedIds(viewer, "discover")).includes(post.id));
});
