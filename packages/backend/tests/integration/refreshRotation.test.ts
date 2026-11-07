import "./testDatabase.js";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { Request } from "express";
import { connectDatabase, database, disconnectDatabase } from "../../configs/database.js";
import { REFRESH_REUSE_GRACE_MS, createRefreshSession, isSessionActive, revokeRefreshSession, rotateRefreshSession } from "../../utils/authTokens.js";

test.before(async () => { await connectDatabase(); });
test.after(async () => { await disconnectDatabase(); });

const fakeRequest = (): Request => ({ headers: {}, body: {}, get: () => "test-agent", ip: "203.0.113.9" }) as unknown as Request;

const member = async (label: string): Promise<{ userId: string; token: string; sessionId: string }> => {
  const runId = randomUUID().slice(0, 8);
  const user = await database.insertInto("users")
    .values({ legacy_mongo_id: null, email: `${label}-${runId}@example.test`, full_name: label, username: `${label}_${runId}`, password_hash: "test-hash" })
    .returning("id").executeTakeFirstOrThrow();
  const token = await createRefreshSession(user.id, fakeRequest());
  return { userId: user.id, token, sessionId: token.split(".")[0]! };
};

const rotatedToken = (outcome: Awaited<ReturnType<typeof rotateRefreshSession>>): string => {
  assert.equal(outcome.status, "rotated");
  return outcome.status === "rotated" ? outcome.refreshToken : "";
};

test("a refresh whose answer was lost can be repeated: the same token gets the same successor", async () => {
  const { userId, token } = await member("lost_answer");
  try {
    const first = rotatedToken(await rotateRefreshSession(token, fakeRequest()));
    const repeated = rotatedToken(await rotateRefreshSession(token, fakeRequest()));
    assert.equal(repeated, first, "the retry is handed what the lost response carried");
    // The successor works, and the chain goes on.
    const next = rotatedToken(await rotateRefreshSession(first, fakeRequest()));
    assert.notEqual(next, first);
  } finally {
    await database.deleteFrom("users").where("id", "=", userId).execute();
  }
});

test("two tabs refreshing at once both stay signed in", async () => {
  const { userId, token } = await member("two_tabs");
  try {
    const outcomes = await Promise.all([rotateRefreshSession(token, fakeRequest()), rotateRefreshSession(token, fakeRequest())]);
    const [left, right] = outcomes.map(rotatedToken);
    assert.equal(left, right);
  } finally {
    await database.deleteFrom("users").where("id", "=", userId).execute();
  }
});

test("a replaced token presented after the grace window revokes the whole session", async () => {
  const { userId, token, sessionId } = await member("reuse");
  try {
    const current = rotatedToken(await rotateRefreshSession(token, fakeRequest()));
    await database.updateTable("sessions").set({ rotated_at: new Date(Date.now() - REFRESH_REUSE_GRACE_MS - 5_000) }).where("id", "=", sessionId).execute();
    const outcome = await rotateRefreshSession(token, fakeRequest());
    assert.deepEqual(outcome, { status: "reused", userId, sessionId });
    assert.equal(await isSessionActive(sessionId, userId), false);
    // Whoever held the current token is cut off too.
    assert.equal((await rotateRefreshSession(current, fakeRequest())).status, "invalid");
  } finally {
    await database.deleteFrom("users").where("id", "=", userId).execute();
  }
});

test("unknown, malformed and older tokens are refused without touching the session", async () => {
  const { userId, token, sessionId } = await member("unknown");
  try {
    assert.equal((await rotateRefreshSession("not-a-token", fakeRequest())).status, "invalid");
    assert.equal((await rotateRefreshSession(`${sessionId}.${"z".repeat(43)}`, fakeRequest())).status, "invalid");
    const first = rotatedToken(await rotateRefreshSession(token, fakeRequest()));
    rotatedToken(await rotateRefreshSession(first, fakeRequest()));
    // Two rotations back is not remembered: refused, but not treated as theft.
    assert.equal((await rotateRefreshSession(token, fakeRequest())).status, "invalid");
    assert.equal(await isSessionActive(sessionId, userId), true);
  } finally {
    await database.deleteFrom("users").where("id", "=", userId).execute();
  }
});

test("signing out with the token just rotated away still ends the session", async () => {
  const { userId, token, sessionId } = await member("logout_grace");
  try {
    rotatedToken(await rotateRefreshSession(token, fakeRequest()));
    assert.equal(await revokeRefreshSession(token), sessionId);
    assert.equal(await isSessionActive(sessionId, userId), false);
  } finally {
    await database.deleteFrom("users").where("id", "=", userId).execute();
  }
});
