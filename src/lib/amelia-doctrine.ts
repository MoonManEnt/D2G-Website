/**
 * AMELIA DOCTRINE - The Immutable Rules Engine
 *
 * These rules are DOCTRINE - not suggestions. They govern how letters are generated.
 *
 * CORE PRINCIPLES:
 * 1. Never divert from prescribed flow unless severity triggers escalation
 * 2. Auto-populate all client fields from onboarding data
 * 3. Backdate ALL Round 1 letters by 30 days
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
// DOCTRINE RULE 2: 30-DAY BACKDATING FOR ALL ROUND 1 LETTERS
// =============================================================================

/**
 * Calculate the letter date. For ALL Round 1 letters (any flow), backdate 30 days.
 * This is DOCTRINE - no exceptions.
 */
export function calculateLetterDate(round: number, createdAt: Date = new Date()): {
  letterDate: Date;
  isBackdated: boolean;
  backdatedDays: number;
} {
  if (round === 1) {
    // DOCTRINE: All Round 1 letters are backdated 30 days
    const letterDate = new Date(createdAt);
    letterDate.setDate(letterDate.getDate() - 30);
    return {
      letterDate,
      isBackdated: true,
      backdatedDays: 30,
    };
  }

  // Rounds 2+ use actual date
  return {
    letterDate: createdAt,
    isBackdated: false,
    backdatedDays: 0,
  };
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

// Types are already exported inline with their definitions
