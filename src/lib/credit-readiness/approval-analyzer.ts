/**
 * Amelia Credit Readiness Engine - Approval Analyzer
 *
 * Main analysis engine that evaluates a client's credit profile against
 * a specific product type (Mortgage, Auto, Credit Card, etc.) and produces
 * a comprehensive approval analysis including:
 *
 * - Approval likelihood (0-100) based on product-specific FICO models
 * - Score gap analysis with actionable factors
 * - DTI calculation (where applicable)
 * - Findings (positive and negative factors)
 * - Prioritized action plan
 */

import type {
  ApprovalAnalysisResult,
  ApprovalTier,
  CreditDataInput,
  Finding,
  ProductType,
} from "./types";
import { PRODUCT_SCORING_PROFILES, getRelevantScore } from "./scoring-models";
import { calculateDTI } from "./dti-calculator";
import { analyzeScoreGap } from "./score-gap-analyzer";
import { generateActionPlan } from "./action-plan-generator";

// =============================================================================
// MAIN ANALYSIS FUNCTION
// =============================================================================

export function analyzeApprovalLikelihood(
  productType: ProductType,
  creditData: CreditDataInput
): ApprovalAnalysisResult {
  const profile = PRODUCT_SCORING_PROFILES[productType];

  // Step 1: Get the relevant score for this product type
  const scoreResult = getRelevantScore(creditData.creditScores, productType);

  // Step 2: Calculate DTI if income is provided and product has maxDTI
  let dtiResult = null;
  if (creditData.statedIncome && creditData.statedIncome > 0 && profile.maxDTI) {
    dtiResult = calculateDTI(
      creditData.accounts,
      creditData.statedIncome,
      profile.maxDTI
    );
  }

  // Step 3: Determine approval tier based on score vs ranges
  const approvalTier = determineApprovalTier(scoreResult.score, profile.minimumScoreRanges);

  // Step 4: Calculate approval likelihood (0-100)
  const approvalLikelihood = calculateApprovalLikelihood(
    scoreResult.score,
    profile.minimumScoreRanges,
    dtiResult,
    creditData
  );

  // Step 5: Generate findings
  const findings = generateFindings(
    scoreResult.score,
    profile,
    dtiResult,
    creditData
  );

  // Step 6: Score gap analysis
  const targetScore = profile.minimumScoreRanges.good;
  const scoreGap = analyzeScoreGap(
    scoreResult.score ?? 0,
    targetScore,
    scoreResult.model,
    creditData
  );

  // Step 7: Generate action plan
  const actionPlan = generateActionPlan(
    productType,
    creditData,
    scoreGap,
    dtiResult
  );

  // Step 8: Build explanation
  const explanation = buildExplanation(
    productType,
    profile,
    scoreResult,
    approvalTier,
    approvalLikelihood,
    dtiResult,
    creditData,
    findings
  );

  return {
    productType,
    approvalLikelihood,
    approvalTier,
    explanation,
    relevantScoreModel: scoreResult.model,
    relevantScore: scoreResult.score,
    triMergeMiddle: scoreResult.triMergeMiddle,
    dti: dtiResult,
    scoreGap,
    findings,
    actionPlan,
  };
}

// =============================================================================
// APPROVAL TIER DETERMINATION
// =============================================================================

function determineApprovalTier(
  score: number | null,
  ranges: { excellent: number; good: number; fair: number; poor: number }
): ApprovalTier {
  if (score === null) return "NOT_READY";
  if (score >= ranges.good) return "LIKELY";
  if (score >= ranges.fair) return "POSSIBLE";
  if (score >= ranges.poor) return "UNLIKELY";
  return "NOT_READY";
}

// =============================================================================
// APPROVAL LIKELIHOOD CALCULATION
// =============================================================================

/**
 * Calculate the approval likelihood score (0-100).
 *
 * Base likelihood from score tier:
 * - Score >= excellent: 85-95
 * - Score >= good:      65-80
 * - Score >= fair:      35-55
 * - Score >= poor:      15-30
 * - Below poor:         5-15
 *
 * Then apply modifiers:
 * - DTI penalty: -5 to -25 depending on severity
 * - Derogatory account penalty: -2 per derogatory item (max -20)
 * - Collection penalty: -5 per collection (max -25)
 * - Inquiry penalty: -1 per excess inquiry over 3 (max -10)
 * - Long credit history bonus: +5
 * - Good payment history bonus: +5
 * - Low utilization bonus: +5
 */
function calculateApprovalLikelihood(
  score: number | null,
  ranges: { excellent: number; good: number; fair: number; poor: number },
  dtiResult: { status: string; estimatedDTI: number } | null,
  creditData: CreditDataInput
): number {
  if (score === null) return 5;

  // Base likelihood from score tier
  let likelihood: number;
  if (score >= ranges.excellent) {
    // Linearly scale from 85 to 95 between good and 850
    const pct = Math.min(1, (score - ranges.excellent) / (850 - ranges.excellent));
    likelihood = 85 + pct * 10;
  } else if (score >= ranges.good) {
    const pct = (score - ranges.good) / (ranges.excellent - ranges.good);
    likelihood = 65 + pct * 15;
  } else if (score >= ranges.fair) {
    const pct = (score - ranges.fair) / (ranges.good - ranges.fair);
    likelihood = 35 + pct * 20;
  } else if (score >= ranges.poor) {
    const pct = (score - ranges.poor) / (ranges.fair - ranges.poor);
    likelihood = 15 + pct * 15;
  } else {
    const pct = Math.max(0, (score - 300) / (ranges.poor - 300));
    likelihood = 5 + pct * 10;
  }

  // --- NEGATIVE MODIFIERS ---

  // DTI penalty
  if (dtiResult) {
    switch (dtiResult.status) {
      case "BORDERLINE":
        likelihood -= 5;
        break;
      case "HIGH":
        likelihood -= 15;
        break;
      case "CRITICAL":
        likelihood -= 25;
        break;
    }
  }

  // Collection accounts penalty
  const collections = creditData.accounts.filter(a => {
    const type = (a.accountType || "").toLowerCase();
    const status = a.accountStatus.toLowerCase();
    return type.includes("collection") || status.includes("collection");
  });
  likelihood -= Math.min(25, collections.length * 5);

  // Charge-off penalty
  const chargeOffs = creditData.accounts.filter(a => {
    const status = a.accountStatus.toLowerCase();
    return status.includes("charge") || status === "charged_off";
  });
  likelihood -= Math.min(15, chargeOffs.length * 5);

  // General derogatory items penalty (other negative items)
  const otherNegative = creditData.accounts.filter(a => {
    const type = (a.accountType || "").toLowerCase();
    const status = a.accountStatus.toLowerCase();
    return (
      a.isDisputable &&
      !type.includes("collection") &&
      !status.includes("collection") &&
      !status.includes("charge")
    );
  });
  likelihood -= Math.min(20, otherNegative.length * 2);

  // Inquiry penalty (excess over 3)
  const excessInquiries = Math.max(0, (creditData.inquiryCount ?? 0) - 3);
  likelihood -= Math.min(10, excessInquiries * 1.5);

  // --- POSITIVE MODIFIERS ---

  // Long credit history bonus
  const hasOldAccounts = creditData.accounts.some(a => {
    if (!a.dateOpened) return false;
    const ageMs = Date.now() - new Date(a.dateOpened).getTime();
    const ageYears = ageMs / (1000 * 60 * 60 * 24 * 365.25);
    return ageYears >= 5;
  });
  if (hasOldAccounts) {
    likelihood += 5;
  }

  // Good payment history bonus (few disputable accounts relative to total)
  const totalAccounts = creditData.accounts.length;
  const disputableCount = creditData.accounts.filter(a => a.isDisputable).length;
  if (totalAccounts > 3 && disputableCount / totalAccounts < 0.2) {
    likelihood += 5;
  }

  // Low utilization bonus
  let totalBalance = 0;
  let totalLimit = 0;
  for (const account of creditData.accounts) {
    if (account.creditLimit && account.creditLimit > 0 && account.balance !== null) {
      totalBalance += account.balance;
      totalLimit += account.creditLimit;
    }
  }
  const overallUtil = totalLimit > 0 ? (totalBalance / totalLimit) * 100 : 0;
  if (overallUtil < 30 && totalLimit > 0) {
    likelihood += 5;
  }

  // Clamp to 0-100
  return Math.max(0, Math.min(100, Math.round(likelihood)));
}

// =============================================================================
// FINDINGS GENERATION
// =============================================================================

function generateFindings(
  score: number | null,
  profile: ReturnType<typeof PRODUCT_SCORING_PROFILES extends Record<string, infer R> ? () => R : never>,
  dtiResult: { status: string; estimatedDTI: number; maxRecommendedDTI: number } | null,
  creditData: CreditDataInput
): Finding[] {
  const findings: Finding[] = [];

  // Score finding
  if (score !== null) {
    if (score >= profile.minimumScoreRanges.excellent) {
      findings.push({
        category: "Credit Score",
        severity: "POSITIVE",
        title: "Excellent Credit Score",
        detail: `Your relevant score of ${score} is in the excellent range for ${profile.displayName}.`,
        impact: "Strong approval indicator",
      });
    } else if (score >= profile.minimumScoreRanges.good) {
      findings.push({
        category: "Credit Score",
        severity: "POSITIVE",
        title: "Good Credit Score",
        detail: `Your relevant score of ${score} meets the good tier for ${profile.displayName}. ${profile.minimumScoreRanges.excellent - score} more points needed for excellent tier.`,
        impact: "Likely approval with competitive terms",
      });
    } else if (score >= profile.minimumScoreRanges.fair) {
      findings.push({
        category: "Credit Score",
        severity: "WARNING",
        title: "Fair Credit Score",
        detail: `Your relevant score of ${score} is in the fair range. You need ${profile.minimumScoreRanges.good - score} more points to reach the good tier.`,
        impact: "Approval possible but with higher rates or additional requirements",
      });
    } else if (score >= profile.minimumScoreRanges.poor) {
      findings.push({
        category: "Credit Score",
        severity: "NEGATIVE",
        title: "Below Average Credit Score",
        detail: `Your relevant score of ${score} is below the fair threshold of ${profile.minimumScoreRanges.fair}.`,
        impact: "Approval unlikely with mainstream lenders; subprime options may be available",
      });
    } else {
      findings.push({
        category: "Credit Score",
        severity: "CRITICAL",
        title: "Credit Score Below Minimum",
        detail: `Your relevant score of ${score} is below the minimum threshold of ${profile.minimumScoreRanges.poor}.`,
        impact: "Approval very unlikely; focused credit improvement needed before applying",
      });
    }
  } else {
    findings.push({
      category: "Credit Score",
      severity: "CRITICAL",
      title: "No Credit Score Available",
      detail: "Unable to determine a relevant credit score. This may indicate a thin or new credit file.",
      impact: "Cannot evaluate approval likelihood without score data",
    });
  }

  // DTI finding
  if (dtiResult) {
    switch (dtiResult.status) {
      case "GOOD":
        findings.push({
          category: "Debt-to-Income",
          severity: "POSITIVE",
          title: "Healthy Debt-to-Income Ratio",
          detail: `DTI of ${dtiResult.estimatedDTI.toFixed(1)}% is well within the ${dtiResult.maxRecommendedDTI}% maximum.`,
          impact: "DTI will not be a barrier to approval",
        });
        break;
      case "BORDERLINE":
        findings.push({
          category: "Debt-to-Income",
          severity: "WARNING",
          title: "Borderline Debt-to-Income Ratio",
          detail: `DTI of ${dtiResult.estimatedDTI.toFixed(1)}% is approaching the ${dtiResult.maxRecommendedDTI}% maximum.`,
          impact: "Some lenders may flag this; reducing debt would strengthen your application",
        });
        break;
      case "HIGH":
        findings.push({
          category: "Debt-to-Income",
          severity: "NEGATIVE",
          title: "High Debt-to-Income Ratio",
          detail: `DTI of ${dtiResult.estimatedDTI.toFixed(1)}% is elevated relative to the ${dtiResult.maxRecommendedDTI}% maximum.`,
          impact: "Many lenders will flag this as a risk factor",
        });
        break;
      case "CRITICAL":
        findings.push({
          category: "Debt-to-Income",
          severity: "CRITICAL",
          title: "DTI Exceeds Maximum",
          detail: `DTI of ${dtiResult.estimatedDTI.toFixed(1)}% exceeds the ${dtiResult.maxRecommendedDTI}% maximum for this product.`,
          impact: "Approval extremely unlikely at current DTI; debt reduction required",
        });
        break;
    }
  }

  // Collection accounts finding
  const collections = creditData.accounts.filter(a => {
    const type = (a.accountType || "").toLowerCase();
    const status = a.accountStatus.toLowerCase();
    return type.includes("collection") || status.includes("collection");
  });
  if (collections.length > 0) {
    const totalBalance = collections.reduce((sum, a) => sum + (a.balance || 0), 0);
    findings.push({
      category: "Derogatory Items",
      severity: collections.length >= 3 ? "CRITICAL" : "NEGATIVE",
      title: `${collections.length} Collection Account${collections.length > 1 ? "s" : ""}`,
      detail: `${collections.length} collection account(s) totaling $${totalBalance.toLocaleString()} found on your credit report.`,
      impact: "Collections are the most damaging items for approval; disputing is the top priority",
    });
  }

  // Charge-offs finding
  const chargeOffs = creditData.accounts.filter(a => {
    const status = a.accountStatus.toLowerCase();
    return status.includes("charge") || status === "charged_off";
  });
  if (chargeOffs.length > 0) {
    findings.push({
      category: "Derogatory Items",
      severity: "NEGATIVE",
      title: `${chargeOffs.length} Charge-Off${chargeOffs.length > 1 ? "s" : ""}`,
      detail: `${chargeOffs.length} charge-off account(s) detected. These significantly impact approval decisions.`,
      impact: "Charge-offs indicate past inability to pay; dispute for accuracy or negotiate removal",
    });
  }

  // Utilization finding
  let totalBalance = 0;
  let totalLimit = 0;
  for (const account of creditData.accounts) {
    if (account.creditLimit && account.creditLimit > 0 && account.balance !== null) {
      totalBalance += account.balance;
      totalLimit += account.creditLimit;
    }
  }
  const overallUtil = totalLimit > 0 ? (totalBalance / totalLimit) * 100 : 0;

  if (totalLimit > 0) {
    if (overallUtil <= 10) {
      findings.push({
        category: "Utilization",
        severity: "POSITIVE",
        title: "Excellent Credit Utilization",
        detail: `Overall utilization of ${overallUtil.toFixed(0)}% is in the ideal range (under 10%).`,
        impact: "Maximizing score contribution from utilization",
      });
    } else if (overallUtil <= 30) {
      findings.push({
        category: "Utilization",
        severity: "POSITIVE",
        title: "Good Credit Utilization",
        detail: `Overall utilization of ${overallUtil.toFixed(0)}% is within the acceptable range.`,
        impact: "Good utilization; lowering to under 10% would further boost your score",
      });
    } else if (overallUtil <= 50) {
      findings.push({
        category: "Utilization",
        severity: "WARNING",
        title: "Moderate Credit Utilization",
        detail: `Overall utilization of ${overallUtil.toFixed(0)}% exceeds the recommended 30% threshold.`,
        impact: "Reducing balances to under 30% could gain 10-20 points",
      });
    } else {
      findings.push({
        category: "Utilization",
        severity: overallUtil > 70 ? "CRITICAL" : "NEGATIVE",
        title: "High Credit Utilization",
        detail: `Overall utilization of ${overallUtil.toFixed(0)}% is significantly hurting your score.`,
        impact: `Reducing to under 30% could gain 20-40 points; current utilization is costing an estimated ${Math.round(overallUtil * 0.5)} points`,
      });
    }
  }

  // Inquiry finding
  const inquiryCount = creditData.inquiryCount ?? 0;
  if (inquiryCount > 6) {
    findings.push({
      category: "Inquiries",
      severity: "WARNING",
      title: "Excessive Hard Inquiries",
      detail: `${inquiryCount} hard inquiries detected in the last 24 months.`,
      impact: "Multiple inquiries signal credit-seeking behavior; avoid new applications",
    });
  } else if (inquiryCount > 3) {
    findings.push({
      category: "Inquiries",
      severity: "WARNING",
      title: "Multiple Hard Inquiries",
      detail: `${inquiryCount} hard inquiries detected. This is moderate but worth noting.`,
      impact: "Limit new applications to avoid further inquiry damage",
    });
  }

  // Thin file finding
  if (creditData.accounts.length < 5) {
    findings.push({
      category: "Credit History",
      severity: "WARNING",
      title: "Thin Credit File",
      detail: `Only ${creditData.accounts.length} account(s) on file. Most lenders prefer to see 3-5+ accounts.`,
      impact: "Limited credit history may result in higher rates or require additional documentation",
    });
  }

  // Additional factors
  if (profile.additionalFactors.length > 0) {
    findings.push({
      category: "Additional Requirements",
      severity: "WARNING",
      title: `${profile.displayName} Requirements`,
      detail: `Beyond credit score, this product requires: ${profile.additionalFactors.join("; ")}.`,
      impact: "Ensure you meet these additional criteria before applying",
    });
  }

  return findings;
}

// =============================================================================
// EXPLANATION BUILDER
// =============================================================================

function buildExplanation(
  productType: ProductType,
  profile: ReturnType<typeof PRODUCT_SCORING_PROFILES extends Record<string, infer R> ? () => R : never>,
  scoreResult: { score: number | null; model: string; confidence: number; triMergeMiddle: number | null },
  approvalTier: string,
  approvalLikelihood: number,
  dtiResult: { status: string; estimatedDTI: number } | null,
  creditData: CreditDataInput,
  findings: Finding[]
): string {
  const parts: string[] = [];

  // Opening - product context
  parts.push(
    `CREDIT READINESS ANALYSIS: ${profile.displayName}\n` +
    `${profile.description}\n`
  );

  // Score analysis
  if (scoreResult.score !== null) {
    parts.push(
      `YOUR RELEVANT SCORE: ${scoreResult.score} (${scoreResult.model})` +
      (scoreResult.confidence < 100
        ? ` [Estimated with ${scoreResult.confidence}% confidence]`
        : "") +
      "\n"
    );

    if (scoreResult.triMergeMiddle !== null) {
      parts.push(
        `TRI-MERGE MIDDLE SCORE: ${scoreResult.triMergeMiddle} ` +
        "(Mortgage lenders use the middle of your FICO 2, 4, and 5 scores)\n"
      );
    }
  } else {
    parts.push("YOUR RELEVANT SCORE: Unable to determine\n");
  }

  // Approval assessment
  const tierDescriptions: Record<string, string> = {
    LIKELY: "Based on your credit profile, approval is LIKELY with competitive terms.",
    POSSIBLE:
      "Approval is POSSIBLE, but you may face higher rates or additional requirements. " +
      "Improving your credit before applying would strengthen your position.",
    UNLIKELY:
      "Approval is UNLIKELY with mainstream lenders at this time. " +
      "We recommend completing the action plan below before applying.",
    NOT_READY:
      "Your credit profile is NOT READY for this product. " +
      "Significant improvement is needed. Follow the action plan below to build your readiness.",
  };

  parts.push(
    `APPROVAL LIKELIHOOD: ${approvalLikelihood}% - ${tierDescriptions[approvalTier]}\n`
  );

  // DTI summary
  if (dtiResult) {
    parts.push(
      `DEBT-TO-INCOME: ${dtiResult.estimatedDTI.toFixed(1)}% (${dtiResult.status})\n`
    );
  }

  // Key findings summary
  const criticalFindings = findings.filter(f => f.severity === "CRITICAL");
  const negativeFindings = findings.filter(f => f.severity === "NEGATIVE");
  const positiveFindings = findings.filter(f => f.severity === "POSITIVE");

  if (criticalFindings.length > 0) {
    parts.push(
      `CRITICAL ISSUES (${criticalFindings.length}): ` +
      criticalFindings.map(f => f.title).join(", ") +
      "\n"
    );
  }

  if (negativeFindings.length > 0) {
    parts.push(
      `AREAS FOR IMPROVEMENT (${negativeFindings.length}): ` +
      negativeFindings.map(f => f.title).join(", ") +
      "\n"
    );
  }

  if (positiveFindings.length > 0) {
    parts.push(
      `STRENGTHS (${positiveFindings.length}): ` +
      positiveFindings.map(f => f.title).join(", ") +
      "\n"
    );
  }

  // Action summary
  const disputableCount = creditData.accounts.filter(a => a.isDisputable).length;
  if (disputableCount > 0) {
    parts.push(
      `\nRECOMMENDED NEXT STEP: Dispute ${disputableCount} negative item(s) through your D2G dashboard. ` +
      "AMELIA will generate targeted dispute letters using the most effective legal strategies.\n"
    );
  }

  return parts.join("");
}
