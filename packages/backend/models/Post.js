import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    user: { type: String, ref: "User", required: true },
    content: { type: String },
    image_urls: [{ type: String }],
    image_keys: { type: [String], default: [], select: false },
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
    // Deprecated embedded interactions are retained only so the integrity
    // migration can move old data into PostLike/PostComment collections.
    likes_count: {
      type: [{ type: String, ref: "User" }],
      default: undefined,
      select: false,
    },
    comments: {
      type: [
        {
          user: { type: String, ref: "User", required: true },
          content: { type: String, required: true },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: undefined,
      select: false,
    },
    workout: { type: mongoose.Schema.Types.ObjectId, ref: "Workout" },
  },
  { timestamps: true, minimize: false }
);

postSchema.index({ user: 1, createdAt: -1 });
postSchema.index({ visibility: 1, createdAt: -1 });
postSchema.index({ user: 1, visibility: 1, createdAt: -1 });

const Post = mongoose.model("Post", postSchema);

export default Post;
