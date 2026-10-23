import { sql } from "kysely";
import { database } from "../configs/database.js";

/** Every table the application code reads or writes; boot refuses to serve without all of them. */
const REQUIRED_TABLES = [
  "users", "equipment", "muscle_groups", "exercises", "exercise_secondary_muscles", "exercise_instructions",
  "routines", "routine_exercises", "routine_sets", "workouts", "workout_exercises", "workout_sets", "posts", "post_media", "post_likes", "post_comments",
  "stories", "story_views", "user_follows", "follow_requests", "notifications", "connections", "conversations", "conversation_participants", "messages", "sessions", "password_reset_tokens",
  "upload_reservations", "media_deletion_jobs", "usage_counters", "outbox_events", "personal_records", "user_daily_workout_stats", "user_daily_muscle_stats", "user_exercise_daily_stats",
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
  const invalid = await sql<{ invalid: string }>`
    select (
      (select count(*) from user_follows where follower_id = followee_id) +
      (select count(*) from connections where from_user_id = to_user_id) +
      (select count(*) from messages where from_user_id = to_user_id)
    )::text as invalid
  `.execute(database);
  if (Number(invalid.rows[0]?.invalid ?? 0) !== 0) throw new Error("PostgreSQL integrity contract contains invalid self-relations");
};
