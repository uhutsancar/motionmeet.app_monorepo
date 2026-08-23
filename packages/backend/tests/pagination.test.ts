import assert from "node:assert/strict";
import test from "node:test";
import { createCursor, parsePagination } from "../utils/pagination.js";

const UUIDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
] as const;

test("pagination clamps limits and rejects malformed cursors", () => {
  assert.equal(parsePagination({ limit: "500" }).limit, 100);
  assert.equal(parsePagination({ limit: "-2" }).limit, 1);
  assert.equal(parsePagination({ cursor: "not-base64-json" }).cursor, null);
});

test("PostgreSQL UUID pagination cursor round-trips the final row", () => {
  const date = new Date("2026-07-24T10:00:00.000Z");
  const rows = UUIDS.map((id, offset) => ({ id, createdAt: new Date(date.getTime() - offset * 1000) }));
  // What a paged endpoint hands back: a cursor built from the last row it
  // returned, which the next request must decode to exactly that row.
  const nextCursor = createCursor(rows[1]);
  assert.ok(nextCursor);
  const parsed = parsePagination({ cursor: nextCursor });
  assert.ok(parsed.cursor);
  assert.equal(parsed.cursor.date.toISOString(), rows[1].createdAt.toISOString());
  assert.equal(parsed.cursor.id, rows[1].id);
});

test("pagination rejects non-UUID legacy identifiers", () => {
  const cursor = Buffer.from(JSON.stringify({ date: new Date().toISOString(), id: "507f1f77bcf86cd799439011" })).toString("base64url");
  assert.equal(parsePagination({ cursor }).cursor, null);
});
