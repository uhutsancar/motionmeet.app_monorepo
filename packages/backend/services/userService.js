import User from "../models/User.js";
import Connection from "../models/Connection.js";
import Post from "../models/Post.js";
import escapeStringRegexp from "escape-string-regexp";
import { isUserId } from "../utils/validation.js";

const USER_BRIEF_FIELDS = "_id full_name username profile_picture";
const USER_SUMMARY_FIELDS = `${USER_BRIEF_FIELDS} bio location followers following connections`;
const USER_PROFILE_FIELDS = `${USER_SUMMARY_FIELDS} cover_photo statistics createdAt`;

export const withRelationshipCounts = (user) => {
  const value = user.toObject ? user.toObject() : user;
  value.followers_count = value.followers?.length || 0;
  value.following_count = value.following?.length || 0;
  value.connections_count = value.connections?.length || 0;
  delete value.followers;
  delete value.following;
  delete value.connections;
  return value;
};

export const getUserById = async (userId) => {
  return await User.findById(userId).populate("plan");
};

export const userExists = async (userId) => {
  return await User.exists({ _id: userId });
};

export const checkUsernameTaken = async (username, excludeUserId) => {
  return await User.exists({ username, _id: { $ne: excludeUserId } });
};

export const updateUser = async (userId, updatedData) => {
  return await User.findByIdAndUpdate(userId, updatedData, { new: true }).populate("plan");
};

export const searchUsers = async (input, excludeUserId) => {
  const escapedInput = escapeStringRegexp(input);
  const userDocuments = await User.find({
    _id: { $ne: excludeUserId },
    $or: [
      { username: new RegExp(escapedInput, "i") },
      { email: new RegExp(escapedInput, "i") },
      { full_name: new RegExp(escapedInput, "i") },
      { location: new RegExp(escapedInput, "i") },
    ],
  })
    .select(USER_SUMMARY_FIELDS)
    .limit(50);
    
  return userDocuments;
};

export const validateTargetUser = async (requesterId, targetId) => {
  if (!isUserId(targetId) || targetId === requesterId) return null;
  return User.findById(targetId).select("_id");
};

export const followUser = async (userId, targetId) => {
  await Promise.all([
    User.updateOne({ _id: userId }, { $addToSet: { following: targetId } }),
    User.updateOne({ _id: targetId }, { $addToSet: { followers: userId } }),
  ]);
};

export const unfollowUser = async (userId, targetId) => {
  await Promise.all([
    User.updateOne({ _id: userId }, { $pull: { following: targetId } }),
    User.updateOne({ _id: targetId }, { $pull: { followers: userId } }),
  ]);
};

export const checkRecentConnectionRequests = async (userId) => {
  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return await Connection.countDocuments({
    from_user_id: userId,
    createdAt: { $gt: last24Hours },
  });
};

export const getConnectionBetweenUsers = async (userId1, userId2) => {
  return await Connection.findOne({
    $or: [
      { from_user_id: userId1, to_user_id: userId2 },
      { from_user_id: userId2, to_user_id: userId1 },
    ],
  });
};

export const createConnection = async (userId, targetId) => {
  return await Connection.create({ from_user_id: userId, to_user_id: targetId });
};

export const getUserConnectionsData = async (userId) => {
  const user = await User.findById(userId).populate([
    { path: "connections", select: USER_BRIEF_FIELDS },
    { path: "followers", select: USER_BRIEF_FIELDS },
    { path: "following", select: USER_BRIEF_FIELDS },
  ]);

  if (!user) return null;

  const pendingConnections = (
    await Connection.find({ to_user_id: userId, status: "pending" }).populate({
      path: "from_user_id",
      select: USER_BRIEF_FIELDS,
    })
  )
    .map((connection) => connection.from_user_id)
    .filter(Boolean);

  return {
    connections: user.connections,
    followers: user.followers,
    following: user.following,
    pendingConnections,
  };
};

export const acceptConnection = async (userId, senderId) => {
  const connection = await Connection.findOneAndUpdate(
    { from_user_id: senderId, to_user_id: userId, status: { $in: ["pending", "accepted"] } },
    { status: "accepted" },
    { new: true }
  );

  if (connection) {
    await Promise.all([
      User.updateOne({ _id: userId }, { $addToSet: { connections: senderId } }),
      User.updateOne({ _id: senderId }, { $addToSet: { connections: userId } }),
    ]);
  }
  return connection;
};

export const getUserProfileAndPosts = async (profileId, requesterId) => {
  const [profileDocument, requester] = await Promise.all([
    User.findById(profileId).select(USER_PROFILE_FIELDS),
    User.findById(requesterId).select("following connections"),
  ]);

  if (!profileDocument) return null;

  const canSeeFollowerPosts =
    profileId === requesterId ||
    requester?.following?.includes(profileId) ||
    requester?.connections?.includes(profileId);

  const visibility = profileId === requesterId
    ? ["public", "followers", "private"]
    : canSeeFollowerPosts
      ? ["public", "followers"]
      : ["public"];

  const posts = await Post.find({ user: profileId, visibility: { $in: visibility } })
    .populate("user", USER_BRIEF_FIELDS)
    .populate({ path: "workout", populate: { path: "exercises.exerciseId" } })
    .populate("comments.user", USER_BRIEF_FIELDS)
    .sort({ createdAt: -1 });

  return { profile: withRelationshipCounts(profileDocument), posts };
};

export const getSuggestedUsersList = async (userId) => {
  const currentUser = await User.findById(userId).select("following");
  if (!currentUser) return null;

  const excludedIds = [...currentUser.following, userId];
  const userDocuments = await User.find({ _id: { $nin: excludedIds } })
    .select(USER_SUMMARY_FIELDS)
    .limit(5);

  return userDocuments;
};
