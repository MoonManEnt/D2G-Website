import type { ClientEvaluationContext } from "./types";

/**
 * Build a ClientEvaluationContext from raw database data.
 *
 * Takes Prisma query results and computes all derived metrics
 * needed for vendor rule evaluation.
 */
export function buildClientContext(params: {
  client: { stage: string; statedIncome?: number | null };
  accounts: Array<{
    accountType: string | null;
    accountStatus: string;
    balance: number | null;
    creditLimit: number | null;
  }>;
  creditScores: Array<{ cra: string; score: number; scoreType: string }>;
  dna?: { classification: string; healthScore: number; improvementPotential: number } | null;
  inquiryCount?: number;
  readinessProductType?: string;
  approvalLikelihood?: number;
}): ClientEvaluationContext {
  const { client, accounts, creditScores, dna, inquiryCount, readinessProductType, approvalLikelihood } = params;

  // Credit score calculations
  const scores = creditScores.map((s) => s.score);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const minScore = scores.length > 0 ? Math.min(...scores) : 0;
  const maxScore = scores.length > 0 ? Math.max(...scores) : 0;

  // Collection metrics
  const collectionAccounts = accounts.filter((a) => a.accountStatus === "COLLECTION");
  const collectionCount = collectionAccounts.length;
  const collectionBalance = collectionAccounts.reduce(
    (sum, a) => sum + (a.balance != null && a.balance > 0 ? a.balance : 0),
    0
  );

  // Charge-off metrics
  const chargeOffCount = accounts.filter((a) => a.accountStatus === "CHARGED_OFF").length;

  // Total debt: sum of all positive balances
  const totalDebt = accounts.reduce(
    (sum, a) => sum + (a.balance != null && a.balance > 0 ? a.balance : 0),
    0
  );

  // Utilization: sum(balances) / sum(creditLimits) for accounts that have both
  const accountsWithBoth = accounts.filter(
    (a) => a.balance != null && a.creditLimit != null && a.creditLimit > 0
  );
  const totalBalance = accountsWithBoth.reduce((sum, a) => sum + (a.balance ?? 0), 0);
  const totalLimit = accountsWithBoth.reduce((sum, a) => sum + (a.creditLimit ?? 0), 0);
  const utilization = totalLimit > 0 ? (totalBalance / totalLimit) * 100 : 0;

  return {
    creditScores,
    avgScore,
    minScore,
    maxScore,
    accounts,
    collectionCount,
    collectionBalance,
    chargeOffCount,
    totalDebt,
    utilization,
    accountCount: accounts.length,
    disputeStage: client.stage,
    dnaClassification: dna?.classification,
    healthScore: dna?.healthScore,
    improvementPotential: dna?.improvementPotential,
    statedIncome: client.statedIncome ?? undefined,
    hasIncome: client.statedIncome != null && client.statedIncome > 0,
    inquiryCount: inquiryCount ?? 0,
    readinessProductType,
    approvalLikelihood,
  };
}
