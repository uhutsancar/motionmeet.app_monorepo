import "./testDatabase.js";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { sql } from "kysely";
import { connectDatabase, database, disconnectDatabase } from "../../configs/database.js";
import { PRESENCE_TTL_MS, disconnectRedis, getRedisClient, initializeRedis, presenceAdd, presenceOnline, presenceRefresh, presenceRemove } from "../../configs/redis.js";
import { runExclusive } from "../../utils/advisoryLock.js";

if (!process.env.REDIS_URL) throw new Error("Presence tests need REDIS_URL (see docker-compose.test.yml)");

test.before(async () => { await connectDatabase(); assert.ok(await initializeRedis(), "Redis must be reachable"); });
test.after(async () => { await disconnectRedis(); await disconnectDatabase(); });

/**
 * Presence moved from `fetchSockets()` across every replica to one sorted set
 * per member (configs/redis.ts). Online is "has a socket whose score is in
 * the future"; a replica that dies stops refreshing and its sockets lapse.
 */
test("a member is online from the first socket to the last, on any replica", async () => {
  const member = randomUUID();
  const other = randomUUID();
  assert.equal(await presenceAdd(member, "socket-a"), 0, "first socket: nobody else had one");
  assert.equal(await presenceAdd(member, "socket-b"), 1, "second socket, maybe on another replica");
  assert.deepEqual(await presenceOnline([member, other]), new Set([member]));
  assert.equal(await presenceRemove(member, "socket-a"), 1);
  assert.equal(await presenceRemove(member, "socket-b"), 0, "last socket gone: offline");
  assert.deepEqual(await presenceOnline([member]), new Set());
});

test("a socket whose replica stopped refreshing it no longer counts", async () => {
  const member = randomUUID();
  await presenceAdd(member, "orphan");
  // As if the heartbeat had last run longer ago than the TTL.
  const client = getRedisClient();
  assert.ok(client);
  await client.zAdd(`motionmeet:v2:presence:${member}`, { score: Date.now() - 1, value: "orphan" });
  assert.deepEqual(await presenceOnline([member]), new Set());
  assert.equal(await presenceAdd(member, "fresh"), 0, "the lapsed socket is not counted as another one");
  await presenceRefresh([{ userId: member, socketId: "fresh" }]);
  const score = await client.zScore(`motionmeet:v2:presence:${member}`, "fresh");
  assert.ok(score !== null && score > Date.now() + PRESENCE_TTL_MS / 2);
  await presenceRemove(member, "fresh");
});

/**
 * Scheduled tasks hold a lease row (migration 020) instead of a session-level
 * advisory lock, which a pooler in transaction mode cannot keep.
 */
test("a lease left by a runner that died is taken over once it expires", async () => {
  const name = `test:lease:${randomUUID()}`;
  await sql`insert into scheduler_leases (name, holder, expires_at) values (${name}, 'dead-runner', now() + interval '1 minute')`.execute(database);
  assert.equal(await runExclusive(name, async () => assert.fail("must not run while the lease stands")), false);
  await sql`update scheduler_leases set expires_at = now() - interval '1 second' where name = ${name}`.execute(database);
  let ran = false;
  assert.equal(await runExclusive(name, async () => { ran = true; }), true);
  assert.equal(ran, true);
  assert.equal((await sql`select 1 from scheduler_leases where name = ${name}`.execute(database)).rows.length, 0, "released after the run");
});
