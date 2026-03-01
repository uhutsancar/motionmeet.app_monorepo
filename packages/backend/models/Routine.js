import mongoose from "mongoose";

const routineSchema = new mongoose.Schema(
  {
    userId: { type: String, ref: "User", required: true },
    name: { type: String, required: true },
    folder: { type: String, default: "" }, // E.g. "My Routines"
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

const Routine = mongoose.model("Routine", routineSchema);

export default Routine;
