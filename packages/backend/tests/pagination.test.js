import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import {
  cursorFilter,
  createCursor,
  pageFromDocuments,
  parsePagination,
} from "../utils/pagination.js";

test("pagination clamps limits and rejects malformed cursors", () => {
  assert.equal(parsePagination({ limit: "500" }).limit, 100);
  assert.equal(parsePagination({ limit: "-2" }).limit, 1);
  assert.equal(parsePagination({ cursor: "not-base64-json" }).cursor, null);
});

test("pagination cursor round-trips the final document", () => {
  const date = new Date("2026-07-24T10:00:00.000Z");
  const documents = [0, 1, 2].map((offset) => ({
    _id: new mongoose.Types.ObjectId(),
    createdAt: new Date(date.getTime() - offset * 1000),
  }));
  const page = pageFromDocuments(documents, 2);
  assert.equal(page.items.length, 2);
  assert.ok(page.nextCursor);

  const parsed = parsePagination({ cursor: page.nextCursor });
  assert.equal(parsed.cursor.date.toISOString(), documents[1].createdAt.toISOString());
  assert.equal(parsed.cursor.id, documents[1]._id.toString());
  assert.deepEqual(cursorFilter(parsed.cursor), {
    $or: [
      { createdAt: { $lt: parsed.cursor.date } },
      {
        createdAt: parsed.cursor.date,
        _id: { $lt: parsed.cursor.id },
      },
    ],
  });
  assert.equal(createCursor(documents[1]), page.nextCursor);
});

test("pagination cursor accepts UUID string identifiers", () => {
  const uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
  const date = new Date("2026-07-24T10:00:00.000Z");
  const cursor = createCursor({ _id: uuid, createdAt: date });
  assert.ok(cursor, "cursor should be created for UUID _id");

  const parsed = parsePagination({ cursor });
  assert.ok(parsed.cursor, "UUID cursor should be accepted");
  assert.equal(parsed.cursor.id, uuid);
  assert.equal(parsed.cursor.date.toISOString(), date.toISOString());
});
