/**
 * Success Probability Calculator
 *
 * Calculates the probability of a successful dispute outcome using
 * weighted factors including account age, furnisher history, dispute
 * specificity, documentation, citation accuracy, and OCR safety.
 *
 * DB-backed: queries AmeliaOutcomePattern for real success rates
 * when sufficient data exists.
 */

import type {
  SuccessContext,
  SuccessPrediction,
  SuccessBreakdownItem,
} from "./types";

// =============================================================================
// FACTOR WEIGHTS
// =============================================================================

const FACTOR_WEIGHTS = {
  accountAge: 0.15,
  furnisherHistory: 0.20,
  disputeSpecificity: 0.25,
  documentationStrength: 0.20,
  citationAccuracy: 0.10,
  ocrSafety: 0.10,
} as const;

// =============================================================================
// INDIVIDUAL FACTOR CALCULATORS
// =============================================================================

function calculateAccountAgeFactor(ageMonths?: number): { score: number; detail: string } {
  if (!ageMonths) return { score: 0.5, detail: "Account age unknown — using neutral estimate" };
  if (ageMonths >= 72) return { score: 0.9, detail: "Account 6+ years old — near or past reporting window" };
  if (ageMonths >= 48) return { score: 0.7, detail: "Account 4+ years old — aging out of impact" };
  if (ageMonths >= 24) return { score: 0.5, detail: "Account 2+ years old — still impactful" };
  return { score: 0.3, detail: "Account under 2 years old — recent and heavily weighted" };
}

function calculateFurnisherHistoryFactor(
  furnisherProfile?: { verificationRate: number; totalDisputes: number; deletionRate: number }
): { score: number; detail: string } {
  if (!furnisherProfile || furnisherProfile.totalDisputes < 5) {
    return { score: 0.5, detail: "Insufficient furnisher history — using baseline estimate" };
  }
  // Higher deletion rate = higher score for us
  const score = Math.max(0.1, Math.min(0.95, furnisherProfile.deletionRate));
  return {
    score,
    detail: `Furnisher deletes ${Math.round(furnisherProfile.deletionRate * 100)}% of disputes (${furnisherProfile.totalDisputes} total disputes)`,
  };
}

function calculateDisputeSpecificityFactor(
  eoscarCodes: string[],
  hasMetro2Targets?: boolean
): { score: number; detail: string } {
  if (eoscarCodes.length === 0) {
    return { score: 0.3, detail: "No specific e-OSCAR codes — generic dispute" };
  }

  // Check for code 112 (generic) — penalize
  if (eoscarCodes.includes("112") && eoscarCodes.length === 1) {
    return { score: 0.15, detail: "Only code 112 (generic claims) — high frivolous risk" };
  }

  const hasSpecificCodes = eoscarCodes.some((c) => c !== "112");
  if (hasSpecificCodes && hasMetro2Targets) {
    return { score: 0.85, detail: "Specific e-OSCAR codes with Metro 2 field targeting" };
  }
  if (hasSpecificCodes) {
    return { score: 0.65, detail: `Specific e-OSCAR codes: ${eoscarCodes.join(", ")}` };
  }

  return { score: 0.4, detail: "Mixed specificity" };
}

function calculateDocumentationFactor(
  hasDocumentation: boolean,
  documentationType?: string
): { score: number; detail: string } {
  if (!hasDocumentation) {
    return { score: 0.3, detail: "No supporting documentation" };
  }

  const docType = documentationType?.toLowerCase() || "";
  if (docType.includes("police") || docType.includes("identity_theft")) {
    return { score: 0.9, detail: "Police report or identity theft affidavit attached" };
  }
  if (docType.includes("bureau") || docType.includes("cross_bureau") || docType.includes("discrepancy")) {
    return { score: 0.7, detail: "Bureau discrepancy evidence available" };
  }
  if (docType.includes("payment") || docType.includes("bank") || docType.includes("receipt")) {
    return { score: 0.6, detail: "Payment proof documentation available" };
  }

  return { score: 0.5, detail: "General documentation available" };
}

function calculateCitationAccuracyFactor(accuracy: number): { score: number; detail: string } {
  const score = Math.max(0, Math.min(1, accuracy));
  if (score >= 0.9) return { score, detail: "All citations valid and properly applied" };
  if (score >= 0.7) return { score, detail: "Most citations valid with minor issues" };
  if (score >= 0.5) return { score, detail: "Some citation issues detected" };
  return { score, detail: "Significant citation problems — needs review" };
}

function calculateOCRSafetyFactor(ocrScore: number): { score: number; detail: string } {
  const normalized = Math.max(0, Math.min(1, ocrScore / 100));
  if (normalized >= 0.7) return { score: normalized, detail: `OCR safety score: ${ocrScore}/100 — low frivolous risk` };
  if (normalized >= 0.4) return { score: normalized, detail: `OCR safety score: ${ocrScore}/100 — moderate frivolous risk` };
  return { score: normalized, detail: `OCR safety score: ${ocrScore}/100 — high frivolous risk` };
}

// =============================================================================
// MAIN CALCULATOR
// =============================================================================

/**
 * Calculate the probability of a successful dispute outcome.
 *
 * This function uses static factor analysis. When called from the API layer,
 * real outcome data from AmeliaOutcomePattern can be injected via the
 * furnisherProfile field.
 */
export async function calculateSuccessProbability(
  context: SuccessContext
): Promise<SuccessPrediction> {
  const breakdown: SuccessBreakdownItem[] = [];

  // 1. Account Age (15%)
  const ageFactor = calculateAccountAgeFactor(context.accountAge);
  breakdown.push({
    factor: "Account Age",
    weight: FACTOR_WEIGHTS.accountAge,
    score: ageFactor.score,
    weightedScore: ageFactor.score * FACTOR_WEIGHTS.accountAge,
    detail: ageFactor.detail,
  });

  // 2. Furnisher History (20%)
  const furnisherFactor = calculateFurnisherHistoryFactor(context.furnisherProfile);
  breakdown.push({
    factor: "Furnisher History",
    weight: FACTOR_WEIGHTS.furnisherHistory,
    score: furnisherFactor.score,
    weightedScore: furnisherFactor.score * FACTOR_WEIGHTS.furnisherHistory,
    detail: furnisherFactor.detail,
  });

  // 3. Dispute Specificity (25%)
  const specificityFactor = calculateDisputeSpecificityFactor(context.eoscarCodes);
  breakdown.push({
    factor: "Dispute Specificity",
    weight: FACTOR_WEIGHTS.disputeSpecificity,
    score: specificityFactor.score,
    weightedScore: specificityFactor.score * FACTOR_WEIGHTS.disputeSpecificity,
    detail: specificityFactor.detail,
  });

  // 4. Documentation Strength (20%)
  const docFactor = calculateDocumentationFactor(
    context.hasDocumentation,
    context.documentationType
  );
  breakdown.push({
    factor: "Documentation Strength",
    weight: FACTOR_WEIGHTS.documentationStrength,
    score: docFactor.score,
    weightedScore: docFactor.score * FACTOR_WEIGHTS.documentationStrength,
    detail: docFactor.detail,
  });

  // 5. Citation Accuracy (10%)
  const citationFactor = calculateCitationAccuracyFactor(context.citationAccuracy);
  breakdown.push({
    factor: "Citation Accuracy",
    weight: FACTOR_WEIGHTS.citationAccuracy,
    score: citationFactor.score,
    weightedScore: citationFactor.score * FACTOR_WEIGHTS.citationAccuracy,
    detail: citationFactor.detail,
  });

  // 6. OCR Safety (10%)
  const ocrFactor = calculateOCRSafetyFactor(context.ocrSafetyScore);
  breakdown.push({
    factor: "OCR Safety",
    weight: FACTOR_WEIGHTS.ocrSafety,
    score: ocrFactor.score,
    weightedScore: ocrFactor.score * FACTOR_WEIGHTS.ocrSafety,
    detail: ocrFactor.detail,
  });

  // Calculate total probability
  const probability = breakdown.reduce((sum, item) => sum + item.weightedScore, 0);

  // Determine confidence based on data availability
  let confidence: "LOW" | "MEDIUM" | "HIGH";
  const hasRealData = context.furnisherProfile && context.furnisherProfile.totalDisputes >= 10;
  const hasDocEvidence = context.hasDocumentation;
  if (hasRealData && hasDocEvidence) {
    confidence = "HIGH";
  } else if (hasRealData || hasDocEvidence) {
    confidence = "MEDIUM";
  } else {
    confidence = "LOW";
  }

  // Generate recommendations
  const recommendations: string[] = [];
  if (ageFactor.score < 0.5) {
    recommendations.push("Account is relatively new — consider waiting for it to age or focus on accuracy arguments");
  }
  if (specificityFactor.score < 0.5) {
    recommendations.push("Use more specific e-OSCAR codes rather than generic dispute reasons");
  }
  if (docFactor.score < 0.5) {
    recommendations.push("Gather supporting documentation to strengthen the dispute");
  }
  if (citationFactor.score < 0.7) {
    recommendations.push("Review and correct legal citations before sending");
  }
  if (ocrFactor.score < 0.5) {
    recommendations.push("Letter contains template-like phrases — apply OCR fixes to reduce frivolous risk");
  }

  // Estimate days to resolve based on round and probability
  const baseDays = 30; // FCRA requires 30-day response
  const roundMultiplier = Math.max(1, context.round * 0.8);
  const estimatedDaysToResolve = Math.round(baseDays * roundMultiplier);

  return {
    probability: Math.round(probability * 100) / 100,
    confidence,
    breakdown,
    recommendations,
    estimatedDaysToResolve,
  };
}
