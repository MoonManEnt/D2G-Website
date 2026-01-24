/**
 * Credit DNA Engine - Main Classifier
 *
 * Combines all component analyses to determine the primary DNA classification
 * and generate the complete credit profile.
 */

import { v4 as uuid } from "uuid";
import {
  type DNAAnalysisInput,
  type CreditDNAProfile,
  type DNAClassification,
  type DNASubClassification,
} from "./types";
import {
  analyzeFileThickness,
  analyzeDerogatoryProfile,
  analyzeUtilization,
  analyzeBureauDivergence,
  analyzeInquiries,
  analyzePositiveFactors,
  analyzeDisputeReadiness,
} from "./analyzers";

// =============================================================================
// CLASSIFICATION LOGIC
// =============================================================================

interface ClassificationResult {
  classification: DNAClassification;
  confidence: number;
  reasoning: string;
}

function determineClassification(
  fileThickness: ReturnType<typeof analyzeFileThickness>,
  derogatoryProfile: ReturnType<typeof analyzeDerogatoryProfile>,
  utilization: ReturnType<typeof analyzeUtilization>,
  bureauDivergence: ReturnType<typeof analyzeBureauDivergence>,
  inquiryAnalysis: ReturnType<typeof analyzeInquiries>,
  positiveFactors: ReturnType<typeof analyzePositiveFactors>
): ClassificationResult {
  // Priority-based classification - check most specific conditions first

  // 1. Identity Issues (mixed file indicators)
  if (bureauDivergence.divergence === "SEVERE" && bureauDivergence.accountsOnOneOnly > 5) {
    return {
      classification: "IDENTITY_ISSUES",
      confidence: 85,
      reasoning: "Severe bureau divergence with many accounts appearing on only one bureau suggests potential mixed file",
    };
  }

  // 2. Collection Heavy (dominant pattern)
  if (fileThickness.collectionAccounts >= 3 &&
      fileThickness.collectionAccounts >= fileThickness.totalAccounts * 0.4) {
    return {
      classification: "COLLECTION_HEAVY",
      confidence: 90,
      reasoning: `${fileThickness.collectionAccounts} collection accounts represent over 40% of the credit file`,
    };
  }

  // 3. Charge-Off Heavy
  if (derogatoryProfile.chargeOffCount >= 3) {
    return {
      classification: "CHARGE_OFF_HEAVY",
      confidence: 85,
      reasoning: `${derogatoryProfile.chargeOffCount} charge-off accounts indicate significant past credit damage`,
    };
  }

  // 4. Late Payment Pattern
  if (derogatoryProfile.latePaymentAccounts >= 3 &&
      (derogatoryProfile.late60Count + derogatoryProfile.late90Count + derogatoryProfile.late120PlusCount) >= 5) {
    return {
      classification: "LATE_PAYMENT_PATTERN",
      confidence: 88,
      reasoning: "Systemic late payment history across multiple accounts",
    };
  }

  // 5. Inquiry Damaged
  if (inquiryAnalysis.status === "EXCESSIVE" && inquiryAnalysis.inquiriesLast12Months >= 8) {
    return {
      classification: "INQUIRY_DAMAGED",
      confidence: 80,
      reasoning: `${inquiryAnalysis.inquiriesLast12Months} hard inquiries in the last 12 months is causing significant score suppression`,
    };
  }

  // 6. High Utilization (otherwise decent file)
  if (utilization.status === "CRITICAL" &&
      (derogatoryProfile.severity === "NONE" || derogatoryProfile.severity === "LIGHT")) {
    return {
      classification: "HIGH_UTILIZATION",
      confidence: 85,
      reasoning: `${utilization.overallUtilization}% utilization on otherwise clean accounts is the primary score factor`,
    };
  }

  // 7. Thick File Derog (many accounts + many derogs)
  if (fileThickness.thickness === "THICK" || fileThickness.thickness === "VERY_THICK") {
    if (derogatoryProfile.severity === "HEAVY" || derogatoryProfile.severity === "SEVERE") {
      return {
        classification: "THICK_FILE_DEROG",
        confidence: 90,
        reasoning: `Established credit history with ${fileThickness.totalAccounts} accounts but ${derogatoryProfile.totalDerogatoryItems} derogatory items`,
      };
    }
  }

  // 8. Recovering (past damage, recent improvement)
  if (derogatoryProfile.newestDerogAge > 24 && // No new derogs in 2 years
      derogatoryProfile.severity !== "NONE" &&
      positiveFactors.wellManagedAccounts >= 2) {
    return {
      classification: "RECOVERING",
      confidence: 75,
      reasoning: "Past credit damage with recent positive momentum - no new derogatory items in 24+ months",
    };
  }

  // 9. Near Prime (minor issues holding back good file)
  if ((fileThickness.thickness === "MODERATE" || fileThickness.thickness === "THICK") &&
      (derogatoryProfile.severity === "LIGHT" || derogatoryProfile.severity === "NONE") &&
      positiveFactors.strength !== "WEAK") {
    if (derogatoryProfile.totalDerogatoryItems <= 2 || utilization.status === "FAIR") {
      return {
        classification: "NEAR_PRIME",
        confidence: 80,
        reasoning: "Solid credit foundation with minor issues preventing prime status",
      };
    }
  }

  // 10. Clean Thin (few accounts, all positive)
  if ((fileThickness.thickness === "ULTRA_THIN" || fileThickness.thickness === "THIN") &&
      derogatoryProfile.severity === "NONE") {
    return {
      classification: "CLEAN_THIN",
      confidence: 85,
      reasoning: "Limited credit history but all accounts in good standing - needs seasoning",
    };
  }

  // 11. Thin File Rebuilder (few accounts with some issues)
  if (fileThickness.thickness === "ULTRA_THIN" || fileThickness.thickness === "THIN") {
    return {
      classification: "THIN_FILE_REBUILDER",
      confidence: 80,
      reasoning: `Only ${fileThickness.totalAccounts} accounts with ${derogatoryProfile.totalDerogatoryItems} negative items - needs both rebuilding and repair`,
    };
  }

  // 12. Mixed File (default for complex situations)
  return {
    classification: "MIXED_FILE",
    confidence: 70,
    reasoning: "Complex credit profile with varying positive and negative factors",
  };
}

// =============================================================================
// SUB-CLASSIFICATION LOGIC
// =============================================================================

function determineSubClassifications(
  fileThickness: ReturnType<typeof analyzeFileThickness>,
  derogatoryProfile: ReturnType<typeof analyzeDerogatoryProfile>,
  utilization: ReturnType<typeof analyzeUtilization>,
  bureauDivergence: ReturnType<typeof analyzeBureauDivergence>,
  inquiryAnalysis: ReturnType<typeof analyzeInquiries>,
  positiveFactors: ReturnType<typeof analyzePositiveFactors>
): DNASubClassification[] {
  const subClassifications: DNASubClassification[] = [];

  // Check for authorized user dependency
  // (would need additional data - skipping for now)

  // Single derog impact
  if (derogatoryProfile.totalDerogatoryItems === 1 &&
      derogatoryProfile.severityScore >= 20) {
    subClassifications.push("SINGLE_DEROG_IMPACT");
  }

  // Systemic late payments
  if (derogatoryProfile.latePaymentAccounts >= 3) {
    subClassifications.push("SYSTEMIC_LATE_PAYMENTS");
  }

  // Recent damage
  if (derogatoryProfile.newestDerogAge < 24 && derogatoryProfile.totalDerogatoryItems > 0) {
    subClassifications.push("RECENT_DAMAGE");
  }

  // Aged damage
  if (derogatoryProfile.oldestDerogAge > 60 && derogatoryProfile.totalDerogatoryItems > 0) {
    subClassifications.push("AGED_DAMAGE");
  }

  // Bureau divergent
  if (bureauDivergence.divergence === "MODERATE" ||
      bureauDivergence.divergence === "SIGNIFICANT" ||
      bureauDivergence.divergence === "SEVERE") {
    subClassifications.push("BUREAU_DIVERGENT");
  }

  // Rapid rescore candidate
  if (utilization.status === "CRITICAL" || utilization.status === "POOR") {
    if (derogatoryProfile.severity === "NONE" || derogatoryProfile.severity === "LIGHT") {
      subClassifications.push("RAPID_RESCORE_CANDIDATE");
    }
  }

  // Long term rebuild
  if (fileThickness.thickness === "ULTRA_THIN" ||
      (derogatoryProfile.severity === "SEVERE" && derogatoryProfile.newestDerogAge < 12)) {
    subClassifications.push("LONG_TERM_REBUILD");
  }

  return subClassifications;
}

// =============================================================================
// SUMMARY GENERATION
// =============================================================================

function generateSummary(
  classification: DNAClassification,
  fileThickness: ReturnType<typeof analyzeFileThickness>,
  derogatoryProfile: ReturnType<typeof analyzeDerogatoryProfile>,
  utilization: ReturnType<typeof analyzeUtilization>,
  disputeReadiness: ReturnType<typeof analyzeDisputeReadiness>
): string {
  const summaries: Record<DNAClassification, string> = {
    THIN_FILE_REBUILDER: `This client has a thin credit file with ${fileThickness.totalAccounts} accounts and needs both credit building and repair. Focus on disputing negative items while establishing new positive tradelines.`,

    THICK_FILE_DEROG: `Established credit history with ${fileThickness.totalAccounts} accounts, but ${derogatoryProfile.totalDerogatoryItems} derogatory items are suppressing the score. The dispute strategy should be aggressive given the strong account foundation.`,

    CLEAN_THIN: `A clean but thin credit file with no derogatory items. The primary need is account seasoning and building credit history, not disputes. Consider authorized user strategies.`,

    COLLECTION_HEAVY: `Collections dominate this credit file (${fileThickness.collectionAccounts} accounts). The ${disputeReadiness.recommendedFlow} flow is recommended, focusing on debt validation and deletion strategies.`,

    LATE_PAYMENT_PATTERN: `A pattern of late payments across ${derogatoryProfile.latePaymentAccounts} accounts suggests systemic issues. Focus on goodwill removals and accuracy disputes for the oldest late payments first.`,

    MIXED_FILE: `A complex credit profile with both positive and negative factors. A balanced approach addressing ${derogatoryProfile.totalDerogatoryItems} derogatory items while maintaining ${fileThickness.openAccounts} open accounts is recommended.`,

    INQUIRY_DAMAGED: `Recent hard inquiries are significantly impacting the score. While these fall off naturally in 24 months, disputing unauthorized inquiries can provide faster relief.`,

    CHARGE_OFF_HEAVY: `Multiple charge-offs (${derogatoryProfile.chargeOffCount}) are the primary score suppressors. Focus on pay-for-delete negotiations and accuracy disputes.`,

    IDENTITY_ISSUES: `Significant bureau divergence suggests potential mixed file or identity issues. Recommend starting with personal information disputes and identity verification before account disputes.`,

    HIGH_UTILIZATION: `Credit utilization at ${utilization.overallUtilization}% is the primary issue on an otherwise clean file. Paying down balances could yield rapid score improvement without needing disputes.`,

    RECOVERING: `This file shows past credit damage but recent positive momentum. Continue building positive history while disputing older derogatory items that may be easier to remove.`,

    NEAR_PRIME: `A solid credit foundation with minor issues. Strategic disputes of ${derogatoryProfile.totalDerogatoryItems} derogatory items could push this client into prime territory.`,
  };

  return summaries[classification];
}

function generateKeyInsights(
  fileThickness: ReturnType<typeof analyzeFileThickness>,
  derogatoryProfile: ReturnType<typeof analyzeDerogatoryProfile>,
  utilization: ReturnType<typeof analyzeUtilization>,
  bureauDivergence: ReturnType<typeof analyzeBureauDivergence>,
  inquiryAnalysis: ReturnType<typeof analyzeInquiries>,
  positiveFactors: ReturnType<typeof analyzePositiveFactors>,
  disputeReadiness: ReturnType<typeof analyzeDisputeReadiness>
): string[] {
  const insights: string[] = [];

  // File thickness insight
  if (fileThickness.thickness === "ULTRA_THIN" || fileThickness.thickness === "THIN") {
    insights.push(`Thin file with only ${fileThickness.totalAccounts} accounts - credit building needed alongside repairs`);
  } else if (fileThickness.thickness === "VERY_THICK") {
    insights.push(`Thick file with ${fileThickness.totalAccounts} accounts provides strong foundation for dispute strategy`);
  }

  // Derogatory insight
  if (derogatoryProfile.totalDerogatoryItems > 0) {
    if (derogatoryProfile.newestDerogAge > 48) {
      insights.push(`Oldest derogatory items are ${Math.round(derogatoryProfile.oldestDerogAge / 12)} years old - higher removal likelihood`);
    } else if (derogatoryProfile.newestDerogAge < 12) {
      insights.push(`Recent derogatory activity within the last year - may need multiple dispute rounds`);
    }
  }

  // Utilization insight
  if (utilization.status === "CRITICAL" || utilization.status === "POOR") {
    insights.push(`High utilization (${utilization.overallUtilization}%) causing ~${utilization.estimatedScoreImpact} point score suppression`);
  }

  // Collection balance insight
  if (derogatoryProfile.totalCollectionBalance > 0) {
    insights.push(`$${derogatoryProfile.totalCollectionBalance.toLocaleString()} in collection balances - pay-for-delete may be viable`);
  }

  // Bureau divergence insight
  if (bureauDivergence.divergence !== "ALIGNED" && bureauDivergence.divergence !== "MINOR") {
    insights.push(`Bureau divergence detected - different dispute strategies may be needed per bureau`);
  }

  // Positive factors insight
  if (positiveFactors.perfectPaymentAccounts >= 3) {
    insights.push(`${positiveFactors.perfectPaymentAccounts} accounts with perfect payment history strengthen dispute position`);
  }

  // Dispute readiness insight
  insights.push(`${disputeReadiness.highPriorityItems} high-priority items identified for immediate dispute action`);

  return insights.slice(0, 5); // Return top 5
}

function generateImmediateActions(
  classification: DNAClassification,
  disputeReadiness: ReturnType<typeof analyzeDisputeReadiness>,
  utilization: ReturnType<typeof analyzeUtilization>,
  bureauDivergence: ReturnType<typeof analyzeBureauDivergence>
): string[] {
  const actions: string[] = [];

  // Always recommend starting disputes if there are items
  if (disputeReadiness.highPriorityItems > 0) {
    actions.push(`Initiate ${disputeReadiness.recommendedFlow} flow disputes with ${disputeReadiness.recommendedFirstBureau} first`);
  }

  // Utilization action
  if (utilization.status === "CRITICAL" || utilization.status === "POOR") {
    actions.push(`Reduce credit utilization to under 30% for potential quick score gains`);
  }

  // Bureau-specific actions
  if (bureauDivergence.missingFromBureaus.length > 0) {
    actions.push(`Review accounts missing from bureaus for potential disputes or reporting corrections`);
  }

  // Classification-specific actions
  if (classification === "THIN_FILE_REBUILDER" || classification === "CLEAN_THIN") {
    actions.push(`Consider authorized user tradelines or secured credit to build file thickness`);
  }

  if (classification === "COLLECTION_HEAVY") {
    actions.push(`Send debt validation letters before standard dispute process`);
  }

  if (classification === "INQUIRY_DAMAGED") {
    actions.push(`Review hard inquiries for unauthorized pulls that can be disputed`);
  }

  if (classification === "IDENTITY_ISSUES") {
    actions.push(`Dispute personal information variations before addressing accounts`);
  }

  // Always include monitoring
  actions.push(`Set up credit monitoring to track dispute progress and detect new activity`);

  return actions.slice(0, 5); // Return top 5
}

// =============================================================================
// HEALTH SCORE CALCULATION
// =============================================================================

function calculateOverallHealthScore(
  fileThickness: ReturnType<typeof analyzeFileThickness>,
  derogatoryProfile: ReturnType<typeof analyzeDerogatoryProfile>,
  utilization: ReturnType<typeof analyzeUtilization>,
  inquiryAnalysis: ReturnType<typeof analyzeInquiries>,
  positiveFactors: ReturnType<typeof analyzePositiveFactors>
): number {
  let score = 100;

  // Deduct for derogatory items (max -40)
  score -= Math.min(40, derogatoryProfile.severityScore * 0.4);

  // Deduct for utilization (max -20)
  if (utilization.overallUtilization > 30) {
    score -= Math.min(20, (utilization.overallUtilization - 30) * 0.4);
  }

  // Deduct for thin file (max -15)
  if (fileThickness.thickness === "ULTRA_THIN") {
    score -= 15;
  } else if (fileThickness.thickness === "THIN") {
    score -= 10;
  }

  // Deduct for inquiries (max -10)
  score -= Math.min(10, inquiryAnalysis.inquiriesLast12Months * 1.5);

  // Add for positive factors (max +10)
  score += Math.min(10, positiveFactors.strengthScore * 0.1);

  return Math.max(0, Math.min(100, Math.round(score)));
}

function calculateImprovementPotential(
  derogatoryProfile: ReturnType<typeof analyzeDerogatoryProfile>,
  utilization: ReturnType<typeof analyzeUtilization>,
  disputeReadiness: ReturnType<typeof analyzeDisputeReadiness>
): number {
  let potential = 0;

  // Potential from dispute removals
  potential += disputeReadiness.estimatedScoreImprovement;

  // Potential from utilization improvement
  if (utilization.overallUtilization > 30) {
    potential += utilization.estimatedScoreImpact;
  }

  // Potential from aged derog falling off (if waiting is viable)
  if (derogatoryProfile.oldestDerogAge > 60) {
    potential += 10;
  }

  return Math.min(100, Math.round(potential));
}

function calculateUrgencyScore(
  derogatoryProfile: ReturnType<typeof analyzeDerogatoryProfile>,
  inquiryAnalysis: ReturnType<typeof analyzeInquiries>
): number {
  let urgency = 50; // Base

  // Increase for recent damage
  if (derogatoryProfile.newestDerogAge < 12) {
    urgency += 20;
  } else if (derogatoryProfile.newestDerogAge < 24) {
    urgency += 10;
  }

  // Increase for high severity
  if (derogatoryProfile.severity === "SEVERE") {
    urgency += 15;
  } else if (derogatoryProfile.severity === "HEAVY") {
    urgency += 10;
  }

  // Decrease for aged items (less urgent, more time to strategize)
  if (derogatoryProfile.oldestDerogAge > 60) {
    urgency -= 10;
  }

  // Increase for excessive inquiries (time-sensitive)
  if (inquiryAnalysis.status === "EXCESSIVE") {
    urgency += 10;
  }

  return Math.max(0, Math.min(100, urgency));
}

// =============================================================================
// MAIN ANALYZER FUNCTION
// =============================================================================

export function analyzeCreditDNA(input: DNAAnalysisInput): CreditDNAProfile {
  const startTime = Date.now();

  // Run all component analyses
  const fileThickness = analyzeFileThickness(input.accounts);
  const derogatoryProfile = analyzeDerogatoryProfile(input.accounts);
  const utilization = analyzeUtilization(input.accounts);
  const bureauDivergence = analyzeBureauDivergence(input.accounts);
  const inquiryAnalysis = analyzeInquiries(input.hardInquiries);
  const positiveFactors = analyzePositiveFactors(input.accounts);
  const disputeReadiness = analyzeDisputeReadiness(
    input.accounts,
    derogatoryProfile,
    bureauDivergence
  );

  // Determine classification
  const { classification, confidence, reasoning } = determineClassification(
    fileThickness,
    derogatoryProfile,
    utilization,
    bureauDivergence,
    inquiryAnalysis,
    positiveFactors
  );

  // Determine sub-classifications
  const subClassifications = determineSubClassifications(
    fileThickness,
    derogatoryProfile,
    utilization,
    bureauDivergence,
    inquiryAnalysis,
    positiveFactors
  );

  // Calculate scores
  const overallHealthScore = calculateOverallHealthScore(
    fileThickness,
    derogatoryProfile,
    utilization,
    inquiryAnalysis,
    positiveFactors
  );

  const improvementPotential = calculateImprovementPotential(
    derogatoryProfile,
    utilization,
    disputeReadiness
  );

  const urgencyScore = calculateUrgencyScore(
    derogatoryProfile,
    inquiryAnalysis
  );

  // Generate narratives
  const summary = generateSummary(
    classification,
    fileThickness,
    derogatoryProfile,
    utilization,
    disputeReadiness
  );

  const keyInsights = generateKeyInsights(
    fileThickness,
    derogatoryProfile,
    utilization,
    bureauDivergence,
    inquiryAnalysis,
    positiveFactors,
    disputeReadiness
  );

  const immediateActions = generateImmediateActions(
    classification,
    disputeReadiness,
    utilization,
    bureauDivergence
  );

  // Determine confidence level
  let confidenceLevel: CreditDNAProfile["confidenceLevel"];
  if (confidence >= 85) {
    confidenceLevel = "HIGH";
  } else if (confidence >= 70) {
    confidenceLevel = "MEDIUM";
  } else {
    confidenceLevel = "LOW";
  }

  const computeTimeMs = Date.now() - startTime;

  return {
    id: uuid(),
    clientId: input.clientId,
    reportId: input.reportId,
    analyzedAt: new Date(),

    classification,
    subClassifications,
    confidence,
    confidenceLevel,

    fileThickness,
    derogatoryProfile,
    utilization,
    bureauDivergence,
    inquiryAnalysis,
    positiveFactors,
    disputeReadiness,

    overallHealthScore,
    improvementPotential,
    urgencyScore,

    summary,
    keyInsights,
    immediateActions,

    version: "1.0.0",
    computeTimeMs,
  };
}
