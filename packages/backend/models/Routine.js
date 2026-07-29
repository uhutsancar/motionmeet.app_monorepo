import mongoose from "mongoose";

const routineSchema = new mongoose.Schema(
  {
    userId: { type: String, ref: "User", required: true },
    operationId: { type: String, maxlength: 128, default: null },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    folder: { type: String, default: "", trim: true, maxlength: 120 }, // E.g. "My Routines"
    exercises: [
      {
        exerciseId: { type: mongoose.Schema.Types.ObjectId, ref: "Exercise", required: true },
        exerciseName: { type: String, trim: true, maxlength: 200, default: "" },
        muscleGroup: { type: String, trim: true, maxlength: 120, default: "" },
        equipment: { type: String, trim: true, maxlength: 120, default: "" },
        sets: [
          {
            setType: { type: String, enum: ["normal", "warmup", "drop", "failure"], default: "normal" },
            reps: { type: Number, default: 0, min: 0, max: 100_000 },
            weight: { type: Number, default: 0, min: 0, max: 100_000 },
            completed: { type: Boolean, default: false }
          }
        ]
      }
    ]
  },
  { timestamps: true }
);

routineSchema.pre("validate", function validateExerciseBounds() {
  if (!Array.isArray(this.exercises) || this.exercises.length > 50) {
    this.invalidate("exercises", "A routine cannot contain more than 50 exercises");
    return;
  }
  if (this.exercises.some((exercise) => !Array.isArray(exercise.sets) || exercise.sets.length > 30)) {
    this.invalidate("exercises", "An exercise cannot contain more than 30 sets");
  }
});

routineSchema.index({ userId: 1, updatedAt: -1, _id: -1 });
routineSchema.index(
  { userId: 1, operationId: 1 },
  {
    unique: true,
    partialFilterExpression: { operationId: { $type: "string" } },
  }
);

const Routine = mongoose.model("Routine", routineSchema);

export default Routine;
