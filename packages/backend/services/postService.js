import Post from "../models/Post.js";
import User from "../models/User.js";
import Workout from "../models/Workout.js";

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

export const getFeedPostsForUser = async (userId) => {
  const user = await User.findById(userId).select("connections following");
  if (!user) return null;

  const socialIds = [...new Set([...user.connections, ...user.following].map(String))];
  const posts = await Post.find({
    $or: [
      { user: userId },
      { user: { $in: socialIds }, visibility: "public" },
      { user: { $in: socialIds }, visibility: "followers" },
    ],
  })
    .populate("user", PUBLIC_USER_FIELDS)
    .populate({ path: "workout", populate: { path: "exercises.exerciseId" } })
    .populate("comments.user", PUBLIC_USER_FIELDS)
    .sort({ createdAt: -1 });

  return posts;
};

export const getPostById = async (postId) => {
  return await Post.findById(postId);
};

export const getPostForLike = async (postId) => {
  return await Post.findById(postId).select("user visibility likes_count");
};

export const toggleLikePost = async (postId, userId, liked) => {
  return await Post.findByIdAndUpdate(
    postId,
    liked ? { $pull: { likes_count: userId } } : { $addToSet: { likes_count: userId } },
    { new: true }
  ).select("likes_count");
};

export const getPostForComment = async (postId) => {
  return await Post.findById(postId).select("user visibility");
};

export const addCommentToPost = async (postId, userId, content) => {
  return await Post.findByIdAndUpdate(
    postId,
    { $push: { comments: { user: userId, content: content.trim() } } },
    { new: true }
  ).populate("comments.user", PUBLIC_USER_FIELDS);
};

export const deletePostById = async (post) => {
  await post.deleteOne();
};
