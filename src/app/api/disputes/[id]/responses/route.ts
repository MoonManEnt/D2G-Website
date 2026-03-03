/**
 * Dispute Response Tracking API
 *
 * GET /api/disputes/[id]/responses - Get all responses for a dispute
 * POST /api/disputes/[id]/responses - Record a new CRA response
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  summarizeResponses,
  buildNextRoundContext,
  type DisputeOutcome,
  type StallTactic,
} from "@/lib/dispute-intelligence";
import { disputeResponseBodySchema } from "@/lib/api-validation-schemas";
import { handleAutoEscalation } from "@/lib/sentry/auto-escalation";
import { createLogger } from "@/lib/logger";
const log = createLogger("dispute-responses-api");

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/disputes/[id]/responses - Get all responses for a dispute
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: disputeId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify dispute belongs to user's organization
    const dispute = await prisma.dispute.findFirst({
      where: {
        id: disputeId,
        organizationId: session.user.organizationId,
      },
      include: {
        items: {
          include: {
            accountItem: true,
            responses: {
              orderBy: { responseDate: "desc" },
            },
          },
        },
      },
    });

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    // Get round history
    const roundHistory = await prisma.disputeRoundHistory.findMany({
      where: { disputeId },
      orderBy: { round: "asc" },
    });

    // Calculate FCRA deadline
    const fcraDeadline = dispute.sentDate
      ? new Date(new Date(dispute.sentDate).getTime() + 30 * 24 * 60 * 60 * 1000)
      : null;

    const now = new Date();
    const daysRemaining = fcraDeadline
      ? Math.ceil((fcraDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Build response summary
    const responsesForSummary = dispute.items.flatMap(item =>
      item.responses.map(r => ({
        disputeItemId: r.disputeItemId,
        creditorName: item.accountItem.creditorName,
        accountNumber: item.accountItem.maskedAccountId,
        outcome: r.outcome as DisputeOutcome,
        stallTactic: r.stallTactic as StallTactic | undefined,
        updateType: r.updateType || undefined,
        verificationMethod: r.verificationMethod || undefined,
        daysToRespond: r.daysToRespond,
        wasLate: r.wasLate,
      }))
    );

    const summary = responsesForSummary.length > 0
      ? summarizeResponses({
          id: disputeId,
          cra: dispute.cra as "TRANSUNION" | "EXPERIAN" | "EQUIFAX",
          flow: dispute.flow as "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO",
          round: dispute.round,
          sentDate: dispute.sentDate || new Date(),
          referenceNumber: dispute.referenceNumber || undefined,
          responses: responsesForSummary,
        })
      : null;

    return NextResponse.json({
      disputeId,
      round: dispute.round,
      flow: dispute.flow,
      cra: dispute.cra,
      status: dispute.status,
      sentDate: dispute.sentDate,
      fcraDeadline,
      daysRemaining,
      isOverdue: daysRemaining !== null && daysRemaining < 0,
      items: dispute.items.map(item => ({
        id: item.id,
        accountItemId: item.accountItemId,
        creditorName: item.accountItem.creditorName,
        accountNumber: item.accountItem.maskedAccountId,
        currentOutcome: item.outcome,
        responses: item.responses.map(r => ({
          id: r.id,
          outcome: r.outcome,
          responseDate: r.responseDate,
          responseMethod: r.responseMethod,
          stallTactic: r.stallTactic,
          updateType: r.updateType,
          verificationMethod: r.verificationMethod,
          daysToRespond: r.daysToRespond,
          wasLate: r.wasLate,
          notes: r.notes,
        })),
      })),
      summary,
      roundHistory: roundHistory.map(rh => ({
        round: rh.round,
        flow: rh.flow,
        cra: rh.cra,
        letterSentDate: rh.letterSentDate,
        responseReceivedDate: rh.responseReceivedDate,
        overallOutcome: rh.overallOutcome,
        itemsDisputed: rh.itemsDisputed,
        itemsDeleted: rh.itemsDeleted,
        itemsVerified: rh.itemsVerified,
      })),
    });
  } catch (error) {
    log.error({ err: error }, "Error fetching dispute responses");
    return NextResponse.json(
      { error: "Failed to fetch responses" },
      { status: 500 }
    );
  }
}

// POST /api/disputes/[id]/responses - Record a new CRA response
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: disputeId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = disputeResponseBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const {
      disputeItemId,
      outcome,
      responseDate,
      responseMethod,
      stallTactic,
      stallDetails,
      updateType,
      previousValue,
      newValue,
      verificationMethod,
      furnisherResponse,
      notes,
    } = parsed.data;

    // Verify dispute belongs to user's organization
    const dispute = await prisma.dispute.findFirst({
      where: {
        id: disputeId,
        organizationId: session.user.organizationId,
      },
      include: {
        items: true,
        client: { select: { firstName: true, lastName: true } },
      },
    });

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    // Verify dispute item belongs to this dispute
    const disputeItem = dispute.items.find(item => item.id === disputeItemId);
    if (!disputeItem) {
      return NextResponse.json(
        { error: "Dispute item not found in this dispute" },
        { status: 404 }
      );
    }

    // Calculate days to respond
    const sentDate = dispute.sentDate || new Date();
    const respDate = new Date(responseDate);
    const daysToRespond = Math.ceil(
      (respDate.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Check if response was late (> 30 days)
    const wasLate = daysToRespond > 30;

    // Calculate FCRA deadline
    const fcraDeadlineDate = new Date(sentDate);
    fcraDeadlineDate.setDate(fcraDeadlineDate.getDate() + 30);

    // Create the response record
    const response = await prisma.disputeResponse.create({
      data: {
        disputeItemId,
        disputeId,
        outcome,
        responseDate: new Date(responseDate),
        responseMethod,
        stallTactic: stallTactic || null,
        stallDetails: stallDetails || null,
        updateType: updateType || null,
        previousValue: previousValue || null,
        newValue: newValue || null,
        verificationMethod: verificationMethod || null,
        furnisherResponse: furnisherResponse || null,
        notes: notes || null,
        daysToRespond,
        fcraDeadlineDate,
        wasLate,
        recordedById: session.user.id,
      },
    });

    // Update the dispute item's outcome
    await prisma.disputeItem.update({
      where: { id: disputeItemId },
      data: { outcome },
    });

    // Log the event
    await prisma.eventLog.create({
      data: {
        eventType: "DISPUTE_RESPONSE_RECORDED",
        actorId: session.user.id,
        actorEmail: session.user.email || undefined,
        targetType: "DISPUTE",
        targetId: disputeId,
        eventData: JSON.stringify({
          disputeItemId,
          outcome,
          daysToRespond,
          wasLate,
          responseMethod,
        }),
        organizationId: session.user.organizationId,
      },
    });

    // Check if all items now have responses
    const allItems = await prisma.disputeItem.findMany({
      where: { disputeId },
      include: { responses: true },
    });

    const allResolved = allItems.every(
      item => item.responses.length > 0 || item.outcome === "DELETED"
    );

    // If all items have responses, update dispute status and prepare next round context
    if (allResolved) {
      // Collect all responses for building next round context
      const allResponses = allItems.flatMap(item =>
        item.responses.map(r => ({
          disputeItemId: r.disputeItemId,
          creditorName: "", // Will be filled in
          accountNumber: "",
          outcome: r.outcome as DisputeOutcome,
          stallTactic: r.stallTactic as StallTactic | undefined,
          updateType: r.updateType || undefined,
          verificationMethod: r.verificationMethod || undefined,
          daysToRespond: r.daysToRespond,
          wasLate: r.wasLate,
        }))
      );

      // Build next round context
      const nextRoundContext = buildNextRoundContext({
        id: disputeId,
        cra: dispute.cra as "TRANSUNION" | "EXPERIAN" | "EQUIFAX",
        flow: dispute.flow as "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO",
        round: dispute.round,
        sentDate: dispute.sentDate || new Date(),
        referenceNumber: dispute.referenceNumber || undefined,
        responses: allResponses,
      });

      // Create round history record
      const responseSummary = summarizeResponses({
        id: disputeId,
        cra: dispute.cra as "TRANSUNION" | "EXPERIAN" | "EQUIFAX",
        flow: dispute.flow as "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO",
        round: dispute.round,
        sentDate: dispute.sentDate || new Date(),
        responses: allResponses,
      });

      await prisma.disputeRoundHistory.create({
        data: {
          disputeId,
          clientId: dispute.clientId,
          organizationId: dispute.organizationId,
          round: dispute.round,
          flow: dispute.flow,
          cra: dispute.cra,
          letterSentDate: dispute.sentDate,
          letterContent: dispute.letterContent,
          responseReceivedDate: new Date(),
          overallOutcome: responseSummary.recommendedNextAction,
          itemOutcomes: JSON.stringify(
            Object.fromEntries(allItems.map(i => [i.id, i.outcome]))
          ),
          nextRoundContext: JSON.stringify(nextRoundContext),
          itemsDisputed: allItems.length,
          itemsDeleted: responseSummary.responseBreakdown.deleted,
          itemsVerified: responseSummary.responseBreakdown.verified,
          itemsUpdated: responseSummary.responseBreakdown.updated,
          itemsNoResponse: responseSummary.responseBreakdown.noResponse,
          itemsStalled: responseSummary.responseBreakdown.stallLetter,
        },
      });

      // Create Amelia recommendation for next round readiness
      try {
        await prisma.ameliaRecommendationCache.create({
          data: {
            organizationId: dispute.organizationId,
            clientId: dispute.clientId,
            cacheType: "NEXT_ROUND_READY",
            content: JSON.stringify({
              type: "ACTION_NEEDED" as const,
              priority: "HIGH" as const,
              title: `Next round ready for ${dispute.client?.firstName || "client"}`,
              description: `All items have responses for R${dispute.round} ${dispute.flow} dispute to ${dispute.cra}. ${responseSummary.responseBreakdown.deleted} deleted, ${responseSummary.responseBreakdown.verified} verified. Ready to generate R${dispute.round + 1}.`,
              clientId: dispute.clientId,
              clientName: dispute.client ? `${dispute.client.firstName} ${dispute.client.lastName}` : "Client",
              disputeId,
              actionUrl: `/clients/${dispute.clientId}`,
            }),
            priority: "HIGH",
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          },
        });
      } catch (recError) {
        log.error({ err: recError }, "Failed to create next-round recommendation");
      }

      // Update dispute status
      await prisma.dispute.update({
        where: { id: disputeId },
        data: {
          status: responseSummary.responseBreakdown.deleted === allItems.length
            ? "RESOLVED"
            : "RESPONSE_RECEIVED",
          respondedAt: new Date(),
          responseOutcome: responseSummary.recommendedNextAction,
        },
      });

      // Sentry Mode: Auto-escalate verified items
      let sentryEscalation = null;
      const verifiedItemIds = allItems
        .filter(item => item.outcome === "VERIFIED")
        .map(item => item.id);

      if (verifiedItemIds.length > 0) {
        try {
          sentryEscalation = await handleAutoEscalation({
            disputeId,
            clientId: dispute.clientId,
            organizationId: session.user.organizationId,
            verifiedItemIds,
          });
        } catch (escError) {
          log.error({ err: escError }, "Sentry auto-escalation failed (non-blocking)");
        }
      }

      return NextResponse.json({
        success: true,
        response: {
          id: response.id,
          outcome: response.outcome,
          daysToRespond: response.daysToRespond,
          wasLate: response.wasLate,
        },
        allResolved: true,
        summary: responseSummary,
        nextRoundContext: {
          recommendedAction: nextRoundContext.recommendedAction,
          recommendedFlow: nextRoundContext.recommendedFlow,
          shouldChangeBureau: nextRoundContext.shouldChangeBureau,
          targetBureau: nextRoundContext.targetBureau,
          suggestedTone: nextRoundContext.suggestedTone,
          escalationReasons: nextRoundContext.escalationReasons,
        },
        sentryEscalation,
      });
    }

    return NextResponse.json({
      success: true,
      response: {
        id: response.id,
        outcome: response.outcome,
        daysToRespond: response.daysToRespond,
        wasLate: response.wasLate,
      },
      allResolved: false,
      itemsRemaining: allItems.filter(
        item => item.responses.length === 0 && item.outcome !== "DELETED"
      ).length,
    });
  } catch (error) {
    log.error({ err: error }, "Error recording dispute response");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to record response" },
      { status: 500 }
    );
  }
}
