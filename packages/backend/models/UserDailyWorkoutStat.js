import mongoose from "mongoose";

const userDailyWorkoutStatSchema = new mongoose.Schema(
  {
    userId: { type: String, ref: "User", required: true },
    dateKey: { type: String, required: true, maxlength: 10 },
    date: { type: Date, required: true },
    totalWorkouts: { type: Number, default: 0, min: 0 },
    totalDurationMinutes: { type: Number, default: 0, min: 0 },
    totalVolumeKg: { type: Number, default: 0, min: 0 },
    totalSets: { type: Number, default: 0, min: 0 },
    totalReps: { type: Number, default: 0, min: 0 },
    muscleSets: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);

userDailyWorkoutStatSchema.index(
  { userId: 1, dateKey: 1 },
  { unique: true }
);
userDailyWorkoutStatSchema.index({ userId: 1, date: -1, _id: -1 });

const UserDailyWorkoutStat = mongoose.model(
  "UserDailyWorkoutStat",
  userDailyWorkoutStatSchema
);

export default UserDailyWorkoutStat;
