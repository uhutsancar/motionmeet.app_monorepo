import { sql, type Kysely } from "kysely";
import type { Database } from "../types.js";

// Routine/workout rows carry immutable exercise name, muscle and equipment
// snapshots. A custom exercise may therefore be deleted without destroying
// workout history or blocking account deletion.
export const up = async (db: Kysely<Database>): Promise<void> => {
  await sql.raw(`
    ALTER TABLE routine_exercises DROP CONSTRAINT IF EXISTS routine_exercises_exercise_id_fkey;
    ALTER TABLE routine_exercises ALTER COLUMN exercise_id DROP NOT NULL;
    ALTER TABLE routine_exercises ADD CONSTRAINT routine_exercises_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE SET NULL;
    ALTER TABLE workout_exercises DROP CONSTRAINT IF EXISTS workout_exercises_exercise_id_fkey;
    ALTER TABLE workout_exercises ALTER COLUMN exercise_id DROP NOT NULL;
    ALTER TABLE workout_exercises ADD CONSTRAINT workout_exercises_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE SET NULL;
  `).execute(db);
};

export const down = async (db: Kysely<Database>): Promise<void> => {
  await sql.raw(`
    DELETE FROM routine_exercises WHERE exercise_id IS NULL;
    DELETE FROM workout_exercises WHERE exercise_id IS NULL;
    ALTER TABLE routine_exercises DROP CONSTRAINT IF EXISTS routine_exercises_exercise_id_fkey;
    ALTER TABLE routine_exercises ALTER COLUMN exercise_id SET NOT NULL;
    ALTER TABLE routine_exercises ADD CONSTRAINT routine_exercises_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE RESTRICT;
    ALTER TABLE workout_exercises DROP CONSTRAINT IF EXISTS workout_exercises_exercise_id_fkey;
    ALTER TABLE workout_exercises ALTER COLUMN exercise_id SET NOT NULL;
    ALTER TABLE workout_exercises ADD CONSTRAINT workout_exercises_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE RESTRICT;
  `).execute(db);
};
