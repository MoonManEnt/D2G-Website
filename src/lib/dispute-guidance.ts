// Intelligent Dispute Flow Guidance System
// Determines available dispute options based on parsed credit report and history

export type DisputeFlow = "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO";
export type CRA = "TRANSUNION" | "EXPERIAN" | "EQUIFAX";

export interface DetectedIssue {
  code: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  description: string;
  suggestedFlow: DisputeFlow;
  fcraSection?: string;
}

export interface AccountAnalysis {
  accountId: string;
  creditorName: string;
  accountType: string;
  cra: CRA;
  issues: DetectedIssue[];
  suggestedFlow: DisputeFlow;
  isCollection: boolean;
  hasConsentIssue: boolean;
  hasAccuracyIssue: boolean;
}

export interface DisputeHistory {
  cra: CRA;
  flow: DisputeFlow;
  round: number;
  status: string;
  sentAt?: string;
  respondedAt?: string;
  responseOutcome?: string;
}

export interface DisputeGuidance {
  availableFlows: DisputeFlow[];
  recommendedFlow: DisputeFlow;
  currentRound: number;
  nextRoundAvailable: boolean;
  canCreateDispute: boolean;
  waitingForResponse: boolean;
  daysWaiting: number;
  blockedReason?: string;
  recommendations: string[];
  warnings: string[];
}

// Issue codes that indicate specific dispute flows
const COLLECTION_ISSUE_CODES = [
  "COLLECTION_NO_VALIDATION",
  "COLLECTION_DEBT_PARKING",
  "COLLECTION_ZOMBIE_DEBT",
  "COLLECTION_MEDICAL_DEBT",
  "COLLECTION_SOL_EXPIRED",
];

const CONSENT_ISSUE_CODES = [
  "UNAUTHORIZED_INQUIRY",
  "NO_PERMISSIBLE_PURPOSE",
  "IDENTITY_THEFT",
  "ACCOUNT_NOT_MINE",
];

const ACCURACY_ISSUE_CODES = [
  "BALANCE_MISMATCH",
  "DATE_DISCREPANCY",
  "STATUS_INCORRECT",
  "PAYMENT_HISTORY_WRONG",
  "DUPLICATE_ACCOUNT",
  "ACCOUNT_INFO_DIFFERS",
  "LATE_PAYMENT_DISPUTED",
];

// Analyze a single account and determine its issues
export function analyzeAccount(account: {
  id: string;
  creditorName: string;
  accountType?: string;
  cra: string;
  detectedIssues?: string;
}): AccountAnalysis {
  let issues: DetectedIssue[] = [];

  try {
    if (account.detectedIssues) {
      issues = JSON.parse(account.detectedIssues);
    }
  } catch {
    // Use empty array if parsing fails
  }

  const isCollection =
    account.accountType?.toLowerCase().includes("collection") ||
    issues.some((i) => COLLECTION_ISSUE_CODES.includes(i.code));

  const hasConsentIssue = issues.some((i) =>
    CONSENT_ISSUE_CODES.includes(i.code)
  );

  const hasAccuracyIssue = issues.some((i) =>
    ACCURACY_ISSUE_CODES.includes(i.code)
  );

  // Determine suggested flow based on issue types
  let suggestedFlow: DisputeFlow = "ACCURACY";

  if (isCollection && hasAccuracyIssue) {
    suggestedFlow = "COMBO";
  } else if (isCollection) {
    suggestedFlow = "COLLECTION";
  } else if (hasConsentIssue) {
    suggestedFlow = "CONSENT";
  } else if (hasAccuracyIssue) {
    suggestedFlow = "ACCURACY";
  }

  return {
    accountId: account.id,
    creditorName: account.creditorName,
    accountType: account.accountType || "Unknown",
    cra: account.cra as CRA,
    issues,
    suggestedFlow,
    isCollection,
    hasConsentIssue,
    hasAccuracyIssue,
  };
}

// Get dispute guidance for a client/CRA combination
export function getDisputeGuidance(
  accounts: AccountAnalysis[],
  disputeHistory: DisputeHistory[],
  targetCRA: CRA
): DisputeGuidance {
  // Filter accounts for target CRA
  const craAccounts = accounts.filter((a) => a.cra === targetCRA);
  const craHistory = disputeHistory.filter((d) => d.cra === targetCRA);

  // Determine available flows based on account issues
  const availableFlows: Set<DisputeFlow> = new Set();
  let hasCollection = false;
  let hasConsent = false;
  let hasAccuracy = false;

  for (const account of craAccounts) {
    if (account.isCollection) {
      hasCollection = true;
      availableFlows.add("COLLECTION");
    }
    if (account.hasConsentIssue) {
      hasConsent = true;
      availableFlows.add("CONSENT");
    }
    if (account.hasAccuracyIssue) {
      hasAccuracy = true;
      availableFlows.add("ACCURACY");
    }
  }

  // If multiple issue types, add COMBO
  if ((hasCollection && hasAccuracy) || (hasCollection && hasConsent)) {
    availableFlows.add("COMBO");
  }

  // Default to ACCURACY if no specific issues detected
  if (availableFlows.size === 0) {
    availableFlows.add("ACCURACY");
  }

  // Determine current round based on history
  const lastDispute = craHistory
    .filter((d) => d.status !== "DRAFT")
    .sort((a, b) => b.round - a.round)[0];

  const currentRound = lastDispute ? lastDispute.round : 0;
  const nextRound = currentRound + 1;

  // Check if waiting for response
  const pendingDispute = craHistory.find(
    (d) => d.status === "SENT" && !d.respondedAt
  );

  let daysWaiting = 0;
  if (pendingDispute?.sentAt) {
    daysWaiting = Math.floor(
      (Date.now() - new Date(pendingDispute.sentAt).getTime()) /
        (1000 * 60 * 60 * 24)
    );
  }

  // Determine if next round is available
  const waitingForResponse = !!pendingDispute;
  const canProceedAfter30Days = daysWaiting >= 30;
  const nextRoundAvailable =
    !waitingForResponse || canProceedAfter30Days || currentRound === 0;

  // Generate recommendations
  const recommendations: string[] = [];
  const warnings: string[] = [];

  if (craAccounts.length === 0) {
    warnings.push(`No negative accounts found for ${targetCRA}`);
  }

  if (waitingForResponse && !canProceedAfter30Days) {
    recommendations.push(
      `Wait for ${targetCRA} response (${30 - daysWaiting} days remaining)`
    );
    recommendations.push(
      `If no response after 30 days, this is an FCRA violation - escalate immediately`
    );
  }

  if (canProceedAfter30Days) {
    warnings.push(
      `${targetCRA} has exceeded the 30-day response deadline - FCRA violation!`
    );
    recommendations.push(`File CFPB complaint for failure to respond`);
    recommendations.push(`Proceed to Round ${nextRound} citing the violation`);
  }

  if (currentRound >= 3) {
    recommendations.push(`Consider consulting an FCRA attorney`);
    recommendations.push(
      `Document all correspondence for potential litigation`
    );
  }

  if (currentRound >= 4) {
    warnings.push(
      `Multiple rounds without resolution - litigation may be warranted`
    );
  }

  // Determine recommended flow
  let recommendedFlow: DisputeFlow = "ACCURACY";
  if (hasCollection && hasAccuracy) {
    recommendedFlow = "COMBO";
  } else if (hasCollection) {
    recommendedFlow = "COLLECTION";
  } else if (hasConsent) {
    recommendedFlow = "CONSENT";
  }

  // Check if user should continue with same flow as previous rounds
  if (lastDispute && availableFlows.has(lastDispute.flow)) {
    recommendedFlow = lastDispute.flow;
  }

  // Blocked reason
  let blockedReason: string | undefined;
  if (waitingForResponse && !canProceedAfter30Days) {
    blockedReason = `Waiting for ${targetCRA} response (${daysWaiting} of 30 days)`;
  }
  if (craAccounts.length === 0) {
    blockedReason = `No disputable accounts found for ${targetCRA}`;
  }

  return {
    availableFlows: Array.from(availableFlows),
    recommendedFlow,
    currentRound,
    nextRoundAvailable,
    canCreateDispute: nextRoundAvailable && craAccounts.length > 0,
    waitingForResponse,
    daysWaiting,
    blockedReason,
    recommendations,
    warnings,
  };
}

// Get the maximum round available for a flow
export function getMaxRoundForFlow(flow: DisputeFlow): number {
  switch (flow) {
    case "ACCURACY":
      return 11;
    case "COLLECTION":
      return 12;
    case "CONSENT":
      return 3;
    case "COMBO":
      return 12;
    default:
      return 11;
  }
}

// Check if a specific round uses cross-flow templates
export function getRoundFlowOverride(
  flow: DisputeFlow,
  round: number
): DisputeFlow | null {
  // Collection and Combo flows use Accuracy templates for R5-7
  if ((flow === "COLLECTION" || flow === "COMBO") && round >= 5 && round <= 7) {
    return "ACCURACY";
  }
  return null;
}

// Get round-specific description
export function getRoundDescription(flow: DisputeFlow, round: number): string {
  const override = getRoundFlowOverride(flow, round);
  if (override) {
    return `Round ${round} - Using ${override} Flow Templates (Cross-flow escalation)`;
  }

  const descriptions: Record<DisputeFlow, Record<number, string>> = {
    ACCURACY: {
      1: "Initial Factual Dispute - Request investigation of inaccurate items",
      2: "15 USC 1681e(b) - Maximum accuracy violation, demand correction",
      3: "15 USC 1681i(a)(5) - 30-day deadline violation, items should be deleted",
      4: "15 USC 1681i(a)(1)(a) - No reasonable reinvestigation conducted",
      5: "15 USC 1681i(a)(7) - Demand description of reinvestigation procedure",
      6: "15 USC 1681i(a)(6)(B) - Method of Verification demand",
      7: "15 USC 1681i(c) - All accounts comprehensive dispute",
      8: "15 USC 1681s-2(B) - Furnisher duties violation",
      9: "15 USC 1681s-2(b) - Furnisher investigation failure",
      10: "15 USC 1681c(e) - Re-aging violation",
      11: "15 USC 1681e(b) - Discharged debt still reporting",
    },
    COLLECTION: {
      1: "15 USC 1692g - No dunning letter within 5 days",
      2: "15 USC 1692g(b) - Furnishing unverified disputed info",
      3: "Continued violation of debt validation requirements",
      4: "Final warning before escalation",
      8: "Post-Accuracy escalation - combining violations",
      9: "Pre-litigation notice",
      10: "Intent to sue notification",
      11: "Final demand with damage calculation",
      12: "Litigation preparation",
    },
    CONSENT: {
      1: "15 USC 1681b(a)(2) - No permissible purpose/written consent",
      2: "15 USC 1681a(4) - Definition challenge",
      3: "15 USC 1681a(d)(a)(2)(B) - Final notice before legal action",
    },
    COMBO: {
      1: "Combined Accuracy & Collection initial dispute",
      2: "15 USC 1681e(b) & 1692g(b) - Dual violation notice",
      3: "Continued combined violations",
      4: "Escalation for both issue types",
      8: "Post-cross-flow escalation",
      10: "Final combined warning",
      11: "Intent to sue for all violations",
      12: "Consent/Collection combo final demand",
    },
  };

  return (
    descriptions[flow]?.[round] ||
    `Round ${round} - Continued dispute escalation`
  );
}

// Validate if a dispute can be created
export interface DisputeValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateDisputeCreation(
  accounts: AccountAnalysis[],
  selectedAccountIds: string[],
  flow: DisputeFlow,
  round: number,
  guidance: DisputeGuidance
): DisputeValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if any accounts selected
  if (selectedAccountIds.length === 0) {
    errors.push("At least one account must be selected");
  }

  // Check if selected accounts match the flow
  const selectedAccounts = accounts.filter((a) =>
    selectedAccountIds.includes(a.accountId)
  );

  for (const account of selectedAccounts) {
    if (flow === "COLLECTION" && !account.isCollection) {
      warnings.push(
        `${account.creditorName} may not be suitable for Collection flow`
      );
    }
    if (flow === "CONSENT" && !account.hasConsentIssue) {
      warnings.push(
        `${account.creditorName} has no detected consent issues`
      );
    }
  }

  // Check round validity
  const maxRound = getMaxRoundForFlow(flow);
  if (round > maxRound) {
    errors.push(
      `Round ${round} exceeds maximum for ${flow} flow (max: ${maxRound})`
    );
  }

  // Check if should be waiting
  if (guidance.waitingForResponse && guidance.daysWaiting < 30) {
    warnings.push(
      `Previous dispute sent ${guidance.daysWaiting} days ago - consider waiting for response`
    );
  }

  // Check round sequence
  if (round > guidance.currentRound + 1) {
    errors.push(
      `Cannot skip to Round ${round}. Current round is ${guidance.currentRound}`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
