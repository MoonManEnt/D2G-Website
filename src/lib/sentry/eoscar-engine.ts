/**
 * SENTRY E-OSCAR CODE INTELLIGENCE ENGINE
 *
 * Comprehensive e-OSCAR dispute code database based on CFPB guidance,
 * Federal Reserve reports, and court case analysis.
 *
 * SOURCE REFERENCES:
 * - CFPB Circular 2022-07: Reasonable Investigation Requirements
 * - Federal Reserve Report on FCRA Dispute Process (2006)
 * - CFPB Experian Complaint (January 2025)
 * - Metro 2 Credit Reporting Resource Guide (CDIA)
 *
 * E-OSCAR CODE STRATEGY:
 * - HIGH VALUE: 105, 106, 107, 108, 109 (force specific verification)
 * - IDENTITY: 001, 002, 103, 104 (highest priority - fraud/identity theft)
 * - COLLECTION: 006, 012, 014, 023, 024 (collection-specific disputes)
 * - BANKRUPTCY: 019, 037, 102 (bankruptcy-related)
 * - SPECIAL CIRCUMSTANCES: 038, 039, 040, 041 (military, disaster, litigation)
 * - AVOID: 112 (generic catch-all, 15% success rate - often batch verified)
 *
 * KEY INSIGHT: Per congressional testimony, 90% of disputes use only 4 codes.
 * Using specific codes forces actual investigation rather than auto-verification.
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
  // PAYMENT/TIMING CODES
  // ==========================================================================
  {
    code: "008",
    name: "Late due to address change - never received statement",
    priority: "MEDIUM",
    description: "Payment was late because consumer moved and never received billing statement",
    triggerConditions: [
      "address_change_late",
      "statement_not_received",
      "mail_forwarding_issue",
      "no_statement_received",
    ],
    requiredEvidence: ["proof_of_address_change", "mail_forwarding_records"],
    avoidWith: [],
    historicalSuccessRate: 0.32,
  },
  {
    code: "010",
    name: "Settlement or partial payment accepted",
    priority: "MEDIUM",
    description: "Creditor accepted settlement or partial payment but reporting doesn't reflect it",
    triggerConditions: [
      "settlement_accepted",
      "partial_payment_agreed",
      "settled_for_less",
      "payment_plan_completed",
      "settlement_not_reflected",
    ],
    requiredEvidence: ["settlement_agreement", "payment_confirmation"],
    avoidWith: [],
    historicalSuccessRate: 0.45,
  },

  // ==========================================================================
  // BANKRUPTCY CODES
  // ==========================================================================
  {
    code: "019",
    name: "Included in bankruptcy of another person",
    priority: "MEDIUM",
    description: "Account was included in another person's bankruptcy (joint account)",
    triggerConditions: [
      "joint_account_bankruptcy",
      "spouse_bankruptcy",
      "other_party_bankruptcy",
      "co_signer_bankruptcy",
    ],
    requiredEvidence: ["bankruptcy_schedules", "discharge_order"],
    avoidWith: ["037", "102"],
    historicalSuccessRate: 0.38,
  },
  {
    code: "037",
    name: "Account included in bankruptcy",
    priority: "MEDIUM",
    description: "Account was included in consumer's bankruptcy but not properly reflected",
    triggerConditions: [
      "bankruptcy_included",
      "discharged_debt",
      "chapter_7_discharge",
      "chapter_13_discharge",
      "bankruptcy_not_reflected",
    ],
    requiredEvidence: ["bankruptcy_discharge", "bankruptcy_schedules"],
    avoidWith: ["019"],
    historicalSuccessRate: 0.52,
  },
  {
    code: "102",
    name: "Account reaffirmed or not included in bankruptcy",
    priority: "MEDIUM",
    description: "Account was reaffirmed during bankruptcy or intentionally excluded",
    triggerConditions: [
      "reaffirmed_debt",
      "excluded_from_bankruptcy",
      "reaffirmation_agreement",
      "bankruptcy_exclusion",
    ],
    requiredEvidence: ["reaffirmation_agreement", "bankruptcy_schedules"],
    avoidWith: ["037"],
    historicalSuccessRate: 0.35,
  },

  // ==========================================================================
  // SPECIAL CIRCUMSTANCES CODES
  // ==========================================================================
  {
    code: "031",
    name: "Contract cancelled or rescinded",
    priority: "MEDIUM",
    description: "Contract was legally cancelled or rescinded within right of rescission period",
    triggerConditions: [
      "contract_cancelled",
      "rescinded_contract",
      "right_of_rescission",
      "cooling_off_period",
      "contract_void",
    ],
    requiredEvidence: ["cancellation_notice", "rescission_documentation"],
    avoidWith: [],
    historicalSuccessRate: 0.40,
  },
  {
    code: "038",
    name: "Claims active military duty",
    priority: "HIGH",
    description: "Consumer on active military duty - SCRA protections apply",
    triggerConditions: [
      "active_duty_military",
      "scra_protection",
      "military_deployment",
      "servicemembers_civil_relief",
    ],
    requiredEvidence: ["military_orders", "active_duty_verification"],
    avoidWith: [],
    historicalSuccessRate: 0.68, // High due to SCRA federal protections
  },
  {
    code: "039",
    name: "Insurance claim delayed payment",
    priority: "LOW",
    description: "Payment delayed due to pending insurance claim",
    triggerConditions: [
      "insurance_claim_pending",
      "insurance_delay",
      "claim_processing",
    ],
    requiredEvidence: ["insurance_claim_documentation"],
    avoidWith: [],
    historicalSuccessRate: 0.25,
  },
  {
    code: "040",
    name: "Account involved in litigation",
    priority: "MEDIUM",
    description: "Account is subject to pending legal dispute or litigation",
    triggerConditions: [
      "pending_litigation",
      "lawsuit_filed",
      "legal_dispute",
      "court_case_pending",
    ],
    requiredEvidence: ["court_filing", "litigation_documentation"],
    avoidWith: [],
    historicalSuccessRate: 0.42,
  },
  {
    code: "041",
    name: "Victim of natural or declared disaster",
    priority: "HIGH",
    description: "Consumer affected by federally declared disaster - special protections may apply",
    triggerConditions: [
      "natural_disaster",
      "declared_disaster",
      "fema_disaster",
      "hurricane_victim",
      "flood_victim",
      "fire_victim",
    ],
    requiredEvidence: ["disaster_declaration", "fema_assistance_documentation"],
    avoidWith: [],
    historicalSuccessRate: 0.55, // Higher due to disaster relief protections
  },
  {
    code: "100",
    name: "Claims account deferred",
    priority: "LOW",
    description: "Account payments were deferred but deferral not reflected",
    triggerConditions: [
      "deferment_not_reflected",
      "forbearance_dispute",
      "payment_deferral",
      "hardship_deferral",
    ],
    requiredEvidence: ["deferment_agreement", "forbearance_documentation"],
    avoidWith: [],
    historicalSuccessRate: 0.30,
  },
  {
    code: "101",
    name: "Not liable for account (ex-spouse, business)",
    priority: "MEDIUM",
    description: "Consumer claims no liability - account belongs to ex-spouse, business entity, etc.",
    triggerConditions: [
      "divorce_settlement",
      "ex_spouse_responsible",
      "business_account",
      "not_personally_liable",
      "guarantor_dispute",
    ],
    requiredEvidence: ["divorce_decree", "settlement_agreement", "business_documentation"],
    avoidWith: ["001", "002"], // Use 001/002 for true identity issues, 101 for liability
    historicalSuccessRate: 0.35,
  },

  // ==========================================================================
  // GENERIC CODE - AVOID (Lowest Priority)
  // Per Federal Reserve/CFPB: This code is "batch verified" with ~15% success
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

    // For CONSENT flow, prioritize identity/authorization codes
    if (flow === "CONSENT") {
      return ["001", "002", "103", "104", "101"].includes(code.code);
    }

    // For COLLECTION flow, include collection + payment/bankruptcy codes
    if (flow === "COLLECTION") {
      return [
        "006", "008", "010", "012", "014", "023", "024",
        "105", "106", "109", "031", "037", "102"
      ].includes(code.code);
    }

    // For ACCURACY flow, include accuracy codes
    if (flow === "ACCURACY") {
      return [
        "105", "106", "107", "108", "109",
        "008", "010", "023", "024", "100"
      ].includes(code.code);
    }

    // For COMBO, include all except 112
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
      // Identity/authorization disputes
      return EOSCAR_CODE_DATABASE.filter((c) =>
        ["001", "002", "103", "104", "101"].includes(c.code)
      );
    case "COLLECTION":
      // Collection-specific + payment/timing disputes
      return EOSCAR_CODE_DATABASE.filter((c) =>
        [
          "006", "008", "010", "012", "014", "023", "024",
          "105", "106", "109", "031", "037", "102"
        ].includes(c.code)
      );
    case "ACCURACY":
      // All accuracy-related codes including dates, balances, status
      return EOSCAR_CODE_DATABASE.filter((c) =>
        [
          "105", "106", "107", "108", "109",
          "008", "010", "023", "024", "100"
        ].includes(c.code)
      );
    case "COMBO":
      // All codes except generic 112
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

// =============================================================================
// METRO 2 COMPLIANCE CONDITION CODES (CCCs)
// These codes are used by furnishers to flag dispute status on credit reports
// Reference: CDIA Credit Reporting Resource Guide
// =============================================================================

export interface Metro2ComplianceCode {
  code: string;
  name: string;
  description: string;
  applicableWhen: string;
  removeWith?: string; // Code to use when removing this status
}

export const METRO2_COMPLIANCE_CODES: Metro2ComplianceCode[] = [
  {
    code: "XB",
    name: "Account in dispute - investigation in progress",
    description: "Account is currently in dispute under the FCRA and investigation is ongoing",
    applicableWhen: "Consumer has filed a dispute and investigation has not yet concluded",
    removeWith: "XR",
  },
  {
    code: "XC",
    name: "Investigation complete - consumer disagrees",
    description: "FCRA dispute investigation completed but consumer disagrees with results",
    applicableWhen: "Investigation is done but consumer maintains their position",
    removeWith: "XR",
  },
  {
    code: "XF",
    name: "Account in dispute under FCBA",
    description: "Account is disputed under Fair Credit Billing Act, investigation in progress",
    applicableWhen: "Consumer disputes billing error under FCBA (credit card accounts)",
    removeWith: "XR",
  },
  {
    code: "XG",
    name: "FCBA dispute complete - consumer disagrees",
    description: "FCBA dispute investigation completed but consumer disagrees with results",
    applicableWhen: "FCBA billing dispute resolved but consumer contests outcome",
    removeWith: "XR",
  },
  {
    code: "XH",
    name: "Previously in dispute - resolved",
    description: "Account was previously in dispute and investigation has been completed and resolved",
    applicableWhen: "Dispute was resolved satisfactorily or time period has passed",
    removeWith: "XR",
  },
  {
    code: "XR",
    name: "Remove compliance condition code",
    description: "Removes the most recently reported Compliance Condition Code",
    applicableWhen: "When a previously applicable compliance condition no longer applies",
  },
];

// =============================================================================
// E-OSCAR ACDV RESPONSE CODES
// These are the responses furnishers send back through e-OSCAR after investigation
// Reference: e-OSCAR Quick Updates, December 2023 additions
// =============================================================================

export interface ACDVResponseCode {
  code: string;
  name: string;
  description: string;
  outcome: "favorable" | "unfavorable" | "neutral";
  nextSteps?: string;
}

export const ACDV_RESPONSE_CODES: ACDVResponseCode[] = [
  {
    code: "01",
    name: "Account deleted",
    description: "Account has been deleted from consumer's credit file",
    outcome: "favorable",
    nextSteps: "Verify deletion on updated credit report within 30 days",
  },
  {
    code: "02",
    name: "Account information modified",
    description: "Account information has been updated/corrected as disputed",
    outcome: "favorable",
    nextSteps: "Review updated information to confirm accuracy",
  },
  {
    code: "03",
    name: "Account verified as reported",
    description: "Furnisher verified information is accurate as originally reported",
    outcome: "unfavorable",
    nextSteps: "Request Method of Verification (MOV), consider direct dispute with furnisher",
  },
  {
    code: "04",
    name: "Account previously deleted",
    description: "Account was already deleted prior to this dispute",
    outcome: "neutral",
    nextSteps: "Confirm deletion still reflected on report",
  },
  {
    code: "05",
    name: "No record found",
    description: "Furnisher has no record of this account",
    outcome: "favorable",
    nextSteps: "Account should be deleted - follow up if still appears",
  },
  {
    code: "06",
    name: "Account information updated - no changes to disputed items",
    description: "Some account info updated but disputed items unchanged",
    outcome: "neutral",
    nextSteps: "Review what was updated vs. what was disputed",
  },
  {
    code: "07",
    name: "Unable to locate account",
    description: "Furnisher cannot locate account with information provided",
    outcome: "favorable",
    nextSteps: "Account should be deleted if cannot be verified",
  },
  {
    code: "12",
    name: "Accurate as of last submission - recent account activity",
    description: "Information was accurate as of last submission due to recent account activity",
    outcome: "unfavorable",
    nextSteps: "Review recent activity that may have changed account status",
  },
  {
    code: "13",
    name: "Accurate but deleted per furnisher policy",
    description: "Information was accurate as of last submission but deleted due to data furnisher policy",
    outcome: "favorable",
    nextSteps: "Verify deletion on updated report",
  },
];

/**
 * Get the expected outcome based on response code
 */
export function getResponseOutcome(responseCode: string): ACDVResponseCode | undefined {
  return ACDV_RESPONSE_CODES.find((r) => r.code === responseCode);
}

/**
 * Determine if a response code indicates dispute success
 */
export function isSuccessfulResponse(responseCode: string): boolean {
  const response = ACDV_RESPONSE_CODES.find((r) => r.code === responseCode);
  return response?.outcome === "favorable";
}

/**
 * Get all favorable response codes
 */
export function getFavorableResponseCodes(): string[] {
  return ACDV_RESPONSE_CODES
    .filter((r) => r.outcome === "favorable")
    .map((r) => r.code);
}

/**
 * Get appropriate Metro 2 code based on dispute status
 */
export function getMetro2DisputeCode(
  disputeInProgress: boolean,
  investigationComplete: boolean,
  consumerDisagrees: boolean,
  isFCBA: boolean = false
): string {
  if (!disputeInProgress && investigationComplete && !consumerDisagrees) {
    return "XH"; // Resolved
  }
  if (investigationComplete && consumerDisagrees) {
    return isFCBA ? "XG" : "XC"; // Complete but consumer disagrees
  }
  if (disputeInProgress) {
    return isFCBA ? "XF" : "XB"; // In progress
  }
  return "XR"; // Remove code
}
