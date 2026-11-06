import "./testDatabase.js";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { Request, RequestHandler, Response } from "express";
import { connectDatabase, database, disconnectDatabase } from "../../configs/database.js";
import { disconnectRedis, initializeRedis } from "../../configs/redis.js";
import { createRefreshSession, isSessionActive, signAccessToken } from "../../utils/authTokens.js";
import { protect, requireActiveSession } from "../../middlewares/auth.js";
import { logoutUser } from "../../controllers/authController.js";
import { createPasswordResetToken, resetPasswordWithToken } from "../../services/authService.js";
import { deleteAccountData } from "../../services/accountService.js";

test.before(async () => { await connectDatabase(); assert.ok(await initializeRedis(), "Redis must be reachable"); });
test.after(async () => { await disconnectRedis(); await disconnectDatabase(); });

const fakeRequest = (headers: Record<string, string> = {}, body: unknown = {}): Request =>
  ({ headers, body, get: (name: string) => headers[name.toLowerCase()], ip: "127.0.0.1" }) as unknown as Request;

/** Runs one middleware; resolves to the status it answered with, or "next" when it let the request through. */
const run = (middleware: RequestHandler, request: Request): Promise<number | "next"> => new Promise((resolve, reject) => {
  const response = { status: (code: number) => { resolve(code); return { json: () => undefined }; } } as unknown as Response;
  Promise.resolve(middleware(request, response, (error?: unknown) => (error ? reject(error) : resolve("next")))).catch(reject);
});

const signedIn = async (label: string): Promise<{ userId: string; sessionId: string; refreshToken: string; access: Request }> => {
  const runId = randomUUID().slice(0, 8);
  const user = await database.insertInto("users")
    .values({ legacy_mongo_id: null, email: `${label}-${runId}@example.test`, full_name: `${label} member`, username: `${label}_${runId}`, password_hash: "test-hash" })
    .returning("id").executeTakeFirstOrThrow();
  const refreshToken = await createRefreshSession(user.id, fakeRequest());
  const sessionId = refreshToken.split(".")[0]!;
  const { token } = signAccessToken(user.id, sessionId);
  const access = fakeRequest({ authorization: `Bearer ${token}` });
  return { userId: user.id, sessionId, refreshToken, access };
};

test("P1-SOCKET-003: a socket's session counts only while it is unrevoked, unexpired and its owner's", async () => {
  const runId = randomUUID().slice(0, 8);
  const [owner, other] = await Promise.all(["owner", "other"].map((name) => database.insertInto("users")
    .values({ legacy_mongo_id: null, email: `${name}-${runId}@example.test`, full_name: name, username: `${name}_${runId}`, password_hash: "test-hash" })
    .returning("id").executeTakeFirstOrThrow()));
  try {
    const live = await database.insertInto("sessions").values({ user_id: owner!.id, token_hash: `live-${runId}`, expires_at: new Date(Date.now() + 86_400_000), revoked_at: null }).returning("id").executeTakeFirstOrThrow();
    const expired = await database.insertInto("sessions").values({ user_id: owner!.id, token_hash: `expired-${runId}`, expires_at: new Date(Date.now() - 1_000), revoked_at: null }).returning("id").executeTakeFirstOrThrow();

    assert.equal(await isSessionActive(live.id, owner!.id), true);
    assert.equal(await isSessionActive(live.id, other!.id), false, "another member's token cannot borrow the session");
    assert.equal(await isSessionActive(expired.id, owner!.id), false);
    assert.equal(await isSessionActive(randomUUID(), owner!.id), false);

    await database.updateTable("sessions").set({ revoked_at: new Date() }).where("id", "=", live.id).execute();
    assert.equal(await isSessionActive(live.id, owner!.id), false, "logout revokes it");
  } finally {
    await database.deleteFrom("users").where("id", "in", [owner!.id, other!.id]).execute();
  }
});

test("MM-SEC-01: after logout the same access token is refused at once, not after 15 minutes", async () => {
  const member = await signedIn("logout");
  try {
    assert.equal(await run(protect, member.access), "next");
    const response = { clearCookie: () => undefined, json: () => undefined, cookie: () => undefined } as unknown as Response;
    await new Promise<void>((resolve, reject) => {
      Promise.resolve(logoutUser(fakeRequest({}, { refreshToken: member.refreshToken }), response, (error?: unknown) => (error ? reject(error) : resolve()))).then(() => resolve(), reject);
    });
    assert.equal(await run(protect, member.access), 401);
  } finally {
    await database.deleteFrom("users").where("id", "=", member.userId).execute();
  }
});

test("MM-SEC-01: a password reset refuses every access token issued before it", async () => {
  const member = await signedIn("reset");
  try {
    assert.equal(await run(protect, member.access), "next");
    const rawToken = await createPasswordResetToken(member.userId);
    assert.equal(await resetPasswordWithToken(rawToken, "new-hash"), member.userId);
    assert.equal(await run(protect, member.access), 401);
  } finally {
    await database.deleteFrom("users").where("id", "=", member.userId).execute();
  }
});

test("NEW-11: a deleted account's access token is refused with 401 before any handler can hit a missing row", async () => {
  const member = await signedIn("deleted");
  assert.equal(await run(protect, member.access), "next");
  assert.equal(await deleteAccountData(member.userId), true);
  // Without this, PUT /api/nearby/position with the old token reached the
  // handler and failed on a foreign key with a 500.
  assert.equal(await run(protect, member.access), 401);
});

test("D-09: sensitive routes check the session in PostgreSQL, so they hold even without the Redis marker", async () => {
  const member = await signedIn("sensitive");
  try {
    assert.equal(await run(requireActiveSession, Object.assign(member.access, { userId: member.userId, sessionId: member.sessionId })), "next");
    // Revoked directly in the database: no Redis marker was written.
    await database.updateTable("sessions").set({ revoked_at: new Date() }).where("id", "=", member.sessionId).execute();
    assert.equal(await run(protect, member.access), "next", "ordinary routes stay stateless until the token expires");
    assert.equal(await run(requireActiveSession, member.access), 401, "a sensitive route does not");
  } finally {
    await database.deleteFrom("users").where("id", "=", member.userId).execute();
  }
});
