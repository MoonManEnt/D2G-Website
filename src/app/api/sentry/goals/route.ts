/**
 * Sentry Goals API
 *
 * GET  /api/sentry/goals?clientId=X — Get client goals with projections
 * POST /api/sentry/goals — Create a new client goal
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createLogger } from "@/lib/logger";

const log = createLogger("sentry-goals-api");

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");

    if (!clientId) {
      return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }

    // Verify client belongs to org
    const client = await prisma.client.findFirst({
      where: { id: clientId, organizationId: session.user.organizationId },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const goals = await prisma.clientGoal.findMany({
      where: { clientId, organizationId: session.user.organizationId },
      orderBy: { createdAt: "desc" },
    });

    // Get latest credit scores for projection context
    const latestScores = await prisma.creditScore.findMany({
      where: { clientId },
      orderBy: { scoreDate: "desc" },
      take: 3,
      distinct: ["cra"],
    });

    return NextResponse.json({
      goals: goals.map((g) => ({
        ...g,
        milestones: JSON.parse(g.milestones),
      })),
      latestScores,
    });
  } catch (error) {
    log.error({ err: error }, "Sentry goals fetch failed");
    return NextResponse.json({ error: "Failed to fetch goals" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { clientId, goalType, targetScore, scoreCRA } = body as {
      clientId: string;
      goalType: string;
      targetScore: number;
      scoreCRA?: string;
    };

    if (!clientId || !goalType || !targetScore) {
      return NextResponse.json(
        { error: "clientId, goalType, and targetScore are required" },
        { status: 400 }
      );
    }

    if (targetScore < 300 || targetScore > 850) {
      return NextResponse.json(
        { error: "targetScore must be between 300 and 850" },
        { status: 400 }
      );
    }

    // Verify client
    const client = await prisma.client.findFirst({
      where: { id: clientId, organizationId: session.user.organizationId },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get current score if available
    let currentScore: number | null = null;
    if (scoreCRA) {
      const latestScore = await prisma.creditScore.findFirst({
        where: { clientId, cra: scoreCRA },
        orderBy: { scoreDate: "desc" },
      });
      currentScore = latestScore?.score || null;
    }

    const goal = await prisma.clientGoal.create({
      data: {
        clientId,
        organizationId: session.user.organizationId,
        goalType,
        targetScore,
        currentScore,
        scoreCRA,
        status: "ACTIVE",
        milestones: "[]",
      },
    });

    // Log activity
    await prisma.sentryActivityLog.create({
      data: {
        organizationId: session.user.organizationId,
        clientId,
        activityType: "GOAL_CREATED",
        summary: `New ${goalType} goal set: target score ${targetScore}`,
        details: JSON.stringify({ goalId: goal.id, goalType, targetScore, currentScore }),
        triggeredBy: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      goal: { ...goal, milestones: [] },
    });
  } catch (error) {
    log.error({ err: error }, "Sentry goal creation failed");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create goal" },
      { status: 500 }
    );
  }
}
