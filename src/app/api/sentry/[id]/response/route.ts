/**
 * SENTRY DISPUTE RESPONSE API
 *
 * POST /api/sentry/[id]/response - Record a response for a dispute
 * PATCH /api/sentry/[id]/response - Update response details
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sentryResponseSchema, sentryResponseUpdateSchema } from "@/lib/api-validation-schemas";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// =============================================================================
// POST /api/sentry/[id]/response - Record response received
// =============================================================================

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: disputeId } = await params;
    const body = await request.json();

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = sentryResponseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { outcomes, responseNotes, confirmationNumber } = parsed.data;

    // Get the dispute
    const dispute = await prisma.sentryDispute.findFirst({
      where: {
        id: disputeId,
        organizationId: session.user.organizationId,
      },
      include: {
        items: true,
      },
    });

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    // Only allow recording response for SENT disputes
    if (dispute.status !== "SENT") {
      return NextResponse.json(
        { error: "Can only record response for SENT disputes" },
        { status: 400 }
      );
    }

    const now = new Date();

    // Update each item with its outcome
    for (const { itemId, outcome, notes } of outcomes) {
      await prisma.sentryDisputeItem.update({
        where: { id: itemId },
        data: {
          outcome,
          responseDate: now,
          responseNotes: notes || responseNotes || null,
        },
      });
    }

    // Determine new dispute status
    // If all items have outcomes, mark as RESOLVED
    // Otherwise, mark as RESPONDED
    const updatedDispute = await prisma.sentryDispute.findUnique({
      where: { id: disputeId },
      include: { items: true },
    });

    const allItemsHaveOutcome = updatedDispute?.items.every((i) => i.outcome);
    const newStatus = allItemsHaveOutcome ? "RESOLVED" : "RESPONDED";

    // Update dispute status
    await prisma.sentryDispute.update({
      where: { id: disputeId },
      data: {
        status: newStatus,
        respondedAt: now,
        ...(newStatus === "RESOLVED" && { resolvedAt: now }),
        ...(confirmationNumber && {
          // Store confirmation number for future rounds
          letterContentHash: `${dispute.letterContentHash || ""}_conf:${confirmationNumber}`,
        }),
      },
    });

    // Log the event
    await prisma.eventLog.create({
      data: {
        eventType: "SENTRY_RESPONSE_RECORDED",
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetType: "SentryDispute",
        targetId: disputeId,
        eventData: JSON.stringify({
          outcomes,
          newStatus,
          responseDate: now.toISOString(),
          confirmationNumber,
        }),
        organizationId: session.user.organizationId,
      },
    });

    // Fetch final state
    const finalDispute = await prisma.sentryDispute.findUnique({
      where: { id: disputeId },
      include: {
        items: {
          include: {
            accountItem: {
              select: {
                id: true,
                creditorName: true,
                maskedAccountId: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      dispute: finalDispute,
      message: `Response recorded. Dispute status: ${newStatus}`,
    });
  } catch (error) {
    console.error("Error recording Sentry response:", error);
    return NextResponse.json(
      { error: "Failed to record response" },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH /api/sentry/[id]/response - Update response details
// =============================================================================

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: disputeId } = await params;
    const body = await request.json();

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsedUpdate = sentryResponseUpdateSchema.safeParse(body);
    if (!parsedUpdate.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsedUpdate.error.flatten() },
        { status: 400 }
      );
    }
    const { itemId, outcome, responseNotes } = parsedUpdate.data;

    // Verify dispute and item belong to organization
    const dispute = await prisma.sentryDispute.findFirst({
      where: {
        id: disputeId,
        organizationId: session.user.organizationId,
      },
      include: {
        items: {
          where: { id: itemId },
        },
      },
    });

    if (!dispute || dispute.items.length === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Update the item
    const updatedItem = await prisma.sentryDisputeItem.update({
      where: { id: itemId },
      data: {
        ...(outcome && { outcome }),
        ...(responseNotes !== undefined && { responseNotes }),
      },
    });

    return NextResponse.json({
      success: true,
      item: updatedItem,
    });
  } catch (error) {
    console.error("Error updating Sentry response:", error);
    return NextResponse.json(
      { error: "Failed to update response" },
      { status: 500 }
    );
  }
}
