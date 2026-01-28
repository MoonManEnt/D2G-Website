/**
 * AMELIA Complete Letter Generator
 *
 * Generates dispute letters for ALL flows and ALL rounds using the doctrine rules.
 *
 * FLOWS SUPPORTED:
 * - ACCURACY: R1-R11 (full escalation with FCRA statutes)
 * - COLLECTION: R1-R4, R5-R7 (uses Accuracy), R8-R12 (FDCPA statutes)
 * - CONSENT: R1-R3 (Privacy/permissible purpose)
 * - COMBO: R1-R4, R5-R7 (uses Accuracy), R8-R12 (dual violations)
 *
 * KEY RULES:
 * 1. Round 1: Backdated 30 days, includes personal info disputes
 * 2. Tone escalates naturally: polite → frustrated → demanding → litigation
 * 3. Stories are randomized and never repeat (eOSCAR resistant)
 * 4. Structure: DAMAGES → STORY → FACTS → PENALTY
 */

import {
  type FlowType,
  type LetterStructure,
  type TemplateVariables,
  getTemplate,
  getDemandLanguage,
  getEffectiveFlow,
  shouldIncludeScreenshots,
  ACCURACY_TEMPLATES,
  COLLECTION_TEMPLATES,
  CONSENT_TEMPLATES,
  LATE_PAYMENT_TEMPLATES,
  LETTER_STRUCTURE_DESCRIPTIONS,
} from "./amelia-templates";
export type { FlowType, LetterStructure } from "./amelia-templates";
export { LETTER_STRUCTURE_DESCRIPTIONS } from "./amelia-templates";
import {
  type ClientPersonalInfo,
  type DisputeAccount,
  type HardInquiry,
  calculateLetterDate,
  formatLetterDate,
  determineTone,
  determineInaccurateCategories,
  CRA_ADDRESSES,
  hashContent,
} from "./amelia-doctrine";
import {
  generateUniqueStory,
  humanizeText,
} from "./amelia-stories";
import type { CRA } from "@/types";
import type { NextRoundContext } from "./dispute-intelligence/types";

// =============================================================================
// TYPES
// =============================================================================

// Active personal info dispute from database (for persistent disputes)
export interface ActivePersonalInfoDispute {
  type: "PREVIOUS_NAME" | "PREVIOUS_ADDRESS" | "HARD_INQUIRY";
  value: string;
  cra: string;
  inquiryDate?: string; // For hard inquiries
  disputeCount: number;
  firstDisputedAt: Date;
}

export interface LetterGenerationInput {
  client: ClientPersonalInfo;
  accounts: DisputeAccount[];
  cra: CRA;
  flow: FlowType;
  round: number;
  usedContentHashes?: Set<string>;
  lastDisputeDate?: string; // Actual date of last letter for this client/CRA
  debtCollectorNames?: string[];
  creditorNames?: string[];
  // For rounds 2+, include context from previous round responses
  previousRoundContext?: NextRoundContext;
  // AMELIA Doctrine: Personal info disputes persist until removed from report
  activePersonalInfoDisputes?: ActivePersonalInfoDispute[];
  // Letter structure: DAMAGES_FIRST (default) or FACTS_FIRST
  letterStructure?: LetterStructure;
}

export interface GeneratedLetter {
  content: string;
  letterDate: Date;
  isBackdated: boolean;
  backdatedDays: number;
  tone: string;
  flow: FlowType;
  effectiveFlow: FlowType;
  round: number;
  statute: string;
  contentHash: string;
  includesScreenshots: boolean;
  personalInfoDisputed: {
    previousNames: string[];
    previousAddresses: string[];
    hardInquiries: HardInquiry[];
  };
  // Letter structure used (DAMAGES_FIRST or FACTS_FIRST)
  letterStructure: LetterStructure;
}

// =============================================================================
// VARIABLE INTERPOLATION
// =============================================================================

/**
 * Replace template variables with actual values
 */
function interpolateVariables(
  text: string,
  vars: TemplateVariables
): string {
  let result = text;

  // Standard replacements
  result = result.replace(/\{clientFirstName\}/g, vars.clientFirstName);
  result = result.replace(/\{clientLastName\}/g, vars.clientLastName);
  result = result.replace(/\{clientMiddleName\}/g, vars.clientMiddleName || "");
  result = result.replace(/\{clientAddress\}/g, vars.clientAddress);
  result = result.replace(/\{clientCity\}/g, vars.clientCity);
  result = result.replace(/\{clientState\}/g, vars.clientState);
  result = result.replace(/\{clientZip\}/g, vars.clientZip);
  result = result.replace(/\{bureauName\}/g, vars.bureauName);
  result = result.replace(/\{bureauAddress\}/g, vars.bureauAddress);
  result = result.replace(/\{currentDate\}/g, vars.currentDate);
  // AMELIA Doctrine: R2+ letters MUST have the actual last letter date, never a placeholder
  result = result.replace(/\{lastDisputeDate\}/g, vars.lastDisputeDate || "[DATE OF LAST LETTER]");
  result = result.replace(/\[INSERT DATE OF LAST LETTER\]/g, vars.lastDisputeDate || "[DATE OF LAST LETTER]");
  result = result.replace(/\[DATE OF LAST\]/g, vars.lastDisputeDate || "[DATE OF LAST LETTER]");

  // Debt collector names
  if (vars.debtCollectorNames && vars.debtCollectorNames.length > 0) {
    result = result.replace(/\{debtCollectorNames\}/g, vars.debtCollectorNames.join(", "));
    result = result.replace(/\[INSERT DEBT COLLECTOR NAME\]/g, vars.debtCollectorNames.join(", "));
  }

  // Creditor names
  if (vars.creditorNames && vars.creditorNames.length > 0) {
    result = result.replace(/\{creditorNames\}/g, vars.creditorNames.join(", "));
    result = result.replace(/\[INSERT CREDITOR NAME\]/g, vars.creditorNames.join(", "));
  }

  // Also handle the template's {client_first_name} style variables (from original templates)
  result = result.replace(/\{client_first_name\}/g, vars.clientFirstName);
  result = result.replace(/\{client_last_name\}/g, vars.clientLastName);
  result = result.replace(/\{client_address\}/g, vars.clientAddress);
  result = result.replace(/\{bureau_name\}/g, vars.bureauName);
  result = result.replace(/\{bureau_address\}/g, vars.bureauAddress);
  result = result.replace(/\{curr_date\}/g, vars.currentDate);

  return result;
}

// =============================================================================
// SECTION GENERATORS
// =============================================================================

/**
 * Generate the letter header
 */
function generateHeader(
  client: ClientPersonalInfo,
  cra: CRA,
  letterDate: Date
): string {
  const craInfo = CRA_ADDRESSES[cra];

  const lines = [
    `${client.fullName}`,
    client.addressLine1,
  ];

  if (client.addressLine2) {
    lines.push(client.addressLine2);
  }

  lines.push(`${client.city}, ${client.state} ${client.zipCode}`);
  // AMELIA Doctrine: SSN only, NO DOB in dispute letters
  lines.push(`SSN: XXX-XX-${client.ssnLast4}`);
  lines.push("");
  lines.push(craInfo.name);
  lines.push(...craInfo.lines);
  lines.push("");
  lines.push(formatLetterDate(letterDate));

  return lines.join("\n");
}

/**
 * Generate the account list section
 */
function generateAccountList(
  accounts: DisputeAccount[],
  craName: string,
  flow: FlowType
): string {
  let section = `Here is the exact information furnishing inaccurate on my ${craName} credit report:\n\n`;

  accounts.forEach((account, index) => {
    const categories = determineInaccurateCategories(account);
    const categoryStr = categories.length > 0
      ? categories.join(", ")
      : "ACCOUNT TYPE, PAYMENT STATUS, DATE OPENED, PAYMENT HISTORY PROFILE";

    section += `${index + 1}. Account Name: ${account.creditorName}, Account Number: ${account.accountNumber}\n`;
    section += `   Inaccurate Categories: ${categoryStr}\n\n`;
  });

  return section;
}

/**
 * Generate the "Requested Corrections / Deletions" section
 */
function generateCorrectionsSection(
  accounts: DisputeAccount[],
  flow: FlowType
): string {
  let section = `Requested Corrections / Deletions (If Not Verified as Accurate):\n\n`;

  accounts.forEach((account, index) => {
    let reason: string;

    if (flow === "COLLECTION") {
      reason = "Disputing validity of this collection - As a consumer by law this debt must be validated or deleted immediately";
    } else if (account.issues.some(i => i.code.includes("LATE") || i.code.includes("PAYMENT"))) {
      reason = "Accuracy of Report - As a consumer by law the late payment transactions must be updated or removed";
    } else if (account.issues.some(i => i.code.includes("COLLECTION"))) {
      reason = "Disputing validity of this collection - As a consumer by law this account must be validated or deleted immediately";
    } else {
      reason = "Disputing the Accuracy of this account - As a consumer by law this account must be updated or deleted immediately";
    }

    section += `${index + 1}. ${account.creditorName} - ${account.accountNumber} - ${reason}\n\n`;
  });

  return section;
}

/**
 * Generate personal information disputes section
 *
 * AMELIA DOCTRINE:
 * - R1: ALWAYS include hard inquiries and personal info if any exist
 * - R2+: Continue disputing items that are still ACTIVE (not confirmed removed)
 */
function generatePersonalInfoSection(
  client: ClientPersonalInfo,
  cra: CRA,
  round: number,
  activeDisputes?: ActivePersonalInfoDispute[]
): string {
  const sections: string[] = [];

  if (round === 1) {
    // Round 1: Use client data directly (initial disputes)

    // Previous names
    if (client.previousNames.length > 0) {
      sections.push("PREVIOUS NAME VARIATIONS TO REMOVE:");
      client.previousNames.forEach(name => {
        sections.push(`- ${name}`);
      });
      sections.push("These name variations do not accurately represent my identity and should be removed from my credit file.");
      sections.push("");
    }

    // Previous addresses
    if (client.previousAddresses.length > 0) {
      sections.push("PREVIOUS ADDRESSES TO REMOVE:");
      client.previousAddresses.forEach(addr => {
        sections.push(`- ${addr}`);
      });
      sections.push("These addresses are outdated and no longer associated with me. Please remove them from my credit file.");
      sections.push("");
    }

    // AMELIA Doctrine: ALWAYS include hard inquiries in R1 if any exist
    const craInquiries = client.hardInquiries.filter(inq => inq.cra === cra);
    if (craInquiries.length > 0) {
      sections.push("UNAUTHORIZED HARD INQUIRIES TO REMOVE:");
      craInquiries.forEach(inq => {
        sections.push(`- ${inq.creditorName} (${inq.inquiryDate}) - I did not authorize this inquiry`);
      });
      sections.push("These inquiries were made without my permission and should be removed immediately.");
      sections.push("");
    }
  } else {
    // Round 2+: Use activeDisputes from PersonalInfoDispute table
    // Only include items that are still ACTIVE (not confirmed removed from report)

    if (activeDisputes && activeDisputes.length > 0) {
      const craDisputes = activeDisputes.filter(d => d.cra === cra);

      // Group by type
      const names = craDisputes.filter(d => d.type === "PREVIOUS_NAME");
      const addresses = craDisputes.filter(d => d.type === "PREVIOUS_ADDRESS");
      const inquiries = craDisputes.filter(d => d.type === "HARD_INQUIRY");

      if (names.length > 0) {
        sections.push("PREVIOUS NAME VARIATIONS STILL REQUIRING REMOVAL:");
        names.forEach(d => {
          sections.push(`- ${d.value} (previously disputed ${d.disputeCount} time${d.disputeCount > 1 ? "s" : ""}, still reporting)`);
        });
        sections.push("These name variations were previously disputed and still appear on my report. Remove them immediately.");
        sections.push("");
      }

      if (addresses.length > 0) {
        sections.push("PREVIOUS ADDRESSES STILL REQUIRING REMOVAL:");
        addresses.forEach(d => {
          sections.push(`- ${d.value} (previously disputed ${d.disputeCount} time${d.disputeCount > 1 ? "s" : ""}, still reporting)`);
        });
        sections.push("These addresses were previously disputed and still appear on my report. Remove them immediately.");
        sections.push("");
      }

      if (inquiries.length > 0) {
        sections.push("UNAUTHORIZED HARD INQUIRIES STILL REQUIRING REMOVAL:");
        inquiries.forEach(d => {
          const dateStr = d.inquiryDate ? ` (${d.inquiryDate})` : "";
          sections.push(`- ${d.value}${dateStr} - Previously disputed ${d.disputeCount} time${d.disputeCount > 1 ? "s" : ""}, still reporting`);
        });
        sections.push("These unauthorized inquiries were previously disputed and still appear on my report. Remove them immediately per FCRA requirements.");
        sections.push("");
      }
    }
  }

  if (sections.length === 0) {
    return "";
  }

  const headerText = round === 1
    ? "Personal Information to Investigate and Correct / Remove:"
    : "Personal Information STILL Requiring Correction / Removal (Previously Disputed):";

  return headerText + "\n\n" + sections.join("\n");
}

/**
 * Generate the closing signature
 */
function generateClosing(clientName: string): string {
  return `Sincerely,

_______________________________
${clientName}`;
}

/**
 * Generate screenshots reference (R2+)
 */
function generateScreenshotsReference(): string {
  return "\nScreenshots of inaccurate accounts are proven below.";
}

// =============================================================================
// ADAPTIVE CONTENT GENERATION (FOR ROUNDS 2+)
// =============================================================================

/**
 * Generate an adaptive opening paragraph based on previous round context
 */
function generateAdaptiveOpening(
  context: NextRoundContext,
  clientFirstName: string,
  vars: TemplateVariables
): string {
  const { suggestedTone, previousLetterDate, responseSummary } = context;

  const dateStr = previousLetterDate
    ? formatLetterDate(previousLetterDate)
    : "[DATE OF PREVIOUS LETTER]";

  // Different openings based on aggregate outcome
  if (responseSummary.fcraViolations > 0) {
    return `I am writing to formally notify you of your violations of the Fair Credit Reporting Act. ` +
      `On ${dateStr}, I submitted a dispute regarding inaccurate items on my credit report. ` +
      `Your agency has failed to comply with the statutory requirements of the FCRA, and I am now ` +
      `prepared to pursue all available legal remedies.`;
  }

  if (responseSummary.responseBreakdown.noResponse > 0) {
    return `This is a follow-up to my dispute dated ${dateStr}. The FCRA-mandated 30-day response ` +
      `period has expired for ${responseSummary.responseBreakdown.noResponse} item(s) without any ` +
      `response from your agency. Under 15 U.S.C. § 1681i(a)(1), you are required to delete these ` +
      `items immediately.`;
  }

  if (responseSummary.responseBreakdown.verified > 0) {
    return `I am disputing your response to my previous dispute dated ${dateStr}. Your claim that ` +
      `${responseSummary.responseBreakdown.verified} item(s) have been "verified" is insufficient and ` +
      `fails to meet the requirements of 15 U.S.C. § 1681i(a)(6). I demand documentation of your ` +
      `verification procedures.`;
  }

  if (responseSummary.responseBreakdown.stallLetter > 0) {
    return `I reject your response to my dispute dated ${dateStr}. Your attempt to characterize my ` +
      `legitimate dispute as frivolous or to request additional information is a transparent attempt ` +
      `to avoid your obligations under the Fair Credit Reporting Act.`;
  }

  // Default escalated opening based on tone
  const toneOpenings: Record<string, string> = {
    CONCERNED: `I am following up on my previous dispute dated ${dateStr}. I remain concerned about ` +
      `inaccurate information on my credit report and request your prompt attention to this matter.`,

    FRUSTRATED: `Despite my previous dispute dated ${dateStr}, inaccurate information remains on my ` +
      `credit report. I am frustrated by the lack of proper investigation and demand immediate action.`,

    DEMANDING: `This is my continued dispute following my letter dated ${dateStr}. Your failure to ` +
      `properly investigate and correct the inaccurate information is unacceptable. I demand ` +
      `immediate resolution.`,

    FINAL_WARNING: `This letter serves as a final warning before I pursue formal complaints and legal ` +
      `action. Since my original dispute on ${dateStr}, you have failed to fulfill your obligations ` +
      `under the FCRA.`,

    LITIGATION_READY: `Consider this notice of my intent to pursue all legal remedies available under ` +
      `the Fair Credit Reporting Act. Your continued failure to address my disputes, which began on ` +
      `${dateStr}, constitutes willful noncompliance.`,
  };

  return toneOpenings[suggestedTone] || toneOpenings.DEMANDING;
}

/**
 * Generate an escalation section based on previous round context
 */
function generateEscalationSection(context: NextRoundContext): string {
  const { escalationReasons, legalThreats, regulatoryMentions } = context;

  if (escalationReasons.length === 0) {
    return "";
  }

  let section = "The following issues require your immediate attention:\n\n";

  for (const reason of escalationReasons) {
    section += `• ${reason}\n`;
  }

  section += "\n";

  if (legalThreats.length > 0) {
    section += "If these issues are not resolved promptly, I will:\n\n";
    for (const threat of legalThreats) {
      section += `• ${threat}\n`;
    }
    section += "\n";
  }

  if (regulatoryMentions.length > 0) {
    section += `I am prepared to file formal complaints with the ${regulatoryMentions.join(", ")}.\n`;
  }

  return section;
}

/**
 * Generate account list with item-specific context from previous responses
 */
function generateAccountListWithContext(
  accounts: DisputeAccount[],
  craName: string,
  flow: FlowType,
  context?: NextRoundContext
): string {
  let section = `Here is the exact information furnishing inaccurate on my ${craName} credit report:\n\n`;

  accounts.forEach((account, index) => {
    const categories = determineInaccurateCategories(account);
    const categoryStr = categories.length > 0
      ? categories.join(", ")
      : "ACCOUNT TYPE, PAYMENT STATUS, DATE OPENED, PAYMENT HISTORY PROFILE";

    section += `${index + 1}. Account Name: ${account.creditorName}, Account Number: ${account.accountNumber}\n`;
    section += `   Inaccurate Categories: ${categoryStr}\n`;

    // Add item-specific context from previous round if available
    if (context?.itemContexts) {
      const itemContext = context.itemContexts.find(
        ic => ic.creditorName === account.creditorName
      );

      if (itemContext) {
        // Add previous outcome reference
        if (itemContext.previousOutcome === "VERIFIED") {
          section += `   Previous Dispute: Claimed "verified" without proper documentation\n`;
          section += `   Current Demand: Provide method of verification per 15 U.S.C. § 1681i(a)(6)\n`;
        } else if (itemContext.previousOutcome === "NO_RESPONSE") {
          section += `   Previous Dispute: NO RESPONSE RECEIVED - FCRA VIOLATION\n`;
          section += `   Current Demand: IMMEDIATE DELETION required by law\n`;
        } else if (itemContext.previousOutcome === "STALL_LETTER") {
          section += `   Previous Dispute: Stall tactics received - ${itemContext.stallTactic || "frivolous claim"}\n`;
          section += `   Current Demand: Conduct proper investigation as required by FCRA\n`;
        } else if (itemContext.previousOutcome === "UPDATED") {
          section += `   Previous Dispute: Partial update made - errors remain\n`;
          section += `   Current Demand: Complete correction or deletion\n`;
        }

        // Add violations to cite
        if (itemContext.citeViolations.length > 0) {
          section += `   Violations: ${itemContext.citeViolations.join("; ")}\n`;
        }
      }
    }

    section += "\n";
  });

  return section;
}

// =============================================================================
// MAIN GENERATOR
// =============================================================================

/**
 * Generate a complete dispute letter for any flow and round
 */
export function generateLetter(input: LetterGenerationInput): GeneratedLetter {
  const {
    client,
    accounts,
    cra,
    flow,
    round,
    usedContentHashes = new Set(),
    lastDisputeDate,
    debtCollectorNames,
    creditorNames,
    previousRoundContext,
    activePersonalInfoDisputes,
    letterStructure = "DAMAGES_FIRST", // Default to emotional lead
  } = input;

  const craInfo = CRA_ADDRESSES[cra];

  // Determine effective flow (handles R5-R7 switching)
  const effectiveFlow = getEffectiveFlow(flow, round);

  // Get the template for this flow/round
  const template = getTemplate(effectiveFlow, round);
  if (!template) {
    throw new Error(`No template found for ${effectiveFlow} flow, round ${round}`);
  }

  // Calculate letter date (30-day backdate for R1)
  const { letterDate, isBackdated, backdatedDays } = calculateLetterDate(round);

  // Determine tone - may be escalated based on previous responses
  let tone = determineTone(round);
  if (previousRoundContext?.suggestedTone) {
    // Map adaptive strategy tones to AMELIA doctrine tones
    const toneMapping: Record<string, typeof tone> = {
      "CONCERNED": "CONCERNED",
      "FRUSTRATED": "WORRIED",
      "DEMANDING": "FED_UP",
      "FINAL_WARNING": "WARNING",
      "LITIGATION_READY": "PISSED",
    };
    tone = toneMapping[previousRoundContext.suggestedTone] || tone;
  }

  // Build template variables
  const vars: TemplateVariables = {
    clientFirstName: client.firstName,
    clientLastName: client.lastName,
    clientMiddleName: undefined,
    clientAddress: client.addressLine1,
    clientCity: client.city,
    clientState: client.state,
    clientZip: client.zipCode,
    ssnLast4: client.ssnLast4,
    dateOfBirth: client.dateOfBirth,
    bureauName: craInfo.name,
    bureauAddress: craInfo.lines.join("\n"),
    currentDate: formatLetterDate(letterDate),
    lastDisputeDate: lastDisputeDate || (previousRoundContext?.previousLetterDate
      ? formatLetterDate(previousRoundContext.previousLetterDate)
      : undefined),
    debtCollectorNames,
    creditorNames: creditorNames || accounts.map(a => a.creditorName),
    disputeItemsAndExplanation: "", // Handled separately
  };

  // Generate letter sections
  const header = generateHeader(client, cra, letterDate);
  const headline = interpolateVariables(template.headline, vars);

  // Opening paragraph (DAMAGES) - adapt based on previous round context
  let openingParagraph = interpolateVariables(template.openingParagraph, vars);

  // For Round 1, inject a unique story into the DAMAGES section
  if (round === 1) {
    const story = generateUniqueStory(usedContentHashes, round);
    usedContentHashes.add(story.hash);
    // AMELIA Doctrine: Insert the unique story into the DAMAGES section
    // The story adds a personal, human element that makes each letter unique (eOSCAR resistant)
    openingParagraph = humanizeText(openingParagraph) + "\n\n" + story.paragraph;
  } else if (previousRoundContext) {
    // For rounds 2+, use adaptive opening based on previous responses
    openingParagraph = generateAdaptiveOpening(previousRoundContext, client.firstName, vars);
  } else {
    // For rounds 2+ without context, just humanize
    openingParagraph = humanizeText(openingParagraph);
  }

  // Body paragraphs (STORY/FACTS)
  let bodyParagraphs = template.bodyParagraphs.map(p =>
    humanizeText(interpolateVariables(p, vars))
  );

  // For rounds 2+, inject escalation paragraph if needed
  if (round >= 2 && previousRoundContext) {
    const escalationParagraph = generateEscalationSection(previousRoundContext);
    if (escalationParagraph) {
      bodyParagraphs = [...bodyParagraphs, escalationParagraph];
    }
  }

  // Account list - may include item-specific context for R2+
  const accountList = generateAccountListWithContext(
    accounts,
    craInfo.name,
    effectiveFlow,
    previousRoundContext
  );

  // Account list intro (if present in template)
  const accountListIntro = template.accountListIntro
    ? interpolateVariables(template.accountListIntro, vars)
    : "";

  // Demand section (uses natural escalation)
  const demandLanguage = getDemandLanguage(round);
  const demandSection = demandLanguage;

  // Corrections section
  const correctionsSection = generateCorrectionsSection(accounts, effectiveFlow);

  // AMELIA Doctrine: Personal info disputes persist until confirmed removed
  // R1: Initial disputes from client data
  // R2+: Continue disputing items that are still ACTIVE in PersonalInfoDispute table
  const personalInfoSection = generatePersonalInfoSection(
    client,
    cra,
    round,
    activePersonalInfoDisputes
  );

  // Consumer statement
  const consumerStatement = interpolateVariables(template.consumerStatement, vars);

  // Screenshots reference (R2+)
  const screenshotsRef = shouldIncludeScreenshots(round)
    ? generateScreenshotsReference()
    : "";

  // Closing
  const closing = generateClosing(client.fullName);

  // Assemble the complete letter based on structure preference
  // DAMAGES_FIRST: Personal impact → Legal facts → Account list → Penalty
  // FACTS_FIRST: Legal facts → Personal impact → Account list → Penalty
  const letterParts = [
    header,
    "",
    headline,
    "",
    `Dear ${craInfo.name},`,
    "",
  ];

  // Structure-dependent body assembly
  if (letterStructure === "FACTS_FIRST") {
    // FACTS_FIRST: Legal basis first, then personal impact
    letterParts.push(
      ...bodyParagraphs.map(p => p + "\n"),
      openingParagraph,
      ""
    );
  } else {
    // DAMAGES_FIRST (default): Personal impact first, then legal basis
    letterParts.push(
      openingParagraph,
      "",
      ...bodyParagraphs.map(p => p + "\n")
    );
  }

  // Common sections (same for both structures)
  letterParts.push(
    accountList,
    accountListIntro ? accountListIntro + "\n\n" : "",
    demandSection,
    "",
    correctionsSection
  );

  if (personalInfoSection) {
    letterParts.push(personalInfoSection);
  }

  letterParts.push(
    `Consumer Statement: ${consumerStatement}`,
    screenshotsRef,
    "",
    closing
  );

  const content = letterParts.join("\n").replace(/\n{3,}/g, "\n\n");

  // Calculate content hash
  const contentHash = hashContent(content);

  // Calculate what personal info was disputed in this letter
  let disputedNames: string[] = [];
  let disputedAddresses: string[] = [];
  let disputedInquiries: HardInquiry[] = [];

  if (round === 1) {
    // R1: Use client data
    disputedNames = client.previousNames;
    disputedAddresses = client.previousAddresses;
    disputedInquiries = client.hardInquiries.filter(i => i.cra === cra);
  } else if (activePersonalInfoDisputes && activePersonalInfoDisputes.length > 0) {
    // R2+: Use active disputes that match this CRA
    const craDisputes = activePersonalInfoDisputes.filter(d => d.cra === cra);
    disputedNames = craDisputes.filter(d => d.type === "PREVIOUS_NAME").map(d => d.value);
    disputedAddresses = craDisputes.filter(d => d.type === "PREVIOUS_ADDRESS").map(d => d.value);
    disputedInquiries = craDisputes
      .filter(d => d.type === "HARD_INQUIRY")
      .map(d => ({
        creditorName: d.value,
        inquiryDate: d.inquiryDate || "",
        cra: cra,
      }));
  }

  return {
    content,
    letterDate,
    isBackdated,
    backdatedDays,
    tone,
    flow,
    effectiveFlow,
    round,
    statute: template.statute,
    contentHash,
    includesScreenshots: shouldIncludeScreenshots(round),
    personalInfoDisputed: {
      previousNames: disputedNames,
      previousAddresses: disputedAddresses,
      hardInquiries: disputedInquiries,
    },
    letterStructure,
  };
}

/**
 * Validate that a letter meets all doctrine requirements
 */
export function validateLetter(letter: GeneratedLetter): {
  valid: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  // Round 1 must be backdated
  if (letter.round === 1 && !letter.isBackdated) {
    violations.push("Round 1 letter must be backdated 30 days");
  }

  // Round 1 must be backdated exactly 30 days
  if (letter.round === 1 && letter.backdatedDays !== 30) {
    violations.push(`Round 1 backdating must be exactly 30 days, got ${letter.backdatedDays}`);
  }

  // Content must not be empty
  if (!letter.content || letter.content.length < 500) {
    violations.push("Letter content is too short or empty");
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

// =============================================================================
// FLOW INFORMATION
// =============================================================================

/**
 * Get information about a flow's round progression
 */
export function getFlowRoundInfo(flow: FlowType): {
  maxRounds: number;
  accuracySwitchRounds: number[];
  description: string;
} {
  switch (flow) {
    case "ACCURACY":
      return {
        maxRounds: 11,
        accuracySwitchRounds: [],
        description: "Pure accuracy disputes with FCRA statute escalation",
      };

    case "COLLECTION":
      return {
        maxRounds: 12,
        accuracySwitchRounds: [5, 6, 7],
        description: "Debt validation disputes (R5-R7 uses Accuracy flow)",
      };

    case "CONSENT":
      return {
        maxRounds: 3,
        accuracySwitchRounds: [],
        description: "Privacy and permissible purpose disputes",
      };

    case "COMBO":
      return {
        maxRounds: 12,
        accuracySwitchRounds: [5, 6, 7],
        description: "Combined accuracy + collection disputes (R5-R7 uses Accuracy flow)",
      };
  }
}
