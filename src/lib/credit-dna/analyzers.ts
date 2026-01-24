/**
 * Credit DNA Engine - Component Analyzers
 *
 * Individual analysis functions for each aspect of the credit profile.
 * These feed into the main classifier to determine the DNA type.
 */

import {
  type AccountForAnalysis,
  type ScoreForAnalysis,
  type InquiryForAnalysis,
  type FileThicknessMetrics,
  type DerogatoryProfile,
  type UtilizationAnalysis,
  type BureauDivergence,
  type InquiryAnalysis,
  type PositiveFactors,
  type DisputeReadiness,
} from "./types";

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function monthsAgo(date: Date | null): number {
  if (!date) return 0;
  const now = new Date();
  const months = (now.getFullYear() - date.getFullYear()) * 12 +
    (now.getMonth() - date.getMonth());
  return Math.max(0, months);
}

function parseAccountType(type: string | null): string {
  if (!type) return "OTHER";
  const normalized = type.toUpperCase();

  if (normalized.includes("REVOLV") || normalized.includes("CREDIT CARD") || normalized.includes("CHARGE")) {
    return "REVOLVING";
  }
  if (normalized.includes("INSTALL") || normalized.includes("AUTO") || normalized.includes("CAR")) {
    return "INSTALLMENT";
  }
  if (normalized.includes("MORTGAGE") || normalized.includes("HOME") || normalized.includes("REAL ESTATE")) {
    return "MORTGAGE";
  }
  if (normalized.includes("STUDENT") || normalized.includes("EDUCATION")) {
    return "STUDENT_LOAN";
  }
  if (normalized.includes("COLLECTION") || normalized.includes("COLLECT")) {
    return "COLLECTION";
  }
  return "OTHER";
}

function isDerogatory(account: AccountForAnalysis): boolean {
  const status = (account.accountStatus || "").toUpperCase();
  const paymentStatus = (account.paymentStatus || "").toUpperCase();

  const derogStatuses = [
    "COLLECTION", "CHARGE", "CHARGED OFF", "CHARGEOFF",
    "DELINQUENT", "LATE", "PAST DUE", "WRITTEN OFF",
    "BANKRUPTCY", "REPOSSESSION", "FORECLOSURE", "JUDGMENT"
  ];

  return derogStatuses.some(s =>
    status.includes(s) || paymentStatus.includes(s)
  ) || account.detectedIssues.some(i =>
    i.severity === "HIGH" || i.severity === "CRITICAL"
  );
}

function isCollection(account: AccountForAnalysis): boolean {
  const type = parseAccountType(account.accountType);
  const status = (account.accountStatus || "").toUpperCase();
  return type === "COLLECTION" || status.includes("COLLECTION");
}

function isChargeOff(account: AccountForAnalysis): boolean {
  const status = (account.accountStatus || "").toUpperCase();
  const paymentStatus = (account.paymentStatus || "").toUpperCase();
  return status.includes("CHARGE") || paymentStatus.includes("CHARGE") ||
    status.includes("WRITTEN OFF");
}

function hasLatePayments(account: AccountForAnalysis): boolean {
  return account.detectedIssues.some(i =>
    i.code.includes("LATE") || i.code.includes("DELINQUENT")
  );
}

function countLatePaymentsByType(accounts: AccountForAnalysis[]): {
  late30: number;
  late60: number;
  late90: number;
  late120Plus: number;
} {
  let late30 = 0, late60 = 0, late90 = 0, late120Plus = 0;

  for (const account of accounts) {
    for (const issue of account.detectedIssues) {
      const code = issue.code.toUpperCase();
      if (code.includes("120") || code.includes("150") || code.includes("180")) {
        late120Plus++;
      } else if (code.includes("90")) {
        late90++;
      } else if (code.includes("60")) {
        late60++;
      } else if (code.includes("30") || code.includes("LATE")) {
        late30++;
      }
    }
  }

  return { late30, late60, late90, late120Plus };
}

function isOpen(account: AccountForAnalysis): boolean {
  const status = (account.accountStatus || "").toUpperCase();
  return status.includes("OPEN") || status.includes("CURRENT") ||
    status.includes("PAYS AS AGREED") || status === "ACTIVE";
}

// =============================================================================
// FILE THICKNESS ANALYZER
// =============================================================================

export function analyzeFileThickness(
  accounts: AccountForAnalysis[]
): FileThicknessMetrics {
  const totalAccounts = accounts.length;
  const openAccounts = accounts.filter(isOpen).length;
  const closedAccounts = totalAccounts - openAccounts;

  // Calculate ages
  const ages = accounts
    .map(a => monthsAgo(a.dateOpened))
    .filter(age => age > 0);

  const oldestAccountAge = ages.length > 0 ? Math.max(...ages) : 0;
  const newestAccountAge = ages.length > 0 ? Math.min(...ages) : 0;
  const averageAccountAge = ages.length > 0
    ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length)
    : 0;

  // Count by type
  const types = accounts.map(a => parseAccountType(a.accountType));
  const revolvingAccounts = types.filter(t => t === "REVOLVING").length;
  const installmentAccounts = types.filter(t => t === "INSTALLMENT" || t === "STUDENT_LOAN").length;
  const mortgageAccounts = types.filter(t => t === "MORTGAGE").length;
  const collectionAccounts = types.filter(t => t === "COLLECTION").length;
  const otherAccounts = types.filter(t => t === "OTHER").length;

  // Determine thickness classification
  let thickness: FileThicknessMetrics["thickness"];
  if (totalAccounts <= 2) {
    thickness = "ULTRA_THIN";
  } else if (totalAccounts <= 5) {
    thickness = "THIN";
  } else if (totalAccounts <= 10) {
    thickness = "MODERATE";
  } else if (totalAccounts <= 20) {
    thickness = "THICK";
  } else {
    thickness = "VERY_THICK";
  }

  return {
    totalAccounts,
    openAccounts,
    closedAccounts,
    oldestAccountAge,
    averageAccountAge,
    newestAccountAge,
    thickness,
    revolvingAccounts,
    installmentAccounts,
    mortgageAccounts,
    collectionAccounts,
    otherAccounts,
  };
}

// =============================================================================
// DEROGATORY PROFILE ANALYZER
// =============================================================================

export function analyzeDerogatoryProfile(
  accounts: AccountForAnalysis[]
): DerogatoryProfile {
  const derogatoryAccounts = accounts.filter(isDerogatory);
  const collections = accounts.filter(isCollection);
  const chargeOffs = accounts.filter(isChargeOff);
  const latePaymentAccounts = accounts.filter(hasLatePayments);

  const { late30, late60, late90, late120Plus } = countLatePaymentsByType(accounts);

  // Calculate balances
  const totalCollectionBalance = collections.reduce((sum, a) => sum + (a.balance || 0), 0);
  const totalChargeOffBalance = chargeOffs.reduce((sum, a) => sum + (a.balance || 0), 0);
  const totalPastDue = accounts.reduce((sum, a) => sum + (a.pastDue || 0), 0);

  // Calculate ages of derogatory items
  const derogAges = derogatoryAccounts
    .map(a => monthsAgo(a.dateReported || a.dateOpened))
    .filter(age => age > 0);

  const oldestDerogAge = derogAges.length > 0 ? Math.max(...derogAges) : 0;
  const newestDerogAge = derogAges.length > 0 ? Math.min(...derogAges) : 0;
  const averageDerogAge = derogAges.length > 0
    ? Math.round(derogAges.reduce((a, b) => a + b, 0) / derogAges.length)
    : 0;

  // Calculate severity score (0-100)
  let severityScore = 0;
  severityScore += collections.length * 15;         // Collections are heavy
  severityScore += chargeOffs.length * 20;          // Charge-offs are heavier
  severityScore += late30 * 3;
  severityScore += late60 * 5;
  severityScore += late90 * 8;
  severityScore += late120Plus * 12;

  // Recent damage is worse
  if (newestDerogAge < 12) severityScore *= 1.5;
  else if (newestDerogAge < 24) severityScore *= 1.25;

  // Cap at 100
  severityScore = Math.min(100, Math.round(severityScore));

  // Determine severity classification
  let severity: DerogatoryProfile["severity"];
  if (severityScore === 0) {
    severity = "NONE";
  } else if (severityScore <= 20) {
    severity = "LIGHT";
  } else if (severityScore <= 45) {
    severity = "MODERATE";
  } else if (severityScore <= 70) {
    severity = "HEAVY";
  } else {
    severity = "SEVERE";
  }

  return {
    totalDerogatoryItems: derogatoryAccounts.length,
    collectionCount: collections.length,
    chargeOffCount: chargeOffs.length,
    latePaymentAccounts: latePaymentAccounts.length,
    publicRecordCount: 0, // Would need additional data source
    late30Count: late30,
    late60Count: late60,
    late90Count: late90,
    late120PlusCount: late120Plus,
    totalCollectionBalance,
    totalChargeOffBalance,
    totalPastDue,
    oldestDerogAge,
    newestDerogAge,
    averageDerogAge,
    severityScore,
    severity,
  };
}

// =============================================================================
// UTILIZATION ANALYZER
// =============================================================================

export function analyzeUtilization(
  accounts: AccountForAnalysis[]
): UtilizationAnalysis {
  // Only analyze revolving accounts for utilization
  const revolvingAccounts = accounts.filter(a => {
    const type = parseAccountType(a.accountType);
    return type === "REVOLVING" && isOpen(a);
  });

  const totalCreditLimit = revolvingAccounts.reduce((sum, a) => sum + (a.creditLimit || 0), 0);
  const totalBalance = revolvingAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);

  const overallUtilization = totalCreditLimit > 0
    ? Math.round((totalBalance / totalCreditLimit) * 100)
    : 0;

  // Analyze individual accounts
  let accountsOver30 = 0, accountsOver50 = 0, accountsOver70 = 0;
  let accountsOver90 = 0, accountsMaxed = 0;
  let accountsUnder10 = 0, accountsUnder30 = 0;

  for (const account of revolvingAccounts) {
    if (!account.creditLimit || account.creditLimit === 0) continue;

    const util = (account.balance || 0) / account.creditLimit * 100;

    if (util < 10) accountsUnder10++;
    if (util < 30) accountsUnder30++;
    if (util > 30) accountsOver30++;
    if (util > 50) accountsOver50++;
    if (util > 70) accountsOver70++;
    if (util > 90) accountsOver90++;
    if (util >= 95) accountsMaxed++;
  }

  // Determine status
  let status: UtilizationAnalysis["status"];
  if (overallUtilization <= 10) {
    status = "EXCELLENT";
  } else if (overallUtilization <= 30) {
    status = "GOOD";
  } else if (overallUtilization <= 50) {
    status = "FAIR";
  } else if (overallUtilization <= 70) {
    status = "POOR";
  } else {
    status = "CRITICAL";
  }

  // Estimate score impact (rough heuristic)
  let estimatedScoreImpact = 0;
  if (overallUtilization > 30) estimatedScoreImpact += 10;
  if (overallUtilization > 50) estimatedScoreImpact += 15;
  if (overallUtilization > 70) estimatedScoreImpact += 20;
  if (overallUtilization > 90) estimatedScoreImpact += 25;
  estimatedScoreImpact += accountsMaxed * 5;

  return {
    totalCreditLimit,
    totalBalance,
    overallUtilization,
    accountsOver30Percent: accountsOver30,
    accountsOver50Percent: accountsOver50,
    accountsOver70Percent: accountsOver70,
    accountsOver90Percent: accountsOver90,
    accountsMaxedOut: accountsMaxed,
    accountsUnder10Percent: accountsUnder10,
    accountsUnder30Percent: accountsUnder30,
    status,
    estimatedScoreImpact,
  };
}

// =============================================================================
// BUREAU DIVERGENCE ANALYZER
// =============================================================================

export function analyzeBureauDivergence(
  accounts: AccountForAnalysis[]
): BureauDivergence {
  // Group accounts by fingerprint to find same account across bureaus
  const accountsByFingerprint = new Map<string, AccountForAnalysis[]>();

  for (const account of accounts) {
    const existing = accountsByFingerprint.get(account.fingerprint) || [];
    existing.push(account);
    accountsByFingerprint.set(account.fingerprint, existing);
  }

  // Analyze presence across bureaus
  let accountsOnAllThree = 0;
  let accountsOnTwoOnly = 0;
  let accountsOnOneOnly = 0;
  let accountsWithBalanceDivergence = 0;
  let accountsWithStatusDivergence = 0;
  let maxBalanceDivergence = 0;

  const missingFromBureaus: BureauDivergence["missingFromBureaus"] = [];

  for (const [fingerprint, accts] of accountsByFingerprint) {
    const bureaus = [...new Set(accts.map(a => a.cra))];

    if (bureaus.length === 3) {
      accountsOnAllThree++;
    } else if (bureaus.length === 2) {
      accountsOnTwoOnly++;

      // Determine which bureau is missing
      const allBureaus = ["TRANSUNION", "EXPERIAN", "EQUIFAX"];
      const missingFrom = allBureaus.filter(b => !bureaus.includes(b as "TRANSUNION" | "EXPERIAN" | "EQUIFAX"));

      if (missingFrom.length > 0) {
        missingFromBureaus.push({
          accountName: accts[0].creditorName,
          presentOn: bureaus,
          missingFrom,
        });
      }
    } else {
      accountsOnOneOnly++;
    }

    // Check for balance divergence (same account, different balances)
    if (accts.length > 1) {
      const balances = accts.map(a => a.balance || 0).filter(b => b > 0);
      if (balances.length > 1) {
        const minBalance = Math.min(...balances);
        const maxBalance = Math.max(...balances);
        const divergence = maxBalance - minBalance;

        if (divergence > 100) { // More than $100 difference
          accountsWithBalanceDivergence++;
          maxBalanceDivergence = Math.max(maxBalanceDivergence, divergence);
        }
      }

      // Check for status divergence
      const statuses = [...new Set(accts.map(a => (a.accountStatus || "").toUpperCase()))];
      if (statuses.length > 1) {
        accountsWithStatusDivergence++;
      }
    }
  }

  // Count by bureau
  const transunionAccountCount = accounts.filter(a => a.cra === "TRANSUNION").length;
  const experianAccountCount = accounts.filter(a => a.cra === "EXPERIAN").length;
  const equifaxAccountCount = accounts.filter(a => a.cra === "EQUIFAX").length;

  // Calculate divergence score (0-100)
  const totalUnique = accountsByFingerprint.size;
  let divergenceScore = 0;

  if (totalUnique > 0) {
    // Penalty for accounts not on all three
    divergenceScore += (accountsOnOneOnly / totalUnique) * 40;
    divergenceScore += (accountsOnTwoOnly / totalUnique) * 20;

    // Penalty for balance/status divergence
    divergenceScore += (accountsWithBalanceDivergence / totalUnique) * 25;
    divergenceScore += (accountsWithStatusDivergence / totalUnique) * 15;
  }

  divergenceScore = Math.min(100, Math.round(divergenceScore));

  // Classify divergence
  let divergence: BureauDivergence["divergence"];
  if (divergenceScore <= 10) {
    divergence = "ALIGNED";
  } else if (divergenceScore <= 25) {
    divergence = "MINOR";
  } else if (divergenceScore <= 45) {
    divergence = "MODERATE";
  } else if (divergenceScore <= 70) {
    divergence = "SIGNIFICANT";
  } else {
    divergence = "SEVERE";
  }

  return {
    accountsOnAllThree,
    accountsOnTwoOnly,
    accountsOnOneOnly,
    transunionAccountCount,
    experianAccountCount,
    equifaxAccountCount,
    accountsWithBalanceDivergence,
    maxBalanceDivergence,
    accountsWithStatusDivergence,
    divergenceScore,
    divergence,
    missingFromBureaus: missingFromBureaus.slice(0, 10), // Limit to 10
  };
}

// =============================================================================
// INQUIRY ANALYZER
// =============================================================================

export function analyzeInquiries(
  inquiries: InquiryForAnalysis[]
): InquiryAnalysis {
  const now = new Date();

  // Parse dates and calculate months ago
  const parsedInquiries = inquiries.map(inq => ({
    ...inq,
    monthsAgo: (() => {
      const date = new Date(inq.inquiryDate);
      return (now.getFullYear() - date.getFullYear()) * 12 +
        (now.getMonth() - date.getMonth());
    })(),
  }));

  const totalHardInquiries = inquiries.length;

  // Time-based breakdown
  const inquiriesLast6Months = parsedInquiries.filter(i => i.monthsAgo <= 6).length;
  const inquiriesLast12Months = parsedInquiries.filter(i => i.monthsAgo <= 12).length;
  const inquiriesLast24Months = parsedInquiries.filter(i => i.monthsAgo <= 24).length;

  // Bureau breakdown
  const transunionInquiries = inquiries.filter(i => i.cra === "TRANSUNION").length;
  const experianInquiries = inquiries.filter(i => i.cra === "EXPERIAN").length;
  const equifaxInquiries = inquiries.filter(i => i.cra === "EQUIFAX").length;

  // Estimate score impact (each recent inquiry ~3-5 points)
  let estimatedScoreImpact = inquiriesLast6Months * 5 +
    (inquiriesLast12Months - inquiriesLast6Months) * 3 +
    (inquiriesLast24Months - inquiriesLast12Months) * 1;

  // Determine status
  let status: InquiryAnalysis["status"];
  if (inquiriesLast12Months === 0) {
    status = "MINIMAL";
  } else if (inquiriesLast12Months <= 2) {
    status = "LIGHT";
  } else if (inquiriesLast12Months <= 5) {
    status = "MODERATE";
  } else if (inquiriesLast12Months <= 10) {
    status = "HEAVY";
  } else {
    status = "EXCESSIVE";
  }

  // Calculate months until oldest countable inquiry drops off (2 years)
  const oldestRecentInquiry = Math.max(...parsedInquiries
    .filter(i => i.monthsAgo <= 24)
    .map(i => i.monthsAgo));
  const monthsUntilDropOff = oldestRecentInquiry > 0 ? 24 - oldestRecentInquiry : 0;

  return {
    totalHardInquiries,
    inquiriesLast6Months,
    inquiriesLast12Months,
    inquiriesLast24Months,
    transunionInquiries,
    experianInquiries,
    equifaxInquiries,
    estimatedScoreImpact,
    status,
    monthsUntilDropOff,
    inquiriesDisputable: 0, // Would need additional logic to determine
  };
}

// =============================================================================
// POSITIVE FACTORS ANALYZER
// =============================================================================

export function analyzePositiveFactors(
  accounts: AccountForAnalysis[]
): PositiveFactors {
  const openAccounts = accounts.filter(isOpen);
  const nonCollectionAccounts = accounts.filter(a => !isCollection(a));

  // Payment history
  const accountsWithHistory = nonCollectionAccounts.filter(a => a.dateOpened);
  const perfectPaymentAccounts = accountsWithHistory.filter(a =>
    !hasLatePayments(a) && !isDerogatory(a)
  ).length;

  const onTimePaymentPercentage = accountsWithHistory.length > 0
    ? Math.round((perfectPaymentAccounts / accountsWithHistory.length) * 100)
    : 0;

  // Account age
  const ages = accounts.map(a => monthsAgo(a.dateOpened)).filter(age => age > 0);
  const hasSeasonedAccounts = ages.some(age => age >= 60); // 5 years
  const oldestPositiveAccount = Math.max(
    ...nonCollectionAccounts
      .filter(a => !isDerogatory(a))
      .map(a => monthsAgo(a.dateOpened))
      .filter(age => age > 0),
    0
  );

  // Credit mix
  const types = accounts.map(a => parseAccountType(a.accountType));
  const hasMortgage = types.includes("MORTGAGE");
  const hasAutoLoan = types.some(t => t === "INSTALLMENT"); // Simplified
  const hasStudentLoan = types.includes("STUDENT_LOAN");
  const hasRevolvingCredit = types.includes("REVOLVING");

  // Credit mix score (0-100)
  let creditMixScore = 0;
  if (hasRevolvingCredit) creditMixScore += 30;
  if (hasAutoLoan || hasStudentLoan) creditMixScore += 25;
  if (hasMortgage) creditMixScore += 35;
  if (types.filter(t => t !== "COLLECTION" && t !== "OTHER").length >= 3) {
    creditMixScore += 10;
  }

  // Well-managed accounts (open, no lates, reasonable utilization)
  const wellManagedAccounts = openAccounts.filter(a => {
    if (isDerogatory(a) || hasLatePayments(a)) return false;
    if (a.creditLimit && a.balance) {
      const util = (a.balance / a.creditLimit) * 100;
      return util <= 30;
    }
    return true;
  }).length;

  // Overall strength score
  let strengthScore = 0;
  strengthScore += onTimePaymentPercentage * 0.35; // 35% weight
  strengthScore += creditMixScore * 0.2;            // 20% weight
  strengthScore += (hasSeasonedAccounts ? 25 : oldestPositiveAccount / 60 * 25); // 25% weight
  strengthScore += Math.min(20, wellManagedAccounts * 4); // 20% weight (max 20)

  strengthScore = Math.round(strengthScore);

  // Classify strength
  let strength: PositiveFactors["strength"];
  if (strengthScore >= 80) {
    strength = "EXCELLENT";
  } else if (strengthScore >= 60) {
    strength = "STRONG";
  } else if (strengthScore >= 40) {
    strength = "MODERATE";
  } else if (strengthScore >= 20) {
    strength = "FAIR";
  } else {
    strength = "WEAK";
  }

  return {
    onTimePaymentPercentage,
    perfectPaymentAccounts,
    hasSeasonedAccounts,
    oldestPositiveAccount,
    hasMortgage,
    hasAutoLoan,
    hasStudentLoan,
    hasRevolvingCredit,
    creditMixScore,
    wellManagedAccounts,
    strengthScore,
    strength,
  };
}

// =============================================================================
// DISPUTE READINESS ANALYZER
// =============================================================================

export function analyzeDisputeReadiness(
  accounts: AccountForAnalysis[],
  derogatoryProfile: DerogatoryProfile,
  bureauDivergence: BureauDivergence
): DisputeReadiness {
  // Find disputable items
  const disputableAccounts = accounts.filter(a =>
    isDerogatory(a) || isCollection(a) || a.detectedIssues.length > 0
  );

  // Prioritize items
  const highPriority = disputableAccounts.filter(a => {
    // High balance collections/charge-offs, recent negative items
    const isHighBalance = (a.balance || 0) > 1000;
    const isRecent = monthsAgo(a.dateReported || a.dateOpened) < 24;
    return (isCollection(a) || isChargeOff(a)) && (isHighBalance || isRecent);
  });

  const mediumPriority = disputableAccounts.filter(a => {
    return !highPriority.includes(a) && (isCollection(a) || isChargeOff(a) || hasLatePayments(a));
  });

  const lowPriority = disputableAccounts.filter(a => {
    return !highPriority.includes(a) && !mediumPriority.includes(a);
  });

  // Estimate removal rate based on item types
  let estimatedRemovalRate = 30; // Base rate
  if (derogatoryProfile.collectionCount > 0) estimatedRemovalRate += 10;
  if (derogatoryProfile.averageDerogAge > 48) estimatedRemovalRate += 15; // Older items more likely to be removed
  if (bureauDivergence.divergenceScore > 30) estimatedRemovalRate += 10;
  estimatedRemovalRate = Math.min(75, estimatedRemovalRate); // Cap at 75%

  // Estimate score improvement
  const estimatedScoreImprovement = Math.round(
    (highPriority.length * 15 + mediumPriority.length * 8 + lowPriority.length * 3) *
    (estimatedRemovalRate / 100)
  );

  // Determine recommended flow
  let recommendedFlow: DisputeReadiness["recommendedFlow"] = "ACCURACY";
  if (derogatoryProfile.collectionCount >= 3) {
    recommendedFlow = "COLLECTION";
  } else if (derogatoryProfile.collectionCount > 0 && derogatoryProfile.chargeOffCount > 0) {
    recommendedFlow = "COMBO";
  }

  // Determine best starting bureau (one with most issues or divergence)
  const bureauCounts = {
    TRANSUNION: accounts.filter(a => a.cra === "TRANSUNION" && isDerogatory(a)).length,
    EXPERIAN: accounts.filter(a => a.cra === "EXPERIAN" && isDerogatory(a)).length,
    EQUIFAX: accounts.filter(a => a.cra === "EQUIFAX" && isDerogatory(a)).length,
  };

  let recommendedFirstBureau: DisputeReadiness["recommendedFirstBureau"] = "TRANSUNION";
  if (bureauCounts.EXPERIAN > bureauCounts.TRANSUNION && bureauCounts.EXPERIAN > bureauCounts.EQUIFAX) {
    recommendedFirstBureau = "EXPERIAN";
  } else if (bureauCounts.EQUIFAX > bureauCounts.TRANSUNION) {
    recommendedFirstBureau = "EQUIFAX";
  }

  // Estimate rounds needed
  const estimatedRounds = Math.max(2, Math.min(8,
    Math.ceil(disputableAccounts.length / 4) + // ~4 items per round
    (derogatoryProfile.severity === "SEVERE" ? 2 : 0) +
    (bureauDivergence.divergence === "SEVERE" ? 1 : 0)
  ));

  // Complexity score
  let complexityScore = 0;
  complexityScore += disputableAccounts.length * 3;
  complexityScore += derogatoryProfile.severityScore * 0.3;
  complexityScore += bureauDivergence.divergenceScore * 0.2;
  if (recommendedFlow === "COMBO") complexityScore += 15;
  complexityScore = Math.min(100, Math.round(complexityScore));

  // Classify complexity
  let complexity: DisputeReadiness["complexity"];
  if (complexityScore <= 25) {
    complexity = "SIMPLE";
  } else if (complexityScore <= 50) {
    complexity = "MODERATE";
  } else if (complexityScore <= 75) {
    complexity = "COMPLEX";
  } else {
    complexity = "VERY_COMPLEX";
  }

  return {
    totalDisputableItems: disputableAccounts.length,
    highPriorityItems: highPriority.length,
    mediumPriorityItems: mediumPriority.length,
    lowPriorityItems: lowPriority.length,
    estimatedRemovalRate,
    estimatedScoreImprovement,
    recommendedFlow,
    recommendedFirstBureau,
    estimatedRounds,
    complexityScore,
    complexity,
  };
}
