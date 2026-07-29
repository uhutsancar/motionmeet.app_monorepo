import mongoose from "mongoose";

const outboxEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["user.profile.updated", "connection.requested"],
      required: true,
    },
    aggregateId: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["pending", "processing"],
      default: "pending",
    },
    attempts: { type: Number, default: 0, min: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    claimToken: { type: String, default: null },
    claimUntil: { type: Date, default: null },
    lastError: { type: String, default: "" },
  },
  { timestamps: true }
);

outboxEventSchema.index({ status: 1, nextAttemptAt: 1, claimUntil: 1 });
outboxEventSchema.index({ aggregateId: 1, createdAt: -1 });
outboxEventSchema.index({ "payload.senderId": 1, createdAt: -1 });
outboxEventSchema.index({ "payload.recipientId": 1, createdAt: -1 });

const OutboxEvent = mongoose.model("OutboxEvent", outboxEventSchema);

export default OutboxEvent;
