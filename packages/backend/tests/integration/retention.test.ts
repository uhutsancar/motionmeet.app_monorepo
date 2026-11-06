import "./testDatabase.js";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { connectDatabase, database, disconnectDatabase } from "../../configs/database.js";
import { getNearbySettings, listNearbyUsers, savePosition } from "../../services/nearbyService.js";
import { deleteExpiredSessions, deleteSpentResetTokens, purgeReadNotifications, SCHEDULED_TASKS, wipeStaleLocations } from "../../workers/cronJobs.js";

/**
 * Retention (WP-13 of the 2026-11 audit, D-07): each task removes what is old
 * enough and nothing else. Rows are backdated by hand; the tasks run directly.
 */
const runId = randomUUID().slice(0, 8);
const userIds: string[] = [];
const DAY = 86_400_000;
const ago = (days: number): Date => new Date(Date.now() - days * DAY);
const newUser = async (name: string): Promise<string> => {
  const row = await database.insertInto("users").values({
    legacy_mongo_id: null, email: `${name}-${runId}@example.test`, full_name: `${name} member`, username: `${name}_${runId}`, password_hash: "test-hash",
  }).returning("id").executeTakeFirstOrThrow();
  userIds.push(row.id);
  return row.id;
};
const session = (userId: string, label: string, expiresAt: Date, revokedAt: Date | null) => database.insertInto("sessions")
  .values({ user_id: userId, token_hash: `${label}-${runId}`, expires_at: expiresAt, revoked_at: revokedAt }).returning("id").executeTakeFirstOrThrow();

test.before(async () => { await connectDatabase(); });
test.after(async () => {
  if (userIds.length) await database.deleteFrom("users").where("id", "in", userIds).execute();
  await disconnectDatabase();
});

test("every retention task is scheduled", () => {
  const names = SCHEDULED_TASKS.map((task) => task.name);
  for (const name of ["expired-sessions", "password-reset-tokens", "notifications-retention", "stale-location-wipe", "message-tombstone-retention"]) {
    assert.ok(names.includes(name), name);
  }
});

test("sessions expired or revoked more than 7 days ago are deleted; recent and live ones stay", async () => {
  const user = await newUser("retsess");
  const live = await session(user, "live", new Date(Date.now() + 30 * DAY), null);
  const expiredLongAgo = await session(user, "expired-old", ago(8), null);
  const expiredRecently = await session(user, "expired-new", ago(2), null);
  const revokedLongAgo = await session(user, "revoked-old", new Date(Date.now() + 30 * DAY), ago(8));
  const revokedRecently = await session(user, "revoked-new", new Date(Date.now() + 30 * DAY), ago(1));
  await deleteExpiredSessions();
  const left = new Set((await database.selectFrom("sessions").select("id").where("user_id", "=", user).execute()).map((row) => row.id));
  assert.deepEqual([live.id, expiredRecently.id, revokedRecently.id].every((id) => left.has(id)), true);
  assert.equal(left.has(expiredLongAgo.id), false);
  assert.equal(left.has(revokedLongAgo.id), false);
});

test("expired reset tokens and tokens used more than a day ago are deleted", async () => {
  const user = await newUser("retreset");
  const insert = (label: string, expiresAt: Date, consumedAt: Date | null) => database.insertInto("password_reset_tokens")
    .values({ legacy_mongo_id: null, user_id: user, token_hash: `${label}-${runId}`, expires_at: expiresAt, consumed_at: consumedAt }).returning("id").executeTakeFirstOrThrow();
  const valid = await insert("valid", new Date(Date.now() + 10 * 60_000), null);
  const expired = await insert("expired", ago(0.01), null);
  const usedLongAgo = await insert("used-old", new Date(Date.now() + 10 * 60_000), ago(2));
  const usedJustNow = await insert("used-new", new Date(Date.now() + 10 * 60_000), new Date());
  await deleteSpentResetTokens();
  const left = new Set((await database.selectFrom("password_reset_tokens").select("id").where("user_id", "=", user).execute()).map((row) => row.id));
  assert.ok(left.has(valid.id) && left.has(usedJustNow.id));
  assert.ok(!left.has(expired.id) && !left.has(usedLongAgo.id));
});

test("read notifications older than 180 days are deleted; unread and recent ones stay", async () => {
  const user = await newUser("retnotif"); const actorA = await newUser("retactora"); const actorB = await newUser("retactorb"); const actorC = await newUser("retactorc");
  const insert = (actorId: string, createdAt: Date, readAt: Date | null) => database.insertInto("notifications")
    .values({ user_id: user, actor_id: actorId, type: "follow", created_at: createdAt, read_at: readAt }).returning("id").executeTakeFirstOrThrow();
  const oldRead = await insert(actorA, ago(181), ago(170));
  const oldUnread = await insert(actorB, ago(181), null);
  const recentRead = await insert(actorC, ago(10), ago(9));
  await purgeReadNotifications();
  const left = new Set((await database.selectFrom("notifications").select("id").where("user_id", "=", user).execute()).map((row) => row.id));
  assert.equal(left.has(oldRead.id), false);
  assert.ok(left.has(oldUnread.id), "unread activity is kept however old");
  assert.ok(left.has(recentRead.id));
});

test("a position not refreshed for 30 days loses its coordinates, keeps its settings, and drops out of nearby", async () => {
  const searcher = await newUser("retsearch"); const stale = await newUser("retstale"); const fresh = await newUser("retfresh");
  await savePosition(searcher, { latitude: 37.0, longitude: 35.3 });
  await savePosition(stale, { latitude: 37.001, longitude: 35.301, accuracy: 15 });
  await savePosition(fresh, { latitude: 37.002, longitude: 35.302 });
  await database.updateTable("user_locations").set({ visible: true, scope: "10km", location_updated_at: ago(31) }).where("user_id", "=", stale).execute();
  await wipeStaleLocations();
  const row = await database.selectFrom("user_locations").selectAll().where("user_id", "=", stale).executeTakeFirstOrThrow();
  assert.equal(Number(row.latitude), 0);
  assert.equal(Number(row.longitude), 0);
  assert.equal(row.accuracy_meters, null);
  assert.equal(row.city_id, null);
  assert.equal(new Date(row.location_updated_at).getTime(), 0);
  assert.equal(row.enabled, true, "the member's settings survive");
  assert.equal(row.scope, "10km");
  const settings = await getNearbySettings(stale);
  assert.equal(settings.enabled, true);
  const listed = (await listNearbyUsers(searcher)).users.map((user) => user.id);
  assert.ok(!listed.includes(stale));
  assert.ok(listed.includes(fresh), "a fresh position is untouched");
  const freshRow = await database.selectFrom("user_locations").select("latitude").where("user_id", "=", fresh).executeTakeFirstOrThrow();
  assert.equal(Number(freshRow.latitude), 37.002);
});
