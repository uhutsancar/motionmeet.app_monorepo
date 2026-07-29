import mongoose from "mongoose";

const workoutSchema = new mongoose.Schema(
  {
    userId: { type: String, ref: "User", required: true },
    operationId: { type: String, maxlength: 128, default: null },
    name: { type: String, required: true, trim: true, maxlength: 120 }, // Inherited from routine or custom
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    durationMinutes: { type: Number, default: 0, min: 0, max: 10_080 },
    volumeKg: { type: Number, default: 0, min: 0 },
    totalSets: { type: Number, default: 0, min: 0, max: 1_500 },
    totalReps: { type: Number, default: 0, min: 0 },
    metricsVersion: { type: Number, default: 2 },
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

workoutSchema.pre("validate", function validateExerciseBounds() {
  if (!Array.isArray(this.exercises) || this.exercises.length < 1 || this.exercises.length > 50) {
    this.invalidate("exercises", "A workout must contain between 1 and 50 exercises");
    return;
  }
  if (this.exercises.some((exercise) => !Array.isArray(exercise.sets) || exercise.sets.length < 1 || exercise.sets.length > 30)) {
    this.invalidate("exercises", "Each exercise must contain between 1 and 30 sets");
  }
});

workoutSchema.index({ userId: 1, startTime: -1, _id: -1 });
workoutSchema.index({ userId: 1, "exercises.exerciseId": 1, startTime: -1 });
// countUserWorkoutsFromDate() fonksiyonu için: ayda kaç workout yapıldığını sayan sorgu
workoutSchema.index({ userId: 1, createdAt: -1 });
workoutSchema.index(
  { userId: 1, operationId: 1 },
  {
    unique: true,
    partialFilterExpression: { operationId: { $type: "string" } },
  }
);

const Workout = mongoose.model("Workout", workoutSchema);

export default Workout;
