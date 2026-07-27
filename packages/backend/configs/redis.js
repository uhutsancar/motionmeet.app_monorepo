import { createClient } from "redis";
import { RedisStore } from "rate-limit-redis";

const redisUrl = process.env.REDIS_URL?.trim();
const redisClient = redisUrl
  ? createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 250, 5000),
      },
    })
  : null;
let redisPublisher = null;
let redisSubscriber = null;
const localLimits = new Map();

if (redisClient) {
  redisClient.on("error", (error) => {
    console.error("Redis client error:", error.message);
  });
  try {
    await redisClient.connect();
  } catch (error) {
    console.error("Initial Redis connection failed:", error.message);
  }
}

export const initializeRedis = async () => {
  if (!redisClient) return null;
  if (!redisClient.isOpen) await redisClient.connect();

  redisPublisher = redisClient.duplicate();
  redisSubscriber = redisClient.duplicate();
  redisPublisher.on("error", (error) =>
    console.error("Redis publisher error:", error.message)
  );
  redisSubscriber.on("error", (error) =>
    console.error("Redis subscriber error:", error.message)
  );
  await Promise.all([redisPublisher.connect(), redisSubscriber.connect()]);

  return {
    client: redisClient,
    publisher: redisPublisher,
    subscriber: redisSubscriber,
  };
};

export const createRateLimitStore = (prefix) => {
  if (!redisClient || !redisClient.isOpen) return undefined; // Falls back to MemoryStore
  return new RedisStore({
    prefix: `motionmeet:rate-limit:${prefix}:`,
    sendCommand: (...args) => redisClient.sendCommand(args),
  });
};

export const runWithRedisLock = async (name, ttlSeconds, task) => {
  if (!redisClient?.isReady) {
    if (process.env.NODE_ENV === "production") return false;
    await task();
    return true;
  }

  const key = `motionmeet:lock:${name}`;
  const value = `${process.pid}:${Date.now()}`;
  const acquired = await redisClient.set(key, value, {
    EX: ttlSeconds,
    NX: true,
  });
  if (acquired !== "OK") return false;

  try {
    await task();
    return true;
  } finally {
    await redisClient.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      { keys: [key], arguments: [value] }
    );
  }
};

export const isRedisReady = () => Boolean(redisClient?.isReady);

export const getRedisStatus = () => {
  if (!redisClient) return "disabled";
  return redisClient.isReady ? "ready" : "not-ready";
};

export const consumeDistributedLimit = async (
  key,
  limit,
  windowSeconds
) => {
  if (!redisClient?.isReady) {
    const now = Date.now();
    const existing = localLimits.get(key);
    const entry =
      !existing || existing.expiresAt <= now
        ? { count: 0, expiresAt: now + windowSeconds * 1000 }
        : existing;
    entry.count += 1;
    localLimits.set(key, entry);
    return entry.count <= limit;
  }
  const count = await redisClient.eval(
    "local current = redis.call('incr', KEYS[1]); if current == 1 then redis.call('expire', KEYS[1], ARGV[1]) end; return current",
    {
      keys: [`motionmeet:socket-limit:${key}`],
      arguments: [String(windowSeconds)],
    }
  );
  return Number(count) <= limit;
};

export const disconnectRedis = async () => {
  const clients = [redisSubscriber, redisPublisher, redisClient].filter(
    (client) => client?.isOpen
  );
  await Promise.allSettled(clients.map((client) => client.quit()));
};

/**
 * DBA Optimization: Buffer count increments in Redis to avoid MongoDB hot document lock contention.
 * Example key: motionmeet:buffer:like:post123
 */
export const bufferCountIncrement = async (type, id, value = 1) => {
  if (!redisClient?.isReady) return false;
  try {
    await redisClient.hIncrBy(`motionmeet:buffer:${type}`, id, value);
    return true;
  } catch (error) {
    console.error(`Redis buffer increment error (${type}:${id}):`, error.message);
    return false;
  }
};

/**
 * Returns buffered increments for a given type and resets the buffer.
 */
export const getAndClearBufferedIncrements = async (type) => {
  if (!redisClient?.isReady) return {};
  const key = `motionmeet:buffer:${type}`;
  try {
    // Pipeline: Get all fields and values, then delete the hash
    const [data] = await redisClient
      .multi()
      .hGetAll(key)
      .del(key)
      .exec();
    return data || {};
  } catch (error) {
    console.error(`Redis buffer clear error (${type}):`, error.message);
    return {};
  }
};
