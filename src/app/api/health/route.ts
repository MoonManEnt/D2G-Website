import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const startTime = Date.now();
  let dbOk = false;

  // Check database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const totalLatency = Date.now() - startTime;
  const allOk = dbOk;

  return NextResponse.json({
    status: allOk ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    latency: totalLatency,
  }, {
    status: allOk ? 200 : 503,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
    }
  });
}
