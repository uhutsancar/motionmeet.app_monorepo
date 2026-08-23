import { sql, type Kysely } from "kysely";
import type { Database } from "../types.js";

/**
 * Makes people search use an index.
 *
 * `searchUsers` matches a username prefix and a substring of the display name.
 * The only index that existed for it was `users_search_idx`, a GIN index over
 * `to_tsvector('simple', username || ' ' || full_name)` - and nothing in the
 * application has ever issued a full-text query. `ILIKE` cannot use a tsvector
 * index, so every search was a sequential scan over `users` while that index
 * still had to be maintained on every insert and update. It is dropped here.
 *
 * In its place are two indexes over the exact expressions the query uses, each
 * matched to the shape of its match:
 *
 * - **username, `LIKE 'term%'`** gets a B-tree with `text_pattern_ops`, which
 *   turns a prefix into a range scan. This is the same treatment the location
 *   dataset already gets in migration 006. A trigram index can serve a prefix
 *   too, but measured on 200k rows the planner kept choosing a sequential scan
 *   over it, because `LIMIT 20` makes a scan look cheap when it has no reason
 *   to believe the term is rare; the B-tree range is cheap enough that it wins.
 * - **full_name, `LIKE '%term%'`** gets `pg_trgm`, because a leading wildcard
 *   is exactly the case a B-tree cannot serve at all.
 *
 * Both are lowered, because the search term is lowered before it reaches SQL,
 * and `username` is `citext`, so it is cast to text to reach these operator
 * classes.
 *
 * Both are partial on `privacy_show_in_search`, the condition the query always
 * carries: members who have opted out are never searchable, so indexing them
 * would only cost writes.
 */
export const up = async (db: Kysely<Database>): Promise<void> => {
  await sql.raw(`
    CREATE EXTENSION IF NOT EXISTS pg_trgm;

    DROP INDEX IF EXISTS users_search_idx;
    DROP INDEX IF EXISTS users_username_trgm_idx;

    CREATE INDEX IF NOT EXISTS users_username_prefix_idx
      ON users (lower(username::text) text_pattern_ops)
      WHERE privacy_show_in_search;

    CREATE INDEX IF NOT EXISTS users_full_name_trgm_idx
      ON users USING gin (lower(full_name) gin_trgm_ops)
      WHERE privacy_show_in_search;
  `).execute(db);
};

export const down = async (db: Kysely<Database>): Promise<void> => {
  await sql.raw(`
    DROP INDEX IF EXISTS users_full_name_trgm_idx;
    DROP INDEX IF EXISTS users_username_prefix_idx;

    CREATE INDEX IF NOT EXISTS users_search_idx
      ON users USING gin (to_tsvector('simple', username::text || ' ' || full_name));
  `).execute(db);
};
