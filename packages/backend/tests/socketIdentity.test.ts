import assert from "node:assert/strict";
import test from "node:test";
import { bindSocketIdentity, leaveLocalUser, localSocketState, type MotionSocket } from "../realtime/socketRegistry.js";
import type { InternalUser } from "../repositories/entities.js";

/**
 * NEW-14 (WP-17 of the 2026-11 audit): with the Redis adapter,
 * `fetchSockets()` - every presence lookup - serialises each socket's `data`
 * and ships it from every replica. Only the identity may travel that way; the
 * member's full record (email included) stays in the process that owns the
 * socket.
 */
const fakeSocket = (id: string): MotionSocket => ({ id, data: {} }) as unknown as MotionSocket;
const user = {
  id: "0b9c6c1e-1111-4222-8333-444455556666", _id: "0b9c6c1e-1111-4222-8333-444455556666",
  email: "private@example.test", full_name: "Private Member", username: "private_member", role: "user",
} as unknown as InternalUser;

test("socket.data carries the identity only; the full record stays local", () => {
  const socket = fakeSocket("socket-1");
  bindSocketIdentity(socket, { userId: user.id, sessionId: "6f1d0c1e-2222-4333-8444-555566667777" }, user);
  assert.deepEqual(Object.keys(socket.data).sort(), ["role", "sessionId", "userId"]);
  const travelling = JSON.stringify(socket.data);
  assert.ok(!travelling.includes("private@example.test"), "no email in what fetchSockets() transports");
  assert.ok(!travelling.includes("Private Member"));
  assert.equal(localSocketState(socket)?.user.email, "private@example.test");
});

test("leaving releases the local record", () => {
  const socket = fakeSocket("socket-2");
  bindSocketIdentity(socket, { userId: user.id, sessionId: "6f1d0c1e-2222-4333-8444-555566667778" }, user);
  leaveLocalUser(socket, user.id);
  assert.equal(localSocketState(socket), undefined);
});
