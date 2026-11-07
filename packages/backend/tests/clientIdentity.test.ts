import assert from "node:assert/strict";
import { createServer, request as httpRequest } from "node:http";
import test from "node:test";
import express, { type Request } from "express";
import { bearerOrClientKey, clientAndEmailKey, clientKey, memberKey, refreshSessionKey } from "../middlewares/rateLimits.js";
import { signAccessToken } from "../utils/authTokens.js";

interface FakeRequest { ip?: string; userId?: string; body?: unknown; headers?: Record<string, string> }
const fakeRequest = (fields: FakeRequest): Request =>
  ({ headers: {}, body: {}, ...fields }) as unknown as Request;

/** Sends one request through a real Express app and returns what it saw as `request.ip`. */
const ipSeenBehind = async (trustProxy: number | false | string[], forwardedFor: string): Promise<string> => {
  const app = express();
  app.set("trust proxy", trustProxy);
  app.get("/", (request, response) => { response.send(request.ip); });
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  try {
    return await new Promise<string>((resolve, reject) => {
      const outgoing = httpRequest({ host: "127.0.0.1", port, path: "/", headers: { "X-Forwarded-For": forwardedFor } }, (response) => {
        let body = "";
        response.on("data", (chunk) => { body += String(chunk); });
        response.on("end", () => resolve(body));
      });
      outgoing.on("error", reject);
      outgoing.end();
    });
  } finally {
    server.close();
  }
};

/**
 * The 2026-11 review measured two different clients behind a TLS proxy and
 * nginx both arriving as 10.0.0.5: with `trust proxy 1` the API saw the TLS
 * proxy, so every rate limit was one budget for everybody.
 */
test("behind a TLS proxy and nginx, a fixed single hop sees the proxy; trusting the proxies' range sees the client", async () => {
  // client 203.0.113.9 -> TLS proxy 10.0.0.5 -> nginx -> API (the test client is nginx, 127.0.0.1)
  const chain = "203.0.113.9, 10.0.0.5";
  assert.equal(await ipSeenBehind(1, chain), "10.0.0.5", "the old setting: every member is the TLS proxy");
  assert.equal(await ipSeenBehind(["loopback", "10.0.0.0/8"], chain), "203.0.113.9");
  assert.equal(await ipSeenBehind(2, chain), "203.0.113.9");
});

test("a client cannot forge its address past the trusted proxies", async () => {
  // A client that reaches nginx directly prepends a fake entry; nginx appends the real one.
  assert.equal(await ipSeenBehind(["loopback", "10.0.0.0/8"], "198.51.100.1, 203.0.113.9"), "203.0.113.9");
});

test("signed-in requests count against the member, so a carrier NAT does not merge them", () => {
  const sharedAddress = "100.64.0.1";
  const first = fakeRequest({ ip: sharedAddress, userId: "0b9c6c1e-1111-4222-8333-444455556666" });
  const second = fakeRequest({ ip: sharedAddress, userId: "6f1d0c1e-2222-4333-8444-555566667777" });
  assert.notEqual(memberKey(first), memberKey(second));
  assert.equal(memberKey(fakeRequest({ ip: sharedAddress })), clientKey(fakeRequest({ ip: sharedAddress })));
});

test("before protect, a valid access token names the member and anything else falls back to the address", () => {
  const userId = "0b9c6c1e-1111-4222-8333-444455556666";
  const { token } = signAccessToken(userId, "6f1d0c1e-2222-4333-8444-555566667777");
  assert.equal(bearerOrClientKey(fakeRequest({ ip: "100.64.0.1", headers: { authorization: `Bearer ${token}` } })), `user:${userId}`);
  assert.equal(bearerOrClientKey(fakeRequest({ ip: "100.64.0.1", headers: { authorization: "Bearer forged.token.value" } })), clientKey(fakeRequest({ ip: "100.64.0.1" })));
});

test("login attempts count per address and account; the e-mail address is never stored", () => {
  const one = clientAndEmailKey(fakeRequest({ ip: "100.64.0.1", body: { email: "Member@Example.test " } }));
  const same = clientAndEmailKey(fakeRequest({ ip: "100.64.0.1", body: { email: "member@example.test" } }));
  const other = clientAndEmailKey(fakeRequest({ ip: "100.64.0.1", body: { email: "someone@example.test" } }));
  assert.equal(one, same);
  assert.notEqual(one, other);
  assert.ok(!one.includes("example.test"));
});

test("IPv6 clients are grouped by /56 so one host cannot rotate through its block", () => {
  assert.equal(clientKey(fakeRequest({ ip: "2001:db8:aa:bb00::1" })), clientKey(fakeRequest({ ip: "2001:db8:aa:bbff::2" })));
});

test("a refresh counts against the session it names", () => {
  const sessionId = "6f1d0c1e-2222-4333-8444-555566667777";
  const viaBody = refreshSessionKey(fakeRequest({ ip: "100.64.0.1", body: { refreshToken: `${sessionId}.${"x".repeat(40)}` } }));
  const viaCookie = refreshSessionKey(fakeRequest({ ip: "100.64.0.2", headers: { cookie: `motionmeet_refresh=${sessionId}.${"y".repeat(40)}` } }));
  assert.equal(viaBody, `session:${sessionId}`);
  assert.equal(viaCookie, viaBody);
  assert.equal(refreshSessionKey(fakeRequest({ ip: "100.64.0.1", body: { refreshToken: "nonsense" } })), clientKey(fakeRequest({ ip: "100.64.0.1" })));
});
