import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    email: { type: String, required: true },
    full_name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    bio: { type: String, default: "Athlete on MotionMeet" },
    profile_picture: { type: String, default: "" },
    cover_photo: { type: String, default: "" },
    location: { type: String, default: "" },
    weight: { type: Number, default: 0 }, // Added for user measurements
    height: { type: Number, default: 0 }, // Added for user measurements
    followers: [{ type: String, ref: "User" }],
    following: [{ type: String, ref: "User" }],
    following: [{ type: String, ref: "User" }],
    connections: [{ type: String, ref: "User" }],
    statistics: {
      totalWorkouts: { type: Number, default: 0 },
      totalDurationMinutes: { type: Number, default: 0 },
      totalVolumeKg: { type: Number, default: 0 }
    }
  },
  { timestamps: true, minimize: false }
);

const User = mongoose.model("User", userSchema);

export default User
