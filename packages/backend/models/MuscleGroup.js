import mongoose from "mongoose";

const muscleGroupSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const MuscleGroup = mongoose.model("MuscleGroup", muscleGroupSchema);

export default MuscleGroup;
