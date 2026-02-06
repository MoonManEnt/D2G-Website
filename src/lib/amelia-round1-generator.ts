/**
 * AMELIA Round 1 Letter Generator
 *
 * Generates complete Round 1 dispute letters following all doctrine rules:
 * - 30-day backdating
 * - DAMAGES → STORY → FACTS → PENALTY structure
 * - Account list with inaccurate categories
 * - "Requested Corrections / Deletions" section
 * - Personal information disputes (names, addresses, inquiries)
 * - Unique human stories (eOSCAR resistant)
 */

import {
  type ClientPersonalInfo,
  type DisputeAccount,
  type HardInquiry,
  type DisputeFlowType,
  type GeneratedLetterOutput,
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
  addEscalationLanguage,
  hashStory,
} from "./amelia-stories";
import type { CRA } from "@/types";

// =============================================================================
// LETTER SECTION GENERATORS
// =============================================================================

/**
 * Generate the client header block
 */
function generateClientHeader(
  client: ClientPersonalInfo,
  cra: CRA,
  letterDate: Date
): string {
  const craInfo = CRA_ADDRESSES[cra];

  let header = `${client.fullName}\n`;
  header += `${client.addressLine1}\n`;
  if (client.addressLine2) {
    header += `${client.addressLine2}\n`;
  }
  header += `${client.city}, ${client.state} ${client.zipCode}\n`;
  // AMELIA Doctrine: SSN only, NO DOB in dispute letters
  header += `SSN: XXX-XX-${client.ssnLast4}\n\n`;

  // CRA Address
  header += `${craInfo.name}\n`;
  header += craInfo.lines.join("\n");
  header += `\n\n${formatLetterDate(letterDate)}\n`;

  return header;
}

/**
 * Generate the headline/subject
 */
function generateHeadline(): string {
  return "REQUEST TO INVESTIGATE INACCURATE REPORTING";
}

/**
 * Generate the opening paragraph - DAMAGES (affects my life)
 */
function generateDamagesParagraph(
  craName: string,
  usedHashes: Set<string>
): string {
  // Opening sentences that establish the problem
  const openers = [
    `I'm writing because the information being reported on my credit file is inaccurate, and it has been affecting my life in real ways.`,
    `I need to bring something to your attention. My credit report contains errors that are causing real problems in my life.`,
    `There's inaccurate information on my credit report, and it's affecting my ability to provide for my family.`,
    `I'm reaching out because I found errors on my credit file that are damaging my life.`,
    `Something is wrong with my credit report, and the consequences have been serious.`,
  ];

  // Select opener that hasn't been used
  let selectedOpener = openers[0];
  for (const opener of openers.sort(() => Math.random() - 0.5)) {
    if (!usedHashes.has(hashStory(opener))) {
      selectedOpener = opener;
      break;
    }
  }

  return selectedOpener;
}

/**
 * Generate the STORY paragraph - unique humanized narrative
 */
function generateStoryParagraph(
  usedHashes: Set<string>,
  round: number
): string {
  const story = generateUniqueStory(usedHashes, round);

  // Mark this story as used
  usedHashes.add(story.hash);

  let paragraph = story.paragraph;

  // Humanize the text
  paragraph = humanizeText(paragraph);

  // Add escalation for later rounds
  paragraph = addEscalationLanguage(paragraph, round);

  return paragraph;
}

/**
 * Generate the FACTS paragraph - what's wrong, investigation request
 */
function generateFactsParagraph(craName: string): string {
  const factsVariations = [
    `After reviewing my report closely, I found multiple items that are not reporting accurately or consistently. Some information does not match my records, and some does not line up across the way it's being reported. When a credit report is accurate, it tells one clear story - right now, mine doesn't. I am requesting that you investigate each item listed below and verify whether it is being reported accurately and completely.`,

    `I've gone through my credit report carefully, and I've identified several items that contain inaccurate information. Some of the details don't match what I know to be true, and there are inconsistencies that need to be addressed. A credit report should be accurate - mine isn't. Please investigate each disputed item listed below.`,

    `Upon careful review of my credit file, I discovered information that is being reported inaccurately. The details don't align with my records, and there are discrepancies that must be corrected. I'm requesting that you investigate each item I've listed and verify its accuracy.`,

    `I reviewed my report and found errors that need your attention. Information is being reported that doesn't match my records. Please investigate the items below and verify whether they are accurate and complete.`,
  ];

  return factsVariations[Math.floor(Math.random() * factsVariations.length)];
}

/**
 * Generate the investigation request paragraph
 */
function generateInvestigationRequest(): string {
  const variations = [
    `Please investigate the disputed items and correct any information that is inaccurate, incomplete, or cannot be verified. I am not disputing my entire report - only the specific items listed - and I expect your reinvestigation to reflect what is actually true. Once your investigation is complete, please send me written results and an updated copy of my report showing any changes made.`,

    `I am requesting a thorough investigation of each disputed item. Correct or delete any information that cannot be verified with documentation. I expect written results of your investigation and an updated copy of my report.`,

    `Investigate each item below and verify its accuracy with the furnisher. If it cannot be verified, delete it. Send me the results in writing along with an updated report.`,
  ];

  return variations[Math.floor(Math.random() * variations.length)];
}

/**
 * Generate the PENALTY paragraph - way out or consequences
 */
function generatePenaltyParagraph(round: number): string {
  const variations = [
    `You have an opportunity to fix this without dragging it out. Delete the inaccurate information listed below and send me written confirmation, and I will consider this matter resolved. If you choose to keep publishing inaccuracies after receiving this notice, I am prepared to pursue all available remedies for the harm your reporting is causing.`,

    `This is your chance to make this right. Remove the inaccurate items and confirm in writing, and we're done. If you continue reporting false information after this notice, I'll pursue every legal remedy available to me.`,

    `Delete the disputed items and send confirmation - that's all I'm asking. If you refuse and keep reporting inaccurate information, I'm prepared to take legal action for the damage it's causing.`,

    `Fix this now and we can move on. Delete what's inaccurate and send me written confirmation. If you don't, know that I'm documenting everything and will pursue my rights under the law.`,
  ];

  return variations[Math.floor(Math.random() * variations.length)];
}

/**
 * Generate the account list section
 */
function generateAccountListSection(
  accounts: DisputeAccount[],
  craName: string
): string {
  let section = `Here is the exact information furnishing inaccurate on my ${craName} credit report:\n\n`;

  accounts.forEach((account, index) => {
    const categories = determineInaccurateCategories(account);
    const categoryStr = categories.length > 0
      ? categories.join(", ")
      : "ACCOUNT TYPE, PAYMENT STATUS, DATE OPENED, PAYMENT HISTORY PROFILE";

    section += `${index + 1}. Account Name: ${account.creditorName}, Account Number: ${account.accountNumber}\n`;
    section += `Inaccurate Categories: ${categoryStr}\n\n`;
  });

  return section;
}

/**
 * Generate the "Requested Corrections / Deletions" section
 */
function generateCorrectionsSection(accounts: DisputeAccount[]): string {
  let section = `Requested Corrections / Deletions (If Not Verified as Accurate):\n\n`;

  accounts.forEach((account, index) => {
    // Determine the dispute reason based on issues
    let reason = "Disputing the Accuracy of this account";
    if (account.issues.some(i => i.code.includes("LATE") || i.code.includes("PAYMENT"))) {
      reason = "Accuracy of Report - As a consumer by law the late payment transactions must be updated or removed";
    } else if (account.issues.some(i => i.code.includes("COLLECTION"))) {
      reason = "Disputing validity of this collection - As a consumer by law this account must be validated or deleted immediately";
    } else if (account.issues.some(i => i.code.includes("CHARGEOFF"))) {
      reason = "Disputing the Accuracy of this account - As a consumer by law this account must be updated or deleted immediately";
    } else {
      reason = "Disputing the Accuracy of this account - As a consumer by law this account must be updated or deleted immediately";
    }

    section += `${index + 1}. ${account.creditorName} - ${account.accountNumber} - ${reason}\n\n`;
  });

  return section;
}

/**
 * Generate the personal information disputes section
 */
function generatePersonalInfoSection(
  previousNames: string[],
  previousAddresses: string[],
  hardInquiries: HardInquiry[],
  cra: CRA
): string {
  let section = `Personal Information to Investigate and Correct / Remove:\n\n`;

  // Previous names
  if (previousNames.length > 0) {
    section += `PREVIOUS NAME VARIATIONS TO REMOVE:\n`;
    previousNames.forEach(name => {
      section += `- ${name}\n`;
    });
    section += `These name variations do not accurately represent my identity and should be removed from my credit file.\n\n`;
  }

  // Previous addresses
  if (previousAddresses.length > 0) {
    section += `PREVIOUS ADDRESSES TO REMOVE:\n`;
    previousAddresses.forEach(addr => {
      section += `- ${addr}\n`;
    });
    section += `These addresses are outdated and no longer associated with me. Please remove them from my credit file.\n\n`;
  }

  // Hard inquiries for this CRA
  const craInquiries = hardInquiries.filter(inq => inq.cra === cra);
  if (craInquiries.length > 0) {
    section += `UNAUTHORIZED HARD INQUIRIES TO REMOVE:\n`;
    craInquiries.forEach(inq => {
      section += `- ${inq.creditorName} (${inq.inquiryDate}) - I did not authorize this inquiry\n`;
    });
    section += `These inquiries were made without my permission and should be removed immediately.\n\n`;
  }

  // If no personal info to dispute
  if (previousNames.length === 0 && previousAddresses.length === 0 && craInquiries.length === 0) {
    section = ""; // Don't include section if nothing to dispute
  }

  return section;
}

/**
 * Generate the closing signature block
 */
function generateClosing(clientName: string): string {
  return `Sincerely,

_______________________________
${clientName}`;
}

// =============================================================================
// MAIN GENERATION FUNCTION
// =============================================================================

export interface Round1GenerationInput {
  client: ClientPersonalInfo;
  accounts: DisputeAccount[];
  cra: CRA;
  flow: DisputeFlowType;
  usedContentHashes?: Set<string>;
}

/**
 * Generate a complete Round 1 dispute letter following all AMELIA doctrine rules.
 */
export function generateRound1Letter(
  input: Round1GenerationInput
): GeneratedLetterOutput {
  const { client, accounts, cra, flow, usedContentHashes = new Set() } = input;
  const round = 1;
  const craInfo = CRA_ADDRESSES[cra];

  // DOCTRINE: Calculate backdated letter date
  const { letterDate, isBackdated, backdatedDays } = calculateLetterDate(round);

  // Determine tone (Round 1 = CONCERNED)
  const tone = determineTone(round);

  // Generate all sections
  const header = generateClientHeader(client, cra, letterDate);
  const headline = generateHeadline();
  const damages = generateDamagesParagraph(craInfo.name, usedContentHashes);
  const story = generateStoryParagraph(usedContentHashes, round);
  const facts = generateFactsParagraph(craInfo.name);
  const investigation = generateInvestigationRequest();
  const penalty = generatePenaltyParagraph(round);
  const accountList = generateAccountListSection(accounts, craInfo.name);
  const corrections = generateCorrectionsSection(accounts);
  const personalInfo = generatePersonalInfoSection(
    client.previousNames,
    client.previousAddresses,
    client.hardInquiries,
    cra
  );
  const closing = generateClosing(client.fullName);

  // Assemble the complete letter
  const letterParts = [
    header,
    headline,
    "",
    `Dear ${craInfo.name},`,
    "",
    damages,
    story,
    "",
    facts,
    "",
    investigation,
    "",
    penalty,
    "",
    accountList,
    corrections,
  ];

  // Only include personal info section if there's content
  if (personalInfo) {
    letterParts.push(personalInfo);
  }

  letterParts.push(closing);

  const content = letterParts.join("\n");

  // Hash the content for uniqueness tracking
  const contentHash = hashContent(content);

  return {
    content,
    letterDate,
    isBackdated,
    backdatedDays,
    tone,
    contentHash,
    sectionsIncluded: {
      damages: true,
      story: true,
      facts: true,
      penalty: true,
      accountList: true,
      correctionsSection: true,
      personalInfoSection: personalInfo.length > 0,
    },
    personalInfoDisputed: {
      previousNames: client.previousNames,
      previousAddresses: client.previousAddresses,
      hardInquiries: client.hardInquiries.filter(inq => inq.cra === cra),
    },
  };
}

/**
 * Validate that a letter meets all doctrine requirements
 */
export function validateLetterDoctrine(
  letter: GeneratedLetterOutput,
  round: number
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  // Round 1 MUST be backdated 60-69 days
  if (round === 1 && !letter.isBackdated) {
    violations.push("Round 1 letter must be backdated 60-69 days");
  }

  // Round 1 MUST be backdated within 60-69 day range
  if (round === 1 && (letter.backdatedDays < 60 || letter.backdatedDays > 69)) {
    violations.push(`Round 1 backdating must be 60-69 days, got ${letter.backdatedDays}`);
  }

  // Round 2+ MUST be backdated 30-39 days
  if (round >= 2 && !letter.isBackdated) {
    violations.push("Round 2+ letter must be backdated 30-39 days");
  }

  if (round >= 2 && (letter.backdatedDays < 30 || letter.backdatedDays > 39)) {
    violations.push(`Round 2+ backdating must be 30-39 days, got ${letter.backdatedDays}`);
  }

  // Must include all required sections
  if (!letter.sectionsIncluded.damages) {
    violations.push("Missing DAMAGES section");
  }
  if (!letter.sectionsIncluded.story) {
    violations.push("Missing STORY section");
  }
  if (!letter.sectionsIncluded.facts) {
    violations.push("Missing FACTS section");
  }
  if (!letter.sectionsIncluded.penalty) {
    violations.push("Missing PENALTY section");
  }
  if (!letter.sectionsIncluded.correctionsSection) {
    violations.push("Missing Corrections/Deletions section");
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

export { generateClientHeader, generateAccountListSection, generateCorrectionsSection };
