import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const MONGO_URI = process.env.MONGODB_URL || process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("❌ MONGODB_URL is not set in packages/backend/.env");
  process.exit(1);
}

const MUSCLE_GROUPS = [
  { code: "chest", name: "Chest", order: 1 },
  { code: "back", name: "Back", order: 2 },
  { code: "legs", name: "Legs", order: 3 },
  { code: "shoulders", name: "Shoulders", order: 4 },
  { code: "arms", name: "Arms", order: 5 },
  { code: "abs", name: "Abs", order: 6 },
  { code: "cardio", name: "Cardio", order: 7 },
  { code: "full_body", name: "Full Body", order: 8 },
];

const EQUIPMENT = [
  { code: "dumbbell", name: "Dumbbell", order: 1 },
  { code: "barbell", name: "Barbell", order: 2 },
  { code: "machine", name: "Machine", order: 3 },
  { code: "cables", name: "Cables", order: 4 },
  { code: "bodyweight", name: "Bodyweight", order: 5 },
  { code: "kettlebell", name: "Kettlebell", order: 6 },
  { code: "other", name: "Other", order: 7 },
];

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB");

  const MuscleGroup = (await import("../models/MuscleGroup.js")).default;
  const Equipment = (await import("../models/Equipment.js")).default;

  console.log("📦 Seeding Muscle Groups...");
  for (const mg of MUSCLE_GROUPS) {
    await MuscleGroup.updateOne({ code: mg.code }, { $set: mg }, { upsert: true });
  }

  console.log("📦 Seeding Equipment...");
  for (const eq of EQUIPMENT) {
    await Equipment.updateOne({ code: eq.code }, { $set: eq }, { upsert: true });
  }

  console.log("✅ Master data seeding completed.");
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
