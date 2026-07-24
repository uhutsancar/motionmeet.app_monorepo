import mongoose from "mongoose";

const connectionSchema = new mongoose.Schema(
  {
    from_user_id: { type: String, ref: "User", required: true },
    to_user_id: { type: String, ref: "User", required: true },
    pairKey: { type: String, maxlength: 128 },
    status: { type: String, enum: ["pending", "accepted"], default: "pending" },
  },
  { timestamps: true }
);

connectionSchema.index({ from_user_id: 1, createdAt: -1 });
connectionSchema.index({ to_user_id: 1, status: 1 });
connectionSchema.index(
  { pairKey: 1 },
  { unique: true, partialFilterExpression: { pairKey: { $type: "string" } } }
);

connectionSchema.pre("validate", function setPairKey() {
  this.pairKey = [this.from_user_id, this.to_user_id].sort().join(":");
});

const Connection = mongoose.model("Connection", connectionSchema);

export default Connection;
