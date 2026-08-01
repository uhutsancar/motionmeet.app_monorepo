import { sql, type Kysely } from "kysely";
import type { Database } from "../types.js";

export const up = async (db: Kysely<Database>): Promise<void> => {
  await sql.raw(`
    ALTER TABLE routines DROP CONSTRAINT IF EXISTS routines_user_id_operation_id_key;
    ALTER TABLE workouts DROP CONSTRAINT IF EXISTS workouts_user_id_operation_id_key;
    ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_user_id_operation_id_key;
    ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_user_id_operation_id_key;
    ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_from_user_id_operation_id_key;
    CREATE UNIQUE INDEX routines_user_operation_idx ON routines (user_id, operation_id) WHERE operation_id IS NOT NULL;
    CREATE UNIQUE INDEX workouts_user_operation_idx ON workouts (user_id, operation_id) WHERE operation_id IS NOT NULL;
    CREATE UNIQUE INDEX posts_user_operation_idx ON posts (user_id, operation_id) WHERE operation_id IS NOT NULL;
    CREATE UNIQUE INDEX stories_user_operation_idx ON stories (user_id, operation_id) WHERE operation_id IS NOT NULL;
    CREATE UNIQUE INDEX messages_sender_operation_idx ON messages (from_user_id, operation_id) WHERE operation_id IS NOT NULL;
  `).execute(db);
};

export const down = async (db: Kysely<Database>): Promise<void> => {
  await sql.raw(`
    DROP INDEX IF EXISTS routines_user_operation_idx, workouts_user_operation_idx, posts_user_operation_idx, stories_user_operation_idx, messages_sender_operation_idx;
    ALTER TABLE routines ADD CONSTRAINT routines_user_id_operation_id_key UNIQUE NULLS NOT DISTINCT (user_id, operation_id);
    ALTER TABLE workouts ADD CONSTRAINT workouts_user_id_operation_id_key UNIQUE NULLS NOT DISTINCT (user_id, operation_id);
    ALTER TABLE posts ADD CONSTRAINT posts_user_id_operation_id_key UNIQUE NULLS NOT DISTINCT (user_id, operation_id);
    ALTER TABLE stories ADD CONSTRAINT stories_user_id_operation_id_key UNIQUE NULLS NOT DISTINCT (user_id, operation_id);
    ALTER TABLE messages ADD CONSTRAINT messages_from_user_id_operation_id_key UNIQUE NULLS NOT DISTINCT (from_user_id, operation_id);
  `).execute(db);
};
