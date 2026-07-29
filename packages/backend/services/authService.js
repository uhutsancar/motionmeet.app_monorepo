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

export const createUser = async (email, hashedPassword, full_name, username) => {
  const freePlan = await getOrCreateFreePlan();
  const userId = uuidv4();

  return await User.create({
    _id: userId,
    email,
    password: hashedPassword,
    full_name,
    username,
    plan: freePlan._id,
    planStatus: "free",
    role: "user",
  });
};

const hashResetToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

export const createPasswordResetToken = async (userId) => {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await PasswordResetToken.deleteMany(
        { userId, consumedAt: null },
        { session }
      );
      await PasswordResetToken.create(
        [
          {
            userId,
            tokenHash: hashResetToken(rawToken),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          },
        ],
        { session }
      );
    });
  } finally {
    await session.endSession();
  }
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
