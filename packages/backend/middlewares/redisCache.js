import { getRedisStatus, initializeRedis } from "../configs/redis.js";

let redisClient = null;
const ensureRedis = async () => {
  if (redisClient) return redisClient;
  const status = await initializeRedis();
  if (status) redisClient = status.client;
  return redisClient;
};

/**
 * Express middleware to cache GET requests in Redis.
 * Used for high-traffic endpoints like /workouts/:id
 * @param {number} ttlSeconds - Time to live in seconds
 */
export const redisCache = (ttlSeconds = 300) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    try {
      const client = await ensureRedis();
      if (!client?.isReady) {
        return next();
      }

      // Generate a unique cache key based on URL and user (if customized per user)
      // For global resources like public workouts, omit user ID.
      const cacheKey = `motionmeet:cache:${req.originalUrl}`;

      // Try to fetch from cache
      const cachedData = await client.get(cacheKey);
      if (cachedData) {
        return res.json(JSON.parse(cachedData));
      }

      // If not in cache, intercept the response to save it before sending
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        // Only cache successful responses
        if (body?.success !== false) {
          client.setEx(cacheKey, ttlSeconds, JSON.stringify(body)).catch((err) => {
            console.error("Redis Cache Set Error:", err.message);
          });
        }
        originalJson(body);
      };

      next();
    } catch (error) {
      console.error("Redis Cache Middleware Error:", error.message);
      next();
    }
  };
};

/**
 * Utility to invalidate cache for a specific key (e.g., after an update)
 */
export const invalidateCache = async (keyPattern) => {
  try {
    const client = await ensureRedis();
    if (!client?.isReady) return;
    
    // In production, you might want to use SCAN instead of KEYS
    const keys = await client.keys(`motionmeet:cache:${keyPattern}`);
    if (keys.length > 0) {
      await client.del(keys);
    }
  } catch (error) {
    console.error("Redis Cache Invalidation Error:", error.message);
  }
};
