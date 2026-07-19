import mongoose from "mongoose";

const exerciseSchema = new mongoose.Schema(
  {
    externalId: { type: String, unique: true, sparse: true, index: true }, // dataset's "id"
    name: { type: String, required: true, index: true },
    muscleGroup: { type: String, required: true, index: true },  // maps to body_part
    equipment: { type: String, required: true },
    gifUrl: { type: String, default: "" },
    instructions: { type: Map, of: String, default: {} }, // { en, tr, es, it }
    instructionSteps: { type: Map, of: [String], default: {} },
    isCustom: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Text search index
exerciseSchema.index({ name: "text", muscleGroup: "text" });

const Exercise = mongoose.model("Exercise", exerciseSchema);

export default Exercise;
