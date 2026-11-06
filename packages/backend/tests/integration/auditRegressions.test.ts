import "./testDatabase.js";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Writable } from "node:stream";
import { setTimeout as sleep } from "node:timers/promises";
import test from "node:test";
import { connectDatabase, database, disconnectDatabase } from "../../configs/database.js";
import { disconnectRedis, getCachedField, initializeRedis, setCachedField } from "../../configs/redis.js";
import { createPost, deletePostById, getPostById } from "../../services/postService.js";
import { getUserProfileAndPosts, updateUser } from "../../services/userService.js";
import { deletePosition, listNearbyUsers, savePosition, updateNearbySettings } from "../../services/nearbyService.js";
import { deleteAccountData, streamAccountData } from "../../services/accountService.js";

/**
 * Regression tests for the findings reproduced in the 2026-11 audit (R1-R7 in
 * MOTIONMEET_UYGULAMA_PLANI_v2.1.md, section 3.2). Each asserts the behaviour
 * the fix must deliver, against a real PostgreSQL and Redis, so the cached
 * path is the one under test. A scenario whose work package has not landed yet
 * is marked `todo` so it runs - and shows red - without failing the suite;
 * each work package removes its own marker.
 */
if (!process.env.REDIS_URL) throw new Error("Audit regressions need REDIS_URL (see docker-compose.test.yml)");

const FIRST = { cursor: null, rawCursor: null, limit: 20 };
const runId = randomUUID().slice(0, 8);
const userIds: string[] = [];
const newUser = async (name: string): Promise<string> => {
  const row = await database.insertInto("users").values({
    legacy_mongo_id: null, email: `${name}-${runId}@example.test`, full_name: `${name} member`,
    username: `${name}_${runId}`, password_hash: "test-hash", weight: 81, height: 180,
  }).returning("id").executeTakeFirstOrThrow();
  userIds.push(row.id);
  return row.id;
};
const publish = (userId: string) => createPost({ user: userId, operationId: randomUUID(), content: "post", media: [], post_type: "text", visibility: "public" });
const profilePostIds = async (profileId: string, viewerId: string): Promise<string[]> =>
  ((await getUserProfileAndPosts(profileId, viewerId, FIRST as never))?.posts ?? []).map((post: { id: string }) => post.id);
const nearbyIds = async (userId: string): Promise<string[]> => (await listNearbyUsers(userId)).users.map((user) => user.id);

test.before(async () => { await connectDatabase(); assert.ok(await initializeRedis(), "Redis must be reachable"); });
test.after(async () => {
  if (userIds.length) await database.deleteFrom("users").where("id", "in", userIds).execute();
  await disconnectRedis(); await disconnectDatabase();
});

test("R1 / WP-02: a deleted post leaves every cached profile view", { todo: "WP-02" }, async () => {
  const author = await newUser("rauthor"); const stranger = await newUser("rstranger");
  const post = await publish(author);
  assert.ok((await profilePostIds(author, stranger)).includes(post.id));
  assert.ok((await profilePostIds(author, author)).includes(post.id));
  await deletePostById((await getPostById(post.id))!);
  assert.ok(!(await profilePostIds(author, stranger)).includes(post.id));
  assert.ok(!(await profilePostIds(author, author)).includes(post.id));
});

test("R2 / WP-02: a new post appears in the author's cached profile at once", { todo: "WP-02" }, async () => {
  const author = await newUser("rnew");
  await profilePostIds(author, author); // warm the cache
  const post = await publish(author);
  assert.ok((await profilePostIds(author, author)).includes(post.id));
});

test("R3 / WP-03: nearby opt-outs apply to other members' cached results", { todo: "WP-03" }, async () => {
  const a = await newUser("na"); const b = await newUser("nb"); const c = await newUser("nc"); const d = await newUser("nd");
  await savePosition(a, { latitude: 41.0, longitude: 29.0 });
  await savePosition(b, { latitude: 41.001, longitude: 29.001 });
  await savePosition(c, { latitude: 41.002, longitude: 29.002 });
  await savePosition(d, { latitude: 41.003, longitude: 29.003 });
  const before = await nearbyIds(a);
  assert.ok([b, c, d].every((id) => before.includes(id)));
  await updateNearbySettings(b, { visible: false });
  await deletePosition(c);
  await updateUser(d, { "privacy.showInSearch": false });
  const after = await nearbyIds(a);
  assert.ok(!after.includes(b), "visible=false");
  assert.ok(!after.includes(c), "location deleted");
  assert.ok(!after.includes(d), "showInSearch=false");
  const raw = JSON.stringify(await listNearbyUsers(a));
  for (const forbidden of ["latitude", "longitude", "accuracy", "distanceMeters", "distance_meters"]) assert.ok(!raw.includes(forbidden), forbidden);
});

test("R7 / WP-03: a deleted account leaves other members' nearby results", { todo: "WP-03" }, async () => {
  const a = await newUser("da"); const b = await newUser("db");
  await savePosition(a, { latitude: 40.0, longitude: 30.0 });
  await savePosition(b, { latitude: 40.001, longitude: 30.001 });
  assert.ok((await nearbyIds(a)).includes(b));
  await deleteAccountData(b); userIds.splice(userIds.indexOf(b), 1);
  assert.ok(!(await nearbyIds(a)).includes(b));
});

test("R4 / WP-01: a cached field expires on its own TTL, not the hash's", { todo: "WP-01" }, async () => {
  const owner = `audit-r4:${runId}`;
  await setCachedField(owner, "page1", { page: 1 }, 2);
  await sleep(1_000);
  await setCachedField(owner, "page2", { page: 2 }, 2);
  await sleep(1_300);
  assert.equal(await getCachedField(owner, "page1"), null, "page1 outlived its own TTL");
  assert.deepEqual(await getCachedField(owner, "page2"), { page: 2 });
});

test("R5 / WP-04: an account export completes as valid JSON", { todo: "WP-04" }, async () => {
  const user = await newUser("export");
  let body = "";
  const sink = new Writable({ write(chunk, _encoding, callback) { body += chunk.toString(); callback(); } });
  // A real Response is needed for headers in the controller; the service only writes.
  await streamAccountData(user, sink as never);
  const parsed = JSON.parse(body) as { complete?: boolean; formatVersion?: number };
  assert.equal(parsed.complete, true);
  assert.equal(parsed.formatVersion, 4);
  for (const secret of ["password_hash", "token_hash", "media_key", "object_key"]) assert.ok(!body.includes(secret), secret);
});

test("R6b / WP-07: a private profile hides weight, height and statistics from strangers", { todo: "WP-07" }, async () => {
  const owner = await newUser("priv"); const stranger = await newUser("str");
  await updateUser(owner, { "privacy.publicProfile": false });
  const result = await getUserProfileAndPosts(owner, stranger, FIRST as never);
  assert.equal(result?.profile.canViewContent, false);
  assert.equal(result?.profile.weight, null);
  assert.equal(result?.profile.height, null);
  assert.equal(result?.profile.statistics, null);
  const own = await getUserProfileAndPosts(owner, owner, FIRST as never);
  assert.equal(Number(own?.profile.weight), 81);
});
