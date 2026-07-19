import mongoose from "mongoose";

const workoutSchema = new mongoose.Schema(
  {
    userId: { type: String, ref: "User", required: true },
    name: { type: String, required: true }, // Inherited from routine or custom
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    durationMinutes: { type: Number, default: 0 },
    volumeKg: { type: Number, default: 0 },
    exercises: [
      {
        exerciseId: { type: mongoose.Schema.Types.ObjectId, ref: "Exercise", required: true },
        sets: [
          {
            setType: { type: String, enum: ["normal", "warmup", "drop", "failure"], default: "normal" },
            reps: { type: Number, default: 0 },
            weight: { type: Number, default: 0 },
            completed: { type: Boolean, default: false }
          }
        ]
      }
    ]
  },
  { timestamps: true }
);

workoutSchema.index({ userId: 1, startTime: -1 });

const Workout = mongoose.model("Workout", workoutSchema);

export default Workout;
