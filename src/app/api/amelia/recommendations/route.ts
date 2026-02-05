/**
 * Amelia Recommendations API
 *
 * GET: Fetch cached recommendations (instant load)
 * POST: Trigger on-demand refresh
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  computeRecommendationsForOrg,
  getCachedRecommendations,
} from "@/lib/ai/recommendation-engine";
import { createLogger } from "@/lib/logger";
const log = createLogger("amelia-recommendations-api");

export const dynamic = "force-dynamic";

// GET /api/amelia/recommendations — fetch cached recommendations
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = session.user.organizationId;

    // Try cache first
    const cached = await getCachedRecommendations(orgId);
    if (cached) {
      return NextResponse.json({
        recommendations: cached,
        fromCache: true,
        count: cached.length,
      });
    }

    // No cache — compute fresh (this may be slow on first load)
    const recommendations = await computeRecommendationsForOrg(orgId);
    return NextResponse.json({
      recommendations,
      fromCache: false,
      count: recommendations.length,
    });
  } catch (error) {
    log.error({ err: error }, "Error fetching recommendations");
    return NextResponse.json(
      { error: "Failed to fetch recommendations" },
      { status: 500 }
    );
  }
}

// POST /api/amelia/recommendations — trigger on-demand refresh
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = session.user.organizationId;
    const recommendations = await computeRecommendationsForOrg(orgId);

    return NextResponse.json({
      recommendations,
      fromCache: false,
      count: recommendations.length,
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    log.error({ err: error }, "Error refreshing recommendations");
    return NextResponse.json(
      { error: "Failed to refresh recommendations" },
      { status: 500 }
    );
  }
}
