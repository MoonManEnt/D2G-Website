/**
 * SENTRY SUCCESS PROBABILITY CALCULATOR
 *
 * Predicts dispute success probability based on multiple weighted factors.
 * Uses historical data patterns and account characteristics.
 *
 * FACTORS:
 * - Account age (older = harder to verify)
 * - Furnisher response history
 * - Dispute specificity (Metro 2 targeting)
 * - e-OSCAR code selection
 * - Documentation strength
 * - Legal citation accuracy
 * - OCR safety score
 */

import type {
  SuccessFactor,
  SuccessPrediction,
  SuccessPredictionRequest,
} from "@/types/sentry";

// =============================================================================
// SUCCESS FACTOR DEFINITIONS
// =============================================================================

interface FactorCalculator {
  name: string;
  weight: number; // 0-1
  calculate: (context: SuccessPredictionRequest) => {
    score: number;
    explanation: string;
  };
}

const SUCCESS_FACTORS: FactorCalculator[] = [
  {
    name: "Account Age",
    weight: 0.15,
    calculate: (ctx) => {
      // Older accounts are harder for furnishers to verify - higher success
      const ageYears = ctx.accountAge / 12;

      let score: number;
      let explanation: string;

      if (ageYears >= 6) {
        score = 0.9;
        explanation = "Account is 6+ years old - furnisher records may be incomplete";
      } else if (ageYears >= 4) {
        score = 0.7;
        explanation = "Account is 4-6 years old - moderate difficulty to verify";
      } else if (ageYears >= 2) {
        score = 0.5;
        explanation = "Account is 2-4 years old - records likely still available";
      } else {
        score = 0.3;
        explanation = "Account is less than 2 years old - easily verifiable";
      }

      return { score, explanation };
    },
  },
  {
    name: "Furnisher Response History",
    weight: 0.2,
    calculate: (ctx) => {
      // Known furnisher response patterns
      // Note: In production, this would pull from FurnisherProfile table
      const knownLowVerifiers = [
        "portfolio recovery",
        "midland",
        "lvnv",
        "cavalry",
        "encore",
        "jefferson capital",
      ];

      const furnisherLower = ctx.furnisherName.toLowerCase();
      const isKnownLowVerifier = knownLowVerifiers.some((f) =>
        furnisherLower.includes(f)
      );

      let score: number;
      let explanation: string;

      if (isKnownLowVerifier) {
        score = 0.7;
        explanation = `${ctx.furnisherName} has historically lower verification rates`;
      } else if (furnisherLower.includes("original creditor")) {
        score = 0.4;
        explanation = "Original creditors typically have better records";
      } else {
        score = 0.5;
        explanation = "Average furnisher - standard verification expected";
      }

      return { score, explanation };
    },
  },
  {
    name: "Dispute Specificity",
    weight: 0.25,
    calculate: (ctx) => {
      // More specific = higher success
      let score = 0.3; // Base score
      let explanation = "Generic dispute language";

      if (ctx.hasMetro2Targeting) {
        score = 0.85;
        explanation = "Using Metro 2 field-level targeting - forces specific verification";
      } else if (ctx.eoscarCode && ctx.eoscarCode !== "112") {
        score = 0.65;
        explanation = `Using targeted e-OSCAR code ${ctx.eoscarCode} - better than generic`;
      } else if (ctx.eoscarCode === "112") {
        score = 0.2;
        explanation = "Generic code 112 - lowest priority, often batch verified";
      }

      return { score, explanation };
    },
  },
  {
    name: "Documentation Strength",
    weight: 0.2,
    calculate: (ctx) => {
      let score = 0.3;
      const factors: string[] = [];

      if (ctx.hasPoliceReport) {
        score = 0.95;
        factors.push("Police report (strongest evidence)");
      }

      if (ctx.hasBureauDiscrepancy) {
        score = Math.max(score, 0.75);
        factors.push("Cross-bureau discrepancy (proves inaccuracy)");
      }

      if (ctx.hasPaymentProof) {
        score = Math.max(score, 0.65);
        factors.push("Payment documentation");
      }

      if (factors.length === 0) {
        factors.push("No supporting documentation");
      }

      return {
        score,
        explanation: factors.join(", "),
      };
    },
  },
  {
    name: "Legal Citation Accuracy",
    weight: 0.1,
    calculate: (ctx) => {
      // citationAccuracyScore is 0-1
      const score = ctx.citationAccuracyScore;
      let explanation: string;

      if (score >= 0.95) {
        explanation = "All citations verified correct";
      } else if (score >= 0.7) {
        explanation = "Most citations accurate, minor issues";
      } else if (score >= 0.5) {
        explanation = "Some problematic citations detected";
      } else {
        explanation = "Significant citation issues - may harm credibility";
      }

      return { score, explanation };
    },
  },
  {
    name: "OCR Safety Score",
    weight: 0.1,
    calculate: (ctx) => {
      // ocrSafetyScore is 0-100, convert to 0-1
      const score = ctx.ocrSafetyScore / 100;
      let explanation: string;

      if (score >= 0.8) {
        explanation = "Low frivolous flagging risk";
      } else if (score >= 0.5) {
        explanation = "Moderate OCR risk - some template markers detected";
      } else {
        explanation = "High frivolous flagging risk - may be auto-rejected";
      }

      return { score, explanation };
    },
  },
];

// =============================================================================
// CALCULATION FUNCTIONS
// =============================================================================

/**
 * Get the list of success factors
 */
export function getSuccessFactors(): FactorCalculator[] {
  return SUCCESS_FACTORS;
}

/**
 * Calculate success probability for a dispute
 */
export function calculateSuccessProbability(
  context: SuccessPredictionRequest
): SuccessPrediction {
  let totalScore = 0;
  const breakdown: SuccessFactor[] = [];

  for (const factor of SUCCESS_FACTORS) {
    const { score, explanation } = factor.calculate(context);
    const contribution = score * factor.weight;
    totalScore += contribution;

    breakdown.push({
      name: factor.name,
      weight: factor.weight,
      score,
      contribution,
      explanation,
    });
  }

  // Determine confidence level based on data quality
  let confidence: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";

  // High confidence if we have multiple data points
  if (
    context.hasMetro2Targeting &&
    context.eoscarCode !== "112" &&
    context.citationAccuracyScore >= 0.9 &&
    context.ocrSafetyScore >= 70
  ) {
    confidence = "HIGH";
  }

  // Low confidence if missing key data
  if (
    !context.furnisherName ||
    context.accountAge === 0 ||
    context.citationAccuracyScore < 0.5
  ) {
    confidence = "LOW";
  }

  // Generate recommendations
  const recommendations = generateRecommendations(breakdown, context);

  return {
    probability: Math.min(1, Math.max(0, totalScore)),
    confidence,
    breakdown,
    recommendations,
  };
}

/**
 * Generate improvement recommendations based on factor scores
 */
function generateRecommendations(
  breakdown: SuccessFactor[],
  context: SuccessPredictionRequest
): string[] {
  const recommendations: string[] = [];

  // Sort by potential improvement (weight × (1 - score))
  const sortedFactors = [...breakdown].sort(
    (a, b) => b.weight * (1 - b.score) - a.weight * (1 - a.score)
  );

  for (const factor of sortedFactors.slice(0, 3)) {
    if (factor.score < 0.7) {
      switch (factor.name) {
        case "Dispute Specificity":
          if (!context.hasMetro2Targeting) {
            recommendations.push(
              "Add Metro 2 field targeting to increase specificity (+12-20% potential)"
            );
          }
          if (context.eoscarCode === "112" || !context.eoscarCode) {
            recommendations.push(
              "Select a specific e-OSCAR code instead of generic 112 (+8-15% potential)"
            );
          }
          break;

        case "Documentation Strength":
          if (!context.hasPoliceReport && !context.hasBureauDiscrepancy) {
            recommendations.push(
              "Add cross-bureau discrepancy documentation (+15% potential)"
            );
          }
          if (!context.hasPaymentProof) {
            recommendations.push(
              "Include payment proof if disputing balance or payment history (+10% potential)"
            );
          }
          break;

        case "Legal Citation Accuracy":
          if (context.citationAccuracyScore < 0.9) {
            recommendations.push(
              "Review and fix citation issues before sending (+5-10% potential)"
            );
          }
          break;

        case "OCR Safety Score":
          if (context.ocrSafetyScore < 70) {
            recommendations.push(
              "Apply OCR fixes to reduce frivolous flagging risk (+5-8% potential)"
            );
          }
          break;
      }
    }
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Dispute is well-optimized. Consider timing - mid-week submissions often process faster."
    );
  }

  return recommendations;
}

/**
 * Quick estimate for display purposes (without full context)
 */
export function quickEstimate(
  accountAgeMonths: number,
  hasSpecificCode: boolean,
  hasDocumentation: boolean
): number {
  let estimate = 0.25; // Base rate

  // Age factor
  if (accountAgeMonths >= 72) estimate += 0.15;
  else if (accountAgeMonths >= 48) estimate += 0.10;
  else if (accountAgeMonths >= 24) estimate += 0.05;

  // Specificity factor
  if (hasSpecificCode) estimate += 0.15;

  // Documentation factor
  if (hasDocumentation) estimate += 0.15;

  return Math.min(0.65, estimate); // Cap quick estimate at 65%
}

/**
 * Get a human-readable probability label
 */
export function getProbabilityLabel(probability: number): string {
  if (probability >= 0.7) return "High likelihood of success";
  if (probability >= 0.5) return "Moderate likelihood of success";
  if (probability >= 0.3) return "Some chance of success";
  return "Lower likelihood - consider strengthening dispute";
}

/**
 * Calculate the potential improvement if all recommendations are followed
 */
export function calculatePotentialImprovement(
  prediction: SuccessPrediction
): number {
  let improvement = 0;

  for (const factor of prediction.breakdown) {
    if (factor.score < 0.9) {
      // Potential improvement = weight × (0.9 - current score)
      improvement += factor.weight * (0.9 - factor.score);
    }
  }

  return Math.min(0.35, improvement); // Cap at 35% improvement
}

/**
 * Compare two dispute strategies
 */
export function compareStrategies(
  strategy1: SuccessPredictionRequest,
  strategy2: SuccessPredictionRequest
): {
  winner: 1 | 2;
  difference: number;
  explanation: string;
} {
  const pred1 = calculateSuccessProbability(strategy1);
  const pred2 = calculateSuccessProbability(strategy2);

  const difference = Math.abs(pred1.probability - pred2.probability);

  if (pred1.probability > pred2.probability) {
    return {
      winner: 1,
      difference,
      explanation: `Strategy 1 has ${Math.round(difference * 100)}% higher success probability`,
    };
  } else if (pred2.probability > pred1.probability) {
    return {
      winner: 2,
      difference,
      explanation: `Strategy 2 has ${Math.round(difference * 100)}% higher success probability`,
    };
  }

  return {
    winner: 1,
    difference: 0,
    explanation: "Both strategies have equal predicted success",
  };
}

/**
 * Get factor weights for transparency
 */
export function getFactorWeights(): { name: string; weight: number }[] {
  return SUCCESS_FACTORS.map((f) => ({
    name: f.name,
    weight: f.weight,
  }));
}
