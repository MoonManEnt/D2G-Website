/**
 * AI Rules Engine for Dispute2Go
 * Powered by AMELIA - Adaptive Multilingual Escalation Letter Intelligence Agent
 *
 * This is the "brain" of the dispute system that codifies all business logic,
 * legal knowledge, and decision-making rules for credit repair disputes.
 *
 * Key Responsibilities:
 * 1. Analyze parsed credit reports and identify disputable issues
 * 2. Prioritize accounts based on impact and success probability
 * 3. Select appropriate dispute flow for each account
 * 4. Determine correct round and escalation timing
 * 5. Coordinate disputes across bureaus
 * 6. Generate legally-compliant dispute letters via Amelia
 * 7. Track deadlines and automate follow-ups
 */

import { completeLLM, type TaskType } from "./llm-orchestrator";
import {
  generateAmeliaLetter,
  generateAmeliaAILetter,
  type LetterGenerationRequest,
  type GeneratedLetter,
} from "./amelia";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type DisputeFlow = "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO";
export type CRA = "TRANSUNION" | "EXPERIAN" | "EQUIFAX";
export type AccountStatus = "OPEN" | "CLOSED" | "PAID" | "CHARGED_OFF" | "COLLECTION" | "DEROGATORY";
export type DisputeStatus = "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "SENT" | "RESPONDED" | "RESOLVED" | "ESCALATED";
export type ResponseOutcome = "ITEMS_DELETED" | "ITEMS_UPDATED" | "VERIFIED" | "NO_RESPONSE" | "PARTIAL";

export interface ParsedAccount {
  id: string;
  creditorName: string;
  maskedAccountId?: string;
  cra: CRA;
  accountType?: string;
  accountStatus?: AccountStatus;
  balance?: number;
  pastDue?: number;
  creditLimit?: number;
  dateOpened?: string;
  dateReported?: string;
  paymentStatus?: string;
  confidenceScore: number;
  detectedIssues: DetectedIssue[];
  isDisputable: boolean;
}

export interface DetectedIssue {
  code: string;
  description: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  suggestedFlow: DisputeFlow;
  legalCitation?: string;
  evidence?: string;
}

export interface DisputeRecommendation {
  accountId: string;
  creditorName: string;
  cra: CRA;
  recommendedFlow: DisputeFlow;
  suggestedRound: number;
  priority: number; // 1 = highest
  reasoning: string;
  legalBasis: string[];
  estimatedSuccessRate: number;
  impactScore: number; // How much this affects credit score
}

export interface DisputeStrategy {
  recommendations: DisputeRecommendation[];
  overallStrategy: string;
  crossBureauPlan: CrossBureauPlan;
  timeline: DisputeTimeline;
  warnings: string[];
}

export interface CrossBureauPlan {
  accountGroups: AccountGroup[];
  coordinationStrategy: string;
}

export interface AccountGroup {
  fingerprint: string;
  creditorName: string;
  bureaus: CRA[];
  recommendedApproach: "SIMULTANEOUS" | "SEQUENTIAL" | "PRIMARY_ONLY";
  reasoning: string;
}

export interface DisputeTimeline {
  phases: TimelinePhase[];
  totalEstimatedDays: number;
  nextActionDate: Date;
}

export interface TimelinePhase {
  phase: number;
  description: string;
  accounts: string[];
  startDate: Date;
  deadlineDate: Date;
  actions: string[];
}

export interface ExistingDispute {
  id: string;
  accountId: string;
  cra: CRA;
  flow: DisputeFlow;
  round: number;
  status: DisputeStatus;
  sentDate?: Date;
  responseOutcome?: ResponseOutcome;
  deadlineDate?: Date;
}

// =============================================================================
// LEGAL KNOWLEDGE BASE
// =============================================================================

/**
 * FCRA Section References and When to Use Them
 */
export const FCRA_CITATIONS = {
  // Accuracy Requirements
  "1681e(b)": {
    title: "Maximum Possible Accuracy",
    description: "CRAs must follow reasonable procedures to assure maximum possible accuracy",
    useWhen: ["balance_discrepancy", "incorrect_status", "wrong_dates", "wrong_payment_history"],
    rounds: [2, 3, 4],
  },
  "1681i(a)(1)(A)": {
    title: "Reinvestigation Requirement",
    description: "CRA must conduct reasonable reinvestigation within 30 days",
    useWhen: ["any_dispute", "first_round"],
    rounds: [1, 2],
  },
  "1681i(a)(5)": {
    title: "30-Day Deadline",
    description: "Investigation must be completed within 30 days",
    useWhen: ["no_response", "deadline_passed"],
    rounds: [2, 3, 4],
  },
  "1681i(a)(6)(B)": {
    title: "Method of Verification",
    description: "CRA must provide method of verification upon request",
    useWhen: ["verification_demanded", "round_2_plus"],
    rounds: [2, 3, 4],
  },
  "1681i(a)(7)": {
    title: "Procedure Description",
    description: "CRA must describe reinvestigation procedure",
    useWhen: ["process_questioned"],
    rounds: [3, 4],
  },
  "1681s-2(a)(1)": {
    title: "Furnisher Accuracy Duty",
    description: "Furnishers must report accurate information",
    useWhen: ["furnisher_error", "wrong_balance", "wrong_status"],
    rounds: [2, 3, 4],
  },
  "1681s-2(b)": {
    title: "Furnisher Investigation Duty",
    description: "Furnisher must investigate disputed information",
    useWhen: ["furnisher_dispute"],
    rounds: [3, 4],
  },
  "1681c(a)": {
    title: "7-Year Reporting Limit",
    description: "Most negative information cannot be reported beyond 7 years",
    useWhen: ["outdated_account", "account_over_7_years"],
    rounds: [1, 2],
  },
  "1681b(a)(2)": {
    title: "Written Consent Required",
    description: "Consumer report requires written consent",
    useWhen: ["unauthorized_inquiry", "no_consent"],
    rounds: [1, 2],
  },
  "1681b(f)": {
    title: "Permissible Purpose Required",
    description: "Must have permissible purpose to obtain report",
    useWhen: ["no_permissible_purpose", "hard_inquiry_dispute"],
    rounds: [1, 2, 3],
  },

  // Collection-Specific
  "1692g": {
    title: "Debt Validation Notice (FDCPA)",
    description: "Collector must provide validation notice within 5 days",
    useWhen: ["collection_account", "validation_request"],
    rounds: [1, 2],
  },
  "1692g(b)": {
    title: "Validation Request Cease (FDCPA)",
    description: "Collection must cease until debt validated",
    useWhen: ["validation_disputed", "collection_continuing"],
    rounds: [2, 3],
  },
  "1692e(10)": {
    title: "False Representation (FDCPA)",
    description: "Prohibition on false representations",
    useWhen: ["misrepresented_debt", "wrong_amount", "wrong_creditor"],
    rounds: [2, 3, 4],
  },
  "1681a(m)": {
    title: "Medical Debt Restrictions",
    description: "Special protections for medical debt reporting",
    useWhen: ["medical_debt", "medical_collection"],
    rounds: [1, 2],
  },
};

/**
 * Issue Detection Rules
 */
export const ISSUE_DETECTION_RULES = {
  // Balance Issues
  BALANCE_ZERO_BUT_DEROGATORY: {
    condition: (acc: ParsedAccount) => acc.balance === 0 && acc.accountStatus === "CHARGED_OFF",
    code: "BALANCE_ZERO_CHARGEOFF",
    description: "Account shows $0 balance but still reports as charged-off",
    severity: "HIGH" as const,
    suggestedFlow: "ACCURACY" as DisputeFlow,
    legalCitation: "1681e(b)",
  },
  BALANCE_MISMATCH: {
    condition: (acc: ParsedAccount, crossBureauData?: ParsedAccount[]) => {
      if (!crossBureauData) return false;
      const balances = crossBureauData.map(a => a.balance).filter(b => b !== undefined);
      return balances.length > 1 && new Set(balances).size > 1;
    },
    code: "BALANCE_INCONSISTENCY",
    description: "Balance differs across credit bureaus",
    severity: "HIGH" as const,
    suggestedFlow: "ACCURACY" as DisputeFlow,
    legalCitation: "1681e(b)",
  },

  // Status Issues
  COLLECTION_ACCOUNT: {
    condition: (acc: ParsedAccount) => acc.accountStatus === "COLLECTION",
    code: "COLLECTION_ACCOUNT",
    description: "Account is in collection status",
    severity: "HIGH" as const,
    suggestedFlow: "COLLECTION" as DisputeFlow,
    legalCitation: "1692g",
  },
  CHARGED_OFF: {
    condition: (acc: ParsedAccount) => acc.accountStatus === "CHARGED_OFF",
    code: "DEROGATORY_CHARGEOFF",
    description: "Account shows charged-off status",
    severity: "HIGH" as const,
    suggestedFlow: "ACCURACY" as DisputeFlow,
    legalCitation: "1681e(b)",
  },

  // Date Issues
  OUTDATED_ACCOUNT: {
    condition: (acc: ParsedAccount) => {
      if (!acc.dateOpened) return false;
      const openDate = new Date(acc.dateOpened);
      const sevenYearsAgo = new Date();
      sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);
      return openDate < sevenYearsAgo;
    },
    code: "POTENTIALLY_OUTDATED",
    description: "Account may exceed 7-year reporting limit",
    severity: "HIGH" as const,
    suggestedFlow: "ACCURACY" as DisputeFlow,
    legalCitation: "1681c(a)",
  },
  MISSING_DATE: {
    condition: (acc: ParsedAccount) => !acc.dateOpened,
    code: "MISSING_DATE_OPENED",
    description: "Required date opened field is missing",
    severity: "MEDIUM" as const,
    suggestedFlow: "ACCURACY" as DisputeFlow,
    legalCitation: "1681e(b)",
  },

  // Payment Status Issues
  LATE_PAYMENT: {
    condition: (acc: ParsedAccount) =>
      acc.paymentStatus?.toLowerCase().includes("late") ||
      acc.paymentStatus?.toLowerCase().includes("past due"),
    code: "LATE_PAYMENT",
    description: "Account shows late payment history",
    severity: "MEDIUM" as const,
    suggestedFlow: "ACCURACY" as DisputeFlow,
    legalCitation: "1681e(b)",
  },
  PAST_DUE_BALANCE: {
    condition: (acc: ParsedAccount) => (acc.pastDue ?? 0) > 0,
    code: "PAST_DUE_AMOUNT",
    description: "Account shows past due balance",
    severity: "HIGH" as const,
    suggestedFlow: "ACCURACY" as DisputeFlow,
    legalCitation: "1681s-2(a)(1)",
  },

  // Medical Debt
  MEDICAL_DEBT: {
    condition: (acc: ParsedAccount) =>
      acc.creditorName.toLowerCase().includes("medical") ||
      acc.creditorName.toLowerCase().includes("hospital") ||
      acc.creditorName.toLowerCase().includes("health"),
    code: "MEDICAL_DEBT",
    description: "Medical debt with special FCRA protections",
    severity: "MEDIUM" as const,
    suggestedFlow: "COLLECTION" as DisputeFlow,
    legalCitation: "1681a(m)",
  },
};

// =============================================================================
// ROUND ESCALATION RULES
// =============================================================================

/**
 * Rules for when to escalate to the next round
 */
export const ESCALATION_RULES = {
  /**
   * Determine if escalation is needed based on current state
   */
  shouldEscalate(dispute: ExistingDispute): {
    shouldEscalate: boolean;
    reason: string;
    urgency: "IMMEDIATE" | "STANDARD" | "OPTIONAL";
  } {
    const now = new Date();
    const daysSinceSent = dispute.sentDate
      ? Math.floor((now.getTime() - dispute.sentDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // No response after 30 days = automatic FCRA violation
    if (dispute.status === "SENT" && daysSinceSent > 30 && !dispute.responseOutcome) {
      return {
        shouldEscalate: true,
        reason: "CRA failed to respond within 30-day FCRA deadline. This is a willful violation of 15 USC 1681i(a)(1).",
        urgency: "IMMEDIATE",
      };
    }

    // Item was verified but disputed - escalate
    if (dispute.responseOutcome === "VERIFIED") {
      return {
        shouldEscalate: true,
        reason: "CRA verified disputed item. Escalate to demand Method of Verification and document inadequate investigation.",
        urgency: "STANDARD",
      };
    }

    // Partial resolution - continue disputing remaining items
    if (dispute.responseOutcome === "PARTIAL") {
      return {
        shouldEscalate: true,
        reason: "Only partial resolution achieved. Continue dispute for remaining items.",
        urgency: "STANDARD",
      };
    }

    // Approaching deadline (25+ days) - prepare escalation
    if (dispute.status === "SENT" && daysSinceSent >= 25 && daysSinceSent <= 30) {
      return {
        shouldEscalate: false, // Not yet, but prepare
        reason: "Approaching 30-day deadline. Prepare escalation letter.",
        urgency: "OPTIONAL",
      };
    }

    return {
      shouldEscalate: false,
      reason: "No escalation needed at this time.",
      urgency: "OPTIONAL",
    };
  },

  /**
   * Get next round number based on current state
   */
  getNextRound(currentRound: number, flow: DisputeFlow, outcome: ResponseOutcome): number {
    const maxRounds: Record<DisputeFlow, number> = {
      ACCURACY: 11,
      COLLECTION: 10,
      CONSENT: 3,
      COMBO: 12,
    };

    // If items deleted, no need to escalate
    if (outcome === "ITEMS_DELETED") {
      return currentRound; // Stay at current, move to next account/bureau
    }

    // Progress to next round, cap at max
    const nextRound = currentRound + 1;
    return Math.min(nextRound, maxRounds[flow]);
  },

  /**
   * Get round-specific strategy
   */
  getRoundStrategy(round: number, flow: DisputeFlow): {
    tone: "PROFESSIONAL" | "ASSERTIVE" | "AGGRESSIVE" | "LITIGATION";
    approach: string;
    keyPoints: string[];
    legalCitations: string[];
  } {
    if (round === 1) {
      return {
        tone: "PROFESSIONAL",
        approach: "Initial dispute requesting investigation",
        keyPoints: [
          "Clearly identify disputed items",
          "State dispute reason without excessive detail",
          "Request investigation per FCRA 611",
          "Request deletion if cannot verify",
        ],
        legalCitations: ["1681i(a)(1)(A)"],
      };
    }

    if (round === 2) {
      return {
        tone: "ASSERTIVE",
        approach: "Demand Method of Verification",
        keyPoints: [
          "Reference previous inadequate investigation",
          "Demand Method of Verification per FCRA 611(a)(7)",
          "Cite Cushman v. Trans Union Corp precedent",
          "15-day response deadline",
        ],
        legalCitations: ["1681i(a)(6)(B)", "1681i(a)(7)", "1681e(b)"],
      };
    }

    if (round === 3) {
      return {
        tone: "AGGRESSIVE",
        approach: "Document FCRA violations, notice of intent",
        keyPoints: [
          "List specific FCRA violations",
          "Calculate potential damages",
          "Notice of intent to pursue legal remedies",
          "Final opportunity to correct",
        ],
        legalCitations: ["1681n", "1681o", "1681s-2(b)"],
      };
    }

    // Round 4+
    return {
      tone: "LITIGATION",
      approach: "Final demand before lawsuit",
      keyPoints: [
        "Detailed violation documentation",
        "Specific damage calculations",
        "10-day settlement window",
        "Attorney fee notice",
      ],
      legalCitations: ["1681n", "1681o", "1681p"],
    };
  },
};

// =============================================================================
// PRIORITY SCORING ENGINE
// =============================================================================

/**
 * Calculate priority score for an account (1 = highest priority)
 */
export function calculatePriority(
  account: ParsedAccount,
  existingDisputes: ExistingDispute[]
): { priority: number; reasoning: string; impactScore: number } {
  let score = 50; // Base score
  const factors: string[] = [];

  // High-impact accounts get higher priority
  if (account.accountStatus === "COLLECTION") {
    score += 30;
    factors.push("Collection account (high impact on score)");
  }
  if (account.accountStatus === "CHARGED_OFF") {
    score += 25;
    factors.push("Charged-off status (significant derogatory)");
  }
  if ((account.pastDue ?? 0) > 0) {
    score += 20;
    factors.push("Past due balance showing");
  }

  // Balance affects priority
  if (account.balance && account.balance > 5000) {
    score += 15;
    factors.push("High balance account");
  } else if (account.balance && account.balance > 1000) {
    score += 10;
    factors.push("Moderate balance account");
  }

  // Issue severity
  const highSeverityIssues = account.detectedIssues.filter(i => i.severity === "HIGH").length;
  score += highSeverityIssues * 10;
  if (highSeverityIssues > 0) {
    factors.push(`${highSeverityIssues} high-severity issue(s)`);
  }

  // Cross-bureau inconsistencies are highly disputable
  const hasInconsistency = account.detectedIssues.some(i =>
    i.code.includes("INCONSISTENCY") || i.code.includes("MISMATCH")
  );
  if (hasInconsistency) {
    score += 20;
    factors.push("Cross-bureau inconsistency (strong dispute basis)");
  }

  // Outdated accounts have legal basis for removal
  const isOutdated = account.detectedIssues.some(i => i.code === "POTENTIALLY_OUTDATED");
  if (isOutdated) {
    score += 25;
    factors.push("Potentially exceeds 7-year limit");
  }

  // Check if already being disputed
  const existingDispute = existingDisputes.find(d => d.accountId === account.id);
  if (existingDispute) {
    if (existingDispute.status === "SENT") {
      score -= 30; // Lower priority, already in progress
      factors.push("Dispute already in progress");
    }
    if (existingDispute.responseOutcome === "VERIFIED") {
      score += 15; // Higher priority for re-escalation
      factors.push("Previously verified - needs escalation");
    }
  }

  // Confidence affects disputable strength
  if (account.confidenceScore >= 70) {
    score += 5;
    factors.push("High confidence in data accuracy");
  } else if (account.confidenceScore < 45) {
    score -= 10;
    factors.push("Low confidence - may need manual review");
  }

  // Convert to 1-10 priority (1 = highest)
  const priority = Math.max(1, Math.min(10, 11 - Math.floor(score / 15)));

  // Impact score (1-100, how much this affects credit)
  const impactScore = Math.min(100, Math.max(10, score));

  return {
    priority,
    reasoning: factors.join("; "),
    impactScore,
  };
}

// =============================================================================
// FLOW SELECTION ENGINE
// =============================================================================

/**
 * Determine the optimal dispute flow for an account
 */
export function selectDisputeFlow(account: ParsedAccount): {
  flow: DisputeFlow;
  reasoning: string;
  alternativeFlows: { flow: DisputeFlow; reasoning: string }[];
} {
  const issues = account.detectedIssues;

  // Collection accounts always start with COLLECTION flow
  if (account.accountStatus === "COLLECTION") {
    return {
      flow: "COLLECTION",
      reasoning: "Collection account requires debt validation under FDCPA 1692g",
      alternativeFlows: [
        { flow: "ACCURACY", reasoning: "If validation received, switch to accuracy dispute" },
      ],
    };
  }

  // Check for consent/permissible purpose issues
  const hasConsentIssue = issues.some(i =>
    i.code.includes("CONSENT") || i.code.includes("PERMISSIBLE") || i.code.includes("UNAUTHORIZED")
  );
  if (hasConsentIssue) {
    return {
      flow: "CONSENT",
      reasoning: "Unauthorized access or lack of permissible purpose detected",
      alternativeFlows: [
        { flow: "ACCURACY", reasoning: "If consent proven, switch to accuracy dispute" },
      ],
    };
  }

  // Multiple issue types = COMBO
  const issueTypes = new Set(issues.map(i => i.suggestedFlow));
  if (issueTypes.size > 1) {
    return {
      flow: "COMBO",
      reasoning: "Multiple issue types detected requiring comprehensive approach",
      alternativeFlows: Array.from(issueTypes).map(f => ({
        flow: f,
        reasoning: `Focus specifically on ${f.toLowerCase()} issues`,
      })),
    };
  }

  // Default to ACCURACY for most disputes
  return {
    flow: "ACCURACY",
    reasoning: "Standard accuracy dispute under FCRA 1681e(b)",
    alternativeFlows: [],
  };
}

// =============================================================================
// CROSS-BUREAU COORDINATION
// =============================================================================

/**
 * Group accounts by fingerprint and plan cross-bureau strategy
 */
export function planCrossBureauStrategy(
  accounts: ParsedAccount[],
  existingDisputes: ExistingDispute[]
): CrossBureauPlan {
  // Group by fingerprint (same account across bureaus)
  const fingerprints = new Map<string, ParsedAccount[]>();

  for (const account of accounts) {
    const fp = `${account.creditorName.toUpperCase().replace(/[^A-Z0-9]/g, "")}_${account.maskedAccountId || "UNKNOWN"}`;
    if (!fingerprints.has(fp)) {
      fingerprints.set(fp, []);
    }
    fingerprints.get(fp)!.push(account);
  }

  const accountGroups: AccountGroup[] = [];

  for (const [fingerprint, groupAccounts] of fingerprints) {
    const bureaus = groupAccounts.map(a => a.cra);
    const creditorName = groupAccounts[0].creditorName;

    // Determine coordination strategy
    let approach: "SIMULTANEOUS" | "SEQUENTIAL" | "PRIMARY_ONLY";
    let reasoning: string;

    if (bureaus.length === 3) {
      // Check for cross-bureau inconsistencies
      const hasInconsistency = groupAccounts.some(a =>
        a.detectedIssues.some(i => i.code.includes("INCONSISTENCY"))
      );

      if (hasInconsistency) {
        approach = "SIMULTANEOUS";
        reasoning = "Cross-bureau inconsistencies detected. Dispute all three simultaneously to highlight discrepancies.";
      } else {
        approach = "SEQUENTIAL";
        reasoning = "Consistent reporting across bureaus. Dispute sequentially to establish precedent.";
      }
    } else if (bureaus.length === 2) {
      approach = "SIMULTANEOUS";
      reasoning = "Account reports on two bureaus. Dispute both for efficiency.";
    } else {
      approach = "PRIMARY_ONLY";
      reasoning = "Account only reports on one bureau.";
    }

    // Check for existing disputes that would affect strategy
    const hasExisting = existingDisputes.some(d =>
      groupAccounts.some(a => a.id === d.accountId)
    );
    if (hasExisting) {
      reasoning += " Note: Existing dispute(s) in progress - coordinate timing.";
    }

    accountGroups.push({
      fingerprint,
      creditorName,
      bureaus,
      recommendedApproach: approach,
      reasoning,
    });
  }

  const coordinationStrategy = accountGroups.length > 3
    ? "Batch disputes by creditor to maximize efficiency. Start with highest-impact accounts."
    : "Process all account groups within the same dispute cycle.";

  return {
    accountGroups,
    coordinationStrategy,
  };
}

// =============================================================================
// MAIN ANALYSIS FUNCTION
// =============================================================================

/**
 * Analyze a parsed credit report and generate comprehensive dispute strategy
 */
export async function analyzeReportAndGenerateStrategy(
  accounts: ParsedAccount[],
  existingDisputes: ExistingDispute[],
  organizationId: string,
  options?: {
    useAI?: boolean;
    maxAccountsPerBatch?: number;
    focusBureaus?: CRA[];
  }
): Promise<DisputeStrategy> {
  const warnings: string[] = [];
  const recommendations: DisputeRecommendation[] = [];

  // Filter to disputable accounts only
  const disputableAccounts = accounts.filter(a => a.isDisputable);

  if (disputableAccounts.length === 0) {
    return {
      recommendations: [],
      overallStrategy: "No disputable items found in this credit report.",
      crossBureauPlan: { accountGroups: [], coordinationStrategy: "N/A" },
      timeline: {
        phases: [],
        totalEstimatedDays: 0,
        nextActionDate: new Date(),
      },
      warnings: ["No disputable accounts detected. Consider manual review for missed issues."],
    };
  }

  // Focus on specific bureaus if requested
  let targetAccounts = disputableAccounts;
  if (options?.focusBureaus) {
    targetAccounts = disputableAccounts.filter(a => options.focusBureaus!.includes(a.cra));
  }

  // Analyze each account
  for (const account of targetAccounts) {
    const { priority, reasoning, impactScore } = calculatePriority(account, existingDisputes);
    const { flow, reasoning: flowReasoning } = selectDisputeFlow(account);

    // Determine starting round
    const existingDispute = existingDisputes.find(d =>
      d.accountId === account.id && d.cra === account.cra
    );
    let suggestedRound = 1;
    if (existingDispute) {
      const escalation = ESCALATION_RULES.shouldEscalate(existingDispute);
      if (escalation.shouldEscalate) {
        suggestedRound = ESCALATION_RULES.getNextRound(
          existingDispute.round,
          flow,
          existingDispute.responseOutcome || "VERIFIED"
        );
      } else {
        // Don't create new dispute if one is in progress
        warnings.push(`Account ${account.creditorName} has existing dispute in progress.`);
        continue;
      }
    }

    // Get legal basis
    const legalBasis = account.detectedIssues
      .map(i => i.legalCitation)
      .filter((c): c is string => !!c);

    // Estimate success rate based on issues
    let successRate = 0.3; // Base 30%
    if (account.detectedIssues.some(i => i.code.includes("INCONSISTENCY"))) {
      successRate += 0.25; // Cross-bureau inconsistencies are strong
    }
    if (account.detectedIssues.some(i => i.code === "POTENTIALLY_OUTDATED")) {
      successRate += 0.30; // Outdated accounts often get removed
    }
    if (account.detectedIssues.some(i => i.severity === "HIGH")) {
      successRate += 0.15;
    }
    successRate = Math.min(0.85, successRate); // Cap at 85%

    recommendations.push({
      accountId: account.id,
      creditorName: account.creditorName,
      cra: account.cra,
      recommendedFlow: flow,
      suggestedRound,
      priority,
      reasoning: `${reasoning}. ${flowReasoning}`,
      legalBasis: [...new Set(legalBasis)],
      estimatedSuccessRate: successRate,
      impactScore,
    });
  }

  // Sort by priority (1 = highest)
  recommendations.sort((a, b) => a.priority - b.priority);

  // Limit batch size if specified
  const maxBatch = options?.maxAccountsPerBatch || 5;
  const batchedRecommendations = recommendations.slice(0, maxBatch);
  if (recommendations.length > maxBatch) {
    warnings.push(`Limiting to ${maxBatch} accounts per batch. ${recommendations.length - maxBatch} accounts queued for next round.`);
  }

  // Generate cross-bureau plan
  const crossBureauPlan = planCrossBureauStrategy(targetAccounts, existingDisputes);

  // Generate timeline
  const timeline = generateTimeline(batchedRecommendations);

  // Generate overall strategy using AI if enabled
  let overallStrategy: string;
  if (options?.useAI !== false) {
    try {
      const strategyResponse = await completeLLM({
        taskType: "DISPUTE_STRATEGY",
        prompt: `Based on these dispute recommendations, provide a 2-3 sentence overall strategy summary:
${JSON.stringify(batchedRecommendations.map(r => ({
  creditor: r.creditorName,
  cra: r.cra,
  flow: r.recommendedFlow,
  priority: r.priority,
  issues: r.reasoning,
})), null, 2)}`,
        organizationId,
      });
      overallStrategy = strategyResponse.content;
    } catch {
      overallStrategy = generateRuleBasedStrategy(batchedRecommendations);
    }
  } else {
    overallStrategy = generateRuleBasedStrategy(batchedRecommendations);
  }

  return {
    recommendations: batchedRecommendations,
    overallStrategy,
    crossBureauPlan,
    timeline,
    warnings,
  };
}

/**
 * Generate strategy without AI
 */
function generateRuleBasedStrategy(recommendations: DisputeRecommendation[]): string {
  if (recommendations.length === 0) {
    return "No disputable items identified at this time.";
  }

  const highPriority = recommendations.filter(r => r.priority <= 3);
  const collectionAccounts = recommendations.filter(r => r.recommendedFlow === "COLLECTION");
  const bureauCounts = recommendations.reduce((acc, r) => {
    acc[r.cra] = (acc[r.cra] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const parts: string[] = [];

  if (highPriority.length > 0) {
    parts.push(`Focus on ${highPriority.length} high-priority account(s) with strongest dispute basis.`);
  }

  if (collectionAccounts.length > 0) {
    parts.push(`${collectionAccounts.length} collection account(s) require debt validation letters.`);
  }

  const bureauList = Object.entries(bureauCounts)
    .map(([bureau, count]) => `${bureau} (${count})`)
    .join(", ");
  parts.push(`Disputes span: ${bureauList}.`);

  parts.push("Begin with Round 1 factual disputes, escalate as needed based on responses.");

  return parts.join(" ");
}

/**
 * Generate dispute timeline
 */
function generateTimeline(recommendations: DisputeRecommendation[]): DisputeTimeline {
  const today = new Date();
  const phases: TimelinePhase[] = [];

  if (recommendations.length === 0) {
    return {
      phases: [],
      totalEstimatedDays: 0,
      nextActionDate: today,
    };
  }

  // Phase 1: Initial disputes (Days 1-7)
  phases.push({
    phase: 1,
    description: "Prepare and send initial dispute letters",
    accounts: recommendations.map(r => r.accountId),
    startDate: today,
    deadlineDate: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000),
    actions: [
      "Generate dispute letters for all accounts",
      "Review and approve letters",
      "Mail via certified mail with return receipt",
    ],
  });

  // Phase 2: Wait for response (Days 8-37)
  const phase2Start = new Date(today.getTime() + 8 * 24 * 60 * 60 * 1000);
  phases.push({
    phase: 2,
    description: "Monitor for CRA responses (30-day deadline)",
    accounts: recommendations.map(r => r.accountId),
    startDate: phase2Start,
    deadlineDate: new Date(phase2Start.getTime() + 30 * 24 * 60 * 60 * 1000),
    actions: [
      "Track mailing delivery confirmation",
      "Monitor for CRA response letters",
      "Document any responses received",
      "Prepare escalation letters if no response by day 25",
    ],
  });

  // Phase 3: Process responses and escalate (Days 38-45)
  const phase3Start = new Date(today.getTime() + 38 * 24 * 60 * 60 * 1000);
  phases.push({
    phase: 3,
    description: "Process responses and escalate if needed",
    accounts: recommendations.map(r => r.accountId),
    startDate: phase3Start,
    deadlineDate: new Date(phase3Start.getTime() + 7 * 24 * 60 * 60 * 1000),
    actions: [
      "Review CRA responses",
      "Verify deletions on credit reports",
      "Send Round 2 letters for verified items",
      "File CFPB complaints for no-response items",
    ],
  });

  return {
    phases,
    totalEstimatedDays: 45,
    nextActionDate: new Date(today.getTime() + 24 * 60 * 60 * 1000), // Tomorrow
  };
}

// =============================================================================
// LETTER GENERATION RULES
// =============================================================================

export interface LetterGenerationParams {
  client: {
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    ssn4?: string;
    dob?: string;
  };
  accounts: Array<{
    creditorName: string;
    accountNumber?: string;
    balance?: number;
    issues: string[];
  }>;
  cra: CRA;
  flow: DisputeFlow;
  round: number;
  previousHistory?: {
    previousRounds: number[];
    previousResponses: string[];
    daysWithoutResponse?: number;
  };
}

/**
 * Generate dispute letter content using AMELIA
 *
 * Amelia generates unique, human-like letters that:
 * - Never repeat phrases, stories, or structures for the same client
 * - Pass through eOSCAR detection without AI flags
 * - Match authentic human-written dispute letter tone
 */
export async function generateDisputeLetterContent(
  params: LetterGenerationParams,
  organizationId: string,
  clientId?: string
): Promise<{
  content: string;
  citations: string[];
  tone: string;
  requestId?: string;
  uniquenessScore?: number;
  ameliaVersion?: string;
}> {
  const strategy = ESCALATION_RULES.getRoundStrategy(params.round, params.flow);

  // Convert to Amelia's request format
  const ameliaRequest: LetterGenerationRequest = {
    client: {
      id: clientId || `temp-${Date.now()}`,
      firstName: params.client.firstName,
      lastName: params.client.lastName,
      address: params.client.address,
      city: params.client.city,
      state: params.client.state,
      zip: params.client.zip,
      ssn4: params.client.ssn4,
      dob: params.client.dob,
    },
    accounts: params.accounts.map(acc => ({
      creditorName: acc.creditorName,
      accountNumber: acc.accountNumber,
      balance: acc.balance,
      issues: acc.issues,
    })),
    cra: params.cra,
    flow: params.flow,
    round: params.round,
    previousHistory: params.previousHistory,
    organizationId,
  };

  try {
    // Use Amelia's AI-powered generation for maximum uniqueness
    const ameliaResult = await generateAmeliaAILetter(ameliaRequest);

    return {
      content: ameliaResult.content,
      citations: ameliaResult.citations,
      tone: ameliaResult.tone,
      uniquenessScore: ameliaResult.uniquenessScore,
      ameliaVersion: ameliaResult.ameliaVersion,
    };
  } catch (error) {
    console.warn("Amelia AI generation failed, using template-based generation:", error);

    // Fallback to Amelia's template-based generation (still unique)
    try {
      const templateResult = await generateAmeliaLetter(ameliaRequest);
      return {
        content: templateResult.content,
        citations: templateResult.citations,
        tone: templateResult.tone,
        uniquenessScore: templateResult.uniquenessScore,
        ameliaVersion: templateResult.ameliaVersion,
      };
    } catch (templateError) {
      console.error("Amelia template generation also failed:", templateError);

      // Final fallback to basic template
      const craAddresses: Record<CRA, string> = {
        TRANSUNION: "TransUnion LLC\nP.O. Box 2000\nChester, PA 19016",
        EXPERIAN: "Experian\nP.O. Box 4500\nAllen, TX 75013",
        EQUIFAX: "Equifax Information Services LLC\nP.O. Box 740256\nAtlanta, GA 30374-0256",
      };

      return {
        content: generateTemplateBasedLetter(params, strategy, craAddresses[params.cra]),
        citations: strategy.legalCitations,
        tone: strategy.tone,
      };
    }
  }
}

/**
 * Fallback template-based letter generation
 */
function generateTemplateBasedLetter(
  params: LetterGenerationParams,
  strategy: ReturnType<typeof ESCALATION_RULES.getRoundStrategy>,
  craAddress: string
): string {
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const accountList = params.accounts.map((acc, i) =>
    `${i + 1}. Creditor: ${acc.creditorName}\n   ${acc.accountNumber ? `Account: ${acc.accountNumber}\n   ` : ""}Issues: ${acc.issues.join(", ")}`
  ).join("\n\n");

  const citationText = strategy.legalCitations
    .map(c => `15 USC §${c}`)
    .join(", ");

  return `${today}

${params.client.firstName} ${params.client.lastName}
${params.client.address}
${params.client.city}, ${params.client.state} ${params.client.zip}

${craAddress}

Re: Dispute of Inaccurate Information
${params.client.ssn4 ? `SSN: XXX-XX-${params.client.ssn4}` : ""}
${params.client.dob ? `Date of Birth: ${params.client.dob}` : ""}

To Whom It May Concern:

${params.round === 1
  ? `I am writing to dispute the following information in my credit file. Under the Fair Credit Reporting Act, ${citationText}, I am requesting that you investigate and ${params.flow === "COLLECTION" ? "validate" : "verify"} these disputed items.`
  : params.round === 2
    ? `This is my second written dispute regarding the items below. Your previous investigation was inadequate. Pursuant to ${citationText}, I am demanding the Method of Verification used in your investigation.`
    : params.round === 3
      ? `NOTICE OF FCRA VIOLATIONS\n\nThis constitutes formal notice that you have violated my rights under the Fair Credit Reporting Act. I have documented the following violations:\n\n1. Failure to conduct reasonable investigation (${citationText})\n2. Failure to provide Method of Verification\n3. Continued reporting of disputed inaccurate information\n\nStatutory damages: $100-$1,000 per violation\nActual damages: To be determined\nPunitive damages: As applicable\n\nThis is your final opportunity to correct these items before I pursue legal remedies.`
      : `FINAL DEMAND BEFORE LITIGATION\n\nYou have failed to properly investigate my disputes despite multiple requests. This letter serves as your final notice. If these items are not removed within 10 days, I will file suit in federal court seeking:\n\n- Statutory damages: $${100 * params.accounts.length} - $${1000 * params.accounts.length}\n- Actual damages for credit denials and emotional distress\n- Punitive damages for willful noncompliance\n- Attorney fees and court costs`}

DISPUTED ITEMS:

${accountList}

${params.round === 1
  ? "Please investigate these items and provide written results within 30 days as required by law. If you cannot verify this information, it must be promptly deleted."
  : params.round === 2
    ? "Provide the Method of Verification within 15 days. Failure to comply will be documented as evidence of inadequate investigation procedures."
    : "Remove these items immediately or respond in writing within 10 days."}

Sincerely,


_______________________________
${params.client.firstName} ${params.client.lastName}
Date: _______________

${params.round >= 3 ? "\ncc: Consumer Financial Protection Bureau\n    Federal Trade Commission" : ""}`;
}

// All exports are declared inline with their definitions above
