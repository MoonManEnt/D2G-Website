/**
 * Credit Report Issue Analyzer
 *
 * Detects FCRA violations, reporting errors, and disputable items
 * in parsed credit report data.
 */

import type {
  ParsedCreditReport,
  CreditAccount,
  CreditInquiry,
  PublicRecord,
  Bureau,
} from "./extraction-schema";
import { createLogger } from "../logger";
const log = createLogger("issue-analyzer");

// Issue severity levels
export type IssueSeverity = "HIGH" | "MEDIUM" | "LOW";

// Issue categories aligned with dispute flows
export type IssueCategory =
  | "ACCURACY"
  | "COLLECTION"
  | "CONSENT"
  | "IDENTITY"
  | "PROCEDURAL"
  | "METRO2";

// Detected issue structure
export interface DetectedIssue {
  id: string;
  code: string;
  category: IssueCategory;
  severity: IssueSeverity;
  title: string;
  description: string;
  statute: string;
  bureaus: Bureau[];
  accountId?: string;
  evidence: string;
  recommendedFlow: string;
  recommendedAction: string;
}

// Issue detection rules
interface IssueRule {
  code: string;
  category: IssueCategory;
  severity: IssueSeverity;
  title: string;
  statute: string;
  check: (account: CreditAccount, allAccounts: CreditAccount[]) => boolean;
  getDescription: (account: CreditAccount) => string;
  getEvidence: (account: CreditAccount) => string;
  recommendedFlow: string;
  recommendedAction: string;
}

// FCRA issue detection rules
const ACCOUNT_ISSUE_RULES: IssueRule[] = [
  // ACCURACY ISSUES
  {
    code: "ACC001",
    category: "ACCURACY",
    severity: "HIGH",
    title: "Balance Discrepancy",
    statute: "15 USC 1681e(b)",
    check: (account) => {
      // Check if balance exceeds credit limit significantly
      if (account.creditLimit && account.balance) {
        return account.balance > account.creditLimit * 1.3;
      }
      return false;
    },
    getDescription: (account) =>
      `Balance ($${account.balance?.toLocaleString()}) exceeds credit limit ($${account.creditLimit?.toLocaleString()}) by more than 30%`,
    getEvidence: (account) =>
      `Reported balance: $${account.balance?.toLocaleString()}, Credit limit: $${account.creditLimit?.toLocaleString()}`,
    recommendedFlow: "ACCURACY",
    recommendedAction: "Dispute inaccurate balance reporting under FCRA 611",
  },
  {
    code: "ACC002",
    category: "ACCURACY",
    severity: "HIGH",
    title: "Wrong Account Status",
    statute: "15 USC 1681e(b)",
    check: (account) => {
      // Closed account showing balance or open status
      if (account.status === "CLOSED" && account.balance && account.balance > 0) {
        return true;
      }
      // Paid account showing past due
      if (account.status === "PAID" && account.pastDue && account.pastDue > 0) {
        return true;
      }
      return false;
    },
    getDescription: (account) => {
      if (account.status === "CLOSED" && account.balance) {
        return `Closed account incorrectly shows balance of $${account.balance.toLocaleString()}`;
      }
      return `Paid account incorrectly shows past due amount of $${account.pastDue?.toLocaleString()}`;
    },
    getEvidence: (account) =>
      `Account status: ${account.status}, Balance: $${account.balance || 0}, Past due: $${account.pastDue || 0}`,
    recommendedFlow: "ACCURACY",
    recommendedAction: "Request correction of account status under FCRA 611",
  },
  {
    code: "ACC003",
    category: "ACCURACY",
    severity: "MEDIUM",
    title: "Duplicate Account",
    statute: "15 USC 1681e(b)",
    check: (account, allAccounts) => {
      // Find potential duplicates (same creditor, similar account numbers)
      const similar = allAccounts.filter((a) => {
        if (a.id === account.id) return false;
        if (a.bureau !== account.bureau) return false;

        // Same creditor name (fuzzy match)
        const name1 = account.creditorName.toLowerCase().replace(/[^a-z0-9]/g, "");
        const name2 = a.creditorName.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (name1 !== name2 && !name1.includes(name2) && !name2.includes(name1)) {
          return false;
        }

        // Similar balance or account number
        const sameBalance = account.balance && a.balance && Math.abs(account.balance - a.balance) < 10;
        const sameAccNum = account.accountNumber && a.accountNumber &&
          account.accountNumber.slice(-4) === a.accountNumber.slice(-4);

        return sameBalance || sameAccNum;
      });

      return similar.length > 0;
    },
    getDescription: () => "Account appears to be reported multiple times",
    getEvidence: (account) => `Account: ${account.creditorName} #${account.accountNumber}`,
    recommendedFlow: "ACCURACY",
    recommendedAction: "Request removal of duplicate account entry",
  },

  // COLLECTION ISSUES
  {
    code: "COL001",
    category: "COLLECTION",
    severity: "HIGH",
    title: "Time-Barred Collection",
    statute: "15 USC 1681c(a)",
    check: (account) => {
      if (account.accountType !== "COLLECTION") return false;
      if (!account.dateOpened && !account.dateLastActive) return false;

      // Check if older than 7 years
      const relevantDate = account.dateOpened || account.dateLastActive;
      if (!relevantDate) return false;

      const accountDate = new Date(relevantDate);
      const sevenYearsAgo = new Date();
      sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);

      return accountDate < sevenYearsAgo;
    },
    getDescription: (account) => {
      const date = account.dateOpened || account.dateLastActive;
      return `Collection account from ${date} exceeds the 7-year reporting limit`;
    },
    getEvidence: (account) =>
      `Date opened: ${account.dateOpened || "N/A"}, Date last active: ${account.dateLastActive || "N/A"}`,
    recommendedFlow: "COLLECTION",
    recommendedAction: "Request immediate removal - account exceeds FCRA reporting period",
  },
  {
    code: "COL002",
    category: "COLLECTION",
    severity: "HIGH",
    title: "Re-aged Collection Account",
    statute: "15 USC 1681c(a)",
    check: (account) => {
      if (account.accountType !== "COLLECTION") return false;
      // Look for signs of re-aging
      if (!account.dateOpened || !account.dateReported) return false;

      const opened = new Date(account.dateOpened);
      const reported = new Date(account.dateReported);

      // If opened date is more recent than original debt would suggest
      const timeDiff = reported.getTime() - opened.getTime();
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

      // If the account was "opened" within 30 days of reporting, it might be re-aged
      return daysDiff < 30 && opened > new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    },
    getDescription: () =>
      "Collection account appears to have been re-aged, resetting the 7-year reporting clock",
    getEvidence: (account) =>
      `Date opened: ${account.dateOpened}, Date reported: ${account.dateReported}`,
    recommendedFlow: "COLLECTION",
    recommendedAction: "Dispute re-aging as FCRA violation",
  },
  {
    code: "COL003",
    category: "COLLECTION",
    severity: "MEDIUM",
    title: "Collection Without Original Creditor",
    statute: "15 USC 1681e(b)",
    check: (account) => {
      if (account.accountType !== "COLLECTION") return false;
      // Check if original creditor info is missing
      const hasOriginalInfo =
        account.comments?.toLowerCase().includes("original") ||
        account.creditorName.toLowerCase().includes("original");
      return !hasOriginalInfo;
    },
    getDescription: () =>
      "Collection account does not identify the original creditor as required",
    getEvidence: (account) =>
      `Collection reported by: ${account.creditorName}, No original creditor identified`,
    recommendedFlow: "COLLECTION",
    recommendedAction: "Request validation with original creditor documentation",
  },

  // CHARGE-OFF ISSUES
  {
    code: "CHG001",
    category: "ACCURACY",
    severity: "HIGH",
    title: "Charge-off Date Discrepancy",
    statute: "15 USC 1681s-2(a)",
    check: (account) => {
      if (account.status !== "CHARGE_OFF") return false;
      // Charge-offs should not have recent activity dates
      if (!account.dateLastActive) return false;

      const lastActive = new Date(account.dateLastActive);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      return lastActive > sixMonthsAgo;
    },
    getDescription: (account) =>
      `Charge-off account shows recent activity date: ${account.dateLastActive}`,
    getEvidence: (account) =>
      `Status: Charge-off, Last activity: ${account.dateLastActive}`,
    recommendedFlow: "ACCURACY",
    recommendedAction: "Dispute inconsistent charge-off reporting",
  },

  // LATE PAYMENT ISSUES
  {
    code: "LATE001",
    category: "ACCURACY",
    severity: "MEDIUM",
    title: "Inconsistent Payment History",
    statute: "15 USC 1681e(b)",
    check: (account) => {
      if (!account.paymentHistory || account.paymentHistory.length < 6) return false;
      // Look for suspicious patterns (like late payments on closed accounts)
      if (account.status === "CLOSED" || account.status === "PAID") {
        const recentLates = account.paymentHistory
          .slice(0, 6)
          .filter((p) => p.status !== "OK" && p.status !== "-");
        return recentLates.length > 0;
      }
      return false;
    },
    getDescription: (account) =>
      `${account.status} account shows recent late payments in payment history`,
    getEvidence: (account) => {
      const lates = account.paymentHistory
        ?.filter((p) => p.status !== "OK" && p.status !== "-")
        .map((p) => `${p.month}/${p.year}: ${p.status}`)
        .join(", ");
      return `Late payments: ${lates}`;
    },
    recommendedFlow: "ACCURACY",
    recommendedAction: "Dispute inaccurate payment history",
  },

  // CONSENT ISSUES
  {
    code: "CON001",
    category: "CONSENT",
    severity: "HIGH",
    title: "Unauthorized Account",
    statute: "15 USC 1681b",
    check: (account) => {
      // Check for signs of identity issues or unauthorized accounts
      if (account.responsibility === "AUTHORIZED_USER") return true;
      // Could add more sophisticated checks
      return false;
    },
    getDescription: (account) =>
      `Account listed as Authorized User - may be reported without consent`,
    getEvidence: (account) =>
      `Account: ${account.creditorName}, Responsibility: ${account.responsibility}`,
    recommendedFlow: "CONSENT",
    recommendedAction: "Request removal if not a consented authorized user relationship",
  },

  // METRO 2 COMPLIANCE
  {
    code: "M2001",
    category: "METRO2",
    severity: "MEDIUM",
    title: "Missing Required Data Fields",
    statute: "15 USC 1681s-2",
    check: (account) => {
      // Check for missing required Metro 2 fields
      const missingFields: string[] = [];
      if (!account.dateOpened) missingFields.push("Date Opened");
      if (!account.accountType || account.accountType === "OTHER") missingFields.push("Account Type");
      if (!account.status || account.status === "UNKNOWN") missingFields.push("Account Status");
      return missingFields.length >= 2;
    },
    getDescription: () => "Account is missing multiple required Metro 2 data fields",
    getEvidence: (account) => {
      const missing: string[] = [];
      if (!account.dateOpened) missing.push("Date Opened");
      if (!account.accountType || account.accountType === "OTHER") missing.push("Account Type");
      if (!account.status || account.status === "UNKNOWN") missing.push("Account Status");
      return `Missing fields: ${missing.join(", ")}`;
    },
    recommendedFlow: "ACCURACY",
    recommendedAction: "Request complete and accurate reporting per Metro 2 standards",
  },
];

// Inquiry issue rules
const INQUIRY_ISSUE_RULES: Array<{
  code: string;
  category: IssueCategory;
  severity: IssueSeverity;
  title: string;
  statute: string;
  check: (inquiry: CreditInquiry, allInquiries: CreditInquiry[]) => boolean;
  getDescription: (inquiry: CreditInquiry) => string;
  recommendedAction: string;
}> = [
  {
    code: "INQ001",
    category: "CONSENT",
    severity: "MEDIUM",
    title: "Excessive Hard Inquiries",
    statute: "15 USC 1681b(c)",
    check: (inquiry, allInquiries) => {
      // Count hard inquiries in last 6 months for the same bureau
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const recentHard = allInquiries.filter((i) => {
        if (i.inquiryType !== "HARD" || i.bureau !== inquiry.bureau) return false;
        const date = new Date(i.inquiryDate);
        return date > sixMonthsAgo;
      });

      return recentHard.length > 5;
    },
    getDescription: (inquiry) =>
      `Multiple hard inquiries on ${inquiry.bureau} in the past 6 months may indicate unauthorized pulls`,
    recommendedAction: "Review each inquiry for permissible purpose and dispute unauthorized pulls",
  },
  {
    code: "INQ002",
    category: "CONSENT",
    severity: "HIGH",
    title: "Unknown Inquiry Source",
    statute: "15 USC 1681b(a)",
    check: (inquiry) => {
      // Check for vague or unrecognizable inquiry names
      const vaguePhrases = ["inquiry", "unknown", "credit check", "review"];
      const name = inquiry.inquirerName.toLowerCase();
      return vaguePhrases.some((phrase) => name === phrase);
    },
    getDescription: (inquiry) =>
      `Inquiry from "${inquiry.inquirerName}" does not identify a specific creditor`,
    recommendedAction: "Dispute as lacking permissible purpose identification",
  },
];

/**
 * Analyze a parsed credit report for issues.
 */
export function analyzeForIssues(report: ParsedCreditReport): DetectedIssue[] {
  const issues: DetectedIssue[] = [];
  let issueId = 0;

  log.info({ accountCount: report.accounts.length }, "Starting issue analysis");

  // Analyze each account
  for (const account of report.accounts) {
    for (const rule of ACCOUNT_ISSUE_RULES) {
      if (rule.check(account, report.accounts)) {
        issues.push({
          id: `issue-${++issueId}`,
          code: rule.code,
          category: rule.category,
          severity: rule.severity,
          title: rule.title,
          description: rule.getDescription(account),
          statute: rule.statute,
          bureaus: [account.bureau],
          accountId: account.id,
          evidence: rule.getEvidence(account),
          recommendedFlow: rule.recommendedFlow,
          recommendedAction: rule.recommendedAction,
        });
      }
    }
  }

  // Analyze inquiries
  for (const inquiry of report.inquiries) {
    if (inquiry.inquiryType !== "HARD") continue;

    for (const rule of INQUIRY_ISSUE_RULES) {
      if (rule.check(inquiry, report.inquiries)) {
        issues.push({
          id: `issue-${++issueId}`,
          code: rule.code,
          category: rule.category,
          severity: rule.severity,
          title: rule.title,
          description: rule.getDescription(inquiry),
          statute: rule.statute,
          bureaus: [inquiry.bureau],
          evidence: `Inquiry: ${inquiry.inquirerName} on ${inquiry.inquiryDate}`,
          recommendedFlow: "CONSENT",
          recommendedAction: rule.recommendedAction,
        });
      }
    }
  }

  // Cross-bureau analysis for inconsistencies
  const accountsByCreditor = new Map<string, CreditAccount[]>();
  for (const account of report.accounts) {
    const key = account.creditorName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const existing = accountsByCreditor.get(key) || [];
    existing.push(account);
    accountsByCreditor.set(key, existing);
  }

  for (const [creditor, accounts] of accountsByCreditor) {
    if (accounts.length > 1) {
      // Check for inconsistencies across bureaus
      const balances = new Set(accounts.map((a) => a.balance).filter(Boolean));
      const statuses = new Set(accounts.map((a) => a.status));

      if (balances.size > 1) {
        issues.push({
          id: `issue-${++issueId}`,
          code: "XB001",
          category: "ACCURACY",
          severity: "MEDIUM",
          title: "Cross-Bureau Balance Discrepancy",
          description: `Account "${accounts[0].creditorName}" shows different balances across bureaus`,
          statute: "15 USC 1681i(a)",
          bureaus: accounts.map((a) => a.bureau),
          evidence: accounts
            .map((a) => `${a.bureau}: $${a.balance?.toLocaleString() || "N/A"}`)
            .join(", "),
          recommendedFlow: "ACCURACY",
          recommendedAction: "Dispute inconsistent reporting across bureaus",
        });
      }

      if (statuses.size > 1) {
        issues.push({
          id: `issue-${++issueId}`,
          code: "XB002",
          category: "ACCURACY",
          severity: "MEDIUM",
          title: "Cross-Bureau Status Discrepancy",
          description: `Account "${accounts[0].creditorName}" shows different status across bureaus`,
          statute: "15 USC 1681i(a)",
          bureaus: accounts.map((a) => a.bureau),
          evidence: accounts.map((a) => `${a.bureau}: ${a.status}`).join(", "),
          recommendedFlow: "ACCURACY",
          recommendedAction: "Dispute inconsistent status reporting",
        });
      }
    }
  }

  log.info({ issueCount: issues.length }, "Issue analysis complete");

  return issues;
}

/**
 * Get summary statistics for detected issues.
 */
export function getIssueSummary(issues: DetectedIssue[]): {
  total: number;
  bySeverity: Record<IssueSeverity, number>;
  byCategory: Record<IssueCategory, number>;
  disputableAccounts: number;
  highPriority: number;
} {
  const bySeverity: Record<IssueSeverity, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  const byCategory: Record<IssueCategory, number> = {
    ACCURACY: 0,
    COLLECTION: 0,
    CONSENT: 0,
    IDENTITY: 0,
    PROCEDURAL: 0,
    METRO2: 0,
  };

  const accountsWithIssues = new Set<string>();

  for (const issue of issues) {
    bySeverity[issue.severity]++;
    byCategory[issue.category]++;
    if (issue.accountId) {
      accountsWithIssues.add(issue.accountId);
    }
  }

  return {
    total: issues.length,
    bySeverity,
    byCategory,
    disputableAccounts: accountsWithIssues.size,
    highPriority: bySeverity.HIGH,
  };
}
