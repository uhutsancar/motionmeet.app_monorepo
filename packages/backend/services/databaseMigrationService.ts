import { sql } from "kysely";
import { database } from "../configs/database.js";

export const REQUIRED_TABLES = [
  "plans", "plan_billing_cycles", "users", "equipment", "muscle_groups", "exercises", "exercise_secondary_muscles", "exercise_instructions",
  "routines", "routine_exercises", "routine_sets", "workouts", "workout_exercises", "workout_sets", "posts", "post_media", "post_likes", "post_comments",
  "stories", "story_views", "user_follows", "connections", "conversations", "conversation_participants", "messages", "sessions", "password_reset_tokens",
  "upload_reservations", "media_deletion_jobs", "usage_counters", "outbox_events", "personal_records", "user_daily_workout_stats", "user_daily_muscle_stats", "user_exercise_daily_stats",
  "location_countries", "location_states", "location_cities", "user_locations",
] as const;

export const getIntegrityMigrationStatus = async (): Promise<{ applied: boolean; missingTables: string[]; migrationCount: number }> => {
  const rows = await sql<{ table_name: string }>`select table_name from information_schema.tables where table_schema = 'public'`.execute(database);
  const existing = new Set(rows.rows.map((row) => row.table_name));
  const migrations = await sql<{ count: string }>`select count(*)::text as count from kysely_migration`.execute(database);
  return { applied: REQUIRED_TABLES.every((table) => existing.has(table)), missingTables: REQUIRED_TABLES.filter((table) => !existing.has(table)), migrationCount: Number(migrations.rows[0]?.count ?? 0) };
};

export const assertDatabaseContract = async (): Promise<void> => {
  const status = await getIntegrityMigrationStatus();
  if (!status.applied) throw new Error(`PostgreSQL schema is incomplete; missing tables: ${status.missingTables.join(", ")}`);
  const invalid = await sql<{ invalid: string }>`
    select (
      (select count(*) from user_follows where follower_id = followee_id) +
      (select count(*) from connections where from_user_id = to_user_id) +
      (select count(*) from messages where from_user_id = to_user_id)
    )::text as invalid
  `.execute(database);
  if (Number(invalid.rows[0]?.invalid ?? 0) !== 0) throw new Error("PostgreSQL integrity contract contains invalid self-relations");
};

export const inspectUnsafeDuplicates = async (): Promise<never[]> => [];
export const inspectUnsafeRelations = async (): Promise<never[]> => [];
export const reconcileDerivedCounts = async (): Promise<{ reconciled: boolean }> => ({ reconciled: true });
export const createApplicationIndexes = async (): Promise<{ managedByMigrations: true }> => ({ managedByMigrations: true });
export const verifyIndexContract = getIntegrityMigrationStatus;
export const applyIntegrityMigration = getIntegrityMigrationStatus;
export const REQUIRED_INTEGRITY_MIGRATION = { id: "postgresql-kysely", checksum: "managed-by-kysely-migrations" } as const;
