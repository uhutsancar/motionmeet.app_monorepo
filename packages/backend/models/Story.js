import mongoose from "mongoose";

const storySchema = new mongoose.Schema(
  {
    user: { type: String, ref: "User", required: true },
    content: { type: String },
    media_url: { type: String },
    media_key: { type: String, default: "", select: false },
    media_type: {
      type: String,
      enum: ["text", "image", "video"],
    },
    views_count: {
      type: [{ type: String, ref: "User" }],
      default: undefined,
      select: false,
    },
    background_color: {type: String},
  },
  { timestamps: true, minimize: false }
);

storySchema.index({ user: 1, createdAt: -1 });
storySchema.index({ createdAt: 1 });

const Story = mongoose.model("Story", storySchema);

export default Story;
