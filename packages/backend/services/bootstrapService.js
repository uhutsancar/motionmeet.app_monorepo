import Equipment from "../models/Equipment.js";
import MuscleGroup from "../models/MuscleGroup.js";
import { getOrCreateFreePlan } from "../utils/plans.js";

export const MUSCLE_GROUP_DEFAULTS = [
  { code: "chest", name: "Chest", order: 1 },
  { code: "back", name: "Back", order: 2 },
  { code: "legs", name: "Legs", order: 3 },
  { code: "shoulders", name: "Shoulders", order: 4 },
  { code: "arms", name: "Arms", order: 5 },
  { code: "abs", name: "Abs", order: 6 },
  { code: "cardio", name: "Cardio", order: 7 },
  { code: "full_body", name: "Full Body", order: 8 },
];

export const EQUIPMENT_DEFAULTS = [
  { code: "dumbbell", name: "Dumbbell", order: 1 },
  { code: "barbell", name: "Barbell", order: 2 },
  { code: "machine", name: "Machine", order: 3 },
  { code: "cables", name: "Cables", order: 4 },
  { code: "bodyweight", name: "Bodyweight", order: 5 },
  { code: "kettlebell", name: "Kettlebell", order: 6 },
  { code: "other", name: "Other", order: 7 },
];

const insertMissingDefaults = (Model, defaults) =>
  Model.bulkWrite(
    defaults.map((entry) => ({
      updateOne: {
        filter: { code: entry.code },
        update: { $setOnInsert: entry },
        upsert: true,
      },
    }))
  );

export const ensureApplicationData = async () => {
  await Promise.all([
    getOrCreateFreePlan(),
    insertMissingDefaults(MuscleGroup, MUSCLE_GROUP_DEFAULTS),
    insertMissingDefaults(Equipment, EQUIPMENT_DEFAULTS),
  ]);
};
