import Story from "../models/Story.js";
import UserFollow from "../models/UserFollow.js";
import Connection from "../models/Connection.js";

const PUBLIC_USER_FIELDS = "_id full_name username profile_picture";

// Hikayenin ne kadar süreyle görünür kalacağı (saat cinsinden)
const STORY_DURATION_HOURS = 24;

export const createStory = async (storyData) => {
  // expiresAt = oluşturma zamanı + 24 saat
  // Bu alan Story TTL index tarafından izlenir; süresi dolduğunda MongoDB otomatik siler.
  const expiresAt = new Date(Date.now() + STORY_DURATION_HOURS * 60 * 60 * 1000);
  return await Story.create({ ...storyData, expiresAt });
};

export const getStoriesForUser = async (userId) => {
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
  
  // expiresAt > şu an: hem aktif story'leri hem de TTL index'le tutarlı filtreleme yapar
  return await Story.find({
    user: { $in: userIds },
    expiresAt: { $gt: now },
  })
    .populate("user", PUBLIC_USER_FIELDS)
    .sort({ createdAt: -1 });
};

export const getStoryById = async (storyId) => {
  return await Story.findById(storyId).select("+media_key");
};

export const deleteStoryById = async (story) => {
  await story.deleteOne();
};
