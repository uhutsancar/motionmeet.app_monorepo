import mongoose from "mongoose";
import User from "../models/User.js";
import Connection from "../models/Connection.js";
import Post from "../models/Post.js";
import escapeStringRegexp from "escape-string-regexp";
import { isUserId } from "../utils/validation.js";
import { cursorFilter, pageFromDocuments } from "../utils/pagination.js";
import { hydratePostInteractions } from "./postInteractionService.js";

const USER_BRIEF_FIELDS = "_id full_name username profile_picture";
const USER_SUMMARY_FIELDS = `${USER_BRIEF_FIELDS} bio location followers following connections`;
const USER_PROFILE_FIELDS = `${USER_SUMMARY_FIELDS} cover_photo statistics privacy createdAt`;
const MAX_RELATIONSHIPS = 10_000;

const relationshipCapacityFilter = (field, relatedUserId) => ({
  $or: [
    { [field]: relatedUserId },
    {
      $expr: {
        $lt: [{ $size: { $ifNull: [`$${field}`, []] } }, MAX_RELATIONSHIPS],
      },
    },
  ],
});

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

export const getUserByIdWithPassword = async (userId) => {
  return await User.findById(userId).select("+password");
};

export const getUserForProfileUpdate = async (userId) => {
  return await User.findById(userId).select(
    "+profile_picture_key +cover_photo_key"
  );
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
    "privacy.showInSearch": { $ne: false },
    $or: [
      { username: new RegExp(`^${escapedInput}`, "i") },
      { full_name: new RegExp(`^${escapedInput}`, "i") },
    ],
  })
    .select(USER_SUMMARY_FIELDS)
    .limit(20);
    
  return userDocuments;
};

export const validateTargetUser = async (requesterId, targetId, privacyField) => {
  if (!isUserId(targetId) || targetId === requesterId) return null;
  const query = { _id: targetId };
  if (privacyField) query[`privacy.${privacyField}`] = { $ne: false };
  return User.findOne(query).select("_id");
};

export const followUser = async (userId, targetId) => {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const requester = await User.updateOne(
        {
          _id: userId,
          ...relationshipCapacityFilter("following", targetId),
        },
        { $addToSet: { following: targetId } },
        { session }
      );
      const target = await User.updateOne(
        {
          _id: targetId,
          ...relationshipCapacityFilter("followers", userId),
        },
        { $addToSet: { followers: userId } },
        { session }
      );
      if (requester.matchedCount !== 1 || target.matchedCount !== 1) {
        throw Object.assign(new Error("Relationship limit reached"), {
          status: 409,
        });
      }
      return true;
    });
  } finally {
    await session.endSession();
  }
};

export const unfollowUser = async (userId, targetId) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await User.updateOne(
        { _id: userId },
        { $pull: { following: targetId } },
        { session }
      );
      await User.updateOne(
        { _id: targetId },
        { $pull: { followers: userId } },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }
};

export const checkRecentConnectionRequests = async (userId) => {
  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return await Connection.countDocuments({
    from_user_id: userId,
    createdAt: { $gt: last24Hours },
  });
};

export const getConnectionBetweenUsers = async (userId1, userId2) => {
  const pairKey = [userId1, userId2].sort().join(":");
  return await Connection.findOne({
    $or: [
      { pairKey },
      { from_user_id: userId1, to_user_id: userId2 },
      { from_user_id: userId2, to_user_id: userId1 },
    ],
  });
};

export const createConnection = async (userId, targetId) => {
  const pairKey = [userId, targetId].sort().join(":");
  return await Connection.create({
    from_user_id: userId,
    to_user_id: targetId,
    pairKey,
  });
};

export const getUserConnectionsData = async (userId) => {
  const user = await User.findById(userId).populate([
    { path: "connections", select: USER_BRIEF_FIELDS, options: { limit: 200 } },
    { path: "followers", select: USER_BRIEF_FIELDS, options: { limit: 200 } },
    { path: "following", select: USER_BRIEF_FIELDS, options: { limit: 200 } },
  ]);

  if (!user) return null;

  const pendingConnections = (
    await Connection.find({ to_user_id: userId, status: "pending" })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate({
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
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const connection = await Connection.findOneAndUpdate(
        {
          from_user_id: senderId,
          to_user_id: userId,
          status: { $in: ["pending", "accepted"] },
        },
        { status: "accepted" },
        { new: true, session }
      );
      if (!connection) return null;

      const recipient = await User.updateOne(
        {
          _id: userId,
          ...relationshipCapacityFilter("connections", senderId),
        },
        { $addToSet: { connections: senderId } },
        { session }
      );
      const sender = await User.updateOne(
        {
          _id: senderId,
          ...relationshipCapacityFilter("connections", userId),
        },
        { $addToSet: { connections: userId } },
        { session }
      );
      if (recipient.matchedCount !== 1 || sender.matchedCount !== 1) {
        throw Object.assign(new Error("Connection limit reached"), {
          status: 409,
        });
      }
      return connection;
    });
  } finally {
    await session.endSession();
  }
};

export const getUserProfileAndPosts = async (profileId, requesterId, pagination) => {
  const [profileDocument, requester] = await Promise.all([
    User.findById(profileId).select(USER_PROFILE_FIELDS),
    User.findById(requesterId).select("following connections"),
  ]);

  if (!profileDocument) return null;

  const isOwner = profileId === requesterId;
  const isConnection = requester?.connections?.includes(profileId) || false;
  if (!isOwner && profileDocument.privacy?.publicProfile === false && !isConnection) {
    return { restricted: true };
  }

  const canSeeFollowerPosts =
    isOwner ||
    requester?.following?.includes(profileId) ||
    requester?.connections?.includes(profileId);

  const visibility = isOwner
    ? ["public", "followers", "private"]
    : canSeeFollowerPosts
      ? ["public", "followers"]
      : ["public"];

  const posts = await Post.find({
    user: profileId,
    visibility: { $in: visibility },
    ...cursorFilter(pagination.cursor, "createdAt"),
  })
    .select("-likes_count -comments")
    .populate("user", USER_BRIEF_FIELDS)
    .populate({ path: "workout", populate: { path: "exercises.exerciseId" } })
    .sort({ createdAt: -1, _id: -1 })
    .limit(pagination.limit + 1);

  const profile = withRelationshipCounts(profileDocument);
  delete profile.privacy;
  const page = pageFromDocuments(posts, pagination.limit, "createdAt");
  page.items = await hydratePostInteractions(page.items, requester?._id);
  return { profile, posts: page.items, nextCursor: page.nextCursor };
};

export const getSuggestedUsersList = async (userId) => {
  const currentUser = await User.findById(userId).select("following");
  if (!currentUser) return null;

  const excludedIds = [...currentUser.following, userId];
  const userDocuments = await User.find({
    _id: { $nin: excludedIds },
    "privacy.showInSearch": { $ne: false },
  })
    .select(USER_SUMMARY_FIELDS)
    .limit(5);

  return userDocuments;
};
