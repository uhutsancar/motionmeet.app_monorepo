import "dotenv/config";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { brotliCompressSync, deflateSync, gzipSync } from "node:zlib";
import express, { type ErrorRequestHandler, type NextFunction, type Request, type Response } from "express";
import type { Options as RateLimitOptions } from "express-rate-limit";
import { createRateLimitStore } from "../configs/redis.js";
import { loadEnvironment } from "../configs/environment.js";
import { isAllowedBrowserOrigin, parseJsonBody, rejectUnsupportedApiContentType, verifyBrowserAuthRequest } from "../middlewares/browserSecurity.js";
import { toPublicError } from "../middlewares/errorHandler.js";
import { getRefreshTokenFromRequest } from "../utils/authTokens.js";
import { safeErrorMetadata } from "../utils/logger.js";

test("browser origin validation uses exact origins", () => {
  const allowed = ["https://motionmeet.app", "https://www.motionmeet.app"];
  assert.equal(isAllowedBrowserOrigin("https://motionmeet.app", allowed, false), true);
  assert.equal(isAllowedBrowserOrigin("https://motionmeet.app.attacker.test", allowed, false), false);
  assert.equal(isAllowedBrowserOrigin("http://192.168.1.10:5173", allowed, true), true);
  assert.equal(isAllowedBrowserOrigin("http://192.168.1.10:5173", allowed, false), false);
  assert.equal(isAllowedBrowserOrigin(null, allowed, false), false);
});

const runBrowserAuthCheck = (headers: Record<string, string>, body: Record<string, unknown> = {}) => {
  let status = 0;
  let nextCalled = false;
  const request = {
    body,
    requestId: "request-id",
    get: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
  const response = {
    status(code: number) { status = code; return this; },
    json() { return this; },
  } as unknown as Response;
  verifyBrowserAuthRequest(request, response, (() => { nextCalled = true; }) as NextFunction);
  return { status, nextCalled };
};

test("browser cookie auth requires an allowed origin and CSRF header", () => {
  const allowedOrigin = loadEnvironment().corsOrigins[0];
  assert.ok(allowedOrigin);
  assert.deepEqual(runBrowserAuthCheck({ origin: allowedOrigin }), { status: 403, nextCalled: false });
  assert.deepEqual(runBrowserAuthCheck({ origin: `${allowedOrigin}.attacker.test`, "x-csrf-protection": "1" }), { status: 403, nextCalled: false });
  assert.deepEqual(runBrowserAuthCheck({ origin: allowedOrigin, "x-csrf-protection": "1" }), { status: 0, nextCalled: true });
  assert.deepEqual(runBrowserAuthCheck({ "x-client-platform": "mobile" }, { refreshToken: "native-body-token" }), { status: 0, nextCalled: true });
});

test("the referer stands in for a missing origin, but only an allowed one", () => {
  const allowedOrigin = loadEnvironment().corsOrigins[0];
  assert.deepEqual(runBrowserAuthCheck({ referer: `${allowedOrigin}/settings`, "x-csrf-protection": "1" }), { status: 0, nextCalled: true });
  assert.deepEqual(runBrowserAuthCheck({ referer: "https://attacker.test/motionmeet", "x-csrf-protection": "1" }), { status: 403, nextCalled: false });
  assert.deepEqual(runBrowserAuthCheck({ "x-csrf-protection": "1" }), { status: 403, nextCalled: false });
});

test("a forged mobile header alone does not skip the browser checks", () => {
  // Without a body token the request can only be riding the refresh cookie.
  assert.deepEqual(runBrowserAuthCheck({ "x-client-platform": "mobile" }), { status: 403, nextCalled: false });
  assert.deepEqual(runBrowserAuthCheck({ "x-client-platform": "mobile", origin: "https://attacker.test" }, { refreshToken: 42 }), { status: 403, nextCalled: false });
});

test("a native body token is used instead of, never alongside, the refresh cookie", () => {
  const request = {
    body: { refreshToken: "attacker-supplied" },
    headers: { cookie: "theme=dark; motionmeet_refresh=victim-session.secret" },
    get: (name: string) => (name.toLowerCase() === "x-client-platform" ? "mobile" : undefined),
  } as unknown as Request;
  assert.equal(getRefreshTokenFromRequest(request), "attacker-supplied");
  const cookieOnly = { body: {}, headers: { cookie: "motionmeet_refresh=victim-session.secret" }, get: () => undefined } as unknown as Request;
  assert.equal(getRefreshTokenFromRequest(cookieOnly), "victim-session.secret");
});

const runContentTypeCheck = (method: string, contentType?: string) => {
  let status = 0;
  let body: unknown;
  let nextCalled = false;
  const request = {
    method,
    requestId: "request-id",
    get: (name: string) => name.toLowerCase() === "content-type" ? contentType : undefined,
  } as unknown as Request;
  const response = {
    status(code: number) { status = code; return this; },
    json(value: unknown) { body = value; return this; },
  } as unknown as Response;
  const next = (() => { nextCalled = true; }) as NextFunction;
  rejectUnsupportedApiContentType(request, response, next);
  return { status, body, nextCalled };
};

test("API content type policy rejects form, text and XML bodies", () => {
  for (const contentType of ["application/x-www-form-urlencoded", "text/plain", "application/xml", "text/xml; charset=utf-8"]) {
    const result = runContentTypeCheck("POST", contentType);
    assert.equal(result.status, 415);
    assert.equal(result.nextCalled, false);
  }
  assert.equal(runContentTypeCheck("POST", "application/json; charset=utf-8").nextCalled, true);
  assert.equal(runContentTypeCheck("POST", "multipart/form-data; boundary=test").nextCalled, true);
  assert.equal(runContentTypeCheck("POST").nextCalled, true);
  assert.equal(runContentTypeCheck("GET", "application/xml").nextCalled, true);
});

test("database conflicts and parser errors use generic public messages", () => {
  const conflict = Object.assign(new Error("duplicate key violates users_email_key"), { code: "23505" });
  assert.deepEqual(
    { status: toPublicError(conflict).status, message: toPublicError(conflict).message },
    { status: 409, message: "The request conflicts with existing data" },
  );

  const malformedJson = Object.assign(new SyntaxError("Unexpected token secret"), { status: 400, type: "entity.parse.failed" });
  assert.equal(toPublicError(malformedJson).message, "Invalid request");

  const applicationError = Object.assign(new Error("Invalid profile data"), { status: 400 });
  assert.equal(toPublicError(applicationError).message, "Invalid profile data");
});

test("safe error metadata excludes raw database details", () => {
  const metadata = safeErrorMetadata(Object.assign(new Error("private row value"), { code: "23505", detail: "secret@example.test" }));
  assert.deepEqual(metadata, { errorName: "Error", errorCode: "23505" });
  assert.equal(JSON.stringify(metadata).includes("secret@example.test"), false);
});

test("rate limiting remains active before Redis initialization", async () => {
  const store = createRateLimitStore("test-adaptive-store");
  store.init?.({ windowMs: 1_000 } as RateLimitOptions);
  assert.equal((await store.increment("client")).totalHits, 1);
  assert.equal((await store.increment("client")).totalHits, 2);
  await store.resetKey("client");
  assert.equal((await store.increment("client")).totalHits, 1);
  store.shutdown?.();
});

test("compressed JSON bodies are refused without being decoded", async () => {
  const app = express();
  app.post("/echo", parseJsonBody, (request, response) => { response.json(request.body); });
  app.use(((error, _request, response, _next) => { response.status(toPublicError(error).status).end(); }) as ErrorRequestHandler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/echo`;
    const body = JSON.stringify({ email: "member@example.test" });
    const plain = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body });
    assert.equal(plain.status, 200);
    assert.deepEqual(await plain.json(), { email: "member@example.test" });
    for (const [encoding, compressed] of [["br", brotliCompressSync(body)], ["gzip", gzipSync(body)], ["deflate", deflateSync(body)]] as const) {
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "content-encoding": encoding }, body: compressed });
      assert.equal(response.status, 415, `${encoding} body was accepted`);
    }
  } finally {
    server.close();
  }
});
