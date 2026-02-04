/**
 * Amelia Outcome Patterns API
 *
 * GET: Fetch outcome patterns, filterable by CRA, flow, creditor
 * POST: Trigger pattern recomputation
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { aggregateOutcomePatterns } from "@/lib/ai/outcome-aggregator";

export const dynamic = "force-dynamic";

// GET /api/amelia/patterns — fetch outcome patterns
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = session.user.organizationId;
    const { searchParams } = new URL(request.url);
    const cra = searchParams.get("cra");
    const flow = searchParams.get("flow");
    const creditor = searchParams.get("creditor");
    const reliableOnly = searchParams.get("reliable") !== "false";

    const where: Record<string, unknown> = {
      organizationId: orgId,
    };

    if (cra) where.cra = cra;
    if (flow) where.flow = flow;
    if (creditor) where.creditorName = { contains: creditor, mode: "insensitive" };
    if (reliableOnly) where.isReliable = true;

    const patterns = await prisma.ameliaOutcomePattern.findMany({
      where,
      orderBy: [{ successRate: "desc" }, { sampleSize: "desc" }],
      take: 50,
    });

    // Compute summary stats
    const totalPatterns = patterns.length;
    const avgSuccessRate =
      patterns.length > 0
        ? patterns.reduce((sum, p) => sum + p.successRate, 0) / patterns.length
        : 0;

    // Best and worst performing
    const bestPattern = patterns.length > 0 ? patterns[0] : null;
    const worstPattern =
      patterns.length > 0 ? patterns[patterns.length - 1] : null;

    return NextResponse.json({
      patterns,
      summary: {
        totalPatterns,
        avgSuccessRate: Math.round(avgSuccessRate * 10) / 10,
        bestPerforming: bestPattern
          ? {
              flow: bestPattern.flow,
              cra: bestPattern.cra,
              creditor: bestPattern.creditorName,
              successRate: bestPattern.successRate,
              sampleSize: bestPattern.sampleSize,
            }
          : null,
        worstPerforming: worstPattern
          ? {
              flow: worstPattern.flow,
              cra: worstPattern.cra,
              creditor: worstPattern.creditorName,
              successRate: worstPattern.successRate,
              sampleSize: worstPattern.sampleSize,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Error fetching patterns:", error);
    return NextResponse.json(
      { error: "Failed to fetch patterns" },
      { status: 500 }
    );
  }
}

// POST /api/amelia/patterns — trigger recomputation
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = session.user.organizationId;
    const patternCount = await aggregateOutcomePatterns(orgId);

    return NextResponse.json({
      success: true,
      patternsComputed: patternCount,
      computedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error computing patterns:", error);
    return NextResponse.json(
      { error: "Failed to compute patterns" },
      { status: 500 }
    );
  }
}
