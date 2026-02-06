/**
 * Credit Report Format Detector
 *
 * Identifies the source/format of credit reports based on signature patterns.
 * This allows the AI parser to use format-specific extraction hints.
 */

import { createLogger } from "../logger";
const log = createLogger("format-detector");

// Supported report formats
export type ReportFormat =
  | "IDENTITY_IQ"
  | "ANNUAL_CREDIT_REPORT"
  | "CREDIT_KARMA"
  | "MYFICO"
  | "EXPERIAN_DIRECT"
  | "EQUIFAX_DIRECT"
  | "TRANSUNION_DIRECT"
  | "SMART_CREDIT"
  | "PRIVACY_GUARD"
  | "CREDIT_SESAME"
  | "NAV"
  | "BANK_PROVIDED"
  | "UNKNOWN";

// Format signature patterns
interface FormatSignature {
  format: ReportFormat;
  patterns: RegExp[];
  weight: number; // Higher = stronger indicator
}

const FORMAT_SIGNATURES: FormatSignature[] = [
  // IdentityIQ - Most common for credit repair
  {
    format: "IDENTITY_IQ",
    patterns: [
      /IdentityIQ/i,
      /IDENTITYIQ/,
      /identity\s*iq/i,
      /TransUnion\s+Experian\s+Equifax/i, // Three-column format
      /Three\s*Bureau\s+Credit\s+Report/i,
    ],
    weight: 10,
  },

  // AnnualCreditReport.com - Official free report
  {
    format: "ANNUAL_CREDIT_REPORT",
    patterns: [
      /AnnualCreditReport\.com/i,
      /annualcreditreport/i,
      /Free\s+Annual\s+Credit\s+Report/i,
      /www\.annualcreditreport\.com/i,
    ],
    weight: 10,
  },

  // Credit Karma
  {
    format: "CREDIT_KARMA",
    patterns: [
      /Credit\s*Karma/i,
      /creditkarma\.com/i,
      /VantageScore\s+3\.0.*Credit\s*Karma/i,
    ],
    weight: 10,
  },

  // myFICO
  {
    format: "MYFICO",
    patterns: [
      /myFICO/i,
      /myfico\.com/i,
      /FICO\s+Score/i,
      /FICO\s+8/i,
      /FICO.*Bankcard/i,
    ],
    weight: 10,
  },

  // Experian Direct
  {
    format: "EXPERIAN_DIRECT",
    patterns: [
      /Experian\s+Credit\s+Report/i,
      /experian\.com/i,
      /Experian\s+Member\s+Center/i,
    ],
    weight: 8,
  },

  // Equifax Direct
  {
    format: "EQUIFAX_DIRECT",
    patterns: [
      /Equifax\s+Credit\s+Report/i,
      /equifax\.com/i,
      /Equifax\s+Consumer\s+Services/i,
      /myEquifax/i,
    ],
    weight: 8,
  },

  // TransUnion Direct
  {
    format: "TRANSUNION_DIRECT",
    patterns: [
      /TransUnion\s+Credit\s+Report/i,
      /transunion\.com/i,
      /TrueVision/i,
    ],
    weight: 8,
  },

  // SmartCredit
  {
    format: "SMART_CREDIT",
    patterns: [
      /SmartCredit/i,
      /smartcredit\.com/i,
      /Smart\s+Credit/i,
    ],
    weight: 10,
  },

  // PrivacyGuard
  {
    format: "PRIVACY_GUARD",
    patterns: [
      /PrivacyGuard/i,
      /privacyguard\.com/i,
      /Privacy\s*Guard/i,
    ],
    weight: 10,
  },

  // Credit Sesame
  {
    format: "CREDIT_SESAME",
    patterns: [
      /Credit\s*Sesame/i,
      /creditsesame\.com/i,
    ],
    weight: 10,
  },

  // Nav (business credit)
  {
    format: "NAV",
    patterns: [
      /nav\.com/i,
      /Nav\s+Business/i,
      /Dun\s*&\s*Bradstreet/i,
    ],
    weight: 8,
  },

  // Bank-provided reports (generic patterns)
  {
    format: "BANK_PROVIDED",
    patterns: [
      /courtesy\s+copy/i,
      /provided\s+by\s+your\s+lender/i,
      /mortgage\s+credit\s+report/i,
      /tri-merge/i,
      /residential\s+credit\s+report/i,
    ],
    weight: 5,
  },
];

// Format-specific parsing hints for the AI
export interface FormatHints {
  format: ReportFormat;
  description: string;
  bureauLayout: "THREE_COLUMN" | "SINGLE_BUREAU" | "STACKED" | "UNKNOWN";
  hasPaymentHistory: boolean;
  hasScores: boolean;
  commonFeatures: string[];
}

const FORMAT_HINTS: Record<ReportFormat, FormatHints> = {
  IDENTITY_IQ: {
    format: "IDENTITY_IQ",
    description: "IdentityIQ three-bureau report with side-by-side comparison",
    bureauLayout: "THREE_COLUMN",
    hasPaymentHistory: true,
    hasScores: true,
    commonFeatures: [
      "Three-column layout: TransUnion | Experian | Equifax",
      "Two-year payment history grid",
      "Creditor name followed by Account #:",
      "VantageScore 3.0 credit scores",
      "Hard inquiries section",
    ],
  },
  ANNUAL_CREDIT_REPORT: {
    format: "ANNUAL_CREDIT_REPORT",
    description: "Official free annual credit report",
    bureauLayout: "SINGLE_BUREAU",
    hasPaymentHistory: true,
    hasScores: false, // No scores on free report
    commonFeatures: [
      "Single bureau per section",
      "Detailed account information",
      "Personal information section",
      "No credit scores (free version)",
    ],
  },
  CREDIT_KARMA: {
    format: "CREDIT_KARMA",
    description: "Credit Karma consumer report",
    bureauLayout: "STACKED",
    hasPaymentHistory: true,
    hasScores: true,
    commonFeatures: [
      "VantageScore 3.0",
      "TransUnion and Equifax data",
      "Credit factors section",
      "Account cards format",
    ],
  },
  MYFICO: {
    format: "MYFICO",
    description: "myFICO premium credit report",
    bureauLayout: "THREE_COLUMN",
    hasPaymentHistory: true,
    hasScores: true,
    commonFeatures: [
      "Multiple FICO score versions",
      "Score simulators",
      "Detailed score factors",
      "All three bureaus",
    ],
  },
  EXPERIAN_DIRECT: {
    format: "EXPERIAN_DIRECT",
    description: "Experian single-bureau report",
    bureauLayout: "SINGLE_BUREAU",
    hasPaymentHistory: true,
    hasScores: true,
    commonFeatures: [
      "FICO Score 8",
      "Experian data only",
      "Credit factors",
      "Score history",
    ],
  },
  EQUIFAX_DIRECT: {
    format: "EQUIFAX_DIRECT",
    description: "Equifax single-bureau report",
    bureauLayout: "SINGLE_BUREAU",
    hasPaymentHistory: true,
    hasScores: true,
    commonFeatures: [
      "Equifax data only",
      "VantageScore or FICO",
      "Credit monitoring alerts",
    ],
  },
  TRANSUNION_DIRECT: {
    format: "TRANSUNION_DIRECT",
    description: "TransUnion single-bureau report",
    bureauLayout: "SINGLE_BUREAU",
    hasPaymentHistory: true,
    hasScores: true,
    commonFeatures: [
      "TransUnion data only",
      "VantageScore 3.0",
      "Credit monitoring",
    ],
  },
  SMART_CREDIT: {
    format: "SMART_CREDIT",
    description: "SmartCredit three-bureau report",
    bureauLayout: "THREE_COLUMN",
    hasPaymentHistory: true,
    hasScores: true,
    commonFeatures: [
      "Three-bureau comparison",
      "Action buttons/recommendations",
      "Score tracking",
    ],
  },
  PRIVACY_GUARD: {
    format: "PRIVACY_GUARD",
    description: "PrivacyGuard credit monitoring report",
    bureauLayout: "THREE_COLUMN",
    hasPaymentHistory: true,
    hasScores: true,
    commonFeatures: [
      "Three-bureau report",
      "Identity monitoring",
      "Score updates",
    ],
  },
  CREDIT_SESAME: {
    format: "CREDIT_SESAME",
    description: "Credit Sesame consumer report",
    bureauLayout: "SINGLE_BUREAU",
    hasPaymentHistory: true,
    hasScores: true,
    commonFeatures: [
      "TransUnion data",
      "VantageScore",
      "Credit grade",
    ],
  },
  NAV: {
    format: "NAV",
    description: "Nav business credit report",
    bureauLayout: "STACKED",
    hasPaymentHistory: false,
    hasScores: true,
    commonFeatures: [
      "Business credit scores",
      "D&B, Experian Business, Equifax Business",
      "Business credit data",
    ],
  },
  BANK_PROVIDED: {
    format: "BANK_PROVIDED",
    description: "Bank/lender provided credit report",
    bureauLayout: "THREE_COLUMN",
    hasPaymentHistory: true,
    hasScores: true,
    commonFeatures: [
      "Tri-merge format",
      "Mortgage-specific scoring",
      "Residential credit data",
    ],
  },
  UNKNOWN: {
    format: "UNKNOWN",
    description: "Unknown credit report format",
    bureauLayout: "UNKNOWN",
    hasPaymentHistory: true,
    hasScores: true,
    commonFeatures: [
      "Generic credit report format",
      "Look for standard credit report sections",
    ],
  },
};

/**
 * Detect the format of a credit report based on its text content.
 * Returns the most likely format and confidence score.
 */
export function detectReportFormat(text: string): {
  format: ReportFormat;
  confidence: number;
  hints: FormatHints;
} {
  const scores: Record<ReportFormat, number> = {} as Record<ReportFormat, number>;

  // Initialize scores
  for (const sig of FORMAT_SIGNATURES) {
    scores[sig.format] = 0;
  }

  // Check each signature
  for (const sig of FORMAT_SIGNATURES) {
    for (const pattern of sig.patterns) {
      if (pattern.test(text)) {
        scores[sig.format] += sig.weight;
      }
    }
  }

  // Find the highest score
  let bestFormat: ReportFormat = "UNKNOWN";
  let bestScore = 0;

  for (const [format, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestFormat = format as ReportFormat;
    }
  }

  // Calculate confidence (0-1 scale)
  // Max possible score is roughly sum of all weights for a format
  const maxScore = 30; // Approximate max for a perfect match
  const confidence = Math.min(bestScore / maxScore, 1);

  log.info({ format: bestFormat, confidence, score: bestScore }, "Format detected");

  return {
    format: bestFormat,
    confidence: confidence > 0.3 ? confidence : 0.5, // Default 50% confidence if no strong match
    hints: FORMAT_HINTS[bestFormat],
  };
}

/**
 * Get parsing hints for a specific format.
 */
export function getFormatHints(format: ReportFormat): FormatHints {
  return FORMAT_HINTS[format] || FORMAT_HINTS.UNKNOWN;
}

/**
 * Generate format-specific instructions for the AI parser.
 */
export function generateFormatInstructions(format: ReportFormat): string {
  const hints = FORMAT_HINTS[format];

  if (format === "UNKNOWN") {
    return `
This credit report format was not recognized. Apply general credit report parsing rules:
- Look for account sections with creditor names and account numbers
- Extract financial data (balance, credit limit, payment status)
- Identify payment history if present
- Find personal information section
- Look for inquiries and public records
`;
  }

  let instructions = `
This appears to be a ${hints.description}.

Format-specific parsing instructions:
- Bureau layout: ${hints.bureauLayout}
- Has payment history: ${hints.hasPaymentHistory ? "Yes - extract all payment history entries" : "No"}
- Has credit scores: ${hints.hasScores ? "Yes - extract scores by bureau" : "No"}

Key features to look for:
${hints.commonFeatures.map((f) => `- ${f}`).join("\n")}
`;

  if (hints.bureauLayout === "THREE_COLUMN") {
    instructions += `
THREE-COLUMN LAYOUT RULES:
- Each account appears once but has data for all three bureaus
- Create SEPARATE account entries for each bureau
- Match data by column position (1=TransUnion, 2=Experian, 3=Equifax)
- Some fields may show "-" or be empty for certain bureaus
`;
  }

  return instructions;
}
