import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    user: { type: String, ref: "User", required: true },
    operationId: { type: String, maxlength: 128, default: null },
    author_profile: {
      full_name: { type: String, maxlength: 100 },
      username: { type: String, maxlength: 30 },
      profile_picture: { type: String, maxlength: 2048, default: "" },
    },
    content: { type: String, maxlength: 5000, default: "" },
    image_urls: [{ type: String, maxlength: 2048 }],
    image_keys: {
      type: [{ type: String, maxlength: 1024 }],
      default: [],
      select: false,
    },
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
    like_count: { type: Number, default: 0, min: 0 },
    comment_count: { type: Number, default: 0, min: 0 },
    share_count: { type: Number, default: 0, min: 0 },
    download_count: { type: Number, default: 0, min: 0 },
    workout: { type: mongoose.Schema.Types.ObjectId, ref: "Workout" },
  },
  { timestamps: true, minimize: false }
);

postSchema.pre("validate", function validateMediaBounds() {
  if (this.image_urls.length > 4 || this.image_keys.length > 4) {
    this.invalidate("image_urls", "A post can contain at most four media items");
  }
  if (
    this.image_keys.length > 0 &&
    this.image_keys.length !== this.image_urls.length
  ) {
    this.invalidate("image_keys", "Post media URLs and keys must align");
  }
});

postSchema.index({ user: 1, createdAt: -1, _id: -1 });
postSchema.index({ visibility: 1, createdAt: -1, _id: -1 });
postSchema.index({ user: 1, visibility: 1, createdAt: -1, _id: -1 });
postSchema.index(
  { user: 1, operationId: 1 },
  {
    unique: true,
    partialFilterExpression: { operationId: { $type: "string" } },
  }
);
postSchema.set("toJSON", {
  transform(_document, value) {
    delete value.image_keys;
    return value;
  },
});

const Post = mongoose.model("Post", postSchema);

export default Post;
