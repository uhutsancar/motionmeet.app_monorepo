import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
    },
    operationId: { type: String, maxlength: 128, default: null },
    from_user_id: { type: String, ref: "User", required: true },
    to_user_id: { type: String, ref: "User", required: true },
    text: { type: String, trim: true, maxlength: 2000, default: "" },
    message_type: {
      type: String,
      trim: true,
      enum: ["text", "image"],
      required: true,
    },
    media_url: { type: String, maxlength: 2048 },
    media_key: { type: String, maxlength: 1024, default: "", select: false },
    seen: { type: Boolean, default: false },
  },
  { timestamps: true, minimize: false }
);

messageSchema.index({ conversationId: 1, createdAt: -1, _id: -1 });
messageSchema.index({ from_user_id: 1, createdAt: -1, _id: -1 });
messageSchema.index({ to_user_id: 1, createdAt: -1, _id: -1 });
messageSchema.index(
  { from_user_id: 1, operationId: 1 },
  {
    unique: true,
    partialFilterExpression: { operationId: { $type: "string" } },
  }
);

messageSchema.pre("validate", function validateParticipantsAndContent() {
  if (String(this.from_user_id) === String(this.to_user_id)) {
    this.invalidate("to_user_id", "Message participants must be distinct");
  }
  if (this.message_type === "text" && !this.text?.trim()) {
    this.invalidate("text", "Text messages require content");
  }
  if (this.message_type === "image" && !this.media_url) {
    this.invalidate("media_url", "Image messages require media");
  }
});
messageSchema.set("toJSON", {
  transform(_document, value) {
    delete value.media_key;
    return value;
  },
});

const Message = mongoose.model("Message", messageSchema);

export default Message;
