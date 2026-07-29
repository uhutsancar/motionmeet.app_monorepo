import path from "path";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import connectDB, { disconnectDB } from "../configs/db.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function seedDefaultUser() {
  try {
    if (process.env.ALLOW_DEFAULT_USER_SEED !== "true") {
      throw new Error("Set ALLOW_DEFAULT_USER_SEED=true to run this script");
    }
    const email = process.env.SEED_DEFAULT_USER_EMAIL?.trim();
    const password = process.env.SEED_DEFAULT_USER_PASSWORD;
    if (!email || !password || Buffer.byteLength(password, "utf8") < 16) {
      throw new Error(
        "SEED_DEFAULT_USER_EMAIL and a 16+ byte SEED_DEFAULT_USER_PASSWORD are required"
      );
    }
    await connectDB();
    console.log("Connected to MongoDB");

    let user = await User.findOne({ email });
    if (!user) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      const { v4: uuidv4 } = await import("uuid");
      user = new User({
        _id: uuidv4(),
        full_name: "Admin User",
        username: "admin",
        email,
        password: hashedPassword,
        role: "superadmin",
        isEmailVerified: true
      });
      await user.save();
      console.log(`Default user created: ${email}`);
    } else {
      console.log(`Default user already exists: ${email}`);
    }

    await disconnectDB();
  } catch (error) {
    console.error("Error creating default user:", error);
    await disconnectDB().catch(() => {});
    process.exitCode = 1;
  }
}

seedDefaultUser();
