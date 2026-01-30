/**
 * Amelia Credit Readiness Engine - Score Gap Analyzer
 *
 * Analyzes the gap between a client's current score and their target score
 * for a given product type. Identifies which credit factors are causing
 * the most damage and quantifies the potential gain from addressing each one.
 *
 * Potential gains by factor (based on FICO scoring weight research):
 * - High utilization (>30%):     20-40 points potential gain
 * - Collection accounts:         25-50 points per deletion
 * - Late payments:               Limited improvement; time heals (5-15 pts over time)
 * - Hard inquiries:              5-15 points (fall off after 2 years)
 * - Short credit history:        Limited; needs time (5-10 pts over years)
 * - Poor credit mix:             10-20 points from diversification
 */

import type { ScoreGapAnalysis, ScoreGapFactor, CreditDataInput } from "./types";

// =============================================================================
// SCORE GAP ANALYSIS
// =============================================================================

export function analyzeScoreGap(
  currentScore: number,
  targetScore: number,
  scoreModel: string,
  creditData: CreditDataInput
): ScoreGapAnalysis {
  const gap = targetScore - currentScore;
  const factors: ScoreGapFactor[] = [];

  // Analyze each factor category
  analyzeUtilization(creditData, factors);
  analyzeCollections(creditData, factors);
  analyzeLatePayments(creditData, factors);
  analyzeInquiries(creditData, factors);
  analyzeCreditHistory(creditData, factors);
  analyzeCreditMix(creditData, factors);

  // Sort by potential gain descending (highest impact first)
  factors.sort((a, b) => b.potentialGain - a.potentialGain);

  // Estimate time to target based on gap and factors
  const estimatedTimeToTarget = estimateTimeToTarget(gap, factors);

  return {
    currentScore,
    targetScore,
    gap: Math.max(0, gap),
    scoreModel,
    factors,
    estimatedTimeToTarget,
  };
}

// =============================================================================
// FACTOR ANALYSIS FUNCTIONS
// =============================================================================

function analyzeUtilization(
  creditData: CreditDataInput,
  factors: ScoreGapFactor[]
): void {
  // Calculate overall utilization from accounts
  let totalBalance = 0;
  let totalLimit = 0;
  let highUtilAccounts = 0;

  for (const account of creditData.accounts) {
    if (account.creditLimit && account.creditLimit > 0 && account.balance !== null) {
      totalBalance += account.balance;
      totalLimit += account.creditLimit;
      const util = (account.balance / account.creditLimit) * 100;
      if (util > 30) {
        highUtilAccounts++;
      }
    }
  }

  // Also try to parse utilization from DNA profile if available
  let overallUtil = totalLimit > 0 ? (totalBalance / totalLimit) * 100 : 0;
  if (creditData.dnaProfile?.utilization) {
    try {
      const utilData = JSON.parse(creditData.dnaProfile.utilization);
      if (utilData.overallUtilization !== undefined) {
        overallUtil = utilData.overallUtilization;
      }
    } catch {
      // Use calculated value
    }
  }

  if (overallUtil > 30) {
    let potentialGain: number;
    let impact: string;

    if (overallUtil > 70) {
      potentialGain = 40;
      impact = `Critical: ${overallUtil.toFixed(0)}% utilization is severely damaging your score`;
    } else if (overallUtil > 50) {
      potentialGain = 30;
      impact = `High: ${overallUtil.toFixed(0)}% utilization is significantly hurting your score`;
    } else {
      potentialGain = 20;
      impact = `Moderate: ${overallUtil.toFixed(0)}% utilization is above the optimal 30% threshold`;
    }

    factors.push({
      factor: "High Credit Utilization",
      currentImpact: impact,
      potentialGain,
      action: highUtilAccounts > 1
        ? `Pay down ${highUtilAccounts} accounts to below 30% utilization. Target 10% or less for maximum score improvement.`
        : "Pay down revolving balances to below 30% utilization. Target 10% or less for maximum score improvement.",
    });
  }
}

function analyzeCollections(
  creditData: CreditDataInput,
  factors: ScoreGapFactor[]
): void {
  const collectionAccounts = creditData.accounts.filter(a => {
    const type = (a.accountType || "").toLowerCase();
    const status = a.accountStatus.toLowerCase();
    return (
      type.includes("collection") ||
      status.includes("collection") ||
      status === "collection"
    );
  });

  if (collectionAccounts.length > 0) {
    const totalCollectionBalance = collectionAccounts.reduce(
      (sum, a) => sum + (a.balance || 0),
      0
    );
    const disputableCollections = collectionAccounts.filter(a => a.isDisputable).length;

    // Each deleted collection can improve score by 25-50 points
    // But diminishing returns apply
    const potentialGainPerCollection = collectionAccounts.length <= 2 ? 50 : 35;
    const potentialGain = Math.min(
      100,
      disputableCollections * potentialGainPerCollection
    );

    factors.push({
      factor: "Collection Accounts",
      currentImpact: `${collectionAccounts.length} collection account(s) totaling $${totalCollectionBalance.toLocaleString()} are heavily impacting your score`,
      potentialGain,
      action:
        disputableCollections > 0
          ? `Dispute ${disputableCollections} collection account(s) for removal. Collections are the most damaging items on a credit report. Successful deletion can yield 25-50 points per account.`
          : "Request pay-for-delete agreements from collection agencies, or dispute accuracy of reported amounts and dates.",
    });
  }

  // Check for charge-offs separately
  const chargeOffAccounts = creditData.accounts.filter(a => {
    const status = a.accountStatus.toLowerCase();
    return status.includes("charge") || status === "charged_off";
  });

  if (chargeOffAccounts.length > 0) {
    const disputableChargeOffs = chargeOffAccounts.filter(a => a.isDisputable).length;
    const potentialGain = Math.min(80, disputableChargeOffs * 30);

    factors.push({
      factor: "Charge-Off Accounts",
      currentImpact: `${chargeOffAccounts.length} charge-off(s) are severely damaging your credit profile`,
      potentialGain,
      action:
        disputableChargeOffs > 0
          ? `Dispute ${disputableChargeOffs} charge-off(s) for accuracy. Charge-offs that are inaccurately reported can be removed, yielding significant score improvement.`
          : "Negotiate with original creditors for pay-for-delete or updated status reporting.",
    });
  }
}

function analyzeLatePayments(
  creditData: CreditDataInput,
  factors: ScoreGapFactor[]
): void {
  // Check for late payment patterns from DNA profile
  let latePaymentCount = 0;
  if (creditData.dnaProfile?.derogatoryProfile) {
    try {
      const derogData = JSON.parse(creditData.dnaProfile.derogatoryProfile);
      latePaymentCount =
        (derogData.late30Count || 0) +
        (derogData.late60Count || 0) +
        (derogData.late90Count || 0) +
        (derogData.late120PlusCount || 0);
    } catch {
      // Estimate from accounts with detected issues
      latePaymentCount = creditData.accounts.filter(a => a.issueCount > 0).length;
    }
  } else {
    // Estimate: accounts that are disputable and not collections/charge-offs likely have late payments
    latePaymentCount = creditData.accounts.filter(a => {
      const status = a.accountStatus.toLowerCase();
      return (
        a.isDisputable &&
        !status.includes("collection") &&
        !status.includes("charge")
      );
    }).length;
  }

  if (latePaymentCount > 0) {
    // Late payments have limited immediate improvement - time heals
    // But disputing inaccurate late payments can help
    const potentialGain = Math.min(30, latePaymentCount * 8);

    factors.push({
      factor: "Late Payment History",
      currentImpact: `${latePaymentCount} late payment mark(s) are negatively affecting your payment history (35% of FICO score)`,
      potentialGain,
      action:
        "Dispute any inaccurately reported late payments. For accurate late payments, " +
        "write goodwill letters to creditors requesting removal. The impact of late payments " +
        "diminishes over time - a 30-day late from 3+ years ago has minimal scoring impact.",
    });
  }
}

function analyzeInquiries(
  creditData: CreditDataInput,
  factors: ScoreGapFactor[]
): void {
  const inquiryCount = creditData.inquiryCount ?? 0;

  if (inquiryCount > 3) {
    const potentialGain = Math.min(15, inquiryCount * 3);

    factors.push({
      factor: "Hard Inquiries",
      currentImpact: `${inquiryCount} hard inquiries in the last 24 months are reducing your score by an estimated ${potentialGain} points`,
      potentialGain,
      action:
        inquiryCount > 6
          ? "Dispute any unauthorized hard inquiries. Avoid new credit applications for 6-12 months. " +
            "Hard inquiries stop affecting your score after 12 months and fall off your report after 24 months."
          : "Limit new credit applications. Hard inquiries stop affecting your score after 12 months " +
            "and fall off entirely after 24 months. Dispute any inquiries you did not authorize.",
    });
  }
}

function analyzeCreditHistory(
  creditData: CreditDataInput,
  factors: ScoreGapFactor[]
): void {
  // Assess credit history length from account data
  const now = new Date();
  let oldestAccountAge = 0; // months
  let totalAge = 0;
  let accountsWithDates = 0;

  for (const account of creditData.accounts) {
    if (account.dateOpened) {
      const opened = new Date(account.dateOpened);
      const ageMonths = Math.floor(
        (now.getTime() - opened.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
      );
      if (ageMonths > oldestAccountAge) {
        oldestAccountAge = ageMonths;
      }
      totalAge += ageMonths;
      accountsWithDates++;
    }
  }

  const avgAge = accountsWithDates > 0 ? totalAge / accountsWithDates : 0;
  const isThinFile = creditData.accounts.length < 5;

  if (avgAge < 24 || isThinFile) {
    // Short history - limited improvement, needs time
    const potentialGain = isThinFile ? 15 : 10;

    factors.push({
      factor: "Credit History Length",
      currentImpact: isThinFile
        ? `Thin credit file with only ${creditData.accounts.length} account(s). Limited history reduces scoring potential.`
        : `Average account age of ${Math.round(avgAge)} months is below the ideal 7+ year threshold`,
      potentialGain,
      action: isThinFile
        ? "Build credit history by becoming an authorized user on a seasoned account, " +
          "opening a secured credit card, or applying for a credit builder loan. " +
          "These add positive tradelines that age over time."
        : "Keep existing accounts open - closing old accounts shortens your average age. " +
          "Avoid opening too many new accounts at once, as this lowers your average age.",
    });
  }
}

function analyzeCreditMix(
  creditData: CreditDataInput,
  factors: ScoreGapFactor[]
): void {
  // Assess credit mix diversity
  const types = new Set<string>();
  for (const account of creditData.accounts) {
    const type = (account.accountType || "").toLowerCase();
    if (type.includes("revolving") || type.includes("credit card") || type.includes("charge")) {
      types.add("revolving");
    } else if (type.includes("installment") || type.includes("auto") || type.includes("student")) {
      types.add("installment");
    } else if (type.includes("mortgage") || type.includes("real estate")) {
      types.add("mortgage");
    } else if (type.includes("collection")) {
      // Don't count collections as positive mix
    } else if (type) {
      types.add("other");
    }
  }

  if (types.size < 2) {
    const potentialGain = types.size === 0 ? 20 : 15;

    factors.push({
      factor: "Credit Mix",
      currentImpact:
        types.size === 0
          ? "No diverse account types detected. Credit mix accounts for 10% of your FICO score."
          : `Limited credit mix with only ${types.size} type(s) of credit. Having a diverse mix improves your score.`,
      potentialGain,
      action:
        "Consider diversifying your credit mix. If you only have credit cards, adding a small " +
        "installment loan (like a credit builder loan) can improve this factor. Credit mix " +
        "accounts for approximately 10% of your FICO score.",
    });
  }
}

// =============================================================================
// TIME ESTIMATION
// =============================================================================

/**
 * Estimate realistic time to reach target score based on gap and available actions.
 */
function estimateTimeToTarget(gap: number, factors: ScoreGapFactor[]): string {
  if (gap <= 0) {
    return "You already meet the target score";
  }

  // Sum total potential gains
  const totalPotentialGain = factors.reduce((sum, f) => sum + f.potentialGain, 0);

  // Check if factors include quick-win items (disputes, paydowns)
  const hasDisputableItems = factors.some(
    f =>
      f.factor.includes("Collection") ||
      f.factor.includes("Charge-Off") ||
      f.factor.includes("Late Payment")
  );
  const hasUtilizationIssue = factors.some(f => f.factor.includes("Utilization"));

  if (gap <= 20 && hasUtilizationIssue) {
    return "1-2 months (with balance paydowns)";
  }

  if (gap <= 40 && hasDisputableItems) {
    return "2-4 months (with successful disputes)";
  }

  if (gap <= 60 && (hasDisputableItems || hasUtilizationIssue)) {
    return "3-6 months (with disputes and paydowns)";
  }

  if (gap <= 80 && totalPotentialGain >= gap) {
    return "4-8 months (with comprehensive action plan)";
  }

  if (gap <= 100) {
    return "6-12 months (sustained credit improvement effort)";
  }

  if (gap <= 150) {
    return "12-18 months (significant credit rebuild required)";
  }

  return "18-24+ months (major credit rebuild program needed)";
}
