import assert from "node:assert/strict";
import { after, test } from "node:test";
import { closePasswordHashing, hashPassword, verifyPassword } from "../utils/passwordHashing.js";

after(async () => { await closePasswordHashing(); });

test("hashes and checks bcrypt passwords at cost 12, in the format stored today", async () => {
  const hash = await hashPassword("correct horse battery");
  assert.match(hash, /^\$2[aby]\$12\$/);
  assert.equal(await verifyPassword("correct horse battery", hash), true);
  assert.equal(await verifyPassword("wrong horse battery", hash), false);
});

test("an account without a hash never matches, and costs a real check", async () => {
  const started = performance.now();
  assert.equal(await verifyPassword("anything at all", null), false);
  assert.equal(await verifyPassword("anything at all", ""), false);
  // Two cost-12 checks: an unknown e-mail address must not answer at once.
  assert.ok(performance.now() - started > 50, "the dummy check ran");
});

/**
 * The reason for the pool: bcryptjs on the main thread stopped every other
 * request, socket frame and timer of the process for ~255 ms per check.
 */
test("checks run off the event loop: timers keep firing while several are in flight", async () => {
  const hash = await hashPassword("event loop stays free");
  let ticks = 0;
  let longestGap = 0;
  let last = performance.now();
  const timer = setInterval(() => {
    const now = performance.now();
    longestGap = Math.max(longestGap, now - last);
    last = now;
    ticks += 1;
  }, 5);
  try {
    const results = await Promise.all(Array.from({ length: 4 }, () => verifyPassword("event loop stays free", hash)));
    assert.deepEqual(results, [true, true, true, true]);
  } finally {
    clearInterval(timer);
  }
  assert.ok(ticks > 10, `timer fired ${ticks} times`);
  assert.ok(longestGap < 150, `longest event-loop gap ${Math.round(longestGap)} ms`);
});
