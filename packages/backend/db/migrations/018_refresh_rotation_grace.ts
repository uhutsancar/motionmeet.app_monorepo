import { sql, type Kysely } from "kysely";
import type { Database } from "../types.js";

/**
 * Refresh-token rotation with a grace window and reuse detection.
 *
 * Each refresh replaced the session's token hash, so the token it was called
 * with died at once. A mobile client whose connection dropped after the
 * server rotated never saw the new token and was signed out; two browser tabs
 * refreshing together signed one of them out.
 *
 * `previous_token_hash` and `rotated_at` let the token just replaced be
 * presented again for a short window and receive the same successor
 * (utils/authTokens.ts), and let a replaced token presented after that window
 * be recognised as reuse - the session is then revoked.
 *
 * Both nullable, no default, no index (lookups go through the primary key):
 * adding them is a catalogue change, instant on a large table.
 */
export const up = async (db: Kysely<Database>): Promise<void> => {
  await sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS previous_token_hash text`.execute(db);
  await sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS rotated_at timestamptz`.execute(db);
};

export const down = async (db: Kysely<Database>): Promise<void> => {
  await sql`ALTER TABLE sessions DROP COLUMN IF EXISTS rotated_at`.execute(db);
  await sql`ALTER TABLE sessions DROP COLUMN IF EXISTS previous_token_hash`.execute(db);
};
