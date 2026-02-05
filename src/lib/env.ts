import { z } from "zod";
import { createLogger } from "./logger";
const log = createLogger("env");

/**
 * Environment variable schema with validation
 * This ensures all required env vars are set on startup
 */
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // NextAuth
  NEXTAUTH_SECRET: z.string().min(32, "NEXTAUTH_SECRET must be at least 32 characters"),
  NEXTAUTH_URL: z.string().url("NEXTAUTH_URL must be a valid URL"),

  // Stripe (optional in development)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),

  // Storage (optional - falls back to local)
  STORAGE_PROVIDER: z.enum(["local", "s3", "r2"]).default("local"),
  STORAGE_BUCKET: z.string().optional(),

  // AWS S3 (optional)
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default("us-east-1"),

  // Cloudflare R2 (optional)
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),

  // Email (optional)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),

  // AI/LLM (optional)
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  // Sentry (optional)
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),

  // Twilio SMS (optional)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),

  // Redis for background jobs (optional)
  REDIS_URL: z.string().optional(),

  // Vercel KV / Upstash (Rate Limiting)
  KV_REST_API_URL: z.string().optional(),
  KV_REST_API_TOKEN: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Vercel Blob (optional)
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  // Physical Mail (Lob)
  LOB_API_KEY: z.string().optional(),
  LOB_TEST_MODE: z.string().optional(), // "true" or "false"
  FEATURE_PHYSICAL_MAIL_ENABLED: z.string().default("false"),

  // App config
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  UPLOAD_DIR: z.string().optional(),

  // AI Config
  AI_ENABLE_AB_TESTING: z.string().default("false"),
  AI_FALLBACK_ENABLED: z.string().default("true"),
  AI_PRIMARY_PROVIDER: z.string().default("CLAUDE"),
  AI_PRIMARY_MODEL: z.string().default("claude-sonnet-4-20250514"),
  AI_TOKEN_BUDGET_MONTHLY: z.string().default("0"), // 0 = unlimited
  AI_LETTER_MAX_TOKENS: z.string().default("4096"),
  AI_CHAT_MAX_TOKENS: z.string().default("2048"),
});

// Type for validated environment
export type Env = z.infer<typeof envSchema>;

// Validate environment on module load
function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
        .join("\n");

      log.error("\n Invalid environment variables:\n\" + missingVars + \"\n");

      // In production, fail hard. In development, warn but continue
      if (process.env.NODE_ENV === "production") {
        throw new Error("Missing or invalid environment variables");
      }
    }
    throw error;
  }
}

// Export validated env (lazy validation)
let _env: Env | null = null;

export function getEnv(): Env {
  if (!_env) {
    _env = validateEnv();
  }
  return _env;
}

// Helper to check if a feature is configured
export function isFeatureEnabled(feature: "email" | "sms" | "ai" | "stripe" | "cloud-storage"): boolean {
  const env = getEnv();

  switch (feature) {
    case "email":
      return !!env.RESEND_API_KEY;
    case "sms":
      return !!env.TWILIO_ACCOUNT_SID && !!env.TWILIO_AUTH_TOKEN && !!env.TWILIO_PHONE_NUMBER;
    case "ai":
      return !!env.ANTHROPIC_API_KEY || !!env.OPENAI_API_KEY;
    case "stripe":
      return !!env.STRIPE_SECRET_KEY;
    case "cloud-storage":
      return env.STORAGE_PROVIDER !== "local";
    default:
      return false;
  }
}

// Helper to get required env var (throws in production if missing)
export function requireEnv(key: keyof Env, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;

  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value || "";
}
