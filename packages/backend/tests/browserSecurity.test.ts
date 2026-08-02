import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import type { Options as RateLimitOptions } from "express-rate-limit";
import { createRateLimitStore } from "../configs/redis.js";
import { loadEnvironment } from "../configs/environment.js";
import { isAllowedBrowserOrigin, rejectUnsupportedApiContentType, verifyBrowserAuthRequest } from "../middlewares/browserSecurity.js";
import { toPublicError } from "../middlewares/errorHandler.js";
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
