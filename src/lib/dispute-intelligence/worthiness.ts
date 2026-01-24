/**
 * Dispute Worthiness Scoring System
 *
 * Calculates which items should be disputed, in what order, and with what strategy.
 * Considers account characteristics, history, timing, and strategic factors.
 */

import {
  type DisputeWorthiness,
  type WorthinessFactors,
  type DisputeApproach,
  type DisputeOutcome,
} from "./types";

// =============================================================================
// WORTHINESS FACTOR ANALYSIS
// =============================================================================

interface AccountForWorthiness {
  id: string;
  creditorName: string;
  accountNumber: string;
  cra: "TRANSUNION" | "EXPERIAN" | "EQUIFAX";
  accountType: string | null;
  accountStatus: string;
  balance: number | null;
  creditLimit: number | null;
  pastDue: number | null;
  dateOpened: Date | null;
  dateReported: Date | null;
  paymentStatus: string | null;
  detectedIssues: Array<{ code: string; severity: string }>;
  fingerprint: string;
}

interface DisputeHistoryItem {
  round: number;
  outcome: DisputeOutcome;
  cra: string;
  date: Date;
}

interface WorthinessInput {
  account: AccountForWorthiness;
  allAccountsWithFingerprint: AccountForWorthiness[]; // Same account across bureaus
  disputeHistory: DisputeHistoryItem[];
  hasEvidence: boolean;
  evidenceType?: string;
}

function monthsAgo(date: Date | null): number {
  if (!date) return 0;
  const now = new Date();
  return Math.max(0,
    (now.getFullYear() - date.getFullYear()) * 12 +
    (now.getMonth() - date.getMonth())
  );
}

function isCollection(account: AccountForWorthiness): boolean {
  const type = (account.accountType || "").toUpperCase();
  const status = (account.accountStatus || "").toUpperCase();
  return type.includes("COLLECTION") || status.includes("COLLECTION");
}

function isChargeOff(account: AccountForWorthiness): boolean {
  const status = (account.accountStatus || "").toUpperCase();
  const payment = (account.paymentStatus || "").toUpperCase();
  return status.includes("CHARGE") || payment.includes("CHARGE") ||
    status.includes("WRITTEN OFF");
}

function hasLatePayments(account: AccountForWorthiness): boolean {
  return account.detectedIssues.some(i =>
    i.code.includes("LATE") || i.code.includes("DELINQUENT")
  );
}

function extractPotentialViolations(account: AccountForWorthiness): string[] {
  const violations: string[] = [];

  // Check for common FCRA/FDCPA violations based on issues
  for (const issue of account.detectedIssues) {
    const code = issue.code.toUpperCase();

    if (code.includes("RE_AGING") || code.includes("DATE_CHANGED")) {
      violations.push("FCRA § 605(c) - Re-aging violation");
    }
    if (code.includes("DUPLICATE")) {
      violations.push("FCRA § 1681e(b) - Duplicate reporting");
    }
    if (code.includes("OBSOLETE") || code.includes("EXPIRED")) {
      violations.push("FCRA § 605 - Obsolete information");
    }
    if (code.includes("BALANCE_MISMATCH")) {
      violations.push("FCRA § 1681e(b) - Inaccurate balance reporting");
    }
    if (isCollection(account)) {
      violations.push("FDCPA § 809 - Debt validation rights");
    }
  }

  return [...new Set(violations)]; // Deduplicate
}

function calculateStatuteOfLimitations(account: AccountForWorthiness): number {
  // Most credit reporting has a 7-year limit (84 months)
  const dateOpened = account.dateOpened;
  const dateReported = account.dateReported;

  const relevantDate = dateReported || dateOpened;
  if (!relevantDate) return 84; // Assume full time remaining

  const monthsSince = monthsAgo(relevantDate);
  return Math.max(0, 84 - monthsSince);
}

/**
 * Extract worthiness factors from an account
 */
export function extractWorthinessFactors(input: WorthinessInput): WorthinessFactors {
  const { account, allAccountsWithFingerprint, disputeHistory, hasEvidence, evidenceType } = input;

  const accountAge = monthsAgo(account.dateOpened);

  // Calculate derog age - use the most relevant date
  let derogAge = 0;
  if (isCollection(account) || isChargeOff(account) || hasLatePayments(account)) {
    derogAge = monthsAgo(account.dateReported || account.dateOpened);
  }

  // Bureau presence
  const bureauReporting = allAccountsWithFingerprint.length;
  const hasDivergence = bureauReporting > 1 && allAccountsWithFingerprint.some(a => {
    return a.balance !== account.balance ||
      a.accountStatus !== account.accountStatus ||
      a.paymentStatus !== account.paymentStatus;
  });

  // Previous dispute history
  const previousDisputes = disputeHistory.length;
  const previousOutcomes = disputeHistory.map(d => d.outcome);
  const wasEverDeleted = previousOutcomes.includes("DELETED");

  // Evidence strength
  let evidenceStrength: WorthinessFactors["evidenceStrength"] = "NONE";
  if (hasEvidence) {
    if (evidenceType?.includes("CONTRACT") || evidenceType?.includes("SIGNED")) {
      evidenceStrength = "STRONG";
    } else if (evidenceType?.includes("STATEMENT") || evidenceType?.includes("LETTER")) {
      evidenceStrength = "MODERATE";
    } else {
      evidenceStrength = "WEAK";
    }
  }

  // Legal factors
  const potentialViolations = extractPotentialViolations(account);
  const statuteOfLimitations = calculateStatuteOfLimitations(account);
  const isTimeBared = statuteOfLimitations <= 0;

  return {
    accountAge,
    derogAge,
    balance: account.balance || 0,
    isCollection: isCollection(account),
    isChargeOff: isChargeOff(account),
    hasLatePayments: hasLatePayments(account),
    bureauReporting,
    hasDivergence,
    previousDisputes,
    previousOutcomes,
    wasEverDeleted,
    hasEvidence,
    evidenceStrength,
    potentialViolations,
    statuteOfLimitations,
    isTimeBared,
  };
}

// =============================================================================
// WORTHINESS SCORING ALGORITHM
// =============================================================================

/**
 * Calculate the worthiness score for an account
 * Higher = more worth disputing now
 */
function calculateWorthinessScore(factors: WorthinessFactors): number {
  let score = 50; // Base score

  // Collections and charge-offs are high priority
  if (factors.isCollection) score += 20;
  if (factors.isChargeOff) score += 15;
  if (factors.hasLatePayments) score += 10;

  // Age factors
  if (factors.derogAge > 60) score += 15;    // Older items more likely to be removed
  if (factors.derogAge > 84) score += 10;    // Near obsolescence
  if (factors.derogAge < 12) score -= 10;    // Very recent, harder to remove

  // Balance impact
  if (factors.balance > 5000) score += 10;
  if (factors.balance > 10000) score += 5;
  if (factors.balance === 0 || factors.balance < 100) score += 5; // Paid or low balance easier

  // Bureau factors
  if (factors.hasDivergence) score += 15;    // Divergence = dispute leverage
  if (factors.bureauReporting === 1) score += 10; // Only on one bureau, easier

  // Dispute history
  if (factors.previousDisputes === 0) score += 10; // First time = fresh approach
  if (factors.wasEverDeleted) score += 20;   // Already deleted elsewhere = strong case
  if (factors.previousDisputes > 3) score -= 15; // Many failed attempts

  // Evidence
  if (factors.evidenceStrength === "STRONG") score += 15;
  if (factors.evidenceStrength === "MODERATE") score += 8;
  if (factors.evidenceStrength === "WEAK") score += 3;

  // Legal factors
  score += factors.potentialViolations.length * 8;
  if (factors.isTimeBared) score += 20;      // Past SOL = must be removed

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Calculate success likelihood based on factors
 */
function calculateSuccessLikelihood(factors: WorthinessFactors): number {
  let likelihood = 30; // Base likelihood

  // Positive factors
  if (factors.derogAge > 60) likelihood += 20;
  if (factors.hasDivergence) likelihood += 15;
  if (factors.wasEverDeleted) likelihood += 25;
  if (factors.evidenceStrength === "STRONG") likelihood += 15;
  if (factors.potentialViolations.length > 0) likelihood += 10;
  if (factors.isTimeBared) likelihood += 30;
  if (factors.bureauReporting === 1) likelihood += 10;
  if (factors.balance === 0) likelihood += 10;

  // Negative factors
  if (factors.derogAge < 12) likelihood -= 15;
  if (factors.previousDisputes > 2 && !factors.wasEverDeleted) likelihood -= 20;
  if (factors.balance > 10000 && factors.isCollection) likelihood -= 10;

  return Math.max(5, Math.min(85, Math.round(likelihood)));
}

/**
 * Calculate priority score (combines worthiness with urgency)
 */
function calculatePriorityScore(factors: WorthinessFactors, worthinessScore: number): number {
  let priority = worthinessScore;

  // Urgency modifiers
  if (factors.statuteOfLimitations < 12) priority += 20; // Near obsolescence
  if (factors.isTimeBared) priority += 15;
  if (factors.balance > 5000) priority += 10;

  // Lower priority for previously stalled items
  const recentStalls = factors.previousOutcomes.filter(o => o === "STALL_LETTER").length;
  if (recentStalls > 1) priority -= 15;

  return Math.max(0, Math.min(100, Math.round(priority)));
}

// =============================================================================
// STRATEGY RECOMMENDATION
// =============================================================================

/**
 * Determine the recommended dispute approach
 */
function determineApproach(
  factors: WorthinessFactors,
  previousOutcomes: DisputeOutcome[]
): { primary: DisputeApproach; alternatives: DisputeApproach[] } {
  const approaches: DisputeApproach[] = [];

  // Collections always get debt validation first
  if (factors.isCollection && !previousOutcomes.includes("VERIFIED")) {
    approaches.push("DEBT_VALIDATION");
  }

  // If previously verified, challenge the verification method
  if (previousOutcomes.includes("VERIFIED")) {
    approaches.push("METHOD_OF_VERIFICATION");
  }

  // Time-barred items
  if (factors.isTimeBared) {
    approaches.push("OBSOLETE_DATA");
  }

  // Bureau divergence suggests accuracy issues
  if (factors.hasDivergence) {
    approaches.push("STANDARD_ACCURACY");
  }

  // Specific violations
  if (factors.potentialViolations.some(v => v.includes("FCRA"))) {
    approaches.push("FCRA_VIOLATION");
  }
  if (factors.potentialViolations.some(v => v.includes("FDCPA"))) {
    approaches.push("FDCPA_VIOLATION");
  }
  if (factors.potentialViolations.some(v => v.includes("Re-aging"))) {
    approaches.push("RE_AGING_VIOLATION");
  }
  if (factors.potentialViolations.some(v => v.includes("Duplicate"))) {
    approaches.push("DUPLICATE_ACCOUNT");
  }

  // Paid accounts can try goodwill
  if (factors.balance === 0 && factors.hasLatePayments && !factors.isCollection) {
    approaches.push("GOODWILL");
  }

  // Default to standard accuracy if nothing else
  if (approaches.length === 0) {
    approaches.push("STANDARD_ACCURACY");
  }

  // Always have Metro2 as a backup
  approaches.push("METRO2_COMPLIANCE");

  return {
    primary: approaches[0],
    alternatives: approaches.slice(1, 4), // Max 3 alternatives
  };
}

/**
 * Determine the recommended flow
 */
function determineFlow(factors: WorthinessFactors): "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO" {
  if (factors.isCollection) {
    if (factors.hasLatePayments || factors.isChargeOff) {
      return "COMBO";
    }
    return "COLLECTION";
  }

  if (factors.hasLatePayments || factors.isChargeOff) {
    return "ACCURACY";
  }

  return "ACCURACY";
}

/**
 * Determine timing recommendation
 */
function determineTiming(
  factors: WorthinessFactors,
  successLikelihood: number
): { timing: DisputeWorthiness["timing"]; reason: string } {
  // Time-barred = immediate
  if (factors.isTimeBared) {
    return {
      timing: "IMMEDIATE",
      reason: "Item is past the 7-year reporting limit and must be removed",
    };
  }

  // Near obsolescence = immediate
  if (factors.statuteOfLimitations < 12) {
    return {
      timing: "IMMEDIATE",
      reason: "Item will fall off within 12 months - dispute now for faster removal",
    };
  }

  // High success likelihood = immediate
  if (successLikelihood >= 60) {
    return {
      timing: "IMMEDIATE",
      reason: "High likelihood of successful removal based on account factors",
    };
  }

  // Multiple failed attempts = strategic hold
  if (factors.previousDisputes >= 3 && !factors.wasEverDeleted) {
    return {
      timing: "STRATEGIC_HOLD",
      reason: "Multiple previous attempts unsuccessful - consider alternative strategies or waiting",
    };
  }

  // Very recent items = wait
  if (factors.derogAge < 6) {
    return {
      timing: "WAIT",
      reason: "Item is very recent - allow time for data furnisher reporting to stabilize",
    };
  }

  // Default
  return {
    timing: "NEXT_ROUND",
    reason: "Standard priority - include in next dispute round",
  };
}

/**
 * Estimate score impact if item is deleted
 */
function estimateScoreImpact(factors: WorthinessFactors): { impact: number; reason: string } {
  let impact = 0;
  const reasons: string[] = [];

  if (factors.isCollection) {
    impact += 20;
    reasons.push("Collection removal typically adds 15-25 points");
  }

  if (factors.isChargeOff) {
    impact += 25;
    reasons.push("Charge-off removal can add 20-30 points");
  }

  if (factors.hasLatePayments) {
    impact += 15;
    reasons.push("Late payment removal improves payment history");
  }

  if (factors.balance > 5000) {
    impact += 10;
    reasons.push("High balance removal reduces debt-to-credit impact");
  }

  if (factors.derogAge < 24) {
    impact += 10;
    reasons.push("Recent negative items have higher score impact");
  }

  // Recent derogs hurt more
  if (factors.derogAge < 12) {
    impact += 15;
  }

  return {
    impact: Math.min(50, impact), // Cap at 50 points
    reason: reasons.join("; ") || "Standard removal impact",
  };
}

// =============================================================================
// MAIN WORTHINESS ASSESSMENT
// =============================================================================

/**
 * Generate a complete worthiness assessment for a disputable item
 */
export function assessDisputeWorthiness(input: WorthinessInput): DisputeWorthiness {
  const factors = extractWorthinessFactors(input);

  const worthinessScore = calculateWorthinessScore(factors);
  const successLikelihood = calculateSuccessLikelihood(factors);
  const priorityScore = calculatePriorityScore(factors, worthinessScore);

  const { timing, reason: timingReason } = determineTiming(factors, successLikelihood);
  const { primary: recommendedApproach, alternatives: alternativeApproaches } = determineApproach(
    factors,
    factors.previousOutcomes
  );
  const recommendedFlow = determineFlow(factors);

  const { impact: estimatedScoreImpact, reason: impactReason } = estimateScoreImpact(factors);

  // Determine expected outcome
  let expectedOutcome: DisputeOutcome = "VERIFIED";
  let confidenceLevel: DisputeWorthiness["confidenceLevel"] = "MEDIUM";

  if (successLikelihood >= 60) {
    expectedOutcome = "DELETED";
    confidenceLevel = "HIGH";
  } else if (successLikelihood >= 40) {
    expectedOutcome = "UPDATED";
    confidenceLevel = "MEDIUM";
  } else {
    expectedOutcome = "VERIFIED";
    confidenceLevel = "LOW";
  }

  return {
    accountItemId: input.account.id,
    creditorName: input.account.creditorName,
    accountNumber: input.account.accountNumber,

    worthinessScore,
    priorityScore,
    successLikelihood,

    factors,

    timing,
    timingReason,

    recommendedFlow,
    recommendedApproach,
    alternativeApproaches,

    expectedOutcome,
    confidenceLevel,

    estimatedScoreImpact,
    impactReason,
  };
}

/**
 * Rank multiple items by dispute priority
 */
export function rankDisputeWorthiness(
  items: WorthinessInput[]
): DisputeWorthiness[] {
  const assessments = items.map(assessDisputeWorthiness);

  // Sort by priority score (highest first), then worthiness, then success likelihood
  return assessments.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }
    if (b.worthinessScore !== a.worthinessScore) {
      return b.worthinessScore - a.worthinessScore;
    }
    return b.successLikelihood - a.successLikelihood;
  });
}
