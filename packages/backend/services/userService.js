import mongoose from "mongoose";
import User from "../models/User.js";
import Connection from "../models/Connection.js";
import UserFollow from "../models/UserFollow.js";
import Post from "../models/Post.js";
import { isUserId } from "../utils/validation.js";
import { cursorFilter, pageFromDocuments } from "../utils/pagination.js";
import { hydratePostInteractions } from "./postInteractionService.js";
import Usage from "../models/Usage.js";
import OutboxEvent from "../models/OutboxEvent.js";
import { commitReservedUploads } from "./mediaUploadService.js";
import { queueMediaDeletions } from "./mediaDeletionService.js";
import { extractS3Key } from "../utils/s3Utils.js";

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

export const updateUser = async (
  userId,
  updatedData,
  { reservationKeys = [] } = {}
) => {
  // SuperAdmin'in email adresinin değiştirilmesini engelle:
  // Email değiştirilirse superadmin kimliği kaybedilebilir.
  // Not: Mevcut userController'da email güncelleme yoktur (normal kullanıcı için),
  //      ama ileriki bir değişiklikte bunu koruma altına alıyoruz.
  if (updatedData.email !== undefined) {
    const existing = await User.findById(userId).select("email role").lean();
    if (existing?.role === "superadmin") {
      throw Object.assign(
        new Error("SuperAdmin email address cannot be changed"),
        { status: 403 }
      );
    }
  }

  const profileChanged =
    updatedData.full_name !== undefined ||
    updatedData.username !== undefined ||
    updatedData.profile_picture !== undefined;
  const profileUpdates = {};
  if (profileChanged) {
    if (updatedData.full_name !== undefined) profileUpdates["author_profile.full_name"] = updatedData.full_name;
    if (updatedData.username !== undefined) profileUpdates["author_profile.username"] = updatedData.username;
    if (updatedData.profile_picture !== undefined) profileUpdates["author_profile.profile_picture"] = updatedData.profile_picture;
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const replacedMediaKeys = [];
      if (
        updatedData.profile_picture !== undefined ||
        updatedData.cover_photo !== undefined
      ) {
        const current = await User.findById(userId)
          .select(
            "profile_picture cover_photo +profile_picture_key +cover_photo_key"
          )
          .session(session);
        if (!current) {
          throw Object.assign(new Error("User not found"), { status: 404 });
        }
        if (updatedData.profile_picture !== undefined) {
          const key =
            current.profile_picture_key ||
            extractS3Key(current.profile_picture);
          if (key) replacedMediaKeys.push(key);
        }
        if (updatedData.cover_photo !== undefined) {
          const key =
            current.cover_photo_key || extractS3Key(current.cover_photo);
          if (key) replacedMediaKeys.push(key);
        }
      }
      const result = await User.updateOne(
        { _id: userId },
        { $set: updatedData },
        { session, runValidators: true }
      );
      if (result.matchedCount !== 1) {
        throw Object.assign(new Error("User not found"), { status: 404 });
      }
      await commitReservedUploads(reservationKeys, { session, userId });
      await queueMediaDeletions(replacedMediaKeys, { session });
      if (profileChanged) {
        await OutboxEvent.create(
          [
            {
              type: "user.profile.updated",
              aggregateId: userId,
              payload: profileUpdates,
            },
          ],
          { session }
        );
      }
    });
  } finally {
    await session.endSession();
  }

  return User.findById(userId).populate("plan");
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
    try {
      return await session.withTransaction(async () => {
        const edge = await UserFollow.updateOne(
          { followerId: userId, followeeId: targetId },
          { $setOnInsert: { followerId: userId, followeeId: targetId } },
          { upsert: true, session }
        );

        if (edge.upsertedCount === 0) return true;

        const requester = await User.updateOne(
          { _id: userId, ...relationshipCapacityFilter("following_count") },
          { $inc: { following_count: 1 } },
          { session }
        );
        if (requester.matchedCount !== 1) {
          throw Object.assign(new Error("Relationship limit reached"), {
            status: 409,
          });
        }

        const target = await User.updateOne(
          { _id: targetId },
          { $inc: { followers_count: 1 } },
          { session }
        );
        if (target.matchedCount !== 1) {
          throw Object.assign(new Error("Relationship limit reached"), {
            status: 409,
          });
        }
        return true;
      });
    } catch (error) {
      if (error?.code === 11000) return true;
      throw error;
    }
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
        await User.updateOne(
          { _id: userId },
          [{ $set: { following_count: { $max: [0, { $subtract: [{ $ifNull: ["$following_count", 0] }, 1] }] } } }],
          { session }
        );
        await User.updateOne(
          { _id: targetId },
          [{ $set: { followers_count: { $max: [0, { $subtract: [{ $ifNull: ["$followers_count", 0] }, 1] }] } } }],
          { session }
        );
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

export const getAcceptedConnectionUserIds = async (userId) => {
  const documents = await Connection.find({
    status: "accepted",
    $or: [{ from_user_id: userId }, { to_user_id: userId }],
  })
    .select("from_user_id to_user_id")
    .limit(MAX_RELATIONSHIPS)
    .lean();
  return documents.map((connection) =>
    connection.from_user_id === userId
      ? connection.to_user_id
      : connection.from_user_id
  );
};

export const createConnection = async (userId, targetId) => {
  const pairKey = [userId, targetId].sort().join(":");
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const bucket = `connection_requests:${day}`;
  const expiresAt = new Date(now);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + 2);

  const session = await mongoose.startSession();
  let connection = null;
  try {
    await session.withTransaction(async () => {
      await Usage.updateOne(
        { userId, bucket },
        {
          $setOnInsert: {
            userId,
            bucket,
            count: 0,
            expiresAt,
          },
        },
        { upsert: true, session }
      );
      const quota = await Usage.updateOne(
        { userId, bucket, count: { $lt: 20 } },
        { $inc: { count: 1 } },
        { session }
      );
      if (quota.matchedCount !== 1) {
        throw Object.assign(new Error("Daily connection request limit reached"), {
          status: 429,
        });
      }
      [connection] = await Connection.create(
        [{ from_user_id: userId, to_user_id: targetId, pairKey }],
        { session }
      );
      await OutboxEvent.create(
        [
          {
            type: "connection.requested",
            aggregateId: connection._id.toString(),
            payload: { senderId: userId, recipientId: targetId },
          },
        ],
        { session }
      );
    });
    return connection;
  } finally {
    await session.endSession();
  }
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

export const getUserRelationshipPage = async (
  userId,
  section,
  pagination
) => {
  let documents;
  let mapDocument;
  const paginationFilter = cursorFilter(pagination.cursor, "createdAt");

  if (section === "connections") {
    documents = await Connection.find({
      $and: [
        {
          status: "accepted",
          $or: [{ from_user_id: userId }, { to_user_id: userId }],
        },
        paginationFilter,
      ],
    })
      .populate("from_user_id", USER_BRIEF_FIELDS)
      .populate("to_user_id", USER_BRIEF_FIELDS)
      .sort({ createdAt: -1, _id: -1 })
      .limit(pagination.limit + 1);
    mapDocument = (connection) =>
      connection.from_user_id?._id?.toString() === userId
        ? connection.to_user_id
        : connection.from_user_id;
  } else if (section === "followers") {
    documents = await UserFollow.find({
      followeeId: userId,
      ...paginationFilter,
    })
      .populate("followerId", USER_BRIEF_FIELDS)
      .sort({ createdAt: -1, _id: -1 })
      .limit(pagination.limit + 1);
    mapDocument = (edge) => edge.followerId;
  } else if (section === "following") {
    documents = await UserFollow.find({
      followerId: userId,
      ...paginationFilter,
    })
      .populate("followeeId", USER_BRIEF_FIELDS)
      .sort({ createdAt: -1, _id: -1 })
      .limit(pagination.limit + 1);
    mapDocument = (edge) => edge.followeeId;
  } else {
    documents = await Connection.find({
      to_user_id: userId,
      status: "pending",
      ...paginationFilter,
    })
      .populate("from_user_id", USER_BRIEF_FIELDS)
      .sort({ createdAt: -1, _id: -1 })
      .limit(pagination.limit + 1);
    mapDocument = (connection) => connection.from_user_id;
  }

  const page = pageFromDocuments(
    documents,
    pagination.limit,
    "createdAt"
  );
  return {
    items: page.items.map(mapDocument).filter(Boolean),
    nextCursor: page.nextCursor,
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

      const recipient = await User.updateOne(
        { _id: userId, ...relationshipCapacityFilter("connections_count") },
        { $inc: { connections_count: 1 } },
        { session }
      );
      if (recipient.matchedCount !== 1) {
        throw Object.assign(new Error("Connection limit reached"), { status: 409 });
      }

      const sender = await User.updateOne(
        { _id: senderId, ...relationshipCapacityFilter("connections_count") },
        { $inc: { connections_count: 1 } },
        { session }
      );
      if (sender.matchedCount !== 1) {
        throw Object.assign(new Error("Connection limit reached"), { status: 409 });
      }

      return await Connection.findById(connection._id).session(session);
    });
  } finally {
    await session.endSession();
  }
};

export const removeConnection = async (userId, targetId) => {
  const pairKey = [userId, targetId].sort().join(":");
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const deleted = await Connection.deleteOne(
        { pairKey, status: "accepted" },
        { session }
      );
      if (!deleted.deletedCount) return false;
      await User.updateMany(
        { _id: { $in: [userId, targetId] } },
        [{ $set: { connections_count: { $max: [0, { $subtract: [{ $ifNull: ["$connections_count", 0] }, 1] }] } } }],
        { session }
      );
      return true;
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
    .populate({
      path: "workout",
      populate: {
        path: "exercises.exerciseId",
        select: "name muscleGroup equipment imageUrl gifUrl",
      },
    })
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
  return User.aggregate([
    {
      $match: {
        _id: { $ne: userId },
        "privacy.showInSearch": { $ne: false },
      },
    },
    { $sort: { createdAt: -1, _id: -1 } },
    { $limit: Math.min(safeLimit * 10, 500) },
    {
      $lookup: {
        from: UserFollow.collection.name,
        let: { candidateId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$followerId", userId] },
                  { $eq: ["$followeeId", "$$candidateId"] },
                ],
              },
            },
          },
          { $limit: 1 },
        ],
        as: "existingFollow",
      },
    },
    { $match: { existingFollow: { $eq: [] } } },
    { $limit: safeLimit },
    {
      $project: {
        _id: 1,
        full_name: 1,
        username: 1,
        profile_picture: 1,
        bio: 1,
        location: 1,
        followers_count: 1,
        following_count: 1,
        connections_count: 1,
      },
    },
  ]);
};
