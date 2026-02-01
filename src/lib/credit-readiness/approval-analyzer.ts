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
  CFPBTier,
  ConfidenceLevel,
  CreditDataInput,
  Finding,
  HardDisqualification,
  LTVResult,
  ProductType,
  ReadinessFactors,
} from "./types";
import {
  PRODUCT_SCORING_PROFILES,
  getRelevantScore,
  classifyCFPBTier,
  normalizeScoreTo100,
  normalizeDTITo100,
  normalizeLTVTo100,
} from "./scoring-models";
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

  // Step 2: Calculate DTI if income is provided
  let dtiResult = null;
  if (creditData.statedIncome && creditData.statedIncome > 0) {
    dtiResult = calculateDTI(
      creditData.accounts,
      creditData.statedIncome,
      profile.maxDTI,
      productType
    );
  }

  // Step 3: Calculate LTV if applicable (secured products)
  let ltvResult: LTVResult | null = null;
  if (creditData.ltvInput && profile.factorWeights.ltv > 0) {
    ltvResult = calculateLTV(creditData.ltvInput.loanAmount, creditData.ltvInput.assetValue, productType);
  }

  // Step 4: Classify CFPB tier
  const cfpbTier = classifyCFPBTier(scoreResult.score);

  // Step 5: Check hard disqualification rules
  const hardDisqualifications = checkHardDisqualifications(
    scoreResult.score,
    dtiResult,
    creditData,
    productType
  );

  // Step 6: Calculate multi-factor readiness score
  const readinessFactors = calculateReadinessFactors(
    scoreResult.score,
    dtiResult?.estimatedDTI ?? null,
    ltvResult?.ltv ?? null,
    creditData,
    profile.factorWeights
  );

  // Step 7: Determine approval likelihood & tier
  let approvalLikelihood: number;
  let approvalTier: ApprovalTier;

  if (hardDisqualifications.length > 0) {
    approvalLikelihood = Math.min(readinessFactors.compositeScore, 15);
    approvalTier = "NOT_READY";
  } else {
    approvalLikelihood = readinessFactors.compositeScore;
    approvalTier = determineApprovalTier(approvalLikelihood);
  }

  // Step 8: Determine confidence level
  const confidenceLevel = determineConfidenceLevel(creditData, scoreResult.confidence);

  // Step 9: Generate findings
  const findings = generateFindings(
    scoreResult.score,
    profile,
    dtiResult,
    ltvResult,
    creditData,
    cfpbTier,
    hardDisqualifications
  );

  // Step 10: Score gap analysis
  const targetScore = profile.minimumScoreRanges.good;
  const scoreGap = analyzeScoreGap(
    scoreResult.score ?? 0,
    targetScore,
    scoreResult.model,
    creditData
  );

  // Step 11: Generate action plan
  const actionPlan = generateActionPlan(
    productType,
    creditData,
    scoreGap,
    dtiResult
  );

  // Step 12: Build explanation
  const explanation = buildExplanation(
    productType,
    profile,
    scoreResult,
    approvalTier,
    approvalLikelihood,
    dtiResult,
    ltvResult,
    creditData,
    findings,
    cfpbTier,
    confidenceLevel,
    hardDisqualifications
  );

  return {
    productType,
    approvalLikelihood,
    approvalTier,
    cfpbTier,
    confidenceLevel,
    explanation,
    relevantScoreModel: scoreResult.model,
    relevantScore: scoreResult.score,
    triMergeMiddle: scoreResult.triMergeMiddle,
    dti: dtiResult,
    ltv: ltvResult,
    readinessFactors,
    hardDisqualifications,
    scoreGap,
    findings,
    actionPlan,
  };
}

// =============================================================================
// MULTI-FACTOR READINESS FORMULA
// =============================================================================

/**
 * Calculate composite readiness score using the multi-factor weighted formula:
 * READINESS_SCORE = (Credit_Factor × W1) + (DTI_Factor × W2) + (LTV_Factor × W3) + (History_Factor × W4)
 *
 * Each factor is normalized to 0-100, then weighted per product type.
 */
function calculateReadinessFactors(
  score: number | null,
  dti: number | null,
  ltv: number | null,
  creditData: CreditDataInput,
  weights: { credit: number; dti: number; ltv: number; history: number }
): ReadinessFactors {
  const creditFactor = normalizeScoreTo100(score);
  const dtiFactor = normalizeDTITo100(dti);
  const ltvFactor = normalizeLTVTo100(ltv);
  const historyFactor = calculateHistoryFactor(creditData);

  // If LTV weight is 0 (unsecured products), redistribute its weight
  const effectiveWeights = { ...weights };
  if (effectiveWeights.ltv === 0) {
    // LTV not applicable - distribute LTV weight proportionally to other factors
    const nonLtvTotal = effectiveWeights.credit + effectiveWeights.dti + effectiveWeights.history;
    if (nonLtvTotal > 0) {
      effectiveWeights.credit = effectiveWeights.credit / nonLtvTotal;
      effectiveWeights.dti = effectiveWeights.dti / nonLtvTotal;
      effectiveWeights.history = effectiveWeights.history / nonLtvTotal;
    }
  }

  const compositeScore = Math.round(
    creditFactor * effectiveWeights.credit +
    dtiFactor * effectiveWeights.dti +
    ltvFactor * effectiveWeights.ltv +
    historyFactor * effectiveWeights.history
  );

  return {
    creditFactor,
    dtiFactor,
    ltvFactor,
    historyFactor,
    weights: effectiveWeights,
    compositeScore: Math.max(0, Math.min(100, compositeScore)),
  };
}

/**
 * Calculate a 0-100 history factor based on:
 * - Payment history (proportion of clean accounts)
 * - Account age (average age vs 7-year ideal)
 * - Credit mix diversity
 * - Collections/derogatories penalty
 */
function calculateHistoryFactor(creditData: CreditDataInput): number {
  if (creditData.accounts.length === 0) return 20;

  let score = 0;

  // Payment history (0-40 points): proportion of non-disputable accounts
  const totalAccounts = creditData.accounts.length;
  const cleanAccounts = creditData.accounts.filter(a => !a.isDisputable).length;
  const cleanRatio = totalAccounts > 0 ? cleanAccounts / totalAccounts : 0;
  score += Math.round(cleanRatio * 40);

  // Account age (0-30 points): average age vs 7-year ideal (84 months)
  let totalAge = 0;
  let accountsWithDates = 0;
  const now = Date.now();
  for (const account of creditData.accounts) {
    if (account.dateOpened) {
      const ageMonths = (now - new Date(account.dateOpened).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      totalAge += ageMonths;
      accountsWithDates++;
    }
  }
  const avgAgeMonths = accountsWithDates > 0 ? totalAge / accountsWithDates : 0;
  const agePct = Math.min(1, avgAgeMonths / 84);
  score += Math.round(agePct * 30);

  // Credit mix (0-15 points): diversity of account types
  const types = new Set<string>();
  for (const account of creditData.accounts) {
    const type = (account.accountType || "").toLowerCase();
    if (type.includes("revolving") || type.includes("credit card")) types.add("revolving");
    else if (type.includes("installment") || type.includes("auto") || type.includes("student")) types.add("installment");
    else if (type.includes("mortgage") || type.includes("real estate")) types.add("mortgage");
    else if (!type.includes("collection") && type) types.add("other");
  }
  score += Math.min(15, types.size * 5);

  // Account count bonus (0-15 points): having enough accounts
  const accountCountPct = Math.min(1, creditData.accounts.length / 8);
  score += Math.round(accountCountPct * 15);

  return Math.max(0, Math.min(100, score));
}

// =============================================================================
// LTV CALCULATION
// =============================================================================

function calculateLTV(
  loanAmount: number,
  assetValue: number,
  productType: ProductType
): LTVResult {
  if (assetValue <= 0) {
    return { ltv: 100, status: "CRITICAL", details: "Unable to calculate LTV: asset value is zero or not provided." };
  }

  const ltv = (loanAmount / assetValue) * 100;
  let status: LTVResult["status"];
  let details: string;

  if (productType === "MORTGAGE") {
    if (ltv <= 80) {
      status = "GOOD";
      details = `LTV of ${ltv.toFixed(1)}% is excellent. No PMI required at 80% or below.`;
    } else if (ltv <= 90) {
      status = "ACCEPTABLE";
      details = `LTV of ${ltv.toFixed(1)}% requires private mortgage insurance (PMI) but is within acceptable limits.`;
    } else if (ltv <= 97) {
      status = "HIGH";
      details = `LTV of ${ltv.toFixed(1)}% is high. Maximum conventional LTV is 97% with PMI. Consider a larger down payment.`;
    } else {
      status = "CRITICAL";
      details = `LTV of ${ltv.toFixed(1)}% exceeds the 97% maximum for conventional mortgages. A larger down payment is required.`;
    }
  } else {
    // Auto and other secured products
    if (ltv <= 80) {
      status = "GOOD";
      details = `LTV of ${ltv.toFixed(1)}% is well within acceptable limits.`;
    } else if (ltv <= 100) {
      status = "ACCEPTABLE";
      details = `LTV of ${ltv.toFixed(1)}% is typical for this product type.`;
    } else if (ltv <= 120) {
      status = "HIGH";
      details = `LTV of ${ltv.toFixed(1)}% means the loan exceeds the asset value. Approval may require strong credit.`;
    } else {
      status = "CRITICAL";
      details = `LTV of ${ltv.toFixed(1)}% is significantly underwater. Most lenders will not approve at this ratio.`;
    }
  }

  return { ltv: Math.round(ltv * 10) / 10, status, details };
}

// =============================================================================
// HARD DISQUALIFICATION RULES
// =============================================================================

/**
 * Check for conditions that should trigger automatic "Not Ready" status
 * regardless of composite score.
 */
function checkHardDisqualifications(
  score: number | null,
  dtiResult: { status: string; estimatedDTI: number } | null,
  creditData: CreditDataInput,
  productType: ProductType
): HardDisqualification[] {
  const disqualifications: HardDisqualification[] = [];
  const profile = PRODUCT_SCORING_PROFILES[productType];

  // 1. Credit score below product minimum
  if (score !== null && score < profile.minimumScoreRanges.poor) {
    disqualifications.push({
      reason: "Credit score below minimum",
      detail: `Score of ${score} is below the minimum threshold of ${profile.minimumScoreRanges.poor} for ${profile.displayName}.`,
    });
  }

  // 2. DTI above product maximum
  const maxDTI = profile.dtiThresholds?.max ?? profile.maxDTI ?? 50;
  if (dtiResult && dtiResult.estimatedDTI > maxDTI) {
    disqualifications.push({
      reason: "DTI exceeds maximum",
      detail: `DTI of ${dtiResult.estimatedDTI.toFixed(1)}% exceeds the ${maxDTI}% maximum for ${profile.displayName}.`,
    });
  }

  // 3. Recent bankruptcy
  if (creditData.hasBankruptcy && creditData.bankruptcyDischargeDate) {
    const dischargeDate = new Date(creditData.bankruptcyDischargeDate);
    const yearsSinceDischarge = (Date.now() - dischargeDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

    if (creditData.bankruptcyType === "CHAPTER_7") {
      const waitYears = productType === "MORTGAGE" ? 4 : 2;
      if (yearsSinceDischarge < waitYears) {
        disqualifications.push({
          reason: "Recent Chapter 7 bankruptcy",
          detail: `Chapter 7 bankruptcy discharged ${yearsSinceDischarge.toFixed(1)} years ago. Most lenders require ${waitYears}+ years for ${profile.displayName}.`,
          waitPeriod: `${waitYears} years from discharge`,
        });
      }
    } else if (creditData.bankruptcyType === "CHAPTER_13") {
      const waitYears = productType === "MORTGAGE" ? 2 : 1;
      if (yearsSinceDischarge < waitYears) {
        disqualifications.push({
          reason: "Recent Chapter 13 bankruptcy",
          detail: `Chapter 13 bankruptcy discharged ${yearsSinceDischarge.toFixed(1)} years ago. Most lenders require ${waitYears}+ years for ${profile.displayName}.`,
          waitPeriod: `${waitYears} years from discharge`,
        });
      }
    }
  }

  // 4. Recent foreclosure (primarily for mortgage)
  if (creditData.hasForeclosure && creditData.foreclosureDate) {
    const foreclosureDate = new Date(creditData.foreclosureDate);
    const yearsSince = (Date.now() - foreclosureDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    const waitYears = productType === "MORTGAGE" ? 7 : 3;

    if (yearsSince < waitYears) {
      disqualifications.push({
        reason: "Recent foreclosure",
        detail: `Foreclosure ${yearsSince.toFixed(1)} years ago. Most lenders require ${waitYears}+ years for ${profile.displayName}.`,
        waitPeriod: `${waitYears} years from foreclosure`,
      });
    }
  }

  // 5. Active collections for prime products (MORTGAGE, CREDIT_CARD with good score ranges)
  if (productType === "MORTGAGE" || productType === "CREDIT_CARD") {
    const activeCollections = creditData.accounts.filter(a => {
      const type = (a.accountType || "").toLowerCase();
      const status = a.accountStatus.toLowerCase();
      return (type.includes("collection") || status.includes("collection")) && (a.balance ?? 0) > 0;
    });
    if (activeCollections.length > 0 && score !== null && score >= 660) {
      // For prime-level scores, active collections are a hard stop for most lenders
      disqualifications.push({
        reason: "Active collections on prime application",
        detail: `${activeCollections.length} active collection(s) with outstanding balances. Most prime lenders require collection resolution before approval.`,
      });
    }
  }

  return disqualifications;
}

// =============================================================================
// APPROVAL TIER DETERMINATION (from composite score)
// =============================================================================

function determineApprovalTier(compositeScore: number): ApprovalTier {
  if (compositeScore >= 70) return "LIKELY";
  if (compositeScore >= 50) return "POSSIBLE";
  if (compositeScore >= 30) return "UNLIKELY";
  return "NOT_READY";
}

// =============================================================================
// CONFIDENCE LEVEL DETERMINATION
// =============================================================================

/**
 * Determine confidence level based on available data:
 * - HIGH: All three bureau scores + full income/debt data
 * - MEDIUM: Single bureau score + estimated income
 * - LOW: Estimated score + limited financial data
 */
function determineConfidenceLevel(
  creditData: CreditDataInput,
  scoreConfidence: number
): ConfidenceLevel {
  const bureauCount = new Set(creditData.creditScores.map(s => s.cra)).size;
  const hasFullIncome = creditData.statedIncome != null && creditData.statedIncome > 0;
  const hasMonthlyPayments = creditData.accounts.some(a => a.monthlyPayment !== null && a.monthlyPayment > 0);

  // HIGH: 3 bureaus + full income data
  if (bureauCount >= 3 && hasFullIncome && hasMonthlyPayments && scoreConfidence >= 80) {
    return "HIGH";
  }

  // MEDIUM: at least 1 bureau + some income data
  if (bureauCount >= 1 && (hasFullIncome || creditData.accounts.length > 3) && scoreConfidence >= 60) {
    return "MEDIUM";
  }

  // LOW: estimated scores or limited data
  return "LOW";
}

// =============================================================================
// FINDINGS GENERATION
// =============================================================================

function generateFindings(
  score: number | null,
  profile: ReturnType<typeof PRODUCT_SCORING_PROFILES extends Record<string, infer R> ? () => R : never>,
  dtiResult: { status: string; estimatedDTI: number; maxRecommendedDTI: number } | null,
  ltvResult: LTVResult | null,
  creditData: CreditDataInput,
  cfpbTier: CFPBTier,
  hardDisqualifications: HardDisqualification[]
): Finding[] {
  const findings: Finding[] = [];

  // Hard disqualification findings (highest priority)
  for (const disq of hardDisqualifications) {
    findings.push({
      category: "Hard Disqualification",
      severity: "CRITICAL",
      title: disq.reason,
      detail: disq.detail,
      impact: disq.waitPeriod
        ? `Must wait ${disq.waitPeriod} before applying`
        : "Must be resolved before applying",
    });
  }

  // CFPB tier finding
  if (score !== null) {
    const tierLabels: Record<CFPBTier, string> = {
      SUPER_PRIME: "Super-Prime",
      PRIME: "Prime",
      NEAR_PRIME: "Near-Prime",
      SUBPRIME: "Subprime",
      DEEP_SUBPRIME: "Deep Subprime",
    };
    const tierSeverity: Record<CFPBTier, Finding["severity"]> = {
      SUPER_PRIME: "POSITIVE",
      PRIME: "POSITIVE",
      NEAR_PRIME: "WARNING",
      SUBPRIME: "NEGATIVE",
      DEEP_SUBPRIME: "CRITICAL",
    };

    findings.push({
      category: "CFPB Credit Tier",
      severity: tierSeverity[cfpbTier],
      title: `${tierLabels[cfpbTier]} Credit Tier (${score})`,
      detail: cfpbTier === "SUPER_PRIME"
        ? `Score of ${score} places you in the Super-Prime tier (720+). Best rates on all products.`
        : cfpbTier === "PRIME"
        ? `Score of ${score} places you in the Prime tier (660-719). Good rates, most products available.`
        : cfpbTier === "NEAR_PRIME"
        ? `Score of ${score} places you in the Near-Prime tier (620-659). Minimum for conventional mortgage. Higher rates likely.`
        : cfpbTier === "SUBPRIME"
        ? `Score of ${score} places you in the Subprime tier (580-619). FHA mortgage minimum. Limited product access.`
        : `Score of ${score} places you in the Deep Subprime tier (below 580). Very limited options available.`,
      impact: cfpbTier === "SUPER_PRIME" || cfpbTier === "PRIME"
        ? "Competitive rates and broad product access"
        : "Score improvement needed for better rates and product access",
    });
  }

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

  // LTV finding
  if (ltvResult) {
    const ltvSeverity: Record<LTVResult["status"], Finding["severity"]> = {
      GOOD: "POSITIVE",
      ACCEPTABLE: "WARNING",
      HIGH: "NEGATIVE",
      CRITICAL: "CRITICAL",
    };
    findings.push({
      category: "Loan-to-Value",
      severity: ltvSeverity[ltvResult.status],
      title: `LTV Ratio: ${ltvResult.ltv.toFixed(1)}%`,
      detail: ltvResult.details,
      impact: ltvResult.status === "GOOD"
        ? "Strong collateral position"
        : ltvResult.status === "ACCEPTABLE"
        ? "Additional costs (PMI) may apply"
        : "LTV is a significant concern for approval",
    });
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
  ltvResult: LTVResult | null,
  creditData: CreditDataInput,
  findings: Finding[],
  cfpbTier: CFPBTier,
  confidenceLevel: ConfidenceLevel,
  hardDisqualifications: HardDisqualification[]
): string {
  const parts: string[] = [];

  // Opening - product context
  parts.push(
    `CREDIT READINESS ANALYSIS: ${profile.displayName}\n` +
    `${profile.description}\n`
  );

  // Confidence indicator
  const confidenceLabels: Record<ConfidenceLevel, string> = {
    HIGH: "High (3+ bureau scores + full income data)",
    MEDIUM: "Medium (limited bureau data or estimated income)",
    LOW: "Low (estimated scores + limited financial data)",
  };
  parts.push(`ANALYSIS CONFIDENCE: ${confidenceLabels[confidenceLevel]}\n`);

  // Score analysis
  if (scoreResult.score !== null) {
    const tierLabels: Record<CFPBTier, string> = {
      SUPER_PRIME: "Super-Prime",
      PRIME: "Prime",
      NEAR_PRIME: "Near-Prime",
      SUBPRIME: "Subprime",
      DEEP_SUBPRIME: "Deep Subprime",
    };

    parts.push(
      `YOUR RELEVANT SCORE: ${scoreResult.score} (${scoreResult.model}) - ${tierLabels[cfpbTier]} Tier` +
      (scoreResult.confidence < 100
        ? ` [Estimated with ${scoreResult.confidence}% confidence]`
        : "") +
      "\n"
    );

    if (scoreResult.triMergeMiddle !== null) {
      parts.push(
        `TRI-MERGE MIDDLE SCORE: ${scoreResult.triMergeMiddle} ` +
        "(Mortgage lenders use the middle of your FICO 2, 4, and 5 scores, or VantageScore 4.0 for Fannie/Freddie)\n"
      );
    }
  } else {
    parts.push("YOUR RELEVANT SCORE: Unable to determine\n");
  }

  // Hard disqualifications
  if (hardDisqualifications.length > 0) {
    parts.push("\nHARD DISQUALIFICATIONS:\n");
    for (const disq of hardDisqualifications) {
      parts.push(`  - ${disq.reason}: ${disq.detail}\n`);
    }
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
    `\nAPPROVAL LIKELIHOOD: ${approvalLikelihood}% - ${tierDescriptions[approvalTier]}\n`
  );

  // DTI summary
  if (dtiResult) {
    parts.push(
      `DEBT-TO-INCOME: ${dtiResult.estimatedDTI.toFixed(1)}% (${dtiResult.status})\n`
    );
  }

  // LTV summary
  if (ltvResult) {
    parts.push(
      `LOAN-TO-VALUE: ${ltvResult.ltv.toFixed(1)}% (${ltvResult.status})\n`
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
