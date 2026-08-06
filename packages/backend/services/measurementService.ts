import { sql } from "kysely";
import type { BodyMeasurement } from "@motionmeet/shared";
import { database } from "../configs/database.js";

/**
 * `numeric` columns arrive from pg as strings and `date` columns arrive as
 * Date objects shifted into the process timezone. Both are normalised here:
 * measured_on is always read back with to_char so a day logged as 2026-08-06
 * never drifts to the 5th for an athlete west of UTC.
 */

export type MeasurementColumn =
  | "weight_kg"
  | "body_fat_percentage"
  | "waist_cm"
  | "chest_cm"
  | "hips_cm"
  | "neck_cm"
  | "shoulders_cm"
  | "left_arm_cm"
  | "right_arm_cm"
  | "left_thigh_cm"
  | "right_thigh_cm";

export const MEASUREMENT_COLUMNS: readonly MeasurementColumn[] = Object.freeze([
  "weight_kg",
  "body_fat_percentage",
  "waist_cm",
  "chest_cm",
  "hips_cm",
  "neck_cm",
  "shoulders_cm",
  "left_arm_cm",
  "right_arm_cm",
  "left_thigh_cm",
  "right_thigh_cm",
]);

export type MeasurementValues = Partial<Record<MeasurementColumn, number | null>>;

export interface SaveMeasurementInput extends MeasurementValues {
  measuredOn: string;
  note?: string;
}

interface MeasurementRow extends MeasurementValues {
  id: string;
  measured_on: string;
  note: string;
  created_at: Date;
  updated_at: Date;
}

const nullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const iso = (value: Date | string): string => (value instanceof Date ? value : new Date(value)).toISOString();

/**
 * pg hands back `date` columns as Date objects in the process timezone, so a
 * day is reduced to its local calendar parts rather than through toISOString,
 * which would shift it for anyone west of UTC.
 */
const toDayKey = (value: Date | string): string => {
  if (typeof value === "string") return value.slice(0, 10);
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
};

const serialize = (row: MeasurementRow): BodyMeasurement => ({
  id: row.id,
  measuredOn: row.measured_on,
  note: row.note ?? "",
  weightKg: nullableNumber(row.weight_kg),
  bodyFatPercentage: nullableNumber(row.body_fat_percentage),
  waistCm: nullableNumber(row.waist_cm),
  chestCm: nullableNumber(row.chest_cm),
  hipsCm: nullableNumber(row.hips_cm),
  neckCm: nullableNumber(row.neck_cm),
  shouldersCm: nullableNumber(row.shoulders_cm),
  leftArmCm: nullableNumber(row.left_arm_cm),
  rightArmCm: nullableNumber(row.right_arm_cm),
  leftThighCm: nullableNumber(row.left_thigh_cm),
  rightThighCm: nullableNumber(row.right_thigh_cm),
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

const baseSelect = () =>
  database
    .selectFrom("body_measurements")
    .select([
      "id",
      "note",
      "created_at",
      "updated_at",
      ...MEASUREMENT_COLUMNS,
      sql<string>`to_char(measured_on, 'YYYY-MM-DD')`.as("measured_on"),
    ]);

export const listMeasurements = async (userId: string, limit = 180): Promise<BodyMeasurement[]> => {
  const rows = await baseSelect()
    .where("user_id", "=", userId)
    .orderBy("measured_on", "desc")
    .limit(Math.min(Math.max(limit, 1), 500))
    .execute();
  return (rows as unknown as MeasurementRow[]).map(serialize);
};

/**
 * One entry per athlete per day: saving the same date again updates that row so
 * a correction does not stack up duplicate points on the progress chart.
 */
export const saveMeasurement = async (userId: string, input: SaveMeasurementInput): Promise<BodyMeasurement> => {
  const values: MeasurementValues = {};
  for (const column of MEASUREMENT_COLUMNS) values[column] = nullableNumber(input[column]);

  const saved = await database.transaction().execute(async (trx) => {
    const inserted = await trx
      .insertInto("body_measurements")
      .values({ user_id: userId, measured_on: input.measuredOn, note: input.note ?? "", ...values })
      .onConflict((conflict) =>
        conflict
          .columns(["user_id", "measured_on"])
          .doUpdateSet({ ...values, note: input.note ?? "", updated_at: new Date() }),
      )
      .returning("id")
      .executeTakeFirstOrThrow();

    // The profile shows a single current weight, so logging today's weigh-in
    // keeps it current. Backdated entries are left alone: an older reading must
    // not overwrite a newer one.
    const weight = values.weight_kg;
    if (weight !== null && weight !== undefined) {
      const newest = await trx
        .selectFrom("body_measurements")
        .select("measured_on")
        .where("user_id", "=", userId)
        .where("weight_kg", "is not", null)
        .orderBy("measured_on", "desc")
        .limit(1)
        .executeTakeFirst();
      const newestDay = newest?.measured_on;
      const isNewest = !newestDay || toDayKey(newestDay) <= input.measuredOn;
      if (isNewest) await trx.updateTable("users").set({ weight }).where("id", "=", userId).execute();
    }

    return inserted;
  });

  const row = await baseSelect().where("id", "=", saved.id).executeTakeFirstOrThrow();
  return serialize(row as unknown as MeasurementRow);
};

export const deleteMeasurement = async (userId: string, measurementId: string): Promise<boolean> => {
  const result = await database
    .deleteFrom("body_measurements")
    .where("id", "=", measurementId)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  return Number(result.numDeletedRows ?? 0) > 0;
};
