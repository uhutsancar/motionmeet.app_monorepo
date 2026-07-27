import "dotenv/config";
import connectDB, { disconnectDB } from "../configs/db.js";
import Post from "../models/Post.js";
import User from "../models/User.js";
import PostLike from "../models/PostLike.js";
import PostComment from "../models/PostComment.js";
import UserFollow from "../models/UserFollow.js";
import Connection from "../models/Connection.js";

const main = async () => {
  await connectDB();
  console.log("Starting full reconciliation job to fix data drift...");

  // Sync Post Likes
  console.log("Reconciling Post Likes...");
  const postLikeCounts = await PostLike.aggregate([
    { $group: { _id: "$postId", count: { $sum: 1 } } }
  ]);
  let postLikeOps = [];
  for (const item of postLikeCounts) {
    postLikeOps.push({
      updateOne: {
        filter: { _id: item._id, like_count: { $ne: item.count } },
        update: { $set: { like_count: item.count } }
      }
    });
    if (postLikeOps.length >= 1000) {
      await Post.bulkWrite(postLikeOps);
      postLikeOps = [];
    }
  }
  if (postLikeOps.length > 0) await Post.bulkWrite(postLikeOps);

  // Sync Post Comments
  console.log("Reconciling Post Comments...");
  const postCommentCounts = await PostComment.aggregate([
    { $group: { _id: "$postId", count: { $sum: 1 } } }
  ]);
  let postCommentOps = [];
  for (const item of postCommentCounts) {
    postCommentOps.push({
      updateOne: {
        filter: { _id: item._id, comment_count: { $ne: item.count } },
        update: { $set: { comment_count: item.count } }
      }
    });
    if (postCommentOps.length >= 1000) {
      await Post.bulkWrite(postCommentOps);
      postCommentOps = [];
    }
  }
  if (postCommentOps.length > 0) await Post.bulkWrite(postCommentOps);

  // Sync User Followers
  console.log("Reconciling User Followers...");
  const followersCounts = await UserFollow.aggregate([
    { $group: { _id: "$followeeId", count: { $sum: 1 } } }
  ]);
  let userUpdatesOps = [];
  for (const item of followersCounts) {
    userUpdatesOps.push({
      updateOne: {
        filter: { _id: item._id, followers_count: { $ne: item.count } },
        update: { $set: { followers_count: item.count } }
      }
    });
    if (userUpdatesOps.length >= 1000) {
      await User.bulkWrite(userUpdatesOps);
      userUpdatesOps = [];
    }
  }
  if (userUpdatesOps.length > 0) {
    await User.bulkWrite(userUpdatesOps);
    userUpdatesOps = [];
  }

  // Sync User Following
  console.log("Reconciling User Following...");
  const followingCounts = await UserFollow.aggregate([
    { $group: { _id: "$followerId", count: { $sum: 1 } } }
  ]);
  for (const item of followingCounts) {
    userUpdatesOps.push({
      updateOne: {
        filter: { _id: item._id, following_count: { $ne: item.count } },
        update: { $set: { following_count: item.count } }
      }
    });
    if (userUpdatesOps.length >= 1000) {
      await User.bulkWrite(userUpdatesOps);
      userUpdatesOps = [];
    }
  }
  if (userUpdatesOps.length > 0) {
    await User.bulkWrite(userUpdatesOps);
    userUpdatesOps = [];
  }

  // Sync User Connections
  console.log("Reconciling User Connections...");
  const connectionsCountsFrom = await Connection.aggregate([
    { $match: { status: "accepted" } },
    { $group: { _id: "$from_user_id", count: { $sum: 1 } } }
  ]);
  const connectionsCountsTo = await Connection.aggregate([
    { $match: { status: "accepted" } },
    { $group: { _id: "$to_user_id", count: { $sum: 1 } } }
  ]);
  const connectionCounts = new Map();
  connectionsCountsFrom.forEach(item => connectionCounts.set(item._id.toString(), (connectionCounts.get(item._id.toString()) || 0) + item.count));
  connectionsCountsTo.forEach(item => connectionCounts.set(item._id.toString(), (connectionCounts.get(item._id.toString()) || 0) + item.count));
  
  for (const [userId, count] of connectionCounts.entries()) {
    userUpdatesOps.push({
      updateOne: {
        filter: { _id: userId, connections_count: { $ne: count } },
        update: { $set: { connections_count: count } }
      }
    });
    if (userUpdatesOps.length >= 1000) {
      await User.bulkWrite(userUpdatesOps);
      userUpdatesOps = [];
    }
  }
  if (userUpdatesOps.length > 0) {
    await User.bulkWrite(userUpdatesOps);
  }

  console.log("Reconciliation complete.");
};

try {
  await main();
} catch (error) {
  console.error("Reconciliation failed:", error.message);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
