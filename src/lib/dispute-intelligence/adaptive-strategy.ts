/**
 * Adaptive Strategy Engine
 *
 * Determines the next round strategy based on CRA responses.
 * Builds context for AMELIA to generate appropriately escalated letters.
 */

import {
  type DisputeOutcome,
  type StallTactic,
  type NextRoundAction,
  type NextRoundContext,
  type ItemRoundContext,
  type DisputeResponseSummary,
  type DisputeApproach,
  type LetterAdaptationRules,
  ADAPTATION_RULES,
} from "./types";

// =============================================================================
// RESPONSE ANALYSIS
// =============================================================================

interface ResponseForAnalysis {
  disputeItemId: string;
  creditorName: string;
  accountNumber: string;
  outcome: DisputeOutcome;
  stallTactic?: StallTactic;
  updateType?: string;
  verificationMethod?: string;
  daysToRespond: number;
  wasLate: boolean;
}

interface DisputeForAnalysis {
  id: string;
  cra: "TRANSUNION" | "EXPERIAN" | "EQUIFAX";
  flow: "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO";
  round: number;
  sentDate: Date;
  referenceNumber?: string;
  responses: ResponseForAnalysis[];
}

/**
 * Summarize responses for a dispute
 */
export function summarizeResponses(dispute: DisputeForAnalysis): DisputeResponseSummary {
  const breakdown = {
    deleted: 0,
    verified: 0,
    updated: 0,
    noResponse: 0,
    stallLetter: 0,
    pending: 0,
  };

  let totalDays = 0;
  let respondedCount = 0;
  let fcraViolations = 0;

  for (const response of dispute.responses) {
    switch (response.outcome) {
      case "DELETED":
        breakdown.deleted++;
        break;
      case "VERIFIED":
        breakdown.verified++;
        break;
      case "UPDATED":
        breakdown.updated++;
        break;
      case "NO_RESPONSE":
        breakdown.noResponse++;
        fcraViolations++;
        break;
      case "STALL_LETTER":
        breakdown.stallLetter++;
        break;
      case "PENDING":
      case "IN_DISPUTE":
        breakdown.pending++;
        break;
    }

    if (response.daysToRespond > 0) {
      totalDays += response.daysToRespond;
      respondedCount++;
    }

    if (response.wasLate) {
      fcraViolations++;
    }
  }

  const totalItems = dispute.responses.length;
  const successRate = totalItems > 0 ? (breakdown.deleted / totalItems) * 100 : 0;
  const avgDaysToRespond = respondedCount > 0 ? totalDays / respondedCount : 0;
  const needsEscalation = breakdown.verified + breakdown.updated + breakdown.noResponse + breakdown.stallLetter;

  // Determine recommended next action
  const recommendedNextAction = determineNextAction(breakdown, totalItems, fcraViolations);

  return {
    disputeId: dispute.id,
    totalItems,
    responseBreakdown: breakdown,
    successRate: Math.round(successRate),
    avgDaysToRespond: Math.round(avgDaysToRespond),
    fcraViolations,
    needsEscalation,
    recommendedNextAction,
  };
}

/**
 * Determine the recommended next action based on response breakdown
 */
function determineNextAction(
  breakdown: DisputeResponseSummary["responseBreakdown"],
  totalItems: number,
  fcraViolations: number
): NextRoundAction {
  // All deleted = celebrate!
  if (breakdown.deleted === totalItems) {
    return "CELEBRATE";
  }

  // All pending = still waiting
  if (breakdown.pending === totalItems) {
    return "STRATEGIC_PAUSE";
  }

  // Multiple FCRA violations = escalate to CFPB
  if (fcraViolations >= 2) {
    return "ESCALATE_CFPB";
  }

  // Many stall letters = escalate to CFPB
  if (breakdown.stallLetter >= 2) {
    return "ESCALATE_CFPB";
  }

  // All verified after multiple rounds = consider legal
  if (breakdown.verified === totalItems - breakdown.deleted && breakdown.verified >= 3) {
    return "LEGAL_REVIEW";
  }

  // Default = continue with next round
  return "ESCALATE_SAME_CRA";
}

// =============================================================================
// ITEM-LEVEL STRATEGY
// =============================================================================

/**
 * Determine the next approach for an item based on its response
 */
function determineNextApproach(
  currentOutcome: DisputeOutcome,
  previousApproach: DisputeApproach | undefined,
  stallTactic?: StallTactic
): { approach: DisputeApproach; reason: string } {
  switch (currentOutcome) {
    case "VERIFIED":
      // They verified - challenge the verification method
      if (previousApproach === "METHOD_OF_VERIFICATION") {
        return {
          approach: "FCRA_VIOLATION",
          reason: "Previous method of verification challenge ignored - citing FCRA violations",
        };
      }
      return {
        approach: "METHOD_OF_VERIFICATION",
        reason: "Challenging the verification method used by the CRA",
      };

    case "UPDATED":
      // Partial fix - demand complete correction
      return {
        approach: "STANDARD_ACCURACY",
        reason: "Partial update acknowledged errors - demanding complete correction",
      };

    case "NO_RESPONSE":
      // FCRA violation - aggressive approach
      return {
        approach: "FCRA_VIOLATION",
        reason: "30-day deadline missed - citing FCRA 1681i(a)(1) violation",
      };

    case "STALL_LETTER":
      // Handle based on stall tactic
      if (stallTactic === "FRIVOLOUS_CLAIM") {
        return {
          approach: "FCRA_VIOLATION",
          reason: "Rejecting frivolous claim - disputing was legitimate",
        };
      }
      if (stallTactic === "ID_VERIFICATION") {
        return {
          approach: "STANDARD_ACCURACY",
          reason: "Providing requested verification and reiterating dispute",
        };
      }
      return {
        approach: "METHOD_OF_VERIFICATION",
        reason: "Rejecting stall tactics and demanding proper investigation",
      };

    default:
      return {
        approach: "STANDARD_ACCURACY",
        reason: "Continuing standard accuracy dispute",
      };
  }
}

/**
 * Determine what violations to cite based on outcome
 */
function determineViolationsToCite(
  outcome: DisputeOutcome,
  wasLate: boolean,
  stallTactic?: StallTactic
): string[] {
  const violations: string[] = [];

  if (wasLate || outcome === "NO_RESPONSE") {
    violations.push("15 U.S.C. § 1681i(a)(1) - Failure to respond within 30 days");
  }

  if (outcome === "VERIFIED") {
    violations.push("15 U.S.C. § 1681i(a)(6) - Failure to provide verification procedure");
    violations.push("15 U.S.C. § 1681e(b) - Failure to assure maximum possible accuracy");
  }

  if (outcome === "STALL_LETTER") {
    if (stallTactic === "FRIVOLOUS_CLAIM") {
      violations.push("15 U.S.C. § 1681i(a)(3) - Improper frivolous determination");
    }
    violations.push("15 U.S.C. § 1681i(a)(1) - Failure to conduct reasonable investigation");
  }

  return violations;
}

/**
 * Build context for a single item's next round
 */
function buildItemContext(
  response: ResponseForAnalysis,
  previousApproach?: DisputeApproach
): ItemRoundContext {
  const { approach: newApproach, reason: approachReason } = determineNextApproach(
    response.outcome,
    previousApproach,
    response.stallTactic
  );

  const includeInNextRound = response.outcome !== "DELETED" && response.outcome !== "PENDING";

  const violations = determineViolationsToCite(
    response.outcome,
    response.wasLate,
    response.stallTactic
  );

  // Determine specific demands based on outcome
  const demandSpecifics: string[] = [];
  if (response.outcome === "VERIFIED") {
    demandSpecifics.push("Provide the method of verification");
    demandSpecifics.push("Provide contact information for the verifying party");
    demandSpecifics.push("Provide documentation used in verification");
  }
  if (response.outcome === "NO_RESPONSE") {
    demandSpecifics.push("Immediate deletion per FCRA requirements");
    demandSpecifics.push("Written confirmation of deletion within 5 days");
  }
  if (response.outcome === "STALL_LETTER") {
    demandSpecifics.push("Conduct proper investigation as required by law");
    demandSpecifics.push("Provide results within statutory timeframe");
  }

  return {
    accountItemId: response.disputeItemId,
    creditorName: response.creditorName,
    previousOutcome: response.outcome,
    stallTactic: response.stallTactic,
    updateDetails: response.updateType,
    includeInNextRound,
    newApproach,
    approachReason,
    referPreviousDispute: includeInNextRound,
    citeViolations: violations,
    demandSpecifics,
    attachEvidence: response.outcome === "VERIFIED",
    evidenceDescription: response.outcome === "VERIFIED"
      ? "Screenshots of inaccurate information and previous dispute records"
      : undefined,
  };
}

// =============================================================================
// TONE & ESCALATION DETERMINATION
// =============================================================================

type ToneLevel = "CONCERNED" | "FRUSTRATED" | "DEMANDING" | "FINAL_WARNING" | "LITIGATION_READY";

/**
 * Determine tone escalation based on round and outcomes
 */
function determineToneEscalation(
  currentRound: number,
  summary: DisputeResponseSummary
): { escalation: "MAINTAIN" | "INCREASE" | "DECREASE"; suggestedTone: ToneLevel } {
  // If we had success, maintain tone
  if (summary.successRate >= 50) {
    return { escalation: "MAINTAIN", suggestedTone: getToneForRound(currentRound) };
  }

  // If there are FCRA violations, escalate
  if (summary.fcraViolations > 0) {
    return { escalation: "INCREASE", suggestedTone: escalateTone(getToneForRound(currentRound)) };
  }

  // If many verified or stalled, escalate
  if (summary.responseBreakdown.verified + summary.responseBreakdown.stallLetter >= 2) {
    return { escalation: "INCREASE", suggestedTone: escalateTone(getToneForRound(currentRound)) };
  }

  return { escalation: "MAINTAIN", suggestedTone: getToneForRound(currentRound) };
}

function getToneForRound(round: number): ToneLevel {
  if (round <= 1) return "CONCERNED";
  if (round <= 2) return "FRUSTRATED";
  if (round <= 4) return "DEMANDING";
  if (round <= 6) return "FINAL_WARNING";
  return "LITIGATION_READY";
}

function escalateTone(current: ToneLevel): ToneLevel {
  const levels: ToneLevel[] = ["CONCERNED", "FRUSTRATED", "DEMANDING", "FINAL_WARNING", "LITIGATION_READY"];
  const currentIndex = levels.indexOf(current);
  return levels[Math.min(currentIndex + 1, levels.length - 1)];
}

// =============================================================================
// FLOW DETERMINATION
// =============================================================================

/**
 * Determine if flow should change for next round
 */
function determineNextFlow(
  currentFlow: "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO",
  currentRound: number,
  summary: DisputeResponseSummary
): "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO" {
  // Collection flow R5-R7 uses Accuracy (per AMELIA doctrine)
  if (currentFlow === "COLLECTION" && currentRound >= 4 && currentRound < 7) {
    return "ACCURACY";
  }

  // Combo flow R5-R7 uses Accuracy (per AMELIA doctrine)
  if (currentFlow === "COMBO" && currentRound >= 4 && currentRound < 7) {
    return "ACCURACY";
  }

  // Return to original flow after R7
  if (currentRound >= 7) {
    return currentFlow;
  }

  return currentFlow;
}

/**
 * Determine if bureau should change
 */
function determineBureauChange(
  currentCRA: "TRANSUNION" | "EXPERIAN" | "EQUIFAX",
  summary: DisputeResponseSummary
): { shouldChange: boolean; targetBureau: "TRANSUNION" | "EXPERIAN" | "EQUIFAX" } {
  // If this bureau is completely unresponsive, try another
  if (summary.responseBreakdown.noResponse >= 3 || summary.fcraViolations >= 2) {
    const bureaus: ("TRANSUNION" | "EXPERIAN" | "EQUIFAX")[] = ["TRANSUNION", "EXPERIAN", "EQUIFAX"];
    const otherBureaus = bureaus.filter(b => b !== currentCRA);
    return {
      shouldChange: true,
      targetBureau: otherBureaus[0], // Could be smarter about which to pick
    };
  }

  return { shouldChange: false, targetBureau: currentCRA };
}

// =============================================================================
// MAIN CONTEXT BUILDER
// =============================================================================

/**
 * Build the complete context for the next round
 */
export function buildNextRoundContext(
  dispute: DisputeForAnalysis,
  previousApproaches?: Map<string, DisputeApproach>
): NextRoundContext {
  const summary = summarizeResponses(dispute);

  // Build item contexts
  const itemContexts = dispute.responses
    .filter(r => r.outcome !== "DELETED" && r.outcome !== "PENDING")
    .map(r => buildItemContext(r, previousApproaches?.get(r.disputeItemId)));

  // Determine tone
  const { escalation: toneEscalation, suggestedTone } = determineToneEscalation(
    dispute.round,
    summary
  );

  // Determine flow
  const recommendedFlow = determineNextFlow(dispute.flow, dispute.round, summary);

  // Determine bureau
  const { shouldChange: shouldChangeBureau, targetBureau } = determineBureauChange(
    dispute.cra,
    summary
  );

  // Collect escalation reasons
  const escalationReasons: string[] = [];
  if (summary.fcraViolations > 0) {
    escalationReasons.push(`${summary.fcraViolations} FCRA violation(s) detected`);
  }
  if (summary.responseBreakdown.noResponse > 0) {
    escalationReasons.push(`${summary.responseBreakdown.noResponse} item(s) received no response within 30 days`);
  }
  if (summary.responseBreakdown.verified > 0) {
    escalationReasons.push(`${summary.responseBreakdown.verified} item(s) claimed verified without proper documentation`);
  }
  if (summary.responseBreakdown.stallLetter > 0) {
    escalationReasons.push(`${summary.responseBreakdown.stallLetter} stall letter(s) received`);
  }

  // Collect legal threats based on round and outcomes
  const legalThreats: string[] = [];
  if (dispute.round >= 3 || summary.fcraViolations > 0) {
    legalThreats.push("Filing complaints with CFPB and FTC");
  }
  if (dispute.round >= 5) {
    legalThreats.push("Pursuing legal action for willful FCRA violations");
    legalThreats.push("Seeking statutory and punitive damages");
  }
  if (summary.fcraViolations >= 2) {
    legalThreats.push("Contacting state Attorney General regarding pattern of violations");
  }

  // Regulatory mentions
  const regulatoryMentions: string[] = [];
  if (dispute.round >= 2) regulatoryMentions.push("CFPB");
  if (dispute.round >= 3) regulatoryMentions.push("FTC");
  if (dispute.round >= 4 || summary.fcraViolations >= 2) regulatoryMentions.push("State Attorney General");

  return {
    previousRound: dispute.round,
    previousFlow: dispute.flow,
    previousLetterDate: dispute.sentDate,
    previousReferenceNumber: dispute.referenceNumber,

    responseSummary: summary,
    itemContexts,

    recommendedAction: summary.recommendedNextAction,
    recommendedFlow,
    shouldChangeBureau,
    targetBureau,

    escalationReasons,
    legalThreats,
    regulatoryMentions,

    toneEscalation,
    suggestedTone,
  };
}

// =============================================================================
// ADAPTATION RULE RETRIEVAL
// =============================================================================

/**
 * Get the letter adaptation rules for a specific outcome
 */
export function getAdaptationRules(outcome: DisputeOutcome): LetterAdaptationRules {
  return ADAPTATION_RULES[outcome];
}

/**
 * Generate opening paragraph based on previous outcome
 */
export function generateAdaptedOpening(
  context: NextRoundContext,
  clientFirstName: string
): string {
  const { suggestedTone, previousLetterDate, responseSummary } = context;

  const dateStr = previousLetterDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Different openings based on aggregate outcome
  if (responseSummary.fcraViolations > 0) {
    return `I am writing to formally notify you of your violations of the Fair Credit Reporting Act. ` +
      `On ${dateStr}, I submitted a dispute regarding inaccurate items on my credit report. ` +
      `Your agency has failed to comply with the statutory requirements of the FCRA, and I am now ` +
      `prepared to pursue all available legal remedies.`;
  }

  if (responseSummary.responseBreakdown.noResponse > 0) {
    return `This is a follow-up to my dispute dated ${dateStr}. The FCRA-mandated 30-day response ` +
      `period has expired for ${responseSummary.responseBreakdown.noResponse} item(s) without any ` +
      `response from your agency. Under 15 U.S.C. § 1681i(a)(1), you are required to delete these ` +
      `items immediately.`;
  }

  if (responseSummary.responseBreakdown.verified > 0) {
    return `I am disputing your response to my previous dispute dated ${dateStr}. Your claim that ` +
      `${responseSummary.responseBreakdown.verified} item(s) have been "verified" is insufficient and ` +
      `fails to meet the requirements of 15 U.S.C. § 1681i(a)(6). I demand documentation of your ` +
      `verification procedures.`;
  }

  if (responseSummary.responseBreakdown.stallLetter > 0) {
    return `I reject your response to my dispute dated ${dateStr}. Your attempt to characterize my ` +
      `legitimate dispute as frivolous or to request additional information is a transparent attempt ` +
      `to avoid your obligations under the Fair Credit Reporting Act.`;
  }

  // Default escalated opening
  const toneOpenings: Record<typeof suggestedTone, string> = {
    CONCERNED: `I am following up on my previous dispute dated ${dateStr}. I remain concerned about ` +
      `inaccurate information on my credit report and request your prompt attention to this matter.`,

    FRUSTRATED: `Despite my previous dispute dated ${dateStr}, inaccurate information remains on my ` +
      `credit report. I am frustrated by the lack of proper investigation and demand immediate action.`,

    DEMANDING: `This is my continued dispute following my letter dated ${dateStr}. Your failure to ` +
      `properly investigate and correct the inaccurate information is unacceptable. I demand ` +
      `immediate resolution.`,

    FINAL_WARNING: `This letter serves as a final warning before I pursue formal complaints and legal ` +
      `action. Since my original dispute on ${dateStr}, you have failed to fulfill your obligations ` +
      `under the FCRA.`,

    LITIGATION_READY: `Consider this notice of my intent to pursue all legal remedies available under ` +
      `the Fair Credit Reporting Act. Your continued failure to address my disputes, which began on ` +
      `${dateStr}, constitutes willful noncompliance.`,
  };

  return toneOpenings[suggestedTone];
}

/**
 * Generate escalation paragraph based on context
 */
export function generateEscalationParagraph(context: NextRoundContext): string {
  const { escalationReasons, legalThreats, regulatoryMentions } = context;

  if (escalationReasons.length === 0) {
    return "";
  }

  let paragraph = "The following issues require your immediate attention:\n\n";

  for (const reason of escalationReasons) {
    paragraph += `• ${reason}\n`;
  }

  paragraph += "\n";

  if (legalThreats.length > 0) {
    paragraph += "If these issues are not resolved promptly, I will:\n\n";
    for (const threat of legalThreats) {
      paragraph += `• ${threat}\n`;
    }
  }

  if (regulatoryMentions.length > 0) {
    paragraph += `\nI am prepared to file formal complaints with the ${regulatoryMentions.join(", ")}.`;
  }

  return paragraph;
}
