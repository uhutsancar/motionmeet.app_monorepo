import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    userId: { type: String, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    lastUsedAt: { type: Date, default: Date.now },
    userAgent: { type: String, default: "", maxlength: 512 },
    ipAddress: { type: String, default: "", maxlength: 128 },
  },
  { timestamps: true }
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ userId: 1, revokedAt: 1, expiresAt: 1 });

const Session = mongoose.model("Session", sessionSchema);

export default Session;
