import mongoose from "mongoose";

const mediaDeletionJobSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    attempts: { type: Number, default: 0, min: 0 },
    nextAttemptAt: { type: Date, default: Date.now, index: true },
    lastError: { type: String, default: "" },
  },
  { timestamps: true, minimize: false }
);

const MediaDeletionJob = mongoose.model(
  "MediaDeletionJob",
  mediaDeletionJobSchema
);

export default MediaDeletionJob;
