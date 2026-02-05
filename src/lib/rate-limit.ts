// Rate limiter with Redis support and in-memory fallback

import { rateLimit as redisRateLimit, isRedisAvailable } from "./redis";
import { createLogger } from "./logger";
const log = createLogger("rate-limit");

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  interval: number; // Time window in milliseconds
  limit: number; // Max requests per interval
}

// In-memory store (fallback when Redis is unavailable)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

export const rateLimitConfigs = {
  // Standard API endpoints
  api: { interval: 60 * 1000, limit: 100 }, // 100 requests per minute

  // Auth endpoints (stricter)
  auth: { interval: 15 * 60 * 1000, limit: 10 }, // 10 attempts per 15 minutes

  // Password reset (very strict)
  passwordReset: { interval: 60 * 60 * 1000, limit: 3 }, // 3 attempts per hour

  // File uploads (moderate)
  upload: { interval: 60 * 1000, limit: 10 }, // 10 uploads per minute

  // LLM/AI endpoints (expensive)
  ai: { interval: 60 * 1000, limit: 20 }, // 20 AI requests per minute

  // Billing/webhook endpoints
  billing: { interval: 60 * 1000, limit: 50 }, // 50 requests per minute
} as const;

export type RateLimitType = keyof typeof rateLimitConfigs;

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

/**
 * Check if a request should be rate limited
 * Uses Redis when available, falls back to in-memory store
 * @param identifier - Unique identifier (IP address, user ID, etc.)
 * @param type - Type of rate limit to apply
 * @returns RateLimitResult with success status and headers
 */
export async function checkRateLimitAsync(
  identifier: string,
  type: RateLimitType = "api"
): Promise<RateLimitResult> {
  const config = rateLimitConfigs[type];
  const key = `ratelimit:${type}:${identifier}`;
  const windowSeconds = Math.ceil(config.interval / 1000);

  // Try Redis first
  if (isRedisAvailable()) {
    try {
      const result = await redisRateLimit(key, config.limit, windowSeconds);
      return {
        success: result.success,
        limit: config.limit,
        remaining: result.remaining,
        reset: result.resetAt,
        retryAfter: result.success ? undefined : Math.ceil((result.resetAt - Date.now()) / 1000),
      };
    } catch (error) {
      log.error({ err: error }, "Redis rate limit error, falling back to memory");
    }
  }

  // Fall back to in-memory rate limiting
  return checkRateLimitMemory(identifier, type);
}

/**
 * Synchronous rate limit check (uses in-memory only)
 * For backwards compatibility with existing code
 */
export function checkRateLimit(
  identifier: string,
  type: RateLimitType = "api"
): RateLimitResult {
  return checkRateLimitMemory(identifier, type);
}

/**
 * In-memory rate limit check
 */
function checkRateLimitMemory(
  identifier: string,
  type: RateLimitType
): RateLimitResult {
  const config = rateLimitConfigs[type];
  const key = `${type}:${identifier}`;
  const now = Date.now();

  let entry = rateLimitStore.get(key);

  // Create new entry if doesn't exist or has expired
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + config.interval,
    };
    rateLimitStore.set(key, entry);
  }

  const remaining = Math.max(0, config.limit - entry.count - 1);
  const reset = Math.ceil((entry.resetTime - now) / 1000);

  // Check if limit exceeded
  if (entry.count >= config.limit) {
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      reset: entry.resetTime,
      retryAfter: reset,
    };
  }

  // Increment counter
  entry.count++;

  return {
    success: true,
    limit: config.limit,
    remaining,
    reset: entry.resetTime,
  };
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.reset.toString(),
  };

  if (result.retryAfter) {
    headers["Retry-After"] = result.retryAfter.toString();
  }

  return headers;
}

/**
 * Create a rate-limited response
 */
export function rateLimitExceededResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: "Too many requests",
      message: `Rate limit exceeded. Please try again in ${result.retryAfter} seconds.`,
      retryAfter: result.retryAfter,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        ...getRateLimitHeaders(result),
      },
    }
  );
}

/**
 * Middleware helper to apply rate limiting to an API route
 */
export function withRateLimit(
  handler: (req: Request) => Promise<Response>,
  type: RateLimitType = "api"
) {
  return async (req: Request): Promise<Response> => {
    // Get identifier from IP or forwarded header
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";

    const result = await checkRateLimitAsync(ip, type);

    if (!result.success) {
      return rateLimitExceededResponse(result);
    }

    // Call the original handler and add rate limit headers
    const response = await handler(req);

    // Clone response to add headers
    const newHeaders = new Headers(response.headers);
    Object.entries(getRateLimitHeaders(result)).forEach(([key, value]) => {
      newHeaders.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  };
}

/**
 * Reset rate limit for an identifier (useful for testing or admin actions)
 */
export async function resetRateLimit(
  identifier: string,
  type: RateLimitType = "api"
): Promise<void> {
  const key = `${type}:${identifier}`;
  rateLimitStore.delete(key);

  // Also clear from Redis if available
  if (isRedisAvailable()) {
    const { cacheDel } = await import("./redis");
    await cacheDel(`ratelimit:${key}`);
  }
}
