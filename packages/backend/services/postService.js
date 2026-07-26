import mongoose from "mongoose";
import Post from "../models/Post.js";
import User from "../models/User.js";
import Workout from "../models/Workout.js";
import { cursorFilter, pageFromDocuments } from "../utils/pagination.js";
import {
  createPostComment,
  deleteInteractionsForPost,
  getPostComments,
  hydratePostInteractions,
  togglePostLike,
} from "./postInteractionService.js";

const PUBLIC_USER_FIELDS = "_id full_name username profile_picture";

export const canAccessPost = (post, requester) => {
  const ownerId = post.user.toString();
  if (ownerId === requester._id.toString() || post.visibility === "public") return true;
  if (post.visibility !== "followers") return false;
  return requester.following?.includes(ownerId) || requester.connections?.includes(ownerId) || false;
};

export const checkWorkoutExists = async (workoutId, userId) => {
  return await Workout.exists({ _id: workoutId, userId });
};

export const createPost = async (postData) => {
  return await Post.create(postData);
};

export const getFeedPostsForUser = async (userId, pagination, mode = "discover") => {
  const user = await User.findById(userId).select("connections following");
  if (!user) return null;

  const socialIds = [...new Set([...user.connections, ...user.following].map(String))];
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
    .populate("user", PUBLIC_USER_FIELDS)
    .populate({ path: "workout", populate: { path: "exercises.exerciseId" } })
    .sort({ createdAt: -1, _id: -1 })
    .limit(pagination.limit + 1);

  const page = pageFromDocuments(posts, pagination.limit, "createdAt");
  page.items = await hydratePostInteractions(page.items, userId);
  return page;
};

export const getPostById = async (postId) => {
  return await Post.findById(postId).select("+image_keys");
};

export const getPostForLike = async (postId) => {
  return await Post.findById(postId).select("user visibility");
};

export const toggleLikePost = togglePostLike;

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
