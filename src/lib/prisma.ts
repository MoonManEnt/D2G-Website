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

// Production: Append connection pool params for PostgreSQL if not already set
if (!isDev && dbUrl && dbUrl.startsWith("postgres")) {
  const url = new URL(dbUrl);
  if (!url.searchParams.has("connection_limit")) {
    url.searchParams.set("connection_limit", "25");
  }
  if (!url.searchParams.has("pool_timeout")) {
    url.searchParams.set("pool_timeout", "10");
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

if (isDev) {
  globalForPrisma.prisma = prisma;
}

export default prisma;
