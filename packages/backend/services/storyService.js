import Story from "../models/Story.js";
import StoryView from "../models/StoryView.js";
import UserFollow from "../models/UserFollow.js";
import Connection from "../models/Connection.js";
import mongoose from "mongoose";
import { extractS3Key } from "../utils/s3Utils.js";
import { queueMediaDeletions } from "./mediaDeletionService.js";
import { cursorFilter, pageFromDocuments } from "../utils/pagination.js";
import * as quotaService from "./quotaService.js";
import { commitReservedUploads } from "./mediaUploadService.js";

const PUBLIC_USER_FIELDS = "_id full_name username profile_picture";

// Hikayenin ne kadar süreyle görünür kalacağı (saat cinsinden)
const STORY_DURATION_HOURS = 24;

export const findStoryByOperation = async (userId, operationId) =>
  Story.findOne({ user: userId, operationId });

export const createStory = async (
  storyData,
  { quotaLimit = -1, reservationKeys = [] } = {}
) => {
  // expiresAt = oluşturma zamanı + 24 saat. Worker medya işini kuyruklayarak temizler.
  const expiresAt = new Date(Date.now() + STORY_DURATION_HOURS * 60 * 60 * 1000);
  if (storyData.operationId) {
    const existing = await findStoryByOperation(
      storyData.user,
      storyData.operationId
    );
    if (existing) return existing;
  }

  const session = await mongoose.startSession();
  let story = null;
  try {
    try {
      await session.withTransaction(async () => {
        if (quotaLimit !== -1) {
          const now = new Date();
          const dayStart = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
          const reserved = await quotaService.reserveQuota({
            userId: storyData.user,
            bucket: quotaService.dailyBucket("stories", now),
            limit: quotaLimit,
            getCurrentCount: () =>
              Story.countDocuments({
                user: storyData.user,
                createdAt: { $gte: dayStart },
              }).session(session),
            session,
            expiresAt: quotaService.shortLivedUsageExpiry(now),
          });
          if (!reserved) {
            throw Object.assign(
              new Error(`Daily story limit reached (${quotaLimit})`),
              { status: 403 }
            );
          }
        }
        [story] = await Story.create(
          [{ ...storyData, expiresAt }],
          { session }
        );
        await commitReservedUploads(reservationKeys, {
          session,
          userId: storyData.user,
        });
      });
    } catch (error) {
      if (error?.code !== 11000 || !storyData.operationId) throw error;
      story = await findStoryByOperation(storyData.user, storyData.operationId);
      if (!story) throw error;
    }
    return story;
  } finally {
    await session.endSession();
  }
};

export const getStoriesForUser = async (userId, pagination) => {
  const [followingDocs, connectionsDocs] = await Promise.all([
    UserFollow.find({ followerId: userId }).select("followeeId").lean(),
    Connection.find({
      $or: [{ from_user_id: userId }, { to_user_id: userId }],
      status: "accepted"
    }).lean()
  ]);

  const followeeIds = followingDocs.map(doc => doc.followeeId);
  const connectionUserIds = connectionsDocs.map(c => 
    c.from_user_id === userId ? c.to_user_id : c.from_user_id
  );

  const now = new Date();
  const userIds = [userId, ...followeeIds, ...connectionUserIds];
  
  // Worker gecikse bile sadece aktif story'leri döndür.
  const documents = await Story.find({
    user: { $in: userIds },
    expiresAt: { $gt: now },
    ...cursorFilter(pagination.cursor, "createdAt"),
  })
    .populate("user", PUBLIC_USER_FIELDS)
    .sort({ createdAt: -1, _id: -1 })
    .limit(pagination.limit + 1);
  return pageFromDocuments(documents, pagination.limit, "createdAt");
};

export const getStoryById = async (storyId) => {
  return await Story.findById(storyId).select("+media_key");
};

export const deleteStoryById = async (story) => {
  const key = story.media_key || extractS3Key(story.media_url);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (key) await queueMediaDeletions([key], { session });
      await StoryView.deleteMany({ storyId: story._id }, { session });
      await Story.deleteOne({ _id: story._id }, { session });
    });
  } finally {
    await session.endSession();
  }
};
