import mongoose from "mongoose";

const personalRecordSchema = new mongoose.Schema(
  {
    userId: { type: String, ref: "User", required: true },
    exerciseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exercise",
      required: true,
    },
    exerciseName: { type: String, required: true, maxlength: 200 },
    value: { type: Number, required: true, min: 0 },
    reps: { type: Number, required: true, min: 0 },
    recordedAt: { type: Date, required: true },
    workoutId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workout",
      required: true,
    },
  },
  { timestamps: true }
);

personalRecordSchema.index(
  { userId: 1, exerciseId: 1 },
  { unique: true }
);
personalRecordSchema.index({ userId: 1, value: -1, recordedAt: -1, _id: -1 });

const PersonalRecord = mongoose.model("PersonalRecord", personalRecordSchema);

export default PersonalRecord;
