import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import connectDB from "../configs/db.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function seedDefaultUser() {
  try {
    await connectDB();
    console.log("Connected to MongoDB");

    const email = "admin@motionmeet.app";
    const password = "password123";
    
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
      console.log(`Default user created: ${email} / ${password}`);
    } else {
      console.log(`Default user already exists: ${email}`);
    }

    process.exit(0);
  } catch (error) {
    console.error("Error creating default user:", error);
    process.exit(1);
  }
}

seedDefaultUser();
