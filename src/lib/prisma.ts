import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const isDev = process.env.NODE_ENV === "development";
let dbUrl = process.env.DATABASE_URL;

// Hardcode fallback for local development to ensure protocol is always present
if (isDev && (!dbUrl || !dbUrl.startsWith("file:"))) {
  console.log("🛠️ Dev Mode: Forcing DATABASE_URL to absolute sqlite path.");
  dbUrl = "file:/Users/reginaldsmith/Dispute2Go-1/prisma/dev.db";
}

if (!dbUrl) {
  console.error("❌ DATABASE_URL is not defined in process.env!");
} else if (!dbUrl.startsWith("file:")) {
  console.warn("⚠️ DATABASE_URL does not start with 'file:'. It is:", dbUrl);
} else {
  console.log("✅ DATABASE_URL detected:", dbUrl);
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isDev ? ["query", "error", "warn"] : ["error"],
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  });

if (isDev) {
  globalForPrisma.prisma = prisma;
  console.log("Prisma Initialized with URL:", dbUrl);
}

export default prisma;
