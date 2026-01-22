import { PrismaClient } from "@prisma/client";
import path from "path";
import fs from "fs";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const isDev = process.env.NODE_ENV === "development";
let dbUrl = process.env.DATABASE_URL;

// Force absolute path in development to avoid common Next.js/Prisma path resolution issues
if (isDev) {
  const rootDir = process.cwd();
  const absoluteDbPath = path.resolve(rootDir, "prisma/dev.db");

  if (fs.existsSync(absoluteDbPath)) {
    // If the env var is missing or not a file protocol, force use the detected absolute path
    if (!dbUrl || !dbUrl.startsWith("file:")) {
      dbUrl = `file:${absoluteDbPath}`;
    }
  } else {
    // Fallback if the file isn't in prisma/ (e.g. it was moved to root)
    const rootDbPath = path.resolve(rootDir, "dev.db");
    if (fs.existsSync(rootDbPath)) {
      dbUrl = `file:${rootDbPath}`;
    }
  }
}

// Fallback to the standard absolute path if all else fails
if (!dbUrl || !dbUrl.startsWith("file:")) {
  dbUrl = "file:/Users/reginaldsmith/Dispute2Go-1/prisma/dev.db";
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
