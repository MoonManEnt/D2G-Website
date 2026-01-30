/**
 * Amelia Credit Readiness Engine - FICO Scoring Model Knowledge Base
 *
 * Maps each product type to its scoring profile, including which FICO models
 * lenders use, how scores are evaluated (single, tri-merge middle, highest),
 * and minimum score ranges for approval tiers.
 *
 * This module also provides score estimation logic: given stored scores
 * (typically FICO 8, VantageScore 3), it estimates the score for a
 * product-specific FICO model (e.g., FICO Auto 8, FICO Score 2).
 */

import type { ProductType, ScoringModelProfile, FICOModel } from "./types";

// =============================================================================
// PRODUCT SCORING PROFILES
// =============================================================================

export const PRODUCT_SCORING_PROFILES: Record<ProductType, ScoringModelProfile> = {
  MORTGAGE: {
    productType: "MORTGAGE",
    displayName: "Mortgage (Home Purchase/Refinance)",
    primaryModels: ["FICO_SCORE_2", "FICO_SCORE_4", "FICO_SCORE_5"],
    scoringMethod: "TRI_MERGE_MIDDLE",
    minimumScoreRanges: { excellent: 760, good: 700, fair: 620, poor: 580 },
    maxDTI: 43,
    additionalFactors: [
      "2+ years employment history",
      "Down payment (3.5-20%)",
      "Cash reserves",
      "No recent bankruptcies (2-4 years)",
    ],
    description:
      "Mortgage lenders use FICO Score 2 (Experian), 4 (TransUnion), and 5 (Equifax). They take the middle score of all three bureaus.",
  },
  AUTO: {
    productType: "AUTO",
    displayName: "Auto Loan",
    primaryModels: ["FICO_AUTO_8", "FICO_AUTO_9"],
    scoringMethod: "SINGLE",
    bureauPreference: ["EXPERIAN", "EQUIFAX"],
    minimumScoreRanges: { excellent: 740, good: 670, fair: 600, poor: 500 },
    maxDTI: 50,
    additionalFactors: [
      "Down payment reduces risk",
      "Loan-to-value ratio",
      "Previous auto loan history",
    ],
    description:
      "Auto lenders typically use FICO Auto Score 8 or 9, which weighs auto loan history more heavily. Many pull from Experian or Equifax.",
  },
  CREDIT_CARD: {
    productType: "CREDIT_CARD",
    displayName: "Credit Card",
    primaryModels: ["FICO_BANKCARD_8", "FICO_BANKCARD_9"],
    scoringMethod: "SINGLE",
    minimumScoreRanges: { excellent: 750, good: 700, fair: 640, poor: 580 },
    additionalFactors: [
      "Credit utilization ratio",
      "Income verification",
      "Existing credit card history",
    ],
    description:
      "Credit card issuers often use FICO Bankcard Score 8 or 9, which emphasizes credit card payment behavior and utilization.",
  },
  PERSONAL_LOAN: {
    productType: "PERSONAL_LOAN",
    displayName: "Personal Loan",
    primaryModels: ["FICO_8", "FICO_9"],
    scoringMethod: "SINGLE",
    minimumScoreRanges: { excellent: 720, good: 670, fair: 610, poor: 560 },
    maxDTI: 40,
    additionalFactors: [
      "Stable employment",
      "Low existing unsecured debt",
      "Positive payment history",
    ],
    description:
      "Personal loan lenders typically use standard FICO Score 8 or 9. They heavily weigh debt-to-income ratio and payment history.",
  },
  BUSINESS_LOC: {
    productType: "BUSINESS_LOC",
    displayName: "Business Line of Credit",
    primaryModels: ["FICO_8", "VANTAGE_3"],
    scoringMethod: "HIGHEST",
    minimumScoreRanges: { excellent: 750, good: 700, fair: 650, poor: 600 },
    maxDTI: 50,
    additionalFactors: [
      "Business revenue/cash flow",
      "Time in business (2+ years preferred)",
      "Personal guarantee often required",
      "Business credit score (D&B, Experian Business)",
    ],
    description:
      "Business credit lines check personal credit (FICO 8 or VantageScore) plus business credit history. They take the highest personal score.",
  },
  GENERAL: {
    productType: "GENERAL",
    displayName: "General Credit Assessment",
    primaryModels: ["FICO_8", "VANTAGE_3"],
    scoringMethod: "SINGLE",
    minimumScoreRanges: { excellent: 740, good: 670, fair: 600, poor: 550 },
    additionalFactors: [],
    description: "General credit health assessment using FICO 8 or VantageScore 3.0.",
  },
};

// =============================================================================
// STORED SCORE TYPE MAPPING
// =============================================================================

/**
 * Maps stored score type strings (from CreditScore.scoreType) to FICOModel enum values.
 */
export const STORED_SCORE_TYPE_MAP: Record<string, FICOModel> = {
  FICO8: "FICO_8",
  FICO9: "FICO_9",
  VANTAGE3: "VANTAGE_3",
  VANTAGE4: "VANTAGE_4",
};

// =============================================================================
// FICO MODEL FAMILIES (used for cross-estimation)
// =============================================================================

const FICO_BASE_FAMILY: FICOModel[] = ["FICO_8", "FICO_9", "FICO_10"];
const FICO_AUTO_FAMILY: FICOModel[] = ["FICO_AUTO_5", "FICO_AUTO_8", "FICO_AUTO_9", "FICO_AUTO_10"];
const FICO_BANKCARD_FAMILY: FICOModel[] = ["FICO_BANKCARD_5", "FICO_BANKCARD_8", "FICO_BANKCARD_9", "FICO_BANKCARD_10"];
const FICO_MORTGAGE_FAMILY: FICOModel[] = ["FICO_SCORE_2", "FICO_SCORE_4", "FICO_SCORE_5"];
const VANTAGE_FAMILY: FICOModel[] = ["VANTAGE_3", "VANTAGE_4"];

function getModelFamily(model: FICOModel): FICOModel[] {
  if (FICO_BASE_FAMILY.includes(model)) return FICO_BASE_FAMILY;
  if (FICO_AUTO_FAMILY.includes(model)) return FICO_AUTO_FAMILY;
  if (FICO_BANKCARD_FAMILY.includes(model)) return FICO_BANKCARD_FAMILY;
  if (FICO_MORTGAGE_FAMILY.includes(model)) return FICO_MORTGAGE_FAMILY;
  if (VANTAGE_FAMILY.includes(model)) return VANTAGE_FAMILY;
  return [model];
}

// =============================================================================
// SCORE ESTIMATION
// =============================================================================

/**
 * Estimate a target model score from available scores.
 *
 * Estimation strategy:
 * - If exact match found: confidence 100
 * - If same family model found: confidence 80, small adjustment
 * - If cross-family estimation needed: confidence 60, larger adjustment
 *   - FICO Auto models: FICO8 +/- 10-15 points (auto tends higher for auto borrowers)
 *   - FICO Bankcard: FICO8 +/- 5-10 points
 *   - FICO Mortgage (2/4/5): FICO8 +/- 5 points (older models, slightly different)
 *   - VantageScore vs FICO: +/- 20 points typical variance
 *
 * Returns null if no scores available at all.
 */
export function estimateScore(
  availableScores: Array<{ cra: string; score: number; scoreType: string }>,
  targetModel: FICOModel
): { score: number; confidence: number; source: string } | null {
  if (availableScores.length === 0) return null;

  // Step 1: Check for exact match in stored scores
  for (const stored of availableScores) {
    const mappedModel = STORED_SCORE_TYPE_MAP[stored.scoreType];
    if (mappedModel === targetModel) {
      return {
        score: stored.score,
        confidence: 100,
        source: `Exact ${stored.scoreType} from ${stored.cra}`,
      };
    }
  }

  // Step 2: Check for same-family match
  const targetFamily = getModelFamily(targetModel);
  for (const stored of availableScores) {
    const mappedModel = STORED_SCORE_TYPE_MAP[stored.scoreType];
    if (mappedModel && targetFamily.includes(mappedModel)) {
      // Same family, small adjustment (+/- 5 points)
      const adjustment = getIntraFamilyAdjustment(mappedModel, targetModel);
      return {
        score: clampScore(stored.score + adjustment),
        confidence: 80,
        source: `Estimated from ${stored.scoreType} (${stored.cra}), same family`,
      };
    }
  }

  // Step 3: Cross-family estimation from FICO 8 or best available base score
  const fico8Score = availableScores.find(s => STORED_SCORE_TYPE_MAP[s.scoreType] === "FICO_8");
  const vantage3Score = availableScores.find(s => STORED_SCORE_TYPE_MAP[s.scoreType] === "VANTAGE_3");
  const baseScore = fico8Score || vantage3Score || availableScores[0];

  if (!baseScore) return null;

  const adjustment = getCrossFamilyAdjustment(targetModel, baseScore.scoreType);
  return {
    score: clampScore(baseScore.score + adjustment),
    confidence: 60,
    source: `Cross-estimated from ${baseScore.scoreType} (${baseScore.cra})`,
  };
}

/**
 * Small adjustment within the same FICO family.
 * Newer models tend to score slightly differently but within a narrow band.
 */
function getIntraFamilyAdjustment(_sourceModel: FICOModel, _targetModel: FICOModel): number {
  // Within the same family, scores are typically within 5 points
  // Newer versions (9, 10) tend to be slightly more forgiving of paid collections
  return 0; // Negligible for same family
}

/**
 * Cross-family score adjustment.
 * Different FICO model families weigh factors differently:
 * - FICO Auto: weighs auto loan history more heavily, tends to be slightly higher for those with auto history
 * - FICO Bankcard: weighs credit card behavior more heavily
 * - FICO Mortgage (2/4/5): older models, slightly different treatment of collections
 * - VantageScore: tends to run 20+ points different from FICO
 */
function getCrossFamilyAdjustment(targetModel: FICOModel, sourceScoreType: string): number {
  const isSourceVantage = sourceScoreType.toUpperCase().includes("VANTAGE");

  if (FICO_AUTO_FAMILY.includes(targetModel)) {
    // FICO Auto scores tend to be slightly different from base FICO
    // If person has auto history, typically +5 to +15 higher
    // Without auto history, typically -5 to -10 lower
    // We use a conservative middle estimate
    return isSourceVantage ? -10 : 5;
  }

  if (FICO_BANKCARD_FAMILY.includes(targetModel)) {
    // FICO Bankcard scores emphasize card behavior
    // Typically within +/- 10 of base FICO
    return isSourceVantage ? -15 : -5;
  }

  if (FICO_MORTGAGE_FAMILY.includes(targetModel)) {
    // FICO Score 2/4/5 are older models used for mortgage
    // They treat collections differently (don't ignore paid collections like FICO 9)
    // Typically -5 to +5 from FICO 8
    return isSourceVantage ? -20 : -5;
  }

  if (VANTAGE_FAMILY.includes(targetModel)) {
    // VantageScore from FICO: typically +10-20 higher for good profiles
    return isSourceVantage ? 0 : 15;
  }

  if (FICO_BASE_FAMILY.includes(targetModel)) {
    return isSourceVantage ? -15 : 0;
  }

  return 0;
}

function clampScore(score: number): number {
  return Math.max(300, Math.min(850, Math.round(score)));
}

// =============================================================================
// GET RELEVANT SCORE FOR PRODUCT TYPE
// =============================================================================

/**
 * Get the most relevant score for a given product type.
 *
 * For MORTGAGE (TRI_MERGE_MIDDLE):
 *   - Get estimated FICO Score 2 (Experian), 4 (TransUnion), 5 (Equifax)
 *   - Sort and take the middle score
 *
 * For HIGHEST:
 *   - Take the highest score across all available
 *
 * For SINGLE:
 *   - Use bureau preference if available, otherwise best available
 */
export function getRelevantScore(
  scores: Array<{ cra: string; score: number; scoreType: string }>,
  productType: ProductType
): {
  score: number | null;
  model: string;
  confidence: number;
  triMergeMiddle: number | null;
} {
  const profile = PRODUCT_SCORING_PROFILES[productType];

  if (scores.length === 0) {
    return {
      score: null,
      model: profile.primaryModels[0] || "FICO_8",
      confidence: 0,
      triMergeMiddle: null,
    };
  }

  // -------------------------------------------------------
  // TRI-MERGE MIDDLE (Mortgage)
  // -------------------------------------------------------
  if (profile.scoringMethod === "TRI_MERGE_MIDDLE") {
    // FICO Score 2 = Experian, FICO Score 4 = TransUnion, FICO Score 5 = Equifax
    const bureauModelMap: Array<{ bureau: string; model: FICOModel }> = [
      { bureau: "EXPERIAN", model: "FICO_SCORE_2" },
      { bureau: "TRANSUNION", model: "FICO_SCORE_4" },
      { bureau: "EQUIFAX", model: "FICO_SCORE_5" },
    ];

    const estimatedScores: Array<{ bureau: string; score: number; confidence: number }> = [];

    for (const { bureau, model } of bureauModelMap) {
      // Prefer scores from the matching bureau
      const bureauScores = scores.filter(s => s.cra === bureau);
      const allScores = bureauScores.length > 0 ? bureauScores : scores;
      const estimated = estimateScore(allScores, model);
      if (estimated) {
        estimatedScores.push({
          bureau,
          score: estimated.score,
          confidence: estimated.confidence,
        });
      }
    }

    if (estimatedScores.length === 0) {
      return { score: null, model: "FICO_SCORE_2", confidence: 0, triMergeMiddle: null };
    }

    // Sort scores and take the middle
    const sorted = estimatedScores.sort((a, b) => a.score - b.score);
    let middleIdx: number;
    if (sorted.length === 3) {
      middleIdx = 1; // true middle
    } else if (sorted.length === 2) {
      // With 2 scores, lenders typically take the lower
      middleIdx = 0;
    } else {
      middleIdx = 0; // only 1 score
    }

    const middleScore = sorted[middleIdx];
    const avgConfidence = Math.round(
      estimatedScores.reduce((sum, s) => sum + s.confidence, 0) / estimatedScores.length
    );

    return {
      score: middleScore.score,
      model: "TRI_MERGE_MIDDLE (FICO 2/4/5)",
      confidence: avgConfidence,
      triMergeMiddle: middleScore.score,
    };
  }

  // -------------------------------------------------------
  // HIGHEST (Business LOC)
  // -------------------------------------------------------
  if (profile.scoringMethod === "HIGHEST") {
    let bestScore: { score: number; confidence: number; model: string } | null = null;

    for (const model of profile.primaryModels) {
      const estimated = estimateScore(scores, model);
      if (estimated && (!bestScore || estimated.score > bestScore.score)) {
        bestScore = {
          score: estimated.score,
          confidence: estimated.confidence,
          model,
        };
      }
    }

    if (!bestScore) {
      // Fall back to highest raw score
      const highest = scores.reduce((max, s) => (s.score > max.score ? s : max), scores[0]);
      return {
        score: highest.score,
        model: profile.primaryModels[0],
        confidence: 50,
        triMergeMiddle: null,
      };
    }

    return {
      score: bestScore.score,
      model: bestScore.model,
      confidence: bestScore.confidence,
      triMergeMiddle: null,
    };
  }

  // -------------------------------------------------------
  // SINGLE (Auto, Credit Card, Personal Loan, General)
  // -------------------------------------------------------
  // Try primary models first
  for (const model of profile.primaryModels) {
    // If bureau preference exists, try those bureaus first
    if (profile.bureauPreference) {
      for (const bureau of profile.bureauPreference) {
        const bureauScores = scores.filter(s => s.cra === bureau);
        if (bureauScores.length > 0) {
          const estimated = estimateScore(bureauScores, model);
          if (estimated) {
            return {
              score: estimated.score,
              model,
              confidence: estimated.confidence,
              triMergeMiddle: null,
            };
          }
        }
      }
    }

    // Try all scores for this model
    const estimated = estimateScore(scores, model);
    if (estimated) {
      return {
        score: estimated.score,
        model,
        confidence: estimated.confidence,
        triMergeMiddle: null,
      };
    }
  }

  // Fallback: use the best available score directly
  const best = scores.reduce((max, s) => (s.score > max.score ? s : max), scores[0]);
  return {
    score: best.score,
    model: profile.primaryModels[0],
    confidence: 40,
    triMergeMiddle: null,
  };
}
