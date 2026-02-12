/**
 * AMELIA DOCTRINE - The Immutable Rules Engine
 *
 * These rules are DOCTRINE - not suggestions. They govern how letters are generated.
 *
 * CORE PRINCIPLES:
 * 1. Never divert from prescribed flow unless severity triggers escalation
 * 2. Auto-populate all client fields from onboarding data
 * 3. Backdate ALL Round 1 letters by 60-69 days (random), Round 2+ by 30-39 days
 * 4. Round 1 MUST include personal info disputes (names, addresses, inquiries)
 * 5. Every letter follows: DAMAGES → STORY → FACTS → PENALTY structure
 * 6. Stories are NEVER repeated - 100% unique, eOSCAR-resistant
 *
 * LETTER STRUCTURE (Internal Labels - NEVER appear in output):
 * ¶1 - DAMAGES: What happened, how it affected life
 * ¶2 - STORY: Humanized narrative (randomized, unique)
 * ¶2-3 - FACTS: Legal basis woven into narrative
 * ¶4 - PENALTY: The way out (delete = resolved, else litigation)
 */

import crypto from "crypto";
import type { CRA, FlowType } from "@/types";

// =============================================================================
// TYPES
// =============================================================================

export interface ClientPersonalInfo {
  // Core identity
  firstName: string;
  lastName: string;
  fullName: string;

  // Address
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;

  // Sensitive
  ssnLast4: string;
  dateOfBirth: string; // Formatted MM/DD/YYYY
  phone?: string;

  // Parsed from IdentityIQ report - MUST be disputed in Round 1
  previousNames: string[];      // All name variations found on report
  previousAddresses: string[];  // All non-current addresses
  hardInquiries: HardInquiry[]; // Inquiries per CRA
}

export interface HardInquiry {
  creditorName: string;
  inquiryDate: string;
  cra: CRA;
}

export interface DisputeAccount {
  creditorName: string;
  accountNumber: string;
  accountType?: string;
  balance?: number;
  pastDue?: number;
  dateOpened?: string;
  dateReported?: string;
  paymentStatus?: string;
  issues: AccountIssue[];
  inaccurateCategories: string[]; // ACCOUNT TYPE, MONTHLY PAYMENT, DATE OPENED, etc.
}

export interface AccountIssue {
  code: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  description: string;
  fcraSection?: string;
}

export type DisputeFlowType = "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO";
export type LetterTone = "CONCERNED" | "WORRIED" | "FED_UP" | "WARNING" | "PISSED";

export interface SeverityGrade {
  level: 1 | 2 | 3 | 4 | 5;
  triggers: string[];
  allowsFlowDiversion: boolean;
  escalationRequired: boolean;
}

export interface LetterGenerationContext {
  client: ClientPersonalInfo;
  accounts: DisputeAccount[];
  cra: CRA;
  flow: DisputeFlowType;
  round: number;
  organizationId: string;
  previousRounds?: number[];
  previousResponses?: string[];
  daysWaiting?: number;
}

export interface GeneratedLetterOutput {
  content: string;
  letterDate: Date;
  isBackdated: boolean;
  backdatedDays: number;
  tone: LetterTone;
  contentHash: string;
  sectionsIncluded: {
    damages: boolean;
    story: boolean;
    facts: boolean;
    penalty: boolean;
    accountList: boolean;
    correctionsSection: boolean;
    personalInfoSection: boolean;
  };
  personalInfoDisputed: {
    previousNames: string[];
    previousAddresses: string[];
    hardInquiries: HardInquiry[];
  };
}

// =============================================================================
// DOCTRINE RULE 1: SEVERITY GRADING FOR FLOW DIVERSION
// =============================================================================

/**
 * AMELIA only diverts from the standard flow path when severity justifies it.
 * This is monitored internally - not arbitrary.
 */
export function calculateSeverityGrade(
  accounts: DisputeAccount[],
  round: number,
  previousResponses?: string[]
): SeverityGrade {
  const triggers: string[] = [];
  let level: 1 | 2 | 3 | 4 | 5 = 1;

  // Count HIGH severity issues
  const highSeverityCount = accounts.reduce(
    (sum, acc) => sum + acc.issues.filter(i => i.severity === "HIGH").length,
    0
  );

  // Count total issues
  const totalIssues = accounts.reduce(
    (sum, acc) => sum + acc.issues.length,
    0
  );

  // Severity Level 1: Normal (< 3 issues, no high severity)
  if (totalIssues < 3 && highSeverityCount === 0) {
    level = 1;
  }
  // Severity Level 2: Elevated (3-5 issues OR 1 high severity)
  else if ((totalIssues >= 3 && totalIssues <= 5) || highSeverityCount === 1) {
    level = 2;
    triggers.push("Multiple issues detected");
  }
  // Severity Level 3: Serious (6-10 issues OR 2-3 high severity)
  else if ((totalIssues >= 6 && totalIssues <= 10) || (highSeverityCount >= 2 && highSeverityCount <= 3)) {
    level = 3;
    triggers.push("Serious issue concentration");
  }
  // Severity Level 4: Critical (> 10 issues OR > 3 high severity OR round >= 4)
  else if (totalIssues > 10 || highSeverityCount > 3 || round >= 4) {
    level = 4;
    triggers.push("Critical threshold reached");
    if (round >= 4) triggers.push("Multiple rounds without resolution");
  }
  // Severity Level 5: Litigation-Ready (round >= 6 with unresolved issues)
  else if (round >= 6 && totalIssues > 0) {
    level = 5;
    triggers.push("Litigation threshold reached");
    triggers.push("Prolonged non-compliance by CRA");
  }

  // Check for CRA non-responsiveness
  if (previousResponses && previousResponses.length >= 2) {
    const verifiedOnly = previousResponses.filter(r =>
      r.toLowerCase().includes("verified") &&
      !r.toLowerCase().includes("deleted") &&
      !r.toLowerCase().includes("removed")
    );
    if (verifiedOnly.length >= 2) {
      level = Math.min(5, level + 1) as 1 | 2 | 3 | 4 | 5;
      triggers.push("Repeated 'verified' responses without proof");
    }
  }

  return {
    level,
    triggers,
    allowsFlowDiversion: level >= 4, // Only levels 4-5 can divert flows
    escalationRequired: level >= 3,
  };
}

/**
 * Determine if flow should divert based on severity and current position.
 * COLLECTION/COMBO can switch to ACCURACY at R5-7 per existing logic,
 * but ONLY if severity justifies it.
 */
export function shouldDivertFlow(
  currentFlow: DisputeFlowType,
  round: number,
  severity: SeverityGrade
): { shouldDivert: boolean; targetFlow: DisputeFlowType; reason: string } {
  // No diversion allowed below severity level 4
  if (!severity.allowsFlowDiversion) {
    return { shouldDivert: false, targetFlow: currentFlow, reason: "Severity does not warrant diversion" };
  }

  // COLLECTION/COMBO → ACCURACY at R5-7 (existing doctrine)
  if ((currentFlow === "COLLECTION" || currentFlow === "COMBO") && round >= 5 && round <= 7) {
    return {
      shouldDivert: true,
      targetFlow: "ACCURACY",
      reason: `Switching to ACCURACY for Round ${round} per escalation doctrine`,
    };
  }

  // Stay on current flow
  return { shouldDivert: false, targetFlow: currentFlow, reason: "Continuing standard flow" };
}

// =============================================================================
// DOCTRINE RULE 2: 60-69 DAY BACKDATING FOR ALL ROUND 1 LETTERS
// =============================================================================

/**
 * Calculate the letter date. For ALL Round 1 letters (any flow), backdate 60-69 days.
 * For Round 2+, backdate 30-39 days.
 * This is DOCTRINE per the 2026 eOSCAR/CFPB stipulations - no exceptions.
 *
 * The random range prevents batch detection when multiple letters are generated.
 */
export function calculateLetterDate(
  round: number,
  createdAt: Date = new Date(),
  seed?: string
): {
  letterDate: Date;
  isBackdated: boolean;
  backdatedDays: number;
} {
  if (round === 1) {
    // DOCTRINE: All Round 1 letters are backdated 60-69 days (random within range)
    // This prevents batch detection by eOSCAR systems
    const backdatedDays = generateBackdateDays(60, 69, seed);
    const letterDate = new Date(createdAt);
    letterDate.setDate(letterDate.getDate() - backdatedDays);

    // Ensure not a Sunday or major holiday
    const adjusted = adjustForWeekendAndHoliday(letterDate);

    return {
      letterDate: adjusted,
      isBackdated: true,
      backdatedDays: Math.round((createdAt.getTime() - adjusted.getTime()) / (1000 * 60 * 60 * 24)),
    };
  }

  if (round >= 2) {
    // DOCTRINE: Round 2+ letters are backdated 30-39 days
    const backdatedDays = generateBackdateDays(30, 39, seed);
    const letterDate = new Date(createdAt);
    letterDate.setDate(letterDate.getDate() - backdatedDays);

    // Ensure not a Sunday or major holiday
    const adjusted = adjustForWeekendAndHoliday(letterDate);

    return {
      letterDate: adjusted,
      isBackdated: true,
      backdatedDays: Math.round((createdAt.getTime() - adjusted.getTime()) / (1000 * 60 * 60 * 24)),
    };
  }

  // Fallback (shouldn't reach here)
  return {
    letterDate: createdAt,
    isBackdated: false,
    backdatedDays: 0,
  };
}

/**
 * Generate a random backdate within a range.
 * If seed is provided, generates deterministic result for same seed.
 */
function generateBackdateDays(min: number, max: number, seed?: string): number {
  if (seed) {
    // Deterministic random based on seed
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash = hash & hash;
    }
    const normalized = Math.abs(hash % 1000) / 1000;
    return min + Math.floor(normalized * (max - min + 1));
  }
  // True random
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Adjust date to avoid Sundays and major U.S. federal holidays.
 * Moves to the next valid business day.
 */
function adjustForWeekendAndHoliday(date: Date): Date {
  const adjusted = new Date(date);

  // Check for Sunday (0)
  if (adjusted.getDay() === 0) {
    adjusted.setDate(adjusted.getDate() + 1); // Move to Monday
  }

  // Check for major holidays (simplified list)
  const month = adjusted.getMonth();
  const day = adjusted.getDate();

  // New Year's Day (Jan 1)
  if (month === 0 && day === 1) {
    adjusted.setDate(adjusted.getDate() + 1);
  }
  // Independence Day (Jul 4)
  if (month === 6 && day === 4) {
    adjusted.setDate(adjusted.getDate() + 1);
  }
  // Christmas (Dec 25)
  if (month === 11 && day === 25) {
    adjusted.setDate(adjusted.getDate() + 1);
  }

  return adjusted;
}

/**
 * Format date for letter (Month Day, Year)
 */
export function formatLetterDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// =============================================================================
// DOCTRINE RULE 3: TONE ESCALATION BY ROUND
// =============================================================================

export function determineTone(round: number): LetterTone {
  if (round === 1) return "CONCERNED";  // "This must be a mistake"
  if (round === 2) return "WORRIED";    // "Something's wrong with your process"
  if (round === 3) return "FED_UP";     // "You're disrespecting me and my rights"
  if (round === 4) return "WARNING";    // "I will sue for the destruction of my life"
  return "PISSED";                       // Continuous legal threats, disgusted
}

export const TONE_DESCRIPTIONS: Record<LetterTone, string> = {
  CONCERNED: "concerned and polite, as if this must have been a mistake",
  WORRIED: "worried, as if something is wrong with their dispute process",
  FED_UP: "fed up, calling them out for disrespecting you and your rights",
  WARNING: "warning them you will sue for the destruction of your life",
  PISSED: "disgusted and pissed off, continuous legal threats",
};

// =============================================================================
// DOCTRINE RULE 4: INACCURATE CATEGORIES FOR ACCOUNTS
// =============================================================================

/**
 * Standard inaccurate categories that can be disputed per account.
 * These appear in the "Inaccurate Categories:" line for each account.
 */
export const INACCURATE_CATEGORIES = [
  "ACCOUNT TYPE",
  "MONTHLY PAYMENT",
  "DATE OPENED",
  "PAYMENT STATUS",
  "COMMENTS",
  "DATE LAST ACTIVE",
  "DATE OF LAST PAYMENT",
  "PAYMENT HISTORY PROFILE",
  "BALANCE",
  "HIGH CREDIT",
  "PAST DUE",
  "LAST REPORTED",
  "CREDIT LIMIT",
  "ACCOUNT STATUS",
] as const;

export type InaccurateCategory = typeof INACCURATE_CATEGORIES[number];

/**
 * Determine which categories to dispute based on account data and issues.
 */
export function determineInaccurateCategories(account: DisputeAccount): InaccurateCategory[] {
  const categories: InaccurateCategory[] = [];

  // Always dispute these for any negative account
  categories.push("ACCOUNT TYPE", "PAYMENT STATUS", "COMMENTS");

  // If late payments
  if (account.issues.some(i => i.code.includes("LATE") || i.code.includes("PAYMENT"))) {
    categories.push("MONTHLY PAYMENT", "DATE OF LAST PAYMENT", "PAYMENT HISTORY PROFILE");
  }

  // If balance issues
  if (account.issues.some(i => i.code.includes("BALANCE"))) {
    categories.push("BALANCE", "HIGH CREDIT", "PAST DUE");
  }

  // If date issues
  if (account.issues.some(i => i.code.includes("DATE"))) {
    categories.push("DATE OPENED", "DATE LAST ACTIVE", "LAST REPORTED");
  }

  // If status issues
  if (account.issues.some(i => i.code.includes("STATUS"))) {
    categories.push("ACCOUNT STATUS");
  }

  // Deduplicate
  return [...new Set(categories)];
}

// =============================================================================
// DOCTRINE RULE 5: CRA ADDRESS BLOCKS
// =============================================================================

export const CRA_ADDRESSES: Record<string, { name: string; lines: string[] }> = {
  TRANSUNION: {
    name: "TransUnion",
    lines: [
      "TransUnion",
      "P.O. Box 2000",
      "Chester PA 19016-2000",
    ],
  },
  EXPERIAN: {
    name: "Experian",
    lines: [
      "Experian",
      "P.O. Box 4500",
      "Allen, TX 75013",
    ],
  },
  EQUIFAX: {
    name: "Equifax",
    lines: [
      "Equifax Information Services LLC",
      "P.O. Box 740256",
      "Atlanta, GA 30374-0256",
    ],
  },
};

// =============================================================================
// CONTENT HASHING FOR UNIQUENESS (eOSCAR Resistance)
// =============================================================================

/**
 * Hash content to track uniqueness. Used to prevent repeated phrases.
 */
export function hashContent(content: string): string {
  return crypto
    .createHash("sha256")
    .update(content.toLowerCase().trim())
    .digest("hex")
    .substring(0, 16);
}

/**
 * Check if content has been used before for this client.
 */
export async function isContentUnique(
  clientId: string,
  content: string,
  prisma: any
): Promise<boolean> {
  const hash = hashContent(content);

  try {
    const existing = await prisma.ameliaContentHash.findUnique({
      where: {
        clientId_contentHash: {
          clientId,
          contentHash: hash,
        },
      },
    });
    return !existing;
  } catch {
    // If DB not available, assume unique
    return true;
  }
}

/**
 * Record content hash to prevent future reuse.
 */
export async function recordContentHash(
  clientId: string,
  content: string,
  contentType: "SENTENCE" | "PARAGRAPH" | "PHRASE" | "STORY",
  sourceDocId: string | null,
  prisma: any
): Promise<void> {
  const hash = hashContent(content);

  try {
    await prisma.ameliaContentHash.upsert({
      where: {
        clientId_contentHash: {
          clientId,
          contentHash: hash,
        },
      },
      create: {
        clientId,
        contentHash: hash,
        contentType,
        sourceDocId,
      },
      update: {}, // No-op if exists
    });
  } catch {
    // Silent fail - logging handled elsewhere
  }
}

// =============================================================================
// PERSONAL INFO EXTRACTION PATTERNS (for IdentityIQ reports)
// =============================================================================

/**
 * Extract previous names from IdentityIQ report text.
 * Format: "ALSO KNOWN AS: NAME1, NAME2, NAME3"
 */
export function extractPreviousNames(reportText: string, currentName: string): string[] {
  const names: string[] = [];

  // Pattern: Also Known As section
  const akaPattern = /Also\s+Known\s+As:?\s*([^\n]+)/gi;
  const matches = reportText.matchAll(akaPattern);

  for (const match of matches) {
    const nameList = match[1].split(/[,;]/).map(n => n.trim()).filter(n => n.length > 2);
    names.push(...nameList);
  }

  // Pattern: Name variations in header
  const nameVarPattern = /Name(?:s)?:?\s*([A-Z][A-Za-z\s]+(?:,\s*[A-Z][A-Za-z\s]+)*)/g;
  const nameMatches = reportText.matchAll(nameVarPattern);

  for (const match of nameMatches) {
    const nameList = match[1].split(/[,;]/).map(n => n.trim()).filter(n => n.length > 2);
    names.push(...nameList);
  }

  // Deduplicate and remove current name
  const normalized = currentName.toUpperCase();
  return [...new Set(names)]
    .filter(n => n.toUpperCase() !== normalized)
    .filter(n => n.length > 2);
}

/**
 * Extract previous addresses from IdentityIQ report text.
 */
export function extractPreviousAddresses(reportText: string, currentAddress: string): string[] {
  const addresses: string[] = [];

  // Pattern: Address blocks (street, city state zip)
  const addressPattern = /(\d+\s+[A-Za-z0-9\s.,]+(?:ST|AVE|RD|DR|LN|CT|BLVD|WAY|CIR|PL)[A-Za-z.,]*\s+[A-Za-z\s]+,?\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?)/gi;
  const matches = reportText.matchAll(addressPattern);

  for (const match of matches) {
    addresses.push(match[1].trim());
  }

  // Normalize and remove current
  const normalizedCurrent = currentAddress.toUpperCase().replace(/\s+/g, " ");
  return [...new Set(addresses)]
    .filter(a => a.toUpperCase().replace(/\s+/g, " ") !== normalizedCurrent)
    .filter(a => a.length > 10);
}

/**
 * Extract hard inquiries from IdentityIQ report text.
 */
export function extractHardInquiries(reportText: string, cra: CRA): HardInquiry[] {
  const inquiries: HardInquiry[] = [];

  // Pattern: Inquiry sections - "CREDITOR NAME MM/DD/YYYY"
  const inquiryPattern = /(?:Hard\s+)?Inquir(?:y|ies)[:\s]*\n([\s\S]*?)(?=(?:Soft|Public|Accounts|$))/gi;
  const sectionMatches = reportText.matchAll(inquiryPattern);

  for (const section of sectionMatches) {
    const sectionText = section[1];
    // Individual inquiry pattern
    const linePattern = /([A-Z][A-Z0-9\s\/&'.,-]+)\s+(\d{2}\/\d{2}\/\d{4})/g;
    const lineMatches = sectionText.matchAll(linePattern);

    for (const match of lineMatches) {
      inquiries.push({
        creditorName: match[1].trim(),
        inquiryDate: match[2],
        cra,
      });
    }
  }

  return inquiries;
}

// =============================================================================
// THE 3 UNIVERSAL OPERATING RULES (From PDF Guide)
// These rules are ABSOLUTE and apply to ALL flows
// =============================================================================

/**
 * UNIVERSAL RULE 1: R1 Citation Strategy
 * Controls whether legal citations appear in Round 1 letters.
 *
 * - ACCURACY: NO citations in R1 (establish story first, build human connection)
 * - COLLECTION: YES citations in R1 (debt validation is legally required upfront)
 * - CONSENT: YES citations in R1 (privacy violations require immediate legal basis)
 * - COMBO: MIXED (depends on primary issue - if collection-heavy, YES; if accuracy-heavy, NO)
 */
export function shouldIncludeCitationsInR1(flow: DisputeFlowType, primaryIssue?: string): boolean {
  switch (flow) {
    case "ACCURACY":
      return false; // Never cite in R1 for accuracy - story first
    case "COLLECTION":
      return true; // Always cite §1692g for debt validation
    case "CONSENT":
      return true; // Always cite for privacy/permissible purpose
    case "COMBO":
      // If primary issue is collection-related, include citations
      if (primaryIssue?.toLowerCase().includes("collection") ||
          primaryIssue?.toLowerCase().includes("debt") ||
          primaryIssue?.toLowerCase().includes("validation")) {
        return true;
      }
      return false; // Default to accuracy-style (no R1 citations)
    default:
      return false;
  }
}

/**
 * UNIVERSAL RULE 2: Personal Info Block
 * EVERY letter MUST include the Personal Info Block until items are confirmed removed.
 */
export interface PersonalInfoBlock {
  fullLegalName: string;
  currentAddress: string;
  ssnLast4: string;
  dateOfBirth: string;
  previousAddresses?: string[];
}

export function formatPersonalInfoBlock(client: ClientPersonalInfo): string {
  const lines = [
    `Full Legal Name: ${client.fullName}`,
    `Current Address: ${client.addressLine1}${client.addressLine2 ? ", " + client.addressLine2 : ""}, ${client.city}, ${client.state} ${client.zipCode}`,
    `SSN (last 4): ${client.ssnLast4}`,
    `Date of Birth: ${client.dateOfBirth}`,
  ];

  if (client.previousAddresses.length > 0) {
    lines.push(`Previous Addresses: ${client.previousAddresses.slice(0, 2).join("; ")}`);
  }

  return lines.join("\n");
}

/**
 * UNIVERSAL RULE 3: Backdating Strategy
 * - R1: 60-69 days before actual send date
 * - R2+: 30-39 days before actual send date
 *
 * Purpose: Creates paper trail showing bureaus failed to respond within FCRA timelines
 * Note: Already implemented in calculateLetterDate() above
 */

// =============================================================================
// FLOW-SPECIFIC ROUND COUNTS
// =============================================================================

export const FLOW_ROUND_LIMITS: Record<DisputeFlowType, number> = {
  ACCURACY: 11,   // 11 rounds of escalation
  COLLECTION: 12, // 12 rounds (R5-7 uses Accuracy, returns at R8)
  CONSENT: 10,    // 10 rounds for privacy/permissible purpose
  COMBO: 12,      // 12 rounds (R5-7 uses Accuracy, returns at R8)
};

/**
 * Get the effective flow for a given round.
 * COLLECTION and COMBO switch to ACCURACY at R5-7, then return.
 */
export function getEffectiveFlowForRound(flow: DisputeFlowType, round: number): DisputeFlowType {
  if ((flow === "COLLECTION" || flow === "COMBO") && round >= 5 && round <= 7) {
    return "ACCURACY";
  }
  return flow;
}

// =============================================================================
// CASE LAW CITATIONS - When to Introduce Each Case
// =============================================================================

export interface CaseLawCitation {
  name: string;
  fullCitation: string;
  shortDescription: string;
  useFor: string[];
  introduceAtRound: number; // Minimum round to introduce
}

export const CASE_LAW_CITATIONS: CaseLawCitation[] = [
  {
    name: "Cushman v. Trans Union",
    fullCitation: "Cushman v. Trans Union Corp., 115 F.3d 220 (3d Cir. 1997)",
    shortDescription: "CRAs must go beyond ACDV parroting for reinvestigation",
    useFor: ["reinvestigation", "reasonable procedures", "verification"],
    introduceAtRound: 5,
  },
  {
    name: "Shepard v. Equifax",
    fullCitation: "Shepard v. Equifax Info. Servs., LLC, 2019 U.S. Dist.",
    shortDescription: "Investigation must go beyond data furnisher",
    useFor: ["reinvestigation", "verification", "accuracy"],
    introduceAtRound: 4, // Introduced at R4 per PDF guide
  },
  {
    name: "Brown v. Equifax",
    fullCitation: "Brown v. Equifax Info. Servs., 2010 U.S. Dist.",
    shortDescription: "Failure to send reinvestigation results = violation",
    useFor: ["reinvestigation results", "1681i(a)(6)"],
    introduceAtRound: 6,
  },
  {
    name: "Johnson v. MBNA",
    fullCitation: "Johnson v. MBNA America Bank, NA, 357 F.3d 426 (4th Cir. 2004)",
    shortDescription: "Furnisher must investigate disputes, not just parrot",
    useFor: ["furnisher liability", "1681s-2(b)"],
    introduceAtRound: 7,
  },
  {
    name: "Grigoryan v. Experian",
    fullCitation: "Grigoryan v. Experian Info. Solutions, Inc., 84 F. Supp. 3d 1020",
    shortDescription: "Statutory damages for willful noncompliance",
    useFor: ["statutory damages", "willful violation", "litigation"],
    introduceAtRound: 9,
  },
  {
    name: "McGhee v. Rent Recovery",
    fullCitation: "McGhee v. Rent Recovery Solutions, LLC, 2018 U.S. Dist.",
    shortDescription: "Furnisher liability for unreasonable procedures",
    useFor: ["furnisher liability", "unreasonable procedures"],
    introduceAtRound: 8,
  },
  {
    name: "Klein v. Navient",
    fullCitation: "Klein v. Navient Sols., LLC, 2020 U.S. Dist.",
    shortDescription: "Consumer statement must be complete, not abbreviated",
    useFor: ["consumer statement", "1681i(c)"],
    introduceAtRound: 7,
  },
];

/**
 * Get applicable case law citations for a given round and context
 */
export function getCaseLawForRound(round: number, context?: string[]): CaseLawCitation[] {
  return CASE_LAW_CITATIONS.filter(citation => {
    // Must meet minimum round requirement
    if (round < citation.introduceAtRound) return false;

    // If context provided, check if citation is relevant
    if (context && context.length > 0) {
      return citation.useFor.some(use =>
        context.some(c => c.toLowerCase().includes(use.toLowerCase()))
      );
    }

    return true;
  });
}

// =============================================================================
// FCRA/FDCPA STATUTE PROGRESSION
// =============================================================================

export interface StatuteCitation {
  code: string;
  title: string;
  description: string;
  flow: DisputeFlowType[];
  introduceAtRound: number;
  escalationLevel: "mild" | "moderate" | "severe" | "litigation";
}

export const FCRA_STATUTES: StatuteCitation[] = [
  // FCRA Statutes - progressive introduction
  {
    code: "15 USC 1681e(b)",
    title: "Maximum Possible Accuracy",
    description: "CRA must follow reasonable procedures to assure maximum possible accuracy",
    flow: ["ACCURACY", "COMBO"],
    introduceAtRound: 3,
    escalationLevel: "mild",
  },
  {
    code: "15 USC 1681i(a)(1)(A)",
    title: "30-Day Investigation Requirement",
    description: "CRA must investigate disputes within 30 days",
    flow: ["ACCURACY", "COLLECTION", "CONSENT", "COMBO"],
    introduceAtRound: 3,
    escalationLevel: "mild",
  },
  {
    code: "15 USC 1681i(a)(5)",
    title: "Treatment of Inaccurate/Unverifiable Info",
    description: "If info cannot be verified, CRA must promptly delete or modify",
    flow: ["ACCURACY", "COMBO"],
    introduceAtRound: 3,
    escalationLevel: "moderate",
  },
  {
    code: "15 USC 1681i(a)(6)(B)(iii)",
    title: "Reinvestigation Results",
    description: "CRA must provide results of reinvestigation within 5 business days",
    flow: ["ACCURACY", "COMBO"],
    introduceAtRound: 5,
    escalationLevel: "moderate",
  },
  {
    code: "15 USC 1681i(a)(7)",
    title: "Description of Reinvestigation Procedure",
    description: "Consumer can request description of procedure used",
    flow: ["ACCURACY", "COMBO"],
    introduceAtRound: 5,
    escalationLevel: "moderate",
  },
  {
    code: "15 USC 1681i(c)",
    title: "Consumer Statement",
    description: "Consumer can file statement of dispute",
    flow: ["ACCURACY", "COMBO"],
    introduceAtRound: 7,
    escalationLevel: "severe",
  },
  {
    code: "15 USC 1681s-2(b)",
    title: "Furnisher Investigation Duties",
    description: "Furnisher must investigate disputes forwarded by CRA",
    flow: ["ACCURACY", "COLLECTION", "COMBO"],
    introduceAtRound: 7,
    escalationLevel: "severe",
  },
  {
    code: "15 USC 1681c(e)",
    title: "Indication of Closure by Consumer",
    description: "Must indicate when account closed by consumer",
    flow: ["ACCURACY", "COMBO"],
    introduceAtRound: 10,
    escalationLevel: "litigation",
  },
  {
    code: "15 USC 1681n",
    title: "Civil Liability - Willful Noncompliance",
    description: "Actual damages, statutory damages $100-$1000, punitive damages, attorney fees",
    flow: ["ACCURACY", "COLLECTION", "CONSENT", "COMBO"],
    introduceAtRound: 9,
    escalationLevel: "litigation",
  },
  {
    code: "15 USC 1681o",
    title: "Civil Liability - Negligent Noncompliance",
    description: "Actual damages, attorney fees",
    flow: ["ACCURACY", "COLLECTION", "CONSENT", "COMBO"],
    introduceAtRound: 8,
    escalationLevel: "severe",
  },
];

export const FDCPA_STATUTES: StatuteCitation[] = [
  // FDCPA Statutes - for COLLECTION flow
  {
    code: "15 USC 1692g",
    title: "Validation of Debts",
    description: "Debt collector must send validation notice within 5 days",
    flow: ["COLLECTION", "COMBO"],
    introduceAtRound: 1, // Required in R1 for collection
    escalationLevel: "mild",
  },
  {
    code: "15 USC 1692g(b)",
    title: "Disputed Debts",
    description: "Collection must cease until debt is validated",
    flow: ["COLLECTION", "COMBO"],
    introduceAtRound: 2,
    escalationLevel: "moderate",
  },
  {
    code: "15 USC 1692j",
    title: "Furnishing Deceptive Forms",
    description: "Prohibition on furnishing deceptive forms or documents",
    flow: ["COLLECTION", "COMBO"],
    introduceAtRound: 4,
    escalationLevel: "moderate",
  },
  {
    code: "15 USC 1692c(c)(2)",
    title: "Ceasing Communication",
    description: "Consumer can demand collector cease communication",
    flow: ["COLLECTION", "COMBO"],
    introduceAtRound: 8,
    escalationLevel: "severe",
  },
];

/**
 * Get applicable statutes for a flow and round
 */
export function getStatutesForRound(
  flow: DisputeFlowType,
  round: number
): StatuteCitation[] {
  const allStatutes = [...FCRA_STATUTES, ...FDCPA_STATUTES];

  return allStatutes.filter(statute => {
    // Must apply to this flow
    if (!statute.flow.includes(flow)) return false;

    // Must meet minimum round requirement
    if (round < statute.introduceAtRound) return false;

    return true;
  });
}

/**
 * Get the primary statute for a round (the one to feature prominently)
 */
export function getPrimaryStatuteForRound(
  flow: DisputeFlowType,
  round: number
): StatuteCitation | null {
  const applicable = getStatutesForRound(flow, round);

  // Find the statute that was JUST introduced this round
  const newlyIntroduced = applicable.filter(s => s.introduceAtRound === round);
  if (newlyIntroduced.length > 0) {
    return newlyIntroduced[0];
  }

  // Otherwise return the most severe applicable statute
  const sorted = applicable.sort((a, b) => {
    const levels = { mild: 1, moderate: 2, severe: 3, litigation: 4 };
    return levels[b.escalationLevel] - levels[a.escalationLevel];
  });

  return sorted[0] || null;
}

// =============================================================================
// VOICE EVOLUTION BY ROUND (Kitchen Table Test)
// =============================================================================

export type VoicePhase = "opening" | "escalation" | "pressure" | "resolution";

export interface VoiceCharacteristics {
  phase: VoicePhase;
  tone: string;
  language: string[];
  goal: string;
}

export const VOICE_EVOLUTION: Record<VoicePhase, VoiceCharacteristics> = {
  opening: {
    phase: "opening",
    tone: "Hopeful, explaining, reasonable",
    language: [
      "I noticed...",
      "I'm hoping you can help...",
      "I recently discovered...",
      "I'm writing to bring to your attention...",
      "I found something concerning...",
    ],
    goal: "Establish human connection",
  },
  escalation: {
    phase: "escalation",
    tone: "Frustrated, persistent, questioning",
    language: [
      "I've already contacted you...",
      "Why hasn't this been fixed?",
      "I'm confused why this is still...",
      "This is the third time...",
      "I don't understand why...",
    ],
    goal: "Show pattern of bureau failure",
  },
  pressure: {
    phase: "pressure",
    tone: "Desperate, exhausted, angry but controlled",
    language: [
      "I don't know what else to do...",
      "This is affecting my life...",
      "I've tried everything...",
      "My family is suffering...",
      "I'm at my breaking point...",
    ],
    goal: "Maximum emotional impact",
  },
  resolution: {
    phase: "resolution",
    tone: "Resigned, ultimatum, legal threats",
    language: [
      "I have no choice but to...",
      "My attorney has advised...",
      "This is your final notice...",
      "I will be filing...",
      "Consider this notice of...",
    ],
    goal: "Force action or prepare litigation record",
  },
};

/**
 * Get the voice phase for a given round
 */
export function getVoicePhaseForRound(round: number): VoicePhase {
  if (round <= 2) return "opening";
  if (round <= 5) return "escalation";
  if (round <= 8) return "pressure";
  return "resolution";
}

/**
 * Get voice characteristics for a round
 */
export function getVoiceForRound(round: number): VoiceCharacteristics {
  const phase = getVoicePhaseForRound(round);
  return VOICE_EVOLUTION[phase];
}

// =============================================================================
// CONFIDENCE SCORING (6 Weighted Factors)
// =============================================================================

export interface ConfidenceFactors {
  documentationQuality: number; // 0-100, weight 25%
  accountAge: number;           // 0-100, weight 15%
  disputeTypeMatch: number;     // 0-100, weight 20%
  previousDisputes: number;     // 0-100, weight 15%
  bureauHistory: number;        // 0-100, weight 15%
  economicContext: number;      // 0-100, weight 10%
}

export interface ConfidenceScore {
  score: number;
  tier: "HIGH" | "MEDIUM" | "LOW_MEDIUM" | "LOW";
  displayText: string;
  factors: ConfidenceFactors;
}

/**
 * Calculate weighted confidence score
 */
export function calculateConfidenceScore(factors: ConfidenceFactors): ConfidenceScore {
  const weights = {
    documentationQuality: 0.25,
    accountAge: 0.15,
    disputeTypeMatch: 0.20,
    previousDisputes: 0.15,
    bureauHistory: 0.15,
    economicContext: 0.10,
  };

  const score =
    factors.documentationQuality * weights.documentationQuality +
    factors.accountAge * weights.accountAge +
    factors.disputeTypeMatch * weights.disputeTypeMatch +
    factors.previousDisputes * weights.previousDisputes +
    factors.bureauHistory * weights.bureauHistory +
    factors.economicContext * weights.economicContext;

  let tier: ConfidenceScore["tier"];
  let displayText: string;

  if (score >= 85) {
    tier = "HIGH";
    displayText = "Strong case";
  } else if (score >= 65) {
    tier = "MEDIUM";
    displayText = "Good chance";
  } else if (score >= 45) {
    tier = "LOW_MEDIUM";
    displayText = "Worth trying";
  } else {
    tier = "LOW";
    displayText = "Challenging";
  }

  return { score: Math.round(score), tier, displayText, factors };
}

// Types are already exported inline with their definitions
