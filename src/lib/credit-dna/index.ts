/**
 * Credit DNA Engine
 *
 * Analyzes credit profiles and classifies them into actionable DNA types
 * that drive dispute strategy, sequencing, and recommendations.
 *
 * Usage:
 * ```typescript
 * import { analyzeCreditDNA, type CreditDNAProfile } from "@/lib/credit-dna";
 *
 * const dnaProfile = analyzeCreditDNA({
 *   clientId: "...",
 *   reportId: "...",
 *   accounts: [...],
 *   scores: [...],
 *   hardInquiries: [...],
 *   previousNames: [...],
 *   previousAddresses: [...],
 * });
 *
 * console.log(dnaProfile.classification); // "COLLECTION_HEAVY"
 * console.log(dnaProfile.summary); // Human-readable summary
 * console.log(dnaProfile.immediateActions); // Recommended next steps
 * ```
 */

// Main analyzer
export { analyzeCreditDNA } from "./classifier";

// Component analyzers (for advanced usage)
export {
  analyzeFileThickness,
  analyzeDerogatoryProfile,
  analyzeUtilization,
  analyzeBureauDivergence,
  analyzeInquiries,
  analyzePositiveFactors,
  analyzeDisputeReadiness,
} from "./analyzers";

// Types
export type {
  // Main types
  DNAClassification,
  DNASubClassification,
  CreditDNAProfile,
  DNAAnalysisInput,

  // Component types
  FileThicknessMetrics,
  DerogatoryProfile,
  UtilizationAnalysis,
  BureauDivergence,
  InquiryAnalysis,
  PositiveFactors,
  DisputeReadiness,

  // Input types
  AccountForAnalysis,
  AccountIssue,
  ScoreForAnalysis,
  InquiryForAnalysis,
} from "./types";

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

import { type DNAClassification } from "./types";

/**
 * Get a human-readable label for a DNA classification
 */
export function getDNAClassificationLabel(classification: DNAClassification): string {
  const labels: Record<DNAClassification, string> = {
    THIN_FILE_REBUILDER: "Thin File Rebuilder",
    THICK_FILE_DEROG: "Thick File with Derogatories",
    CLEAN_THIN: "Clean Thin File",
    COLLECTION_HEAVY: "Collection Heavy",
    LATE_PAYMENT_PATTERN: "Late Payment Pattern",
    MIXED_FILE: "Mixed File",
    INQUIRY_DAMAGED: "Inquiry Damaged",
    CHARGE_OFF_HEAVY: "Charge-Off Heavy",
    IDENTITY_ISSUES: "Identity Issues",
    HIGH_UTILIZATION: "High Utilization",
    RECOVERING: "Recovering",
    NEAR_PRIME: "Near Prime",
  };
  return labels[classification];
}

/**
 * Get a short description for a DNA classification
 */
export function getDNAClassificationDescription(classification: DNAClassification): string {
  const descriptions: Record<DNAClassification, string> = {
    THIN_FILE_REBUILDER: "Limited credit history with negative items - needs building and repair",
    THICK_FILE_DEROG: "Established credit history with significant derogatory items",
    CLEAN_THIN: "Limited but positive credit history - needs seasoning",
    COLLECTION_HEAVY: "Credit file dominated by collection accounts",
    LATE_PAYMENT_PATTERN: "History of late payments across multiple accounts",
    MIXED_FILE: "Complex mix of positive and negative credit factors",
    INQUIRY_DAMAGED: "Score suppressed by excessive recent hard inquiries",
    CHARGE_OFF_HEAVY: "Multiple charge-off accounts impacting score",
    IDENTITY_ISSUES: "Potential mixed file or identity verification problems",
    HIGH_UTILIZATION: "Good accounts but maxed out credit limits",
    RECOVERING: "Past damage with recent positive momentum",
    NEAR_PRIME: "Close to prime status with minor cleanup needed",
  };
  return descriptions[classification];
}

/**
 * Get the recommended primary strategy for a DNA classification
 */
export function getDNARecommendedStrategy(classification: DNAClassification): string {
  const strategies: Record<DNAClassification, string> = {
    THIN_FILE_REBUILDER: "Parallel approach: dispute negatives while building positive tradelines",
    THICK_FILE_DEROG: "Aggressive dispute strategy leveraging strong account foundation",
    CLEAN_THIN: "Focus on credit building - authorized users, secured cards, credit-builder loans",
    COLLECTION_HEAVY: "Debt validation first, then accuracy disputes, consider pay-for-delete",
    LATE_PAYMENT_PATTERN: "Goodwill removal requests combined with accuracy disputes",
    MIXED_FILE: "Balanced approach addressing highest-impact items first",
    INQUIRY_DAMAGED: "Dispute unauthorized inquiries, wait for natural falloff on others",
    CHARGE_OFF_HEAVY: "Negotiate pay-for-delete, dispute inaccuracies, consider settlements",
    IDENTITY_ISSUES: "Personal information cleanup first, then account disputes",
    HIGH_UTILIZATION: "Pay down balances before disputing - quick wins available",
    RECOVERING: "Continue positive behavior, dispute aged negative items",
    NEAR_PRIME: "Strategic targeted disputes on remaining negative items",
  };
  return strategies[classification];
}

/**
 * Get the color associated with a DNA classification (for UI)
 */
export function getDNAClassificationColor(classification: DNAClassification): {
  bg: string;
  text: string;
  border: string;
} {
  const colors: Record<DNAClassification, { bg: string; text: string; border: string }> = {
    THIN_FILE_REBUILDER: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
    THICK_FILE_DEROG: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
    CLEAN_THIN: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
    COLLECTION_HEAVY: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
    LATE_PAYMENT_PATTERN: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
    MIXED_FILE: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    INQUIRY_DAMAGED: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
    CHARGE_OFF_HEAVY: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
    IDENTITY_ISSUES: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
    HIGH_UTILIZATION: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
    RECOVERING: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
    NEAR_PRIME: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
  };
  return colors[classification];
}
