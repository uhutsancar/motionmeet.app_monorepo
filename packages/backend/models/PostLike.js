import mongoose from "mongoose";

const postLikeSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
    userId: { type: String, ref: "User", required: true },
  },
  { timestamps: true, minimize: false }
);

postLikeSchema.index({ postId: 1, userId: 1 }, { unique: true });
postLikeSchema.index({ userId: 1, createdAt: -1 });

const PostLike = mongoose.model("PostLike", postLikeSchema);

export default PostLike;
