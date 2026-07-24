import mongoose from "mongoose";

const usageSchema = new mongoose.Schema(
  {
    userId: { type: String, ref: "User", required: true },
    bucket: { type: String, required: true, maxlength: 64 },
    count: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

usageSchema.index({ userId: 1, bucket: 1 }, { unique: true });

const Usage = mongoose.model("Usage", usageSchema);

export default Usage;
