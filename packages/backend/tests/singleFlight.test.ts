import assert from "node:assert/strict";
import test from "node:test";
import { inFlightCount, singleFlight } from "../utils/singleFlight.js";

const deferred = <T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: Error) => void } => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolveFn, rejectFn) => { resolve = resolveFn; reject = rejectFn; });
  return { promise, resolve, reject };
};

test("concurrent callers on one key run the work once", async () => {
  const gate = deferred<string>();
  let runs = 0;
  const run = async (): Promise<string> => { runs += 1; return gate.promise; };

  // A thousand members hitting an expired feed entry at the same moment: the
  // whole point is that PostgreSQL sees one query, not a thousand.
  const waiting = Array.from({ length: 1_000 }, () => singleFlight("feed:alice:first", run));
  gate.resolve("page");

  assert.deepEqual(new Set(await Promise.all(waiting)), new Set(["page"]));
  assert.equal(runs, 1);
});

test("different keys do not block each other", async () => {
  const order: string[] = [];
  const slow = deferred<void>();
  const alice = singleFlight("feed:alice", async () => { await slow.promise; order.push("alice"); });
  const bob = singleFlight("feed:bob", async () => { order.push("bob"); });

  await bob;
  assert.deepEqual(order, ["bob"], "bob must not wait behind alice's key");
  slow.resolve();
  await alice;
  assert.deepEqual(order, ["bob", "alice"]);
});

test("a key is released once its work settles, so the next miss can retry", async () => {
  await singleFlight("feed:carol", async () => "first");
  assert.equal(inFlightCount(), 0);

  let runs = 0;
  const value = await singleFlight("feed:carol", async () => { runs += 1; return "second"; });
  assert.equal(value, "second");
  assert.equal(runs, 1, "a settled key must not keep serving the previous result");
});

test("a failure rejects every waiter and does not poison the key", async () => {
  const gate = deferred<string>();
  const waiting = [
    singleFlight("feed:dave", () => gate.promise),
    singleFlight("feed:dave", () => gate.promise),
  ];
  gate.reject(new Error("database unavailable"));

  const settled = await Promise.allSettled(waiting);
  assert.deepEqual(settled.map((entry) => entry.status), ["rejected", "rejected"]);
  assert.equal(inFlightCount(), 0);

  // The next request must be free to try again rather than inherit the failure.
  assert.equal(await singleFlight("feed:dave", async () => "recovered"), "recovered");
});
