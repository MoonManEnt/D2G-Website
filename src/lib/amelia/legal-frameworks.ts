/**
 * AMELIA Legal Frameworks
 *
 * Structured legal data for AI-driven letter generation.
 * These are NOT templates - they are data that the AI uses to craft unique letters.
 *
 * The AI weaves these elements naturally into the narrative.
 */

import type { FlowType } from "../amelia-templates";

// =============================================================================
// TYPES
// =============================================================================

export interface CourtCase {
  name: string;
  citation: string;
  year: number;
  relevance: string;
}

export interface LegalFramework {
  flow: FlowType;
  roundRange: [number, number];
  statutes: {
    primary: string;
    primaryCode: string;
    secondary?: string[];
    secondaryCodes?: string[];
  };
  requiredElements: string[];
  courtCases?: CourtCase[];
  violationTypes: string[];
  damagesCitation: string;
  toneGuidance: string;
  keyArguments: string[];
  deadline: string;
}

// =============================================================================
// ACCURACY FLOW FRAMEWORKS
// =============================================================================

const ACCURACY_R1_R4: LegalFramework = {
  flow: "ACCURACY",
  roundRange: [1, 4],
  statutes: {
    primary: "Maximum Accuracy Requirement",
    primaryCode: "15 USC 1681e(b)",
    secondary: ["Reasonable Investigation Requirement"],
    secondaryCodes: ["15 USC 1681i(a)(1)(A)"],
  },
  requiredElements: [
    "Cite inconsistencies across credit bureaus",
    "Reference maximum accuracy standard",
    "Demand investigation within 30 days",
    "List specific inaccurate categories per account",
  ],
  courtCases: [
    {
      name: "Shepard v. Equifax Info. Servs., LLC",
      citation: "2019 U.S. Dist.",
      year: 2019,
      relevance: "Reasonable investigation must go beyond data furnisher ACDV response",
    },
  ],
  violationTypes: [
    "Cross-bureau data mismatch",
    "Failure to investigate",
    "Continued reporting after dispute",
    "Unreasonable procedures",
  ],
  damagesCitation: "15 USC 1681o (actual damages), 15 USC 1681n (willful noncompliance)",
  toneGuidance: "Polite but firm in R1, increasingly frustrated through R4",
  keyArguments: [
    "Information differs across bureaus proving inaccuracy",
    "CRA failed to follow reasonable procedures",
    "Consumer has suffered actual harm from inaccurate reporting",
  ],
  deadline: "30 days to investigate and respond",
};

const ACCURACY_R5_R7: LegalFramework = {
  flow: "ACCURACY",
  roundRange: [5, 7],
  statutes: {
    primary: "Reinvestigation Procedure Requirements",
    primaryCode: "15 USC 1681i(a)(5)",
    secondary: ["Description of Reinvestigation Procedure", "Consumer Statement Requirements"],
    secondaryCodes: ["15 USC 1681i(a)(6)(B)(iii)", "15 USC 1681i(c)"],
  },
  requiredElements: [
    "Demand description of reinvestigation procedure",
    "Request method of verification documentation",
    "Cite failure to include consumer statement",
    "Reference 15-day deadline for MOV",
  ],
  courtCases: [
    {
      name: "Brown v. Equifax Info. Servs.",
      citation: "2010 U.S. Dist.",
      year: 2010,
      relevance: "CRA must provide reinvestigation description within 15 days of request",
    },
    {
      name: "Klein v. Navient Sols., LLC",
      citation: "2020 U.S. Dist.",
      year: 2020,
      relevance: "Consumer statement must include full 100-word content, not just 'CONSUMER STATEMENT' label",
    },
  ],
  violationTypes: [
    "Failure to provide reinvestigation description",
    "Failure to include consumer statement in report",
    "Parroting furnisher response without investigation",
  ],
  damagesCitation: "15 USC 1681o (actual damages), 15 USC 1681n (willful noncompliance)",
  toneGuidance: "Demanding and legally assertive, citing specific procedural failures",
  keyArguments: [
    "Multiple disputes ignored without proper investigation",
    "No documentation of reinvestigation procedure provided",
    "Consumer statement not properly displayed on report",
  ],
  deadline: "15 days for reinvestigation description, 30 days for correction",
};

const ACCURACY_R8_R11: LegalFramework = {
  flow: "ACCURACY",
  roundRange: [8, 11],
  statutes: {
    primary: "Furnisher Duties and Joint Liability",
    primaryCode: "15 USC 1681s-2(b)",
    secondary: ["Accuracy of Report", "Reasonable Investigation"],
    secondaryCodes: ["15 USC 1681e(b)", "15 USC 1681i(a)(1)(A)"],
  },
  requiredElements: [
    "Establish joint liability of CRA and furnisher",
    "Document pattern of ignored disputes",
    "Cite specific dollar amount of damages sought",
    "Reference intent to pursue federal court action",
  ],
  courtCases: [
    {
      name: "McGhee v. Rent Recovery Solutions, LLC",
      citation: "2018 U.S. Dist.",
      year: 2018,
      relevance: "Amount of information in consumer dispute stressed when evaluating furnisher liability",
    },
  ],
  violationTypes: [
    "Joint infraction - CRA and furnisher",
    "Willful noncompliance after repeated disputes",
    "Pattern of unreasonable procedures",
  ],
  damagesCitation: "15 USC 1681o (actual), 15 USC 1681n (willful/punitive)",
  toneGuidance: "Litigation-ready, specific damage amounts, federal court references",
  keyArguments: [
    "Multiple disputes over extended period with no correction",
    "Both CRA and furnisher have parallel obligations",
    "Documented damages ready for federal court presentation",
  ],
  deadline: "30 days before federal court filing",
};

// =============================================================================
// COLLECTION FLOW FRAMEWORKS
// =============================================================================

const COLLECTION_R1_R4: LegalFramework = {
  flow: "COLLECTION",
  roundRange: [1, 4],
  statutes: {
    primary: "Debt Validation Requirements",
    primaryCode: "15 USC 1692g",
    secondary: ["Furnishing Unverified Information", "Deceptive Forms"],
    secondaryCodes: ["15 USC 1692g(b)", "15 USC 1692j"],
  },
  requiredElements: [
    "Demand proof of dunning letter within 5 days of reporting",
    "Challenge lack of debt validation",
    "Cite debt parking violations",
    "Request original creditor documentation",
  ],
  courtCases: [
    {
      name: "Semper v. JBC Legal Group",
      citation: "2005 U.S. Dist.",
      year: 2005,
      relevance: "Debt collector who fails to verify disputed debt must cease all collection activity including credit reporting",
    },
    {
      name: "Daley v. Provena Hosps.",
      citation: "88 F. Supp. 2d 881, 887",
      year: 2000,
      relevance: "Anyone furnishing deceptive form faces same penalties as debt collector",
    },
  ],
  violationTypes: [
    "No dunning letter sent within 5 days",
    "Continued reporting of unverified debt",
    "Debt parking",
    "Furnishing deceptive forms",
  ],
  damagesCitation: "15 USC 1692k (FDCPA damages), 15 USC 1681o (FCRA damages)",
  toneGuidance: "Assertive about validation failures, protective of consumer rights",
  keyArguments: [
    "Collection reported without proper validation notice",
    "No verification provided after dispute",
    "Debt collector bypassed legal requirements",
  ],
  deadline: "30 days to validate or delete",
};

const COLLECTION_R8_R12: LegalFramework = {
  flow: "COLLECTION",
  roundRange: [8, 12],
  statutes: {
    primary: "Impermissible Use and Criminal Violations",
    primaryCode: "15 USC 1681b",
    secondary: ["False Pretense", "Cease Communication", "False/Deceptive Practices"],
    secondaryCodes: ["15 USC 1681q", "15 USC 1692c(c)(2)", "15 USC 1692e(10)"],
  },
  requiredElements: [
    "Challenge permissible purpose for reporting",
    "Cite criminal penalty provisions",
    "Reference cease communication requirements",
    "Document pattern of deceptive practices",
  ],
  courtCases: [
    {
      name: "Northrop v. Hoffman of Simsbury, Inc.",
      citation: "134 F.3d 41, 49",
      year: 1998,
      relevance: "Obtaining consumer information without express consent may trigger criminal penalties",
    },
  ],
  violationTypes: [
    "Reporting without permissible purpose",
    "Furnishing under false pretense",
    "Violating cease communication order",
    "Pattern of deceptive practices",
  ],
  damagesCitation: "15 USC 1681q (criminal), 15 USC 1692k (statutory damages)",
  toneGuidance: "Final warning before regulatory complaints and litigation",
  keyArguments: [
    "No permissible purpose for reporting this account",
    "Consumer never authorized transaction or reporting",
    "Cease communication violated by continued furnishing",
  ],
  deadline: "30 days before OIG complaint and federal court filing",
};

// =============================================================================
// CONSENT FLOW FRAMEWORKS
// =============================================================================

const CONSENT_R1_R3: LegalFramework = {
  flow: "CONSENT",
  roundRange: [1, 3],
  statutes: {
    primary: "Permissible Purpose Requirements",
    primaryCode: "15 USC 1681b(a)(2)",
    secondary: ["Privacy Rights", "Excluded Information"],
    secondaryCodes: ["15 USC 1681a(4)", "15 USC 1681a(d)(2)(A)(i)"],
  },
  requiredElements: [
    "Challenge lack of written authorization",
    "Cite privacy invasion",
    "Demand proof of mutual assent (signed agreement)",
    "Reference excluded information provisions",
  ],
  courtCases: [],
  violationTypes: [
    "Reporting without written consent",
    "Privacy invasion",
    "Furnishing excluded information",
    "No permissible purpose established",
  ],
  damagesCitation: "15 USC 1681n (willful - potential criminal), 15 USC 1681o (negligent)",
  toneGuidance: "Focus on privacy rights and unauthorized disclosure",
  keyArguments: [
    "No written authorization obtained before reporting",
    "Privacy rights violated by unauthorized disclosure",
    "Information legally excluded from credit reports",
  ],
  deadline: "30 days to produce authorization or delete",
};

// =============================================================================
// LATE PAYMENT FLOW FRAMEWORKS
// =============================================================================

const LATE_PAYMENT_R1_R2: LegalFramework = {
  flow: "CONSENT", // Uses CONSENT flow type
  roundRange: [1, 2],
  statutes: {
    primary: "Consumer Transaction Exclusion",
    primaryCode: "15 USC 1681a(d)(2)(A)(i)",
    secondary: ["Privacy Provisions"],
    secondaryCodes: ["15 USC 1681a(4)"],
  },
  requiredElements: [
    "Cite UCC 3-103 consumer transaction definition",
    "Challenge late payments as private transactions",
    "Reference exclusion of personal/family/household transactions",
    "Demand removal of improperly reported late payments",
  ],
  courtCases: [
    {
      name: "Hodge v. Texaco, Inc.",
      citation: "975 F.2d 1093",
      year: 1992,
      relevance: "Only entities with firsthand knowledge may report late payments",
    },
  ],
  violationTypes: [
    "Reporting excluded consumer transactions",
    "Third-party reporting without firsthand knowledge",
    "Privacy violation through transaction disclosure",
  ],
  damagesCitation: "15 USC 1681o (actual damages), 15 USC 1681a(4) (privacy violations)",
  toneGuidance: "Technical legal argument about transaction classification",
  keyArguments: [
    "Late payments are private consumer transactions",
    "UCC defines these as personal/family/household use",
    "CRA lacks firsthand knowledge to report",
  ],
  deadline: "30 days to correct or delete late payment notations",
};

// =============================================================================
// FRAMEWORK LOOKUP
// =============================================================================

const ALL_FRAMEWORKS: LegalFramework[] = [
  ACCURACY_R1_R4,
  ACCURACY_R5_R7,
  ACCURACY_R8_R11,
  COLLECTION_R1_R4,
  COLLECTION_R8_R12,
  CONSENT_R1_R3,
  LATE_PAYMENT_R1_R2,
];

/**
 * Get the legal framework for a specific flow and round
 */
export function getLegalFramework(flow: FlowType, round: number): LegalFramework {
  // Handle COLLECTION R5-R7 which uses ACCURACY flow
  const effectiveFlow = flow === "COLLECTION" && round >= 5 && round <= 7 ? "ACCURACY" : flow;

  // Handle COMBO flow - uses ACCURACY for R5-R7
  const lookupFlow = flow === "COMBO" && round >= 5 && round <= 7 ? "ACCURACY" : effectiveFlow;

  const framework = ALL_FRAMEWORKS.find(
    f => f.flow === lookupFlow && round >= f.roundRange[0] && round <= f.roundRange[1]
  );

  if (!framework) {
    // Default to most applicable framework
    if (lookupFlow === "COLLECTION") {
      return round <= 4 ? COLLECTION_R1_R4 : COLLECTION_R8_R12;
    }
    if (lookupFlow === "CONSENT") {
      return CONSENT_R1_R3;
    }
    // Default to ACCURACY
    if (round <= 4) return ACCURACY_R1_R4;
    if (round <= 7) return ACCURACY_R5_R7;
    return ACCURACY_R8_R11;
  }

  return framework;
}

/**
 * Get all court cases for a framework (for AI context)
 */
export function getCourtCasesForPrompt(framework: LegalFramework): string {
  if (!framework.courtCases || framework.courtCases.length === 0) {
    return "No specific court cases required for this round.";
  }

  return framework.courtCases
    .map(c => `- ${c.name} (${c.citation}, ${c.year}): ${c.relevance}`)
    .join("\n");
}

/**
 * Get statute citations formatted for AI prompt
 */
export function getStatutesForPrompt(framework: LegalFramework): string {
  const lines = [`Primary: ${framework.statutes.primary} (${framework.statutes.primaryCode})`];

  if (framework.statutes.secondary && framework.statutes.secondaryCodes) {
    framework.statutes.secondary.forEach((s, i) => {
      const code = framework.statutes.secondaryCodes?.[i] || "";
      lines.push(`Secondary: ${s} (${code})`);
    });
  }

  lines.push(`Damages: ${framework.damagesCitation}`);

  return lines.join("\n");
}

/**
 * Get all frameworks (for testing/debugging)
 */
export function getAllFrameworks(): LegalFramework[] {
  return ALL_FRAMEWORKS;
}
