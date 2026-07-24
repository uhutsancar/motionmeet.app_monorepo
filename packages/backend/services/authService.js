import User from "../models/User.js";
import { getOrCreateFreePlan } from "../utils/plans.js";
import { v4 as uuidv4 } from "uuid";

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
  });
};
