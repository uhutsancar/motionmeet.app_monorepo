import mongoose from "mongoose";
import User from "../models/User.js";
import Connection from "../models/Connection.js";
import UserFollow from "../models/UserFollow.js";
import Post from "../models/Post.js";
import escapeStringRegexp from "escape-string-regexp";
import { isUserId } from "../utils/validation.js";
import { cursorFilter, pageFromDocuments } from "../utils/pagination.js";
import { hydratePostInteractions } from "./postInteractionService.js";
import { bufferCountIncrement } from "../configs/redis.js";

const USER_BRIEF_FIELDS = "_id full_name username profile_picture";
const USER_SUMMARY_FIELDS = `${USER_BRIEF_FIELDS} bio location followers_count following_count connections_count`;
const USER_PROFILE_FIELDS = `${USER_SUMMARY_FIELDS} cover_photo statistics privacy createdAt`;
const MAX_RELATIONSHIPS = 10_000;

const relationshipCapacityFilter = (countField) => ({
  [countField]: { $lt: MAX_RELATIONSHIPS },
});

export const withRelationshipCounts = (user) => {
  return user.toObject ? user.toObject() : user;
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

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || "sancaruhut@gmail.com";

export const updateUser = async (userId, updatedData) => {
  // SuperAdmin'in email adresinin değiştirilmesini engelle:
  // Email değiştirilirse superadmin kimliği kaybedilebilir.
  // Not: Mevcut userController'da email güncelleme yoktur (normal kullanıcı için),
  //      ama ileriki bir değişiklikte bunu koruma altına alıyoruz.
  if (updatedData.email !== undefined) {
    const existing = await User.findById(userId).select("email role").lean();
    if (existing?.role === "superadmin" && existing.email === SUPER_ADMIN_EMAIL) {
      throw Object.assign(
        new Error("SuperAdmin email address cannot be changed"),
        { status: 403 }
      );
    }
  }

  const user = await User.findByIdAndUpdate(userId, updatedData, { new: true }).populate("plan");

  if (
    updatedData.full_name !== undefined ||
    updatedData.username !== undefined ||
    updatedData.profile_picture !== undefined
  ) {
    const profileUpdates = {};
    if (updatedData.full_name !== undefined) profileUpdates["author_profile.full_name"] = updatedData.full_name;
    if (updatedData.username !== undefined) profileUpdates["author_profile.username"] = updatedData.username;
    if (updatedData.profile_picture !== undefined) profileUpdates["author_profile.profile_picture"] = updatedData.profile_picture;

    // Asynchronously update all posts by this user
    Post.updateMany({ user: userId }, { $set: profileUpdates }).catch((err) => {
      console.error("Failed to sync author_profile to posts:", err.message);
    });
  }

  return user;
};

export const searchUsers = async (input, excludeUserId) => {
  // If search input is empty, return empty array immediately.
  if (!input || !input.trim()) return [];

  const userDocuments = await User.find(
    {
      _id: { $ne: excludeUserId },
      "privacy.showInSearch": { $ne: false },
      $text: { $search: input },
    },
    { score: { $meta: "textScore" } }
  )
    .sort({ score: { $meta: "textScore" } })
    .select(USER_SUMMARY_FIELDS)
    .limit(20)
    .lean();

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
      const edge = await UserFollow.updateOne(
        { followerId: userId, followeeId: targetId },
        { $setOnInsert: { followerId: userId, followeeId: targetId } },
        { upsert: true, session }
      );
      
      if (edge.upsertedCount === 0) return true;

      const bufferedFollowing = await bufferCountIncrement("following_count", userId.toString(), 1);
      if (!bufferedFollowing) {
        const requester = await User.updateOne(
          { _id: userId, ...relationshipCapacityFilter("following_count") },
          { $inc: { following_count: 1 } },
          { session }
        );
        if (requester.matchedCount !== 1) {
          throw Object.assign(new Error("Relationship limit reached"), { status: 409 });
        }
      }

      const bufferedFollowers = await bufferCountIncrement("followers_count", targetId.toString(), 1);
      if (!bufferedFollowers) {
        const target = await User.updateOne(
          { _id: targetId, ...relationshipCapacityFilter("followers_count") },
          { $inc: { followers_count: 1 } },
          { session }
        );
        if (target.matchedCount !== 1) {
          throw Object.assign(new Error("Relationship limit reached"), { status: 409 });
        }
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
      const deleted = await UserFollow.deleteOne(
        { followerId: userId, followeeId: targetId },
        { session }
      );
      
      if (deleted.deletedCount > 0) {
        const bufferedFollowing = await bufferCountIncrement("following_count", userId.toString(), -1);
        if (!bufferedFollowing) {
          await User.updateOne(
            { _id: userId },
            { $inc: { following_count: -1 } },
            { session }
          );
        }

        const bufferedFollowers = await bufferCountIncrement("followers_count", targetId.toString(), -1);
        if (!bufferedFollowers) {
          await User.updateOne(
            { _id: targetId },
            { $inc: { followers_count: -1 } },
            { session }
          );
        }
      }
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
  const [connectionsDocs, followersDocs, followingDocs, pendingConnectionsDocs] = await Promise.all([
    Connection.find({
      $or: [{ from_user_id: userId }, { to_user_id: userId }],
      status: "accepted"
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("from_user_id", USER_BRIEF_FIELDS)
      .populate("to_user_id", USER_BRIEF_FIELDS),
    
    UserFollow.find({ followeeId: userId })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("followerId", USER_BRIEF_FIELDS),
      
    UserFollow.find({ followerId: userId })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("followeeId", USER_BRIEF_FIELDS),
      
    Connection.find({ to_user_id: userId, status: "pending" })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("from_user_id", USER_BRIEF_FIELDS)
  ]);

  const connections = connectionsDocs.map(c => 
    (/** @type {any} */ (c.from_user_id))?._id?.toString() === userId ? c.to_user_id : c.from_user_id
  ).filter(Boolean);
  
  const followers = followersDocs.map(f => f.followerId).filter(Boolean);
  const following = followingDocs.map(f => f.followeeId).filter(Boolean);
  const pendingConnections = pendingConnectionsDocs.map(c => c.from_user_id).filter(Boolean);

  return {
    connections,
    followers,
    following,
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
        { new: false, session }
      );
      if (!connection) return null;

      if (connection.status === "accepted") {
          return connection;
      }

      const bufferedRecipient = await bufferCountIncrement("connections_count", userId.toString(), 1);
      if (!bufferedRecipient) {
        const recipient = await User.updateOne(
          { _id: userId, ...relationshipCapacityFilter("connections_count") },
          { $inc: { connections_count: 1 } },
          { session }
        );
        if (recipient.matchedCount !== 1) {
          throw Object.assign(new Error("Connection limit reached"), { status: 409 });
        }
      }

      const bufferedSender = await bufferCountIncrement("connections_count", senderId.toString(), 1);
      if (!bufferedSender) {
        const sender = await User.updateOne(
          { _id: senderId, ...relationshipCapacityFilter("connections_count") },
          { $inc: { connections_count: 1 } },
          { session }
        );
        if (sender.matchedCount !== 1) {
          throw Object.assign(new Error("Connection limit reached"), { status: 409 });
        }
      }

      return await Connection.findById(connection._id).session(session);
    });
  } finally {
    await session.endSession();
  }
};

export const getUserProfileAndPosts = async (profileId, requesterId, pagination) => {
  const profileDocument = await User.findById(profileId).select(USER_PROFILE_FIELDS);
  if (!profileDocument) return null;

  let isFollowing = false;
  let isConnection = false;
  let connectionPending = false;
  
  const isOwner = profileId === requesterId;

  if (!isOwner && requesterId) {
    const [followDoc, connDoc] = await Promise.all([
      UserFollow.exists({ followerId: requesterId, followeeId: profileId }),
      getConnectionBetweenUsers(requesterId, profileId)
    ]);
    isFollowing = !!followDoc;
    isConnection = connDoc?.status === "accepted";
    connectionPending = connDoc?.status === "pending";
  }

  if (!isOwner && profileDocument.privacy?.publicProfile === false && !isConnection) {
    return { restricted: true };
  }

  const canSeeFollowerPosts = isOwner || isFollowing || isConnection;

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
  profile.isFollowing = isFollowing;
  profile.isConnection = isConnection;
  profile.connectionPending = connectionPending;
  const page = pageFromDocuments(posts, pagination.limit, "createdAt");
  page.items = await hydratePostInteractions(page.items, requesterId);
  return { profile, posts: page.items, nextCursor: page.nextCursor };
};

export const getSuggestedUsersList = async (userId, limit = 10) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const followingDocs = await UserFollow.find({ followerId: userId }).select("followeeId").lean();
  const excludedIds = [...followingDocs.map(doc => doc.followeeId), userId];
  
  const userDocuments = await User.find({
    _id: { $nin: excludedIds },
    "privacy.showInSearch": { $ne: false },
  })
    .select(USER_SUMMARY_FIELDS)
    .limit(safeLimit);

  return userDocuments;
};
