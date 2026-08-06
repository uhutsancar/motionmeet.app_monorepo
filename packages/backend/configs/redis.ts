import { createClient, type RedisClientType } from "redis";
import { RedisStore } from "rate-limit-redis";
import { MemoryStore, type Options as RateLimitOptions, type Store } from "express-rate-limit";
import { loadEnvironment } from "./environment.js";
import { logger, safeErrorMetadata } from "../utils/logger.js";

type Client = RedisClientType;
interface LocalLimit { count: number; expiresAt: number }

let redisClient: Client | null = null;
let redisPublisher: Client | null = null;
let redisSubscriber: Client | null = null;
let redisInitialization: Promise<{ client: Client; publisher: Client; subscriber: Client } | null> | null = null;
let redisReachedReady = false;
const localLimits = new Map<string, LocalLimit>();

/**
 * Startup waits for the first connection attempt, so an unreachable Redis must
 * fail fast instead of retrying while the HTTP server is still not listening.
 * Once a connection has succeeded the client keeps retrying indefinitely, which
 * is what a running deployment needs to survive a Redis restart.
 */
const INITIAL_CONNECT_ATTEMPTS = 2;
const CONNECT_TIMEOUT_MS = 2_000;

const reconnectStrategy = (retries: number): number | Error => {
  if (!redisReachedReady && retries >= INITIAL_CONNECT_ATTEMPTS) {
    return new Error("Redis is unreachable; continuing without it");
  }
  return Math.min((retries + 1) * 250, 5_000);
};

const configure = (client: Client, label: string): void => {
  client.on("error", (error: Error) => {
    if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|timeout|closed|unreachable/i.test(error.message)) return;
    logger.error("redis_client_error", { client: label, ...safeErrorMetadata(error) });
  });
  client.on("ready", () => {
    redisReachedReady = true;
  });
};

const baseClient = (): Client | null => {
  const url = loadEnvironment().redisUrl;
  if (!url) return null;
  if (!redisClient) {
    redisClient = createClient({
      url,
      socket: { connectTimeout: CONNECT_TIMEOUT_MS, reconnectStrategy },
    });
    configure(redisClient, "Redis client");
  }
  return redisClient;
};

export const initializeRedis = async (): Promise<{ client: Client; publisher: Client; subscriber: Client } | null> => {
  const client = baseClient();
  if (!client) return null;
  if (redisPublisher?.isReady && redisSubscriber?.isReady && client.isReady) return { client, publisher: redisPublisher, subscriber: redisSubscriber };
  if (!redisInitialization) {
    redisInitialization = (async () => {
      try {
        if (!client.isOpen) await client.connect();
        redisPublisher = client.duplicate();
        redisSubscriber = client.duplicate();
        configure(redisPublisher, "Redis publisher");
        configure(redisSubscriber, "Redis subscriber");
        await Promise.all([redisPublisher.connect(), redisSubscriber.connect()]);
        return { client, publisher: redisPublisher, subscriber: redisSubscriber };
      } catch (error: unknown) {
        logger.warn("redis_unavailable_postgresql_fallback", safeErrorMetadata(error));
        redisClient = null;
        redisPublisher = null;
        redisSubscriber = null;
        scheduleBackgroundRetry();
        return null;
      }
    })().finally(() => { redisInitialization = null; });
  }
  return redisInitialization;
};

/**
 * Startup no longer blocks on Redis, so a deployment that boots while Redis is
 * restarting has to pick it up afterwards instead of staying degraded until the
 * process is restarted.
 */
const RETRY_INTERVAL_MS = 30_000;
let retryTimer: ReturnType<typeof setInterval> | null = null;
const readyListeners = new Set<(clients: { client: Client; publisher: Client; subscriber: Client }) => void>();

const scheduleBackgroundRetry = (): void => {
  if (retryTimer || !loadEnvironment().redisUrl) return;
  retryTimer = setInterval(() => {
    void initializeRedis().then((clients) => {
      if (!clients) return;
      if (retryTimer) { clearInterval(retryTimer); retryTimer = null; }
      logger.info("redis_reconnected");
      for (const listener of readyListeners) listener(clients);
    });
  }, RETRY_INTERVAL_MS);
  retryTimer.unref();
};

/** Runs once when a late Redis connection succeeds. */
export const onRedisReady = (
  listener: (clients: { client: Client; publisher: Client; subscriber: Client }) => void,
): void => {
  readyListeners.add(listener);
};

export const getRedisClient = (): Client | null => redisClient?.isReady ? redisClient : null;

/**
 * Route modules are evaluated before Redis connects. A store selected at import
 * time would therefore remain process-local forever. This adapter selects the
 * shared Redis store at request time and keeps an isolated memory fallback for
 * development or short Redis outages.
 */
class AdaptiveRateLimitStore implements Store {
  readonly localKeys = false;
  readonly prefix: string;
  private readonly memoryStore = new MemoryStore();
  private options: RateLimitOptions | null = null;
  private redisStorePromise: Promise<RedisStore | null> | null = null;

  constructor(name: string) {
    this.prefix = `motionmeet:rate-limit:${name}:`;
  }

  init(options: RateLimitOptions): void {
    this.options = options;
    this.memoryStore.init(options);
  }

  private async sharedStore(): Promise<RedisStore | null> {
    if (!this.options || !getRedisClient()) return null;
    if (!this.redisStorePromise) {
      const options = this.options;
      this.redisStorePromise = (async () => {
        const store = new RedisStore({
          prefix: this.prefix,
          sendCommand: (...args: string[]) => {
            const client = getRedisClient();
            if (!client) throw new Error("Redis rate-limit store is unavailable");
            return client.sendCommand(args);
          },
        });
        await store.init(options);
        return store;
      })().catch(() => {
        logger.warn("rate_limit_redis_fallback", { store: this.prefix });
        this.redisStorePromise = null;
        return null;
      });
    }
    return this.redisStorePromise;
  }

  async increment(key: string) {
    const shared = await this.sharedStore();
    if (shared) {
      try { return await shared.increment(key); }
      catch { this.redisStorePromise = null; logger.warn("rate_limit_redis_fallback", { store: this.prefix }); }
    }
    return this.memoryStore.increment(key);
  }

  async decrement(key: string): Promise<void> {
    const shared = await this.sharedStore();
    await Promise.allSettled([this.memoryStore.decrement(key), shared?.decrement(key)]);
  }

  async resetKey(key: string): Promise<void> {
    const shared = await this.sharedStore();
    await Promise.allSettled([this.memoryStore.resetKey(key), shared?.resetKey(key)]);
  }

  async resetAll(): Promise<void> {
    await this.memoryStore.resetAll();
  }

  shutdown(): void {
    this.memoryStore.shutdown();
  }
}

export const createRateLimitStore = (prefix: string): Store => new AdaptiveRateLimitStore(prefix);

export const getCachedJson = async <T>(key: string): Promise<T | null> => {
  const client = getRedisClient();
  if (!client) return null;
  try { const raw = await client.get(`motionmeet:v1:${key}`); return raw ? JSON.parse(raw) as T : null; }
  catch { return null; }
};

export const setCachedJson = async (key: string, value: unknown, ttlSeconds: number): Promise<void> => {
  const client = getRedisClient();
  if (!client) return;
  try { await client.set(`motionmeet:v1:${key}`, JSON.stringify(value), { EX: ttlSeconds }); } catch { /* cache is optional */ }
};

export const invalidateCachePrefix = async (prefix: string): Promise<void> => {
  const client = getRedisClient();
  if (!client) return;
  try {
    let cursor = "0";
    do {
      const result = await client.scan(cursor, { MATCH: `motionmeet:v1:${prefix}*`, COUNT: 200 });
      cursor = result.cursor;
      if (result.keys.length) await client.del(result.keys);
    } while (cursor !== "0");
  } catch { /* cache is optional */ }
};

export const runWithRedisLock = async (name: string, ttlSeconds: number, task: () => Promise<void>): Promise<boolean> => {
  const client = getRedisClient();
  if (!client) { await task(); return true; }
  const key = `motionmeet:lock:${name}`;
  const value = `${process.pid}:${Date.now()}`;
  if (await client.set(key, value, { EX: ttlSeconds, NX: true }) !== "OK") return false;
  try { await task(); return true; }
  finally {
    try { await client.eval("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end", { keys: [key], arguments: [value] }); } catch { /* lock expires */ }
  }
};

export const isRedisReady = (): boolean => Boolean(redisClient?.isReady);
export const getRedisStatus = (): "disabled" | "ready" | "not-ready" => !loadEnvironment().redisUrl ? "disabled" : isRedisReady() ? "ready" : "not-ready";

export const consumeDistributedLimit = async (key: string, limit: number, windowSeconds: number): Promise<boolean> => {
  const client = getRedisClient();
  if (!client) {
    const now = Date.now();
    const current = localLimits.get(key);
    const entry = !current || current.expiresAt <= now ? { count: 0, expiresAt: now + windowSeconds * 1000 } : current;
    entry.count += 1;
    localLimits.set(key, entry);
    return entry.count <= limit;
  }
  const count = await client.eval("local current = redis.call('incr', KEYS[1]); if current == 1 then redis.call('expire', KEYS[1], ARGV[1]) end; return current", {
    keys: [`motionmeet:socket-limit:${key}`], arguments: [String(windowSeconds)],
  });
  return Number(count) <= limit;
};

export const disconnectRedis = async (): Promise<void> => {
  const clients = [redisSubscriber, redisPublisher, redisClient].filter((client): client is Client => Boolean(client?.isOpen));
  await Promise.allSettled(clients.map((client) => client.quit()));
  redisSubscriber = null; redisPublisher = null; redisClient = null;
};
