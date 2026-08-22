import { sql, type Kysely } from "kysely";
import type { Database } from "../types.js";

/**
 * Stories gain positioned captions and stickers.
 *
 * Overlays are stored as jsonb rather than as rows because they are only ever
 * read and written as one whole list belonging to a single story, and stories
 * expire after a day — a child table would buy joins and cascade deletes that
 * nothing here needs. The column is `NOT NULL DEFAULT '[]'` so every story
 * written before this migration reads back as "no overlays" without a backfill.
 */
export const up = async (db: Kysely<Database>): Promise<void> => {
  await sql.raw(`
    ALTER TABLE stories
      ADD COLUMN IF NOT EXISTS overlays jsonb NOT NULL DEFAULT '[]'::jsonb;
  `).execute(db);
};

export const down = async (db: Kysely<Database>): Promise<void> => {
  await sql.raw(`ALTER TABLE stories DROP COLUMN IF EXISTS overlays;`).execute(db);
};
