import mongoose from "mongoose";

const usageSchema = new mongoose.Schema(
  {
    userId: { type: String, ref: "User", required: true },
    bucket: { type: String, required: true, maxlength: 64 },
    count: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

usageSchema.index({ userId: 1, bucket: 1 }, { unique: true });
usageSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,
    partialFilterExpression: { expiresAt: { $type: "date" } },
  }
);

const Usage = mongoose.model("Usage", usageSchema);

export default Usage;
