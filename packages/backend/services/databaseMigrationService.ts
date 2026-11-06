import { sql } from "kysely";
import { database } from "../configs/database.js";

/** Every table the application code reads or writes; boot refuses to serve without all of them. */
const REQUIRED_TABLES = [
  "users", "equipment", "muscle_groups", "exercises", "exercise_secondary_muscles", "exercise_instructions",
  "routines", "routine_exercises", "routine_sets", "workouts", "workout_exercises", "workout_sets", "posts", "post_media", "post_likes", "post_comments",
  "stories", "story_views", "user_follows", "follow_requests", "notifications", "connections", "conversations", "conversation_participants", "messages", "sessions", "password_reset_tokens",
  "upload_reservations", "media_deletion_jobs", "usage_counters", "outbox_events", "processed_events", "personal_records", "user_daily_workout_stats", "user_daily_muscle_stats", "user_exercise_daily_stats",
  "location_countries", "location_states", "location_cities", "user_locations",
] as const;

const missingTables = async (): Promise<string[]> => {
  const rows = await sql<{ table_name: string }>`select table_name from information_schema.tables where table_schema = 'public'`.execute(database);
  const existing = new Set(rows.rows.map((row) => row.table_name));
  return REQUIRED_TABLES.filter((table) => !existing.has(table));
};

export const assertDatabaseContract = async (): Promise<void> => {
  const missing = await missingTables();
  if (missing.length) throw new Error(`PostgreSQL schema is incomplete; missing tables: ${missing.join(", ")}`);
  const unguarded = await missingSelfRelationGuards();
  if (unguarded.length) throw new Error(`PostgreSQL integrity contract is missing validated self-relation checks on: ${unguarded.join(", ")}`);
};

/** Tables that must refuse a row relating a member to themselves, and the two columns compared. */
const SELF_RELATION_GUARDS = [
  ["user_follows", "follower_id", "followee_id"],
  ["connections", "from_user_id", "to_user_id"],
  ["messages", "from_user_id", "to_user_id"],
] as const;

/**
 * The self-relation guards, checked in the catalogue rather than the data.
 *
 * Boot used to count the offending rows in each table. A validated CHECK
 * constraint already proves there are none, and the count was a full scan of
 * three of the largest tables on every start: at 780 000 follows it ran into
 * the 15-second statement timeout, so the API could no longer start at all.
 * Asking whether the validated constraints exist answers the same question
 * in constant time, whatever the size of the data.
 */
const missingSelfRelationGuards = async (): Promise<string[]> => {
  const { rows } = await sql<{ table_name: string; definition: string }>`
    select conrelid::regclass::text as table_name, pg_get_constraintdef(oid) as definition
    from pg_constraint
    where contype = 'c' and convalidated and connamespace = 'public'::regnamespace
  `.execute(database);
  return SELF_RELATION_GUARDS
    .filter(([table, left, right]) => !rows.some((row) => row.table_name === table && row.definition.includes(`${left} <> ${right}`)))
    .map(([table]) => table);
};
