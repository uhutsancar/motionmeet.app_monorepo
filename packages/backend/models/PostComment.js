import mongoose from "mongoose";

const postCommentSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
    userId: { type: String, ref: "User", required: true },
    content: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: true, minimize: false }
);

postCommentSchema.index({ postId: 1, createdAt: -1, _id: -1 });
postCommentSchema.index({ userId: 1, createdAt: -1 });

const PostComment = mongoose.model("PostComment", postCommentSchema);

export default PostComment;
