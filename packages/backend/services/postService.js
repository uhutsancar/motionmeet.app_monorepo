import mongoose from "mongoose";
import Post from "../models/Post.js";
import User from "../models/User.js";
import UserFollow from "../models/UserFollow.js";
import Connection from "../models/Connection.js";
import Workout from "../models/Workout.js";
import { cursorFilter, pageFromDocuments } from "../utils/pagination.js";
import {
  createPostComment,
  deleteInteractionsForPost,
  getPostComments,
  hydratePostInteractions,
  likePost,
  togglePostLike,
  unlikePost,
} from "./postInteractionService.js";

export const canAccessPost = async (post, requester) => {
  const ownerId = post.user.toString();
  if (ownerId === requester._id.toString() || post.visibility === "public") return true;
  if (post.visibility !== "followers") return false;

  const [isFollowing, isConnected] = await Promise.all([
    UserFollow.exists({ followerId: requester._id, followeeId: ownerId }),
    Connection.exists({
      status: "accepted",
      $or: [
        { from_user_id: requester._id, to_user_id: ownerId },
        { from_user_id: ownerId, to_user_id: requester._id }
      ]
    })
  ]);

  return Boolean(isFollowing || isConnected);
};

export const checkWorkoutExists = async (workoutId, userId) => {
  return await Workout.exists({ _id: workoutId, userId });
};

export const createPost = async (postData) => {
  const user = await User.findById(postData.user).select("full_name username profile_picture").lean();
  if (user) {
    postData.author_profile = {
      full_name: user.full_name,
      username: user.username,
      profile_picture: user.profile_picture || "",
    };
  }
  return await Post.create(postData);
};

export const getFeedPostsForUser = async (userId, pagination, mode = "discover") => {
  let socialIds = [];

  if (mode === "following") {
    const [followingEdges, connectionEdges] = await Promise.all([
      UserFollow.find({ followerId: userId }).select("followeeId").lean(),
      Connection.find({
        status: "accepted",
        $or: [{ from_user_id: userId }, { to_user_id: userId }]
      }).lean()
    ]);

    const followingIds = followingEdges.map(e => e.followeeId.toString());
    const connectionIds = connectionEdges.map(c => 
      c.from_user_id.toString() === userId.toString() ? c.to_user_id.toString() : c.from_user_id.toString()
    );
    socialIds = [...new Set([...followingIds, ...connectionIds])];
  }
  const hiddenWorkoutOwners = mode === "following"
    ? await User.find({
        _id: { $in: socialIds },
        "privacy.showWorkoutsOnFeed": false,
      }).distinct("_id")
    : [];
  const accessFilter = mode === "following"
    ? {
        $or: [
          { user: userId },
          { user: { $in: socialIds }, visibility: "public" },
          { user: { $in: socialIds }, visibility: "followers" },
        ],
      }
    : {
        $or: [
          { user: userId },
          { visibility: "public", post_type: { $ne: "workout" } },
        ],
      };
  const posts = await Post.find({
    $and: [
      accessFilter,
      cursorFilter(pagination.cursor, "createdAt"),
    ],
    $nor: [
      {
        user: { $in: hiddenWorkoutOwners },
        post_type: "workout",
      },
    ],
  })
    .select("-likes_count -comments")
    .populate({ path: "workout", populate: { path: "exercises.exerciseId" } })
    .sort({ createdAt: -1, _id: -1 })
    .limit(pagination.limit + 1);

  const page = pageFromDocuments(posts, pagination.limit, "createdAt");
  page.items = await hydratePostInteractions(page.items, userId);
  
  // Map denormalized author_profile back to user object for frontend compatibility
  page.items = page.items.map((post) => {
    const postObj = post.toObject ? post.toObject() : post;
    if (postObj.author_profile && postObj.author_profile.username) {
      postObj.user = {
        _id: postObj.user,
        ...postObj.author_profile
      };
    }
    return postObj;
  });

  return page;
};

export const getPostById = async (postId) => {
  return await Post.findById(postId).select("+image_keys");
};

export const getPostForLike = async (postId) => {
  return await Post.findById(postId).select("user visibility");
};

/** @deprecated Use idempotentLikePost / idempotentUnlikePost instead */
export const toggleLikePost = togglePostLike;
export const idempotentLikePost = likePost;
export const idempotentUnlikePost = unlikePost;

export const getPostForComment = async (postId) => {
  return await Post.findById(postId).select("user visibility");
};

export const addCommentToPost = createPostComment;
export const getCommentsForPost = getPostComments;

export const deletePostById = async (post) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await deleteInteractionsForPost(post._id, { session });
      await post.deleteOne({ session });
    });
  } finally {
    await session.endSession();
  }
};
