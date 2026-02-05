import Redis from "ioredis";
import { createLogger } from "./logger";
const log = createLogger("redis");

// Redis configuration
const REDIS_URL = process.env.REDIS_URL;
const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379");
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
const REDIS_DB = parseInt(process.env.REDIS_DB || "0");

// Create Redis client
let redis: Redis | null = null;
let isConnected = false;

function createRedisClient(): Redis | null {
  if (!REDIS_URL && !REDIS_HOST) {
    if (process.env.NODE_ENV === "production") {
      log.error("REDIS NOT CONFIGURED IN PRODUCTION - cache is per-instance only. Set REDIS_URL for shared caching.");
    }
    log.warn("Redis not configured, using in-memory fallback");
    return null;
  }

  try {
    const client = REDIS_URL
      ? new Redis(REDIS_URL, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => {
            if (times > 3) return null;
            return Math.min(times * 100, 3000);
          },
        })
      : new Redis({
          host: REDIS_HOST,
          port: REDIS_PORT,
          password: REDIS_PASSWORD || undefined,
          db: REDIS_DB,
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => {
            if (times > 3) return null;
            return Math.min(times * 100, 3000);
          },
        });

    client.on("connect", () => {
      isConnected = true;
      log.info("Redis connected");
    });

    client.on("error", (err) => {
      log.error({ err }, "Redis error");
      isConnected = false;
    });

    client.on("close", () => {
      isConnected = false;
    });

    return client;
  } catch (error) {
    log.error({ err: error }, "Failed to create Redis client");
    return null;
  }
}

// Get or create Redis client (singleton)
export function getRedis(): Redis | null {
  if (!redis) {
    redis = createRedisClient();
  }
  return redis;
}

// Check if Redis is available
export function isRedisAvailable(): boolean {
  return isConnected && redis !== null;
}

// In-memory fallback store
const memoryStore = new Map<string, { value: string; expiry?: number }>();

// Clean up expired items periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of memoryStore.entries()) {
    if (item.expiry && item.expiry < now) {
      memoryStore.delete(key);
    }
  }
}, 60000); // Every minute

/**
 * Get a value from Redis or memory fallback
 */
export async function cacheGet(key: string): Promise<string | null> {
  const client = getRedis();

  if (client && isConnected) {
    try {
      return await client.get(key);
    } catch (error) {
      log.error({ err: error }, "Redis get error");
    }
  }

  // Fallback to memory
  const item = memoryStore.get(key);
  if (!item) return null;
  if (item.expiry && item.expiry < Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return item.value;
}

/**
 * Set a value in Redis or memory fallback
 */
export async function cacheSet(
  key: string,
  value: string,
  expirySeconds?: number
): Promise<void> {
  const client = getRedis();

  if (client && isConnected) {
    try {
      if (expirySeconds) {
        await client.setex(key, expirySeconds, value);
      } else {
        await client.set(key, value);
      }
      return;
    } catch (error) {
      log.error({ err: error }, "Redis set error");
    }
  }

  // Fallback to memory
  memoryStore.set(key, {
    value,
    expiry: expirySeconds ? Date.now() + expirySeconds * 1000 : undefined,
  });
}

/**
 * Delete a key from Redis or memory fallback
 */
export async function cacheDel(key: string): Promise<void> {
  const client = getRedis();

  if (client && isConnected) {
    try {
      await client.del(key);
      return;
    } catch (error) {
      log.error({ err: error }, "Redis del error");
    }
  }

  // Fallback to memory
  memoryStore.delete(key);
}

/**
 * Increment a counter with expiry (for rate limiting)
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ success: boolean; remaining: number; resetAt: number }> {
  const client = getRedis();
  const now = Date.now();
  const resetAt = now + windowSeconds * 1000;

  if (client && isConnected) {
    try {
      const multi = client.multi();
      multi.incr(key);
      multi.expire(key, windowSeconds);
      const results = await multi.exec();

      const count = results?.[0]?.[1] as number || 1;
      const remaining = Math.max(0, limit - count);

      return {
        success: count <= limit,
        remaining,
        resetAt,
      };
    } catch (error) {
      log.error({ err: error }, "Redis rate limit error");
    }
  }

  // Fallback to memory-based rate limiting
  const rateLimitKey = `ratelimit:${key}`;
  const item = memoryStore.get(rateLimitKey);

  if (!item || (item.expiry && item.expiry < now)) {
    // First request in window
    memoryStore.set(rateLimitKey, {
      value: "1",
      expiry: resetAt,
    });
    return { success: true, remaining: limit - 1, resetAt };
  }

  const count = parseInt(item.value) + 1;
  memoryStore.set(rateLimitKey, {
    value: count.toString(),
    expiry: item.expiry,
  });

  return {
    success: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt: item.expiry || resetAt,
  };
}

/**
 * Store a session in Redis
 */
export async function setSession(
  sessionId: string,
  data: Record<string, unknown>,
  expirySeconds: number = 86400 // 24 hours
): Promise<void> {
  const key = `session:${sessionId}`;
  await cacheSet(key, JSON.stringify(data), expirySeconds);
}

/**
 * Get a session from Redis
 */
export async function getSession(
  sessionId: string
): Promise<Record<string, unknown> | null> {
  const key = `session:${sessionId}`;
  const data = await cacheGet(key);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Delete a session from Redis
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const key = `session:${sessionId}`;
  await cacheDel(key);
}

/**
 * Simple pub/sub for real-time updates
 */
export async function publish(channel: string, message: string): Promise<void> {
  const client = getRedis();
  if (client && isConnected) {
    try {
      await client.publish(channel, message);
    } catch (error) {
      log.error({ err: error }, "Redis publish error");
    }
  }
}

/**
 * Add item to a list (for job queues)
 */
export async function listPush(
  key: string,
  ...values: string[]
): Promise<number> {
  const client = getRedis();

  if (client && isConnected) {
    try {
      return await client.rpush(key, ...values);
    } catch (error) {
      log.error({ err: error }, "Redis lpush error");
    }
  }

  // Fallback - not ideal for distributed systems
  const item = memoryStore.get(key);
  const list: string[] = item ? JSON.parse(item.value) : [];
  list.push(...values);
  memoryStore.set(key, { value: JSON.stringify(list) });
  return list.length;
}

/**
 * Pop item from a list (for job queues)
 */
export async function listPop(key: string): Promise<string | null> {
  const client = getRedis();

  if (client && isConnected) {
    try {
      return await client.lpop(key);
    } catch (error) {
      log.error({ err: error }, "Redis rpop error");
    }
  }

  // Fallback
  const item = memoryStore.get(key);
  if (!item) return null;
  const list: string[] = JSON.parse(item.value);
  const value = list.shift() || null;
  memoryStore.set(key, { value: JSON.stringify(list) });
  return value;
}

// Singleflight map: prevents thundering herd on cache miss
// When multiple requests miss the same cache key simultaneously,
// only one actually runs the fetch; the rest await the same promise.
const inflightRequests = new Map<string, Promise<string | null>>();

/**
 * Cache-aside with thundering herd protection.
 * On cache miss, only one caller runs `fetchFn`; others wait for the same result.
 */
export async function cacheGetOrSet(
  key: string,
  fetchFn: () => Promise<string>,
  expirySeconds: number
): Promise<string> {
  // Check cache first
  const cached = await cacheGet(key);
  if (cached !== null) return cached;

  // Check if another request is already fetching this key
  const inflight = inflightRequests.get(key);
  if (inflight) {
    const result = await inflight;
    return result ?? "";
  }

  // This request wins — fetch and populate cache
  const fetchPromise = (async () => {
    try {
      const value = await fetchFn();
      await cacheSet(key, value, expirySeconds);
      return value;
    } finally {
      inflightRequests.delete(key);
    }
  })();

  inflightRequests.set(key, fetchPromise);
  const result = await fetchPromise;
  return result ?? "";
}

/**
 * Delete all keys matching a prefix (for cache invalidation)
 */
export async function cacheDelPrefix(prefix: string): Promise<void> {
  const client = getRedis();

  if (client && isConnected) {
    try {
      let cursor = "0";
      do {
        const [nextCursor, keys] = await client.scan(
          cursor,
          "MATCH",
          `${prefix}*`,
          "COUNT",
          100
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await client.del(...keys);
        }
      } while (cursor !== "0");
      return;
    } catch (error) {
      log.error({ err: error }, "Redis delPrefix error");
    }
  }

  // Fallback to memory
  for (const key of memoryStore.keys()) {
    if (key.startsWith(prefix)) {
      memoryStore.delete(key);
    }
  }
}

// Export types
export type { Redis };
