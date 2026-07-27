import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    full_name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: /^[a-z0-9._-]+$/,
    },
    password: { type: String, required: true, select: false },
    bio: { type: String, default: "Athlete on MotionMeet" },
    profile_picture: { type: String, default: "" },
    profile_picture_key: { type: String, default: "", select: false },
    cover_photo: { type: String, default: "" },
    cover_photo_key: { type: String, default: "", select: false },
    location: { type: String, default: "" },
    role: { type: String, enum: ["user", "admin", "superadmin"], default: "user" },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan" },
    weight: { type: Number, default: 0 }, // Added for user measurements
    height: { type: Number, default: 0 }, // Added for user measurements
    followers_count: { type: Number, default: 0 },
    following_count: { type: Number, default: 0 },
    connections_count: { type: Number, default: 0 },
    privacy: {
      publicProfile: { type: Boolean, default: true },
      showWorkoutsOnFeed: { type: Boolean, default: true },
      allowFollowers: { type: Boolean, default: true },
      showInSearch: { type: Boolean, default: true },
      allowMessages: { type: Boolean, default: true },
    },
    statistics: {
      totalWorkouts: { type: Number, default: 0 },
      totalDurationMinutes: { type: Number, default: 0 },
      totalVolumeKg: { type: Number, default: 0 }
    }
  },
  { timestamps: true, minimize: false }
);

userSchema.index(
  { username: "text", full_name: "text" },
  { weights: { username: 3, full_name: 1 }, name: "UserSearchTextIndex" }
);


const User = mongoose.model("User", userSchema);

export default User;
