import mongoose from "mongoose";

const mediaDeletionJobSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, maxlength: 1024 },
    attempts: { type: Number, default: 0, min: 0 },
    nextAttemptAt: { type: Date, default: Date.now, index: true },
    lastError: { type: String, default: "" },
    claimToken: { type: String, default: null },
    claimUntil: { type: Date, default: null },
  },
  { timestamps: true, minimize: false }
);

mediaDeletionJobSchema.index({ nextAttemptAt: 1, claimUntil: 1, _id: 1 });

const MediaDeletionJob = mongoose.model(
  "MediaDeletionJob",
  mediaDeletionJobSchema
);

export default MediaDeletionJob;
