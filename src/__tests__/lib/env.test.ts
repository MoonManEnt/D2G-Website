import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";

// =============================================================================
// We need to test env.ts but it validates process.env at module load time,
// so we must carefully control the module loading.
// =============================================================================

describe("Environment Validation (env.ts)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules so env.ts re-validates on each import
    jest.resetModules();
    // Clone the environment (use Object.assign to bypass readonly NODE_ENV)
    process.env = Object.assign({}, originalEnv);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("validateEnv() / getEnv()", () => {
    it("works with all valid required env vars", () => {
      process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
      process.env.NEXTAUTH_SECRET = "a".repeat(32);
      process.env.NEXTAUTH_URL = "http://localhost:3000";
      (process.env as Record<string, string | undefined>).NODE_ENV ="test";

      const { getEnv } = require("@/lib/env");
      const env = getEnv();

      expect(env.DATABASE_URL).toBe("postgresql://user:pass@localhost:5432/db");
      expect(env.NEXTAUTH_SECRET).toBe("a".repeat(32));
      expect(env.NEXTAUTH_URL).toBe("http://localhost:3000");
    });

    it("catches missing DATABASE_URL", () => {
      delete process.env.DATABASE_URL;
      process.env.NEXTAUTH_SECRET = "a".repeat(32);
      process.env.NEXTAUTH_URL = "http://localhost:3000";
      (process.env as Record<string, string | undefined>).NODE_ENV ="test";

      const { getEnv } = require("@/lib/env");
      expect(() => getEnv()).toThrow();
    });

    it("catches NEXTAUTH_SECRET shorter than 32 chars", () => {
      process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
      process.env.NEXTAUTH_SECRET = "short";
      process.env.NEXTAUTH_URL = "http://localhost:3000";
      (process.env as Record<string, string | undefined>).NODE_ENV ="test";

      const { getEnv } = require("@/lib/env");
      expect(() => getEnv()).toThrow();
    });

    it("catches invalid NEXTAUTH_URL (not a URL)", () => {
      process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
      process.env.NEXTAUTH_SECRET = "a".repeat(32);
      process.env.NEXTAUTH_URL = "not-a-url";
      (process.env as Record<string, string | undefined>).NODE_ENV ="test";

      const { getEnv } = require("@/lib/env");
      expect(() => getEnv()).toThrow();
    });

    it("defaults NODE_ENV to development", () => {
      process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
      process.env.NEXTAUTH_SECRET = "a".repeat(32);
      process.env.NEXTAUTH_URL = "http://localhost:3000";
      delete (process.env as Record<string, string | undefined>).NODE_ENV;

      const { getEnv } = require("@/lib/env");
      const env = getEnv();
      expect(env.NODE_ENV).toBe("development");
    });

    it("defaults STORAGE_PROVIDER to local", () => {
      process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
      process.env.NEXTAUTH_SECRET = "a".repeat(32);
      process.env.NEXTAUTH_URL = "http://localhost:3000";
      (process.env as Record<string, string | undefined>).NODE_ENV ="test";

      const { getEnv } = require("@/lib/env");
      const env = getEnv();
      expect(env.STORAGE_PROVIDER).toBe("local");
    });

    it("defaults AWS_REGION to us-east-1", () => {
      process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
      process.env.NEXTAUTH_SECRET = "a".repeat(32);
      process.env.NEXTAUTH_URL = "http://localhost:3000";
      (process.env as Record<string, string | undefined>).NODE_ENV ="test";

      const { getEnv } = require("@/lib/env");
      const env = getEnv();
      expect(env.AWS_REGION).toBe("us-east-1");
    });

    it("accepts optional env vars as undefined", () => {
      process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
      process.env.NEXTAUTH_SECRET = "a".repeat(32);
      process.env.NEXTAUTH_URL = "http://localhost:3000";
      (process.env as Record<string, string | undefined>).NODE_ENV ="test";

      const { getEnv } = require("@/lib/env");
      const env = getEnv();

      // Optional vars should be undefined
      expect(env.STRIPE_SECRET_KEY).toBeUndefined();
      expect(env.RESEND_API_KEY).toBeUndefined();
      expect(env.ANTHROPIC_API_KEY).toBeUndefined();
      expect(env.TWILIO_ACCOUNT_SID).toBeUndefined();
    });

    it("caches env after first call (lazy validation)", () => {
      process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
      process.env.NEXTAUTH_SECRET = "a".repeat(32);
      process.env.NEXTAUTH_URL = "http://localhost:3000";
      (process.env as Record<string, string | undefined>).NODE_ENV ="test";

      const { getEnv } = require("@/lib/env");
      const env1 = getEnv();
      const env2 = getEnv();

      // Should be the same reference (cached)
      expect(env1).toBe(env2);
    });
  });

  describe("isFeatureEnabled()", () => {
    beforeEach(() => {
      process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
      process.env.NEXTAUTH_SECRET = "a".repeat(32);
      process.env.NEXTAUTH_URL = "http://localhost:3000";
      (process.env as Record<string, string | undefined>).NODE_ENV ="test";
    });

    it("email is disabled without RESEND_API_KEY", () => {
      delete process.env.RESEND_API_KEY;
      const { isFeatureEnabled } = require("@/lib/env");
      expect(isFeatureEnabled("email")).toBe(false);
    });

    it("email is enabled with RESEND_API_KEY", () => {
      process.env.RESEND_API_KEY = "re_test_123";
      const { isFeatureEnabled } = require("@/lib/env");
      expect(isFeatureEnabled("email")).toBe(true);
    });

    it("sms is disabled without all three Twilio vars", () => {
      process.env.TWILIO_ACCOUNT_SID = "AC123";
      // Missing TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER
      const { isFeatureEnabled } = require("@/lib/env");
      expect(isFeatureEnabled("sms")).toBe(false);
    });

    it("sms is enabled with all Twilio vars", () => {
      process.env.TWILIO_ACCOUNT_SID = "AC123";
      process.env.TWILIO_AUTH_TOKEN = "token123";
      process.env.TWILIO_PHONE_NUMBER = "+15551234567";
      const { isFeatureEnabled } = require("@/lib/env");
      expect(isFeatureEnabled("sms")).toBe(true);
    });

    it("ai is disabled without any AI keys", () => {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;
      const { isFeatureEnabled } = require("@/lib/env");
      expect(isFeatureEnabled("ai")).toBe(false);
    });

    it("ai is enabled with ANTHROPIC_API_KEY", () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-test";
      const { isFeatureEnabled } = require("@/lib/env");
      expect(isFeatureEnabled("ai")).toBe(true);
    });

    it("ai is enabled with OPENAI_API_KEY", () => {
      process.env.OPENAI_API_KEY = "sk-test";
      const { isFeatureEnabled } = require("@/lib/env");
      expect(isFeatureEnabled("ai")).toBe(true);
    });

    it("stripe is disabled without STRIPE_SECRET_KEY", () => {
      delete process.env.STRIPE_SECRET_KEY;
      const { isFeatureEnabled } = require("@/lib/env");
      expect(isFeatureEnabled("stripe")).toBe(false);
    });

    it("stripe is enabled with STRIPE_SECRET_KEY", () => {
      process.env.STRIPE_SECRET_KEY = "sk_test_123";
      const { isFeatureEnabled } = require("@/lib/env");
      expect(isFeatureEnabled("stripe")).toBe(true);
    });

    it("cloud-storage is disabled when STORAGE_PROVIDER is local", () => {
      process.env.STORAGE_PROVIDER = "local";
      const { isFeatureEnabled } = require("@/lib/env");
      expect(isFeatureEnabled("cloud-storage")).toBe(false);
    });

    it("cloud-storage is enabled when STORAGE_PROVIDER is s3", () => {
      process.env.STORAGE_PROVIDER = "s3";
      const { isFeatureEnabled } = require("@/lib/env");
      expect(isFeatureEnabled("cloud-storage")).toBe(true);
    });

    it("cloud-storage is enabled when STORAGE_PROVIDER is r2", () => {
      process.env.STORAGE_PROVIDER = "r2";
      const { isFeatureEnabled } = require("@/lib/env");
      expect(isFeatureEnabled("cloud-storage")).toBe(true);
    });
  });

  describe("requireEnv()", () => {
    beforeEach(() => {
      process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
      process.env.NEXTAUTH_SECRET = "a".repeat(32);
      process.env.NEXTAUTH_URL = "http://localhost:3000";
      (process.env as Record<string, string | undefined>).NODE_ENV ="test";
    });

    it("returns env var value when present", () => {
      process.env.STRIPE_SECRET_KEY = "sk_test_abc";
      const { requireEnv } = require("@/lib/env");
      expect(requireEnv("STRIPE_SECRET_KEY")).toBe("sk_test_abc");
    });

    it("returns default value when env var is missing", () => {
      delete process.env.STRIPE_SECRET_KEY;
      const { requireEnv } = require("@/lib/env");
      expect(requireEnv("STRIPE_SECRET_KEY", "default_value")).toBe("default_value");
    });

    it("returns empty string when env var missing and no default in non-production", () => {
      delete process.env.REDIS_URL;
      const { requireEnv } = require("@/lib/env");
      expect(requireEnv("REDIS_URL")).toBe("");
    });

    it("throws in production when required var is missing and no default", () => {
      (process.env as Record<string, string | undefined>).NODE_ENV ="production";
      process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
      process.env.NEXTAUTH_SECRET = "a".repeat(32);
      process.env.NEXTAUTH_URL = "http://localhost:3000";
      delete process.env.REDIS_URL;

      // requireEnv checks process.env.NODE_ENV directly
      const { requireEnv } = require("@/lib/env");
      expect(() => requireEnv("REDIS_URL")).toThrow("Missing required environment variable");
    });
  });
});
