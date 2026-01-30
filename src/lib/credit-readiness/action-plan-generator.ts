/**
 * Amelia Credit Readiness Engine - Action Plan Generator
 *
 * Generates a prioritized, actionable step-by-step plan for improving
 * credit readiness for a specific product type. Each step includes
 * what to do, how to do it, and where to go in the Dispute2Go platform.
 *
 * Steps are ordered by priority (CRITICAL > HIGH > MEDIUM > LOW)
 * and then by estimated impact within each priority level.
 */

import type {
  ActionPlanStep,
  ActionPriority,
  CreditDataInput,
  ProductType,
} from "./types";

// =============================================================================
// ACTION PLAN GENERATION
// =============================================================================

export function generateActionPlan(
  productType: ProductType,
  creditData: CreditDataInput,
  scoreGap: {
    gap: number;
    factors: Array<{ factor: string; potentialGain: number; action: string }>;
  },
  dtiResult?: { status: string; estimatedDTI: number; maxRecommendedDTI: number } | null
): ActionPlanStep[] {
  const steps: ActionPlanStep[] = [];
  let stepNumber = 1;

  // -------------------------------------------------------
  // 1. DISPUTE NEGATIVE ITEMS
  // -------------------------------------------------------
  const disputableAccounts = creditData.accounts.filter(a => a.isDisputable);
  const collections = disputableAccounts.filter(a => {
    const type = (a.accountType || "").toLowerCase();
    const status = a.accountStatus.toLowerCase();
    return type.includes("collection") || status.includes("collection");
  });
  const chargeOffs = disputableAccounts.filter(a => {
    const status = a.accountStatus.toLowerCase();
    return status.includes("charge") || status === "charged_off";
  });
  const otherNegative = disputableAccounts.filter(a => {
    const type = (a.accountType || "").toLowerCase();
    const status = a.accountStatus.toLowerCase();
    return (
      !type.includes("collection") &&
      !status.includes("collection") &&
      !status.includes("charge")
    );
  });

  if (collections.length > 0) {
    const creditors = collections
      .slice(0, 5)
      .map(a => a.creditorName)
      .join(", ");
    const totalBalance = collections.reduce((sum, a) => sum + (a.balance || 0), 0);

    steps.push({
      stepNumber: stepNumber++,
      priority: "CRITICAL",
      category: "DISPUTE",
      title: `Dispute ${collections.length} Collection Account${collections.length > 1 ? "s" : ""}`,
      whatToDo:
        `Dispute ${collections.length} collection account(s) totaling $${totalBalance.toLocaleString()}. ` +
        `Target: ${creditors}${collections.length > 5 ? ` and ${collections.length - 5} more` : ""}.`,
      howToDoIt:
        "Navigate to the Disputes section in your D2G dashboard. Select the collection accounts " +
        "and generate dispute letters. AMELIA will craft validation letters citing FDCPA Section 809 " +
        "and FCRA Section 611, demanding the collector prove they own the debt and have authority to collect. " +
        "Collections are the #1 target for deletion - collection agencies frequently cannot provide proper validation.",
      whereToGo: "/disputes",
      estimatedImpact: `+${Math.min(100, collections.length * 40)} points if all collections are removed`,
      estimatedTimeline: "30-90 days (1-3 dispute rounds)",
    });
  }

  if (chargeOffs.length > 0) {
    const creditors = chargeOffs
      .slice(0, 5)
      .map(a => a.creditorName)
      .join(", ");

    steps.push({
      stepNumber: stepNumber++,
      priority: "CRITICAL",
      category: "DISPUTE",
      title: `Dispute ${chargeOffs.length} Charge-Off Account${chargeOffs.length > 1 ? "s" : ""}`,
      whatToDo:
        `Dispute ${chargeOffs.length} charge-off(s) for reporting accuracy. ` +
        `Target: ${creditors}${chargeOffs.length > 5 ? ` and ${chargeOffs.length - 5} more` : ""}.`,
      howToDoIt:
        "In the Disputes section, select the charge-off accounts and generate accuracy dispute letters. " +
        "Focus on reporting errors: incorrect balances, wrong dates of last activity, missing payment history, " +
        "or incorrect account status. AMELIA will generate letters targeting specific Metro 2 data field inaccuracies.",
      whereToGo: "/disputes",
      estimatedImpact: `+${Math.min(80, chargeOffs.length * 30)} points if charge-offs are corrected or removed`,
      estimatedTimeline: "30-90 days (1-3 dispute rounds)",
    });
  }

  if (otherNegative.length > 0) {
    steps.push({
      stepNumber: stepNumber++,
      priority: "HIGH",
      category: "DISPUTE",
      title: `Dispute ${otherNegative.length} Additional Negative Item${otherNegative.length > 1 ? "s" : ""}`,
      whatToDo:
        `Dispute ${otherNegative.length} negative item(s) including late payment records and inaccurate statuses.`,
      howToDoIt:
        "Navigate to Disputes and select the remaining negative items. Generate dispute letters targeting " +
        "inaccurate information. For late payments, challenge the reported dates and request proof of payment history. " +
        "For accounts with errors, dispute specific fields like balance, payment status, or date of last activity.",
      whereToGo: "/disputes",
      estimatedImpact: `+${Math.min(40, otherNegative.length * 10)} points from corrections`,
      estimatedTimeline: "30-60 days per dispute round",
    });
  }

  // -------------------------------------------------------
  // 2. PAY DOWN HIGH UTILIZATION
  // -------------------------------------------------------
  const highUtilAccounts = creditData.accounts.filter(a => {
    if (a.creditLimit && a.creditLimit > 0 && a.balance !== null) {
      return (a.balance / a.creditLimit) * 100 > 30;
    }
    return false;
  });

  if (highUtilAccounts.length > 0) {
    // Sort by utilization percentage descending
    const sorted = [...highUtilAccounts].sort((a, b) => {
      const utilA = (a.balance || 0) / (a.creditLimit || 1);
      const utilB = (b.balance || 0) / (b.creditLimit || 1);
      return utilB - utilA;
    });

    const paydownTargets = sorted.slice(0, 3);
    const totalExcess = paydownTargets.reduce((sum, a) => {
      const target30 = (a.creditLimit || 0) * 0.3;
      return sum + Math.max(0, (a.balance || 0) - target30);
    }, 0);

    const utilDetails = paydownTargets
      .map(a => {
        const util = Math.round(((a.balance || 0) / (a.creditLimit || 1)) * 100);
        const target = Math.round((a.creditLimit || 0) * 0.3);
        return `${a.creditorName}: ${util}% used (pay to $${target.toLocaleString()} or less)`;
      })
      .join("; ");

    steps.push({
      stepNumber: stepNumber++,
      priority: highUtilAccounts.some(a => ((a.balance || 0) / (a.creditLimit || 1)) > 0.7) ? "HIGH" : "MEDIUM",
      category: "PAY_DOWN",
      title: `Pay Down ${highUtilAccounts.length} High-Utilization Account${highUtilAccounts.length > 1 ? "s" : ""}`,
      whatToDo:
        `Reduce balances on ${highUtilAccounts.length} account(s) to below 30% utilization. ` +
        `You need to pay down approximately $${Math.round(totalExcess).toLocaleString()} total.`,
      howToDoIt:
        `Focus on these accounts first: ${utilDetails}. ` +
        "For fastest score improvement, pay the highest-utilization cards first. " +
        "If possible, pay down to under 10% utilization for maximum FICO benefit. " +
        "Make payments before your statement closing date so the lower balance is reported to bureaus.",
      whereToGo: "/clients",
      estimatedImpact: "+20-40 points (utilization changes are reflected within 1-2 billing cycles)",
      estimatedTimeline: "1-2 months (immediate impact once reported)",
    });
  }

  // -------------------------------------------------------
  // 3. DTI IMPROVEMENT (if needed)
  // -------------------------------------------------------
  if (dtiResult && (dtiResult.status === "HIGH" || dtiResult.status === "CRITICAL")) {
    const priority: ActionPriority = dtiResult.status === "CRITICAL" ? "HIGH" : "MEDIUM";

    steps.push({
      stepNumber: stepNumber++,
      priority,
      category: "INCOME",
      title: "Improve Debt-to-Income Ratio",
      whatToDo:
        `Your estimated DTI is ${dtiResult.estimatedDTI.toFixed(1)}%, ` +
        `which exceeds the recommended maximum of ${dtiResult.maxRecommendedDTI}% for this product. ` +
        `You need to either reduce monthly debt payments or increase documented income.`,
      howToDoIt:
        productType === "MORTGAGE"
          ? "For mortgage approval: (1) Pay off small installment loans to eliminate their monthly payments. " +
            "(2) Pay down credit card balances to reduce minimum payments. " +
            "(3) Document all sources of income including bonuses, rental income, part-time work. " +
            "(4) If self-employed, ensure your tax returns show adequate income (avoid over-deducting). " +
            "(5) Consider a co-borrower to add their income to the application."
          : "To reduce DTI: (1) Pay off the smallest debt balances first to eliminate monthly payments entirely. " +
            "(2) Consolidate debts to a lower monthly payment if possible. " +
            "(3) Update your stated income if it has increased. " +
            "(4) Provide documentation for any additional income sources (side income, rental, investments).",
      whereToGo: "/clients",
      estimatedImpact: `Need to reach ${dtiResult.maxRecommendedDTI}% DTI or lower for approval`,
      estimatedTimeline: "1-3 months (depending on debt payoff strategy)",
    });
  }

  // -------------------------------------------------------
  // 4. BUILD CREDIT (thin file)
  // -------------------------------------------------------
  const isThinFile = creditData.accounts.length < 5;
  const positiveAccounts = creditData.accounts.filter(a => !a.isDisputable);

  if (isThinFile || positiveAccounts.length < 3) {
    steps.push({
      stepNumber: stepNumber++,
      priority: isThinFile ? "HIGH" : "MEDIUM",
      category: "BUILD_CREDIT",
      title: "Build Credit History",
      whatToDo:
        isThinFile
          ? `Your credit file has only ${creditData.accounts.length} account(s). ` +
            "Most lenders prefer to see 3-5+ accounts with positive history. " +
            "Adding positive tradelines will strengthen your profile."
          : `You have only ${positiveAccounts.length} positive account(s). Building additional positive history will strengthen your application.`,
      howToDoIt:
        "Consider these actions in order of effectiveness:\n" +
        "1. AUTHORIZED USER: Ask a family member with a long-standing, low-utilization credit card " +
        "to add you as an authorized user. Their positive history appears on your report immediately.\n" +
        "2. SECURED CREDIT CARD: Apply for a secured credit card (deposit-backed). " +
        "Use it for small purchases and pay in full monthly. Recommended: Discover it Secured, Capital One Secured.\n" +
        "3. CREDIT BUILDER LOAN: Services like Self or MoneyLion offer small loans that report " +
        "positive payment history to all three bureaus.\n" +
        "4. RENT REPORTING: Use Experian Boost or rent-reporting services to add positive payment " +
        "history from rent and utility payments.",
      whereToGo: "/clients",
      estimatedImpact: "+15-30 points over 3-6 months as new accounts age",
      estimatedTimeline: "3-6 months for meaningful impact",
    });
  }

  // -------------------------------------------------------
  // 5. INQUIRY MANAGEMENT
  // -------------------------------------------------------
  const inquiryCount = creditData.inquiryCount ?? 0;
  if (inquiryCount > 5) {
    steps.push({
      stepNumber: stepNumber++,
      priority: "MEDIUM",
      category: "WAIT",
      title: "Manage Hard Inquiries",
      whatToDo:
        `You have ${inquiryCount} hard inquiries in the last 24 months. ` +
        "Each hard inquiry can reduce your score by 3-5 points. " +
        "Avoid new credit applications while working on your credit readiness.",
      howToDoIt:
        "1. DISPUTE UNAUTHORIZED: Review your inquiries and dispute any you did not authorize. " +
        "Navigate to your credit report and identify inquiries from companies you don't recognize.\n" +
        "2. STOP APPLYING: Avoid any new credit applications until you're ready to apply for your target product. " +
        "Each new inquiry adds another 3-5 point hit.\n" +
        "3. RATE SHOPPING: When you are ready to apply for " +
        (productType === "MORTGAGE"
          ? "a mortgage, apply to multiple lenders within a 45-day window - FICO treats these as a single inquiry."
          : productType === "AUTO"
          ? "an auto loan, apply to multiple lenders within a 14-day window - FICO treats these as a single inquiry."
          : "your target product, complete all applications within a 14-day window to minimize inquiry impact."),
      whereToGo: "/disputes",
      estimatedImpact: "+5-15 points as inquiries age (automatic over time)",
      estimatedTimeline: "12-24 months for full inquiry recovery (inquiries stop scoring after 12 months)",
    });
  } else if (inquiryCount > 3) {
    steps.push({
      stepNumber: stepNumber++,
      priority: "LOW",
      category: "WAIT",
      title: "Limit New Credit Applications",
      whatToDo:
        `You have ${inquiryCount} hard inquiries. While not critical, ` +
        "limiting new applications will help your score recover.",
      howToDoIt:
        "Avoid opening new credit accounts unless necessary. " +
        "Each inquiry impacts your score for about 12 months. " +
        "If any inquiries were unauthorized, dispute them through your D2G dashboard.",
      whereToGo: "/disputes",
      estimatedImpact: "+5-10 points as inquiries age",
      estimatedTimeline: "Automatic improvement over 12 months",
    });
  }

  // -------------------------------------------------------
  // 6. PRODUCT-SPECIFIC ADVICE
  // -------------------------------------------------------
  if (productType === "MORTGAGE" && scoreGap.gap > 0) {
    steps.push({
      stepNumber: stepNumber++,
      priority: "LOW",
      category: "BUILD_CREDIT",
      title: "Prepare for Mortgage Application",
      whatToDo:
        "Beyond credit score, mortgage lenders evaluate additional factors. " +
        "Prepare these elements alongside your credit improvement.",
      howToDoIt:
        "1. EMPLOYMENT: Maintain 2+ years at your current employer (or in the same field if self-employed).\n" +
        "2. DOWN PAYMENT: Save for your down payment. FHA requires 3.5% minimum; conventional loans prefer 20%.\n" +
        "3. RESERVES: Have 2-6 months of mortgage payments in savings as cash reserves.\n" +
        "4. DOCUMENTATION: Gather 2 years of tax returns, W-2s, recent pay stubs, and 2 months of bank statements.\n" +
        "5. AVOID BIG CHANGES: Don't change jobs, make large purchases, or move money around before closing.",
      whereToGo: "/clients",
      estimatedImpact: "Required for mortgage approval regardless of credit score",
      estimatedTimeline: "Ongoing preparation",
    });
  }

  if (productType === "AUTO" && scoreGap.gap > 0) {
    steps.push({
      stepNumber: stepNumber++,
      priority: "LOW",
      category: "BUILD_CREDIT",
      title: "Prepare for Auto Loan Application",
      whatToDo:
        "Auto lenders use specialized scoring and consider additional factors beyond your credit score.",
      howToDoIt:
        "1. DOWN PAYMENT: A larger down payment (10-20%) reduces lender risk and improves your terms.\n" +
        "2. TRADE-IN: If trading in a vehicle, get your own valuation from KBB or Edmunds first.\n" +
        "3. PRE-APPROVAL: Get pre-approved from a credit union or bank before visiting dealerships. " +
        "This gives you negotiating leverage.\n" +
        "4. LOAN TERM: Keep the term to 60 months or less to get better rates.\n" +
        "5. If you have a previous auto loan with good payment history, this will boost your FICO Auto Score.",
      whereToGo: "/clients",
      estimatedImpact: "Better terms and lower interest rate",
      estimatedTimeline: "Prepare before applying",
    });
  }

  // -------------------------------------------------------
  // SORT AND RETURN
  // -------------------------------------------------------
  // Sort by priority, then by estimated impact
  const priorityOrder: Record<ActionPriority, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };

  steps.sort((a, b) => {
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    // Within same priority, keep original order (already sorted by impact)
    return a.stepNumber - b.stepNumber;
  });

  // Renumber steps after sorting
  steps.forEach((step, idx) => {
    step.stepNumber = idx + 1;
  });

  return steps;
}
