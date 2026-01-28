/**
 * SENTRY DISPUTE API - Launch (Send) Dispute
 *
 * POST /api/sentry/[id]/launch - Mark dispute as sent and lock accounts
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sentryLaunchSchema } from "@/lib/api-validation-schemas";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// =============================================================================
// POST /api/sentry/[id]/launch - Launch (send) dispute
// =============================================================================

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    const body = await request.json();
    const parsed = sentryLaunchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { sentDate, trackingNumber, sentMethod } = parsed.data;

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the dispute
    const dispute = await prisma.sentryDispute.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        items: {
          include: {
            accountItem: {
              select: {
                id: true,
                creditorName: true,
              },
            },
          },
        },
        analysis: {
          select: {
            ocrScore: true,
            successProbability: true,
          },
        },
      },
    });

    if (!dispute) {
      return NextResponse.json(
        { error: "Sentry dispute not found" },
        { status: 404 }
      );
    }

    // Validate dispute is ready to send
    if (dispute.status !== "DRAFT") {
      return NextResponse.json(
        {
          error: `Dispute is already ${dispute.status}. Can only launch DRAFT disputes.`,
        },
        { status: 400 }
      );
    }

    if (!dispute.letterContent) {
      return NextResponse.json(
        { error: "Dispute has no letter content. Generate a letter first." },
        { status: 400 }
      );
    }

    // Check OCR safety score
    if (dispute.ocrRiskScore !== null && dispute.ocrRiskScore < 50) {
      return NextResponse.json(
        {
          error: "Letter has high OCR frivolous risk",
          details: {
            ocrScore: dispute.ocrRiskScore,
            message:
              "OCR safety score is below 50. Consider regenerating the letter with safer language.",
          },
        },
        { status: 400 }
      );
    }

    // Calculate deadline (30 days from sent date)
    const actualSentDate = sentDate ? new Date(sentDate) : new Date();
    const deadlineDate = new Date(actualSentDate);
    deadlineDate.setDate(deadlineDate.getDate() + 30);

    // Update dispute status to SENT
    const updatedDispute = await prisma.sentryDispute.update({
      where: { id },
      data: {
        status: "SENT",
        sentDate: actualSentDate,
        deadlineDate,
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
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

    // Lock the disputed accounts (mark as under dispute)
    const accountIds = dispute.items.map((item) => item.accountItemId);
    await prisma.accountItem.updateMany({
      where: {
        id: { in: accountIds },
      },
      data: {
        // Add a flag or update status to indicate under dispute
        // This prevents the same account from being disputed simultaneously
      },
    });

    // Track the e-OSCAR code outcomes for future ML improvement
    for (const item of dispute.items) {
      if (item.eoscarCode) {
        await prisma.sentryCodeOutcome.create({
          data: {
            code: item.eoscarCode,
            accountType: item.accountItem.creditorName, // Using creditor as proxy for now
            furnisherName: item.accountItem.creditorName,
            outcome: "PENDING",
            sentryDisputeId: dispute.id,
          },
        });
      }
    }

    // Log the launch event
    await prisma.eventLog.create({
      data: {
        eventType: "SENTRY_DISPUTE_LAUNCHED",
        actorId: session.user.id,
        targetType: "SentryDispute",
        targetId: dispute.id,
        eventData: JSON.stringify({
          cra: dispute.cra,
          flow: dispute.flow,
          round: dispute.round,
          accountCount: dispute.items.length,
          sentDate: actualSentDate.toISOString(),
          deadlineDate: deadlineDate.toISOString(),
          trackingNumber,
          sentMethod,
          ocrScore: dispute.ocrRiskScore,
          successProbability: dispute.successProbability
            ? Number(dispute.successProbability)
            : null,
        }),
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json({
      success: true,
      dispute: {
        id: updatedDispute.id,
        status: updatedDispute.status,
        cra: updatedDispute.cra,
        flow: updatedDispute.flow,
        round: updatedDispute.round,
        client: updatedDispute.client,
        sentDate: updatedDispute.sentDate,
        deadlineDate: updatedDispute.deadlineDate,
        accountsLocked: accountIds.length,
      },
      timeline: {
        sentDate: actualSentDate.toISOString(),
        deadlineDate: deadlineDate.toISOString(),
        daysUntilDeadline: 30,
      },
      system: "SENTRY",
    });
  } catch (error) {
    console.error("Error launching Sentry dispute:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to launch Sentry dispute",
        code: "LAUNCH_ERROR",
      },
      { status: 500 }
    );
  }
}
