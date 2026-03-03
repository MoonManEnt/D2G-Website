/**
 * Sentry Activity Feed API
 *
 * GET /api/sentry/activity
 * Returns paginated Sentry activity log entries.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createLogger } from "@/lib/logger";

const log = createLogger("sentry-activity-api");

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: Record<string, unknown> = {
      organizationId: session.user.organizationId,
    };

    if (clientId) {
      where.clientId = clientId;
    }

    const [activities, total] = await Promise.all([
      prisma.sentryActivityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.sentryActivityLog.count({ where }),
    ]);

    return NextResponse.json({
      activities,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    log.error({ err: error }, "Sentry activity fetch failed");
    return NextResponse.json(
      { error: "Failed to fetch activity" },
      { status: 500 }
    );
  }
}
