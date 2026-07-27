import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    user: { type: String, ref: "User", required: true },
    author_profile: {
      full_name: { type: String },
      username: { type: String },
      profile_picture: { type: String, default: "" },
    },
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
    like_count: { type: Number, default: 0 },
    comment_count: { type: Number, default: 0 },
    share_count: { type: Number, default: 0 },
    download_count: { type: Number, default: 0 },
    workout: { type: mongoose.Schema.Types.ObjectId, ref: "Workout" },
  },
  { timestamps: true, minimize: false }
);

postSchema.index({ user: 1, createdAt: -1 });
postSchema.index({ visibility: 1, createdAt: -1 });
postSchema.index({ user: 1, visibility: 1, createdAt: -1 });

const Post = mongoose.model("Post", postSchema);

export default Post;
