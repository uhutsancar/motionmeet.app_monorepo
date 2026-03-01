import mongoose from "mongoose";

const exerciseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    muscleGroup: { type: String, required: true },
    equipment: { type: String, required: true },
    gifUrl: { type: String, default: "" }, // Visual representation
  },
  { timestamps: true }
);

const Exercise = mongoose.model("Exercise", exerciseSchema);

export default Exercise;
