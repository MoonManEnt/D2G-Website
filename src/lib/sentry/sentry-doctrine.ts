/**
 * SENTRY DOCTRINE
 *
 * The immutable rules engine for the Sentry Dispute system.
 * These rules define what makes a legally sound, e-OSCAR optimized,
 * and OCR-resistant dispute letter.
 *
 * DOCTRINE PRINCIPLES:
 * 1. Legal Accuracy First - Only use validated FCRA/FDCPA citations
 * 2. e-OSCAR Optimization - Target specific codes, never generic 112
 * 3. OCR Resistance - Avoid frivolous detection patterns
 * 4. Metro 2 Precision - Challenge specific data fields
 * 5. Evidence-Based - Success predictions based on real data
 */

import type {
  SentryFlowType,
  SentryCRA,
  LegalCitation,
  InvalidCitation,
  CaseLaw,
} from "@/types/sentry";

// =============================================================================
// DOCTRINE RULES
// =============================================================================

export const SENTRY_DOCTRINE = {
  /**
   * VERSION
   */
  version: "1.0.0",

  /**
   * ROUND PROGRESSION RULES
   */
  roundRules: {
    // R1 always backdated 30 days
    r1BackdateDays: 30,

    // R2+ never backdated
    r2PlusBackdateDays: 0,

    // Maximum rounds before CFPB escalation recommended
    maxRoundsBeforeCFPB: 3,

    // Maximum total rounds
    maxRounds: 12,

    // Tone escalation by round (1-10 scale)
    toneByRound: {
      1: 3, // Polite but firm
      2: 5, // Frustrated
      3: 6, // Fed up
      4: 7, // Warning
      5: 8, // Demanding
      6: 8, // Demanding
      7: 9, // Litigation ready
      8: 9,
      9: 10,
      10: 10,
      11: 10,
      12: 10,
    } as Record<number, number>,
  },

  /**
   * FLOW RULES
   */
  flowRules: {
    // Collection flow switches to Accuracy for R5-R7
    collectionSwitchToAccuracyRounds: [5, 6, 7],

    // Combo flow follows same switch
    comboSwitchToAccuracyRounds: [5, 6, 7],

    // Minimum items per dispute
    minItemsPerDispute: 1,

    // Maximum items per dispute (to avoid frivolous flagging)
    maxItemsPerDispute: 10,
  },

  /**
   * E-OSCAR CODE RULES
   */
  eoscarRules: {
    // NEVER use these codes (lowest priority, batch verified)
    prohibitedCodes: ["112"],

    // High-value codes that force specific investigation
    highValueCodes: ["105", "106", "107", "108", "109"],

    // Identity codes for fraud/not-mine disputes
    identityCodes: ["001", "002", "103", "104"],

    // Collection-specific codes
    collectionCodes: ["006", "012", "014", "023", "024"],

    // Code conflicts (don't use together)
    codeConflicts: {
      "001": ["106", "109"], // Can't dispute payment details on account you claim isn't yours
      "103": ["106", "109"], // Same for fraud claims
      "006": ["012"], // Can't be unaware AND claim paid before collection
    } as Record<string, string[]>,
  },

  /**
   * LEGAL CITATION RULES
   */
  citationRules: {
    // FDCPA statutes only apply to debt collectors, NOT CRAs
    fdcpaOnlyStatutes: ["1692g", "1692e", "1692f", "1692c", "1692j"],

    // Criminal statutes consumers cannot prosecute
    criminalStatutes: ["1681q", "1681r"],

    // Commonly misapplied statutes that MUST be rejected
    invalidStatutes: [
      "1681a(d)(2)", // "Excluded information" theory
      "1681a(4)", // Definition only
      "1681a(m)", // About credit apps
      "1681b(a)(2)", // Written consent myth
    ],

    // Required primary statute by flow
    primaryStatuteByFlow: {
      ACCURACY: "15 USC 1681e(b)",
      COLLECTION: "15 USC 1681e(b)", // NOT 1692g to CRA
      CONSENT: "15 USC 1681b(f)",
      COMBO: "15 USC 1681e(b)",
    } as Record<SentryFlowType, string>,
  },

  /**
   * OCR FRIVOLOUS DETECTION RULES
   */
  ocrRules: {
    // Minimum safety score to allow letter generation
    minSafetyScore: 50,

    // Target safety score for generated letters
    targetSafetyScore: 80,

    // High-risk phrases that trigger flagging (exact strings)
    highRiskPhrases: [
      "I demand you delete",
      "delete the illegal items",
      "broken the law",
      "criminal debt collector",
      "serious punishment",
      "intend to litigate",
      "5 figure lawsuit",
      "6 figure lawsuit",
      "defamation of character",
      "criminal penalty",
    ],

    // Medium-risk phrases
    mediumRiskPhrases: [
      "may have to pay",
      "seek damages",
      "contact lawyers",
      "legal action",
      "federal court",
    ],

    // Point deductions
    highRiskDeduction: 15,
    mediumRiskDeduction: 8,
    lowRiskDeduction: 3,
  },

  /**
   * METRO 2 FIELD RULES
   */
  metro2Rules: {
    // Required fields to challenge for accuracy disputes
    accuracyTargetFields: ["DOFD", "BALANCE", "PAYMENT_RATING", "ACCOUNT_STATUS"],

    // Required fields for collection disputes
    collectionTargetFields: ["DOFD", "BALANCE", "ACCOUNT_STATUS", "HIGH_CREDIT"],

    // Fields that commonly have discrepancies across bureaus
    highDiscrepancyFields: ["DOFD", "DATE_OPENED", "HIGH_CREDIT", "BALANCE"],
  },

  /**
   * CONTENT UNIQUENESS RULES
   */
  uniquenessRules: {
    // Never reuse exact letter content
    enforceUniqueContent: true,

    // Include randomized human story in R1
    includeStoryInR1: true,

    // Vary sentence structure
    varySentenceStructure: true,
  },

  /**
   * DEADLINE RULES
   */
  deadlineRules: {
    // FCRA standard response deadline
    fcraDeadlineDays: 30,

    // Extended deadline if ID documents requested
    extendedDeadlineDays: 45,

    // Method of Verification request deadline
    movRequestDays: 15,
  },
} as const;

// =============================================================================
// VERIFIED LEGAL CITATIONS DATABASE
// =============================================================================

export const SENTRY_VALID_CITATIONS: LegalCitation[] = [
  // FCRA - CRA DUTIES
  {
    statute: "15 USC 1681e(b)",
    name: "Maximum Possible Accuracy",
    shortName: "Maximum Possible Accuracy",
    shortDescription: "CRAs must assure maximum possible accuracy",
    fullText:
      "CRAs must follow reasonable procedures to assure maximum possible accuracy of the information concerning the individual about whom the report relates",
    applicableTo: ["CRA"],
    useFor: [
      "ANY inaccuracy dispute",
      "data discrepancies across bureaus",
      "incomplete information",
      "outdated information",
    ],
    neverUseFor: [],
    caseSupport: [
      {
        name: "Cushman v. TransUnion",
        citation: "115 F.3d 220 (3d Cir. 1997)",
        holding: "CRA cannot blindly accept furnisher verification",
        useFor: "Method of verification challenges",
      },
    ],
  },
  {
    statute: "15 USC 1681i(a)(1)(A)",
    name: "Reinvestigation Duty",
    shortName: "Reinvestigation Duty",
    shortDescription: "CRA must reinvestigate disputed information within 30 days",
    fullText:
      "CRA must conduct reasonable reinvestigation to determine whether the disputed information is inaccurate within 30 days",
    applicableTo: ["CRA"],
    useFor: ["R2+ disputes", "inadequate investigation claims", "rubber stamp challenges"],
    neverUseFor: [],
    caseSupport: [
      {
        name: "Stevenson v. TRW Inc.",
        citation: "5th Cir. 1993",
        holding: "Reinvestigation must be more than rubber stamp verification",
        useFor: "Investigation quality challenges",
      },
    ],
  },
  {
    statute: "15 USC 1681i(a)(5)(A)",
    name: "Deletion Requirement",
    shortName: "Deletion Requirement",
    shortDescription: "Unverified information must be deleted within 5 days",
    fullText:
      "If information cannot be verified, CRA must delete the item within 5 days of completing reinvestigation",
    applicableTo: ["CRA"],
    useFor: ["Post-investigation deletion demands", "unverified item removal"],
    neverUseFor: [],
    caseSupport: [],
  },
  {
    statute: "15 USC 1681i(a)(6)(B)(iii)",
    name: "Method of Verification",
    shortName: "Method of Verification",
    shortDescription: "CRA must disclose verification procedure on request",
    fullText:
      "Upon consumer request, CRA must provide description of the procedure used to determine accuracy and completeness",
    applicableTo: ["CRA"],
    useFor: ["R5+ disputes", "MOV requests", "investigation transparency"],
    neverUseFor: [],
    caseSupport: [],
  },
  {
    statute: "15 USC 1681c(c)(1)",
    name: "Date of First Delinquency",
    shortName: "Date of First Delinquency",
    shortDescription: "DOFD determines 7-year reporting period",
    fullText:
      "DOFD determines when 7-year reporting period begins for delinquent accounts",
    applicableTo: ["CRA", "FURNISHER"],
    useFor: ["DOFD disputes", "re-aging challenges", "reporting period disputes"],
    neverUseFor: [],
    caseSupport: [],
  },
  {
    statute: "15 USC 1681s-2(b)",
    name: "Furnisher Investigation Duty",
    shortName: "Furnisher Investigation Duty",
    shortDescription: "Furnisher must investigate after receiving CRA notice",
    fullText:
      "After receiving dispute notice from CRA, furnisher must conduct investigation and report results",
    applicableTo: ["FURNISHER"],
    useFor: ["Direct furnisher disputes", "furnisher liability claims"],
    neverUseFor: ["CRA-only disputes"],
    caseSupport: [
      {
        name: "Gorman v. Wolpoff & Abramson",
        citation: "4th Cir. 2009",
        holding: "Furnisher must conduct reasonable investigation",
        useFor: "Furnisher dispute challenges",
      },
    ],
  },
  {
    statute: "15 USC 1681b(f)",
    name: "Unauthorized Hard Inquiry",
    shortName: "Unauthorized Hard Inquiry",
    shortDescription: "Reports require consumer authorization or permissible purpose",
    fullText:
      "Person may not obtain consumer report unless authorized by consumer or has permissible purpose",
    applicableTo: ["CRA"],
    useFor: ["Unauthorized inquiry disputes", "fraud claims"],
    neverUseFor: ["Soft inquiry disputes"],
    caseSupport: [],
  },
  {
    statute: "15 USC 1681c-1",
    name: "Identity Theft Block",
    shortName: "Identity Theft Block",
    shortDescription: "CRA must block identity theft information",
    fullText:
      "CRA must block information resulting from identity theft if consumer provides identity theft report",
    applicableTo: ["CRA"],
    useFor: ["Identity theft disputes", "fraud account blocking"],
    neverUseFor: ["Non-fraud disputes"],
    caseSupport: [],
  },
  {
    statute: "15 USC 1681c-2",
    name: "Extended Fraud Alert",
    shortName: "Extended Fraud Alert",
    shortDescription: "7-year extended fraud alert available with ID theft report",
    fullText:
      "Consumer may request extended fraud alert lasting 7 years with identity theft report",
    applicableTo: ["CRA"],
    useFor: ["Extended fraud protection"],
    neverUseFor: [],
    caseSupport: [],
  },
  // FDCPA - COLLECTOR ONLY
  {
    statute: "15 USC 1692e(8)",
    name: "False Credit Information",
    shortName: "False Credit Information",
    shortDescription: "Collectors cannot communicate known false credit information",
    fullText:
      "Debt collector may not communicate credit information which is known to be false",
    applicableTo: ["COLLECTOR"],
    useFor: ["Direct collector disputes", "false reporting claims"],
    neverUseFor: ["CRA disputes - collectors only"],
    commonMisuse: "Often incorrectly used in CRA letters",
    caseSupport: [],
  },
  {
    statute: "15 USC 1692g",
    name: "Debt Validation",
    shortName: "Debt Validation",
    shortDescription: "Collector must provide validation notice within 5 days",
    fullText:
      "Collector must provide validation notice within 5 days of initial communication",
    applicableTo: ["COLLECTOR"],
    useFor: ["Direct collector validation requests", "dunning letter challenges"],
    neverUseFor: ["CRA disputes - collectors only"],
    commonMisuse: "Frequently misapplied to CRA letters",
    caseSupport: [
      {
        name: "Semper v. JBC Legal Group",
        citation: "3d Cir. 2020",
        holding: "Furnisher knowledge of dispute triggers FDCPA duties",
        useFor: "Collection validation",
      },
    ],
  },
];

// =============================================================================
// INVALID CITATIONS DATABASE (DO NOT USE)
// =============================================================================

export const SENTRY_INVALID_CITATIONS: InvalidCitation[] = [
  {
    statute: "15 USC 1681a(d)(2)",
    commonClaim: 'Accounts are "excluded information" and cannot be reported',
    whyItFails:
      "This defines what is NOT a consumer report (raw transaction data exchanged between affiliates). It does NOT prohibit credit account reporting.",
    correctApproach: "Use 15 USC 1681e(b) for accuracy-based disputes",
  },
  {
    statute: "15 USC 1681a(4)",
    commonClaim: "Privacy invasion / information used without consent",
    whyItFails:
      "This is a DEFINITION section only. It defines terms. There is no cause of action here.",
    correctApproach: "Use 15 USC 1681b(f) for unauthorized access claims",
  },
  {
    statute: "15 USC 1681a(m)",
    commonClaim: "Transaction not initiated by consumer",
    whyItFails:
      "This statute is about material misrepresentation in credit APPLICATIONS, not about credit reporting.",
    correctApproach: "Use 15 USC 1681e(b) for accuracy disputes",
  },
  {
    statute: "15 USC 1681b(a)(2)",
    commonClaim: "No written consent means no permissible purpose",
    whyItFails:
      "This is ONE of several permissible purposes. Credit reporting typically uses 1681b(a)(3)(A) - credit transaction initiated by consumer. Written consent is not required for all reporting.",
    correctApproach:
      "Only use 1681b(f) for actual unauthorized inquiries, not for account reporting",
  },
  {
    statute: "15 USC 1692g (to CRA)",
    commonClaim: "CRA must validate debt like collector",
    whyItFails:
      "FDCPA (1692) applies to DEBT COLLECTORS only. CRAs are not debt collectors. Courts consistently reject this theory.",
    correctApproach: "Use 15 USC 1681i for CRA investigation requirements",
  },
  {
    statute: "15 USC 1692c(c)(2)",
    commonClaim: "Credit reporting is illegal communication",
    whyItFails:
      'Courts have consistently held that credit reporting is NOT "communication" under the FDCPA cease communication provisions.',
    correctApproach: "Use FCRA provisions for credit reporting disputes",
  },
  {
    statute: "15 USC 1681q",
    commonClaim: "Criminal penalties apply to CRA",
    whyItFails:
      "This is a CRIMINAL statute. Private citizens cannot prosecute criminal statutes. Only government prosecutors can.",
    correctApproach: "Use 15 USC 1681n/o for civil remedies",
  },
];

// =============================================================================
// VERIFIED CASE LAW DATABASE
// =============================================================================

export const SENTRY_CASE_LAW: CaseLaw[] = [
  {
    name: "Cushman v. TransUnion",
    citation: "115 F.3d 220 (3d Cir. 1997)",
    holding: "CRA cannot blindly accept furnisher verification without independent review",
    useFor: "Method of verification challenges, R2+ disputes",
  },
  {
    name: "Stevenson v. TRW Inc.",
    citation: "5th Cir. 1993",
    holding: "Reinvestigation must be more than a rubber stamp verification process",
    useFor: "Investigation quality challenges",
  },
  {
    name: "Dennis v. BEH-1, LLC",
    citation: "11th Cir. 2015",
    holding: "Furnisher cannot simply parrot same information after dispute",
    useFor: "Repeated verification challenges",
  },
  {
    name: "Gorman v. Wolpoff & Abramson",
    citation: "4th Cir. 2009",
    holding: "Furnisher must conduct reasonable investigation when notified of dispute",
    useFor: "Direct furnisher disputes",
  },
  {
    name: "Grigoryan v. Experian Info. Solutions",
    citation: "C.D. Cal. 2018",
    holding: "1099-C discharge affects accuracy of reported balance",
    useFor: "Discharged debt disputes",
  },
  {
    name: "Semper v. JBC Legal Group",
    citation: "3d Cir. 2020",
    holding: "Furnisher knowledge of dispute triggers investigation duties",
    useFor: "FDCPA + FCRA intersection",
  },
  {
    name: "Saunders v. Branch Banking & Trust",
    citation: "4th Cir. 2008",
    holding: "CRA must go beyond surface level inquiry in investigation",
    useFor: "Investigation adequacy",
  },
];

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validate letter content against Sentry Doctrine rules
 */
export function validateAgainstDoctrine(
  letterContent: string,
  flow: SentryFlowType,
  round: number,
  targetType: "CRA" | "FURNISHER" | "COLLECTOR"
): {
  isValid: boolean;
  violations: string[];
  warnings: string[];
} {
  const violations: string[] = [];
  const warnings: string[] = [];
  const lowerContent = letterContent.toLowerCase();

  // Check for prohibited e-OSCAR code mentions
  if (lowerContent.includes("code 112") || lowerContent.includes("generic dispute")) {
    warnings.push("Avoid generic dispute language that triggers code 112");
  }

  // Check for invalid citations
  for (const invalid of SENTRY_INVALID_CITATIONS) {
    const statutePattern = invalid.statute.replace(/\s/g, "\\s*");
    if (new RegExp(statutePattern, "i").test(letterContent)) {
      violations.push(
        `Invalid citation detected: ${invalid.statute} - ${invalid.whyItFails}`
      );
    }
  }

  // Check for FDCPA citations to CRA
  if (targetType === "CRA") {
    for (const fdcpaStatute of SENTRY_DOCTRINE.citationRules.fdcpaOnlyStatutes) {
      if (lowerContent.includes(fdcpaStatute.toLowerCase())) {
        violations.push(
          `FDCPA statute ${fdcpaStatute} cited to CRA - FDCPA only applies to debt collectors`
        );
      }
    }
  }

  // Check for criminal statute citations
  for (const criminalStatute of SENTRY_DOCTRINE.citationRules.criminalStatutes) {
    if (lowerContent.includes(criminalStatute.toLowerCase())) {
      violations.push(
        `Criminal statute ${criminalStatute} cited - consumers cannot prosecute criminal statutes`
      );
    }
  }

  // Check OCR high-risk phrases
  for (const phrase of SENTRY_DOCTRINE.ocrRules.highRiskPhrases) {
    if (lowerContent.includes(phrase.toLowerCase())) {
      violations.push(`High-risk OCR phrase detected: "${phrase}"`);
    }
  }

  // Check OCR medium-risk phrases
  for (const phrase of SENTRY_DOCTRINE.ocrRules.mediumRiskPhrases) {
    if (lowerContent.includes(phrase.toLowerCase())) {
      warnings.push(`Medium-risk OCR phrase detected: "${phrase}"`);
    }
  }

  // Check round-specific rules
  if (round === 1) {
    // R1 should not reference previous disputes
    if (
      lowerContent.includes("previous dispute") ||
      lowerContent.includes("last dispute") ||
      lowerContent.includes("prior complaint")
    ) {
      violations.push("R1 letter should not reference previous disputes");
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
    warnings,
  };
}

/**
 * Get the effective flow for a given round (handles flow switching)
 */
export function getSentryEffectiveFlow(
  flow: SentryFlowType,
  round: number
): SentryFlowType {
  if (
    flow === "COLLECTION" &&
    (SENTRY_DOCTRINE.flowRules.collectionSwitchToAccuracyRounds as readonly number[]).includes(round)
  ) {
    return "ACCURACY";
  }
  if (
    flow === "COMBO" &&
    (SENTRY_DOCTRINE.flowRules.comboSwitchToAccuracyRounds as readonly number[]).includes(round)
  ) {
    return "ACCURACY";
  }
  return flow;
}

/**
 * Get the tone level for a given round
 */
export function getSentryToneLevel(round: number): number {
  return SENTRY_DOCTRINE.roundRules.toneByRound[round] || 10;
}

/**
 * Check if a citation is valid for the target type
 */
export function isCitationValidForTarget(
  statute: string,
  targetType: "CRA" | "FURNISHER" | "COLLECTOR"
): { isValid: boolean; reason?: string } {
  // Check if it's an invalid citation
  const invalidCitation = SENTRY_INVALID_CITATIONS.find((c) =>
    statute.includes(c.statute)
  );
  if (invalidCitation) {
    return { isValid: false, reason: invalidCitation.whyItFails };
  }

  // Check if it's a valid citation
  const validCitation = SENTRY_VALID_CITATIONS.find((c) =>
    statute.includes(c.statute)
  );
  if (validCitation) {
    if (validCitation.applicableTo.includes(targetType)) {
      return { isValid: true };
    } else {
      return {
        isValid: false,
        reason: `This statute applies to ${validCitation.applicableTo.join(", ")}, not ${targetType}`,
      };
    }
  }

  // Unknown citation - warn but allow
  return { isValid: true, reason: "Citation not in database - verify manually" };
}
