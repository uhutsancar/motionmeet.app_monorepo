import { sql } from "kysely";
import { database } from "../configs/database.js";

export const MUSCLE_GROUP_DEFAULTS = [
  { code: "chest", name: "Chest", order: 1 }, { code: "back", name: "Back", order: 2 },
  { code: "legs", name: "Legs", order: 3 }, { code: "shoulders", name: "Shoulders", order: 4 },
  { code: "arms", name: "Arms", order: 5 }, { code: "abs", name: "Abs", order: 6 },
  { code: "cardio", name: "Cardio", order: 7 }, { code: "full_body", name: "Full Body", order: 8 },
] as const;

export const EQUIPMENT_DEFAULTS = [
  { code: "dumbbell", name: "Dumbbell", order: 1 }, { code: "barbell", name: "Barbell", order: 2 },
  { code: "machine", name: "Machine", order: 3 }, { code: "cables", name: "Cables", order: 4 },
  { code: "bodyweight", name: "Bodyweight", order: 5 }, { code: "kettlebell", name: "Kettlebell", order: 6 },
  { code: "other", name: "Other", order: 7 },
] as const;

/**
 * Single-statement batch INSERT … ON CONFLICT DO NOTHING.
 * Replaces the previous sequential per-row loop (N round-trips → 1 round-trip).
 */
const insertLookups = async (table: "equipment" | "muscle_groups", entries: readonly { code: string; name: string; order: number }[]): Promise<void> => {
  if (!entries.length) return;
  await database
    .insertInto(table)
    .values(entries.map((entry) => ({ legacy_mongo_id: null, code: entry.code, name: entry.name, display_order: entry.order, is_active: true })))
    .onConflict((conflict) => conflict.column("code").doNothing())
    .execute();
};

/**
 * Fast-path: if all lookup tables already have the expected number of rows,
 * skip the upsert entirely to avoid unnecessary round-trips on every restart.
 */
export const ensureApplicationData = async (): Promise<void> => {
  const [mgRow, eqRow] = await Promise.all([
    sql<{ count: string }>`select count(*)::text as count from muscle_groups`.execute(database),
    sql<{ count: string }>`select count(*)::text as count from equipment`.execute(database),
  ]);

  const mgOk = Number(mgRow.rows[0]?.count ?? 0) >= MUSCLE_GROUP_DEFAULTS.length;
  const eqOk = Number(eqRow.rows[0]?.count ?? 0) >= EQUIPMENT_DEFAULTS.length;

  if (mgOk && eqOk) return; // fast-path: nothing to do

  await Promise.all([
    mgOk ? Promise.resolve() : insertLookups("muscle_groups", MUSCLE_GROUP_DEFAULTS),
    eqOk ? Promise.resolve() : insertLookups("equipment", EQUIPMENT_DEFAULTS),
  ]);
};
