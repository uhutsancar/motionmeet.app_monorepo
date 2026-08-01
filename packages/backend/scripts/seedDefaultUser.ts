import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectDatabase, database, disconnectDatabase } from "../configs/database.js";
import { getOrCreateFreePlan } from "../utils/plans.js";
try {
  if (process.env.ALLOW_DEFAULT_USER_SEED !== "true") throw new Error("Set ALLOW_DEFAULT_USER_SEED=true to run this script");
  const email = process.env.SEED_DEFAULT_USER_EMAIL?.trim().toLowerCase(); const password = process.env.SEED_DEFAULT_USER_PASSWORD;
  if (!email || !password || Buffer.byteLength(password, "utf8") < 16) throw new Error("SEED_DEFAULT_USER_EMAIL and a 16+ byte SEED_DEFAULT_USER_PASSWORD are required");
  await connectDatabase(); const plan = await getOrCreateFreePlan();
  const existing = await database.selectFrom("users").select("id").where("email", "=", email).executeTakeFirst();
  if (!existing) {
    await database.insertInto("users").values({ legacy_mongo_id: null, full_name: "Admin User", username: "admin", email, password_hash: await bcrypt.hash(password, 12), role: "superadmin", plan_id: plan.id, plan_status: "free", plan_start_date: null, plan_end_date: null, plan_cancelled_at: null }).execute();
    console.log("Default superadmin created.");
  } else console.log("Default user already exists.");
} catch (error: unknown) { console.error("Default user seed failed:", error instanceof Error ? error.message : error); process.exitCode = 1; }
finally { await disconnectDatabase().catch(() => undefined); }
