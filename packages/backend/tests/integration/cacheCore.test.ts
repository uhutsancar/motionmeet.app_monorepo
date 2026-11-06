import "./testDatabase.js";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import test from "node:test";
import { resetEnvironmentForTests } from "../../configs/environment.js";
import { cachedOwnerField, disconnectRedis, getRedisClient, initializeRedis, invalidateCacheOwners, readOwnerField, writeOwnerField } from "../../configs/redis.js";

/**
 * The owner-addressed cache core (WP-01 of the 2026-11 audit) against a real
 * Redis: per-field expiry, and the owner generation that keeps a write which
 * raced an invalidation from ever being served.
 */
if (!process.env.REDIS_URL) throw new Error("Cache core tests need REDIS_URL (see docker-compose.test.yml)");

const runId = randomUUID().slice(0, 8);
const ownerName = (name: string): string => `cache-core-${runId}:${name}`;

test.before(async () => { assert.ok(await initializeRedis(), "Redis must be reachable"); });
test.after(async () => { await disconnectRedis(); });

test("a field expires on its own TTL, not on the hash's", async () => {
  const owner = ownerName("ttl");
  const { generation } = await readOwnerField(owner, "page1");
  await writeOwnerField(owner, "page1", { page: 1 }, 2, generation);
  await sleep(1_000);
  await writeOwnerField(owner, "page2", { page: 2 }, 2, generation);
  await sleep(1_300);
  const page1 = await readOwnerField(owner, "page1");
  const page2 = await readOwnerField(owner, "page2");
  assert.equal(page1.hit, false, "page1 must not outlive its own two seconds");
  assert.equal(page2.hit, true);
  assert.deepEqual(page2.value, { page: 2 });
});

test("a write that raced an invalidation is stored but never served", async () => {
  const owner = ownerName("race");
  // A reader misses and reads the database...
  const before = await readOwnerField(owner, "page");
  assert.equal(before.hit, false);
  // ...a mutation commits and invalidates...
  await invalidateCacheOwners(owner);
  // ...and only then does the reader store what it read before the commit.
  await writeOwnerField(owner, "page", { stale: true }, 60, before.generation);
  const after = await readOwnerField(owner, "page");
  assert.equal(after.hit, false, "the stale page must not be served");
  assert.notEqual(after.generation, before.generation);
});

test("single-flight does not hand pre-invalidation results to post-invalidation callers", async () => {
  const owner = ownerName("flight");
  let computations = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const first = cachedOwnerField(owner, "page", 60, async () => {
    computations += 1;
    await gate;
    return "before";
  });
  // Let the first caller reach its computation.
  await sleep(50);
  await invalidateCacheOwners(owner);
  const second = cachedOwnerField(owner, "page", 60, async () => {
    computations += 1;
    return "after";
  });
  release();
  assert.equal(await first, "before");
  assert.equal(await second, "after", "a caller that started after the invalidation must not join the earlier computation");
  assert.equal(computations, 2);
  // And the value left in the cache is the post-invalidation one.
  assert.equal(await cachedOwnerField(owner, "page", 60, async () => "recomputed"), "after");
});

test("concurrent misses under one generation compute once", async () => {
  const owner = ownerName("collapse");
  let computations = 0;
  const compute = async (): Promise<number> => { computations += 1; await sleep(30); return 42; };
  const results = await Promise.all(Array.from({ length: 10 }, () => cachedOwnerField(owner, "page", 60, compute)));
  assert.deepEqual(results, Array(10).fill(42));
  assert.equal(computations, 1);
});

test("entries in the v1 format, or not in an envelope, are ignored", async () => {
  const client = getRedisClient();
  assert.ok(client);
  const owner = ownerName("legacy");
  await client.hSet(`motionmeet:v1:${owner}`, "page", JSON.stringify({ items: ["old"] }));
  await client.expire(`motionmeet:v1:${owner}`, 60);
  assert.equal((await readOwnerField(owner, "page")).hit, false, "a v1 key is never read");
  await client.hSet(`motionmeet:v2:${owner}`, "page", JSON.stringify({ items: ["unwrapped"] }));
  await client.expire(`motionmeet:v2:${owner}`, 60);
  assert.equal((await readOwnerField(owner, "page")).hit, false, "a value without an envelope is never read");
  await client.del([`motionmeet:v1:${owner}`, `motionmeet:v2:${owner}`]);
});

test("maxFields rebuilds the hash instead of growing it", async () => {
  const client = getRedisClient();
  assert.ok(client);
  const owner = ownerName("cap");
  const { generation } = await readOwnerField(owner, "a");
  await writeOwnerField(owner, "a", 1, 60, generation, 2);
  await writeOwnerField(owner, "b", 2, 60, generation, 2);
  assert.equal(await client.hLen(`motionmeet:v2:${owner}`), 2);
  await writeOwnerField(owner, "c", 3, 60, generation, 2);
  assert.equal(await client.hLen(`motionmeet:v2:${owner}`), 1);
  assert.equal((await readOwnerField(owner, "c")).hit, true);
  // Eviction is not an invalidation.
  assert.equal((await readOwnerField(owner, "c")).generation, generation);
});

test("cacheIf keeps a result out of the cache", async () => {
  const owner = ownerName("cacheif");
  let computations = 0;
  const compute = async (): Promise<string | null> => { computations += 1; return null; };
  await cachedOwnerField(owner, "missing", 60, compute, { cacheIf: (value) => value !== null });
  await cachedOwnerField(owner, "missing", 60, compute, { cacheIf: (value) => value !== null });
  assert.equal(computations, 2);
});

test("CACHE_READS_ENABLED=false serves nothing from the cache and stores nothing", async () => {
  const owner = ownerName("disabled");
  const { generation } = await readOwnerField(owner, "page");
  await writeOwnerField(owner, "page", "cached", 60, generation);
  process.env.CACHE_READS_ENABLED = "false";
  resetEnvironmentForTests();
  try {
    let computations = 0;
    const value = await cachedOwnerField(owner, "page", 60, async () => { computations += 1; return "fresh"; });
    assert.equal(value, "fresh");
    assert.equal(computations, 1);
    // Invalidations still run while serving is off, so turning it back on
    // cannot resurrect what was cached before.
    await invalidateCacheOwners(owner);
  } finally {
    delete process.env.CACHE_READS_ENABLED;
    resetEnvironmentForTests();
  }
  assert.equal((await readOwnerField(owner, "page")).hit, false);
});
