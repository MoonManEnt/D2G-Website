import Redis from "ioredis";

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
    console.warn("Redis not configured, using in-memory fallback");
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
      console.log("Redis connected");
    });

    client.on("error", (err) => {
      console.error("Redis error:", err.message);
      isConnected = false;
    });

    client.on("close", () => {
      isConnected = false;
    });

    return client;
  } catch (error) {
    console.error("Failed to create Redis client:", error);
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
      console.error("Redis get error:", error);
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
      console.error("Redis set error:", error);
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
      console.error("Redis del error:", error);
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
      console.error("Redis rate limit error:", error);
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
      console.error("Redis publish error:", error);
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
      console.error("Redis lpush error:", error);
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
      console.error("Redis rpop error:", error);
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

// Export types
export type { Redis };
