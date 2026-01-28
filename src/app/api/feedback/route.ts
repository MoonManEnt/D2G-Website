/**
 * Beta Feedback API
 *
 * POST /api/feedback - Submit beta feedback
 * GET /api/feedback - Get all feedback (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { feedbackSchema } from "@/lib/api-validation-schemas";

export const dynamic = "force-dynamic";

// POST /api/feedback - Submit feedback
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();

    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const {
      type,
      rating,
      comment,
      page,
      timestamp,
      userAgent,
      screenSize,
    } = parsed.data;

    // Create feedback record
    const feedback = await prisma.betaFeedback.create({
      data: {
        type,
        rating: rating || null,
        comment,
        page,
        userAgent,
        screenSize,
        userId: session?.user?.id || null,
        userEmail: session?.user?.email || "anonymous",
        organizationId: session?.user?.organizationId || null,
      },
    });

    // Log the event
    if (session?.user) {
      await prisma.eventLog.create({
        data: {
          eventType: "BETA_FEEDBACK_SUBMITTED",
          actorId: session.user.id,
          actorEmail: session.user.email || undefined,
          targetType: "FEEDBACK",
          targetId: feedback.id,
          eventData: JSON.stringify({
            type,
            rating,
            page,
          }),
          organizationId: session.user.organizationId,
        },
      });
    }

    return NextResponse.json({
      success: true,
      feedbackId: feedback.id,
    });
  } catch (error) {
    console.error("Error submitting feedback:", error);
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}

// GET /api/feedback - Get all feedback (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can view feedback
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const page = searchParams.get("page");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: any = {};
    if (type) where.type = type;
    if (page) where.page = { contains: page };

    const feedback = await prisma.betaFeedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Get summary stats
    const stats = await prisma.betaFeedback.groupBy({
      by: ["type"],
      _count: { id: true },
      _avg: { rating: true },
    });

    return NextResponse.json({
      feedback,
      stats,
      total: feedback.length,
    });
  } catch (error) {
    console.error("Error fetching feedback:", error);
    return NextResponse.json(
      { error: "Failed to fetch feedback" },
      { status: 500 }
    );
  }
}
