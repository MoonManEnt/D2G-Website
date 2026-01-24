/**
 * Dispute Intelligence Engine
 *
 * Provides comprehensive dispute analysis including:
 * - Worthiness scoring for disputable items
 * - Response tracking and analysis
 * - Adaptive strategy based on CRA responses
 * - Round progression recommendations
 * - Context generation for AMELIA letter adaptation
 *
 * Usage:
 * ```typescript
 * import {
 *   assessDisputeWorthiness,
 *   rankDisputeWorthiness,
 *   buildNextRoundContext,
 *   summarizeResponses,
 * } from "@/lib/dispute-intelligence";
 *
 * // Assess a single item
 * const worthiness = assessDisputeWorthiness({
 *   account: {...},
 *   allAccountsWithFingerprint: [...],
 *   disputeHistory: [...],
 *   hasEvidence: true,
 * });
 *
 * // Build context for next round letter
 * const context = buildNextRoundContext(dispute);
 * ```
 */

// Worthiness scoring
export {
  assessDisputeWorthiness,
  rankDisputeWorthiness,
  extractWorthinessFactors,
} from "./worthiness";

// Adaptive strategy
export {
  summarizeResponses,
  buildNextRoundContext,
  getAdaptationRules,
  generateAdaptedOpening,
  generateEscalationParagraph,
} from "./adaptive-strategy";

// Types
export type {
  // Response types
  DisputeOutcome,
  StallTactic,
  UpdateType,
  DisputeResponse,
  DisputeResponseSummary,

  // Worthiness types
  WorthinessFactors,
  DisputeWorthiness,
  DisputeApproach,

  // Strategy types
  NextRoundAction,
  NextRoundContext,
  ItemRoundContext,
  LetterAdaptationRules,

  // Intelligence report types
  DisputeIntelligenceReport,
  ActiveDisputeStatus,
  RoundProgression,
  ScheduledAction,
} from "./types";

// Adaptation rules constant
export { ADAPTATION_RULES } from "./types";

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

import type { DisputeOutcome, NextRoundAction } from "./types";

/**
 * Get a human-readable label for a dispute outcome
 */
export function getOutcomeLabel(outcome: DisputeOutcome): string {
  const labels: Record<DisputeOutcome, string> = {
    DELETED: "Deleted",
    VERIFIED: "Verified",
    UPDATED: "Updated",
    NO_RESPONSE: "No Response",
    STALL_LETTER: "Stall Letter",
    PENDING: "Pending",
    IN_DISPUTE: "In Dispute",
    NOT_DISPUTED: "Not Disputed",
  };
  return labels[outcome];
}

/**
 * Get the color for a dispute outcome (for UI)
 */
export function getOutcomeColor(outcome: DisputeOutcome): {
  bg: string;
  text: string;
  border: string;
} {
  const colors: Record<DisputeOutcome, { bg: string; text: string; border: string }> = {
    DELETED: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
    VERIFIED: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
    UPDATED: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
    NO_RESPONSE: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
    STALL_LETTER: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
    PENDING: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    IN_DISPUTE: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    NOT_DISPUTED: { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" },
  };
  return colors[outcome];
}

/**
 * Get a human-readable label for a next round action
 */
export function getNextActionLabel(action: NextRoundAction): string {
  const labels: Record<NextRoundAction, string> = {
    CELEBRATE: "All Items Resolved!",
    ESCALATE_SAME_CRA: "Continue with Next Round",
    TRY_DIFFERENT_CRA: "Switch to Different Bureau",
    ESCALATE_CFPB: "File CFPB Complaint",
    ESCALATE_FTC: "File FTC Complaint",
    ESCALATE_AG: "Contact Attorney General",
    LEGAL_REVIEW: "Review for Legal Action",
    STRATEGIC_PAUSE: "Wait Before Next Action",
    CLOSE_DISPUTE: "Close Dispute",
  };
  return labels[action];
}

/**
 * Get the icon for a next round action (for UI)
 */
export function getNextActionIcon(action: NextRoundAction): string {
  const icons: Record<NextRoundAction, string> = {
    CELEBRATE: "🎉",
    ESCALATE_SAME_CRA: "📨",
    TRY_DIFFERENT_CRA: "🔄",
    ESCALATE_CFPB: "🏛️",
    ESCALATE_FTC: "⚖️",
    ESCALATE_AG: "🏛️",
    LEGAL_REVIEW: "👨‍⚖️",
    STRATEGIC_PAUSE: "⏸️",
    CLOSE_DISPUTE: "✅",
  };
  return icons[action];
}

/**
 * Check if an outcome is considered successful
 */
export function isSuccessfulOutcome(outcome: DisputeOutcome): boolean {
  return outcome === "DELETED";
}

/**
 * Check if an outcome requires escalation
 */
export function requiresEscalation(outcome: DisputeOutcome): boolean {
  return ["VERIFIED", "NO_RESPONSE", "STALL_LETTER"].includes(outcome);
}

/**
 * Calculate days remaining until FCRA 30-day deadline
 */
export function calculateDaysRemaining(sentDate: Date): number {
  const deadline = new Date(sentDate);
  deadline.setDate(deadline.getDate() + 30);

  const now = new Date();
  const diffTime = deadline.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Check if a dispute is overdue (past 30-day FCRA deadline)
 */
export function isOverdue(sentDate: Date): boolean {
  return calculateDaysRemaining(sentDate) < 0;
}
