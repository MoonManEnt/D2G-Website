import { PrismaClient } from "@prisma/client";
import path from "path";
import fs from "fs";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const isDev = process.env.NODE_ENV === "development";
let dbUrl = process.env.DATABASE_URL;

/**
 * PATH HARDENING LOGIC
 * Only active in development to solve local Next.js/Prisma path resolution issues.
 * In production (Vercel), we MUST use the environment variable provided by the cloud provider.
 */
if (isDev) {
  const rootDir = process.cwd();
  const absoluteDbPath = path.resolve(rootDir, "prisma/dev.db");

  if (fs.existsSync(absoluteDbPath)) {
    // If DATABASE_URL is missing or not an absolute file path, force it for local stability
    if (!dbUrl || !dbUrl.startsWith("file:")) {
      dbUrl = `file:${absoluteDbPath}`;
    }
  } else {
    // Check root as fallback
    const rootDbPath = path.resolve(rootDir, "dev.db");
    if (fs.existsSync(rootDbPath)) {
      dbUrl = `file:${rootDbPath}`;
    }
  }

  // Final local-only fallback to avoid "protocol file: required" errors
  if (!dbUrl || !dbUrl.startsWith("file:")) {
    dbUrl = "file:/Users/reginaldsmith/Dispute2Go-1/prisma/dev.db";
  }
}

// In production, if dbUrl is missing, we let Prisma throw its own error to help the user identify missing Vercel env vars.

/**
 * SERVERLESS CONNECTION POOLING
 * On Vercel, each function instance gets its own Prisma client.
 * With 50-100 instances at scale, we must keep per-instance connections LOW
 * to avoid overwhelming Neon's connection limit (100-300 with pgBouncer).
 *
 * Strategy: 5 connections per instance × 50 instances = 250 total (within Neon limits)
 * Use DIRECT_URL for migrations only; DATABASE_URL should point to Neon's pooler.
 */
if (!isDev && dbUrl && dbUrl.startsWith("postgres")) {
  const url = new URL(dbUrl);
  if (!url.searchParams.has("connection_limit")) {
    // Low per-instance limit: 5 connections × N instances stays under Neon pool ceiling
    url.searchParams.set("connection_limit", "5");
  }
  if (!url.searchParams.has("pool_timeout")) {
    // 15s timeout to handle Vercel cold starts gracefully
    url.searchParams.set("pool_timeout", "15");
  }
  if (!url.searchParams.has("connect_timeout")) {
    url.searchParams.set("connect_timeout", "15");
  }
  dbUrl = url.toString();
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isDev ? ["error", "warn"] : ["error"],
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  });

// Cache globally in all environments — Vercel reuses the global object within
// the same function instance, preventing duplicate PrismaClient allocations.
globalForPrisma.prisma = prisma;

export default prisma;
