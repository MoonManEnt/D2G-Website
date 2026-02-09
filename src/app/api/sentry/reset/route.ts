/**
 * SENTRY CLIENT RESET API
 *
 * POST /api/sentry/reset - Reset all disputes for a client back to starting point
 *
 * This resets the client's dispute status without deleting the client profile:
 * - Archives all existing Sentry disputes (marks as ARCHIVED)
 * - Resets client's currentRound to 1
 * - Updates tracking data
 * - Preserves credit reports and account data
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { createLogger } from "@/lib/logger";

const log = createLogger("sentry-reset-api");

const resetSchema = z.object({
  clientId: z.string().uuid("Invalid client ID"),
  confirmReset: z.boolean().refine((val) => val === true, {
    message: "Must confirm reset",
  }),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = resetSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { clientId } = parsed.data;

    // Verify client belongs to organization
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: session.user.organizationId,
      },
      include: {
        _count: {
          select: {
            sentryDisputes: true,
          },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get count of disputes that will be affected
    const disputeCount = await prisma.sentryDispute.count({
      where: {
        clientId,
        organizationId: session.user.organizationId,
        status: { notIn: ["RESOLVED"] },
      },
    });

    if (disputeCount === 0) {
      return NextResponse.json({
        success: true,
        message: "No active disputes to reset",
        disputesArchived: 0,
      });
    }

    // Perform the reset in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Archive all existing Sentry disputes (set status to RESOLVED with a note)
      const archivedDisputes = await tx.sentryDispute.updateMany({
        where: {
          clientId,
          organizationId: session.user.organizationId,
          status: { notIn: ["RESOLVED"] },
        },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
        },
      });

      // 2. Reset client's dispute-related fields
      await tx.client.update({
        where: { id: clientId },
        data: {
          currentRound: 1,
          stage: "ACTIVE", // Reset to active stage
        },
      });

      // 3. Log the reset event
      await tx.eventLog.create({
        data: {
          eventType: "SENTRY_CLIENT_RESET",
          actorId: session.user.id,
          targetType: "Client",
          targetId: clientId,
          eventData: JSON.stringify({
            disputesArchived: archivedDisputes.count,
            resetBy: session.user.email,
            timestamp: new Date().toISOString(),
          }),
          organizationId: session.user.organizationId,
        },
      });

      return {
        disputesArchived: archivedDisputes.count,
      };
    });

    log.info(
      { clientId, disputesArchived: result.disputesArchived },
      "Client disputes reset successfully"
    );

    return NextResponse.json({
      success: true,
      message: `Successfully reset ${result.disputesArchived} dispute(s)`,
      disputesArchived: result.disputesArchived,
    });
  } catch (error) {
    log.error({ err: error }, "Error resetting client disputes");
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to reset client",
      },
      { status: 500 }
    );
  }
}
