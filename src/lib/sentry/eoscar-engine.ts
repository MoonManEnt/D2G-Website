/**
 * e-OSCAR Code Intelligence Engine
 *
 * Provides the complete e-OSCAR code database, recommendation logic,
 * and code combination validation for Sentry Mode disputes.
 */

import type { DisputeAccountData, DetectedIssue } from "@/lib/dispute-creation/types";
import type { EOSCARCode, EOSCARRecommendation, FurnisherProfile } from "./types";

// =============================================================================
// e-OSCAR CODE DATABASE — All 29 dispute reason codes
// =============================================================================

export const EOSCAR_CODE_DATABASE: EOSCARCode[] = [
  {
    code: "001",
    name: "Not his/hers",
    priority: "HIGH",
    triggerConditions: ["account_not_mine", "mixed_file", "identity_dispute", "fraud"],
    requiredEvidence: ["identity_theft_report", "police_report", "ftc_affidavit"],
    avoidWith: ["106", "109"],
    baselineSuccessRate: 0.55,
    description: "Consumer claims account does not belong to them",
  },
  {
    code: "002",
    name: "Belongs to another person with same/similar name",
    priority: "HIGH",
    triggerConditions: ["mixed_file", "common_name", "junior_senior"],
    requiredEvidence: ["identity_documents", "proof_of_identity"],
    avoidWith: ["001"],
    baselineSuccessRate: 0.52,
    description: "Account belongs to a different person with a similar name",
  },
  {
    code: "003",
    name: "Account closed",
    priority: "MEDIUM",
    triggerConditions: ["closed_account_reporting", "account_closed_by_consumer"],
    requiredEvidence: ["closure_confirmation", "final_statement"],
    avoidWith: [],
    baselineSuccessRate: 0.40,
    description: "Consumer claims account is closed but reported as open",
  },
  {
    code: "004",
    name: "Account paid in full",
    priority: "MEDIUM",
    triggerConditions: ["paid_in_full", "zero_balance_not_reflected"],
    requiredEvidence: ["payment_receipt", "payoff_letter", "bank_statement"],
    avoidWith: [],
    baselineSuccessRate: 0.45,
    description: "Consumer claims account was paid in full",
  },
  {
    code: "005",
    name: "Not late",
    priority: "HIGH",
    triggerConditions: ["late_payment_dispute", "payment_timing", "grace_period"],
    requiredEvidence: ["bank_statements", "payment_confirmations", "cleared_check"],
    avoidWith: [],
    baselineSuccessRate: 0.38,
    description: "Consumer disputes late payment marking",
  },
  {
    code: "006",
    name: "Not aware of collection/account",
    priority: "MEDIUM",
    triggerConditions: ["unknown_collection", "no_notice", "debt_buyer"],
    requiredEvidence: [],
    avoidWith: ["012"],
    baselineSuccessRate: 0.35,
    description: "Consumer is not aware of the collection or account",
  },
  {
    code: "007",
    name: "Belongs to ex-spouse",
    priority: "MEDIUM",
    triggerConditions: ["divorce", "ex_spouse_debt", "court_order"],
    requiredEvidence: ["divorce_decree", "court_order"],
    avoidWith: [],
    baselineSuccessRate: 0.30,
    description: "Debt assigned to ex-spouse in divorce proceedings",
  },
  {
    code: "008",
    name: "Disputes payment rating",
    priority: "HIGH",
    triggerConditions: ["incorrect_rating", "payment_history_wrong", "status_incorrect"],
    requiredEvidence: ["payment_records", "bank_statements"],
    avoidWith: [],
    baselineSuccessRate: 0.40,
    description: "Consumer disputes the payment rating on the account",
  },
  {
    code: "009",
    name: "Account not delinquent",
    priority: "MEDIUM",
    triggerConditions: ["current_account", "never_delinquent", "payment_applied"],
    requiredEvidence: ["payment_history", "account_statements"],
    avoidWith: [],
    baselineSuccessRate: 0.35,
    description: "Consumer states account was never delinquent",
  },
  {
    code: "010",
    name: "Included in bankruptcy",
    priority: "MEDIUM",
    triggerConditions: ["bankruptcy_filed", "discharged_debt"],
    requiredEvidence: ["bankruptcy_petition", "discharge_order"],
    avoidWith: [],
    baselineSuccessRate: 0.50,
    description: "Account was included in bankruptcy filing",
  },
  {
    code: "011",
    name: "Paid before collection/charge-off",
    priority: "MEDIUM",
    triggerConditions: ["paid_before_chargeoff", "paid_before_collection"],
    requiredEvidence: ["payment_receipt", "bank_statement"],
    avoidWith: [],
    baselineSuccessRate: 0.42,
    description: "Consumer paid account before it went to collection or was charged off",
  },
  {
    code: "012",
    name: "Disputes amount owed",
    priority: "MEDIUM",
    triggerConditions: ["balance_incorrect", "inflated_balance", "unauthorized_charges"],
    requiredEvidence: ["account_statements", "payment_ledger"],
    avoidWith: ["006"],
    baselineSuccessRate: 0.33,
    description: "Consumer disputes the amount owed on the account",
  },
  {
    code: "013",
    name: "Disputes terms",
    priority: "LOW",
    triggerConditions: ["incorrect_terms", "interest_rate_wrong", "term_length_wrong"],
    requiredEvidence: ["original_agreement", "contract"],
    avoidWith: [],
    baselineSuccessRate: 0.28,
    description: "Consumer disputes the terms of the account",
  },
  {
    code: "103",
    name: "Identity fraud — new account",
    priority: "HIGH",
    triggerConditions: ["identity_theft", "fraudulent_account", "new_account_fraud"],
    requiredEvidence: ["identity_theft_report", "police_report", "ftc_affidavit"],
    avoidWith: ["001"],
    baselineSuccessRate: 0.65,
    description: "Account opened fraudulently using consumer's identity",
  },
  {
    code: "104",
    name: "Identity fraud — existing account",
    priority: "HIGH",
    triggerConditions: ["account_takeover", "unauthorized_use_existing"],
    requiredEvidence: ["identity_theft_report", "police_report"],
    avoidWith: [],
    baselineSuccessRate: 0.60,
    description: "Fraudulent activity on consumer's existing account",
  },
  {
    code: "105",
    name: "Disputes dates",
    priority: "HIGH",
    triggerConditions: ["dofd_incorrect", "date_opened_wrong", "date_closed_wrong", "date_last_active_wrong"],
    requiredEvidence: ["account_statements", "original_agreement"],
    avoidWith: [],
    baselineSuccessRate: 0.42,
    description: "Consumer disputes reported dates on the account",
  },
  {
    code: "106",
    name: "Disputes payment history",
    priority: "HIGH",
    triggerConditions: ["payment_history_incorrect", "late_marks_wrong", "missed_payment_dispute"],
    requiredEvidence: ["bank_statements", "payment_confirmations", "cleared_checks"],
    avoidWith: ["001", "103"],
    baselineSuccessRate: 0.38,
    description: "Consumer disputes reported payment history",
  },
  {
    code: "107",
    name: "Disputes remarks",
    priority: "MEDIUM",
    triggerConditions: ["incorrect_remarks", "negative_comment", "outdated_remark"],
    requiredEvidence: [],
    avoidWith: [],
    baselineSuccessRate: 0.35,
    description: "Consumer disputes remarks or comments on account",
  },
  {
    code: "108",
    name: "Disputes account status",
    priority: "HIGH",
    triggerConditions: ["status_incorrect", "should_be_closed", "should_be_paid"],
    requiredEvidence: ["closure_letter", "payoff_letter", "account_statement"],
    avoidWith: [],
    baselineSuccessRate: 0.43,
    description: "Consumer disputes the current account status",
  },
  {
    code: "109",
    name: "Disputes current balance",
    priority: "HIGH",
    triggerConditions: ["balance_wrong", "payment_not_applied", "fees_disputed"],
    requiredEvidence: ["recent_statement", "payment_receipt"],
    avoidWith: [],
    baselineSuccessRate: 0.45,
    description: "Consumer disputes the current balance reported",
  },
  {
    code: "110",
    name: "Disputes credit limit",
    priority: "LOW",
    triggerConditions: ["credit_limit_wrong", "limit_decreased_incorrectly"],
    requiredEvidence: ["account_statement", "credit_limit_notification"],
    avoidWith: [],
    baselineSuccessRate: 0.30,
    description: "Consumer disputes reported credit limit",
  },
  {
    code: "111",
    name: "Disputes high credit",
    priority: "LOW",
    triggerConditions: ["high_credit_incorrect", "original_amount_wrong"],
    requiredEvidence: ["original_agreement", "loan_documents"],
    avoidWith: [],
    baselineSuccessRate: 0.32,
    description: "Consumer disputes high credit/original amount",
  },
  {
    code: "112",
    name: "Claims inaccurate information — provide specifics",
    priority: "LOW",
    triggerConditions: ["generic_dispute", "general_inaccuracy"],
    requiredEvidence: [],
    avoidWith: [],
    baselineSuccessRate: 0.15,
    description: "Generic dispute without specifics — high frivolous risk",
  },
  {
    code: "113",
    name: "Claims company is not a creditor",
    priority: "MEDIUM",
    triggerConditions: ["unknown_creditor", "name_change", "debt_sold"],
    requiredEvidence: [],
    avoidWith: [],
    baselineSuccessRate: 0.38,
    description: "Consumer does not recognize the reporting company",
  },
  {
    code: "200",
    name: "Disputes inquiry — did not authorize",
    priority: "HIGH",
    triggerConditions: ["unauthorized_inquiry", "hard_pull_dispute"],
    requiredEvidence: [],
    avoidWith: [],
    baselineSuccessRate: 0.48,
    description: "Consumer did not authorize the credit inquiry",
  },
  {
    code: "201",
    name: "Disputes inquiry — not initiated by consumer",
    priority: "HIGH",
    triggerConditions: ["identity_theft_inquiry", "fraudulent_application"],
    requiredEvidence: ["identity_theft_report"],
    avoidWith: [],
    baselineSuccessRate: 0.50,
    description: "Inquiry was not initiated by the consumer",
  },
  {
    code: "300",
    name: "Disputes public record",
    priority: "MEDIUM",
    triggerConditions: ["public_record_dispute", "judgment_paid", "lien_released"],
    requiredEvidence: ["court_documents", "satisfaction_of_judgment"],
    avoidWith: [],
    baselineSuccessRate: 0.40,
    description: "Consumer disputes public record entry",
  },
  {
    code: "301",
    name: "Disputes public record — paid",
    priority: "MEDIUM",
    triggerConditions: ["public_record_paid", "judgment_satisfied"],
    requiredEvidence: ["proof_of_payment", "satisfaction_document"],
    avoidWith: [],
    baselineSuccessRate: 0.45,
    description: "Consumer states public record has been paid/satisfied",
  },
  {
    code: "302",
    name: "Disputes personal information",
    priority: "LOW",
    triggerConditions: ["wrong_address", "wrong_name", "wrong_ssn", "wrong_employer"],
    requiredEvidence: ["id_documents"],
    avoidWith: [],
    baselineSuccessRate: 0.60,
    description: "Consumer disputes personal information on file",
  },
];

// =============================================================================
// RECOMMENDATION ENGINE
// =============================================================================

/**
 * Recommend e-OSCAR codes for an account based on detected issues,
 * account data, and optional furnisher profile with historical success rates.
 */
export function recommendEOSCARCodes(
  account: DisputeAccountData,
  issues: DetectedIssue[],
  furnisherProfile?: FurnisherProfile
): EOSCARRecommendation[] {
  const recommendations: EOSCARRecommendation[] = [];

  // Build trigger set from issues and account data
  const triggers = new Set<string>();

  for (const issue of issues) {
    const code = issue.code.toLowerCase();
    // Map issue codes to trigger conditions
    if (code.includes("balance")) triggers.add("balance_incorrect").add("balance_wrong");
    if (code.includes("late") || code.includes("payment")) {
      triggers.add("late_payment_dispute").add("payment_history_incorrect");
    }
    if (code.includes("date") || code.includes("dofd")) {
      triggers.add("dofd_incorrect").add("date_opened_wrong");
    }
    if (code.includes("status")) triggers.add("status_incorrect");
    if (code.includes("collection")) triggers.add("unknown_collection").add("no_notice");
    if (code.includes("fraud") || code.includes("identity")) {
      triggers.add("identity_theft").add("fraudulent_account");
    }
    if (code.includes("not_mine") || code.includes("mixed")) {
      triggers.add("account_not_mine").add("mixed_file");
    }
    if (code.includes("closed")) triggers.add("closed_account_reporting");
    if (code.includes("paid")) triggers.add("paid_in_full").add("zero_balance_not_reflected");
    if (code.includes("remarks") || code.includes("comment")) triggers.add("incorrect_remarks");
    if (code.includes("inquiry")) triggers.add("unauthorized_inquiry");
    if (issue.suggestedFlow === "COLLECTION") triggers.add("unknown_collection");
  }

  // Infer triggers from account data
  if (account.accountStatus?.toUpperCase() === "COLLECTION") {
    triggers.add("unknown_collection");
  }
  if (account.balance && account.balance > 0 && account.accountStatus?.toUpperCase() === "PAID") {
    triggers.add("balance_wrong").add("zero_balance_not_reflected");
  }

  // Score each code
  for (const eoscarCode of EOSCAR_CODE_DATABASE) {
    const matchingTriggers = eoscarCode.triggerConditions.filter((t) => triggers.has(t));
    if (matchingTriggers.length === 0) continue;

    const matchStrength = Math.min(
      100,
      Math.round((matchingTriggers.length / eoscarCode.triggerConditions.length) * 100)
    );

    // Check evidence availability
    const evidenceAvailable = eoscarCode.requiredEvidence.length === 0;

    // Get historical success rate from furnisher profile if available
    let historicalSuccessRate = eoscarCode.baselineSuccessRate;
    if (furnisherProfile) {
      const profileCode = furnisherProfile.effectiveCodes.find(
        (c) => c.code === eoscarCode.code
      );
      if (profileCode?.isReliable) {
        historicalSuccessRate = profileCode.successRate;
      }
    }

    recommendations.push({
      code: eoscarCode.code,
      name: eoscarCode.name,
      matchStrength,
      evidenceAvailable,
      historicalSuccessRate,
      reasoning: `Matched on: ${matchingTriggers.join(", ")}`,
      priority: eoscarCode.priority,
    });
  }

  // Sort by match strength (descending), then priority
  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  recommendations.sort((a, b) => {
    if (b.matchStrength !== a.matchStrength) return b.matchStrength - a.matchStrength;
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  // Filter out code 112 if we have better alternatives
  if (recommendations.length > 1) {
    const hasSpecificCodes = recommendations.some((r) => r.code !== "112");
    if (hasSpecificCodes) {
      return recommendations.filter((r) => r.code !== "112");
    }
  }

  return recommendations;
}

// =============================================================================
// CODE COMBINATION VALIDATOR
// =============================================================================

/**
 * Validate that a set of e-OSCAR codes can be used together without conflicts.
 */
export function validateCodeCombination(codes: string[]): {
  valid: boolean;
  conflicts: string[];
} {
  const conflicts: string[] = [];
  const codeMap = new Map(EOSCAR_CODE_DATABASE.map((c) => [c.code, c]));

  for (const code of codes) {
    const codeData = codeMap.get(code);
    if (!codeData) continue;

    for (const avoidCode of codeData.avoidWith) {
      if (codes.includes(avoidCode)) {
        conflicts.push(
          `Code ${code} (${codeData.name}) conflicts with code ${avoidCode} (${codeMap.get(avoidCode)?.name})`
        );
      }
    }
  }

  // Deduplicate conflicts (A conflicts with B = B conflicts with A)
  const uniqueConflicts = [...new Set(conflicts)];

  return {
    valid: uniqueConflicts.length === 0,
    conflicts: uniqueConflicts,
  };
}
