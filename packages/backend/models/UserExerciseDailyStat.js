import mongoose from "mongoose";

const userExerciseDailyStatSchema = new mongoose.Schema(
  {
    userId: { type: String, ref: "User", required: true },
    dateKey: { type: String, required: true, maxlength: 10 },
    date: { type: Date, required: true },
    exerciseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exercise",
      required: true,
    },
    exerciseName: { type: String, required: true, maxlength: 200 },
    muscleGroup: { type: String, default: "", maxlength: 120 },
    totalVolumeKg: { type: Number, default: 0, min: 0 },
    totalReps: { type: Number, default: 0, min: 0 },
    totalSets: { type: Number, default: 0, min: 0 },
    totalSessions: { type: Number, default: 0, min: 0 },
    maxWeight: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

userExerciseDailyStatSchema.index(
  { userId: 1, dateKey: 1, exerciseId: 1 },
  { unique: true }
);
userExerciseDailyStatSchema.index({
  userId: 1,
  exerciseId: 1,
  date: -1,
  _id: -1,
});

const UserExerciseDailyStat = mongoose.model(
  "UserExerciseDailyStat",
  userExerciseDailyStatSchema
);

export default UserExerciseDailyStat;
