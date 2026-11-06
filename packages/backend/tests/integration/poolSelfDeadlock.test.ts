import "./testDatabase.js";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

/**
 * A transaction that reaches for the global `database` from inside its
 * callback needs a second pooled connection while holding the first. Under
 * load the pool runs dry and every such request waits for itself until the
 * connection timeout (R6 in the 2026-11 audit: createStory, 3 s, then
 * "timeout exceeded when trying to connect").
 *
 * The scenarios run in a child process whose pool has exactly one
 * connection, so any second connection from inside a transaction - whatever
 * helper takes it - shows up as a timeout instead of passing unnoticed on a
 * roomy test pool.
 */
const CONNECTION_TIMEOUT_MS = 2_000;
const EXPECTED = ["createStory", "createPost", "createMessage", "createWorkout", "createRoutine", "updateUser", "acceptFollowRequest", "likePost", "createPostComment", "deleteAccountData"];

interface Outcome { name: string; ms: number; error?: string }

const runScenarios = (): Promise<{ outcomes: Outcome[]; output: string }> => new Promise((resolve, reject) => {
  const script = fileURLToPath(new URL("./poolSelfDeadlock.scenarios.ts", import.meta.url));
  const child = spawn(process.execPath, ["--import", "tsx", script], {
    env: { ...process.env, DATABASE_POOL_MAX: "1", DATABASE_POOL_MIN: "0", DATABASE_CONNECTION_TIMEOUT_MS: String(CONNECTION_TIMEOUT_MS) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk: Buffer) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk: Buffer) => { output += chunk.toString(); });
  child.on("error", reject);
  child.on("close", () => {
    const line = output.split("\n").find((entry) => entry.startsWith("POOL_RESULTS "));
    if (!line) { reject(new Error(`The scenario process produced no report:\n${output.slice(-2_000)}`)); return; }
    resolve({ outcomes: JSON.parse(line.slice("POOL_RESULTS ".length)) as Outcome[], output });
  });
});

test("no write path takes a second pooled connection from inside its transaction", { timeout: 120_000 }, async () => {
  const { outcomes } = await runScenarios();
  assert.deepEqual(outcomes.map((outcome) => outcome.name), EXPECTED, "every scenario ran");
  for (const outcome of outcomes) {
    assert.equal(outcome.error, undefined, `${outcome.name} failed with one pooled connection: ${outcome.error}`);
    assert.ok(outcome.ms < CONNECTION_TIMEOUT_MS, `${outcome.name} took ${outcome.ms} ms - it waited for a connection it was itself holding`);
  }
});
