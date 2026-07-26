/**
 * Promote one explicitly named account to superadmin.
 *
 * Usage:
 *   node scripts/setSuperadmin.js <username> --confirm
 *
 * This intentionally does not list accounts, change plans, or choose a default
 * target. Role elevation and billing changes are separate administrative acts.
 */

import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../configs/db.js";
import User from "../models/User.js";

const username = process.argv[2]?.trim().toLowerCase();
const confirmed = process.argv.includes("--confirm");

if (!username || !confirmed) {
  console.error("Usage: node scripts/setSuperadmin.js <username> --confirm");
  process.exit(1);
}

try {
  await connectDB();
  const user = await User.findOne({ username }).select("username role");

  if (!user) {
    throw new Error(`User not found: ${username}`);
  }

  const previousRole = user.role;
  if (previousRole === "superadmin") {
    console.log(`${user.username} is already a superadmin.`);
  } else {
    user.role = "superadmin";
    await user.save();
    console.log(`Role updated for ${user.username}: ${previousRole} -> superadmin`);
  }
} catch (error) {
  console.error(`Role elevation failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
