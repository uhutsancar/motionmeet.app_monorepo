import mongoose from "mongoose";

const userFollowSchema = new mongoose.Schema(
  {
    followerId: { type: String, ref: "User", required: true },
    followeeId: { type: String, ref: "User", required: true },
  },
  { timestamps: true }
);

userFollowSchema.index({ followerId: 1, followeeId: 1 }, { unique: true });
userFollowSchema.index({ followeeId: 1, createdAt: -1 });
userFollowSchema.index({ followerId: 1, createdAt: -1 });

const UserFollow = mongoose.model("UserFollow", userFollowSchema);

export default UserFollow;
