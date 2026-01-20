import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  checkRateLimit,
  getRateLimitHeaders,
  rateLimitConfigs,
} from "@/lib/rate-limit";

describe("Rate Limiting", () => {
  describe("checkRateLimit", () => {
    it("should allow requests under the limit", () => {
      const result = checkRateLimit("test-ip-1", "api");
      expect(result.success).toBe(true);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
    });

    it("should track remaining requests", () => {
      const ip = "test-ip-2";
      const first = checkRateLimit(ip, "api");
      const second = checkRateLimit(ip, "api");

      expect(first.remaining).toBeGreaterThan(second.remaining);
    });

    it("should respect different rate limits for different types", () => {
      expect(rateLimitConfigs.api.limit).toBeGreaterThan(rateLimitConfigs.auth.limit);
      expect(rateLimitConfigs.auth.interval).toBeGreaterThan(rateLimitConfigs.api.interval);
    });

    it("should block requests over the limit", () => {
      const ip = "test-ip-3";

      // Exhaust the auth limit (which is lower)
      for (let i = 0; i < rateLimitConfigs.auth.limit; i++) {
        checkRateLimit(ip, "auth");
      }

      const result = checkRateLimit(ip, "auth");
      expect(result.success).toBe(false);
      expect(result.retryAfter).toBeDefined();
    });
  });

  describe("getRateLimitHeaders", () => {
    it("should return correct headers", () => {
      const result = checkRateLimit("test-ip-headers", "api");
      const headers = getRateLimitHeaders(result);

      expect(headers["X-RateLimit-Limit"]).toBeDefined();
      expect(headers["X-RateLimit-Remaining"]).toBeDefined();
      expect(headers["X-RateLimit-Reset"]).toBeDefined();
    });

    it("should include Retry-After when rate limited", () => {
      const ip = "test-ip-retry";

      // Exhaust limit
      for (let i = 0; i < rateLimitConfigs.passwordReset.limit + 1; i++) {
        checkRateLimit(ip, "passwordReset");
      }

      const result = checkRateLimit(ip, "passwordReset");
      const headers = getRateLimitHeaders(result);

      expect(headers["Retry-After"]).toBeDefined();
    });
  });
});
