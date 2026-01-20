// Round-based dispute strategy and workflow logic

export type DisputeFlow = "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO";
export type ResponseOutcome = "ITEMS_DELETED" | "ITEMS_UPDATED" | "VERIFIED" | "NO_RESPONSE" | "PARTIAL";

export interface RoundStrategy {
  round: number;
  name: string;
  approach: string;
  tone: "professional" | "assertive" | "aggressive" | "litigation";
  keyPoints: string[];
  legalEmphasis: string[];
  nextStepIfVerified: string;
  nextStepIfDeleted: string;
  nextStepIfNoResponse: string;
  escalationPath: string;
}

// Round strategies define the approach for each round
export const ROUND_STRATEGIES: Record<number, RoundStrategy> = {
  1: {
    round: 1,
    name: "Initial Dispute - Verification Request",
    approach: "Request investigation and verification of disputed items",
    tone: "professional",
    keyPoints: [
      "Formally dispute inaccurate information",
      "Request investigation under FCRA Section 611",
      "Demand verification from furnisher",
      "Request removal of unverifiable information",
    ],
    legalEmphasis: [
      "15 U.S.C. § 1681i - Procedure in case of disputed accuracy",
      "15 U.S.C. § 1681e(b) - Maximum possible accuracy requirement",
    ],
    nextStepIfVerified: "Proceed to Round 2 with Method of Verification request",
    nextStepIfDeleted: "Document success, proceed to next CRA or account",
    nextStepIfNoResponse: "File CFPB complaint, proceed to Round 2 citing violation",
    escalationPath: "Round 2: Method of Verification Demand",
  },
  2: {
    round: 2,
    name: "Method of Verification Demand",
    approach: "Challenge inadequate investigation and demand proof of verification procedures",
    tone: "assertive",
    keyPoints: [
      "Challenge the adequacy of the reinvestigation",
      "Demand Method of Verification (MOV) documentation",
      "Cite failure to conduct reasonable investigation",
      "Reference CFPB complaint filing or intent",
    ],
    legalEmphasis: [
      "15 U.S.C. § 1681i(a)(6) - Method of verification disclosure",
      "15 U.S.C. § 1681i(a)(1) - Reasonable reinvestigation required",
      "15 U.S.C. § 1681s-2(b) - Furnisher duties upon dispute notice",
    ],
    nextStepIfVerified: "Proceed to Round 3 with procedural violation focus",
    nextStepIfDeleted: "Document success, proceed to next item",
    nextStepIfNoResponse: "Automatic deletion required under FCRA, escalate to Round 3",
    escalationPath: "Round 3: Procedural Violation Notice",
  },
  3: {
    round: 3,
    name: "Procedural Violation Notice",
    approach: "Document FCRA violations and provide notice of intent to pursue legal remedies",
    tone: "aggressive",
    keyPoints: [
      "Document specific FCRA procedural violations",
      "Reference previous inadequate responses",
      "Provide formal notice of intent to pursue remedies",
      "Demand immediate correction or face legal action",
    ],
    legalEmphasis: [
      "15 U.S.C. § 1681n - Civil liability for willful noncompliance",
      "15 U.S.C. § 1681o - Civil liability for negligent noncompliance",
      "15 U.S.C. § 1681i(a)(5) - Deletion required if not verified in time",
    ],
    nextStepIfVerified: "Proceed to Round 4 - Final Demand / Pre-litigation",
    nextStepIfDeleted: "Document success, calculate potential damages",
    nextStepIfNoResponse: "Proceed to Round 4 with litigation preparation",
    escalationPath: "Round 4: Final Demand / Intent to Litigate",
  },
  4: {
    round: 4,
    name: "Final Demand - Intent to Litigate",
    approach: "Final demand before litigation with specific damage calculations",
    tone: "litigation",
    keyPoints: [
      "Final opportunity to resolve before litigation",
      "Detail all documented FCRA violations",
      "Calculate potential statutory and actual damages",
      "Set firm deadline for resolution",
    ],
    legalEmphasis: [
      "15 U.S.C. § 1681n - Statutory damages $100-$1,000 per violation",
      "15 U.S.C. § 1681n - Punitive damages for willful violations",
      "15 U.S.C. § 1681n - Attorney fees and costs",
      "State consumer protection law violations",
    ],
    nextStepIfVerified: "Consult with FCRA attorney for litigation",
    nextStepIfDeleted: "Document resolution, pursue damages if applicable",
    nextStepIfNoResponse: "File lawsuit in federal court",
    escalationPath: "Litigation / FCRA Attorney Referral",
  },
};

// Get strategy for any round (R5+ uses R4 strategy)
export function getRoundStrategy(round: number): RoundStrategy {
  if (round >= 4) return { ...ROUND_STRATEGIES[4], round };
  return ROUND_STRATEGIES[round] || ROUND_STRATEGIES[1];
}

// Response outcome recommendations
export interface NextStepRecommendation {
  action: string;
  description: string;
  urgency: "low" | "medium" | "high" | "critical";
  suggestedRound?: number;
  suggestedFlow?: DisputeFlow;
  additionalSteps: string[];
}

export function getNextStepRecommendation(
  currentRound: number,
  currentFlow: DisputeFlow,
  responseOutcome: ResponseOutcome,
  daysWaiting?: number
): NextStepRecommendation {
  const strategy = getRoundStrategy(currentRound);

  // No response after 30+ days
  if (responseOutcome === "NO_RESPONSE" || (daysWaiting && daysWaiting > 30)) {
    return {
      action: "Escalate - CRA Failed to Respond",
      description: `Under 15 U.S.C. § 1681i(a)(1), the CRA had 30 days to complete their investigation. Their failure to respond is a violation and the disputed items should be deleted.`,
      urgency: "critical",
      suggestedRound: currentRound + 1,
      suggestedFlow: currentFlow,
      additionalSteps: [
        "File complaint with CFPB (consumerfinance.gov/complaint)",
        "Document the timeline violation",
        "Reference the violation in Round " + (currentRound + 1) + " letter",
        "Consider consulting an FCRA attorney about damages",
      ],
    };
  }

  // Items verified as accurate
  if (responseOutcome === "VERIFIED") {
    if (currentRound === 1) {
      return {
        action: "Proceed to Round 2 - Demand Method of Verification",
        description: `The CRA claims they verified the information. Under 15 U.S.C. § 1681i(a)(6), you have the right to know the method of verification used.`,
        urgency: "high",
        suggestedRound: 2,
        suggestedFlow: currentFlow,
        additionalSteps: [
          "Request specific method of verification documentation",
          "Challenge the adequacy of their investigation",
          "Ask what documents they reviewed",
          "Inquire how they verified disputed specific details",
        ],
      };
    } else if (currentRound === 2) {
      return {
        action: "Proceed to Round 3 - Document Violations",
        description: `If the CRA cannot provide adequate proof of their verification method, this may constitute a failure to conduct a reasonable investigation.`,
        urgency: "high",
        suggestedRound: 3,
        suggestedFlow: currentFlow,
        additionalSteps: [
          "Document all inadequate responses received",
          "Note specific FCRA sections violated",
          "Prepare formal notice of intent to pursue remedies",
          "Consider filing CFPB complaint",
        ],
      };
    } else if (currentRound === 3) {
      return {
        action: "Proceed to Round 4 - Final Demand",
        description: `Multiple rounds of inadequate investigation may constitute willful noncompliance under the FCRA.`,
        urgency: "critical",
        suggestedRound: 4,
        suggestedFlow: currentFlow,
        additionalSteps: [
          "Calculate potential statutory damages ($100-$1,000 per violation)",
          "Document actual damages (denied credit, higher rates, etc.)",
          "Set firm deadline for resolution",
          "Consult with FCRA attorney",
        ],
      };
    } else {
      return {
        action: "Consult FCRA Attorney - Litigation May Be Warranted",
        description: `After ${currentRound} rounds without resolution, litigation may be the appropriate next step.`,
        urgency: "critical",
        suggestedRound: currentRound + 1,
        suggestedFlow: currentFlow,
        additionalSteps: [
          "Gather all correspondence and documentation",
          "Calculate total damages",
          "Find FCRA attorney (NACA - consumeradvocates.org)",
          "File in federal court within statute of limitations",
        ],
      };
    }
  }

  // Items deleted
  if (responseOutcome === "ITEMS_DELETED") {
    return {
      action: "Success - Document and Proceed",
      description: `The disputed items have been deleted. Document this success and proceed to the next CRA or account.`,
      urgency: "low",
      additionalSteps: [
        "Save the deletion confirmation letter",
        "Request updated credit report",
        "Proceed to dispute with next CRA if applicable",
        "If damages occurred, consult attorney about recovery",
      ],
    };
  }

  // Items updated/modified
  if (responseOutcome === "ITEMS_UPDATED") {
    return {
      action: "Review Updates - Determine if Sufficient",
      description: `The CRA has updated the information. Review the changes to determine if they fully address your dispute.`,
      urgency: "medium",
      suggestedRound: currentRound,
      suggestedFlow: currentFlow,
      additionalSteps: [
        "Request updated credit report to review changes",
        "Compare to original dispute points",
        "If not fully resolved, proceed to next round",
        "Document what was and wasn't corrected",
      ],
    };
  }

  // Partial resolution
  if (responseOutcome === "PARTIAL") {
    return {
      action: "Continue Dispute for Remaining Items",
      description: `Some items were resolved but others remain. Continue disputing the unresolved items.`,
      urgency: "medium",
      suggestedRound: currentRound + 1,
      suggestedFlow: currentFlow,
      additionalSteps: [
        "Document which items were resolved",
        "Focus next round on remaining items",
        "Reference partial resolution in next letter",
        "Consider separate disputes for different issue types",
      ],
    };
  }

  // Default
  return {
    action: "Review and Determine Next Steps",
    description: `Review the CRA's response and determine the appropriate next action.`,
    urgency: "medium",
    suggestedRound: currentRound + 1,
    suggestedFlow: currentFlow,
    additionalSteps: [
      "Carefully read the entire response",
      "Note any procedural deficiencies",
      "Determine if escalation is warranted",
      "Consult dispute strategy guide",
    ],
  };
}

// Flow descriptions for UI
export const FLOW_DESCRIPTIONS: Record<DisputeFlow, { name: string; description: string; bestFor: string[] }> = {
  ACCURACY: {
    name: "Accuracy Dispute",
    description: "Challenge inaccurate information including balances, dates, payment history, and account status.",
    bestFor: [
      "Incorrect balance amounts",
      "Wrong payment history",
      "Inaccurate account status",
      "Date discrepancies",
      "Information that differs across bureaus",
    ],
  },
  COLLECTION: {
    name: "Collection Validation",
    description: "Challenge collection accounts requiring debt validation and proof of ownership.",
    bestFor: [
      "Unrecognized collection accounts",
      "Debts past statute of limitations",
      "Medical debt violations",
      "Debts without proper documentation",
      "Zombie debt (re-aged accounts)",
    ],
  },
  CONSENT: {
    name: "Consent/Authorization",
    description: "Challenge unauthorized inquiries or accounts opened without consent.",
    bestFor: [
      "Unauthorized hard inquiries",
      "Accounts you didn't open",
      "Identity theft related items",
      "Inquiries without permissible purpose",
    ],
  },
  COMBO: {
    name: "Combined Dispute",
    description: "Address multiple issue types in a single comprehensive dispute letter.",
    bestFor: [
      "Accounts with multiple issue types",
      "Complex credit situations",
      "Mixed accuracy and validation issues",
      "Comprehensive credit repair",
    ],
  },
};

// Timeline expectations
export const DISPUTE_TIMELINE = {
  craResponseDays: 30,
  craExtendedDays: 45, // If consumer provides additional info
  furnisherResponseDays: 30,
  cfpbComplaintResponseDays: 15,
  typicalResolutionRounds: "2-4",
};
