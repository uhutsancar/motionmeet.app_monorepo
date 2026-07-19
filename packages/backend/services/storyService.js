import Story from "../models/Story.js";
import User from "../models/User.js";

const PUBLIC_USER_FIELDS = "_id full_name username profile_picture";

export const createStory = async (storyData) => {
  return await Story.create(storyData);
};

export const getStoriesForUser = async (userId) => {
  const user = await User.findById(userId).select("connections following");
  if (!user) return null;

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const userIds = [userId, ...user.connections, ...user.following];
  
  return await Story.find({
    user: { $in: userIds },
    createdAt: { $gte: cutoff },
  })
    .populate("user", PUBLIC_USER_FIELDS)
    .sort({ createdAt: -1 });
};

export const getStoryById = async (storyId) => {
  return await Story.findById(storyId);
};

export const deleteStoryById = async (story) => {
  await story.deleteOne();
};
