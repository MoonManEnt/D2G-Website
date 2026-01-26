/**
 * SENTRY E-OSCAR CODE INTELLIGENCE ENGINE
 *
 * Recommends optimal e-OSCAR dispute codes based on account issues.
 * Avoids generic code 112 (batch verified) in favor of specific codes
 * that force targeted investigations.
 *
 * E-OSCAR CODE STRATEGY:
 * - HIGH VALUE: 105, 106, 107, 108, 109 (force specific verification)
 * - IDENTITY: 001, 002, 103, 104 (highest priority)
 * - COLLECTION: 006, 012, 014, 023, 024
 * - AVOID: 112 (generic catch-all, lowest priority)
 */

import type {
  EOSCARCode,
  EOSCARCodePriority,
  EOSCARRecommendation,
  SentryAccountItem,
  SentryDetectedIssue,
  SentryFlowType,
} from "@/types/sentry";

// =============================================================================
// E-OSCAR CODE DATABASE
// =============================================================================

export const EOSCAR_CODE_DATABASE: EOSCARCode[] = [
  // ==========================================================================
  // IDENTITY/AUTHORIZATION CODES - Highest Priority
  // ==========================================================================
  {
    code: "001",
    name: "Not his/hers",
    priority: "HIGH",
    description: "Consumer claims the account does not belong to them",
    triggerConditions: [
      "account_not_mine",
      "mixed_file",
      "wrong_ssn",
      "identity_dispute",
      "similar_name_confusion",
    ],
    requiredEvidence: ["identity_statement"],
    avoidWith: ["106", "109", "105"], // Don't dispute details of account you claim isn't yours
    historicalSuccessRate: 0.55,
  },
  {
    code: "002",
    name: "Similar name - account belongs to another person with a similar name",
    priority: "HIGH",
    description: "Account mixed due to similar name (Jr./Sr., common name, etc.)",
    triggerConditions: [
      "mixed_file",
      "jr_sr_confusion",
      "common_name",
      "family_member_confusion",
    ],
    requiredEvidence: ["identity_statement", "name_clarification"],
    avoidWith: ["106", "109"],
    historicalSuccessRate: 0.48,
  },
  {
    code: "103",
    name: "Identity fraud - new account opened",
    priority: "HIGH",
    description: "Fraudulent account opened using consumer's identity",
    triggerConditions: [
      "fraud_claim",
      "unauthorized_account",
      "identity_theft",
      "account_opened_without_consent",
    ],
    requiredEvidence: ["ftc_identity_theft_report", "police_report"],
    avoidWith: ["001"], // Use 103 for fraud, 001 for mistaken identity
    historicalSuccessRate: 0.65,
  },
  {
    code: "104",
    name: "Account takeover fraud",
    priority: "HIGH",
    description: "Existing legitimate account compromised by fraud",
    triggerConditions: [
      "account_takeover",
      "unauthorized_charges",
      "compromised_account",
    ],
    requiredEvidence: ["fraud_affidavit", "police_report_recommended"],
    avoidWith: [],
    historicalSuccessRate: 0.58,
  },

  // ==========================================================================
  // ACCURACY CODES - High Value (Force Specific Investigation)
  // ==========================================================================
  {
    code: "105",
    name: "Disputes dates",
    priority: "HIGH",
    description: "Date opened, date closed, or date of first delinquency is incorrect",
    triggerConditions: [
      "dofd_incorrect",
      "date_opened_wrong",
      "date_closed_wrong",
      "date_reported_wrong",
      "date_last_activity_wrong",
      "date_discrepancy_across_bureaus",
    ],
    requiredEvidence: ["date_discrepancy_documentation"],
    avoidWith: [],
    historicalSuccessRate: 0.42,
  },
  {
    code: "106",
    name: "Disputes payment history",
    priority: "HIGH",
    description: "Payment status, late markers, or payment grid incorrect",
    triggerConditions: [
      "late_payment_dispute",
      "payment_status_wrong",
      "payment_grid_error",
      "payment_not_credited",
      "payment_rating_incorrect",
    ],
    requiredEvidence: ["payment_records", "bank_statements"],
    avoidWith: ["001", "103"], // Don't dispute payments on account you claim isn't yours
    historicalSuccessRate: 0.38,
  },
  {
    code: "107",
    name: "Disputes remarks",
    priority: "MEDIUM",
    description: "Account comments or special remarks are inaccurate",
    triggerConditions: [
      "remark_incorrect",
      "consumer_statement_missing",
      "dispute_notation_wrong",
      "special_comment_error",
    ],
    requiredEvidence: [],
    avoidWith: [],
    historicalSuccessRate: 0.35,
  },
  {
    code: "108",
    name: "Disputes account type or terms",
    priority: "MEDIUM",
    description: "Account classification, terms, or type is wrong",
    triggerConditions: [
      "account_type_wrong",
      "terms_incorrect",
      "loan_type_misclassified",
      "revolving_vs_installment",
    ],
    requiredEvidence: ["original_account_terms"],
    avoidWith: [],
    historicalSuccessRate: 0.32,
  },
  {
    code: "109",
    name: "Disputes current balance",
    priority: "HIGH",
    description: "Balance amount is incorrect or paid in full not reflected",
    triggerConditions: [
      "balance_wrong",
      "paid_in_full",
      "balance_inconsistent",
      "balance_discrepancy_across_bureaus",
      "zero_balance_not_reflected",
    ],
    requiredEvidence: ["payment_confirmation", "zero_balance_letter"],
    avoidWith: ["001", "103"],
    historicalSuccessRate: 0.45,
  },

  // ==========================================================================
  // COLLECTION-SPECIFIC CODES
  // ==========================================================================
  {
    code: "006",
    name: "Not aware of collection",
    priority: "MEDIUM",
    description: "Consumer was never notified of collection account",
    triggerConditions: [
      "no_dunning_letter",
      "collection_unknown",
      "never_notified",
      "no_validation_received",
    ],
    requiredEvidence: ["statement_of_no_notification"],
    avoidWith: ["012"], // Can't be unaware AND claim paid before collection
    historicalSuccessRate: 0.35,
  },
  {
    code: "012",
    name: "Paid before placed for collection",
    priority: "MEDIUM",
    description: "Debt was paid before it was sent to collections",
    triggerConditions: [
      "paid_before_collection",
      "payment_timing_dispute",
      "paid_original_creditor",
    ],
    requiredEvidence: ["payment_receipt", "payment_date_proof"],
    avoidWith: ["006"],
    historicalSuccessRate: 0.40,
  },
  {
    code: "014",
    name: "Paid before collection status reported",
    priority: "MEDIUM",
    description: "Payment made before collection status was reported to bureaus",
    triggerConditions: [
      "paid_before_reporting",
      "status_timing_dispute",
    ],
    requiredEvidence: ["payment_receipt", "reporting_date_proof"],
    avoidWith: [],
    historicalSuccessRate: 0.38,
  },
  {
    code: "023",
    name: "Account closed",
    priority: "LOW",
    description: "Account shows open but should be closed",
    triggerConditions: [
      "account_closure_not_reflected",
      "closed_account_shows_open",
    ],
    requiredEvidence: ["closure_confirmation"],
    avoidWith: [],
    historicalSuccessRate: 0.30,
  },
  {
    code: "024",
    name: "Closed by consumer",
    priority: "LOW",
    description: "Consumer-initiated closure not properly reflected",
    triggerConditions: [
      "closed_by_consumer_not_shown",
      "voluntary_closure_dispute",
    ],
    requiredEvidence: ["closure_request_documentation"],
    avoidWith: [],
    historicalSuccessRate: 0.28,
  },

  // ==========================================================================
  // GENERIC CODE - AVOID
  // ==========================================================================
  {
    code: "112",
    name: "Claims inaccurate information",
    priority: "LOW",
    description: "Generic catch-all for unspecified accuracy disputes",
    triggerConditions: [
      "no_specific_issue_identified",
      "general_inaccuracy",
    ],
    requiredEvidence: [],
    avoidWith: [], // Avoid this code entirely when possible
    historicalSuccessRate: 0.15, // Lowest success - often batch verified
  },
];

// =============================================================================
// CODE RECOMMENDATION ENGINE
// =============================================================================

/**
 * Get all e-OSCAR codes from the database
 */
export function getEOSCARCodeDatabase(): EOSCARCode[] {
  return EOSCAR_CODE_DATABASE;
}

/**
 * Get a specific e-OSCAR code by code number
 */
export function getEOSCARCode(code: string): EOSCARCode | undefined {
  return EOSCAR_CODE_DATABASE.find((c) => c.code === code);
}

/**
 * Check if two codes conflict with each other
 */
export function codesConflict(code1: string, code2: string): boolean {
  const codeObj1 = getEOSCARCode(code1);
  const codeObj2 = getEOSCARCode(code2);

  if (!codeObj1 || !codeObj2) return false;

  return (
    codeObj1.avoidWith.includes(code2) || codeObj2.avoidWith.includes(code1)
  );
}

/**
 * Score how well a code matches an account's issues
 */
function scoreCodeMatch(
  code: EOSCARCode,
  issues: SentryDetectedIssue[],
  accountType?: string
): number {
  let score = 0;

  // Check trigger conditions against detected issues
  for (const issue of issues) {
    const issueCode = issue.code.toLowerCase();
    for (const trigger of code.triggerConditions) {
      if (
        issueCode.includes(trigger) ||
        trigger.includes(issueCode) ||
        issue.description.toLowerCase().includes(trigger.replace(/_/g, " "))
      ) {
        score += 0.3;
      }
    }

    // Check if issue suggests this specific code
    if (issue.suggestedEOSCARCode === code.code) {
      score += 0.5;
    }
  }

  // Boost for high-priority codes
  if (code.priority === "HIGH") {
    score += 0.1;
  }

  // Boost based on historical success rate
  score += (code.historicalSuccessRate || 0) * 0.2;

  // Penalize generic code 112
  if (code.code === "112") {
    score -= 0.5;
  }

  // Cap at 1.0
  return Math.min(1.0, Math.max(0, score));
}

/**
 * Generate reasoning for why a code was recommended
 */
function generateReasoning(
  code: EOSCARCode,
  issues: SentryDetectedIssue[],
  score: number
): string {
  const matchedTriggers: string[] = [];

  for (const issue of issues) {
    for (const trigger of code.triggerConditions) {
      if (
        issue.code.toLowerCase().includes(trigger) ||
        issue.description.toLowerCase().includes(trigger.replace(/_/g, " "))
      ) {
        matchedTriggers.push(trigger.replace(/_/g, " "));
      }
    }
  }

  const uniqueTriggers = [...new Set(matchedTriggers)];
  const successRate = code.historicalSuccessRate
    ? `${Math.round(code.historicalSuccessRate * 100)}%`
    : "unknown";

  if (uniqueTriggers.length > 0) {
    return `Matched conditions: ${uniqueTriggers.slice(0, 3).join(", ")}. Historical success rate: ${successRate}.`;
  }

  if (code.priority === "HIGH") {
    return `High-priority code that forces specific investigation. Historical success rate: ${successRate}.`;
  }

  return `May be applicable based on account characteristics. Historical success rate: ${successRate}.`;
}

/**
 * Recommend e-OSCAR codes for a single account
 */
export function recommendCodesForAccount(
  account: SentryAccountItem,
  flow?: SentryFlowType
): EOSCARRecommendation[] {
  const issues = account.detectedIssues || [];
  const recommendations: EOSCARRecommendation[] = [];

  // Filter codes based on flow
  let eligibleCodes = EOSCAR_CODE_DATABASE.filter((code) => {
    // Always exclude 112 unless no other option
    if (code.code === "112") return false;

    // For CONSENT flow, prioritize identity codes
    if (flow === "CONSENT") {
      return ["001", "002", "103", "104"].includes(code.code);
    }

    // For COLLECTION flow, include collection codes
    if (flow === "COLLECTION") {
      return [
        "006",
        "012",
        "014",
        "023",
        "024",
        "105",
        "106",
        "109",
      ].includes(code.code);
    }

    // For ACCURACY flow, include accuracy codes
    if (flow === "ACCURACY") {
      return ["105", "106", "107", "108", "109"].includes(code.code);
    }

    // For COMBO, include both accuracy and collection
    return true;
  });

  // If no eligible codes, use all except 112
  if (eligibleCodes.length === 0) {
    eligibleCodes = EOSCAR_CODE_DATABASE.filter((c) => c.code !== "112");
  }

  // Score and rank codes
  for (const code of eligibleCodes) {
    const score = scoreCodeMatch(code, issues, account.accountType);

    if (score > 0.1) {
      // Determine evidence status
      const evidenceAvailable: string[] = [];
      const evidenceMissing: string[] = [];

      for (const ev of code.requiredEvidence) {
        // Check if account has cross-bureau data (a form of evidence)
        if (
          ev === "date_discrepancy_documentation" &&
          account.crossBureauData &&
          account.crossBureauData.length > 1
        ) {
          evidenceAvailable.push("Cross-bureau discrepancy detected");
        } else {
          evidenceMissing.push(ev.replace(/_/g, " "));
        }
      }

      recommendations.push({
        code,
        score,
        confidence: score,
        name: code.name,
        reasoning: generateReasoning(code, issues, score),
        evidenceAvailable,
        evidenceMissing,
      });
    }
  }

  // Sort by score descending
  recommendations.sort((a, b) => b.score - a.score);

  // Filter out conflicting codes
  const finalRecommendations: EOSCARRecommendation[] = [];
  const usedCodes = new Set<string>();

  for (const rec of recommendations) {
    let hasConflict = false;
    for (const used of usedCodes) {
      if (codesConflict(rec.code.code, used)) {
        hasConflict = true;
        break;
      }
    }

    if (!hasConflict) {
      finalRecommendations.push(rec);
      usedCodes.add(rec.code.code);
    }

    // Limit to top 3 recommendations
    if (finalRecommendations.length >= 3) break;
  }

  // If no recommendations found, suggest asking for more info (but NOT 112)
  if (finalRecommendations.length === 0 && issues.length === 0) {
    const defaultCode = getEOSCARCode("109"); // Balance dispute is often safe
    if (defaultCode) {
      finalRecommendations.push({
        code: defaultCode,
        score: 0.2,
        confidence: 0.2,
        name: defaultCode.name,
        reasoning:
          "No specific issues detected. Balance dispute is a safe starting point.",
        evidenceAvailable: [],
        evidenceMissing: ["payment_confirmation"],
      });
    }
  }

  return finalRecommendations;
}

/**
 * Recommend e-OSCAR codes for multiple accounts
 */
export function recommendEOSCARCodes(
  accounts: SentryAccountItem[],
  flow?: SentryFlowType
): Map<string, EOSCARRecommendation[]> {
  const result = new Map<string, EOSCARRecommendation[]>();

  for (const account of accounts) {
    const recommendations = recommendCodesForAccount(account, flow);
    result.set(account.id, recommendations);
  }

  return result;
}

/**
 * Get the primary recommended code for an account
 */
export function getPrimaryCode(
  account: SentryAccountItem,
  flow?: SentryFlowType
): EOSCARCode | null {
  const recommendations = recommendCodesForAccount(account, flow);
  return recommendations.length > 0 ? recommendations[0].code : null;
}

/**
 * Validate that a code selection doesn't have conflicts
 */
export function validateCodeSelection(
  codes: string[]
): { isValid: boolean; conflicts: string[] } {
  const conflicts: string[] = [];

  for (let i = 0; i < codes.length; i++) {
    for (let j = i + 1; j < codes.length; j++) {
      if (codesConflict(codes[i], codes[j])) {
        conflicts.push(`${codes[i]} conflicts with ${codes[j]}`);
      }
    }
  }

  return {
    isValid: conflicts.length === 0,
    conflicts,
  };
}

/**
 * Get codes by priority level
 */
export function getCodesByPriority(
  priority: EOSCARCodePriority
): EOSCARCode[] {
  return EOSCAR_CODE_DATABASE.filter((c) => c.priority === priority);
}

/**
 * Get codes for a specific flow type
 */
export function getCodesForFlow(flow: SentryFlowType): EOSCARCode[] {
  switch (flow) {
    case "CONSENT":
      return EOSCAR_CODE_DATABASE.filter((c) =>
        ["001", "002", "103", "104"].includes(c.code)
      );
    case "COLLECTION":
      return EOSCAR_CODE_DATABASE.filter((c) =>
        ["006", "012", "014", "023", "024", "105", "106", "109"].includes(
          c.code
        )
      );
    case "ACCURACY":
      return EOSCAR_CODE_DATABASE.filter((c) =>
        ["105", "106", "107", "108", "109"].includes(c.code)
      );
    case "COMBO":
      return EOSCAR_CODE_DATABASE.filter((c) => c.code !== "112");
    default:
      return EOSCAR_CODE_DATABASE.filter((c) => c.code !== "112");
  }
}

/**
 * Get a human-readable description for an e-OSCAR code
 */
export function getCodeDescription(code: string): string {
  const eoscarCode = EOSCAR_CODE_DATABASE.find((c) => c.code === code);
  return eoscarCode?.description || `e-OSCAR Code ${code}`;
}
