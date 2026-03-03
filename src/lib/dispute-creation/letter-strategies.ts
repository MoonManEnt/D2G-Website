/**
 * Letter Generation Strategies
 *
 * This module provides unified letter generation with three strategy options:
 * - simple: Uses docx-generator templates
 * - ai: Uses ai-rules-engine with AMELIA AI generation
 * - amelia: Uses full AMELIA doctrine with backdating, personal info disputes, etc.
 *
 * All strategies produce a Document record (not Dispute.letterContent) as the
 * single source of truth for letter content.
 */

import prisma from "@/lib/prisma";
import { format } from "date-fns";
import {
  generateLetterFromTemplate,
  type LetterData,
  type DisputeAccountForLetter,
  type DisputeFlow as DocxDisputeFlow,
} from "@/lib/docx-generator";
import { getDisputeReasonFromIssueCode } from "@/lib/dispute-templates";
import {
  generateDisputeLetterContent,
  type LetterGenerationParams,
  type CRA as RulesEngineCRA,
  type DisputeFlow as RulesEngineFlow,
} from "@/lib/ai-rules-engine";
import {
  generateLetter as generateAmeliaLetter,
  type ClientPersonalInfo,
  type DisputeAccount,
  type HardInquiry,
} from "@/lib/amelia/index";
import {
  generateFullAILetter,
  type FullAILetterInput,
} from "@/lib/amelia-full-ai-generator";

import {
  CRA,
  DisputeFlow,
  DisputeClientData,
  DisputeAccountData,
  DetectedIssue,
  AIStrategyMetadata,
  AccountForLetter,
} from "./types";
import {
  buildSentryContext,
  validateLetterCitations,
  autoFixCitations,
  analyzeOCRRisk,
  applyOCRFixes,
  recommendEOSCARCodes,
  detectTargetableFields,
} from "@/lib/sentry";

/**
 * Letter generation result
 */
export interface GeneratedLetterResult {
  content: string;
  statutesCited: string[];
  aiMetadata: AIStrategyMetadata;
  title: string;
  aiGenerated: boolean;
}

/**
 * Parse detected issues from JSON string
 */
export function parseDetectedIssues(detectedIssues: string | null): DetectedIssue[] {
  if (!detectedIssues) return [];
  try {
    return JSON.parse(detectedIssues);
  } catch {
    return [];
  }
}

/**
 * Format account for letter generation
 */
export function formatAccountForLetter(
  account: DisputeAccountData,
  disputeReason?: string
): AccountForLetter {
  const issues = parseDetectedIssues(account.detectedIssues);

  return {
    creditorName: account.creditorName,
    accountNumber: account.maskedAccountId || "N/A",
    accountType: account.accountType || undefined,
    balance: account.balance
      ? `$${Number(account.balance).toLocaleString()}`
      : undefined,
    reason: disputeReason || "Requires verification",
    issues: issues.map((issue) => ({
      code: issue.code,
      description: issue.description,
    })),
  };
}

/**
 * Get dispute reason from account issues
 */
export function getDisputeReasonForAccount(account: DisputeAccountData): string {
  const issues = parseDetectedIssues(account.detectedIssues);
  if (issues.length > 0) {
    return getDisputeReasonFromIssueCode(issues[0].code);
  }
  return "Information is inaccurate and requires verification";
}

/**
 * Format client date of birth for letters
 */
export function formatClientDOB(dob: Date | null): string {
  if (!dob) return "[DATE OF BIRTH]";
  return format(new Date(dob), "MMMM d, yyyy");
}

/**
 * Format current date for letters
 */
export function formatCurrentDate(): string {
  return format(new Date(), "MMMM d, yyyy");
}

// =============================================================================
// SIMPLE TEMPLATE-BASED GENERATION
// =============================================================================

/**
 * Generate letter using simple templates (docx-generator)
 */
export async function generateSimpleLetter(
  client: DisputeClientData,
  accounts: DisputeAccountData[],
  cra: CRA,
  flow: DisputeFlow,
  round: number
): Promise<GeneratedLetterResult> {
  // Format accounts for letter
  const accountsForLetter: DisputeAccountForLetter[] = accounts.map((account) => {
    const issues = parseDetectedIssues(account.detectedIssues);

    return {
      creditorName: account.creditorName,
      accountNumber: account.maskedAccountId || "N/A",
      accountType: account.accountType || undefined,
      balance: account.balance
        ? `$${Number(account.balance).toLocaleString()}`
        : undefined,
      reason: getDisputeReasonForAccount(account),
      issues: issues.map((issue) => ({
        code: issue.code,
        description: issue.description,
      })),
    };
  });

  // Get debt collector name if collection flow
  const debtCollectorName = accountsForLetter.find((a) =>
    a.accountType?.toLowerCase().includes("collection")
  )?.creditorName;

  // Prepare letter data for template
  const letterData: LetterData = {
    clientFirstName: client.firstName,
    clientLastName: client.lastName,
    clientAddress: client.addressLine1 || "[ADDRESS]",
    clientCity: client.city || "[CITY]",
    clientState: client.state || "[STATE]",
    clientZip: client.zipCode || "[ZIP]",
    clientSSN4: client.ssnLast4 || "XXXX",
    clientDOB: formatClientDOB(client.dateOfBirth),
    currentDate: formatCurrentDate(),
    accounts: accountsForLetter,
    debtCollectorName,
  };

  // Generate letter content (cast to docx-generator types)
  const content = generateLetterFromTemplate(
    cra as "TRANSUNION" | "EXPERIAN" | "EQUIFAX",
    letterData,
    flow as DocxDisputeFlow,
    round
  );

  return {
    content,
    statutesCited: [
      "15 U.S.C. \u00a7 1681e(b)",
      "15 U.S.C. \u00a7 1681i",
      "15 U.S.C. \u00a7 1681s-2(b)",
    ],
    aiMetadata: {
      type: "simple",
      generatedAt: new Date().toISOString(),
      version: "1.0.0",
      flow,
      round,
    },
    title: `${cra} Dispute Letter - Round ${round}`,
    aiGenerated: false,
  };
}

// =============================================================================
// AI-POWERED GENERATION
// =============================================================================

/**
 * Generate letter using AI rules engine with AMELIA
 */
export async function generateAILetter(
  client: DisputeClientData,
  accounts: DisputeAccountData[],
  cra: CRA,
  flow: DisputeFlow,
  round: number,
  organizationId: string,
  previousHistory?: {
    previousRounds: number[];
    previousResponses: string[];
    daysWithoutResponse?: number;
  }
): Promise<GeneratedLetterResult> {
  // Build letter params for AI engine
  const letterParams: LetterGenerationParams = {
    client: {
      firstName: client.firstName,
      lastName: client.lastName,
      address: client.addressLine1!,
      city: client.city!,
      state: client.state!,
      zip: client.zipCode!,
      ssn4: client.ssnLast4 || undefined,
      dob: client.dateOfBirth
        ? format(new Date(client.dateOfBirth), "MM/dd/yyyy")
        : undefined,
    },
    accounts: accounts.map((acc) => ({
      creditorName: acc.creditorName,
      accountNumber: acc.maskedAccountId || undefined,
      balance: acc.balance ? Number(acc.balance) : undefined,
      issues: parseDetectedIssues(acc.detectedIssues).map(
        (i) => i.description || getDisputeReasonForAccount(acc)
      ),
    })),
    cra: cra as RulesEngineCRA,
    flow: flow as RulesEngineFlow,
    round,
    previousHistory,
  };

  // Generate letter using AI engine
  const result = await generateDisputeLetterContent(
    letterParams,
    organizationId,
    client.id
  );

  return {
    content: result.content,
    statutesCited: result.citations.map((c) => `15 U.S.C. \u00a7${c}`),
    aiMetadata: {
      type: "ai",
      generatedAt: new Date().toISOString(),
      version: result.ameliaVersion || "1.0.0",
      flow,
      round,
      tone: result.tone,
    },
    title: `${cra} AI-Generated Dispute Letter - Round ${round}`,
    aiGenerated: true,
  };
}

// =============================================================================
// AMELIA DOCTRINE GENERATION
// =============================================================================

import { getPersonalInfoForDispute } from "@/lib/personal-info-dispute-service";

/**
 * Fetch credit report data for personal info disputes.
 * Uses the enhanced service that auto-detects discrepancies between
 * client's stored address and what's on the credit report.
 */
async function fetchCreditReportData(clientId: string, cra?: CRA): Promise<{
  previousNames: string[];
  previousAddresses: string[];
  hardInquiries: HardInquiry[];
}> {
  // If CRA is specified, use the enhanced service that compares against client data
  if (cra) {
    return getPersonalInfoForDispute(clientId, cra as import("@/types").CRA);
  }

  // Fallback to direct database query for backwards compatibility
  const latestReport = await prisma.creditReport.findFirst({
    where: {
      clientId,
      parseStatus: "COMPLETED",
    },
    orderBy: {
      reportDate: "desc",
    },
    select: {
      previousNames: true,
      previousAddresses: true,
      hardInquiries: true,
    },
  });

  if (!latestReport) {
    return {
      previousNames: [],
      previousAddresses: [],
      hardInquiries: [],
    };
  }

  let previousNames: string[] = [];
  let previousAddresses: string[] = [];
  let hardInquiries: HardInquiry[] = [];

  try {
    previousNames = JSON.parse(latestReport.previousNames || "[]");
    previousAddresses = JSON.parse(latestReport.previousAddresses || "[]");
    const rawInquiries = JSON.parse(latestReport.hardInquiries || "[]");
    hardInquiries = rawInquiries.map(
      (inq: { creditorName: string; inquiryDate: string; cra: string }) => ({
        creditorName: inq.creditorName,
        inquiryDate: inq.inquiryDate,
        cra: inq.cra as CRA,
      })
    );
  } catch {
    // If parsing fails, use empty arrays
  }

  return { previousNames, previousAddresses, hardInquiries };
}

/**
 * Fetch used content hashes to ensure uniqueness
 */
async function fetchUsedContentHashes(clientId: string): Promise<Set<string>> {
  const usedHashes = await prisma.ameliaContentHash.findMany({
    where: { clientId },
    select: { contentHash: true },
  });
  return new Set(usedHashes.map((h) => h.contentHash));
}

/**
 * Store content hash to prevent future reuse
 */
async function storeContentHash(
  clientId: string,
  contentHash: string,
  sourceDocId: string
): Promise<void> {
  await prisma.ameliaContentHash.create({
    data: {
      clientId,
      contentHash,
      contentType: "LETTER",
      sourceDocId,
    },
  });
}

/**
 * Generate letter using full AMELIA doctrine
 */
export async function generateAmeliaDoctrineLetterContent(
  client: DisputeClientData,
  accounts: DisputeAccountData[],
  cra: CRA,
  flow: DisputeFlow | undefined,
  round: number,
  disputeId: string
): Promise<GeneratedLetterResult> {
  // Fetch personal info from credit report
  // This now includes auto-detected discrepancies between client's stored address
  // and what appears on the credit report
  const { previousNames, previousAddresses, hardInquiries } =
    await fetchCreditReportData(client.id, cra);

  // Build client personal info for AMELIA
  const clientInfo: ClientPersonalInfo = {
    firstName: client.firstName,
    lastName: client.lastName,
    fullName: `${client.firstName} ${client.lastName}`,
    addressLine1: client.addressLine1 || "",
    addressLine2: client.addressLine2 || undefined,
    city: client.city || "",
    state: client.state || "",
    zipCode: client.zipCode || "",
    ssnLast4: client.ssnLast4 || "XXXX",
    dateOfBirth: client.dateOfBirth
      ? format(new Date(client.dateOfBirth), "MM/dd/yyyy")
      : "XX/XX/XXXX",
    phone: client.phone || undefined,
    previousNames,
    previousAddresses,
    hardInquiries,
  };

  // Build dispute accounts for AMELIA
  const disputeAccounts: DisputeAccount[] = accounts.map((acc) => {
    const issues = parseDetectedIssues(acc.detectedIssues);

    return {
      creditorName: acc.creditorName,
      accountNumber: acc.maskedAccountId || "XXXXXXXX****",
      accountType: acc.accountType || undefined,
      balance: acc.balance ? Number(acc.balance) : undefined,
      pastDue: acc.pastDue ? Number(acc.pastDue) : undefined,
      dateOpened: acc.dateOpened
        ? format(new Date(acc.dateOpened), "MM/dd/yyyy")
        : undefined,
      dateReported: acc.dateReported
        ? format(new Date(acc.dateReported), "MM/dd/yyyy")
        : undefined,
      paymentStatus: acc.paymentStatus || undefined,
      issues: issues,
      inaccurateCategories: [], // Will be determined by doctrine
    };
  });

  // Get used content hashes for uniqueness
  const usedHashSet = await fetchUsedContentHashes(client.id);

  // Determine flow type (AMELIA can auto-determine if not provided)
  const flowType = (flow as "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO") ||
    determineFlowFromAccounts(accounts);

  // Generate the letter using AMELIA doctrine
  // Cast cra to the enum type expected by AMELIA
  const generatedLetter = generateAmeliaLetter({
    client: clientInfo,
    accounts: disputeAccounts,
    cra: cra as unknown as import("@/types").CRA,
    flow: flowType,
    round,
    usedContentHashes: usedHashSet,
  });

  // Store the content hash to prevent future reuse
  await storeContentHash(client.id, generatedLetter.contentHash, disputeId);

  return {
    content: generatedLetter.content,
    statutesCited: [generatedLetter.statute || "15 U.S.C. \u00a7 1681i"],
    aiMetadata: {
      type: "amelia",
      generatedAt: new Date().toISOString(),
      version: "2.0",
      tone: generatedLetter.tone,
      isBackdated: generatedLetter.isBackdated,
      backdatedDays: generatedLetter.backdatedDays,
      letterDate: generatedLetter.letterDate.toISOString(),
      flow: generatedLetter.flow,
      effectiveFlow: generatedLetter.effectiveFlow,
      round: generatedLetter.round,
      statute: generatedLetter.statute,
      includesScreenshots: generatedLetter.includesScreenshots,
      personalInfoDisputed: {
        previousNames: generatedLetter.personalInfoDisputed.previousNames,
        previousAddresses: generatedLetter.personalInfoDisputed.previousAddresses,
        hardInquiries: generatedLetter.personalInfoDisputed.hardInquiries.map(
          (i) => i.creditorName
        ),
      },
      ameliaVersion: "2.0",
    },
    title: `${cra} AMELIA Dispute Letter - Round ${round}`,
    aiGenerated: true,
  };
}

/**
 * Determine flow from account data
 */
function determineFlowFromAccounts(
  accounts: DisputeAccountData[]
): "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO" {
  const hasCollection = accounts.some(
    (a) =>
      a.accountStatus?.toUpperCase() === "COLLECTION" ||
      a.accountType?.toLowerCase().includes("collection")
  );

  if (hasCollection) {
    return "COLLECTION";
  }

  return "ACCURACY";
}

// =============================================================================
// UNIFIED GENERATION
// =============================================================================

// =============================================================================
// FULL AI GENERATION (Recommended)
// =============================================================================

/**
 * Generate letter using Full AI approach
 *
 * This is the RECOMMENDED approach that:
 * - Generates the ENTIRE letter via AI - no templates
 * - Leads with personal story/impact
 * - Uses simple, 8th-grade language
 * - Every letter is 100% unique - different openings, reasons, demands
 * - Sounds like a real person wrote it
 * - Legal compliance built into AI prompts
 */
export async function generateHumanFirstLetterContent(
  client: DisputeClientData,
  accounts: DisputeAccountData[],
  cra: CRA,
  flow: DisputeFlow | undefined,
  round: number,
  organizationId: string,
  lastDisputeDate?: string
): Promise<GeneratedLetterResult> {
  // Build client personal info for AMELIA
  const clientInfo: ClientPersonalInfo = {
    firstName: client.firstName,
    lastName: client.lastName,
    fullName: `${client.firstName} ${client.lastName}`,
    addressLine1: client.addressLine1 || "",
    addressLine2: client.addressLine2 || undefined,
    city: client.city || "",
    state: client.state || "",
    zipCode: client.zipCode || "",
    ssnLast4: client.ssnLast4 || "XXXX",
    dateOfBirth: client.dateOfBirth
      ? format(new Date(client.dateOfBirth), "MM/dd/yyyy")
      : "XX/XX/XXXX",
    phone: client.phone || undefined,
    previousNames: [],
    previousAddresses: [],
    hardInquiries: [],
  };

  // Build dispute accounts
  const disputeAccounts: DisputeAccount[] = accounts.map((acc) => {
    const issues = parseDetectedIssues(acc.detectedIssues);

    return {
      creditorName: acc.creditorName,
      accountNumber: acc.maskedAccountId || "XXXXXXXX****",
      accountType: acc.accountType || undefined,
      balance: acc.balance ? Number(acc.balance) : undefined,
      pastDue: acc.pastDue ? Number(acc.pastDue) : undefined,
      dateOpened: acc.dateOpened
        ? format(new Date(acc.dateOpened), "MM/dd/yyyy")
        : undefined,
      dateReported: acc.dateReported
        ? format(new Date(acc.dateReported), "MM/dd/yyyy")
        : undefined,
      paymentStatus: acc.paymentStatus || undefined,
      issues: issues,
      inaccurateCategories: [],
    };
  });

  // Determine flow type
  const flowType = (flow as "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO") ||
    determineFlowFromAccounts(accounts);

  // Generate full AI letter - every part is unique
  const generatedLetter = await generateFullAILetter({
    client: clientInfo,
    accounts: disputeAccounts,
    cra: cra as unknown as import("@/types").CRA,
    flow: flowType,
    round,
    lastDisputeDate,
    organizationId,
  });

  return {
    content: generatedLetter.content,
    statutesCited: ["15 U.S.C. § 1681i", "15 U.S.C. § 1681e(b)"],
    aiMetadata: {
      type: "human_first",
      generatedAt: new Date().toISOString(),
      version: "2.0",
      tone: generatedLetter.tone,
      isBackdated: generatedLetter.isBackdated,
      backdatedDays: generatedLetter.backdatedDays,
      letterDate: generatedLetter.letterDate.toISOString(),
      flow: generatedLetter.flow,
      round: generatedLetter.round,
      letterStyle: "HUMAN_FIRST",
    },
    title: `${cra} AI-Generated Dispute Letter - Round ${round}`,
    aiGenerated: true,
  };
}

/**
 * Generate letter using the specified strategy
 */
export async function generateLetter(
  type: "simple" | "ai" | "amelia" | "human_first" | "sentry",
  client: DisputeClientData,
  accounts: DisputeAccountData[],
  cra: CRA,
  flow: DisputeFlow,
  round: number,
  organizationId: string,
  disputeId: string,
  options?: {
    previousHistory?: {
      previousRounds: number[];
      previousResponses: string[];
      daysWithoutResponse?: number;
    };
    lastDisputeDate?: string;
  }
): Promise<GeneratedLetterResult> {
  switch (type) {
    case "simple":
      return generateSimpleLetter(client, accounts, cra, flow, round);

    case "ai":
      return generateAILetter(
        client,
        accounts,
        cra,
        flow,
        round,
        organizationId,
        options?.previousHistory
      );

    case "amelia":
      return generateAmeliaDoctrineLetterContent(
        client,
        accounts,
        cra,
        flow,
        round,
        disputeId
      );

    case "human_first":
      return generateHumanFirstLetterContent(
        client,
        accounts,
        cra,
        flow,
        round,
        organizationId,
        options?.lastDisputeDate
      );

    case "sentry":
      return generateSentryLetter(
        client,
        accounts,
        cra,
        flow,
        round,
        organizationId,
        disputeId,
        options?.lastDisputeDate
      );

    default:
      throw new Error(`Unknown letter generation type: ${type}`);
  }
}

// =============================================================================
// SENTRY MODE GENERATION
// =============================================================================

/**
 * Generate letter using AMELIA doctrine enhanced with Sentry intelligence.
 *
 * Pre-hook: Run e-OSCAR recommendations + Metro 2 field targeting
 * Generation: Use AMELIA doctrine with Sentry context injected
 * Post-hook: Validate citations + OCR risk analysis + auto-fix
 */
async function generateSentryLetter(
  client: DisputeClientData,
  accounts: DisputeAccountData[],
  cra: CRA,
  flow: DisputeFlow,
  round: number,
  organizationId: string,
  disputeId: string,
  lastDisputeDate?: string
): Promise<GeneratedLetterResult> {
  // PRE-HOOK: Build Sentry intelligence context
  const sentryContext = buildSentryContext(accounts, organizationId);

  // GENERATION: Use AMELIA doctrine as the base generator
  const baseResult = await generateAmeliaDoctrineLetterContent(
    client,
    accounts,
    cra,
    flow,
    round,
    disputeId
  );

  let enhancedContent = baseResult.content;

  // Inject Metro 2 dispute language into the letter body if targets were found
  if (sentryContext.metro2DisputeLanguage.length > 0) {
    const metro2Section = sentryContext.metro2DisputeLanguage
      .map((lang) => `\n${lang}`)
      .join("\n");

    // Insert Metro 2 language before the closing section
    const closingMarkers = [
      "Sincerely,",
      "Thank you for your",
      "I look forward to",
      "Please investigate",
      "I expect a response",
    ];

    let insertPoint = enhancedContent.length;
    for (const marker of closingMarkers) {
      const idx = enhancedContent.lastIndexOf(marker);
      if (idx > 0 && idx < insertPoint) {
        insertPoint = idx;
      }
    }

    enhancedContent =
      enhancedContent.slice(0, insertPoint) +
      "\n\nAdditionally, the following specific data field discrepancies require correction:\n" +
      metro2Section +
      "\n\n" +
      enhancedContent.slice(insertPoint);
  }

  // POST-HOOK: Validate and fix citations
  const citationResult = validateLetterCitations(
    enhancedContent,
    flow === "COLLECTION" ? "COLLECTOR" : "CRA"
  );
  if (citationResult.errors.length > 0) {
    enhancedContent = autoFixCitations(enhancedContent, citationResult);
  }

  // POST-HOOK: OCR risk analysis and auto-fix
  const ocrResult = analyzeOCRRisk(enhancedContent);
  if (ocrResult.riskLevel !== "LOW" && ocrResult.autoFixes.length > 0) {
    enhancedContent = applyOCRFixes(enhancedContent, ocrResult.autoFixes);
  }

  return {
    content: enhancedContent,
    statutesCited: baseResult.statutesCited,
    aiMetadata: {
      ...baseResult.aiMetadata,
      type: "sentry",
      sentryModeActive: true,
      eoscarCodesUsed: sentryContext.eoscarCodes,
      metro2FieldsTargeted: sentryContext.metro2Targets.map((t) => t.field.code),
      ocrRiskScore: ocrResult.score,
      citationsValidated: true,
    },
    title: `${cra} Sentry Mode Dispute Letter - Round ${round}`,
    aiGenerated: true,
  };
}
