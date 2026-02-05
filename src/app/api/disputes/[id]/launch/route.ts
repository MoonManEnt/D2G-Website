import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { lockAccountsForDispute, buildLockErrorMessage } from "@/lib/account-lock-service";
import { createLogger } from "@/lib/logger";
const log = createLogger("dispute-launch-api");

export const dynamic = 'force-dynamic';

/**
 * POST /api/disputes/[id]/launch
 *
 * Launches a dispute - marks it as SENT and starts the 30-day FCRA tracking.
 * This is the point where the dispute is officially "in flight" and the account
 * becomes locked until response or expiration.
 *
 * Only after launch should accounts be locked from new disputes.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Find the dispute
    const dispute = await prisma.dispute.findFirst({
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
      },
    });

    if (!dispute) {
      return NextResponse.json(
        { error: "Dispute not found" },
        { status: 404 }
      );
    }

    // Check if already launched
    if (dispute.status === "SENT" || dispute.sentDate) {
      return NextResponse.json(
        { error: "Dispute has already been launched" },
        { status: 400 }
      );
    }

    // Lock accounts atomically before launching
    const accountIds = dispute.items.map((item) => item.accountItem.id);
    const lockResult = await lockAccountsForDispute(
      accountIds,
      dispute.id,
      "DISPUTE",
      dispute.cra,
      session.user.organizationId
    );

    if (!lockResult.success) {
      return NextResponse.json(
        {
          error: "Cannot launch dispute - some accounts are locked",
          code: "ACCOUNTS_LOCKED",
          details: {
            message: buildLockErrorMessage(lockResult.failedAccounts),
            failedAccounts: lockResult.failedAccounts,
            lockedAccounts: lockResult.lockedAccounts,
          },
        },
        { status: 409 }
      );
    }

    // Set the sent date - use provided date or current date
    const sentDateValue = body.sentDate ? new Date(body.sentDate) : new Date();

    // Calculate 30-day FCRA response deadline
    const responseDeadline = new Date(sentDateValue.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Update the dispute status to SENT
    const updatedDispute = await prisma.dispute.update({
      where: { id },
      data: {
        status: "SENT",
        sentDate: sentDateValue,
        deadlineDate: responseDeadline,
        updatedAt: new Date(),
      },
    });

    // Update the client's stage if needed
    await prisma.client.update({
      where: { id: dispute.clientId },
      data: {
        stage: `ROUND_${dispute.round}`,
        lastActivityAt: new Date(),
        currentRound: dispute.round,
        totalDisputesSent: { increment: 1 },
      },
    });

    // Log the event
    await prisma.eventLog.create({
      data: {
        eventType: "DISPUTE_SENT",
        targetType: "DISPUTE",
        targetId: dispute.id,
        actorId: session.user.id,
        actorEmail: session.user.email,
        organizationId: session.user.organizationId,
        eventData: JSON.stringify({
          description: `Launched ${dispute.cra} Round ${dispute.round} dispute with ${dispute.items.length} items`,
          cra: dispute.cra,
          flow: dispute.flow,
          round: dispute.round,
          itemCount: dispute.items.length,
          sentDate: sentDateValue.toISOString(),
          responseDeadline: responseDeadline.toISOString(),
        }),
      },
    });

    return NextResponse.json({
      success: true,
      dispute: {
        id: updatedDispute.id,
        status: updatedDispute.status,
        sentDate: sentDateValue.toISOString(),
        deadlineDate: responseDeadline.toISOString(),
      },
      message: `Round ${dispute.round} launched! 30-day FCRA deadline: ${responseDeadline.toLocaleDateString()}`,
    });
  } catch (error) {
    log.error({ err: error }, "Error launching dispute");
    return NextResponse.json(
      { error: "Failed to launch dispute" },
      { status: 500 }
    );
  }
}
