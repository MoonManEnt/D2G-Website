/**
 * SENTRY API - Success Probability Prediction
 *
 * POST /api/sentry/success-prediction - Calculate dispute success probability
 * GET /api/sentry/success-prediction - Get success factor information
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import {
  calculateSuccessProbability,
  getSuccessFactors,
  quickEstimate,
  getProbabilityLabel,
  calculatePotentialImprovement,
  compareStrategies,
  getFactorWeights,
} from "@/lib/sentry/success-calculator";
import type { SuccessPredictionRequest } from "@/types/sentry";
import { sentrySuccessPredictionSchema } from "@/lib/api-validation-schemas";
import { createLogger } from "@/lib/logger";
const log = createLogger("sentry-prediction-api");

export const dynamic = "force-dynamic";

// =============================================================================
// POST /api/sentry/success-prediction - Calculate success probability
// =============================================================================

export const POST = withAuth(async (req, ctx) => {
  try {
    const body = await req.json();
    const parsed = sentrySuccessPredictionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const {
      // Full prediction request
      accountAge,
      furnisherName,
      hasMetro2Targeting,
      eoscarCode,
      hasPoliceReport,
      hasBureauDiscrepancy,
      hasPaymentProof,
      citationAccuracyScore,
      ocrSafetyScore,

      // Quick estimate (alternative)
      quickEstimateMode,
      hasSpecificCode,
      hasDocumentation,

      // Comparison mode
      compareMode,
      strategy1,
      strategy2,
    } = parsed.data;

    // Handle comparison mode
    if (compareMode && strategy1 && strategy2) {
      const comparison = compareStrategies(strategy1, strategy2);
      return NextResponse.json({
        success: true,
        comparison: {
          winner: comparison.winner,
          winnerLabel: comparison.winner === 1 ? "Strategy 1" : "Strategy 2",
          difference: comparison.difference,
          differencePercent: Math.round(comparison.difference * 100),
          explanation: comparison.explanation,
        },
        system: "SENTRY",
      });
    }

    // Handle quick estimate mode
    if (quickEstimateMode) {
      const estimate = quickEstimate(
        accountAge || 24,
        hasSpecificCode || false,
        hasDocumentation || false
      );

      return NextResponse.json({
        success: true,
        quickEstimate: {
          probability: estimate,
          probabilityPercent: Math.round(estimate * 100),
          label: getProbabilityLabel(estimate),
          note: "Quick estimates are capped at 65%. Use full prediction for detailed analysis.",
        },
        system: "SENTRY",
      });
    }

    // Full prediction mode - validate required fields
    if (accountAge === undefined || !furnisherName) {
      return NextResponse.json(
        { error: "accountAge and furnisherName are required for full prediction" },
        { status: 400 }
      );
    }

    const predictionRequest: SuccessPredictionRequest = {
      accountAge: accountAge || 24,
      furnisherName: furnisherName || "",
      hasMetro2Targeting: hasMetro2Targeting || false,
      eoscarCode: eoscarCode || "112",
      hasPoliceReport: hasPoliceReport || false,
      hasBureauDiscrepancy: hasBureauDiscrepancy || false,
      hasPaymentProof: hasPaymentProof || false,
      citationAccuracyScore: citationAccuracyScore ?? 1,
      ocrSafetyScore: ocrSafetyScore ?? 70,
    };

    // Calculate full prediction
    const prediction = calculateSuccessProbability(predictionRequest);
    const potentialImprovement = calculatePotentialImprovement(prediction);
    const label = getProbabilityLabel(prediction.probability);

    // Generate actionable insights
    const insights = generateInsights(prediction, predictionRequest);

    return NextResponse.json({
      success: true,
      prediction: {
        probability: prediction.probability,
        probabilityPercent: Math.round(prediction.probability * 100),
        label,
        confidence: prediction.confidence,
        confidenceLabel: getConfidenceLabel(prediction.confidence),

        // Factor breakdown
        breakdown: prediction.breakdown.map((factor) => ({
          name: factor.name,
          weight: factor.weight,
          weightPercent: Math.round(factor.weight * 100),
          score: factor.score,
          scorePercent: Math.round(factor.score * 100),
          contribution: factor.contribution,
          contributionPercent: Math.round(factor.contribution * 100),
          explanation: factor.explanation,
          improvementPotential: factor.score < 0.7 ? "HIGH" : factor.score < 0.9 ? "MEDIUM" : "LOW",
        })),

        // Recommendations (text)
        recommendations: prediction.recommendations,

        // Actionable recommendations (clickable with Apply buttons)
        actionableRecommendations: prediction.actionableRecommendations || [],

        // Potential improvement
        potentialImprovement: {
          amount: potentialImprovement,
          amountPercent: Math.round(potentialImprovement * 100),
          withImprovements: Math.min(
            1,
            prediction.probability + potentialImprovement
          ),
          withImprovementsPercent: Math.round(
            Math.min(1, prediction.probability + potentialImprovement) * 100
          ),
        },

        // Actionable insights
        insights,
      },
      system: "SENTRY",
    });
  } catch (error) {
    log.error({ err: error }, "Error calculating success prediction");
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to calculate success prediction",
        code: "PREDICTION_ERROR",
      },
      { status: 500 }
    );
  }
});

// =============================================================================
// GET /api/sentry/success-prediction - Get success factor information
// =============================================================================

export const GET = withAuth(async (req, ctx) => {
  try {
    const factors = getSuccessFactors();
    const weights = getFactorWeights();

    return NextResponse.json({
      success: true,
      factors: factors.map((f, i) => ({
        name: f.name,
        weight: f.weight,
        weightPercent: Math.round(f.weight * 100),
        description: getFactorDescription(f.name),
        howToImprove: getImprovementTips(f.name),
      })),
      weights,
      totalWeight: weights.reduce((sum, w) => sum + w.weight, 0),
      methodology: {
        description:
          "Success probability is calculated using a weighted factor model based on historical dispute outcomes.",
        factors: [
          "Account Age - Older accounts are harder for furnishers to verify",
          "Furnisher Response History - Known response patterns by furnisher",
          "Dispute Specificity - Metro 2 targeting vs generic language",
          "Documentation Strength - Supporting evidence quality",
          "Legal Citation Accuracy - Valid vs invalid statutes",
          "OCR Safety Score - Risk of frivolous flagging",
        ],
        confidenceLevels: {
          HIGH: "Multiple strong data points available",
          MEDIUM: "Standard data available",
          LOW: "Missing key data or low quality inputs",
        },
      },
      system: "SENTRY",
    });
  } catch (error) {
    log.error({ err: error }, "Error fetching success factors");
    return NextResponse.json(
      { error: "Failed to fetch success factors", code: "FETCH_ERROR" },
      { status: 500 }
    );
  }
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getConfidenceLabel(confidence: "HIGH" | "MEDIUM" | "LOW"): string {
  switch (confidence) {
    case "HIGH":
      return "High confidence - multiple strong data points";
    case "MEDIUM":
      return "Moderate confidence - standard prediction";
    case "LOW":
      return "Lower confidence - some data may be missing";
  }
}

function getFactorDescription(factorName: string): string {
  const descriptions: Record<string, string> = {
    "Account Age":
      "Older accounts (6+ years) are harder for furnishers to verify due to record retention limits",
    "Furnisher Response History":
      "Some furnishers (debt buyers) have historically lower verification rates",
    "Dispute Specificity":
      "Metro 2 field targeting forces specific verification vs generic 'verify everything'",
    "Documentation Strength":
      "Police reports and cross-bureau discrepancies provide strongest evidence",
    "Legal Citation Accuracy":
      "Correct citations improve credibility; incorrect citations harm it",
    "OCR Safety Score":
      "Template-like language triggers automatic frivolous flagging",
  };
  return descriptions[factorName] || "Factor contributing to success probability";
}

function getImprovementTips(factorName: string): string[] {
  const tips: Record<string, string[]> = {
    "Account Age": [
      "Nothing can be done about account age - it's a fixed factor",
      "Focus on other controllable factors for older accounts",
    ],
    "Furnisher Response History": [
      "Research the specific furnisher's verification patterns",
      "Debt buyers often have incomplete records - target this",
    ],
    "Dispute Specificity": [
      "Use Metro 2 field targeting (DOFD, Balance, Payment Rating)",
      "Select specific e-OSCAR codes instead of generic 112",
      "Target cross-bureau discrepancies explicitly",
    ],
    "Documentation Strength": [
      "Include cross-bureau discrepancy reports if available",
      "Police reports provide the strongest evidence",
      "Payment proof helps for balance disputes",
    ],
    "Legal Citation Accuracy": [
      "Use only verified FCRA citations",
      "Avoid FDCPA citations to CRAs",
      "Never cite criminal statutes",
    ],
    "OCR Safety Score": [
      "Remove demanding or threatening language",
      "Use professional, factual tone",
      "Apply OCR auto-fixes if available",
    ],
  };
  return tips[factorName] || ["Optimize this factor for better results"];
}

function generateInsights(
  prediction: { probability: number; breakdown: { name: string; score: number }[] },
  request: SuccessPredictionRequest
): string[] {
  const insights: string[] = [];

  // Identify weakest factors
  const sortedFactors = [...prediction.breakdown].sort(
    (a, b) => a.score - b.score
  );
  const weakest = sortedFactors[0];

  if (weakest.score < 0.5) {
    insights.push(
      `Biggest improvement opportunity: ${weakest.name} (currently ${Math.round(weakest.score * 100)}%)`
    );
  }

  // Specific insights based on request
  if (!request.hasMetro2Targeting) {
    insights.push(
      "Adding Metro 2 field targeting could increase success by 12-20%"
    );
  }

  if (request.eoscarCode === "112" || !request.eoscarCode) {
    insights.push(
      "Using a specific e-OSCAR code instead of generic 112 could improve results by 8-15%"
    );
  }

  if (request.ocrSafetyScore < 70) {
    insights.push(
      "OCR safety score is low - letter may be flagged as frivolous"
    );
  }

  if (request.hasBureauDiscrepancy) {
    insights.push(
      "Cross-bureau discrepancy is a strong point - emphasize this in your dispute"
    );
  }

  if (request.accountAge > 72) {
    insights.push(
      "Account is 6+ years old - furnisher records may be incomplete, which is favorable"
    );
  }

  // Furnisher-specific insights
  const lowVerifiers = ["portfolio", "midland", "lvnv", "cavalry", "encore"];
  const furnisherLower = request.furnisherName.toLowerCase();
  if (lowVerifiers.some((f) => furnisherLower.includes(f))) {
    insights.push(
      `${request.furnisherName} has historically lower verification rates - this is favorable`
    );
  }

  if (insights.length === 0) {
    insights.push(
      "Dispute is well-optimized. Consider timing - mid-week submissions often process faster."
    );
  }

  return insights;
}
