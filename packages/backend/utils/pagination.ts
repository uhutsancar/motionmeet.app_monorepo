import { UUID_PATTERN } from "./validation.js";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;
export interface PageCursor { date: Date; id: string }
export interface Pagination {
  cursor: PageCursor | null;
  limit: number;
  /**
   * The untouched cursor string. Most endpoints keyset on `(created_at, id)` and
   * only need `cursor`; Keşfet walks `(discover_rank, id)` instead and decodes
   * this itself.
   */
  rawCursor: string | null;
}
export type QueryInput = Record<string, unknown>;

export const parsePagination = (query: QueryInput = {}, { defaultLimit = DEFAULT_LIMIT, maxLimit = MAX_LIMIT }: { defaultLimit?: number; maxLimit?: number } = {}): Pagination => {
  const requested = Number.parseInt(String(query.limit ?? ""), 10);
  const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), maxLimit) : defaultLimit;
  let cursor: PageCursor | null = null;
  const rawCursor = typeof query.cursor === "string" && query.cursor.length <= 512 ? query.cursor : null;
  if (rawCursor) {
    try {
      const parsed: unknown = JSON.parse(Buffer.from(rawCursor, "base64url").toString("utf8"));
      if (parsed && typeof parsed === "object") {
        const value = parsed as { date?: unknown; id?: unknown };
        const date = new Date(String(value.date ?? ""));
        if (!Number.isNaN(date.getTime()) && typeof value.id === "string" && UUID_PATTERN.test(value.id)) cursor = { date, id: value.id };
      }
    } catch { cursor = null; }
  }
  return { cursor, limit, rawCursor };
};

// Retained as an API-compatible description for unit callers. PostgreSQL services
// apply this pair as `(created_at, id) < (cursor.date, cursor.id)`.
export const cursorFilter = (cursor: PageCursor | null, field = "createdAt"): Record<string, unknown> => cursor ? {
  $or: [{ [field]: { $lt: cursor.date } }, { [field]: cursor.date, _id: { $lt: cursor.id } }],
} : {};

interface CursorDocument { _id?: unknown; id?: unknown }
export const createCursor = (document: CursorDocument, field = "createdAt"): string | null => {
  const record = document as Record<string, unknown>;
  const id = document._id ?? document.id;
  const value = record[field];
  if (typeof id !== "string" || !UUID_PATTERN.test(id) || value === undefined || value === null) return null;
  const date = new Date(value as string | number | Date);
  if (Number.isNaN(date.getTime())) return null;
  return Buffer.from(JSON.stringify({ date: date.toISOString(), id })).toString("base64url");
};

export const pageFromDocuments = <T extends CursorDocument>(documents: T[], limit: number, field = "createdAt"): { items: T[]; nextCursor: string | null } => {
  const hasMore = documents.length > limit;
  const items = hasMore ? documents.slice(0, limit) : documents;
  const last = items.at(-1);
  return { items, nextCursor: hasMore && last ? createCursor(last, field) : null };
};
