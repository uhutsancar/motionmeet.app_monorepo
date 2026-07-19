import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    user: { type: String, ref: "User", required: true },
    content: { type: String },
    image_urls: [{ type: String }],
    post_type: {
      type: String,
      enum: ["text", "image", "text_with_image", "video", "workout"],
      default: "text",
    },
    visibility: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "public",
    },
    likes_count: [{ type: String, ref: "User" }],
    comments: [
      {
        user: { type: String, ref: "User", required: true },
        content: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    workout: { type: mongoose.Schema.Types.ObjectId, ref: "Workout" },
  },
  { timestamps: true, minimize: false }
);

postSchema.index({ user: 1, createdAt: -1 });
postSchema.index({ visibility: 1, createdAt: -1 });

const Post = mongoose.model("Post", postSchema);

export default Post;
