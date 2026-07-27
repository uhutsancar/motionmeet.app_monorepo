import User from "../models/User.js";
import { getOrCreateFreePlan } from "../utils/plans.js";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import PasswordResetToken from "../models/PasswordResetToken.js";
import Session from "../models/Session.js";
import mongoose from "mongoose";

export const getUserByEmailOrUsername = async (email, username) => {
  return await User.findOne({
    $or: [
      { email: String(email).trim().toLowerCase() },
      { username: String(username).trim().toLowerCase() },
    ],
  });
};

export const getUserByEmailWithPassword = async (email) => {
  return await User.findOne({ email: String(email).trim().toLowerCase() }).select("+password");
};

// SuperAdmin email adresi (env den okunur, yoksa sabit)
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || "sancaruhut@gmail.com";

export const createUser = async (email, hashedPassword, full_name, username) => {
  const freePlan = await getOrCreateFreePlan();
  const userId = uuidv4();

  // Eğer kaydolan kullanıcı superadmin email'iyle eşleşiyorsa otomatik rol ata
  const role = email === SUPER_ADMIN_EMAIL ? "superadmin" : "user";
  if (role === "superadmin") {
    console.log(`[Auth] SuperAdmin account created: ${email}`);
  }

  return await User.create({
    _id: userId,
    email,
    password: hashedPassword,
    full_name,
    username,
    plan: freePlan._id,
    planStatus: "free",
    role,
  });
};

const hashResetToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

export const createPasswordResetToken = async (userId) => {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  await PasswordResetToken.deleteMany({ userId, consumedAt: null });
  await PasswordResetToken.create({
    userId,
    tokenHash: hashResetToken(rawToken),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });
  return rawToken;
};

export const resetPasswordWithToken = async (rawToken, hashedPassword) => {
  if (typeof rawToken !== "string" || rawToken.length < 32 || rawToken.length > 256) {
    return false;
  }

  const session = await mongoose.startSession();
  let updated = false;
  try {
    await session.withTransaction(async () => {
      const resetToken = await PasswordResetToken.findOneAndUpdate(
        {
          tokenHash: hashResetToken(rawToken),
          consumedAt: null,
          expiresAt: { $gt: new Date() },
        },
        { $set: { consumedAt: new Date() } },
        { new: true, session }
      );
      if (!resetToken) return;

      const userResult = await User.updateOne(
        { _id: resetToken.userId },
        { $set: { password: hashedPassword } },
        { session }
      );
      if (userResult.matchedCount !== 1) {
        throw new Error("Password reset user no longer exists");
      }
      await Session.updateMany(
        { userId: resetToken.userId, revokedAt: null },
        { $set: { revokedAt: new Date() } },
        { session }
      );
      updated = true;
    });
    return updated;
  } finally {
    await session.endSession();
  }
};
