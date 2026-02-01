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

import type { ProductType, ScoringModelProfile, FICOModel, CFPBTier } from "./types";

// =============================================================================
// PRODUCT SCORING PROFILES
// =============================================================================

export const PRODUCT_SCORING_PROFILES: Record<ProductType, ScoringModelProfile> = {
  MORTGAGE: {
    productType: "MORTGAGE",
    displayName: "Mortgage (Home Purchase/Refinance)",
    primaryModels: ["VANTAGE_4"],
    alternativeModels: ["FICO_SCORE_2", "FICO_SCORE_4", "FICO_SCORE_5", "FICO_10"],
    scoringMethod: "TRI_MERGE_MIDDLE",
    minimumScoreRanges: { excellent: 760, good: 700, fair: 620, poor: 580 },
    maxDTI: 43,
    dtiThresholds: { good: 28, borderline: 36, high: 43, max: 50 },
    factorWeights: { credit: 0.30, dti: 0.30, ltv: 0.25, history: 0.15 },
    additionalFactors: [
      "2+ years employment history",
      "Down payment (3.5-20%)",
      "Cash reserves (2-6 months PITI)",
      "No recent bankruptcies (Ch7: 4yr, Ch13: 2yr)",
      "No foreclosures within 3-7 years",
      "LTV ratio (80% or less avoids PMI)",
    ],
    description:
      "Mortgage lenders now use VantageScore 4.0 as the primary model for Fannie Mae/Freddie Mac conforming loans. " +
      "Legacy FICO Score 2/4/5 tri-merge middle is still used by some lenders. Scores are evaluated across all three bureaus.",
  },
  AUTO: {
    productType: "AUTO",
    displayName: "Auto Loan",
    primaryModels: ["FICO_AUTO_8"],
    alternativeModels: ["FICO_AUTO_9", "FICO_8"],
    scoringMethod: "SINGLE",
    bureauPreference: ["EXPERIAN", "EQUIFAX"],
    minimumScoreRanges: { excellent: 740, good: 670, fair: 600, poor: 500 },
    maxDTI: 50,
    dtiThresholds: { good: 28, borderline: 36, high: 45, max: 50 },
    factorWeights: { credit: 0.40, dti: 0.25, ltv: 0.20, history: 0.15 },
    additionalFactors: [
      "Down payment (10-20% reduces risk)",
      "Loan-to-value ratio (100% max prime, 120-150% subprime)",
      "Previous auto loan history (boosts FICO Auto Score)",
      "Loan term (60 months or less for best rates)",
    ],
    description:
      "Auto lenders typically use FICO Auto Score 8, which weighs auto loan payment history more heavily. " +
      "Many pull from Experian or Equifax. Previous auto defaults are weighted heavily.",
  },
  CREDIT_CARD: {
    productType: "CREDIT_CARD",
    displayName: "Credit Card",
    primaryModels: ["FICO_BANKCARD_8", "FICO_BANKCARD_9"],
    alternativeModels: ["FICO_8", "VANTAGE_4"],
    scoringMethod: "SINGLE",
    minimumScoreRanges: { excellent: 750, good: 700, fair: 640, poor: 580 },
    dtiThresholds: { good: 28, borderline: 36, high: 43, max: 50 },
    factorWeights: { credit: 0.50, dti: 0.30, ltv: 0, history: 0.20 },
    additionalFactors: [
      "Credit utilization ratio (heavily scrutinized)",
      "Income verification",
      "Existing credit card payment history",
      "640+ for most unsecured cards, 700+ for premium cards",
    ],
    description:
      "Credit card issuers use FICO Bankcard Score 8 or 9, which emphasizes revolving credit history " +
      "and credit card payment behavior. Utilization patterns on existing cards are closely scrutinized.",
  },
  PERSONAL_LOAN: {
    productType: "PERSONAL_LOAN",
    displayName: "Personal Loan",
    primaryModels: ["FICO_8", "FICO_9"],
    alternativeModels: ["VANTAGE_3", "VANTAGE_4"],
    scoringMethod: "SINGLE",
    minimumScoreRanges: { excellent: 720, good: 670, fair: 610, poor: 560 },
    maxDTI: 40,
    dtiThresholds: { good: 28, borderline: 36, high: 43, max: 50 },
    factorWeights: { credit: 0.45, dti: 0.35, ltv: 0, history: 0.20 },
    additionalFactors: [
      "Stable employment",
      "Low existing unsecured debt",
      "Positive payment history",
      "Income verification (some fintech lenders allow higher DTI)",
    ],
    description:
      "Personal loan lenders typically use standard FICO Score 8 or 9. They heavily weigh debt-to-income ratio and payment history. " +
      "FICO 10T scrutinizes personal loan usage patterns more closely.",
  },
  BUSINESS_LOC: {
    productType: "BUSINESS_LOC",
    displayName: "Business Line of Credit",
    primaryModels: ["FICO_8", "VANTAGE_3"],
    scoringMethod: "HIGHEST",
    minimumScoreRanges: { excellent: 750, good: 700, fair: 650, poor: 600 },
    maxDTI: 50,
    dtiThresholds: { good: 28, borderline: 36, high: 45, max: 50 },
    factorWeights: { credit: 0.40, dti: 0.30, ltv: 0, history: 0.30 },
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
    factorWeights: { credit: 0.50, dti: 0.25, ltv: 0, history: 0.25 },
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
// CFPB CREDIT TIER CLASSIFICATIONS
// =============================================================================

/**
 * Official CFPB credit tier classifications with score ranges and default risk.
 */
export const CFPB_TIERS: Array<{
  tier: CFPBTier;
  label: string;
  minScore: number;
  maxScore: number;
  defaultRisk: string;
  productAccess: string;
}> = [
  {
    tier: "SUPER_PRIME",
    label: "Super-Prime",
    minScore: 720,
    maxScore: 850,
    defaultRisk: "~0.15%",
    productAccess: "Best rates on all products. Premium cards, lowest mortgage rates, best auto financing.",
  },
  {
    tier: "PRIME",
    label: "Prime",
    minScore: 660,
    maxScore: 719,
    defaultRisk: "~5%",
    productAccess: "Good rates, most reward cards. Conventional mortgages, competitive auto rates.",
  },
  {
    tier: "NEAR_PRIME",
    label: "Near-Prime",
    minScore: 620,
    maxScore: 659,
    defaultRisk: "~15%",
    productAccess: "Minimum for conventional mortgage (620). Higher rates, limited card options, may need larger down payments.",
  },
  {
    tier: "SUBPRIME",
    label: "Subprime",
    minScore: 580,
    maxScore: 619,
    defaultRisk: "~25%",
    productAccess: "FHA mortgage minimum (580). Secured cards, subprime auto loans with high rates (15-25% APR).",
  },
  {
    tier: "DEEP_SUBPRIME",
    label: "Deep Subprime",
    minScore: 300,
    maxScore: 579,
    defaultRisk: "~46%",
    productAccess: "Very limited options. Secured cards only, buy-here-pay-here auto dealers.",
  },
];

/**
 * Classify a credit score into a CFPB tier.
 */
export function classifyCFPBTier(score: number | null): CFPBTier {
  if (score === null || score < 580) return "DEEP_SUBPRIME";
  if (score < 620) return "SUBPRIME";
  if (score < 660) return "NEAR_PRIME";
  if (score < 720) return "PRIME";
  return "SUPER_PRIME";
}

// =============================================================================
// FICO VERSION-SPECIFIC BEHAVIOR
// =============================================================================

/**
 * Documents how different FICO versions handle specific scoring scenarios.
 * Used to adjust score estimates and generate version-aware findings.
 */
export const FICO_VERSION_BEHAVIOR = {
  FICO_8: {
    label: "FICO Score 8 (Most Widely Used)",
    ignoresSmallCollections: true,
    smallCollectionThreshold: 100,
    paidCollectionsCount: true,
    medicalCollectionWeight: "FULL",
    rentalHistory: false,
    trendedData: false,
    notes: "Ignores collection accounts under $100. More sensitive to high utilization. Isolates single late payments for otherwise clean history.",
  },
  FICO_9: {
    label: "FICO Score 9",
    ignoresSmallCollections: true,
    smallCollectionThreshold: 100,
    paidCollectionsCount: false,
    medicalCollectionWeight: "REDUCED",
    rentalHistory: true,
    trendedData: false,
    notes: "Paid collections completely ignored. Medical collections weighted less heavily. Rental payment history factored when reported.",
  },
  FICO_10: {
    label: "FICO Score 10 / 10T",
    ignoresSmallCollections: true,
    smallCollectionThreshold: 100,
    paidCollectionsCount: true,
    medicalCollectionWeight: "FULL",
    rentalHistory: false,
    trendedData: true,
    notes: "FICO 10T uses trended data (24-month payment patterns). Detects debt consolidation followed by new accumulation. Personal loan usage receives increased scrutiny.",
  },
} as const;

// =============================================================================
// SCORE NORMALIZATION (0-100 SCALE)
// =============================================================================

/**
 * Normalize a credit score to a 0-100 scale per doc spec:
 * - Below 580: 0-20 points
 * - 580-619: 21-40 points
 * - 620-659: 41-60 points
 * - 660-719: 61-80 points
 * - 720-850: 81-100 points
 */
export function normalizeScoreTo100(score: number | null): number {
  if (score === null) return 0;
  if (score < 580) {
    // 300-579 → 0-20
    const pct = Math.max(0, (score - 300) / (580 - 300));
    return Math.round(pct * 20);
  }
  if (score < 620) {
    // 580-619 → 21-40
    const pct = (score - 580) / (620 - 580);
    return Math.round(21 + pct * 19);
  }
  if (score < 660) {
    // 620-659 → 41-60
    const pct = (score - 620) / (660 - 620);
    return Math.round(41 + pct * 19);
  }
  if (score < 720) {
    // 660-719 → 61-80
    const pct = (score - 660) / (720 - 660);
    return Math.round(61 + pct * 19);
  }
  // 720-850 → 81-100
  const pct = Math.min(1, (score - 720) / (850 - 720));
  return Math.round(81 + pct * 19);
}

/**
 * Normalize DTI ratio to a 0-100 scale (lower DTI = higher score):
 * - Above 50%: 0-20 points
 * - 43-50%: 21-40 points
 * - 36-42%: 41-60 points
 * - 28-35%: 61-80 points
 * - Below 28%: 81-100 points
 */
export function normalizeDTITo100(dti: number | null): number {
  if (dti === null) return 75; // No DTI data = assume moderate
  if (dti > 50) {
    // 50-100 → 0-20
    const pct = Math.max(0, 1 - (dti - 50) / 50);
    return Math.round(pct * 20);
  }
  if (dti >= 43) {
    // 43-50 → 21-40
    const pct = 1 - (dti - 43) / (50 - 43);
    return Math.round(21 + pct * 19);
  }
  if (dti >= 36) {
    // 36-42 → 41-60
    const pct = 1 - (dti - 36) / (43 - 36);
    return Math.round(41 + pct * 19);
  }
  if (dti >= 28) {
    // 28-35 → 61-80
    const pct = 1 - (dti - 28) / (36 - 28);
    return Math.round(61 + pct * 19);
  }
  // Below 28 → 81-100
  const pct = Math.min(1, 1 - dti / 28);
  return Math.round(81 + pct * 19);
}

/**
 * Normalize LTV ratio to a 0-100 scale (lower LTV = higher score):
 * - Above 100%: 0-20 points
 * - 90-100%: 21-40 points
 * - 80-89%: 41-60 points
 * - 60-79%: 61-80 points
 * - Below 60%: 81-100 points
 */
export function normalizeLTVTo100(ltv: number | null): number {
  if (ltv === null) return 100; // No LTV = N/A for unsecured products
  if (ltv > 100) {
    const pct = Math.max(0, 1 - (ltv - 100) / 50);
    return Math.round(pct * 20);
  }
  if (ltv >= 90) {
    const pct = 1 - (ltv - 90) / (100 - 90);
    return Math.round(21 + pct * 19);
  }
  if (ltv >= 80) {
    const pct = 1 - (ltv - 80) / (90 - 80);
    return Math.round(41 + pct * 19);
  }
  if (ltv >= 60) {
    const pct = 1 - (ltv - 60) / (80 - 60);
    return Math.round(61 + pct * 19);
  }
  const pct = Math.min(1, 1 - ltv / 60);
  return Math.round(81 + pct * 19);
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
