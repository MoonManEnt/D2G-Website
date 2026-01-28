import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const startTime = Date.now();
  const checks: Record<string, { status: "ok" | "error"; latency?: number; message?: string }> = {};

  // Check database connectivity
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: "ok", latency: Date.now() - dbStart };
  } catch (error) {
    checks.database = {
      status: "error",
      message: error instanceof Error ? error.message : "Database connection failed"
    };
  }

  // Check environment
  const requiredEnvVars = ["DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL"];
  const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);
  checks.environment = missingEnvVars.length === 0
    ? { status: "ok" }
    : { status: "error", message: `Missing: ${missingEnvVars.join(", ")}` };

  // Overall status
  const allOk = Object.values(checks).every(c => c.status === "ok");
  const totalLatency = Date.now() - startTime;

  return NextResponse.json({
    status: allOk ? "healthy" : "degraded",
    version: process.env.npm_package_version || "1.0.0",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    latency: totalLatency,
    checks,
  }, {
    status: allOk ? 200 : 503,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
    }
  });
}
