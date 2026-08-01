import "dotenv/config";
import { connectDatabase, database, disconnectDatabase } from "../configs/database.js";
const username = process.argv[2]?.trim().toLowerCase(); const confirmed = process.argv.includes("--confirm");
try {
  if (!username || !confirmed) throw new Error("Usage: pnpm admin:promote <username> --confirm");
  await connectDatabase();
  const user = await database.selectFrom("users").select(["id", "username", "role"]).where("username", "=", username).executeTakeFirst(); if (!user) throw new Error(`User not found: ${username}`);
  if (user.role === "superadmin") console.log(`${user.username} is already a superadmin.`);
  else { await database.updateTable("users").set({ role: "superadmin" }).where("id", "=", user.id).execute(); console.log(`Role updated for ${user.username}: ${user.role} -> superadmin`); }
} catch (error: unknown) { console.error("Role elevation failed:", error instanceof Error ? error.message : error); process.exitCode = 1; }
finally { await disconnectDatabase().catch(() => undefined); }
