/**
 * Sentry Auto-Escalation
 *
 * Automatically creates next-round DRAFT disputes for verified items
 * when Sentry Mode is enabled. Drafts are queued for specialist review,
 * NOT sent automatically.
 */

import prisma from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import type { AutoEscalationResult } from "./types";
import { NotificationService } from "@/lib/notifications";

const log = createLogger("sentry-auto-escalation");

export async function handleAutoEscalation({
  disputeId,
  clientId,
  organizationId,
  verifiedItemIds,
}: {
  disputeId: string;
  clientId: string;
  organizationId: string;
  verifiedItemIds: string[];
}): Promise<AutoEscalationResult> {
  try {
    // Check if Sentry Mode is enabled for this client
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        sentryModeEnabled: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!client?.sentryModeEnabled) {
      return {
        escalated: false,
        draftsCreated: 0,
        disputeIds: [],
        skippedReason: "Sentry Mode not enabled for this client",
        notificationSent: false,
      };
    }

    if (verifiedItemIds.length === 0) {
      return {
        escalated: false,
        draftsCreated: 0,
        disputeIds: [],
        skippedReason: "No verified items to escalate",
        notificationSent: false,
      };
    }

    // Get the original dispute for context
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        items: {
          where: { id: { in: verifiedItemIds } },
          include: { accountItem: true },
        },
      },
    });

    if (!dispute) {
      return {
        escalated: false,
        draftsCreated: 0,
        disputeIds: [],
        skippedReason: "Original dispute not found",
        notificationSent: false,
      };
    }

    // Determine next round
    const nextRound = dispute.round + 1;

    // Check round limits
    const maxRounds: Record<string, number> = {
      ACCURACY: 11,
      COLLECTION: 12,
      CONSENT: 10,
      COMBO: 12,
    };

    if (nextRound > (maxRounds[dispute.flow] || 12)) {
      return {
        escalated: false,
        draftsCreated: 0,
        disputeIds: [],
        skippedReason: `Maximum rounds (${maxRounds[dispute.flow]}) reached for ${dispute.flow} flow`,
        notificationSent: false,
      };
    }

    // Create a new DRAFT dispute for next round with the verified items
    const accountIds = dispute.items.map((item) => item.accountItemId);

    const newDispute = await prisma.dispute.create({
      data: {
        clientId,
        organizationId,
        flow: dispute.flow,
        round: nextRound,
        cra: dispute.cra,
        status: "DRAFT",
        sentryGenerated: true,
        aiStrategy: JSON.stringify({
          type: "sentry",
          generatedAt: new Date().toISOString(),
          version: "1.0",
          sentryModeActive: true,
          previousDisputeId: disputeId,
          previousRound: dispute.round,
          escalationReason: "Verified items auto-escalated by Sentry Mode",
        }),
      },
    });

    // Create dispute items for each verified account
    for (const accountItemId of accountIds) {
      await prisma.disputeItem.create({
        data: {
          disputeId: newDispute.id,
          accountItemId,
          disputeReason: `Auto-escalated from Round ${dispute.round} — item verified, not deleted`,
        },
      });
    }

    // Notify specialists
    const specialists = await prisma.user.findMany({
      where: { organizationId, isActive: true },
      select: { id: true },
    });

    let notificationSent = false;
    for (const specialist of specialists) {
      await NotificationService.create({
        userId: specialist.id,
        type: "SENTRY_AUTO_ESCALATION" as any,
        title: "Sentry Auto-Escalation",
        message: `${verifiedItemIds.length} verified item(s) for ${client.firstName} ${client.lastName} auto-escalated to Round ${nextRound} (${dispute.cra}). Draft created for review.`,
        linkUrl: `/clients/${clientId}`,
        linkText: "Review Draft",
      });
      notificationSent = true;
    }

    // Log activity
    await prisma.sentryActivityLog.create({
      data: {
        organizationId,
        clientId,
        activityType: "AUTO_ESCALATION",
        summary: `Auto-escalated ${verifiedItemIds.length} verified items to Round ${nextRound} (${dispute.cra} ${dispute.flow})`,
        details: JSON.stringify({
          previousDisputeId: disputeId,
          newDisputeId: newDispute.id,
          verifiedItemIds,
          nextRound,
        }),
        triggeredBy: "SENTRY_SYSTEM",
      },
    });

    log.info(
      {
        disputeId: newDispute.id,
        clientId,
        nextRound,
        verifiedCount: verifiedItemIds.length,
      },
      "Auto-escalation complete"
    );

    return {
      escalated: true,
      draftsCreated: 1,
      disputeIds: [newDispute.id],
      notificationSent,
    };
  } catch (error) {
    log.error({ err: error, disputeId, clientId }, "Auto-escalation failed");
    return {
      escalated: false,
      draftsCreated: 0,
      disputeIds: [],
      skippedReason: error instanceof Error ? error.message : "Unknown error",
      notificationSent: false,
    };
  }
}
