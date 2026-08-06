import { sql, type Kysely } from "kysely";
import type { Database } from "../types.js";

// Body measurements are logged at most once per calendar day per athlete, so
// re-saving the same day updates that entry instead of creating duplicates.
// Every metric is nullable: an athlete may track only weight, or only a couple
// of circumferences, and the chart reads whichever columns have values.
export const up = async (db: Kysely<Database>): Promise<void> => {
  await sql.raw(`
    CREATE TABLE body_measurements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      measured_on date NOT NULL,
      weight_kg numeric(6,2),
      body_fat_percentage numeric(5,2),
      waist_cm numeric(6,2),
      chest_cm numeric(6,2),
      hips_cm numeric(6,2),
      neck_cm numeric(6,2),
      shoulders_cm numeric(6,2),
      left_arm_cm numeric(6,2),
      right_arm_cm numeric(6,2),
      left_thigh_cm numeric(6,2),
      right_thigh_cm numeric(6,2),
      note text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT body_measurements_user_day_unique UNIQUE (user_id, measured_on)
    );

    -- The history screen always reads one athlete newest-first.
    CREATE INDEX body_measurements_user_date_idx
      ON body_measurements (user_id, measured_on DESC);
  `).execute(db);
};

export const down = async (db: Kysely<Database>): Promise<void> => {
  await sql.raw(`
    DROP INDEX IF EXISTS body_measurements_user_date_idx;
    DROP TABLE IF EXISTS body_measurements;
  `).execute(db);
};
