import { database } from "../configs/database.js";
import { ensureDefaultPlans } from "../utils/plans.js";

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

const insertLookups = async (table: "equipment" | "muscle_groups", entries: readonly { code: string; name: string; order: number }[]): Promise<void> => {
  for (const entry of entries) {
    await database.insertInto(table).values({ legacy_mongo_id: null, code: entry.code, name: entry.name, display_order: entry.order, is_active: true })
      .onConflict((conflict) => conflict.column("code").doNothing()).execute();
  }
};

export const ensureApplicationData = async (): Promise<void> => {
  await Promise.all([ensureDefaultPlans(), insertLookups("muscle_groups", MUSCLE_GROUP_DEFAULTS), insertLookups("equipment", EQUIPMENT_DEFAULTS)]);
};
