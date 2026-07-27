import mongoose from "mongoose";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isValidCursorId = (id) =>
  typeof id === "string" &&
  (mongoose.isObjectIdOrHexString(id) || UUID_RE.test(id));

export const parsePagination = (
  query = {},
  { defaultLimit = DEFAULT_LIMIT, maxLimit = MAX_LIMIT } = {}
) => {
  const requested = Number.parseInt(String(query.limit || ""), 10);
  const limit = Number.isFinite(requested)
    ? Math.min(Math.max(requested, 1), maxLimit)
    : defaultLimit;

  let cursor = null;
  if (typeof query.cursor === "string" && query.cursor.length <= 512) {
    try {
      const parsed = JSON.parse(
        Buffer.from(query.cursor, "base64url").toString("utf8")
      );
      const date = new Date(parsed.date);
      if (!Number.isNaN(date.getTime()) && isValidCursorId(parsed.id)) {
        cursor = { date, id: parsed.id };
      }
    } catch {
      cursor = null;
    }
  }

  return { cursor, limit };
};

export const cursorFilter = (cursor, field = "createdAt") => {
  if (!cursor) return {};
  return {
    $or: [
      { [field]: { $lt: cursor.date } },
      { [field]: cursor.date, _id: { $lt: cursor.id } },
    ],
  };
};

export const pageFromDocuments = (documents, limit, field = "createdAt") => {
  const hasMore = documents.length > limit;
  const items = hasMore ? documents.slice(0, limit) : documents;
  const last = items.at(-1);
  const value = last?.[field];
  const nextCursor =
    hasMore && last && value ? createCursor(last, field) : null;

  return { items, nextCursor };
};

export const createCursor = (document, field = "createdAt") => {
  const value = document?.[field];
  if (!document?._id || !value) return null;
  return Buffer.from(
    JSON.stringify({
      date: new Date(value).toISOString(),
      id: document._id.toString(),
    })
  ).toString("base64url");
};
