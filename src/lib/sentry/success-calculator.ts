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
  ActionableRecommendation,
  EnableMetro2Payload,
  ChangeEOSCARPayload,
  ApplyOCRFixesPayload,
} from "@/types/sentry";
import { v4 as uuidv4 } from "uuid";

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
  const actionableRecommendations = generateActionableRecommendations(breakdown, context);

  return {
    probability: Math.min(1, Math.max(0, totalScore)),
    confidence,
    breakdown,
    recommendations,
    actionableRecommendations,
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
 * Extended context for actionable recommendations
 */
export interface ActionableRecommendationContext extends SuccessPredictionRequest {
  disputeId?: string;
  accountIds?: string[];
  currentEoscarCodes?: { accountId: string; code: string }[];
  ocrFindings?: { original: string; replacement: string; location?: string }[];
  availableMetro2Fields?: string[];
}

/**
 * Generate actionable recommendations that can be applied with a click
 */
export function generateActionableRecommendations(
  breakdown: SuccessFactor[],
  context: SuccessPredictionRequest | ActionableRecommendationContext
): ActionableRecommendation[] {
  const recommendations: ActionableRecommendation[] = [];
  const extContext = context as ActionableRecommendationContext;

  // Sort by potential improvement (weight × (1 - score))
  const sortedFactors = [...breakdown].sort(
    (a, b) => b.weight * (1 - b.score) - a.weight * (1 - a.score)
  );

  for (const factor of sortedFactors) {
    // Show all recommendations - let user choose which to apply
    // (Previously filtered by score >= 0.85)

    switch (factor.name) {
      case "Dispute Specificity":
        // Recommend enabling Metro 2 targeting
        if (!context.hasMetro2Targeting) {
          const payload: EnableMetro2Payload = {
            type: "ENABLE_METRO2",
            accountIds: extContext.accountIds || [],
            suggestedFields: extContext.availableMetro2Fields || [
              "BALANCE",
              "PAYMENT_STATUS",
              "DATE_OF_LAST_ACTIVITY",
            ],
          };

          recommendations.push({
            id: uuidv4(),
            type: "ENABLE_METRO2",
            title: "Enable Metro 2 Field Targeting",
            description:
              "Target specific Metro 2 data fields (Balance, Payment Status, Date of Last Activity) to force field-level verification instead of generic responses.",
            potentialGain: "+12-20%",
            potentialGainValue: 0.16,
            priority: "HIGH",
            status: "PENDING",
            payload,
            previewBefore: "The account information is inaccurate.",
            previewAfter:
              "The **BALANCE** field shows $2,450 but should reflect $0. The **PAYMENT STATUS** field incorrectly reports 120+ days late.",
          });
        }

        // Recommend better e-OSCAR code
        if (context.eoscarCode === "112" || !context.eoscarCode) {
          const suggestedCode = getSuggestedEOSCARCode(context);
          const payload: ChangeEOSCARPayload = {
            type: "CHANGE_EOSCAR_CODE",
            accountId: extContext.accountIds?.[0] || "",
            currentCode: context.eoscarCode || "112",
            suggestedCode: suggestedCode.code,
            suggestedCodeName: suggestedCode.name,
            reasoning: suggestedCode.reasoning,
          };

          recommendations.push({
            id: uuidv4(),
            type: "CHANGE_EOSCAR_CODE",
            title: `Switch to e-OSCAR Code ${suggestedCode.code}`,
            description: `Replace generic code 112 with "${suggestedCode.name}" (${suggestedCode.code}). ${suggestedCode.reasoning}`,
            potentialGain: "+8-15%",
            potentialGainValue: 0.12,
            priority: "HIGH",
            status: "PENDING",
            payload,
          });
        }
        break;

      case "OCR Safety Score":
        if (context.ocrSafetyScore < 70 && extContext.ocrFindings?.length) {
          const payload: ApplyOCRFixesPayload = {
            type: "APPLY_OCR_FIXES",
            fixes: extContext.ocrFindings,
          };

          recommendations.push({
            id: uuidv4(),
            type: "APPLY_OCR_FIXES",
            title: "Apply OCR Safety Fixes",
            description: `Found ${extContext.ocrFindings.length} phrase(s) that may trigger frivolous flagging. Apply automatic replacements to reduce detection risk.`,
            potentialGain: "+5-10%",
            potentialGainValue: 0.08,
            priority: "MEDIUM",
            status: "PENDING",
            payload,
            previewBefore: extContext.ocrFindings[0]?.original,
            previewAfter: extContext.ocrFindings[0]?.replacement,
          });
        }
        break;

      case "Documentation Strength":
        if (!context.hasBureauDiscrepancy && !context.hasPaymentProof) {
          recommendations.push({
            id: uuidv4(),
            type: "ADD_DOCUMENTATION",
            title: "Add Cross-Bureau Discrepancy",
            description:
              "Document differences in how this account is reported across bureaus. Discrepancies prove at least one bureau has inaccurate data.",
            potentialGain: "+10-15%",
            potentialGainValue: 0.13,
            priority: "MEDIUM",
            status: "PENDING",
            payload: {
              type: "ADD_DOCUMENTATION",
              documentationType: "BUREAU_DISCREPANCY",
              description: "Compare account data across TransUnion, Experian, and Equifax",
              requiredFields: ["balance", "dateOpened", "paymentStatus", "accountStatus"],
            },
          });
        }
        break;

      case "Legal Citation Accuracy":
        if (context.citationAccuracyScore < 0.8) {
          recommendations.push({
            id: uuidv4(),
            type: "ADD_LEGAL_CITATION",
            title: "Strengthen Legal Citations",
            description:
              "Add verified FCRA citations with supporting case law. Accurate citations demonstrate legal knowledge and increase credibility.",
            potentialGain: "+5-8%",
            potentialGainValue: 0.06,
            priority: "LOW",
            status: "PENDING",
            payload: {
              type: "ADD_LEGAL_CITATION",
              statute: "15 U.S.C. § 1681e(b)",
              name: "Maximum Possible Accuracy",
              insertLocation: "BODY",
              citationText:
                "Under 15 U.S.C. § 1681e(b), consumer reporting agencies must follow reasonable procedures to assure maximum possible accuracy of consumer reports.",
            },
          });
        }
        break;
    }
  }

  // Always add personal information cleanup recommendations
  // These apply to all disputes and help clean up the credit report

  // Hard Inquiry Removal
  recommendations.push({
    id: uuidv4(),
    type: "REMOVE_HARD_INQUIRY",
    title: "Challenge Unauthorized Hard Inquiries",
    description:
      "Add language to dispute hard inquiries that were made without your authorization. Unauthorized inquiries can lower your credit score.",
    potentialGain: "+5-10%",
    potentialGainValue: 0.08,
    priority: "MEDIUM",
    status: "PENDING",
    payload: {
      type: "REMOVE_HARD_INQUIRY",
      documentationType: "HARD_INQUIRY",
      description: "Challenge unauthorized credit inquiries",
    },
    previewBefore: "(No hard inquiry dispute language)",
    previewAfter:
      "I did not authorize the following hard inquiries on my credit report and request their immediate removal under 15 U.S.C. § 1681b(c).",
  });

  // Incorrect Name Spelling
  recommendations.push({
    id: uuidv4(),
    type: "CORRECT_NAME_SPELLING",
    title: "Correct Name Spelling Variations",
    description:
      "Request removal of incorrect name spellings or variations that don't belong to you. Mixed files often start with name variations.",
    potentialGain: "+3-5%",
    potentialGainValue: 0.04,
    priority: "LOW",
    status: "PENDING",
    payload: {
      type: "CORRECT_NAME_SPELLING",
      documentationType: "NAME_CORRECTION",
      description: "Remove incorrect name variations from credit file",
    },
    previewBefore: "(No name correction language)",
    previewAfter:
      "My legal name is [CLIENT NAME]. Please remove the following incorrect name variations from my credit file as they do not belong to me and may indicate a mixed file.",
  });

  // Previous Address Removal
  recommendations.push({
    id: uuidv4(),
    type: "REMOVE_PREVIOUS_ADDRESS",
    title: "Remove Outdated/Incorrect Addresses",
    description:
      "Request removal of addresses you've never lived at or that are outdated. Incorrect addresses can indicate mixed files or identity issues.",
    potentialGain: "+3-5%",
    potentialGainValue: 0.04,
    priority: "LOW",
    status: "PENDING",
    payload: {
      type: "REMOVE_PREVIOUS_ADDRESS",
      documentationType: "ADDRESS_REMOVAL",
      description: "Remove incorrect or outdated addresses",
    },
    previewBefore: "(No address correction language)",
    previewAfter:
      "The following addresses listed on my credit report are inaccurate and should be removed: I have never resided at these locations.",
  });

  // Sort by potential gain (highest first)
  recommendations.sort((a, b) => b.potentialGainValue - a.potentialGainValue);

  // Return all recommendations - let user choose which to apply
  return recommendations;
}

/**
 * Get a suggested e-OSCAR code based on context
 */
function getSuggestedEOSCARCode(context: SuccessPredictionRequest): {
  code: string;
  name: string;
  reasoning: string;
} {
  // Determine best code based on available context
  if (context.hasBureauDiscrepancy) {
    return {
      code: "103",
      name: "Not his/hers",
      reasoning: "Cross-bureau discrepancies suggest data mixing or identity confusion.",
    };
  }

  if (context.hasPaymentProof) {
    return {
      code: "106",
      name: "Disputes present/previous Account Status",
      reasoning: "Payment documentation supports challenging the reported account status.",
    };
  }

  // Default to a common high-success code
  return {
    code: "102",
    name: "Belongs to another person",
    reasoning:
      "Forces furnisher to verify account ownership rather than just confirming data exists.",
  };
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
