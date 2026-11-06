import "./testDatabase.js";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Writable } from "node:stream";
import { setTimeout as sleep } from "node:timers/promises";
import test from "node:test";
import { connectDatabase, database, disconnectDatabase } from "../../configs/database.js";
import { disconnectRedis, initializeRedis, readOwnerField, writeOwnerField } from "../../configs/redis.js";
import { createPost, deletePostById, getFeedPostsForUser, getPostById, getVisiblePostForViewer } from "../../services/postService.js";
import { createWorkoutWithStatistics } from "../../services/workoutService.js";
import { getUserProfileAndPosts, updateUser } from "../../services/userService.js";
import { deletePosition, listNearbyUsers, savePosition, updateNearbySettings } from "../../services/nearbyService.js";
import { deleteAccountData, streamAccountData } from "../../services/accountService.js";
import { acceptFollowRequest, requestFollow } from "../../services/relationshipService.js";

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
const feedPostIds = async (viewerId: string, mode: "discover" | "following"): Promise<string[]> =>
  (await getFeedPostsForUser(viewerId, FIRST, mode)).items.map((post) => post.id);
const nearbyIds = async (userId: string): Promise<string[]> => (await listNearbyUsers(userId)).users.map((user) => user.id);

test.before(async () => { await connectDatabase(); assert.ok(await initializeRedis(), "Redis must be reachable"); });
test.after(async () => {
  if (userIds.length) await database.deleteFrom("users").where("id", "in", userIds).execute();
  await database.deleteFrom("location_cities").where("dataset_version", "=", "audit-test").execute();
  await database.deleteFrom("location_states").where("dataset_version", "=", "audit-test").execute();
  await database.deleteFrom("location_countries").where("dataset_version", "=", "audit-test").execute();
  await disconnectRedis(); await disconnectDatabase();
});

test("R1 / WP-02: a deleted post leaves every cached profile view", async () => {
  const author = await newUser("rauthor"); const stranger = await newUser("rstranger");
  const post = await publish(author);
  assert.ok((await profilePostIds(author, stranger)).includes(post.id));
  assert.ok((await profilePostIds(author, author)).includes(post.id));
  await deletePostById((await getPostById(post.id))!);
  assert.ok(!(await profilePostIds(author, stranger)).includes(post.id));
  assert.ok(!(await profilePostIds(author, author)).includes(post.id));
});

test("R2 / WP-02: a new post appears in the author's cached profile at once", async () => {
  const author = await newUser("rnew");
  await profilePostIds(author, author); // warm the cache
  const post = await publish(author);
  assert.ok((await profilePostIds(author, author)).includes(post.id));
});

test("WP-02: a deleted post leaves a stranger's and a follower's cached profile, the feed and the single-post view", async () => {
  const author = await newUser("delauthor"); const stranger = await newUser("delstranger"); const follower = await newUser("delfollower");
  await requestFollow(follower, author); // a public account is followed at once
  const post = await publish(author);
  for (const viewer of [stranger, follower]) {
    assert.ok((await profilePostIds(author, viewer)).includes(post.id), "visible and now cached");
    assert.ok((await feedPostIds(viewer, "discover")).includes(post.id));
  }
  assert.ok((await feedPostIds(follower, "following")).includes(post.id));
  await deletePostById((await getPostById(post.id))!);
  for (const viewer of [stranger, follower]) {
    assert.ok(!(await profilePostIds(author, viewer)).includes(post.id), "profile");
    assert.ok(!(await feedPostIds(viewer, "discover")).includes(post.id), "Keşfet");
    assert.equal(await getVisiblePostForViewer(post.id, viewer), null, "single post");
  }
  assert.ok(!(await feedPostIds(follower, "following")).includes(post.id), "home feed");
});

test("WP-02: a logged workout shows in the cached profile statistics at once", async () => {
  const athlete = await newUser("athlete"); const viewer = await newUser("watcher");
  const before = await getUserProfileAndPosts(athlete, viewer, FIRST as never);
  assert.equal(before?.profile.statistics?.totalWorkouts, 0);
  const now = Date.now();
  await createWorkoutWithStatistics({
    userId: athlete, operationId: randomUUID(), name: "Push", startTime: new Date(now - 3_600_000), endTime: new Date(now),
    durationMinutes: 60, volumeKg: 0, totalSets: 0, totalReps: 0, metricsVersion: 1, exercises: [],
  });
  const after = await getUserProfileAndPosts(athlete, viewer, FIRST as never);
  assert.equal(after?.profile.statistics?.totalWorkouts, 1);
});

test("R3 / WP-03: nearby opt-outs apply to other members' cached results", async () => {
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

test("R7 / WP-03: a deleted account leaves other members' nearby results", async () => {
  const a = await newUser("da"); const b = await newUser("db");
  await savePosition(a, { latitude: 40.0, longitude: 30.0 });
  await savePosition(b, { latitude: 40.001, longitude: 30.001 });
  assert.ok((await nearbyIds(a)).includes(b));
  await deleteAccountData(b); userIds.splice(userIds.indexOf(b), 1);
  assert.ok(!(await nearbyIds(a)).includes(b));
});

/**
 * The test database has no location dataset, so the area-label checks get a
 * throwaway country, region and city of their own (removed in `after`).
 */
const TEST_COUNTRY_ID = 990_000 + Math.floor(Math.random() * 9_000);
const TEST_CITY = { latitude: 38.512, longitude: 27.431 };
const seedTestCity = async (): Promise<void> => {
  await database.insertInto("location_countries").values({
    id: TEST_COUNTRY_ID, name: "Auditland", iso2: "ZQ", iso3: "ZQQ", search_name: "auditland", dataset_version: "audit-test",
  }).onConflict((conflict) => conflict.doNothing()).execute();
  await database.insertInto("location_states").values({
    id: TEST_COUNTRY_ID, country_id: TEST_COUNTRY_ID, name: "Audit Region", search_name: "audit region", dataset_version: "audit-test",
  } as never).onConflict((conflict) => conflict.doNothing()).execute();
  await database.insertInto("location_cities").values({
    id: TEST_COUNTRY_ID, country_id: TEST_COUNTRY_ID, state_id: TEST_COUNTRY_ID, name: "Audit City",
    latitude: TEST_CITY.latitude, longitude: TEST_CITY.longitude, search_name: "audit city", dataset_version: "audit-test",
  } as never).onConflict((conflict) => conflict.doNothing()).execute();
};

test("WP-03: switching distance to hidden takes band and area off cached results at once", async () => {
  await seedTestCity();
  const a = await newUser("hidea"); const b = await newUser("hideb");
  await savePosition(a, { latitude: TEST_CITY.latitude, longitude: TEST_CITY.longitude });
  await savePosition(b, { latitude: TEST_CITY.latitude + 0.001, longitude: TEST_CITY.longitude + 0.001 });
  const before = (await listNearbyUsers(a)).users.find((user) => user.id === b);
  assert.ok(before, "listed and now cached");
  assert.equal(before.distanceBand, "nearby");
  assert.equal(before.approximateArea, "Audit City, Audit Region");
  await updateNearbySettings(b, { distanceVisibility: "hidden" });
  const after = (await listNearbyUsers(a)).users.find((user) => user.id === b);
  assert.ok(after, "hidden distance keeps the member listed");
  assert.equal(after.distanceBand, "unknown");
  assert.equal(after.approximateArea, null);
});

test("WP-03: other members see when somebody was last active only to the hour", async () => {
  const a = await newUser("houra"); const b = await newUser("hourb");
  await savePosition(a, { latitude: 39.9, longitude: 32.8 });
  await savePosition(b, { latitude: 39.901, longitude: 32.801 });
  const card = (await listNearbyUsers(a)).users.find((user) => user.id === b);
  assert.ok(card?.lastActiveAt);
  const shown = new Date(card.lastActiveAt);
  assert.equal(shown.getUTCMinutes() + shown.getUTCSeconds() + shown.getUTCMilliseconds(), 0);
  assert.ok(Date.now() - shown.getTime() < 3_600_000);
});

test("R4 / WP-01: a cached field expires on its own TTL, not the hash's", async () => {
  const owner = `audit-r4:${runId}`;
  const { generation } = await readOwnerField(owner, "page1");
  await writeOwnerField(owner, "page1", { page: 1 }, 2, generation);
  await sleep(1_000);
  await writeOwnerField(owner, "page2", { page: 2 }, 2, generation);
  await sleep(1_300);
  assert.equal((await readOwnerField(owner, "page1")).hit, false, "page1 outlived its own TTL");
  assert.deepEqual((await readOwnerField(owner, "page2")).value, { page: 2 });
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

test("R6b / WP-07: a private profile hides weight, height and statistics from strangers", async () => {
  const owner = await newUser("priv"); const stranger = await newUser("str");
  await updateUser(owner, { "privacy.publicProfile": false });
  const result = await getUserProfileAndPosts(owner, stranger, FIRST as never);
  assert.equal(result?.profile.canViewContent, false);
  assert.equal(result?.profile.weight, null);
  assert.equal(result?.profile.height, null);
  assert.equal(result?.profile.statistics, null);
  const own = await getUserProfileAndPosts(owner, owner, FIRST as never);
  assert.equal(Number(own?.profile.weight), 81);
  assert.ok(own?.profile.statistics);
});

test("WP-07: approved followers and viewers of a public account still see the personal fields", async () => {
  const owner = await newUser("privf"); const follower = await newUser("follower");
  await updateUser(owner, { "privacy.publicProfile": false });
  await requestFollow(follower, owner);
  assert.equal(await acceptFollowRequest(owner, follower), true);
  const seen = await getUserProfileAndPosts(owner, follower, FIRST as never);
  assert.equal(seen?.profile.canViewContent, true);
  assert.equal(Number(seen?.profile.weight), 81);
  assert.equal(Number(seen?.profile.height), 180);
  assert.ok(seen?.profile.statistics);

  const open = await newUser("openacct"); const passerby = await newUser("passerby");
  const stranger = await getUserProfileAndPosts(open, passerby, FIRST as never);
  assert.equal(stranger?.profile.canViewContent, true);
  assert.equal(Number(stranger?.profile.weight), 81);
  assert.ok(stranger?.profile.statistics);
});
