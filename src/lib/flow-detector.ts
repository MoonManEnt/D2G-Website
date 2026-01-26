/**
 * Flow Detection Utility
 *
 * Automatically detects the optimal dispute flow based on account characteristics
 * and detected issues. This helps users choose the most effective dispute strategy.
 */

export type DisputeFlow = "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO";

interface AccountIssue {
  code?: string;
  severity?: "HIGH" | "MEDIUM" | "LOW";
  description?: string;
}

interface AccountForDetection {
  id: string;
  accountType?: string | null;
  creditorName?: string | null;
  accountStatus?: string | null;
  detectedIssues?: AccountIssue[] | string | null;
}

/**
 * Detects the optimal dispute flow for a set of accounts
 */
export function detectOptimalFlow(accounts: AccountForDetection[]): DisputeFlow {
  let hasCollections = false;
  let hasAccuracyIssues = false;
  let hasConsentIssues = false;

  for (const account of accounts) {
    const analysis = analyzeAccount(account);
    if (analysis.isCollection) hasCollections = true;
    if (analysis.hasAccuracyIssues) hasAccuracyIssues = true;
    if (analysis.hasConsentIssues) hasConsentIssues = true;
  }

  // Determine flow based on issue types
  if (hasCollections && (hasAccuracyIssues || hasConsentIssues)) {
    return "COMBO";
  }
  if (hasCollections) {
    return "COLLECTION";
  }
  if (hasConsentIssues && !hasAccuracyIssues) {
    return "CONSENT";
  }
  return "ACCURACY";
}

/**
 * Detects the optimal flow for each CRA based on selected accounts
 */
export function detectFlowsPerCRA(
  accounts: AccountForDetection[],
  selections: {
    TRANSUNION: string[];
    EQUIFAX: string[];
    EXPERIAN: string[];
  }
): {
  TRANSUNION: DisputeFlow | null;
  EQUIFAX: DisputeFlow | null;
  EXPERIAN: DisputeFlow | null;
} {
  const result: {
    TRANSUNION: DisputeFlow | null;
    EQUIFAX: DisputeFlow | null;
    EXPERIAN: DisputeFlow | null;
  } = {
    TRANSUNION: null,
    EQUIFAX: null,
    EXPERIAN: null,
  };

  for (const cra of ["TRANSUNION", "EQUIFAX", "EXPERIAN"] as const) {
    const selectedIds = selections[cra];
    if (selectedIds.length === 0) continue;

    const selectedAccounts = accounts.filter((a) => selectedIds.includes(a.id));
    result[cra] = detectOptimalFlow(selectedAccounts);
  }

  return result;
}

/**
 * Analyzes a single account for issue types
 */
function analyzeAccount(account: AccountForDetection): {
  isCollection: boolean;
  hasAccuracyIssues: boolean;
  hasConsentIssues: boolean;
} {
  const result = {
    isCollection: false,
    hasAccuracyIssues: false,
    hasConsentIssues: false,
  };

  // Check account type and creditor name for collection indicators
  const accountType = (account.accountType || "").toLowerCase();
  const creditorName = (account.creditorName || "").toLowerCase();
  const accountStatus = (account.accountStatus || "").toLowerCase();

  if (
    accountType.includes("collection") ||
    creditorName.includes("collection") ||
    creditorName.includes("recovery") ||
    creditorName.includes("debt") ||
    accountStatus.includes("collection") ||
    accountStatus === "chargeoff" ||
    accountStatus === "charge off" ||
    accountStatus === "charge-off"
  ) {
    result.isCollection = true;
  }

  // Parse detected issues
  const issues = parseIssues(account.detectedIssues);

  for (const issue of issues) {
    const code = (issue.code || "").toUpperCase();
    const desc = (issue.description || "").toLowerCase();

    // Collection-related issue codes
    if (
      code.includes("COLLECTION") ||
      code.includes("CHARGEOFF") ||
      code.includes("CHARGE_OFF") ||
      code.includes("DEBT") ||
      code.includes("VALIDATION") ||
      desc.includes("collection") ||
      desc.includes("charge off") ||
      desc.includes("debt validation")
    ) {
      result.isCollection = true;
    }

    // Accuracy-related issue codes
    if (
      code.includes("ACCURACY") ||
      code.includes("INCONSISTENCY") ||
      code.includes("BALANCE") ||
      code.includes("DATE") ||
      code.includes("STATUS") ||
      code.includes("MISSING") ||
      code.includes("LATE_PAYMENT") ||
      code.includes("PAYMENT_HISTORY") ||
      code.includes("OUTDATED") ||
      code.includes("PAST_DUE") ||
      code.includes("HIGH_UTIL") ||
      code.includes("LIMIT") ||
      desc.includes("inaccurate") ||
      desc.includes("incorrect") ||
      desc.includes("wrong balance") ||
      desc.includes("late payment")
    ) {
      result.hasAccuracyIssues = true;
    }

    // Consent-related issue codes
    if (
      code.includes("CONSENT") ||
      code.includes("UNAUTHORIZED") ||
      code.includes("INQUIRY") ||
      code.includes("PERMISSIBLE") ||
      desc.includes("unauthorized") ||
      desc.includes("without consent") ||
      desc.includes("hard inquiry")
    ) {
      result.hasConsentIssues = true;
    }
  }

  // Default to accuracy if no issues detected but account has problems
  if (!result.isCollection && !result.hasAccuracyIssues && !result.hasConsentIssues) {
    result.hasAccuracyIssues = true;
  }

  return result;
}

/**
 * Parses detected issues from various formats
 */
function parseIssues(issues: AccountIssue[] | string | null | undefined): AccountIssue[] {
  if (!issues) return [];
  if (Array.isArray(issues)) return issues;
  if (typeof issues === "string") {
    try {
      const parsed = JSON.parse(issues);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Gets a human-readable description of the flow
 */
export function getFlowDescription(flow: DisputeFlow): {
  title: string;
  description: string;
  statute: string;
} {
  switch (flow) {
    case "ACCURACY":
      return {
        title: "Accuracy Dispute",
        description: "Challenge inaccurate information under FCRA § 1681i",
        statute: "§ 1681i",
      };
    case "COLLECTION":
      return {
        title: "Collection Validation",
        description: "Request debt validation under FDCPA § 1692g",
        statute: "§ 1692g",
      };
    case "CONSENT":
      return {
        title: "Consent Challenge",
        description: "Challenge unauthorized access under FCRA § 1681b",
        statute: "§ 1681b",
      };
    case "COMBO":
      return {
        title: "Combination Strategy",
        description: "Combined accuracy and collection dispute",
        statute: "§ 1681i / § 1692g",
      };
  }
}
