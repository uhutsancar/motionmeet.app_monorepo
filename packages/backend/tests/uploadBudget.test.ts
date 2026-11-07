import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import { UPLOAD_MEMORY_BUDGET_BYTES, reserveUploadMemory, uploadBytesInFlight } from "../middlewares/uploadBudget.js";

const MB = 1024 * 1024;

interface Outcome { response: Response & EventEmitter; status: number | null; passed: boolean }
const send = (contentLength: number | null, maxBytes = 81 * MB): Outcome => {
  const outcome = { status: null as number | null, passed: false } as Outcome;
  const response = Object.assign(new EventEmitter(), {
    set: () => response,
    status: (code: number) => { outcome.status = code; return response; },
    json: () => response,
  }) as unknown as Response & EventEmitter;
  outcome.response = response;
  const request = { get: (name: string) => (name.toLowerCase() === "content-length" && contentLength !== null ? String(contentLength) : undefined) } as unknown as Request;
  reserveUploadMemory(maxBytes)(request, response, (() => { outcome.passed = true; }) as NextFunction);
  return outcome;
};

/**
 * Multipart uploads are read into memory. Without a ceiling a burst of them
 * pushed the API past its container limit; now the burst gets 503s and the
 * process stays up.
 */
test("concurrent multipart uploads share one memory budget; past it they are refused, not buffered", () => {
  const perUpload = 40 * MB;
  const admitted: Outcome[] = [];
  for (let index = 0; index < Math.floor(UPLOAD_MEMORY_BUDGET_BYTES / perUpload); index += 1) {
    const outcome = send(perUpload);
    assert.equal(outcome.passed, true);
    admitted.push(outcome);
  }
  const refused = send(perUpload);
  assert.equal(refused.passed, false);
  assert.equal(refused.status, 503);

  // A finished (or aborted) upload gives its share back, once.
  admitted[0]!.response.emit("finish");
  admitted[0]!.response.emit("close");
  assert.equal(send(perUpload).passed, true);
  for (const outcome of admitted.slice(1)) outcome.response.emit("close");
});

test("a request declaring more than the route allows is refused before its body is read", () => {
  const outcome = send(200 * MB);
  assert.equal(outcome.status, 413);
  assert.equal(outcome.passed, false);
});

test("a request without a length reserves the route's maximum", () => {
  const before = uploadBytesInFlight();
  const outcome = send(null, 21 * MB);
  assert.equal(uploadBytesInFlight() - before, 21 * MB);
  outcome.response.emit("close");
  assert.equal(uploadBytesInFlight(), before);
});
