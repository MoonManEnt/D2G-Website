/**
 * Creditor Name Normalization Utility
 *
 * Groups similar creditor names to detect cross-bureau inconsistencies
 * Examples: "MERRICK BK", "MERRICK BANK NA", "Merrick Bk NA" → normalized to "MERRICK"
 */

// Common suffixes to remove from creditor names
const SUFFIXES_TO_REMOVE = [
  // Bank variations
  "NATIONAL ASSOCIATION",
  "NATIONAL ASSOC",
  "N.A.",
  "NA",
  "BANK",
  "BK",
  "BANCORP",
  "BANKING",

  // Business entity types
  "INCORPORATED",
  "INC.",
  "INC",
  "LLC",
  "L.L.C.",
  "LLP",
  "L.L.P.",
  "LP",
  "L.P.",
  "CORPORATION",
  "CORP.",
  "CORP",
  "CO.",
  "CO",
  "COMPANY",
  "LTD",
  "LTD.",
  "LIMITED",

  // Credit related
  "CREDIT CARD",
  "CREDIT",
  "FINANCIAL",
  "FINANCE",
  "SERVICES",
  "SERVICE",
  "LENDING",
  "SOLUTIONS",
  "NATIONAL",
  "USA",
  "U.S.A.",
  "OF AMERICA",
  "AMERICA",
];

// Known abbreviations and their expansions
const ABBREVIATION_MAP: Record<string, string> = {
  "BK": "BANK",
  "ASSOC": "ASSOCIATION",
  "NATL": "NATIONAL",
  "FIN": "FINANCIAL",
  "SVCS": "SERVICES",
  "SVC": "SERVICE",
  "CRED": "CREDIT",
  "CORP": "CORPORATION",
  "MTG": "MORTGAGE",
  "AUTO": "AUTOMOTIVE",
};

export interface CreditorGroup {
  normalizedName: string;
  accounts: Array<{
    id: string;
    originalCreditorName: string;
    bureau: string;
    accountNumber?: string;
    balance?: number;
    status?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }>;
  inconsistencies: CreditorInconsistency[];
}

export interface CreditorInconsistency {
  type: "BALANCE_MISMATCH" | "STATUS_MISMATCH" | "ACCOUNT_NUMBER_MISMATCH" | "MISSING_FROM_BUREAU";
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  bureausAffected: string[];
}

/**
 * Normalize a creditor name for grouping purposes
 * Removes common suffixes and standardizes formatting
 */
export function normalizeCreditorName(name: string): string {
  if (!name) return "";

  // Uppercase for consistent comparison
  let normalized = name.toUpperCase().trim();

  // Replace punctuation with spaces
  normalized = normalized.replace(/[.,\-/\\()]+/g, " ");

  // Expand abbreviations
  for (const [abbrev, expansion] of Object.entries(ABBREVIATION_MAP)) {
    // Match whole words only
    const regex = new RegExp(`\\b${abbrev}\\b`, "g");
    normalized = normalized.replace(regex, expansion);
  }

  // Remove suffixes (longest first to avoid partial matches)
  const sortedSuffixes = [...SUFFIXES_TO_REMOVE].sort((a, b) => b.length - a.length);
  for (const suffix of sortedSuffixes) {
    // Match suffix at end or followed by space
    const regex = new RegExp(`\\s*${suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");
    normalized = normalized.replace(regex, "");
  }

  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, " ").trim();

  // Remove trailing punctuation
  normalized = normalized.replace(/[,.\s]+$/, "");

  return normalized;
}

/**
 * Group accounts by normalized creditor name
 */
export function groupAccountsByCreditor<T extends {
  id: string;
  creditorName?: string;
  accountName?: string;
  bureau?: string;
  cra?: string;
  accountNumber?: string;
  balance?: number | null;
  accountStatus?: string;
}>(accounts: T[]): CreditorGroup[] {
  const groups = new Map<string, CreditorGroup>();

  for (const account of accounts) {
    const originalName = account.creditorName || account.accountName || "";
    const normalizedName = normalizeCreditorName(originalName);

    if (!normalizedName) continue;

    if (!groups.has(normalizedName)) {
      groups.set(normalizedName, {
        normalizedName,
        accounts: [],
        inconsistencies: [],
      });
    }

    const group = groups.get(normalizedName)!;
    group.accounts.push({
      ...account,
      id: account.id,
      originalCreditorName: originalName,
      bureau: account.bureau || account.cra || "UNKNOWN",
      accountNumber: account.accountNumber,
      balance: account.balance ?? undefined,
      status: account.accountStatus,
    });
  }

  // Detect inconsistencies for each group
  for (const group of groups.values()) {
    group.inconsistencies = detectInconsistencies(group);
  }

  // Sort by account count (groups with more accounts first)
  return Array.from(groups.values()).sort((a, b) => b.accounts.length - a.accounts.length);
}

/**
 * Detect inconsistencies within a creditor group
 */
export function detectInconsistencies(group: CreditorGroup): CreditorInconsistency[] {
  const inconsistencies: CreditorInconsistency[] = [];
  const { accounts } = group;

  if (accounts.length < 2) return inconsistencies;

  // Get unique bureaus
  const bureaus = [...new Set(accounts.map(a => a.bureau))];

  // Check for balance mismatches
  const balances = accounts.filter(a => a.balance !== undefined && a.balance !== null);
  if (balances.length > 1) {
    const uniqueBalances = [...new Set(balances.map(a => a.balance))];
    if (uniqueBalances.length > 1) {
      const balanceDetails = balances.map(a => `${a.bureau}: $${a.balance?.toLocaleString()}`).join(", ");
      inconsistencies.push({
        type: "BALANCE_MISMATCH",
        description: `Different balances reported: ${balanceDetails}`,
        severity: "HIGH",
        bureausAffected: balances.map(a => a.bureau),
      });
    }
  }

  // Check for status mismatches
  const statuses = accounts.filter(a => a.status);
  if (statuses.length > 1) {
    const uniqueStatuses = [...new Set(statuses.map(a => a.status?.toUpperCase()))];
    if (uniqueStatuses.length > 1) {
      const statusDetails = statuses.map(a => `${a.bureau}: ${a.status}`).join(", ");
      inconsistencies.push({
        type: "STATUS_MISMATCH",
        description: `Different statuses reported: ${statusDetails}`,
        severity: "MEDIUM",
        bureausAffected: statuses.map(a => a.bureau),
      });
    }
  }

  // Check for account number mismatches
  const accountNums = accounts.filter(a => a.accountNumber);
  if (accountNums.length > 1) {
    const uniqueNums = [...new Set(accountNums.map(a => a.accountNumber))];
    if (uniqueNums.length > 1) {
      inconsistencies.push({
        type: "ACCOUNT_NUMBER_MISMATCH",
        description: `Different account numbers across bureaus`,
        severity: "LOW",
        bureausAffected: accountNums.map(a => a.bureau),
      });
    }
  }

  // Check if missing from any bureau (when we have 3 accounts from 2 bureaus, etc.)
  const expectedBureaus = ["TRANSUNION", "EQUIFAX", "EXPERIAN"];
  const accountBureaus = new Set(accounts.map(a => a.bureau.toUpperCase()));
  const missingBureaus = expectedBureaus.filter(b => !accountBureaus.has(b));

  // Only flag if we have accounts from at least 2 bureaus but missing one
  if (bureaus.length >= 2 && missingBureaus.length === 1) {
    inconsistencies.push({
      type: "MISSING_FROM_BUREAU",
      description: `Not reported on ${missingBureaus[0]}`,
      severity: "MEDIUM",
      bureausAffected: missingBureaus,
    });
  }

  return inconsistencies;
}

/**
 * Get similarity score between two creditor names (0-100)
 */
export function getCreditorSimilarity(name1: string, name2: string): number {
  const norm1 = normalizeCreditorName(name1);
  const norm2 = normalizeCreditorName(name2);

  if (norm1 === norm2) return 100;
  if (!norm1 || !norm2) return 0;

  // Check if one contains the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const longer = Math.max(norm1.length, norm2.length);
    const shorter = Math.min(norm1.length, norm2.length);
    return Math.round((shorter / longer) * 100);
  }

  // Levenshtein distance based similarity
  const distance = levenshteinDistance(norm1, norm2);
  const maxLength = Math.max(norm1.length, norm2.length);
  return Math.round(((maxLength - distance) / maxLength) * 100);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }

  return dp[m][n];
}
