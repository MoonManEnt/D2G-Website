/**
 * Violation Detection Rules for the Litigation Scanner
 *
 * Implements 15 rules (10 FCRA, 4 FDCPA, 1 Metro 2) to detect potential
 * violations in credit report data. Uses cross-bureau comparison via
 * fingerprint grouping and dispute history analysis.
 */

import type {
  LitigationViolation,
  ViolationEvidence,
  AffectedAccount,
  ScanAccount,
  ScanDispute,
  LitigationScanInput,
  ViolationRuleId,
  ViolationCategory,
  ViolationSeverity,
  StateSOL,
} from "./types";

import { normalizeCreditorName } from "@/lib/creditor-normalization";

// =============================================================================
// HELPERS
// =============================================================================

let idCounter = 0;
function generateId(): string {
  return `viol_${Date.now()}_${++idCounter}`;
}

function groupByFingerprint(
  accounts: ScanAccount[]
): Map<string, ScanAccount[]> {
  const groups = new Map<string, ScanAccount[]>();
  for (const account of accounts) {
    const existing = groups.get(account.fingerprint) || [];
    existing.push(account);
    groups.set(account.fingerprint, existing);
  }
  return groups;
}

function toAffectedAccount(a: ScanAccount): AffectedAccount {
  return {
    accountId: a.id,
    creditorName: a.creditorName,
    cra: a.cra,
    fingerprint: a.fingerprint,
    accountType: a.accountType,
    accountStatus: a.accountStatus,
    balance: a.balance,
  };
}

// =============================================================================
// STATE SOL MAP - All 50 states + DC
// =============================================================================

export const STATE_SOL_MAP: Record<string, StateSOL> = {
  AL: {
    state: "AL",
    writtenContractYears: 6,
    oralContractYears: 6,
    promissoryNoteYears: 6,
    openAccountYears: 3,
  },
  AK: {
    state: "AK",
    writtenContractYears: 3,
    oralContractYears: 3,
    promissoryNoteYears: 3,
    openAccountYears: 3,
  },
  AZ: {
    state: "AZ",
    writtenContractYears: 6,
    oralContractYears: 3,
    promissoryNoteYears: 6,
    openAccountYears: 3,
  },
  AR: {
    state: "AR",
    writtenContractYears: 5,
    oralContractYears: 3,
    promissoryNoteYears: 5,
    openAccountYears: 3,
  },
  CA: {
    state: "CA",
    writtenContractYears: 4,
    oralContractYears: 2,
    promissoryNoteYears: 4,
    openAccountYears: 4,
  },
  CO: {
    state: "CO",
    writtenContractYears: 6,
    oralContractYears: 6,
    promissoryNoteYears: 6,
    openAccountYears: 6,
  },
  CT: {
    state: "CT",
    writtenContractYears: 6,
    oralContractYears: 3,
    promissoryNoteYears: 6,
    openAccountYears: 6,
  },
  DE: {
    state: "DE",
    writtenContractYears: 3,
    oralContractYears: 3,
    promissoryNoteYears: 3,
    openAccountYears: 3,
  },
  FL: {
    state: "FL",
    writtenContractYears: 5,
    oralContractYears: 4,
    promissoryNoteYears: 5,
    openAccountYears: 4,
  },
  GA: {
    state: "GA",
    writtenContractYears: 6,
    oralContractYears: 4,
    promissoryNoteYears: 6,
    openAccountYears: 4,
  },
  HI: {
    state: "HI",
    writtenContractYears: 6,
    oralContractYears: 6,
    promissoryNoteYears: 6,
    openAccountYears: 6,
  },
  ID: {
    state: "ID",
    writtenContractYears: 5,
    oralContractYears: 4,
    promissoryNoteYears: 5,
    openAccountYears: 4,
  },
  IL: {
    state: "IL",
    writtenContractYears: 10,
    oralContractYears: 5,
    promissoryNoteYears: 10,
    openAccountYears: 5,
  },
  IN: {
    state: "IN",
    writtenContractYears: 6,
    oralContractYears: 6,
    promissoryNoteYears: 6,
    openAccountYears: 6,
  },
  IA: {
    state: "IA",
    writtenContractYears: 10,
    oralContractYears: 5,
    promissoryNoteYears: 10,
    openAccountYears: 5,
  },
  KS: {
    state: "KS",
    writtenContractYears: 5,
    oralContractYears: 3,
    promissoryNoteYears: 5,
    openAccountYears: 3,
  },
  KY: {
    state: "KY",
    writtenContractYears: 15,
    oralContractYears: 5,
    promissoryNoteYears: 15,
    openAccountYears: 5,
  },
  LA: {
    state: "LA",
    writtenContractYears: 10,
    oralContractYears: 10,
    promissoryNoteYears: 10,
    openAccountYears: 3,
  },
  ME: {
    state: "ME",
    writtenContractYears: 6,
    oralContractYears: 6,
    promissoryNoteYears: 6,
    openAccountYears: 6,
  },
  MD: {
    state: "MD",
    writtenContractYears: 3,
    oralContractYears: 3,
    promissoryNoteYears: 6,
    openAccountYears: 3,
  },
  MA: {
    state: "MA",
    writtenContractYears: 6,
    oralContractYears: 6,
    promissoryNoteYears: 6,
    openAccountYears: 6,
  },
  MI: {
    state: "MI",
    writtenContractYears: 6,
    oralContractYears: 6,
    promissoryNoteYears: 6,
    openAccountYears: 6,
  },
  MN: {
    state: "MN",
    writtenContractYears: 6,
    oralContractYears: 6,
    promissoryNoteYears: 6,
    openAccountYears: 6,
  },
  MS: {
    state: "MS",
    writtenContractYears: 3,
    oralContractYears: 3,
    promissoryNoteYears: 3,
    openAccountYears: 3,
  },
  MO: {
    state: "MO",
    writtenContractYears: 10,
    oralContractYears: 5,
    promissoryNoteYears: 10,
    openAccountYears: 5,
  },
  MT: {
    state: "MT",
    writtenContractYears: 5,
    oralContractYears: 5,
    promissoryNoteYears: 5,
    openAccountYears: 5,
  },
  NE: {
    state: "NE",
    writtenContractYears: 5,
    oralContractYears: 4,
    promissoryNoteYears: 5,
    openAccountYears: 4,
  },
  NV: {
    state: "NV",
    writtenContractYears: 6,
    oralContractYears: 4,
    promissoryNoteYears: 6,
    openAccountYears: 4,
  },
  NH: {
    state: "NH",
    writtenContractYears: 3,
    oralContractYears: 3,
    promissoryNoteYears: 6,
    openAccountYears: 3,
  },
  NJ: {
    state: "NJ",
    writtenContractYears: 6,
    oralContractYears: 6,
    promissoryNoteYears: 6,
    openAccountYears: 6,
  },
  NM: {
    state: "NM",
    writtenContractYears: 6,
    oralContractYears: 4,
    promissoryNoteYears: 6,
    openAccountYears: 4,
  },
  NY: {
    state: "NY",
    writtenContractYears: 6,
    oralContractYears: 6,
    promissoryNoteYears: 6,
    openAccountYears: 6,
  },
  NC: {
    state: "NC",
    writtenContractYears: 3,
    oralContractYears: 3,
    promissoryNoteYears: 5,
    openAccountYears: 3,
  },
  ND: {
    state: "ND",
    writtenContractYears: 6,
    oralContractYears: 6,
    promissoryNoteYears: 6,
    openAccountYears: 6,
  },
  OH: {
    state: "OH",
    writtenContractYears: 6,
    oralContractYears: 6,
    promissoryNoteYears: 6,
    openAccountYears: 6,
  },
  OK: {
    state: "OK",
    writtenContractYears: 5,
    oralContractYears: 3,
    promissoryNoteYears: 5,
    openAccountYears: 3,
  },
  OR: {
    state: "OR",
    writtenContractYears: 6,
    oralContractYears: 6,
    promissoryNoteYears: 6,
    openAccountYears: 6,
  },
  PA: {
    state: "PA",
    writtenContractYears: 4,
    oralContractYears: 4,
    promissoryNoteYears: 4,
    openAccountYears: 4,
  },
  RI: {
    state: "RI",
    writtenContractYears: 10,
    oralContractYears: 10,
    promissoryNoteYears: 10,
    openAccountYears: 10,
  },
  SC: {
    state: "SC",
    writtenContractYears: 3,
    oralContractYears: 3,
    promissoryNoteYears: 3,
    openAccountYears: 3,
  },
  SD: {
    state: "SD",
    writtenContractYears: 6,
    oralContractYears: 6,
    promissoryNoteYears: 6,
    openAccountYears: 6,
  },
  TN: {
    state: "TN",
    writtenContractYears: 6,
    oralContractYears: 6,
    promissoryNoteYears: 6,
    openAccountYears: 6,
  },
  TX: {
    state: "TX",
    writtenContractYears: 4,
    oralContractYears: 4,
    promissoryNoteYears: 4,
    openAccountYears: 4,
  },
  UT: {
    state: "UT",
    writtenContractYears: 6,
    oralContractYears: 4,
    promissoryNoteYears: 6,
    openAccountYears: 4,
  },
  VT: {
    state: "VT",
    writtenContractYears: 6,
    oralContractYears: 6,
    promissoryNoteYears: 5,
    openAccountYears: 6,
  },
  VA: {
    state: "VA",
    writtenContractYears: 5,
    oralContractYears: 3,
    promissoryNoteYears: 5,
    openAccountYears: 3,
  },
  WA: {
    state: "WA",
    writtenContractYears: 6,
    oralContractYears: 3,
    promissoryNoteYears: 6,
    openAccountYears: 3,
  },
  WV: {
    state: "WV",
    writtenContractYears: 10,
    oralContractYears: 5,
    promissoryNoteYears: 6,
    openAccountYears: 5,
  },
  WI: {
    state: "WI",
    writtenContractYears: 6,
    oralContractYears: 6,
    promissoryNoteYears: 10,
    openAccountYears: 6,
  },
  WY: {
    state: "WY",
    writtenContractYears: 10,
    oralContractYears: 8,
    promissoryNoteYears: 10,
    openAccountYears: 8,
  },
  DC: {
    state: "DC",
    writtenContractYears: 3,
    oralContractYears: 3,
    promissoryNoteYears: 3,
    openAccountYears: 3,
  },
};

// =============================================================================
// CASE LAW REFERENCES
// =============================================================================

const CASELAW_INACCURACY = [
  "Cushman v. Trans Union Corp., 115 F.3d 220 (3d Cir. 1997)",
  "Nelson v. Chase Manhattan Mortgage Corp., 282 F.3d 1057 (9th Cir. 2002)",
];

const CASELAW_WILLFULNESS = [
  "Safeco Ins. Co. of America v. Burr, 551 U.S. 47 (2007)",
];

const CASELAW_FURNISHER = [
  "Cortez v. Trans Union, LLC, 617 F.3d 688 (3d Cir. 2010)",
  "Johnson v. MBNA America Bank, NA, 357 F.3d 426 (4th Cir. 2004)",
];

const CASELAW_INVESTIGATION = [
  "Gorman v. Wolpoff & Abramson, LLP, 584 F.3d 1147 (9th Cir. 2009)",
  "Johnson v. MBNA America Bank, NA, 357 F.3d 426 (4th Cir. 2004)",
];

const CASELAW_OBSOLETE = [
  "Seamans v. Temple Univ., 744 F.3d 853 (3d Cir. 2014)",
];

const CASELAW_FDCPA = [
  "Henson v. Santander Consumer USA Inc., 582 U.S. 79 (2017)",
  "Jerman v. Carlisle, McNellie, Rini, Kramer & Ulrich LPA, 559 U.S. 573 (2010)",
];

// =============================================================================
// HELPER: day calculations
// =============================================================================

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysBetween(a: Date, b: Date): number {
  return Math.abs(
    Math.floor((a.getTime() - b.getTime()) / MS_PER_DAY)
  );
}

function yearsBetween(a: Date, b: Date): number {
  return daysBetween(a, b) / 365.25;
}

function isCollectionAccount(a: ScanAccount): boolean {
  const status = (a.accountStatus || "").toUpperCase();
  const type = (a.accountType || "").toUpperCase();
  return (
    status.includes("COLLECTION") ||
    type.includes("COLLECTION") ||
    status === "COLLECTIONS"
  );
}

function parseDetectedIssues(raw: string | null): unknown[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "N/A";
  return `$${(cents / 100).toFixed(2)}`;
}

// =============================================================================
// FCRA RULE 1: Incorrect Balance - 15 U.S.C. section 1681e(b)
// =============================================================================

export function detectIncorrectBalance(
  input: LitigationScanInput
): LitigationViolation[] {
  const violations: LitigationViolation[] = [];
  const groups = groupByFingerprint(input.accounts);

  for (const [, accounts] of groups) {
    if (accounts.length < 2) continue;

    // Only compare across different bureaus
    const bureaus = new Set(accounts.map((a) => a.cra));
    if (bureaus.size < 2) continue;

    const accountsWithBalance = accounts.filter(
      (a) => a.balance != null && a.balance >= 0
    );
    if (accountsWithBalance.length < 2) continue;

    const balances = accountsWithBalance.map((a) => a.balance!);
    const maxBal = Math.max(...balances);
    const minBal = Math.min(...balances);
    const diff = maxBal - minBal;

    if (diff === 0) continue;

    // Flag if difference > $100 (10000 cents) OR more than 20%
    const avgBal = (maxBal + minBal) / 2;
    const percentDiff = avgBal > 0 ? diff / avgBal : 0;

    if (diff > 10000 || percentDiff > 0.2) {
      const severity: ViolationSeverity = diff > 50000 ? "HIGH" : "MEDIUM";

      const bureauData: Record<string, string | number | null> = {};
      for (const a of accountsWithBalance) {
        bureauData[a.cra] = a.balance;
      }

      const evidence: ViolationEvidence[] = [
        {
          type: "CROSS_BUREAU_DATA",
          description: `Balance varies across bureaus: ${accountsWithBalance
            .map((a) => `${a.cra}: ${formatCents(a.balance)}`)
            .join(", ")}. Difference: ${formatCents(diff)}.`,
          bureauData,
        },
      ];

      const defendants = [...new Set(accountsWithBalance.map((a) => a.cra))];
      defendants.push(accountsWithBalance[0].creditorName);

      violations.push({
        id: generateId(),
        ruleId: "INCORRECT_BALANCE",
        category: "FCRA",
        severity,
        statute: "15 U.S.C. \u00A7 1681e(b)",
        statuteShortName: "FCRA \u00A7 1681e(b)",
        title: "Incorrect Balance Across Bureaus",
        description: `The account for ${accountsWithBalance[0].creditorName} reports different balances across credit bureaus. ${accountsWithBalance
          .map((a) => `${a.cra} reports ${formatCents(a.balance)}`)
          .join("; ")}. This ${formatCents(diff)} discrepancy indicates inaccurate reporting in violation of FCRA accuracy requirements.`,
        evidence,
        affectedAccounts: accountsWithBalance.map(toAffectedAccount),
        defendants: [...new Set(defendants)],
        caselaw: [...CASELAW_INACCURACY, ...CASELAW_WILLFULNESS],
        estimatedDamagesMin: 10000, // $100
        estimatedDamagesMax: 100000, // $1,000
      });
    }
  }

  return violations;
}

// =============================================================================
// FCRA RULE 2: Wrong Account Status - 15 U.S.C. section 1681s-2(a)
// =============================================================================

export function detectWrongAccountStatus(
  input: LitigationScanInput
): LitigationViolation[] {
  const violations: LitigationViolation[] = [];
  const groups = groupByFingerprint(input.accounts);

  const contradictions: [string, string][] = [
    ["OPEN", "CLOSED"],
    ["OPEN", "COLLECTION"],
    ["CURRENT", "COLLECTION"],
    ["CURRENT", "CHARGED_OFF"],
    ["PAID", "OPEN"],
    ["PAID", "COLLECTION"],
    ["SETTLED", "OPEN"],
    ["SETTLED", "COLLECTION"],
  ];

  for (const [, accounts] of groups) {
    if (accounts.length < 2) continue;

    const bureaus = new Set(accounts.map((a) => a.cra));
    if (bureaus.size < 2) continue;

    const statuses = accounts.map((a) => ({
      account: a,
      normalizedStatus: (a.accountStatus || "").toUpperCase().replace(/\s+/g, "_"),
    }));

    for (let i = 0; i < statuses.length; i++) {
      for (let j = i + 1; j < statuses.length; j++) {
        if (statuses[i].account.cra === statuses[j].account.cra) continue;

        const s1 = statuses[i].normalizedStatus;
        const s2 = statuses[j].normalizedStatus;
        if (s1 === s2) continue;

        const isContradiction = contradictions.some(
          ([a, b]) =>
            (s1.includes(a) && s2.includes(b)) ||
            (s1.includes(b) && s2.includes(a))
        );

        if (!isContradiction && s1 !== s2) {
          // Still flag if statuses simply differ
        } else if (!isContradiction) {
          continue;
        }

        const isCritical =
          (s1.includes("OPEN") && s2.includes("COLLECTION")) ||
          (s2.includes("OPEN") && s1.includes("COLLECTION")) ||
          (s1.includes("CURRENT") && s2.includes("COLLECTION")) ||
          (s2.includes("CURRENT") && s1.includes("COLLECTION"));

        const severity: ViolationSeverity = isCritical ? "CRITICAL" : "HIGH";

        const bureauData: Record<string, string | number | null> = {};
        for (const s of statuses) {
          bureauData[s.account.cra] = s.normalizedStatus;
        }

        const evidence: ViolationEvidence[] = [
          {
            type: "STATUS_CONTRADICTION",
            description: `${statuses[i].account.cra} reports status "${statuses[i].normalizedStatus}" while ${statuses[j].account.cra} reports "${statuses[j].normalizedStatus}" for the same account.`,
            bureauData,
          },
        ];

        const affected = [statuses[i].account, statuses[j].account];

        violations.push({
          id: generateId(),
          ruleId: "WRONG_ACCOUNT_STATUS",
          category: "FCRA",
          severity,
          statute: "15 U.S.C. \u00A7 1681s-2(a)",
          statuteShortName: "FCRA \u00A7 1681s-2(a)",
          title: "Contradictory Account Status Across Bureaus",
          description: `The account for ${statuses[i].account.creditorName} has contradictory statuses: ${statuses[i].account.cra} reports "${statuses[i].normalizedStatus}" while ${statuses[j].account.cra} reports "${statuses[j].normalizedStatus}". At least one bureau is reporting inaccurate information.`,
          evidence,
          affectedAccounts: affected.map(toAffectedAccount),
          defendants: [
            ...new Set([
              ...affected.map((a) => a.cra),
              affected[0].creditorName,
            ]),
          ],
          caselaw: [...CASELAW_FURNISHER, ...CASELAW_WILLFULNESS],
          estimatedDamagesMin: isCritical ? 50000 : 10000,
          estimatedDamagesMax: isCritical ? 200000 : 100000,
        });

        // Only flag once per fingerprint group pair
        break;
      }
      if (violations.length > 0 && violations[violations.length - 1].affectedAccounts.some(
        (a) => a.fingerprint === accounts[0].fingerprint
      )) {
        break;
      }
    }
  }

  return violations;
}

// =============================================================================
// FCRA RULE 3: Incorrect Payment History - 15 U.S.C. section 1681s-2(a)(1)
// =============================================================================

export function detectIncorrectPaymentHistory(
  input: LitigationScanInput
): LitigationViolation[] {
  const violations: LitigationViolation[] = [];
  const groups = groupByFingerprint(input.accounts);

  for (const [, accounts] of groups) {
    // Check individual accounts for payment history issues
    const accountsWithIssues: Array<{
      account: ScanAccount;
      issues: unknown[];
    }> = [];

    for (const account of accounts) {
      const issues = parseDetectedIssues(account.detectedIssues);
      const paymentIssues = issues.filter((issue) => {
        const issueStr = JSON.stringify(issue).toUpperCase();
        return (
          issueStr.includes("PAYMENT_HISTORY") ||
          issueStr.includes("CROSS_BUREAU") ||
          issueStr.includes("DISCREPANCY")
        );
      });
      if (paymentIssues.length > 0) {
        accountsWithIssues.push({ account, issues: paymentIssues });
      }
    }

    if (accountsWithIssues.length === 0) continue;

    // Check for cross-bureau payment history discrepancies
    if (accounts.length >= 2) {
      const bureaus = new Set(accounts.map((a) => a.cra));
      if (bureaus.size >= 2) {
        const paymentStatuses = accounts
          .filter((a) => a.paymentStatus != null)
          .map((a) => ({
            cra: a.cra,
            status: (a.paymentStatus || "").toUpperCase(),
          }));

        const uniqueStatuses = new Set(paymentStatuses.map((p) => p.status));
        if (uniqueStatuses.size > 1 || accountsWithIssues.length > 0) {
          const bureauData: Record<string, string | number | null> = {};
          for (const ps of paymentStatuses) {
            bureauData[ps.cra] = ps.status;
          }

          const evidence: ViolationEvidence[] = [
            {
              type: "CROSS_BUREAU_DATA",
              description: `Payment history discrepancies detected for ${accounts[0].creditorName}. ${accountsWithIssues
                .map(
                  (ai) =>
                    `${ai.account.cra}: ${ai.issues.length} issue(s) found`
                )
                .join("; ")}.`,
              bureauData,
            },
          ];

          if (accountsWithIssues.length > 0) {
            evidence.push({
              type: "ACCOUNT_DATA",
              description: `Detected issues: ${JSON.stringify(
                accountsWithIssues.map((ai) => ({
                  cra: ai.account.cra,
                  issues: ai.issues,
                }))
              )}`,
            });
          }

          violations.push({
            id: generateId(),
            ruleId: "INCORRECT_PAYMENT_HISTORY",
            category: "FCRA",
            severity: "HIGH",
            statute: "15 U.S.C. \u00A7 1681s-2(a)(1)",
            statuteShortName: "FCRA \u00A7 1681s-2(a)(1)",
            title: "Incorrect Payment History Reporting",
            description: `The account for ${accounts[0].creditorName} has payment history discrepancies across bureaus or detected issues in payment reporting. Inaccurate payment history can significantly damage a consumer's credit score.`,
            evidence,
            affectedAccounts: accounts.map(toAffectedAccount),
            defendants: [
              ...new Set([
                ...accounts.map((a) => a.cra),
                accounts[0].creditorName,
              ]),
            ],
            caselaw: [...CASELAW_FURNISHER, ...CASELAW_INACCURACY],
            estimatedDamagesMin: 10000,
            estimatedDamagesMax: 150000,
          });
        }
      }
    }
  }

  return violations;
}

// =============================================================================
// FCRA RULE 4: Re-Aged Debt - 15 U.S.C. section 1681c(c)
// =============================================================================

export function detectReAgedDebt(
  input: LitigationScanInput
): LitigationViolation[] {
  const violations: LitigationViolation[] = [];
  const groups = groupByFingerprint(input.accounts);

  for (const [, accounts] of groups) {
    if (accounts.length < 2) continue;

    const bureaus = new Set(accounts.map((a) => a.cra));
    if (bureaus.size < 2) continue;

    // Focus on collections/negative accounts
    const negativeAccounts = accounts.filter((a) => {
      const status = (a.accountStatus || "").toUpperCase();
      return (
        status.includes("COLLECTION") ||
        status.includes("CHARGED_OFF") ||
        status.includes("DEROGATORY") ||
        status.includes("LATE") ||
        (a.pastDue != null && a.pastDue > 0)
      );
    });

    if (negativeAccounts.length < 2) continue;

    const accountsWithDates = negativeAccounts.filter(
      (a) => a.dateOpened != null
    );
    if (accountsWithDates.length < 2) continue;

    // Compare dateOpened across bureaus
    const dates = accountsWithDates.map((a) => ({
      account: a,
      date: new Date(a.dateOpened!),
    }));

    for (let i = 0; i < dates.length; i++) {
      for (let j = i + 1; j < dates.length; j++) {
        if (dates[i].account.cra === dates[j].account.cra) continue;

        const diffDays = daysBetween(dates[i].date, dates[j].date);

        if (diffDays > 90) {
          const bureauData: Record<string, string | number | null> = {};
          for (const d of dates) {
            bureauData[`${d.account.cra}_dateOpened`] = d.date.toISOString().split("T")[0];
          }

          const evidence: ViolationEvidence[] = [
            {
              type: "DATE_COMPARISON",
              description: `Date opened differs by ${diffDays} days across bureaus for ${dates[i].account.creditorName}. ${dates[i].account.cra}: ${dates[i].date.toISOString().split("T")[0]}, ${dates[j].account.cra}: ${dates[j].date.toISOString().split("T")[0]}. This ${diffDays}-day discrepancy suggests potential debt re-aging.`,
              bureauData,
            },
          ];

          violations.push({
            id: generateId(),
            ruleId: "RE_AGED_DEBT",
            category: "FCRA",
            severity: "CRITICAL",
            statute: "15 U.S.C. \u00A7 1681c(c)",
            statuteShortName: "FCRA \u00A7 1681c(c)",
            title: "Potential Re-Aged Debt",
            description: `The negative account for ${dates[i].account.creditorName} shows a ${diffDays}-day discrepancy in the date opened between ${dates[i].account.cra} and ${dates[j].account.cra}. Re-aging debt by altering the date of first delinquency is a serious FCRA violation that extends the 7-year reporting period.`,
            evidence,
            affectedAccounts: [dates[i].account, dates[j].account].map(
              toAffectedAccount
            ),
            defendants: [
              ...new Set([
                dates[i].account.cra,
                dates[j].account.cra,
                dates[i].account.creditorName,
              ]),
            ],
            caselaw: [
              ...CASELAW_INACCURACY,
              ...CASELAW_WILLFULNESS,
              ...CASELAW_OBSOLETE,
            ],
            estimatedDamagesMin: 100000, // $1,000
            estimatedDamagesMax: 300000, // $3,000
          });

          // Only flag once per fingerprint group
          break;
        }
      }
      // Break outer loop too once a violation is found for this group
      if (
        violations.length > 0 &&
        violations[violations.length - 1].affectedAccounts.some(
          (a) => a.fingerprint === accounts[0].fingerprint
        )
      ) {
        break;
      }
    }
  }

  return violations;
}

// =============================================================================
// FCRA RULE 5: Obsolete Information - 15 U.S.C. section 1681c
// =============================================================================

export function detectObsoleteInformation(
  input: LitigationScanInput
): LitigationViolation[] {
  const violations: LitigationViolation[] = [];
  const reportDate = new Date(input.reportDate);

  for (const account of input.accounts) {
    if (!account.dateOpened) continue;

    const opened = new Date(account.dateOpened);
    const ageYears = yearsBetween(reportDate, opened);

    const isBankruptcy =
      (account.accountType || "").toUpperCase().includes("BANKRUPTCY") ||
      (account.accountStatus || "").toUpperCase().includes("BANKRUPTCY");

    const threshold = isBankruptcy ? 10 : 7;

    if (ageYears > threshold) {
      const evidence: ViolationEvidence[] = [
        {
          type: "DATE_COMPARISON",
          description: `Account opened on ${opened.toISOString().split("T")[0]} is ${ageYears.toFixed(1)} years old as of report date ${reportDate.toISOString().split("T")[0]}. The FCRA ${threshold}-year reporting limit has been exceeded by approximately ${(ageYears - threshold).toFixed(1)} years.`,
          bureauData: {
            dateOpened: opened.toISOString().split("T")[0],
            reportDate: reportDate.toISOString().split("T")[0],
            ageYears: parseFloat(ageYears.toFixed(1)),
            thresholdYears: threshold,
          },
        },
      ];

      violations.push({
        id: generateId(),
        ruleId: "OBSOLETE_INFORMATION",
        category: "FCRA",
        severity: "CRITICAL",
        statute: "15 U.S.C. \u00A7 1681c",
        statuteShortName: "FCRA \u00A7 1681c",
        title: "Obsolete Information Beyond Reporting Period",
        description: `The account for ${account.creditorName} on ${account.cra} was opened ${ageYears.toFixed(1)} years ago, exceeding the FCRA ${threshold}-year reporting limit${isBankruptcy ? " for bankruptcy" : ""}. This obsolete information must be removed.`,
        evidence,
        affectedAccounts: [toAffectedAccount(account)],
        defendants: [account.cra, account.creditorName],
        caselaw: [...CASELAW_OBSOLETE, ...CASELAW_WILLFULNESS],
        estimatedDamagesMin: 100000,
        estimatedDamagesMax: 300000,
      });
    }
  }

  return violations;
}

// =============================================================================
// FCRA RULE 6: Missing Dispute Notation - 15 U.S.C. section 1681s-2(a)(3)
// =============================================================================

export function detectMissingDisputeNotation(
  input: LitigationScanInput
): LitigationViolation[] {
  const violations: LitigationViolation[] = [];
  const now = new Date();

  for (const dispute of input.disputes) {
    if (!dispute.sentDate) continue;

    const sentDate = new Date(dispute.sentDate);
    const daysSinceSent = daysBetween(now, sentDate);

    // Only check disputes sent more than 14 days ago
    if (daysSinceSent <= 14) continue;

    if (dispute.status !== "SENT" && dispute.status !== "PENDING") continue;

    for (const item of dispute.items) {
      // Find the matching account
      const account = input.accounts.find(
        (a) => a.id === item.accountItemId
      );
      if (!account) continue;

      // Check if the account's detectedIssues includes a dispute notation
      const issues = parseDetectedIssues(account.detectedIssues);
      const hasDisputeNotation = issues.some((issue) => {
        const issueStr = JSON.stringify(issue).toUpperCase();
        return (
          issueStr.includes("DISPUTE") ||
          issueStr.includes("DISPUTED") ||
          issueStr.includes("CONSUMER_DISPUTE")
        );
      });

      if (!hasDisputeNotation) {
        const evidence: ViolationEvidence[] = [
          {
            type: "DISPUTE_HISTORY",
            description: `Dispute sent on ${sentDate.toISOString().split("T")[0]} (${daysSinceSent} days ago) for account ${account.creditorName} on ${account.cra}. The account does not reflect a dispute notation as required by FCRA.`,
            bureauData: {
              disputeId: dispute.id,
              sentDate: sentDate.toISOString().split("T")[0],
              daysSinceSent,
              cra: dispute.cra,
              accountStatus: account.accountStatus,
            },
          },
        ];

        violations.push({
          id: generateId(),
          ruleId: "MISSING_DISPUTE_NOTATION",
          category: "FCRA",
          severity: "MEDIUM",
          statute: "15 U.S.C. \u00A7 1681s-2(a)(3)",
          statuteShortName: "FCRA \u00A7 1681s-2(a)(3)",
          title: "Missing Dispute Notation on Account",
          description: `The account for ${account.creditorName} on ${account.cra} does not have a dispute notation despite a dispute being sent ${daysSinceSent} days ago. CRAs are required to note that an account is disputed within a reasonable time.`,
          evidence,
          affectedAccounts: [toAffectedAccount(account)],
          defendants: [account.cra, account.creditorName],
          caselaw: [...CASELAW_FURNISHER],
          estimatedDamagesMin: 5000,
          estimatedDamagesMax: 50000,
        });
      }
    }
  }

  return violations;
}

// =============================================================================
// FCRA RULE 7: Duplicate Tradelines - 15 U.S.C. section 1681e(b)
// =============================================================================

export function detectDuplicateTradelines(
  input: LitigationScanInput
): LitigationViolation[] {
  const violations: LitigationViolation[] = [];

  // Group accounts by CRA to check within the same bureau
  const byBureau = new Map<string, ScanAccount[]>();
  for (const account of input.accounts) {
    const existing = byBureau.get(account.cra) || [];
    existing.push(account);
    byBureau.set(account.cra, existing);
  }

  for (const [cra, accounts] of byBureau) {
    const checked = new Set<string>();

    for (let i = 0; i < accounts.length; i++) {
      for (let j = i + 1; j < accounts.length; j++) {
        const a = accounts[i];
        const b = accounts[j];

        // Must have different account IDs
        if (a.id === b.id) continue;

        const pairKey = [a.id, b.id].sort().join("_");
        if (checked.has(pairKey)) continue;
        checked.add(pairKey);

        // Compare normalized creditor names
        const normA = normalizeCreditorName(a.creditorName);
        const normB = normalizeCreditorName(b.creditorName);

        if (normA !== normB || !normA) continue;

        // Compare balances (within 10%)
        if (a.balance == null || b.balance == null) continue;
        if (a.balance === 0 && b.balance === 0) continue;

        const maxBal = Math.max(a.balance, b.balance);
        const minBal = Math.min(a.balance, b.balance);
        const balanceDiff = maxBal - minBal;
        const avgBal = (maxBal + minBal) / 2;

        if (avgBal > 0 && balanceDiff / avgBal > 0.1) continue;

        const evidence: ViolationEvidence[] = [
          {
            type: "ACCOUNT_DATA",
            description: `Two tradelines for "${a.creditorName}" appear on ${cra} with similar balances (${formatCents(a.balance)} and ${formatCents(b.balance)}). This may be a duplicate entry inflating total debt.`,
            bureauData: {
              account1_id: a.id,
              account1_balance: a.balance,
              account1_status: a.accountStatus,
              account2_id: b.id,
              account2_balance: b.balance,
              account2_status: b.accountStatus,
            },
          },
        ];

        violations.push({
          id: generateId(),
          ruleId: "DUPLICATE_TRADELINES",
          category: "FCRA",
          severity: "HIGH",
          statute: "15 U.S.C. \u00A7 1681e(b)",
          statuteShortName: "FCRA \u00A7 1681e(b)",
          title: "Duplicate Tradelines on Same Bureau",
          description: `Two tradelines for ${a.creditorName} are reported on ${cra} with similar balances (${formatCents(a.balance)} and ${formatCents(b.balance)}). Duplicate entries artificially inflate total debt and damage the consumer's credit profile.`,
          evidence,
          affectedAccounts: [toAffectedAccount(a), toAffectedAccount(b)],
          defendants: [cra, a.creditorName],
          caselaw: [...CASELAW_INACCURACY, ...CASELAW_WILLFULNESS],
          estimatedDamagesMin: 10000,
          estimatedDamagesMax: 150000,
        });
      }
    }
  }

  return violations;
}

// =============================================================================
// FCRA RULE 8: Wrong Creditor Reporting - 15 U.S.C. section 1681s-2(a)
// =============================================================================

export function detectWrongCreditorReporting(
  input: LitigationScanInput
): LitigationViolation[] {
  const violations: LitigationViolation[] = [];

  const collectionAccounts = input.accounts.filter(isCollectionAccount);
  const regularAccounts = input.accounts.filter((a) => !isCollectionAccount(a));

  for (const collection of collectionAccounts) {
    const collNorm = normalizeCreditorName(collection.creditorName);

    for (const original of regularAccounts) {
      const origNorm = normalizeCreditorName(original.creditorName);

      // Check if collection creditor name matches an original account creditor
      if (collNorm !== origNorm || !collNorm) continue;

      // Check for similar balance range (collection within 150% of original)
      if (collection.balance != null && original.balance != null) {
        const bothPositive =
          collection.balance > 0 && original.balance > 0;
        if (bothPositive) {
          const ratio = collection.balance / original.balance;
          if (ratio > 1.5 || ratio < 0.5) continue;
        }
      }

      // Both original and collection report on the same debt
      const evidence: ViolationEvidence[] = [
        {
          type: "ACCOUNT_DATA",
          description: `Both original creditor account (${original.creditorName} on ${original.cra}, status: ${original.accountStatus}, balance: ${formatCents(original.balance)}) and collection account (${collection.creditorName} on ${collection.cra}, status: ${collection.accountStatus}, balance: ${formatCents(collection.balance)}) appear to report on the same debt. Only one entity should report at a time.`,
          bureauData: {
            original_cra: original.cra,
            original_status: original.accountStatus,
            original_balance: original.balance,
            collection_cra: collection.cra,
            collection_status: collection.accountStatus,
            collection_balance: collection.balance,
          },
        },
      ];

      violations.push({
        id: generateId(),
        ruleId: "WRONG_CREDITOR_REPORTING",
        category: "FCRA",
        severity: "HIGH",
        statute: "15 U.S.C. \u00A7 1681s-2(a)",
        statuteShortName: "FCRA \u00A7 1681s-2(a)",
        title: "Dual Reporting by Original Creditor and Collector",
        description: `Both the original creditor (${original.creditorName}, ${original.cra}) and a collection account (${collection.creditorName}, ${collection.cra}) are reporting on what appears to be the same debt. This double-reporting inflates the consumer's total reported debt.`,
        evidence,
        affectedAccounts: [
          toAffectedAccount(original),
          toAffectedAccount(collection),
        ],
        defendants: [
          ...new Set([
            original.cra,
            collection.cra,
            original.creditorName,
            collection.creditorName,
          ]),
        ],
        caselaw: [...CASELAW_FURNISHER, ...CASELAW_INACCURACY],
        estimatedDamagesMin: 10000,
        estimatedDamagesMax: 150000,
      });
    }
  }

  return violations;
}

// =============================================================================
// FCRA RULE 9: Incorrect Credit Limit - 15 U.S.C. section 1681e(b)
// =============================================================================

export function detectIncorrectCreditLimit(
  input: LitigationScanInput
): LitigationViolation[] {
  const violations: LitigationViolation[] = [];

  for (const account of input.accounts) {
    const type = (account.accountType || "").toUpperCase();
    const isRevolving =
      type.includes("REVOLVING") || type.includes("CREDIT_CARD");

    if (!isRevolving) continue;
    if (account.balance == null || account.balance <= 0) continue;

    const missingLimit =
      account.creditLimit == null || account.creditLimit === 0;
    const hasHighBalance =
      account.highBalance != null && account.highBalance > 0;

    if (missingLimit && hasHighBalance) {
      const evidence: ViolationEvidence[] = [
        {
          type: "ACCOUNT_DATA",
          description: `Revolving account for ${account.creditorName} on ${account.cra} reports a balance of ${formatCents(account.balance)} and high balance of ${formatCents(account.highBalance)} but has no credit limit (${account.creditLimit == null ? "missing" : "$0.00"}). This causes credit scoring models to assume 100% utilization, severely damaging the consumer's score.`,
          bureauData: {
            balance: account.balance,
            creditLimit: account.creditLimit,
            highBalance: account.highBalance,
            accountType: account.accountType,
          },
        },
      ];

      violations.push({
        id: generateId(),
        ruleId: "INCORRECT_CREDIT_LIMIT",
        category: "FCRA",
        severity: "MEDIUM",
        statute: "15 U.S.C. \u00A7 1681e(b)",
        statuteShortName: "FCRA \u00A7 1681e(b)",
        title: "Missing Credit Limit on Revolving Account",
        description: `The revolving account for ${account.creditorName} on ${account.cra} has a balance of ${formatCents(account.balance)} but no credit limit is reported. This causes credit utilization to appear at 100%, significantly damaging the consumer's credit score.`,
        evidence,
        affectedAccounts: [toAffectedAccount(account)],
        defendants: [account.cra, account.creditorName],
        caselaw: [...CASELAW_INACCURACY],
        estimatedDamagesMin: 5000,
        estimatedDamagesMax: 75000,
      });
    }
  }

  return violations;
}

// =============================================================================
// FCRA RULE 10: Failure to Investigate - 15 U.S.C. section 1681s-2(b)
// =============================================================================

export function detectFailureToInvestigate(
  input: LitigationScanInput
): LitigationViolation[] {
  const violations: LitigationViolation[] = [];
  const now = new Date();

  for (const dispute of input.disputes) {
    if (!dispute.sentDate) continue;
    if (dispute.status !== "SENT") continue;

    const sentDate = new Date(dispute.sentDate);
    const daysSinceSent = daysBetween(now, sentDate);

    // FCRA requires investigation within 30 days
    if (daysSinceSent <= 30) continue;
    if (dispute.respondedAt != null) continue;

    // Find affected accounts from dispute items
    const affectedAccounts: AffectedAccount[] = [];
    const defendants: string[] = [dispute.cra];

    for (const item of dispute.items) {
      const account = input.accounts.find(
        (a) => a.id === item.accountItemId
      );
      if (account) {
        affectedAccounts.push(toAffectedAccount(account));
        defendants.push(account.creditorName);
      }
    }

    if (affectedAccounts.length === 0) continue;

    const evidence: ViolationEvidence[] = [
      {
        type: "DISPUTE_HISTORY",
        description: `Dispute (ID: ${dispute.id}) was sent to ${dispute.cra} on ${sentDate.toISOString().split("T")[0]}, ${daysSinceSent} days ago, with no response received. The FCRA requires CRAs to complete their investigation within 30 days.`,
        bureauData: {
          disputeId: dispute.id,
          cra: dispute.cra,
          sentDate: sentDate.toISOString().split("T")[0],
          daysSinceSent,
          respondedAt: null,
          status: dispute.status,
        },
      },
    ];

    violations.push({
      id: generateId(),
      ruleId: "FAILURE_TO_INVESTIGATE",
      category: "FCRA",
      severity: "HIGH",
      statute: "15 U.S.C. \u00A7 1681s-2(b)",
      statuteShortName: "FCRA \u00A7 1681s-2(b)",
      title: "Failure to Investigate Dispute Within 30 Days",
      description: `A dispute sent to ${dispute.cra} on ${sentDate.toISOString().split("T")[0]} has gone ${daysSinceSent} days without a response. FCRA requires CRAs to conduct a reasonable investigation and respond within 30 days. This failure to investigate is a per-se violation.`,
      evidence,
      affectedAccounts,
      defendants: [...new Set(defendants)],
      caselaw: [...CASELAW_INVESTIGATION, ...CASELAW_WILLFULNESS],
      estimatedDamagesMin: 50000,
      estimatedDamagesMax: 200000,
    });
  }

  return violations;
}

// =============================================================================
// FDCPA RULE 11: Collecting on Paid Debt - 15 U.S.C. section 1692e
// =============================================================================

export function detectCollectingOnPaidDebt(
  input: LitigationScanInput
): LitigationViolation[] {
  const violations: LitigationViolation[] = [];

  const collectionAccounts = input.accounts.filter(isCollectionAccount);
  const otherAccounts = input.accounts.filter((a) => !isCollectionAccount(a));

  for (const collection of collectionAccounts) {
    const collNorm = normalizeCreditorName(collection.creditorName);

    for (const original of otherAccounts) {
      const origNorm = normalizeCreditorName(original.creditorName);

      // Match by normalized name or fingerprint
      const nameMatch = collNorm === origNorm && !!collNorm;
      const fpMatch = collection.fingerprint === original.fingerprint;
      if (!nameMatch && !fpMatch) continue;

      // Check if original is paid/settled
      const origStatus = (original.accountStatus || "").toUpperCase();
      const isPaidOrSettled =
        origStatus.includes("PAID") || origStatus.includes("SETTLED");

      if (!isPaidOrSettled) continue;

      // Collection is still active
      const collStatus = (collection.accountStatus || "").toUpperCase();
      const collectionActive =
        collStatus.includes("COLLECTION") ||
        collStatus.includes("OPEN") ||
        collStatus.includes("ACTIVE");

      if (!collectionActive) continue;

      const evidence: ViolationEvidence[] = [
        {
          type: "STATUS_CONTRADICTION",
          description: `Original account (${original.creditorName} on ${original.cra}) shows status "${original.accountStatus}" (paid/settled), but a collection account (${collection.creditorName} on ${collection.cra}) still reports as active with status "${collection.accountStatus}" and balance ${formatCents(collection.balance)}. Collecting on a paid debt is a deceptive practice.`,
          bureauData: {
            original_cra: original.cra,
            original_status: original.accountStatus,
            original_balance: original.balance,
            collection_cra: collection.cra,
            collection_status: collection.accountStatus,
            collection_balance: collection.balance,
          },
        },
      ];

      violations.push({
        id: generateId(),
        ruleId: "COLLECTING_ON_PAID_DEBT",
        category: "FDCPA",
        severity: "CRITICAL",
        statute: "15 U.S.C. \u00A7 1692e",
        statuteShortName: "FDCPA \u00A7 1692e",
        title: "Collecting on Paid or Settled Debt",
        description: `A collection account for ${collection.creditorName} on ${collection.cra} (balance: ${formatCents(collection.balance)}) remains active despite the original account showing as "${original.accountStatus}" on ${original.cra}. Attempting to collect on a debt that has already been paid or settled is a deceptive and misleading practice under the FDCPA.`,
        evidence,
        affectedAccounts: [
          toAffectedAccount(original),
          toAffectedAccount(collection),
        ],
        defendants: [
          ...new Set([
            collection.creditorName,
            collection.cra,
            original.cra,
          ]),
        ],
        caselaw: [...CASELAW_FDCPA],
        estimatedDamagesMin: 100000,
        estimatedDamagesMax: 400000,
      });
    }
  }

  return violations;
}

// =============================================================================
// FDCPA RULE 12: Wrong Debt Amount - 15 U.S.C. section 1692e(2)(A)
// =============================================================================

export function detectWrongDebtAmount(
  input: LitigationScanInput
): LitigationViolation[] {
  const violations: LitigationViolation[] = [];

  const collectionAccounts = input.accounts.filter(isCollectionAccount);
  const otherAccounts = input.accounts.filter((a) => !isCollectionAccount(a));

  for (const collection of collectionAccounts) {
    if (collection.balance == null || collection.balance <= 0) continue;

    const collNorm = normalizeCreditorName(collection.creditorName);

    for (const original of otherAccounts) {
      const origNorm = normalizeCreditorName(original.creditorName);

      // Match by fingerprint or name
      const nameMatch = collNorm === origNorm && !!collNorm;
      const fpMatch = collection.fingerprint === original.fingerprint;
      if (!nameMatch && !fpMatch) continue;

      if (original.balance == null || original.balance <= 0) continue;

      // Flag if collection balance > original + 25%
      const threshold = original.balance * 1.25;
      if (collection.balance > threshold) {
        const excessAmount = collection.balance - original.balance;
        const percentOver = ((excessAmount / original.balance) * 100).toFixed(1);

        const evidence: ViolationEvidence[] = [
          {
            type: "ACCOUNT_DATA",
            description: `Collection account (${collection.creditorName} on ${collection.cra}) reports balance of ${formatCents(collection.balance)}, which is ${percentOver}% more than the original account balance of ${formatCents(original.balance)} (${original.creditorName} on ${original.cra}). Even accounting for reasonable fees, this ${formatCents(excessAmount)} excess suggests an inflated or incorrect debt amount.`,
            bureauData: {
              original_balance: original.balance,
              collection_balance: collection.balance,
              difference: excessAmount,
              percentOver: parseFloat(percentOver),
              original_cra: original.cra,
              collection_cra: collection.cra,
            },
          },
        ];

        violations.push({
          id: generateId(),
          ruleId: "WRONG_DEBT_AMOUNT",
          category: "FDCPA",
          severity: "HIGH",
          statute: "15 U.S.C. \u00A7 1692e(2)(A)",
          statuteShortName: "FDCPA \u00A7 1692e(2)(A)",
          title: "Inflated Collection Debt Amount",
          description: `The collection account for ${collection.creditorName} on ${collection.cra} reports a balance of ${formatCents(collection.balance)}, which exceeds the original account balance of ${formatCents(original.balance)} by ${percentOver}%. Misrepresenting the amount of a debt violates the FDCPA.`,
          evidence,
          affectedAccounts: [
            toAffectedAccount(original),
            toAffectedAccount(collection),
          ],
          defendants: [
            ...new Set([
              collection.creditorName,
              collection.cra,
              original.creditorName,
            ]),
          ],
          caselaw: [...CASELAW_FDCPA],
          estimatedDamagesMin: 50000,
          estimatedDamagesMax: 200000,
        });
      }
    }
  }

  return violations;
}

// =============================================================================
// FDCPA RULE 13: Time-Barred Collection - 15 U.S.C. section 1692e(5)
// =============================================================================

export function detectTimeBarredCollection(
  input: LitigationScanInput
): LitigationViolation[] {
  const violations: LitigationViolation[] = [];

  if (!input.clientState) return violations;

  const stateSOL = STATE_SOL_MAP[input.clientState.toUpperCase()];
  if (!stateSOL) return violations;

  const now = new Date();
  const collectionAccounts = input.accounts.filter(isCollectionAccount);

  for (const account of collectionAccounts) {
    const activityDate = account.lastActivityDate
      ? new Date(account.lastActivityDate)
      : account.dateOpened
        ? new Date(account.dateOpened)
        : null;

    if (!activityDate) continue;

    // Use writtenContractYears as default SOL
    const solYears = stateSOL.writtenContractYears;
    const solExpiryDate = new Date(activityDate);
    solExpiryDate.setFullYear(solExpiryDate.getFullYear() + solYears);

    if (solExpiryDate < now) {
      const yearsExpired = yearsBetween(now, solExpiryDate);

      const evidence: ViolationEvidence[] = [
        {
          type: "DATE_COMPARISON",
          description: `Collection account for ${account.creditorName} on ${account.cra} has last activity date of ${activityDate.toISOString().split("T")[0]}. The statute of limitations for ${stateSOL.state} (${solYears} years for written contracts) expired on ${solExpiryDate.toISOString().split("T")[0]}, approximately ${yearsExpired.toFixed(1)} years ago. This debt is time-barred.`,
          bureauData: {
            lastActivityDate: activityDate.toISOString().split("T")[0],
            state: stateSOL.state,
            solYears,
            solExpiryDate: solExpiryDate.toISOString().split("T")[0],
            yearsExpired: parseFloat(yearsExpired.toFixed(1)),
            balance: account.balance,
          },
        },
      ];

      violations.push({
        id: generateId(),
        ruleId: "TIME_BARRED_COLLECTION",
        category: "FDCPA",
        severity: "CRITICAL",
        statute: "15 U.S.C. \u00A7 1692e(5)",
        statuteShortName: "FDCPA \u00A7 1692e(5)",
        title: "Collection on Time-Barred Debt",
        description: `The collection account for ${account.creditorName} on ${account.cra} (balance: ${formatCents(account.balance)}) is based on a debt that exceeded the ${stateSOL.state} statute of limitations (${solYears} years) approximately ${yearsExpired.toFixed(1)} years ago. Attempting to collect on a time-barred debt is a deceptive practice under the FDCPA.`,
        evidence,
        affectedAccounts: [toAffectedAccount(account)],
        defendants: [account.creditorName, account.cra],
        caselaw: [...CASELAW_FDCPA],
        estimatedDamagesMin: 100000,
        estimatedDamagesMax: 400000,
      });
    }
  }

  return violations;
}

// =============================================================================
// FDCPA RULE 14: Multiple Collectors Same Debt - 15 U.S.C. section 1692e
// =============================================================================

export function detectMultipleCollectorsSameDebt(
  input: LitigationScanInput
): LitigationViolation[] {
  const violations: LitigationViolation[] = [];

  const collectionAccounts = input.accounts.filter(isCollectionAccount);
  if (collectionAccounts.length < 2) return violations;

  // Group collection accounts by normalized creditor name + similar balance
  const collectorGroups = new Map<
    string,
    ScanAccount[]
  >();

  for (const account of collectionAccounts) {
    const normName = normalizeCreditorName(account.creditorName);
    if (!normName) continue;

    let placed = false;
    for (const [key, group] of collectorGroups) {
      const keyName = key.split("|||")[0];
      if (keyName !== normName) continue;

      // Check if balance is similar to others in the group
      const balanceMatch = group.some((existing) => {
        if (existing.balance == null || account.balance == null) return true;
        if (existing.balance === 0 && account.balance === 0) return true;
        const avg = (existing.balance + account.balance) / 2;
        if (avg === 0) return true;
        return Math.abs(existing.balance - account.balance) / avg <= 0.25;
      });

      if (balanceMatch) {
        group.push(account);
        placed = true;
        break;
      }
    }

    if (!placed) {
      const key = `${normName}|||${account.balance ?? 0}`;
      collectorGroups.set(key, [account]);
    }
  }

  for (const [, group] of collectorGroups) {
    if (group.length < 2) continue;

    // Check that there are actually different collection agencies
    const uniqueCreditors = new Set(
      group.map((a) => normalizeCreditorName(a.creditorName))
    );

    // If all have the same normalized name, check for different CRAs or IDs indicating separate collectors
    // In practice, different collection agencies for the same original debt
    const uniqueCRAs = new Set(group.map((a) => a.cra));
    if (uniqueCreditors.size < 2 && uniqueCRAs.size < 2) continue;

    const evidence: ViolationEvidence[] = [
      {
        type: "ACCOUNT_DATA",
        description: `Multiple collection entries found for the same underlying debt: ${group
          .map(
            (a) =>
              `${a.creditorName} on ${a.cra} (balance: ${formatCents(a.balance)}, status: ${a.accountStatus})`
          )
          .join("; ")}. Multiple collectors reporting on the same debt inflates the consumer's reported debt obligations.`,
        bureauData: Object.fromEntries(
          group.map((a, i) => [
            `collector_${i + 1}`,
            `${a.creditorName} (${a.cra}): ${formatCents(a.balance)}`,
          ])
        ),
      },
    ];

    violations.push({
      id: generateId(),
      ruleId: "MULTIPLE_COLLECTORS_SAME_DEBT",
      category: "FDCPA",
      severity: "HIGH",
      statute: "15 U.S.C. \u00A7 1692e",
      statuteShortName: "FDCPA \u00A7 1692e",
      title: "Multiple Collectors Reporting Same Debt",
      description: `${group.length} collection entries appear to reference the same underlying debt: ${group.map((a) => a.creditorName).join(", ")}. Having multiple collectors report on the same debt is misleading and inflates the consumer's total reported debt obligations.`,
      evidence,
      affectedAccounts: group.map(toAffectedAccount),
      defendants: [
        ...new Set(group.flatMap((a) => [a.creditorName, a.cra])),
      ],
      caselaw: [...CASELAW_FDCPA],
      estimatedDamagesMin: 50000,
      estimatedDamagesMax: 200000,
    });
  }

  return violations;
}

// =============================================================================
// METRO 2 RULE 15: Metro 2 Format Errors
// =============================================================================

export function detectMetro2Errors(
  input: LitigationScanInput
): LitigationViolation[] {
  const violations: LitigationViolation[] = [];

  for (const account of input.accounts) {
    const errors: string[] = [];

    // Check: accountType null/empty but has balance
    if (
      (!account.accountType || account.accountType.trim() === "") &&
      account.balance != null &&
      account.balance > 0
    ) {
      errors.push(
        `Missing account type code on account with balance of ${formatCents(account.balance)}`
      );
    }

    // Check: accountStatus contradicts balance
    const status = (account.accountStatus || "").toUpperCase();
    if (status.includes("PAID") && account.balance != null && account.balance > 0) {
      errors.push(
        `Status is "${account.accountStatus}" but balance is ${formatCents(account.balance)} (should be $0.00)`
      );
    }
    if (
      status.includes("CLOSED") &&
      account.balance != null &&
      account.highBalance != null &&
      account.balance > account.highBalance
    ) {
      errors.push(
        `Status is "${account.accountStatus}" but current balance (${formatCents(account.balance)}) exceeds high balance (${formatCents(account.highBalance)}), suggesting increasing balance on a closed account`
      );
    }

    // Check: dateOpened after dateReported (impossible chronology)
    if (account.dateOpened && account.dateReported) {
      const opened = new Date(account.dateOpened);
      const reported = new Date(account.dateReported);
      if (opened > reported) {
        errors.push(
          `Date opened (${opened.toISOString().split("T")[0]}) is after date reported (${reported.toISOString().split("T")[0]}), which is chronologically impossible`
        );
      }
    }

    // Check: missing dateOpened on accounts > $0
    if (
      !account.dateOpened &&
      account.balance != null &&
      account.balance > 0
    ) {
      errors.push(
        `Missing date opened on account with balance of ${formatCents(account.balance)}`
      );
    }

    if (errors.length === 0) continue;

    const severity: ViolationSeverity = errors.length > 1 ? "HIGH" : "MEDIUM";

    const evidence: ViolationEvidence[] = [
      {
        type: "ACCOUNT_DATA",
        description: `Metro 2 format error(s) detected on ${account.creditorName} (${account.cra}): ${errors.join("; ")}.`,
        bureauData: {
          accountType: account.accountType,
          accountStatus: account.accountStatus,
          balance: account.balance,
          creditLimit: account.creditLimit,
          highBalance: account.highBalance,
          dateOpened: account.dateOpened
            ? new Date(account.dateOpened).toISOString().split("T")[0]
            : null,
          dateReported: account.dateReported
            ? new Date(account.dateReported).toISOString().split("T")[0]
            : null,
          errorCount: errors.length,
        },
      },
    ];

    violations.push({
      id: generateId(),
      ruleId: "METRO2_ERRORS",
      category: "METRO2",
      severity,
      statute: "Metro 2 Format",
      statuteShortName: "Metro 2 Format",
      title: "Metro 2 Data Format Errors",
      description: `The account for ${account.creditorName} on ${account.cra} contains ${errors.length} Metro 2 format error(s): ${errors.join(". ")}. These formatting errors indicate the furnisher is not following industry-standard reporting guidelines.`,
      evidence,
      affectedAccounts: [toAffectedAccount(account)],
      defendants: [account.cra, account.creditorName],
      caselaw: [...CASELAW_INACCURACY],
      estimatedDamagesMin: 5000,
      estimatedDamagesMax: errors.length > 1 ? 100000 : 50000,
    });
  }

  return violations;
}

// =============================================================================
// MAIN EXPORT: Run All Violation Rules
// =============================================================================

export function runAllViolationRules(
  input: LitigationScanInput
): LitigationViolation[] {
  const allViolations: LitigationViolation[] = [];

  const rules = [
    detectIncorrectBalance,
    detectWrongAccountStatus,
    detectIncorrectPaymentHistory,
    detectReAgedDebt,
    detectObsoleteInformation,
    detectMissingDisputeNotation,
    detectDuplicateTradelines,
    detectWrongCreditorReporting,
    detectIncorrectCreditLimit,
    detectFailureToInvestigate,
    detectCollectingOnPaidDebt,
    detectWrongDebtAmount,
    detectTimeBarredCollection,
    detectMultipleCollectorsSameDebt,
    detectMetro2Errors,
  ];

  for (const rule of rules) {
    try {
      const violations = rule(input);
      allViolations.push(...violations);
    } catch (error) {
      console.warn(`Rule ${rule.name} failed:`, error);
    }
  }

  // Sort by severity: CRITICAL > HIGH > MEDIUM > LOW
  const severityOrder: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };
  allViolations.sort(
    (a, b) =>
      (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4)
  );

  return allViolations;
}
