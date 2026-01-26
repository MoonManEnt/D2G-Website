/**
 * SENTRY DISPUTE API - Full Analysis
 *
 * POST /api/sentry/[id]/analyze - Run full Sentry intelligence analysis
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  analyzeOCRRisk,
  getRiskSummary,
  getImprovementSuggestions,
} from "@/lib/sentry/ocr-detector";
import {
  validateCitations,
  getRecommendedCitations,
} from "@/lib/sentry/legal-validator";
import {
  calculateSuccessProbability,
  getProbabilityLabel,
} from "@/lib/sentry/success-calculator";
import { recommendCodesForAccount } from "@/lib/sentry/eoscar-engine";
import { getRecommendedFields } from "@/lib/sentry/metro2-targeting";
import type { SentryFlowType, SentryCRA, SuccessPredictionRequest } from "@/types/sentry";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// =============================================================================
// POST /api/sentry/[id]/analyze - Full intelligence analysis
// =============================================================================

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the dispute with all related data
    const dispute = await prisma.sentryDispute.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        client: true,
        items: {
          include: {
            accountItem: true,
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

    // If no letter content, return basic analysis
    if (!dispute.letterContent) {
      return NextResponse.json({
        success: true,
        analysis: {
          hasLetter: false,
          message: "No letter content to analyze. Generate a letter first.",
        },
        system: "SENTRY",
      });
    }

    // 1. OCR Analysis
    const ocrAnalysis = analyzeOCRRisk(dispute.letterContent);
    const ocrSummary = getRiskSummary(ocrAnalysis);
    const ocrSuggestions = getImprovementSuggestions(ocrAnalysis);

    // 2. Citation Validation
    const citationValidation = validateCitations(dispute.letterContent, "CRA");
    const recommendedCitations = getRecommendedCitations(dispute.flow, "CRA");

    // 3. e-OSCAR Recommendations for each account
    const eoscarAnalysis = dispute.items.map((item) => {
      const account = item.accountItem;
      const recommendations = recommendCodesForAccount(
        {
          id: account.id,
          creditorName: account.creditorName,
          maskedAccountId: account.maskedAccountId || undefined,
          cra: account.cra as SentryCRA,
          accountType: account.accountType || undefined,
          balance: account.balance ? Number(account.balance) : undefined,
          isCollection: account.accountType?.toLowerCase().includes("collection"),
        },
        dispute.flow as SentryFlowType
      );

      return {
        accountId: account.id,
        creditorName: account.creditorName,
        currentCode: item.eoscarCode,
        recommendations,
        optimalCode: recommendations.length > 0 ? recommendations[0].code.code : null,
      };
    });

    // 4. Metro 2 Field Analysis
    const metro2Analysis = dispute.items.map((item) => {
      const account = item.accountItem;
      const recommendedFields = getRecommendedFields(
        account.accountType || undefined,
        account.accountType?.toLowerCase().includes("collection")
      );

      return {
        accountId: account.id,
        creditorName: account.creditorName,
        recommendedFields: recommendedFields.map((f) => ({
          code: f.code,
          name: f.name,
          description: f.description,
        })),
        currentFields: item.metro2Fields
          ? JSON.parse(item.metro2Fields as string)
          : [],
      };
    });

    // 5. Cross-Bureau Discrepancies (if data available)
    const discrepancies: unknown[] = [];

    // 6. Success Prediction
    const avgAccountAge =
      dispute.items.reduce((sum, item) => {
        const acc = item.accountItem;
        if (!acc.dateOpened) return sum;
        const ageMonths =
          (new Date().getTime() - new Date(acc.dateOpened).getTime()) /
          (1000 * 60 * 60 * 24 * 30);
        return sum + ageMonths;
      }, 0) / dispute.items.length;

    const predictionRequest: SuccessPredictionRequest = {
      accountAge: avgAccountAge || 24,
      furnisherName: dispute.items[0]?.accountItem.creditorName || "",
      hasMetro2Targeting: metro2Analysis.some((m) => m.currentFields.length > 0),
      eoscarCode: eoscarAnalysis[0]?.currentCode || "112",
      hasPoliceReport: false,
      hasBureauDiscrepancy: discrepancies.length > 0,
      hasPaymentProof: false,
      citationAccuracyScore: citationValidation.isValid ? 1 : 0.7,
      ocrSafetyScore: ocrAnalysis.score,
    };

    const successPrediction = calculateSuccessProbability(predictionRequest);
    const probabilityLabel = getProbabilityLabel(successPrediction.probability);

    // 7. Update analysis record
    await prisma.sentryAnalysis.upsert({
      where: { sentryDisputeId: dispute.id },
      create: {
        sentryDisputeId: dispute.id,
        recommendedCodes: JSON.stringify(eoscarAnalysis),
        validCitations: JSON.stringify(citationValidation.validCitations),
        invalidCitations: JSON.stringify(citationValidation.invalidCitations),
        citationWarnings: JSON.stringify(citationValidation.warnings),
        ocrScore: ocrAnalysis.score,
        ocrFindings: JSON.stringify(ocrAnalysis.findings),
        ocrFixSuggestions: JSON.stringify(ocrSuggestions),
        identifiedFields: JSON.stringify(metro2Analysis),
        fieldDiscrepancies: JSON.stringify(discrepancies),
        successProbability: successPrediction.probability,
        successBreakdown: JSON.stringify(successPrediction.breakdown),
        improvementTips: JSON.stringify(successPrediction.recommendations),
      },
      update: {
        recommendedCodes: JSON.stringify(eoscarAnalysis),
        validCitations: JSON.stringify(citationValidation.validCitations),
        invalidCitations: JSON.stringify(citationValidation.invalidCitations),
        citationWarnings: JSON.stringify(citationValidation.warnings),
        ocrScore: ocrAnalysis.score,
        ocrFindings: JSON.stringify(ocrAnalysis.findings),
        ocrFixSuggestions: JSON.stringify(ocrSuggestions),
        identifiedFields: JSON.stringify(metro2Analysis),
        fieldDiscrepancies: JSON.stringify(discrepancies),
        successProbability: successPrediction.probability,
        successBreakdown: JSON.stringify(successPrediction.breakdown),
        improvementTips: JSON.stringify(successPrediction.recommendations),
      },
    });

    // Update dispute with analysis scores
    await prisma.sentryDispute.update({
      where: { id: dispute.id },
      data: {
        ocrRiskScore: ocrAnalysis.score,
        successProbability: successPrediction.probability,
      },
    });

    // Log the analysis
    await prisma.eventLog.create({
      data: {
        eventType: "SENTRY_DISPUTE_ANALYZED",
        actorId: session.user.id,
        targetType: "SentryDispute",
        targetId: dispute.id,
        eventData: JSON.stringify({
          ocrScore: ocrAnalysis.score,
          citationsValid: citationValidation.isValid,
          successProbability: successPrediction.probability,
        }),
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json({
      success: true,
      analysis: {
        hasLetter: true,

        // OCR Analysis
        ocr: {
          score: ocrAnalysis.score,
          risk: ocrAnalysis.risk,
          summary: ocrSummary,
          findings: ocrAnalysis.findings,
          suggestions: ocrSuggestions,
          autoFixAvailable: ocrAnalysis.autoFixAvailable,
        },

        // Citation Validation
        citations: {
          isValid: citationValidation.isValid,
          validCitations: citationValidation.validCitations,
          invalidCitations: citationValidation.invalidCitations,
          warnings: citationValidation.warnings,
          recommended: recommendedCitations.slice(0, 5),
        },

        // e-OSCAR Analysis
        eoscar: {
          accounts: eoscarAnalysis,
          summary: `${eoscarAnalysis.filter((e) => e.optimalCode !== e.currentCode).length} accounts could benefit from code optimization`,
        },

        // Metro 2 Analysis
        metro2: {
          accounts: metro2Analysis,
          discrepancies,
          summary: `${metro2Analysis.reduce((sum, m) => sum + m.recommendedFields.length, 0)} fields identified for targeting`,
        },

        // Success Prediction
        success: {
          probability: successPrediction.probability,
          probabilityPercent: Math.round(successPrediction.probability * 100),
          label: probabilityLabel,
          confidence: successPrediction.confidence,
          breakdown: successPrediction.breakdown,
          recommendations: successPrediction.recommendations,
        },

        // Overall Score
        overallScore: Math.round(
          ocrAnalysis.score * 0.3 +
            (citationValidation.isValid ? 100 : 50) * 0.2 +
            successPrediction.probability * 100 * 0.5
        ),
      },
      system: "SENTRY",
    });
  } catch (error) {
    console.error("Error analyzing Sentry dispute:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to analyze Sentry dispute",
        code: "ANALYZE_ERROR",
      },
      { status: 500 }
    );
  }
}
