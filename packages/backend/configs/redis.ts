import { createClient, type RedisClientType } from "redis";
import { RedisStore } from "rate-limit-redis";
import { loadEnvironment } from "./environment.js";

type Client = RedisClientType;
interface LocalLimit { count: number; expiresAt: number }

let redisClient: Client | null = null;
let redisPublisher: Client | null = null;
let redisSubscriber: Client | null = null;
let redisInitialization: Promise<{ client: Client; publisher: Client; subscriber: Client } | null> | null = null;
const localLimits = new Map<string, LocalLimit>();

const configure = (client: Client, label: string): void => {
  client.on("error", (error: Error) => {
    if (/ECONNREFUSED|timeout|closed/i.test(error.message)) return;
    console.error(`${label} error:`, error.message);
  });
};

const baseClient = (): Client | null => {
  const url = loadEnvironment().redisUrl;
  if (!url) return null;
  if (!redisClient) {
    redisClient = createClient({ url, socket: { reconnectStrategy: (retries: number) => Math.min(retries * 250, 5_000) } });
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
        const message = error instanceof Error ? error.message : "unknown Redis error";
        console.warn(`Redis unavailable; PostgreSQL fallback remains active: ${message}`);
        return null;
      }
    })().finally(() => { redisInitialization = null; });
  }
  return redisInitialization;
};

export const getRedisClient = (): Client | null => redisClient?.isReady ? redisClient : null;
export const createRateLimitStore = (prefix: string): RedisStore | undefined => {
  const client = getRedisClient();
  return client ? new RedisStore({ prefix: `motionmeet:rate-limit:${prefix}:`, sendCommand: (...args: string[]) => client.sendCommand(args) }) : undefined;
};

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
