import type { RedisClientType } from "redis";
import { RedisStore } from "rate-limit-redis";
import { MemoryStore, type Options as RateLimitOptions, type Store } from "express-rate-limit";
import { loadEnvironment } from "./environment.js";
import { logger, safeErrorMetadata } from "../utils/logger.js";

type Client = RedisClientType;
interface Clients { client: Client; publisher: Client; subscriber: Client }
interface LocalLimit { count: number; expiresAt: number }

/**
 * `redis` is the heaviest import in the process: it pulls the bloom, json,
 * search and time-series command sets in on top of the client, none of which
 * this application uses. Boot no longer waits for a connection, so paying that
 * cost at import time would delay the port opening for a dependency every
 * caller already treats as optional. It is loaded on the first connection
 * attempt instead, off the critical path.
 */
let createClientFn: typeof import("redis").createClient | null = null;
const loadCreateClient = async (): Promise<typeof import("redis").createClient> => {
  if (!createClientFn) ({ createClient: createClientFn } = await import("redis"));
  return createClientFn;
};

let redisClient: Client | null = null;
let redisPublisher: Client | null = null;
let redisSubscriber: Client | null = null;
let redisInitialization: Promise<{ client: Client; publisher: Client; subscriber: Client } | null> | null = null;
let redisReachedReady = false;
const localLimits = new Map<string, LocalLimit>();
const LOCAL_LIMIT_SWEEP_SIZE = 1_000;

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

const baseClient = async (): Promise<Client | null> => {
  const url = loadEnvironment().redisUrl;
  if (!url) return null;
  if (!redisClient) {
    const createClient = await loadCreateClient();
    redisClient = createClient({
      url,
      socket: { connectTimeout: CONNECT_TIMEOUT_MS, reconnectStrategy },
    }) as Client;
    configure(redisClient, "Redis client");
  }
  return redisClient;
};

export const initializeRedis = async (): Promise<Clients | null> => {
  const client = await baseClient();
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
        const clients: Clients = { client, publisher: redisPublisher, subscriber: redisSubscriber };
        announceReady(clients);
        return clients;
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
let readyClients: Clients | null = null;
const readyListeners = new Set<(clients: Clients) => void>();

/**
 * Fires for the first successful connection as well as for a later retry.
 * Announcing only on retry was survivable while boot awaited Redis, because a
 * first-attempt success was already in hand by the time anything subscribed.
 * Now that boot does not wait, the first attempt is the usual winner, and a
 * silent one would leave the socket adapter in memory for the whole process.
 */
const announceReady = (clients: Clients): void => {
  readyClients = clients;
  if (retryTimer) { clearInterval(retryTimer); retryTimer = null; }
  const listeners = [...readyListeners];
  readyListeners.clear();
  for (const listener of listeners) listener(clients);
};

const scheduleBackgroundRetry = (): void => {
  if (retryTimer || !loadEnvironment().redisUrl) return;
  retryTimer = setInterval(() => {
    void initializeRedis().then((clients) => {
      if (clients) logger.info("redis_reconnected");
    });
  }, RETRY_INTERVAL_MS);
  retryTimer.unref();
};

/**
 * Runs once when Redis becomes usable. The connection can win the race against
 * the caller subscribing, so a listener registered after the fact still has to
 * run rather than wait for an event that already happened.
 */
export const onRedisReady = (listener: (clients: Clients) => void): void => {
  if (readyClients) { listener(readyClients); return; }
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

const CACHE_PREFIX = "motionmeet:v1:";

export const getCachedJson = async <T>(key: string): Promise<T | null> => {
  const client = getRedisClient();
  if (!client) return null;
  try { const raw = await client.get(`${CACHE_PREFIX}${key}`); return raw ? JSON.parse(raw) as T : null; }
  catch { return null; }
};

export const setCachedJson = async (key: string, value: unknown, ttlSeconds: number): Promise<void> => {
  const client = getRedisClient();
  if (!client) return;
  try { await client.set(`${CACHE_PREFIX}${key}`, JSON.stringify(value), { EX: ttlSeconds }); } catch { /* cache is optional */ }
};

/**
 * Owner-addressed cache.
 *
 * Everything that used to be invalidated by prefix now lives as a field inside
 * one hash per owner - one member's feed, one profile, one member's exercise
 * list. Dropping it is a single `DEL`, which is what makes a write cheap.
 *
 * The prefix scan this replaced was neither: Redis applies `MATCH` *after*
 * walking a key, so every `SCAN ... MATCH feed:*` toured the entire keyspace,
 * and it ran on nine hot write paths - every like, comment, post, follow and
 * profile update in the system. A like storm on one post therefore swept every
 * member's cached feed and sent all of them back to PostgreSQL at once.
 *
 * `maxFields` keeps one owner from accumulating a cursor's worth of fields
 * faster than the TTL clears them; past the cap the hash is rebuilt rather than
 * grown.
 */
const ownerKey = (owner: string): string => `${CACHE_PREFIX}${owner}`;

export const getCachedField = async <T>(owner: string, field: string): Promise<T | null> => {
  const client = getRedisClient();
  if (!client) return null;
  try { const raw = await client.hGet(ownerKey(owner), field); return raw ? JSON.parse(raw) as T : null; }
  catch { return null; }
};

export const setCachedField = async (owner: string, field: string, value: unknown, ttlSeconds: number, maxFields = 64): Promise<void> => {
  const client = getRedisClient();
  if (!client) return;
  const key = ownerKey(owner);
  try {
    if (await client.hLen(key) >= maxFields) await client.del(key);
    await client.multi().hSet(key, field, JSON.stringify(value)).expire(key, ttlSeconds).exec();
  } catch { /* cache is optional */ }
};

/** O(1) invalidation: one `DEL` per owner, no keyspace walk. */
export const invalidateCacheOwners = async (...owners: string[]): Promise<void> => {
  const client = getRedisClient();
  if (!client || !owners.length) return;
  try { await client.del(owners.map(ownerKey)); } catch { /* cache is optional */ }
};

/**
 * Remembers that a piece of work has already been done, so a repeat of it can
 * be skipped rather than redone to the same effect.
 *
 * Without Redis `wasDone` is always false, so the caller falls through to
 * whatever durable guard it already has (a unique index, an `ON CONFLICT DO
 * NOTHING`). This is an optimisation, never the thing that makes an operation
 * correct.
 */
export const wasDone = async (key: string): Promise<boolean> => {
  const client = getRedisClient();
  if (!client) return false;
  try { return Boolean(await client.exists(`${CACHE_PREFIX}done:${key}`)); }
  catch { return false; }
};

export const markDone = async (key: string, ttlSeconds: number): Promise<void> => {
  const client = getRedisClient();
  if (!client) return;
  try { await client.set(`${CACHE_PREFIX}done:${key}`, "1", { EX: ttlSeconds }); } catch { /* cache is optional */ }
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
    // The fallback map has no expiry of its own, so an instance running without
    // Redis would otherwise hold one entry per key it has ever seen. Expired
    // entries are swept whenever the map grows past the sweep threshold.
    if (localLimits.size >= LOCAL_LIMIT_SWEEP_SIZE) {
      for (const [entryKey, entry] of localLimits) if (entry.expiresAt <= now) localLimits.delete(entryKey);
    }
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
  // Otherwise a subscriber registered after shutdown would be handed clients
  // that have already been quit.
  readyClients = null;
};
