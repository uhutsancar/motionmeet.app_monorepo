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

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB");

  const { ensureApplicationData } = await import("../services/bootstrapService.js");
  await ensureApplicationData();

  console.log("✅ Master data seeding completed.");
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
