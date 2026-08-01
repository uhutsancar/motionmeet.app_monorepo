import assert from "node:assert/strict";
import test from "node:test";
import { cursorFilter, createCursor, pageFromDocuments, parsePagination } from "../utils/pagination.js";

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
  const page = pageFromDocuments(rows, 2);
  assert.equal(page.items.length, 2);
  assert.ok(page.nextCursor);
  const parsed = parsePagination({ cursor: page.nextCursor });
  assert.ok(parsed.cursor);
  assert.equal(parsed.cursor.date.toISOString(), rows[1].createdAt.toISOString());
  assert.equal(parsed.cursor.id, rows[1].id);
  assert.deepEqual(cursorFilter(parsed.cursor), {
    $or: [
      { createdAt: { $lt: parsed.cursor.date } },
      { createdAt: parsed.cursor.date, _id: { $lt: parsed.cursor.id } },
    ],
  });
  assert.equal(createCursor(rows[1]), page.nextCursor);
});

test("pagination rejects non-UUID legacy identifiers", () => {
  const cursor = Buffer.from(JSON.stringify({ date: new Date().toISOString(), id: "507f1f77bcf86cd799439011" })).toString("base64url");
  assert.equal(parsePagination({ cursor }).cursor, null);
});
