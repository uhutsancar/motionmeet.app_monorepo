import { initializeRedis } from "../configs/redis.js";
import UserFollow from "../models/UserFollow.js";
import Connection from "../models/Connection.js";
import Post from "../models/Post.js";

// Lazy initialize the local redis client if needed for raw commands
let redisClient = null;
const ensureRedis = async () => {
  if (redisClient) return redisClient;
  const status = await initializeRedis();
  if (status) redisClient = status.client;
  return redisClient;
};

const TIMELINE_LIMIT = 500;

/**
 * Fan-out on write: Push a new post to the timelines of all followers and connections.
 * This completely avoids the IN-Sort problem (querying $in: [5000 ids]) on read.
 */
export const pushPostToTimelines = async (postId, authorId) => {
  const client = await ensureRedis();
  if (!client?.isReady) return false; // Fail silently if Redis is down (fallback to DB)

  try {
    // 1. Get all people who should see this post (Followers + Connections)
    const [followers, connections] = await Promise.all([
      UserFollow.find({ followeeId: authorId }).select("followerId").lean(),
      Connection.find({
        status: "accepted",
        $or: [{ from_user_id: authorId }, { to_user_id: authorId }]
      }).lean()
    ]);

    const followerIds = followers.map(f => f.followerId.toString());
    const connectionIds = connections.map(c => 
      c.from_user_id.toString() === authorId.toString() ? c.to_user_id.toString() : c.from_user_id.toString()
    );
    const targetUserIds = [...new Set([...followerIds, ...connectionIds])];

    if (targetUserIds.length === 0) return true;

    // 2. Pipeline the LPUSH operations to Redis
    const multi = client.multi();
    for (const targetId of targetUserIds) {
      const key = `motionmeet:timeline:${targetId}`;
      multi.lPush(key, postId.toString());
      multi.lTrim(key, 0, TIMELINE_LIMIT - 1); // Keep timeline to 500 max
    }
    
    await multi.exec();
    console.log(`Pushed post ${postId} to ${targetUserIds.length} timelines.`);
    return true;
  } catch (error) {
    console.error("Timeline push failed:", error.message);
    return false;
  }
};

/**
 * Fetch a user's timeline from Redis.
 */
export const getTimelinePosts = async (userId, page = 1, limit = 20) => {
  const client = await ensureRedis();
  if (!client?.isReady) return null;

  const key = `motionmeet:timeline:${userId}`;
  const start = (page - 1) * limit;
  const stop = start + limit - 1;

  try {
    // Get post IDs from Redis
    const postIds = await client.lRange(key, start, stop);
    if (!postIds || postIds.length === 0) return [];

    // Fetch actual posts from MongoDB (preserving Redis order)
    const posts = await Post.find({ _id: { $in: postIds } })
      .populate({ path: "workout", populate: { path: "exercises.exerciseId" } })
      .lean();

    // Reorder posts to match the Redis list order (newest first)
    const orderedPosts = postIds
      .map(id => posts.find(p => p._id.toString() === id))
      .filter(Boolean);

    return orderedPosts;
  } catch (error) {
    console.error("Timeline fetch failed:", error.message);
    return null;
  }
};
