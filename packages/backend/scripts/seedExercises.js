/**
 * Exercise Dataset Seeder
 * Usage: node packages/backend/scripts/seedExercises.js
 *
 * Reads exercises-dataset-main/data/exercises.json and upserts to MongoDB.
 * Safe to re-run multiple times (uses upsert on externalId).
 */
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import mongoose from "mongoose";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const MONGO_URI = process.env.MONGODB_URL || process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("❌  MONGODB_URL is not set in packages/backend/.env");
  process.exit(1);
}

// ── Load dataset ─────────────────────────────────────────────────────────────
const datasetPath = path.resolve(__dirname, "../../../exercises-dataset-main/data/exercises.json");
let raw;
try {
  raw = JSON.parse(readFileSync(datasetPath, "utf-8"));
} catch (err) {
  console.error("❌  Failed to read exercises.json:", err.message);
  process.exit(1);
}

// ── Map dataset fields → Exercise schema ─────────────────────────────────────
const muscleMap = {
  "chest": "chest",
  "back": "back", "lats": "back", "lower back": "back", "middle back": "back", "traps": "back", "neck": "back",
  "legs": "legs", "upper legs": "legs", "lower legs": "legs", "quadriceps": "legs", "hamstrings": "legs", "calves": "legs", "glutes": "legs", "adductors": "legs", "abductors": "legs",
  "shoulders": "shoulders",
  "arms": "arms", "upper arms": "arms", "lower arms": "arms", "biceps": "arms", "triceps": "arms", "forearms": "arms",
  "abs": "abs", "waist": "abs", "abdominals": "abs", "core": "abs",
  "cardio": "cardio",
  "full body": "full_body",
};

const equipmentMap = {
  "dumbbell": "dumbbell",
  "barbell": "barbell",
  "machine": "machine", "leverage machine": "machine", "smith machine": "machine", "assisted": "machine",
  "cables": "cables", "cable": "cables", "band": "cables",
  "body weight": "bodyweight", "bodyweight": "bodyweight",
  "kettlebell": "kettlebell",
  "other": "other", "medicine ball": "other", "stability ball": "other", "bosu ball": "other", "roller": "other",
};

const mapExercise = (ex) => {
  const rawMuscle = (ex.body_part || ex.category || "Other").toLowerCase();
  const rawEq = (ex.equipment || "Body Weight").toLowerCase();
  
  return {
    externalId: ex.id,
    name: ex.name,
    muscleGroup: muscleMap[rawMuscle] || "other",
    equipment: equipmentMap[rawEq] || "other",
    gifUrl: ex.gif_url || ex.gifUrl || "",
    instructions: ex.instructions || {},
    instructionSteps: ex.instruction_steps || {},
    isCustom: false,
  };
};

// ── Connect & seed ────────────────────────────────────────────────────────────
const BATCH = 200;

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log("✅  Connected to MongoDB");

  const Exercise = (await import("../models/Exercise.js")).default;
  const total = raw.length;
  let upserted = 0;
  let skipped = 0;

  console.log(`📦  Seeding ${total} exercises in batches of ${BATCH}…`);

  for (let i = 0; i < total; i += BATCH) {
    const batch = raw.slice(i, i + BATCH).map(mapExercise);
    const ops = batch.map((doc) => ({
      updateOne: {
        filter: { externalId: doc.externalId },
        update: { $set: doc },
        upsert: true,
      },
    }));

    const result = await Exercise.bulkWrite(ops, { ordered: false });
    upserted += result.upsertedCount + result.modifiedCount;
    skipped += result.matchedCount;

    const pct = Math.round(((i + batch.length) / total) * 100);
    process.stdout.write(`\r   ${pct}% (${i + batch.length}/${total})`);
  }

  console.log(`\n\n✅  Done. Upserted/Updated: ${upserted}, Unchanged: ${skipped - upserted}`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("❌  Seed failed:", err);
  process.exit(1);
});
