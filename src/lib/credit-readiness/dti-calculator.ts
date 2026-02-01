/**
 * Amelia Credit Readiness Engine - Debt-to-Income (DTI) Calculator
 *
 * Calculates the estimated debt-to-income ratio from account data
 * and stated income. Used to evaluate approval likelihood for
 * products that consider DTI (mortgages, auto loans, personal loans).
 */

import type { DTIResult, CreditDataInput, ProductType } from "./types";
import { PRODUCT_SCORING_PROFILES } from "./scoring-models";

// =============================================================================
// DTI CALCULATION
// =============================================================================

/**
 * Calculate the estimated Debt-to-Income ratio.
 *
 * Logic:
 * - Monthly income = statedIncome (annual) / 12
 * - Sum all monthlyPayment values from accounts where monthlyPayment is not null
 * - If no monthlyPayment but has balance, estimate:
 *   - Revolving accounts: balance * 0.02 (minimum payment ~2% of balance)
 *   - Installment accounts: balance * 0.01 (typical monthly installment ~1% of balance)
 * - DTI = (totalMonthlyDebt / monthlyIncome) * 100
 * - Status thresholds are product-specific:
 *   - Conventional Mortgage: 36-45% (36% manual, 45% with compensating factors, 50% max via DU)
 *   - FHA Mortgage: 43-50% (more lenient)
 *   - VA Mortgage: 41% standard max
 *   - Auto Loan: 40-50% varies by lender
 *   - Credit Card: ~36% general guideline
 *   - Personal Loan: 36-50% varies by lender
 */
export function calculateDTI(
  accounts: CreditDataInput["accounts"],
  statedIncome: number,
  maxRecommendedDTI?: number,
  productType?: ProductType
): DTIResult {
  const monthlyIncome = statedIncome / 12;

  if (monthlyIncome <= 0) {
    return {
      estimatedDTI: 0,
      totalMonthlyDebt: 0,
      monthlyIncome: 0,
      maxRecommendedDTI: maxRecommendedDTI ?? 43,
      status: "CRITICAL",
      details: "Unable to calculate DTI: stated income is zero or negative.",
    };
  }

  let totalMonthlyDebt = 0;

  for (const account of accounts) {
    // Skip accounts with no balance data
    if (account.balance === null && account.monthlyPayment === null) {
      continue;
    }

    let monthlyDebt = 0;

    if (account.monthlyPayment !== null && account.monthlyPayment > 0) {
      // Use actual monthly payment if available
      monthlyDebt = account.monthlyPayment;
    } else if (account.balance !== null && account.balance > 0) {
      // Estimate monthly payment from balance
      const isRevolving = isRevolvingAccount(account.accountType, account.accountStatus);
      if (isRevolving) {
        // Revolving: minimum payment is typically ~2% of balance
        monthlyDebt = account.balance * 0.02;
      } else {
        // Installment: typical monthly payment is ~1% of outstanding balance
        monthlyDebt = account.balance * 0.01;
      }
    }

    if (monthlyDebt > 0) {
      totalMonthlyDebt += monthlyDebt;
    }
  }

  const estimatedDTI = (totalMonthlyDebt / monthlyIncome) * 100;

  // Use product-specific thresholds if available
  const profile = productType ? PRODUCT_SCORING_PROFILES[productType] : null;
  const thresholds = profile?.dtiThresholds;
  const effectiveMaxDTI = maxRecommendedDTI ?? thresholds?.max ?? 43;
  const goodThreshold = thresholds?.good ?? 28;
  const borderlineThreshold = thresholds?.borderline ?? 36;
  const highThreshold = thresholds?.high ?? 43;

  // Determine status using product-specific thresholds
  let status: DTIResult["status"];
  if (estimatedDTI < goodThreshold) {
    status = "GOOD";
  } else if (estimatedDTI < borderlineThreshold) {
    status = "BORDERLINE";
  } else if (estimatedDTI < highThreshold) {
    status = "HIGH";
  } else {
    status = "CRITICAL";
  }

  // Build details string
  const productLabel = profile?.displayName ?? "this product";
  let details: string;
  switch (status) {
    case "GOOD":
      details =
        `Your estimated DTI of ${estimatedDTI.toFixed(1)}% is healthy. ` +
        `Lenders for ${productLabel} typically prefer DTI under ${effectiveMaxDTI}%. ` +
        `Monthly debt of $${totalMonthlyDebt.toFixed(2)} against monthly income of $${monthlyIncome.toFixed(2)} is manageable.`;
      break;
    case "BORDERLINE":
      details =
        `Your estimated DTI of ${estimatedDTI.toFixed(1)}% is borderline for ${productLabel}. ` +
        `While some lenders accept up to ${effectiveMaxDTI}%, a lower DTI strengthens your application. ` +
        `Consider paying down revolving debt to improve your ratio.`;
      break;
    case "HIGH":
      details =
        `Your estimated DTI of ${estimatedDTI.toFixed(1)}% is elevated for ${productLabel}. ` +
        `Many lenders cap approval at ${highThreshold}% DTI for this product type. ` +
        `Reducing monthly debt obligations or increasing documented income will help.`;
      break;
    case "CRITICAL":
      details =
        `Your estimated DTI of ${estimatedDTI.toFixed(1)}% exceeds the recommended maximum of ${effectiveMaxDTI}% for ${productLabel}. ` +
        `Most lenders will not approve at this ratio. ` +
        `Significant debt reduction or income increase is needed before applying.`;
      break;
  }

  return {
    estimatedDTI: Math.round(estimatedDTI * 10) / 10,
    totalMonthlyDebt: Math.round(totalMonthlyDebt * 100) / 100,
    monthlyIncome: Math.round(monthlyIncome * 100) / 100,
    maxRecommendedDTI: effectiveMaxDTI,
    status,
    details,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Determine if an account is revolving (credit card, HELOC) vs installment (auto, mortgage).
 */
function isRevolvingAccount(
  accountType: string | null,
  accountStatus: string
): boolean {
  const type = (accountType || "").toLowerCase();
  const status = accountStatus.toLowerCase();

  // Revolving keywords
  if (
    type.includes("revolving") ||
    type.includes("credit card") ||
    type.includes("charge") ||
    type.includes("heloc") ||
    type.includes("line of credit")
  ) {
    return true;
  }

  // Collection accounts: treat as revolving for DTI estimation
  if (status.includes("collection")) {
    return true;
  }

  // Default to installment
  return false;
}
