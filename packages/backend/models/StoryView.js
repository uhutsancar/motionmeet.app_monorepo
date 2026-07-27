import mongoose from "mongoose";

const storyViewSchema = new mongoose.Schema(
  {
    storyId: { type: mongoose.Schema.Types.ObjectId, ref: "Story", required: true },
    userId: { type: String, ref: "User", required: true },
  },
  { timestamps: true }
);

storyViewSchema.index({ storyId: 1, userId: 1 }, { unique: true });
storyViewSchema.index({ userId: 1, createdAt: -1 });

const StoryView = mongoose.model("StoryView", storyViewSchema);

export default StoryView;
