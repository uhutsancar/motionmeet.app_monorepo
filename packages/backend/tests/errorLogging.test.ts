import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { errorHandler } from "../middlewares/errorHandler.js";
import { errorDiagnostics, redactLogText } from "../utils/logger.js";

const capture = (): { lines: Array<{ level: string; line: Record<string, unknown> }>; restore: () => void } => {
  const lines: Array<{ level: string; line: Record<string, unknown> }> = [];
  const record = (level: string) => (output: unknown) => { lines.push({ level, line: JSON.parse(String(output)) as Record<string, unknown> }); };
  const mocks = [mock.method(console, "log", record("info")), mock.method(console, "warn", record("warn")), mock.method(console, "error", record("error"))];
  return { lines, restore: () => { for (const entry of mocks) entry.mock.restore(); } };
};

const respond = (error: unknown): { status: number; body: Record<string, unknown> } => {
  const result = { status: 0, body: {} as Record<string, unknown> };
  const response = {
    headersSent: false,
    status(code: number) { result.status = code; return this; },
    json(body: Record<string, unknown>) { result.body = body; return this; },
  } as unknown as Response;
  errorHandler(error, { requestId: "req-1", method: "GET", path: "/api/post/feed" } as Request, response, (() => undefined) as NextFunction);
  return result;
};

test("a 5xx logs its message and stack on the server, and tells the client nothing", () => {
  const output = capture();
  let result;
  try { result = respond(new Error("relation \"posts\" is being rebuilt")); } finally { output.restore(); }
  assert.equal(result.status, 500);
  assert.equal(result.body.message, "Internal server error");
  assert.equal(JSON.stringify(result.body).includes("rebuilt"), false);
  const [entry] = output.lines;
  assert.equal(entry?.level, "error");
  assert.equal(entry?.line.errorMessage, "relation \"posts\" is being rebuilt");
  assert.match(String(entry?.line.stack), /errorLogging\.test/);
});

test("a 4xx is ordinary traffic: info level, no stack", () => {
  const output = capture();
  try { respond(Object.assign(new Error("Invalid profile data"), { status: 400 })); } finally { output.restore(); }
  const [entry] = output.lines;
  assert.equal(entry?.level, "info");
  assert.equal(entry?.line.message, "request_rejected");
  assert.equal(entry?.line.stack, undefined);
});

test("what an error message may carry is masked before it is logged", () => {
  const signed = "https://ik.imagekit.io/motion/posts/u/1.jpg?ik-t=1700000000&ik-s=abcdef0123456789";
  const text = redactLogText(`fetch ${signed} failed for member@example.test via postgresql://app:secret@db:5432/motionmeet with eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjEifQ.c2lnbmF0dXJl`);
  assert.ok(!text.includes("ik-s="), text);
  assert.ok(!text.includes("member@example.test"), text);
  assert.ok(!text.includes("secret@"), text);
  assert.ok(!text.includes("eyJpZCI6IjEifQ"), text);
  assert.ok(text.includes("https://ik.imagekit.io/motion/posts/u/1.jpg?[redacted]"), text);
});

test("PostgreSQL errors keep the constraint and table, never the row values in detail", () => {
  const details = errorDiagnostics(Object.assign(new Error("duplicate key value violates unique constraint \"users_email_key\""), {
    code: "23505", constraint: "users_email_key", table: "users", detail: "Key (email)=(private@example.test) already exists.",
  }));
  assert.equal(details.constraint, "users_email_key");
  assert.equal(details.table, "users");
  assert.equal(details.errorCode, "23505");
  assert.equal(JSON.stringify(details).includes("private@example.test"), false);
});
