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
  type LetterFormat,
  type TemplateVariables,
  getTemplate,
  getDemandLanguage,
  getEffectiveFlow,
  shouldIncludeScreenshots,
  selectBodyParagraphVariants,
  selectOpeningVariant,
  selectConsumerStatementVariant,
  ACCURACY_TEMPLATES,
  COLLECTION_TEMPLATES,
  CONSENT_TEMPLATES,
  LATE_PAYMENT_TEMPLATES,
  LETTER_STRUCTURE_DESCRIPTIONS,
  LETTER_FORMAT_DESCRIPTIONS,
  STRUCTURED_FORMAT_HEADERS,
} from "./amelia-templates";
export type { FlowType, LetterStructure, LetterFormat } from "./amelia-templates";
export { LETTER_STRUCTURE_DESCRIPTIONS, LETTER_FORMAT_DESCRIPTIONS } from "./amelia-templates";
import {
  type ClientPersonalInfo,
  type DisputeAccount,
  type HardInquiry,
  type DisputeFlowType,
  calculateLetterDate,
  formatLetterDate,
  determineTone,
  determineInaccurateCategories,
  CRA_ADDRESSES,
  hashContent,
  // New doctrine imports
  shouldIncludeCitationsInR1,
  formatPersonalInfoBlock,
  getEffectiveFlowForRound,
  getCaseLawForRound,
  getStatutesForRound,
  getPrimaryStatuteForRound,
  getVoiceForRound,
  getVoicePhaseForRound,
  FLOW_ROUND_LIMITS,
} from "./amelia-doctrine";
import {
  generateUniqueStory,
  humanizeText,
  buildComponentKey,
  generateInfiniteTitle,
  generateNaturalClosing,
} from "./amelia-stories";
import {
  inferConsumerVoice,
  getVoicePhrases,
  applyVoiceToText,
  type ConsumerVoiceProfile,
  type SoulEngineInput,
} from "./amelia-soul-engine";
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
  // Letter format: CONVERSATIONAL (default) or STRUCTURED (bold headers + detailed explanations)
  letterFormat?: LetterFormat;
  // Override the auto-determined tone (used when regenerating with user-selected tone)
  toneOverride?: string;
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
  // Letter format used (CONVERSATIONAL or STRUCTURED)
  letterFormat: LetterFormat;
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
  lines.push(`SSN: XXX-XX-${client.ssnLast4}`);
  // Format DOB as MM/DD/YYYY
  const dob = new Date(client.dateOfBirth);
  const dobFormatted = `${String(dob.getMonth() + 1).padStart(2, '0')}/${String(dob.getDate()).padStart(2, '0')}/${dob.getFullYear()}`;
  lines.push(`DOB: ${dobFormatted}`);
  lines.push("");
  // CRA address block (lines already includes bureau name as first element)
  lines.push(...craInfo.lines);
  lines.push("");
  lines.push(formatLetterDate(letterDate));

  return lines.join("\n");
}

/**
 * Generate the account list section
 * HARD RULE: NO REDUNDANT LISTINGS - just a simple intro, details are in corrections section
 */
function generateAccountList(
  accounts: DisputeAccount[],
  craName: string,
  flow: FlowType
): string {
  // Just a simple intro - the details come in the corrections section
  // This avoids listing the same accounts twice
  const accountCount = accounts.length;
  const accountWord = accountCount === 1 ? "account" : "accounts";

  return `I found ${accountCount} ${accountWord} on my ${craName} report that got problems. Here is what needs to be fixed:\n`;
}

/**
 * Generate the "Requested Corrections / Deletions" section
 *
 * This section auto-populates from the disputed accounts and their specific issues.
 * Each account gets a unique, issue-specific correction request.
 */
function generateCorrectionsSection(
  accounts: DisputeAccount[],
  flow: FlowType,
  seed?: string
): string {
  // HARD RULE: Simple headers, 6th-9th grade reading level
  const headers = [
    "ACCOUNTS THAT NEED TO BE FIXED:",
    "HERES WHATS WRONG:",
    "ACCOUNTS WITH PROBLEMS:",
    "FIX THESE ACCOUNTS:",
  ];
  const headerIndex = seed ? Math.abs(hashString(seed)) % headers.length : 0;
  let section = `${headers[headerIndex]}\n\n`;

  accounts.forEach((account, index) => {
    // Build correction request from ACTUAL issues on the account
    const issueDescriptions = account.issues
      .map(issue => issue.description || issue.code)
      .filter(desc => desc && desc.length > 0);

    // Start with account identifier - simple format
    section += `${index + 1}. ${account.creditorName}`;
    if (account.accountNumber) {
      section += ` (${account.accountNumber})`;
    }
    section += "\n";

    // Add account type if available
    if (account.accountType) {
      section += `   Type: ${account.accountType}\n`;
    }

    // Add specific issues found - simple language
    if (issueDescriptions.length > 0) {
      section += `   Whats Wrong:\n`;
      issueDescriptions.forEach(issue => {
        section += `   - ${issue}\n`;
      });
    }

    // Generate simple action request
    const actionRequest = generateCorrectionAction(account, flow, index, seed);
    section += `   What I Need: ${actionRequest}\n\n`;
  });

  return section;
}

/**
 * Generate a unique correction action request for an account
 */
function generateCorrectionAction(
  account: DisputeAccount,
  flow: FlowType,
  index: number,
  seed?: string
): string {
  const hasLatePaymentIssue = account.issues.some(i =>
    i.code.includes("LATE") || i.code.includes("PAYMENT") || i.code.includes("DELINQ")
  );
  const hasCollectionIssue = account.issues.some(i =>
    i.code.includes("COLLECTION") || i.code.includes("CHARGEOFF")
  );
  const hasBalanceIssue = account.issues.some(i =>
    i.code.includes("BALANCE") || i.code.includes("AMOUNT")
  );
  const hasStatusIssue = account.issues.some(i =>
    i.code.includes("STATUS") || i.code.includes("CLOSED") || i.code.includes("OPEN")
  );

  // HARD RULE: Simple, colloquial action requests

  // Collection flow
  if (flow === "COLLECTION" || hasCollectionIssue) {
    const collectionActions = [
      "Prove you own this debt or take it off",
      "Show me the original paperwork or delete it",
      "I never agreed to this. Remove it",
      "Get proof from the original company or take it off my file",
      "This aint valid. Delete it",
    ];
    const idx = seed ? Math.abs(hashString(seed + account.creditorName + index)) % collectionActions.length : index % collectionActions.length;
    return collectionActions[idx];
  }

  // Late payment issues
  if (hasLatePaymentIssue) {
    const lateActions = [
      "Fix the late payments or remove them",
      "These late marks are wrong. Take them off",
      "I wasnt late. Remove these",
      "Check your records and fix the payment history",
      "The late payments showing are not right. Delete them",
    ];
    const idx = seed ? Math.abs(hashString(seed + account.creditorName + index)) % lateActions.length : index % lateActions.length;
    return lateActions[idx];
  }

  // Balance issues
  if (hasBalanceIssue) {
    const balanceActions = [
      "Fix the balance to the right amount",
      "The amount is wrong. Correct it",
      "Update the balance or remove this",
      "I dont owe this much. Fix it",
    ];
    const idx = seed ? Math.abs(hashString(seed + account.creditorName + index)) % balanceActions.length : index % balanceActions.length;
    return balanceActions[idx];
  }

  // Status issues
  if (hasStatusIssue) {
    const statusActions = [
      "Fix the status on this account",
      "The status is wrong. Update it",
      "Change the status to what it should be",
      "This status aint right. Correct it",
    ];
    const idx = seed ? Math.abs(hashString(seed + account.creditorName + index)) % statusActions.length : index % statusActions.length;
    return statusActions[idx];
  }

  // Generic accuracy
  const genericActions = [
    "Fix this or take it off",
    "This info is wrong. Correct it",
    "Check this account and make it right",
    "The info dont match my records. Fix it",
    "Something aint right here. Look into it",
  ];
  const idx = seed ? Math.abs(hashString(seed + account.creditorName + index)) % genericActions.length : index % genericActions.length;
  return genericActions[idx];
}

/**
 * Simple string hash for deterministic randomization
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return hash;
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
    // HARD RULE: Simple language for personal info
    if (client.previousNames.length > 0) {
      sections.push("OLD NAMES TO TAKE OFF:");
      client.previousNames.forEach(name => {
        sections.push(`- ${name}`);
      });
      sections.push("These names aint me no more. Remove them.");
      sections.push("");
    }

    // Previous addresses
    if (client.previousAddresses.length > 0) {
      sections.push("OLD ADDRESSES TO TAKE OFF:");
      client.previousAddresses.forEach(addr => {
        sections.push(`- ${addr}`);
      });
      sections.push("I dont live at these places no more. Take them off.");
      sections.push("");
    }

    // AMELIA Doctrine: ALWAYS include hard inquiries in R1 if any exist
    // HARD RULE: Simple format - "{CREDITOR} CRD made on {date}"
    const craInquiries = client.hardInquiries.filter(inq => inq.cra === cra);
    if (craInquiries.length > 0) {
      sections.push("INQUIRIES I DID NOT AUTHORIZE:");
      craInquiries.forEach(inq => {
        sections.push(`- ${inq.creditorName} CRD made on ${inq.inquiryDate}`);
      });
      sections.push("I never gave permission for these. Take them off my file.");
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

      // HARD RULE: Simple language for R2+ disputes
      if (names.length > 0) {
        sections.push("OLD NAMES STILL ON MY FILE:");
        names.forEach(d => {
          sections.push(`- ${d.value} (asked ${d.disputeCount} time${d.disputeCount > 1 ? "s" : ""} already)`);
        });
        sections.push("Already told yall about these. Why they still there?");
        sections.push("");
      }

      if (addresses.length > 0) {
        sections.push("OLD ADDRESSES STILL ON MY FILE:");
        addresses.forEach(d => {
          sections.push(`- ${d.value} (asked ${d.disputeCount} time${d.disputeCount > 1 ? "s" : ""} already)`);
        });
        sections.push("These addresses still showing. I asked before. Remove them.");
        sections.push("");
      }

      if (inquiries.length > 0) {
        // HARD RULE: Simple format - "{CREDITOR} CRD made on {date}"
        sections.push("INQUIRIES STILL ON MY FILE THAT I NEVER AUTHORIZED:");
        inquiries.forEach(d => {
          const dateStr = d.inquiryDate ? ` made on ${d.inquiryDate}` : "";
          sections.push(`- ${d.value} CRD${dateStr}`);
        });
        sections.push("Already asked yall to remove these. Still showing. Take them off.");
        sections.push("");
      }
    }
  }

  if (sections.length === 0) {
    return "";
  }

  // HARD RULE: Simple headers
  const headerText = round === 1
    ? "OTHER STUFF ON MY FILE THATS WRONG:"
    : "STUFF I ALREADY ASKED YALL TO FIX:";

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
// STRUCTURED FORMAT GENERATORS (Bold headers, separate sections)
// =============================================================================

/**
 * Select a randomized header from the pool for eOSCAR resistance
 */
function selectStructuredHeader(
  headerPool: string[],
  seed: string,
  bureauName?: string
): string {
  const idx = Math.abs(hashString(seed)) % headerPool.length;
  let header = headerPool[idx];
  if (bureauName) {
    header = header.replace("{bureauName}", bureauName);
  }
  return header;
}

/**
 * Generate STRUCTURED format: Simple account quick list
 * Just creditor name + account number in bullet format
 */
function generateStructuredAccountQuickList(
  accounts: DisputeAccount[],
  bureauName: string,
  seed: string
): string {
  const header = selectStructuredHeader(
    STRUCTURED_FORMAT_HEADERS.accountList,
    seed + "-accountlist",
    bureauName
  );

  const bullets = accounts.map(account => {
    const acctNum = account.accountNumber || "No Account Number";
    return `• ${account.creditorName} — Account #${acctNum}`;
  });

  return `**${header}**\n\n${bullets.join("\n")}`;
}

/**
 * Generate STRUCTURED format: Detailed corrections section
 * Prose explanation for each account with specific details
 */
function generateStructuredCorrectionsSection(
  accounts: DisputeAccount[],
  flow: FlowType,
  seed: string
): string {
  const header = selectStructuredHeader(
    STRUCTURED_FORMAT_HEADERS.corrections,
    seed + "-corrections"
  );

  const explanations = accounts.map(account => {
    const acctNum = account.accountNumber || "No Account Number";
    const explanation = generateStructuredAccountExplanation(account, flow, seed);
    return `• ${account.creditorName} (${acctNum}) — ${explanation}`;
  });

  return `**${header}**\n\n${explanations.join("\n\n")}`;
}

/**
 * Generate a detailed prose explanation for a single account
 * Kitchen Table voice but with specific details for high specificity score
 */
function generateStructuredAccountExplanation(
  account: DisputeAccount,
  flow: FlowType,
  seed: string
): string {
  const issues = account.issues || [];
  const hasBalanceIssue = issues.some(i =>
    i.code.includes("BALANCE") || i.code.includes("AMOUNT")
  );
  const hasLatePaymentIssue = issues.some(i =>
    i.code.includes("LATE") || i.code.includes("PAYMENT") || i.code.includes("DELINQ")
  );
  const hasCollectionIssue = issues.some(i =>
    i.code.includes("COLLECTION") || i.code.includes("CHARGEOFF")
  );
  const hasStatusIssue = issues.some(i =>
    i.code.includes("STATUS") || i.code.includes("CLOSED") || i.code.includes("OPEN")
  );
  const hasNotMineIssue = issues.some(i =>
    i.code.includes("NOT_MINE") || i.code.includes("FRAUD") || i.code.includes("IDENTITY")
  );

  // Build issue-specific explanations with details
  const issueDescriptions = issues
    .map(issue => issue.description || issue.code)
    .filter(desc => desc && desc.length > 0);

  // Collection accounts
  if (flow === "COLLECTION" || hasCollectionIssue) {
    const collectionExplanations = [
      `I do not recognize this account and have never done business with this company. I am disputing this as not my account. Delete this tradeline unless you can provide documentation proving this debt belongs to me.`,
      `This collection is being disputed because I have no record of this debt. Provide validation showing the original creditor, original amount, and proof this is my obligation, or remove it from my file.`,
      `I never agreed to owe this company anything. Show me signed documentation with my signature or delete this account. Reporting unverified debt is inaccurate.`,
      `This debt collector has no business on my credit report. I dispute the validity of this account entirely. Remove it or prove with original paperwork that its mine.`,
    ];
    const idx = Math.abs(hashString(seed + account.creditorName)) % collectionExplanations.length;
    return collectionExplanations[idx];
  }

  // Not mine / fraud
  if (hasNotMineIssue) {
    const notMineExplanations = [
      `I do not recognize this account. I have never applied for or opened an account with this company. This may be the result of identity theft or a mixed file. Delete this tradeline unless you can verify I personally opened this account.`,
      `This account does not belong to me. I have no knowledge of ever doing business with this creditor. Investigate this as a potential fraud or mixed file issue and remove if you cannot prove its mine.`,
      `I am disputing this account as not belonging to me. My records show no history with this company. Verify this account belongs to me personally or delete it.`,
    ];
    const idx = Math.abs(hashString(seed + account.creditorName)) % notMineExplanations.length;
    return notMineExplanations[idx];
  }

  // Balance issues - include specific amounts when available
  if (hasBalanceIssue) {
    const balanceIssue = issues.find(i => i.code.includes("BALANCE") || i.code.includes("AMOUNT"));
    const details = balanceIssue?.description || "The balance is incorrect";
    const balanceExplanations = [
      `${details}. This balance does not match my records and needs to be corrected to reflect the accurate amount, or delete the tradeline entirely if it cannot be verified.`,
      `The balance showing on this account is wrong. ${details}. Fix this to show the correct amount or remove the account if you cannot verify the accurate balance.`,
      `${details}. I am disputing this balance as inaccurate. Correct it to match what I actually owe or delete the tradeline.`,
    ];
    const idx = Math.abs(hashString(seed + account.creditorName)) % balanceExplanations.length;
    return balanceExplanations[idx];
  }

  // Late payment issues
  if (hasLatePaymentIssue) {
    const lateIssue = issues.find(i => i.code.includes("LATE") || i.code.includes("PAYMENT"));
    const details = lateIssue?.description || "Late payments are showing incorrectly";
    const lateExplanations = [
      `${details}. I have records showing I was not late during these periods. Remove the late payment notations or provide proof of the exact dates I was late.`,
      `The late payment history on this account is inaccurate. ${details}. Correct the payment history to reflect accurate information or delete the negative marks.`,
      `${details}. These late marks are damaging my credit and they are not accurate. Fix the payment history or remove the late notations entirely.`,
    ];
    const idx = Math.abs(hashString(seed + account.creditorName)) % lateExplanations.length;
    return lateExplanations[idx];
  }

  // Status issues
  if (hasStatusIssue) {
    const statusIssue = issues.find(i => i.code.includes("STATUS"));
    const details = statusIssue?.description || "The account status is wrong";
    const statusExplanations = [
      `${details}. This status does not reflect the true condition of this account. Correct the status to match reality or explain how you verified this status.`,
      `The status being reported is inaccurate. ${details}. Update this to the correct status or provide documentation showing how this status was verified.`,
      `${details}. Fix this status to reflect accurate information about my account.`,
    ];
    const idx = Math.abs(hashString(seed + account.creditorName)) % statusExplanations.length;
    return statusExplanations[idx];
  }

  // Generic accuracy issues - use all issue descriptions
  const genericExplanations = [
    `The information on this account contains errors${issueDescriptions.length > 0 ? `: ${issueDescriptions.join("; ")}` : ""}. These inaccuracies need to be corrected or the account should be deleted if it cannot be verified as accurate.`,
    `This account is reporting inaccurately${issueDescriptions.length > 0 ? ` — specifically: ${issueDescriptions.join(", ")}` : ""}. Investigate and correct these errors or remove the tradeline.`,
    `I am disputing the accuracy of this account${issueDescriptions.length > 0 ? `. Issues include: ${issueDescriptions.join("; ")}` : ""}. Fix these problems or delete the account if you cannot verify the information is correct.`,
  ];
  const idx = Math.abs(hashString(seed + account.creditorName)) % genericExplanations.length;
  return genericExplanations[idx];
}

/**
 * Generate STRUCTURED format: Personal information section
 * Separate section with bold header for old names/addresses
 */
function generateStructuredPersonalInfoSection(
  client: ClientPersonalInfo,
  cra: CRA,
  round: number,
  activeDisputes?: ActivePersonalInfoDispute[],
  seed?: string
): string {
  const items: string[] = [];

  if (round === 1) {
    // Round 1: Use client data directly
    client.previousNames.forEach(name => {
      items.push(`• ${name} — This is an old name that no longer applies to me. Remove this from my file as it does not reflect my current legal name.`);
    });

    client.previousAddresses.forEach(addr => {
      items.push(`• ${addr} — This is an old address I no longer live at. Remove this from my file as it does not reflect my current residence and could be tied to accounts that arent mine.`);
    });
  } else {
    // Round 2+: Use active disputes
    if (activeDisputes && activeDisputes.length > 0) {
      const craDisputes = activeDisputes.filter(d => d.cra === cra);
      const names = craDisputes.filter(d => d.type === "PREVIOUS_NAME");
      const addresses = craDisputes.filter(d => d.type === "PREVIOUS_ADDRESS");

      names.forEach(d => {
        items.push(`• ${d.value} — I already asked to have this old name removed (${d.disputeCount} time${d.disputeCount > 1 ? "s" : ""}). It does not belong on my file.`);
      });

      addresses.forEach(d => {
        items.push(`• ${d.value} — I already disputed this old address (${d.disputeCount} time${d.disputeCount > 1 ? "s" : ""}). Remove it from my file.`);
      });
    }
  }

  if (items.length === 0) {
    return "";
  }

  const header = selectStructuredHeader(
    STRUCTURED_FORMAT_HEADERS.personalInfo,
    (seed || "") + "-personalinfo"
  );

  return `**${header}**\n\n${items.join("\n\n")}`;
}

/**
 * Generate STRUCTURED format: Hard inquiries section
 * Separate section with bold header for unauthorized inquiries
 */
function generateStructuredInquiriesSection(
  client: ClientPersonalInfo,
  cra: CRA,
  round: number,
  activeDisputes?: ActivePersonalInfoDispute[],
  seed?: string
): string {
  const items: string[] = [];

  if (round === 1) {
    // Round 1: Use client hard inquiries
    const craInquiries = client.hardInquiries.filter(inq => inq.cra === cra);
    craInquiries.forEach(inq => {
      items.push(`• ${inq.creditorName} — Inquiry made on ${inq.inquiryDate} — I did not authorize this company to pull my credit. I never applied for anything with them. Remove this unauthorized inquiry from my report.`);
    });
  } else {
    // Round 2+: Use active disputes
    if (activeDisputes && activeDisputes.length > 0) {
      const craDisputes = activeDisputes.filter(d => d.cra === cra && d.type === "HARD_INQUIRY");
      craDisputes.forEach(d => {
        const dateStr = d.inquiryDate ? ` made on ${d.inquiryDate}` : "";
        items.push(`• ${d.value}${dateStr} — I already disputed this inquiry (${d.disputeCount} time${d.disputeCount > 1 ? "s" : ""}). I never authorized this pull. Remove it.`);
      });
    }
  }

  if (items.length === 0) {
    return "";
  }

  const header = selectStructuredHeader(
    STRUCTURED_FORMAT_HEADERS.inquiries,
    (seed || "") + "-inquiries"
  );

  return `**${header}**\n\n${items.join("\n\n")}`;
}

/**
 * Generate STRUCTURED format: Consumer statement with label
 */
function generateStructuredConsumerStatement(
  round: number,
  seed: string
): string {
  const header = selectStructuredHeader(
    STRUCTURED_FORMAT_HEADERS.consumerStatement,
    seed + "-consumer"
  );

  // Kitchen Table voice closing statements
  const statements = [
    "These wrong items have been holding me back for too long. Im asking you to look into each one carefully and only report what is accurate and really tied to me. I want my credit file to show the truth so I can be judged fairly and move on without these mistakes following me around.",
    "These inaccuracies have been messing with my life for way too long. Please investigate everything I listed and fix what needs fixing. All I want is for my credit report to tell the truth about who I am.",
    "Ive been dealing with these errors long enough. Look into each item I disputed and only keep whats actually accurate. I deserve to have a credit file that reflects the real me, not someone elses mistakes.",
    "These problems on my report have caused real harm to me and my family. Im asking you to do a proper investigation and correct or delete what doesnt belong. I just want fair treatment based on accurate information.",
  ];

  const idx = Math.abs(hashString(seed)) % statements.length;
  return `**${header}** ${statements[idx]}`;
}

/**
 * Generate STRUCTURED format: Closing signature
 */
function generateStructuredClosing(clientName: string): string {
  return `Best,\n\n${clientName}`;
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
  context?: NextRoundContext,
  round: number = 1
): string {
  // HARD RULE: R1 = NO REDUNDANT LISTING, NO CITATIONS
  // Just a simple intro, details come in corrections section
  if (round === 1 || !context?.itemContexts || context.itemContexts.length === 0) {
    const accountCount = accounts.length;
    const accountWord = accountCount === 1 ? "account" : "accounts";
    return `I found ${accountCount} ${accountWord} on my ${craName} report that got problems:\n`;
  }

  // R2+: Include context from previous disputes (with simple language)
  let section = `These accounts still got issues after my last letter:\n\n`;

  accounts.forEach((account, index) => {
    section += `${index + 1}. ${account.creditorName} (${account.accountNumber})\n`;

    // Add item-specific context from previous round if available
    const itemContext = context.itemContexts.find(
      ic => ic.creditorName === account.creditorName
    );

    if (itemContext) {
      // Add previous outcome reference in simple language
      if (itemContext.previousOutcome === "VERIFIED") {
        section += `   Last time: Yall said it was verified but showed no proof\n`;
        section += `   This time: Show me how you verified it\n`;
      } else if (itemContext.previousOutcome === "NO_RESPONSE") {
        section += `   Last time: No response at all\n`;
        section += `   This time: Delete it since you ignored me\n`;
      } else if (itemContext.previousOutcome === "STALL_LETTER") {
        section += `   Last time: Got a runaround letter\n`;
        section += `   This time: Actually investigate this\n`;
      } else if (itemContext.previousOutcome === "UPDATED") {
        section += `   Last time: Made some changes but still wrong\n`;
        section += `   This time: Fix it all the way\n`;
      }
    }

    section += "\n";
  });

  return section;
}

// =============================================================================
// LEGAL SECTION GENERATION (Based on R1 Citation Strategy)
// =============================================================================

/**
 * Generate the legal citations section based on flow and round.
 *
 * UNIVERSAL RULE 1: R1 Citation Strategy
 * - ACCURACY: NO citations in R1 (story first)
 * - COLLECTION: YES citations in R1 (debt validation required)
 * - CONSENT: YES citations in R1 (privacy violations need legal basis)
 * - COMBO: Mixed (depends on primary issue)
 */
function generateLegalSection(
  flow: FlowType,
  round: number,
  primaryIssue?: string
): string {
  // Check if we should include citations in R1
  if (round === 1 && !shouldIncludeCitationsInR1(flow as DisputeFlowType, primaryIssue)) {
    // No legal section for R1 ACCURACY - just the story and facts
    return "";
  }

  // Get applicable statutes for this flow/round
  const statutes = getStatutesForRound(flow as DisputeFlowType, round);
  if (statutes.length === 0) return "";

  // Get the primary statute to feature
  const primaryStatute = getPrimaryStatuteForRound(flow as DisputeFlowType, round);

  // Get applicable case law
  const caseLaw = getCaseLawForRound(round);

  const sections: string[] = [];

  // Add primary statute reference (if not R1 for accuracy flows)
  if (primaryStatute && round >= 3) {
    sections.push(
      `Under ${primaryStatute.code} (${primaryStatute.title}), ${primaryStatute.description.toLowerCase()}.`
    );
  }

  // Add case law for higher rounds
  if (caseLaw.length > 0 && round >= 4) {
    const relevantCase = caseLaw[0]; // Use most relevant case
    sections.push(
      `As established in ${relevantCase.name}, ${relevantCase.shortDescription.toLowerCase()}.`
    );
  }

  // For collection flow R1, add debt validation language
  if (flow === "COLLECTION" && round === 1) {
    sections.push(
      `Under 15 USC 1692g, you are required to provide validation of this debt within 30 days of my request.`
    );
  }

  // For consent flow R1, add permissible purpose language
  if (flow === "CONSENT" && round === 1) {
    sections.push(
      `Under the Fair Credit Reporting Act, you must have a permissible purpose to access my credit report. I did not authorize this access.`
    );
  }

  return sections.join(" ");
}

/**
 * Get voice-appropriate opening phrases based on round
 */
function getVoiceAppropriateOpening(round: number): string[] {
  const voiceInfo = getVoiceForRound(round);
  return voiceInfo.language;
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
    letterFormat = "STRUCTURED", // Default to STRUCTURED (recommended for higher specificity)
    toneOverride,
  } = input;

  const craInfo = CRA_ADDRESSES[cra];

  // Determine effective flow (handles R5-R7 switching for COLLECTION/COMBO)
  // Uses doctrine's getEffectiveFlowForRound for proper flow switching
  const effectiveFlow = getEffectiveFlowForRound(flow as DisputeFlowType, round) as FlowType;

  // Get the template for this flow/round
  const template = getTemplate(effectiveFlow, round);
  if (!template) {
    throw new Error(`No template found for ${effectiveFlow} flow, round ${round}`);
  }

  // Calculate letter date (30-day backdate for R1)
  const { letterDate, isBackdated, backdatedDays } = calculateLetterDate(round);

  // Determine tone - may be escalated based on previous responses
  let tone = determineTone(round);
  if (toneOverride) {
    // Direct tone override from user selection (e.g., regeneration with specific tone)
    const validTones = ["CONCERNED", "WORRIED", "FED_UP", "WARNING", "PISSED"] as const;
    if (validTones.includes(toneOverride as typeof validTones[number])) {
      tone = toneOverride as typeof tone;
    }
  } else if (previousRoundContext?.suggestedTone) {
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

  // SOUL ENGINE INTEGRATION: Generate unique voice profile for this consumer
  // This ensures every letter has a distinct, human voice
  let voiceProfile: ConsumerVoiceProfile | null = null;
  try {
    const soulInput: SoulEngineInput = {
      client: {
        name: client.fullName,
        dob: client.dateOfBirth,
        address: `${client.city}, ${client.state}`,
      },
      account: {
        creditorName: accounts[0]?.creditorName || "Unknown",
        accountType: accounts[0]?.accountType || "Credit Account",
        currentStatus: accounts[0]?.paymentStatus || "Disputed",
        reportedBalance: accounts[0]?.balance,
      },
      disputeConfig: {
        mode: "dispute_flow",
        round,
        priorDisputeDates: lastDisputeDate ? [lastDisputeDate] : undefined,
      },
      disputeTarget: {
        entityType: effectiveFlow === "COLLECTION" ? "collector" : "CRA",
      },
    };
    voiceProfile = inferConsumerVoice(soulInput);
  } catch {
    // If Soul Engine fails, continue without voice profile
    voiceProfile = null;
  }

  // Get voice-specific phrases if we have a profile
  const voicePhrases = voiceProfile ? getVoicePhrases(voiceProfile) : null;

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

  // HARD RULE: Infinite unique title - centered and bold
  // Seed with client + round + CRA for deterministic but unique generation
  const titleSeed = `${client.fullName}-${cra}-${round}-${Date.now()}`;
  const rawTitle = generateInfiniteTitle(titleSeed);
  // Format: centered (using spaces) and bold (using ** for markdown, uppercase for plain text)
  const headline = `                    **${rawTitle.toUpperCase()}**`;

  // Opening paragraph (DAMAGES) - select from variants for uniqueness
  // Use client + date + CRA as seed for deterministic but unique selection
  const variantSeed = `${client.fullName}-${letterDate.toISOString()}-${cra}-${round}`;
  const { paragraph: selectedOpening } = selectOpeningVariant(template, variantSeed);
  let openingParagraph = interpolateVariables(selectedOpening, vars);

  // AMELIA Doctrine: ALL rounds get unique stories for eOSCAR resistance
  // R1: Standard story generation from scenario pools
  // R2+: Escalation stories + continuation connectors, mixed with adaptive context
  const story = generateUniqueStory(usedContentHashes, round);
  usedContentHashes.add(story.hash);

  if (round === 1) {
    // R1: Story appended to humanized opening
    openingParagraph = humanizeText(openingParagraph) + "\n\n" + story.paragraph;
  } else if (previousRoundContext) {
    // R2+ with context: Adaptive opening + story paragraph
    const adaptiveOpening = generateAdaptiveOpening(previousRoundContext, client.firstName, vars);
    openingParagraph = adaptiveOpening + "\n\n" + story.paragraph;
  } else {
    // R2+ without context: Humanized template opening + story
    openingParagraph = humanizeText(openingParagraph) + "\n\n" + story.paragraph;
  }

  // Body paragraphs (STORY/FACTS) — select from variants when available
  const { paragraphs: selectedParagraphs, variantComboKey } = selectBodyParagraphVariants(
    template,
    usedContentHashes // reuse hash set to track variant combos
  );
  let bodyParagraphs = selectedParagraphs.map(p =>
    humanizeText(interpolateVariables(p, vars))
  );

  // For rounds 2+, inject escalation paragraph if needed
  if (round >= 2 && previousRoundContext) {
    const escalationParagraph = generateEscalationSection(previousRoundContext);
    if (escalationParagraph) {
      bodyParagraphs = [...bodyParagraphs, escalationParagraph];
    }
  }

  // UNIVERSAL RULE 1: R1 Citation Strategy
  // Generate legal section based on flow and round
  // ACCURACY R1 = NO citations, COLLECTION/CONSENT R1 = YES citations
  const primaryIssue = accounts[0]?.issues[0]?.description;
  const legalSection = generateLegalSection(flow, round, primaryIssue);
  if (legalSection) {
    bodyParagraphs.push(legalSection);
  }

  // =========================================================================
  // FORMAT-SPECIFIC SECTION GENERATION
  // =========================================================================

  // Seed for randomized headers (ensures consistency within same letter)
  const formatSeed = `${client.fullName}-${letterDate.toISOString()}-${cra}-${round}`;

  // Screenshots reference (R2+)
  const screenshotsRef = shouldIncludeScreenshots(round)
    ? generateScreenshotsReference()
    : "";

  // Variables for sections that differ by format
  let accountListSection: string;
  let correctionsSection: string;
  let personalInfoSection: string;
  let inquiriesSection: string;
  let closingSection: string;
  let consumerStatementSection: string;

  if (letterFormat === "STRUCTURED") {
    // =====================================================================
    // STRUCTURED FORMAT: Bold headers, separate quick list + detailed explanations
    // =====================================================================

    // Simple bullet list of account names + numbers
    accountListSection = generateStructuredAccountQuickList(
      accounts,
      craInfo.name,
      formatSeed
    );

    // Detailed prose explanation per account
    correctionsSection = generateStructuredCorrectionsSection(
      accounts,
      effectiveFlow,
      formatSeed
    );

    // Separate section for old names/addresses
    personalInfoSection = generateStructuredPersonalInfoSection(
      client,
      cra,
      round,
      activePersonalInfoDisputes,
      formatSeed
    );

    // Separate section for hard inquiries
    inquiriesSection = generateStructuredInquiriesSection(
      client,
      cra,
      round,
      activePersonalInfoDisputes,
      formatSeed
    );

    // Consumer statement with label
    consumerStatementSection = generateStructuredConsumerStatement(round, formatSeed);

    // "Best," closing
    closingSection = generateStructuredClosing(client.fullName);

  } else {
    // =====================================================================
    // CONVERSATIONAL FORMAT: Current AMELIA style - combined, casual
    // =====================================================================

    // Account list with context (may include item-specific context for R2+)
    accountListSection = generateAccountListWithContext(
      accounts,
      craInfo.name,
      effectiveFlow,
      previousRoundContext,
      round
    );

    // Combined corrections section
    const correctionsSeed = `${client.fullName}-${letterDate.toISOString()}-${cra}`;
    correctionsSection = generateCorrectionsSection(accounts, effectiveFlow, correctionsSeed);

    // Combined personal info (names, addresses, inquiries together)
    personalInfoSection = generatePersonalInfoSection(
      client,
      cra,
      round,
      activePersonalInfoDisputes
    );

    // No separate inquiries section (included in personalInfoSection)
    inquiriesSection = "";

    // Natural closing paragraph (no label)
    const closingSeed = `${client.fullName}-${cra}-${round}-closing`;
    consumerStatementSection = generateNaturalClosing(round, closingSeed);

    // "Sincerely," closing
    closingSection = generateClosing(client.fullName);
  }

  // Demand section (same for both formats - uses natural escalation)
  const demandLanguage = getDemandLanguage(round);
  const demandSection = demandLanguage;

  // Account list intro (if present in template) - only for CONVERSATIONAL
  const accountListIntro = (letterFormat === "CONVERSATIONAL" && template.accountListIntro)
    ? interpolateVariables(template.accountListIntro, vars)
    : "";

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

  // =========================================================================
  // FORMAT-SPECIFIC LETTER ASSEMBLY
  // =========================================================================

  if (letterFormat === "STRUCTURED") {
    // STRUCTURED FORMAT assembly:
    // Opening → Body → Account Quick List → Demand → Detailed Corrections → Personal Info → Inquiries → Consumer Statement → Closing

    letterParts.push(
      accountListSection, // Quick reference list with bold header
      "",
      demandSection, // "You have an opportunity to fix this..."
      "",
      correctionsSection, // Detailed explanations with bold header
      ""
    );

    if (personalInfoSection) {
      letterParts.push(personalInfoSection, "");
    }

    if (inquiriesSection) {
      letterParts.push(inquiriesSection, "");
    }

    letterParts.push(
      consumerStatementSection, // Labeled "Consumer Statement:"
      screenshotsRef,
      "",
      closingSection // "Best,"
    );

  } else {
    // CONVERSATIONAL FORMAT assembly (original AMELIA style):
    // Opening → Body → Account List → Demand → Corrections → Personal Info → Natural Closing

    letterParts.push(
      accountListSection,
      accountListIntro ? accountListIntro + "\n\n" : "",
      demandSection,
      "",
      correctionsSection
    );

    if (personalInfoSection) {
      letterParts.push(personalInfoSection);
    }

    letterParts.push(
      consumerStatementSection, // Natural closing paragraph (no label)
      screenshotsRef,
      "",
      closingSection // "Sincerely,"
    );
  }

  let content = letterParts.join("\n").replace(/\n{3,}/g, "\n\n");

  // SOUL ENGINE: Apply voice transformation to make letter unique
  // This adds contractions, adjusts formality, and personalizes language
  if (voiceProfile) {
    content = applyVoiceToText(content, voiceProfile);
  }

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
    letterFormat,
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

  // Round 1 must be backdated 60-69 days
  if (letter.round === 1 && !letter.isBackdated) {
    violations.push("Round 1 letter must be backdated 60-69 days");
  }

  // Round 1 must be backdated within 60-69 day range
  if (letter.round === 1 && (letter.backdatedDays < 60 || letter.backdatedDays > 69)) {
    violations.push(`Round 1 backdating must be 60-69 days, got ${letter.backdatedDays}`);
  }

  // Round 2+ must be backdated 30-39 days
  if (letter.round >= 2 && !letter.isBackdated) {
    violations.push("Round 2+ letter must be backdated 30-39 days");
  }

  if (letter.round >= 2 && (letter.backdatedDays < 30 || letter.backdatedDays > 39)) {
    violations.push(`Round 2+ backdating must be 30-39 days, got ${letter.backdatedDays}`);
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

// =============================================================================
// FULL AI MODE EXPORTS (Recommended)
// =============================================================================

// Re-export full AI generator for easy access
export {
  generateFullAILetter,
  regenerateFullAILetter,
  type FullAILetterInput,
  type GeneratedFullAILetter,
} from "./amelia-full-ai-generator";

/**
 * Letter generation mode
 * - PROFESSIONAL: Traditional template-based letters with Soul Engine
 * - FULL_AI: 100% AI-generated letters - every word unique (Recommended)
 */
export type LetterMode = "PROFESSIONAL" | "FULL_AI";

/**
 * Generate a letter in either professional or full AI mode
 *
 * FULL_AI mode (recommended) generates every part of the letter via AI:
 * - Unique openings every time
 * - Unique issue explanations
 * - Unique demands and legal references
 * - No two letters are ever the same
 */
export async function generateLetterWithMode(
  input: LetterGenerationInput & { mode?: LetterMode; organizationId?: string }
): Promise<GeneratedLetter | import("./amelia-full-ai-generator").GeneratedFullAILetter> {
  const { mode = "FULL_AI", organizationId = "default", ...letterInput } = input;

  if (mode === "FULL_AI") {
    // Use full AI generator - 100% unique letters
    const { generateFullAILetter } = await import("./amelia-full-ai-generator");
    return generateFullAILetter({
      client: letterInput.client,
      accounts: letterInput.accounts,
      cra: letterInput.cra,
      flow: letterInput.flow,
      round: letterInput.round,
      lastDisputeDate: letterInput.lastDisputeDate,
      organizationId,
    });
  }

  // Use traditional professional generator
  return generateLetter(letterInput);
}
