/**
 * SENTRY RECOMMENDATIONS API
 *
 * POST /api/sentry/[id]/recommendations/apply - Apply a recommendation
 * POST /api/sentry/[id]/recommendations/revert - Revert a recommendation
 * POST /api/sentry/[id]/recommendations/reset - Reset all recommendations
 * GET /api/sentry/[id]/recommendations/preview - Preview a recommendation
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  applyRecommendation,
  createAppliedRecommendationsTracker,
  updateAppliedRecommendationsTracker,
  previewRecommendation,
  calculateCombinedEffect,
  calculateSuccessProbability,
  analyzeOCRRisk,
} from "@/lib/sentry";
import type {
  ActionableRecommendation,
  SentryAccountItem,
  SuccessPredictionRequest,
} from "@/types/sentry";
import { createLogger } from "@/lib/logger";
const log = createLogger("sentry-recommendations-api");

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// =============================================================================
// POST /api/sentry/[id]/recommendations - Apply/Revert/Reset recommendations
// =============================================================================

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: disputeId } = await params;
    const body = await request.json();

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { action, recommendation, recommendationId } = body;

    // Get the dispute with items
    const dispute = await prisma.sentryDispute.findFirst({
      where: {
        id: disputeId,
        organizationId: session.user.organizationId,
      },
      include: {
        items: {
          include: {
            accountItem: true,
          },
        },
      },
    });

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    if (!dispute.letterContent) {
      return NextResponse.json(
        { error: "Dispute has no letter content" },
        { status: 400 }
      );
    }

    // Convert account items to SentryAccountItem format
    const accounts: SentryAccountItem[] = dispute.items.map((item) => ({
      id: item.accountItem.id,
      creditorName: item.accountItem.creditorName,
      maskedAccountId: item.accountItem.maskedAccountId || undefined,
      cra: dispute.cra as "TRANSUNION" | "EQUIFAX" | "EXPERIAN",
      accountType: item.accountItem.accountType || undefined,
      accountStatus: item.accountItem.accountStatus || undefined,
      balance: item.accountItem.balance ? Number(item.accountItem.balance) : undefined,
      isCollection: String(item.accountItem.accountType || "").toLowerCase().includes("collection"),
    }));

    // Get or create the recommendations tracker
    // Note: letterContentHash may be a simple hash string or a JSON object with recommendationsTracker
    let tracker = null;
    if (dispute.letterContentHash) {
      try {
        // Try to parse as JSON (new format with tracker)
        const parsed = JSON.parse(dispute.letterContentHash);
        if (parsed && typeof parsed === 'object' && parsed.recommendationsTracker) {
          tracker = parsed.recommendationsTracker;
        }
      } catch {
        // letterContentHash is a simple hash string (old format) - no tracker yet
        tracker = null;
      }
    }

    if (!tracker) {
      tracker = createAppliedRecommendationsTracker(disputeId, dispute.letterContent);
    }

    let updatedContent = dispute.letterContent;
    let result: {
      success: boolean;
      message: string;
      updatedContent?: string;
      recommendation?: ActionableRecommendation;
      newSuccessProbability?: number;
      combinedEffect?: ReturnType<typeof calculateCombinedEffect>;
    };

    switch (action) {
      case "apply": {
        if (!recommendation) {
          return NextResponse.json(
            { error: "Recommendation is required for apply action" },
            { status: 400 }
          );
        }

        const applyResult = await applyRecommendation(
          recommendation as ActionableRecommendation,
          dispute.letterContent,
          accounts
        );

        if (!applyResult.success) {
          return NextResponse.json(
            { error: applyResult.error || "Failed to apply recommendation" },
            { status: 400 }
          );
        }

        updatedContent = applyResult.updatedLetterContent;

        // Update tracker
        tracker = updateAppliedRecommendationsTracker(
          tracker,
          recommendation.id,
          updatedContent
        );

        // Calculate new success probability
        const ocrAnalysis = analyzeOCRRisk(updatedContent);
        const predictionRequest: SuccessPredictionRequest = {
          accountAge: 48, // Default value
          furnisherName: accounts[0]?.creditorName || "Unknown",
          hasMetro2Targeting: recommendation.type === "ENABLE_METRO2" ||
            (dispute.metro2Fields?.length ?? 0) > 0,
          eoscarCode: dispute.eoscarCodes?.[0] || "112",
          hasBureauDiscrepancy: false,
          hasPaymentProof: false,
          hasPoliceReport: false,
          citationAccuracyScore: 0.85,
          ocrSafetyScore: ocrAnalysis.score,
        };

        const newPrediction = calculateSuccessProbability(predictionRequest);

        result = {
          success: true,
          message: `Recommendation "${recommendation.title}" applied successfully`,
          updatedContent,
          recommendation: applyResult.recommendation,
          newSuccessProbability: newPrediction.probability,
          combinedEffect: calculateCombinedEffect(
            newPrediction.actionableRecommendations || []
          ),
        };
        break;
      }

      case "revert": {
        if (!recommendationId) {
          return NextResponse.json(
            { error: "Recommendation ID is required for revert action" },
            { status: 400 }
          );
        }

        // Find the applied recommendation and revert
        const appliedIndex = tracker.appliedRecommendations.findIndex(
          (r: { recommendationId: string }) => r.recommendationId === recommendationId
        );

        if (appliedIndex === -1) {
          return NextResponse.json(
            { error: "Recommendation not found in applied list" },
            { status: 404 }
          );
        }

        // If it's the last one, use the content before it, otherwise use original
        if (appliedIndex === 0) {
          updatedContent = tracker.originalLetterContent;
        } else {
          updatedContent = tracker.appliedRecommendations[appliedIndex - 1].letterContentAfter;
        }

        // Remove this and all subsequent recommendations
        tracker.appliedRecommendations = tracker.appliedRecommendations.slice(0, appliedIndex);
        tracker.currentLetterContent = updatedContent;

        result = {
          success: true,
          message: "Recommendation reverted successfully",
          updatedContent,
        };
        break;
      }

      case "reset": {
        updatedContent = tracker.originalLetterContent;
        tracker = createAppliedRecommendationsTracker(disputeId, updatedContent);

        result = {
          success: true,
          message: "All recommendations reset. Letter restored to original.",
          updatedContent,
        };
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Use 'apply', 'revert', or 'reset'.` },
          { status: 400 }
        );
    }

    // Save the updated letter content and tracker
    await prisma.sentryDispute.update({
      where: { id: disputeId },
      data: {
        letterContent: updatedContent,
        letterContentHash: JSON.stringify({
          recommendationsTracker: tracker,
          lastModified: new Date().toISOString(),
        }),
      },
    });

    // Log the event
    await prisma.eventLog.create({
      data: {
        eventType: `SENTRY_RECOMMENDATION_${action.toUpperCase()}`,
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetType: "SentryDispute",
        targetId: disputeId,
        eventData: JSON.stringify({
          action,
          recommendationId: recommendation?.id || recommendationId,
          recommendationType: recommendation?.type,
        }),
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    log.error({ err: error }, "Error processing recommendation");
    return NextResponse.json(
      { error: "Failed to process recommendation" },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET /api/sentry/[id]/recommendations - Get preview or status
// =============================================================================

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: disputeId } = await params;

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const recommendationJson = searchParams.get("recommendation");

    // Get the dispute
    const dispute = await prisma.sentryDispute.findFirst({
      where: {
        id: disputeId,
        organizationId: session.user.organizationId,
      },
      include: {
        items: {
          include: {
            accountItem: true,
          },
        },
      },
    });

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    if (action === "preview" && recommendationJson) {
      const recommendation = JSON.parse(recommendationJson) as ActionableRecommendation;

      const accounts: SentryAccountItem[] = dispute.items.map((item) => ({
        id: item.accountItem.id,
        creditorName: item.accountItem.creditorName,
        maskedAccountId: item.accountItem.maskedAccountId || undefined,
        cra: dispute.cra as "TRANSUNION" | "EQUIFAX" | "EXPERIAN",
      }));

      const preview = previewRecommendation(
        recommendation,
        dispute.letterContent || "",
        accounts
      );

      return NextResponse.json({
        success: true,
        preview,
      });
    }

    // Return status of applied recommendations
    let tracker = null;
    if (dispute.letterContentHash) {
      try {
        const parsed = JSON.parse(dispute.letterContentHash);
        if (parsed && typeof parsed === 'object' && parsed.recommendationsTracker) {
          tracker = parsed.recommendationsTracker;
        }
      } catch {
        // letterContentHash is a simple hash string - no tracker
        tracker = null;
      }
    }

    return NextResponse.json({
      success: true,
      hasOriginalContent: !!tracker?.originalLetterContent,
      appliedCount: tracker?.appliedRecommendations?.length || 0,
      appliedRecommendations: tracker?.appliedRecommendations || [],
      canReset: (tracker?.appliedRecommendations?.length || 0) > 0,
    });
  } catch (error) {
    log.error({ err: error }, "Error getting recommendation status");
    return NextResponse.json(
      { error: "Failed to get recommendation status" },
      { status: 500 }
    );
  }
}
