import assert from "node:assert/strict";
import test from "node:test";
import { cachedOwnerField, invalidateCacheOwners, readOwnerField, writeOwnerField } from "../configs/redis.js";

/**
 * Redis is optional: without a connection the owner cache must compute every
 * time, never fail, and never stall a mutation on invalidation retries. This
 * process never calls `initializeRedis`, which is the situation of the worker,
 * the scheduler and every unit test.
 */
test("without Redis the read-through helper computes on every call", async () => {
  let computations = 0;
  const compute = async (): Promise<number> => { computations += 1; return computations; };
  assert.equal(await cachedOwnerField("unit:owner", "field", 60, compute), 1);
  assert.equal(await cachedOwnerField("unit:owner", "field", 60, compute), 2);
  assert.equal(await cachedOwnerField("unit:owner", "field", 60, compute), 3);
});

test("without Redis a read is a miss with no generation, and a write is a no-op", async () => {
  const read = await readOwnerField("unit:owner", "field");
  assert.deepEqual(read, { hit: false, value: null, generation: null });
  await writeOwnerField("unit:owner", "field", { anything: true }, 60, 1);
  assert.equal((await readOwnerField("unit:owner", "field")).hit, false);
});

test("without Redis an invalidation returns at once instead of retrying", async () => {
  const started = Date.now();
  await invalidateCacheOwners("unit:owner", "unit:other");
  assert.ok(Date.now() - started < 100, "no retry delay in a process that never connected to Redis");
});
