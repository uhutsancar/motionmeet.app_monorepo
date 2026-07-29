import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    pairKey: { type: String, required: true, maxlength: 128 },
    participants: {
      type: [String],
      ref: "User",
      required: true,
      validate: [
        (val) => val.length === 2,
        "A conversation must have exactly 2 participants.",
      ],
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    lastMessageAt: { type: Date, default: null },
    unreadByUser: {
      type: Map,
      of: { type: Number, min: 0 },
      default: {},
    },
  },
  { timestamps: true }
);

// Hızlı sorgular için indexler
conversationSchema.pre("validate", function normalizeParticipants() {
  if (!Array.isArray(this.participants) || this.participants.length !== 2) return;
  this.participants = [...this.participants].map(String).sort();
  if (this.participants[0] === this.participants[1]) {
    this.invalidate("participants", "Conversation participants must be distinct");
    return;
  }
  this.pairKey = this.participants.join(":");
});

conversationSchema.index({ pairKey: 1 }, { unique: true });
conversationSchema.index({ participants: 1, lastMessageAt: -1, _id: -1 });

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
