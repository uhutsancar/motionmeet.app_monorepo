import Story from "../models/Story.js";
import UserFollow from "../models/UserFollow.js";
import Connection from "../models/Connection.js";

const PUBLIC_USER_FIELDS = "_id full_name username profile_picture";

export const createStory = async (storyData) => {
  return await Story.create(storyData);
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

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const userIds = [userId, ...followeeIds, ...connectionUserIds];
  
  return await Story.find({
    user: { $in: userIds },
    createdAt: { $gte: cutoff },
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
