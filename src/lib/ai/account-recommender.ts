/**
 * Account Recommender - Smart Account Selection Intelligence
 *
 * Recommends which accounts to dispute next based on:
 * - Outcome pattern success rates for creditor/CRA/flow combos
 * - Account balance (higher balance = higher score impact)
 * - Account age vs 7-year reporting limit
 * - Previous dispute attempts (diminishing returns after 3+ rounds)
 * - Credit DNA readiness data (Phase 7 integration)
 */

import prisma from "@/lib/prisma";

export interface AccountRecommendation {
  accountId: string;
  creditorName: string;
  accountNumber?: string;
  balance?: number;
  score: number; // 0-100 composite score
  reasoning: string;
  recommendedFlow: "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO";
  recommendedCRA: "TRANSUNION" | "EXPERIAN" | "EQUIFAX";
  estimatedSuccessRate?: number;
  scoreImpact?: number; // Estimated score points improvement
  factors: {
    patternScore: number;
    balanceScore: number;
    ageScore: number;
    attemptPenalty: number;
    creditDNABoost: number;
  };
}

export async function recommendAccounts(
  clientId: string,
  orgId: string
): Promise<AccountRecommendation[]> {
  // 1. Fetch client accounts
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId: orgId },
    include: {
      accounts: {
        // Only accounts that haven't been fully resolved
        orderBy: { createdAt: "desc" },
      },
      disputes: {
        select: {
          id: true,
          cra: true,
          flow: true,
          round: true,
          status: true,
          items: {
            select: {
              accountItemId: true,
              outcome: true,
            },
          },
        },
      },
    },
  });

  if (!client) return [];

  // 2. Fetch outcome patterns for this org
  const patterns = await prisma.ameliaOutcomePattern.findMany({
    where: {
      organizationId: orgId,
      isReliable: true,
    },
  });

  // Build pattern lookup: key = `${creditor}|${cra}|${flow}`
  const patternLookup = new Map<
    string,
    { successRate: number; sampleSize: number }
  >();
  for (const p of patterns) {
    const key = `${(p.creditorName || "").toLowerCase()}|${p.cra}|${p.flow}`;
    patternLookup.set(key, {
      successRate: p.successRate,
      sampleSize: p.sampleSize,
    });
  }

  // Phase 7: Load credit readiness data for score impact calculation
  let creditReadiness: {
    relevantScore?: number;
    approvalLikelihood?: number;
    estimatedDTI?: number;
  } | null = null;
  try {
    const assessment = await prisma.creditReadinessAnalysis.findFirst({
      where: { clientId },
      orderBy: { createdAt: "desc" },
    });
    if (assessment) {
      creditReadiness = {
        relevantScore: assessment.relevantScore ?? undefined,
        approvalLikelihood: assessment.approvalLikelihood,
        estimatedDTI: assessment.estimatedDTI ?? undefined,
      };
    }
  } catch {
    // CreditReadinessAnalysis may not exist yet
  }

  // 3. Score each account
  const recommendations: AccountRecommendation[] = [];

  for (const account of client.accounts) {
    // Count previous dispute attempts for this account
    const previousAttempts = client.disputes.filter((d) =>
      d.items.some((item) => item.accountItemId === account.id)
    );
    const attemptCount = previousAttempts.length;

    // Skip accounts that have been deleted
    const lastOutcome = previousAttempts
      .flatMap((d) => d.items.filter((i) => i.accountItemId === account.id))
      .sort()
      .pop()?.outcome;
    if (lastOutcome === "DELETED") continue;

    // Determine issues
    let issues: string[] = [];
    try {
      issues = account.detectedIssues
        ? JSON.parse(account.detectedIssues)
        : [];
    } catch {
      issues = [];
    }

    // Skip accounts with no detected issues
    if (
      issues.length === 0 &&
      !account.paymentStatus?.toLowerCase().includes("late") &&
      account.accountType !== "COLLECTION"
    )
      continue;

    // Determine best flow for this account
    const recommendedFlow = determineFlow(account);

    // Check pattern success rates across all 3 CRAs
    const craOptions: ("TRANSUNION" | "EXPERIAN" | "EQUIFAX")[] = [
      "TRANSUNION",
      "EXPERIAN",
      "EQUIFAX",
    ];
    let bestCRA: "TRANSUNION" | "EXPERIAN" | "EQUIFAX" = "TRANSUNION";
    let bestPatternScore = 0;
    let bestSuccessRate: number | undefined;

    for (const cra of craOptions) {
      const key = `${account.creditorName.toLowerCase()}|${cra}|${recommendedFlow}`;
      const genericKey = `|${cra}|${recommendedFlow}`;
      const pattern =
        patternLookup.get(key) || patternLookup.get(genericKey);

      if (pattern && pattern.successRate > bestPatternScore) {
        bestPatternScore = pattern.successRate;
        bestCRA = cra;
        bestSuccessRate = pattern.successRate;
      }
    }

    // Scoring factors (0-100 each)
    const patternScore = bestPatternScore > 0 ? bestPatternScore : 50; // Default 50 if no data
    const balance = account.balance ? account.balance : 0;
    const balanceScore = Math.min(100, (balance / 10000) * 100); // $10K+ = 100

    // Age score: accounts nearing 7-year mark are lower priority
    let ageScore = 80; // Default
    if (account.dateOpened) {
      const ageYears =
        (Date.now() - new Date(account.dateOpened).getTime()) /
        (365.25 * 24 * 60 * 60 * 1000);
      if (ageYears > 6) ageScore = 20; // Close to falling off
      else if (ageYears > 5) ageScore = 50;
      else ageScore = 80;
    }

    // Attempt penalty: diminishing returns after 3+ rounds
    const attemptPenalty = Math.min(50, attemptCount * 15); // 0, 15, 30, 45, 50

    // Credit DNA boost: accounts that most impact target score get higher priority
    let creditDNABoost = 50; // Default neutral
    if (creditReadiness) {
      const currentScore = creditReadiness.relevantScore || 600;
      // Use 700 as baseline target when approval likelihood is low
      const scoreDelta =
        creditReadiness.approvalLikelihood !== undefined &&
        creditReadiness.approvalLikelihood < 50
          ? 700 - currentScore
          : 50;
      // Higher balance derogatories have more score impact
      if (balance > 0 && scoreDelta > 50) creditDNABoost = 80;
      if (account.accountType === "COLLECTION" && scoreDelta > 30)
        creditDNABoost = 90;
      // High DTI — removing accounts reduces debt load
      if (creditReadiness.estimatedDTI && creditReadiness.estimatedDTI > 50)
        creditDNABoost += 10;
      creditDNABoost = Math.min(100, creditDNABoost);
    }

    // Estimate score impact
    let scoreImpact: number | undefined;
    if (creditReadiness && balance > 0) {
      // Rough estimation: removing a derogatory account can improve score by 10-50 points
      // depending on balance, type, and how many other derogatories exist
      const baseImpact = account.accountType === "COLLECTION" ? 25 : 15;
      const balanceFactor = Math.min(2, balance / 5000);
      scoreImpact = Math.round(baseImpact * balanceFactor);
    }

    // Composite score
    const compositeScore = Math.round(
      patternScore * 0.35 +
        balanceScore * 0.25 +
        ageScore * 0.15 +
        creditDNABoost * 0.1 +
        Math.max(0, 100 - attemptPenalty) * 0.15
    );

    // Build reasoning
    const reasons: string[] = [];
    if (bestSuccessRate && bestSuccessRate > 60)
      reasons.push(
        `${bestSuccessRate.toFixed(0)}% historical success rate on ${bestCRA}`
      );
    if (balance > 5000)
      reasons.push(
        `High balance ($${balance.toLocaleString()}) — significant score impact`
      );
    if (attemptCount === 0)
      reasons.push("Never disputed before — fresh attempt");
    if (attemptCount >= 3)
      reasons.push(
        `${attemptCount} previous attempts — consider switching strategy`
      );
    if (issues.length > 2)
      reasons.push(`${issues.length} detected issues — strong dispute case`);
    if (scoreImpact && scoreImpact > 20)
      reasons.push(
        `Estimated +${scoreImpact} point score improvement if removed`
      );

    recommendations.push({
      accountId: account.id,
      creditorName: account.creditorName,
      accountNumber: account.maskedAccountId || undefined,
      balance: balance || undefined,
      score: compositeScore,
      reasoning: reasons.join(". ") || "Standard dispute candidate",
      recommendedFlow,
      recommendedCRA: bestCRA,
      estimatedSuccessRate: bestSuccessRate,
      scoreImpact,
      factors: {
        patternScore,
        balanceScore,
        ageScore,
        attemptPenalty,
        creditDNABoost,
      },
    });
  }

  // Sort by composite score descending
  recommendations.sort((a, b) => b.score - a.score);

  return recommendations;
}

function determineFlow(account: {
  accountType?: string | null;
  paymentStatus?: string | null;
  suggestedFlow?: string | null;
}): "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO" {
  // Use the AI-suggested flow if available
  if (account.suggestedFlow) {
    const sf = account.suggestedFlow.toUpperCase();
    if (sf === "ACCURACY" || sf === "COLLECTION" || sf === "CONSENT" || sf === "COMBO")
      return sf as "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO";
  }

  const type = (account.accountType || "").toLowerCase();
  const status = (account.paymentStatus || "").toLowerCase();

  if (type === "collection" || type.includes("collect")) return "COLLECTION";
  if (status.includes("late")) return "ACCURACY";
  if (type === "inquiry" || type.includes("inquiry")) return "CONSENT";
  return "ACCURACY";
}
