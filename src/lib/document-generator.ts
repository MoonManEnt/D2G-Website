/**
 * Dispute2Go Document Generation Engine
 * 
 * Generates CRA dispute letters and CFPB complaint drafts.
 * 
 * Key features:
 * - CRA Letters: Include statutes per round
 * - CFPB Drafts: Statute-free, narrative structure (Intro/When/How/Why/What)
 * - Structured formatting with evidence appendix support
 */

import {
  DocumentType,
  CRA,
  FlowType,
  GeneratedLetter,
  LetterSection,
  CFPBDraftStructure,
  ACCURACY_FLOW_ROUNDS,
  COLLECTION_FLOW_ROUNDS,
  CONSENT_FLOW_ROUNDS,
  RoundDefinition,
} from "@/types";
import { formatDate, CRA_INFO } from "./utils";
import prisma from "./prisma";
import { createLogger } from "./logger";
const log = createLogger("document-generator");

// ============================================================================
// TYPES
// ============================================================================

interface ClientInfo {
  firstName: string;
  lastName: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  ssnLast4?: string;
  dateOfBirth?: Date;
}

interface AccountForLetter {
  creditorName: string;
  maskedAccountId: string;
  accountType?: string;
  balance?: number;
  pastDue?: number;
  disputeReason?: string;
}

interface EvidenceAnnotation {
  type: "rectangle" | "circle" | "arrow" | "text" | "highlight" | "redact";
  text?: string;
  color: string;
}

interface EvidenceItem {
  id: string;
  title?: string;
  description?: string;
  /** Parsed annotations for this evidence */
  annotations?: EvidenceAnnotation[];
  /** Page number from the source document */
  sourcePageNum?: number;
}

interface GenerationContext {
  client: ClientInfo;
  accounts: AccountForLetter[];
  cra: CRA;
  flow: FlowType;
  round: number;
  evidence?: EvidenceItem[];
  customDamages?: string;
  customFacts?: string;
  customStatement?: string;
}

// ============================================================================
// CRA ADDRESSES
// ============================================================================

const CRA_ADDRESSES: Record<CRA, { name: string; address: string[] }> = {
  [CRA.EXPERIAN]: {
    name: "Experian",
    address: [
      "Experian",
      "P.O. Box 4500",
      "Allen, TX 75013",
    ],
  },
  [CRA.EQUIFAX]: {
    name: "Equifax",
    address: [
      "Equifax Information Services LLC",
      "P.O. Box 740256",
      "Atlanta, GA 30374",
    ],
  },
  [CRA.TRANSUNION]: {
    name: "TransUnion",
    address: [
      "TransUnion LLC",
      "Consumer Dispute Center",
      "P.O. Box 2000",
      "Chester, PA 19016",
    ],
  },
};

// ============================================================================
// STATUTE TEXT DATABASE (Recommendation #3)
// ============================================================================

const STATUTE_TEXT: Record<string, { title: string; argument: string }> = {
  "1681e(b)": {
    title: "Maximum Possible Accuracy",
    argument: "Under 15 U.S.C. § 1681e(b), consumer reporting agencies must follow reasonable procedures to assure maximum possible accuracy of the information concerning the individual about whom the report relates. The inaccurate information being reported fails to meet this standard.",
  },
  "1681i(a)(5)": {
    title: "Reinvestigation Results",
    argument: "Under 15 U.S.C. § 1681i(a)(5), you are required to provide written results of any reinvestigation within five business days of completion. I have not received adequate results of reinvestigation.",
  },
  "1681i(a)(1)(A)": {
    title: "Reinvestigation Requirement",
    argument: "Under 15 U.S.C. § 1681i(a)(1)(A), upon receiving a consumer dispute, you must conduct a reasonable reinvestigation to determine whether the disputed information is inaccurate and record the current status of the disputed information, or delete the item from the file.",
  },
  "1681i(a)(7)": {
    title: "Description of Process",
    argument: "Under 15 U.S.C. § 1681i(a)(7), you are required to provide a description of the procedure used to determine the accuracy and completeness of the information, including the business name, address, and telephone number of any furnisher contacted.",
  },
  "1681i(a)(6)(B)(iii)": {
    title: "Method of Verification",
    argument: "Under 15 U.S.C. § 1681i(a)(6)(B)(iii), upon request, you must provide the method of verification within 15 days of my request.",
  },
  "1681i(c)": {
    title: "Information Provider Notice",
    argument: "Under 15 U.S.C. § 1681i(c), within five business days of receiving notice of a dispute, you must provide notification of the dispute to any person who provided any item of information in dispute.",
  },
  "1681s-2(b)": {
    title: "Furnisher Duties Upon Dispute",
    argument: "Under 15 U.S.C. § 1681s-2(b), upon receiving notice of a dispute from a consumer reporting agency, the furnisher of information must conduct an investigation, review all relevant information, and report the results to the consumer reporting agency.",
  },
  "1681(b)": {
    title: "Permissible Purposes",
    argument: "Under 15 U.S.C. § 1681(b), consumer reports may only be furnished for permissible purposes. The continued reporting of this information without proper permissible purpose is a violation.",
  },
  "1681c(e)": {
    title: "Information Update and Deletion",
    argument: "Under 15 U.S.C. § 1681c(e), information found to be inaccurate or that cannot be verified must be promptly updated or deleted from the consumer's file.",
  },
  "1692g": {
    title: "Validation of Debts",
    argument: "Under 15 U.S.C. § 1692g, within five days after the initial communication with a consumer in connection with the collection of any debt, a debt collector must send the consumer a written notice containing the amount of the debt, name of the creditor, and validation rights.",
  },
  "1692g(b)": {
    title: "Debt Validation Request",
    argument: "Under 15 U.S.C. § 1692g(b), collection of the debt must cease until verification is provided to the consumer.",
  },
  "1692j": {
    title: "Unfair Practices",
    argument: "Under 15 U.S.C. § 1692j, it is unlawful to design, compile, and furnish any form knowing that such form would be used to create the false belief that a person other than the creditor is participating in the collection of or in an attempt to collect a debt.",
  },
  "1692e(10)": {
    title: "False Representation",
    argument: "Under 15 U.S.C. § 1692e(10), the use of any false representation or deceptive means to collect or attempt to collect any debt is prohibited.",
  },
  "1692c(c)": {
    title: "Cease Communication",
    argument: "Under 15 U.S.C. § 1692c(c), if a consumer notifies a debt collector in writing that the consumer refuses to pay a debt or wishes the debt collector to cease further communication, the debt collector shall cease communication.",
  },
  "1681b(a)(2)": {
    title: "Written Consent Requirement",
    argument: "Under 15 U.S.C. § 1681b(a)(2), any person may obtain a consumer report only with the written instructions of the consumer to whom it relates.",
  },
  "1681q": {
    title: "False Pretenses",
    argument: "Under 15 U.S.C. § 1681q, any person who knowingly and willfully obtains information on a consumer from a consumer reporting agency under false pretenses shall be fined or imprisoned.",
  },
  "FACTUAL": {
    title: "Factual Inaccuracy",
    argument: "The information being reported is factually inaccurate. I am disputing this information on the basis of verifiable factual errors that can be demonstrated through documentation.",
  },
};

// ============================================================================
// CONTENT RESOLUTION HELPERS
// ============================================================================

async function resolveStatute(flow: FlowType, round: number, statuteCode: string) {
  try {
    const statute = await prisma.statuteContent.findFirst({
      where: {
        flow,
        round,
        statuteCode,
      },
    });
    return statute?.argumentText || STATUTE_TEXT[statuteCode]?.argument;
  } catch (error) {
    log.error({ err: error }, "Error resolving statute from DB, falling back");
    return STATUTE_TEXT[statuteCode]?.argument;
  }
}

async function resolveTemplate(flow: FlowType, round: number) {
  try {
    const template = await prisma.letterTemplate.findFirst({
      where: {
        flow,
        round,
      },
      orderBy: { createdAt: "desc" },
    });
    return template;
  } catch (error) {
    log.error({ err: error }, "Error resolving template from DB, falling back");
    return null;
  }
}

// ============================================================================
// CRA LETTER GENERATION
// ============================================================================

export async function generateCRALetter(context: GenerationContext): Promise<GeneratedLetter> {
  const { client, accounts, cra, flow, round, evidence, customDamages, customFacts, customStatement } = context;

  const roundDef = getRoundDefinition(flow, round);
  const statutesCited = roundDef ? [roundDef.statuteCode] : [];
  const sections: LetterSection[] = [];

  // Try to find a specialized template
  const dbTemplate = await resolveTemplate(flow, round);

  // Header
  sections.push({
    type: "HEADER",
    content: generateHeader(client, cra),
  });

  // Headline
  sections.push({
    type: "HEADLINE",
    content: generateHeadline(flow, round, cra),
  });

  // Damages section
  sections.push({
    type: "DAMAGES",
    content: customDamages || generateDamagesSection(),
  });

  // Facts section
  const resolvedStatute = roundDef ? await resolveStatute(flow, round, roundDef.statuteCode) : null;
  sections.push({
    type: "FACTS",
    content: customFacts || generateFactsSection(flow, round, resolvedStatute),
  });

  // Item list
  sections.push({
    type: "ITEMS",
    content: generateItemList(accounts),
  });

  // Consumer statement
  sections.push({
    type: "STATEMENT",
    content: customStatement || generateConsumerStatement(flow, round, roundDef),
  });

  // Evidence appendix (if present)
  if (evidence && evidence.length > 0) {
    sections.push({
      type: "EVIDENCE",
      content: generateEvidenceAppendix(evidence),
    });
  }

  // Footer
  sections.push({
    type: "FOOTER",
    content: generateFooter(client),
  });

  // Combine into full content
  const fullContent = sections.map(s => s.content).join("\n\n");

  return {
    documentType: DocumentType.CRA_LETTER,
    cra,
    flow,
    round,
    sections,
    statutesCited,
    fullContent,
  };
}

function generateHeader(client: ClientInfo, cra: CRA): string {
  const today = formatDate(new Date());
  const craInfo = CRA_ADDRESSES[cra];

  let header = `${today}\n\n`;
  header += `${client.firstName} ${client.lastName}\n`;

  if (client.addressLine1) {
    header += `${client.addressLine1}\n`;
    if (client.addressLine2) header += `${client.addressLine2}\n`;
    if (client.city && client.state && client.zipCode) {
      header += `${client.city}, ${client.state} ${client.zipCode}\n`;
    }
  }

  header += `\nSSN: XXX-XX-${client.ssnLast4 || "XXXX"}\n`;
  if (client.dateOfBirth) {
    header += `DOB: ${formatDate(client.dateOfBirth)}\n`;
  }

  header += `\n${craInfo.address.join("\n")}\n`;
  header += `\nRe: Formal Dispute and Request for Investigation\n`;

  return header;
}

function generateHeadline(flow: FlowType, round: number, cra: CRA): string {
  const craName = CRA_INFO[cra].name;
  return `NOTICE OF DISPUTE – ${flow} FLOW ROUND ${round}\n${craName.toUpperCase()} CREDIT REPORT`;
}

function generateDamagesSection(): string {
  return `As a result of the inaccurate information being reported on my credit file, I have suffered the following damages:

• Denial or adverse terms on credit applications
• Increased interest rates and fees
• Emotional distress and anxiety
• Loss of time spent disputing inaccurate information
• Damage to my reputation and creditworthiness

I reserve all rights to pursue statutory and actual damages under applicable law.`;
}

function generateFactsSection(flow: FlowType, round: number, resolvedStatute?: string | null): string {
  const roundDef = getRoundDefinition(flow, round);

  let facts = `I am writing to formally dispute inaccurate information appearing on my credit report. `;
  facts += `This dispute is being submitted pursuant to my rights under the Fair Credit Reporting Act (FCRA).\n\n`;

  if (resolvedStatute) {
    facts += `${resolvedStatute}\n\n`;
  } else if (roundDef && STATUTE_TEXT[roundDef.statuteCode]) {
    facts += `${STATUTE_TEXT[roundDef.statuteCode].argument}\n\n`;
  }

  facts += `I have identified the following account(s) as containing inaccurate information that must be investigated and corrected or deleted:`;

  return facts;
}

function generateItemList(accounts: AccountForLetter[]): string {
  let list = "";

  accounts.forEach((account, index) => {
    list += `\n${index + 1}. CREDITOR: ${account.creditorName}\n`;
    list += `   Account Number: ${account.maskedAccountId}\n`;
    if (account.accountType) list += `   Account Type: ${account.accountType}\n`;
    if (account.balance != null) list += `   Reported Balance: $${account.balance.toLocaleString()}\n`;
    if (account.pastDue != null) list += `   Past Due Amount: $${account.pastDue.toLocaleString()}\n`;
    if (account.disputeReason) {
      list += `   Dispute Reason: ${account.disputeReason}\n`;
    } else {
      list += `   Dispute Reason: Information is inaccurate and cannot be verified\n`;
    }
  });

  return list;
}

function generateConsumerStatement(flow: FlowType, round: number, roundDef: RoundDefinition | null): string {
  let statement = `I hereby demand that you conduct a thorough and reasonable investigation into the disputed items listed above. `;
  statement += `Upon completion of your investigation, please provide me with:\n\n`;
  statement += `1. An updated copy of my credit report reflecting any corrections or deletions\n`;
  statement += `2. Written notice of the results of your investigation\n`;
  statement += `3. The method of verification used for each disputed item\n`;
  statement += `4. Contact information for any furnishers contacted during your investigation\n\n`;

  if (roundDef && !roundDef.isLitigationMarker) {
    statement += `This dispute is submitted under ${roundDef.statuteCode}. `;
    statement += `Please be advised that I am maintaining detailed records of this dispute process for potential use in litigation.\n\n`;
  }

  statement += `You have 30 days from receipt of this letter to complete your investigation and provide the requested information. `;
  statement += `Failure to comply with these requirements may result in legal action.`;

  return statement;
}

function generateEvidenceAppendix(evidence: EvidenceItem[]): string {
  let appendix = `EVIDENCE APPENDIX\n${"=".repeat(50)}\n\n`;
  appendix += `The following evidence is attached in support of this dispute:\n\n`;

  evidence.forEach((item, index) => {
    const exhibitLabel = String.fromCharCode(65 + index);
    appendix += `Exhibit ${exhibitLabel}: `;
    appendix += item.title || `Evidence Item ${index + 1}`;

    if (item.sourcePageNum) {
      appendix += ` (Source: Page ${item.sourcePageNum})`;
    }

    appendix += `\n`;

    if (item.description) {
      appendix += `   Description: ${item.description}\n`;
    }

    // Include annotation details if present
    if (item.annotations && item.annotations.length > 0) {
      appendix += `   Annotations:\n`;

      // Group annotations by type
      const textAnnotations = item.annotations.filter(a => a.type === "text" && a.text);
      const highlightCount = item.annotations.filter(a => a.type === "highlight").length;
      const circleCount = item.annotations.filter(a => a.type === "circle").length;
      const rectangleCount = item.annotations.filter(a => a.type === "rectangle").length;
      const redactCount = item.annotations.filter(a => a.type === "redact").length;

      // List text callouts
      textAnnotations.forEach((ann, i) => {
        appendix += `     - Callout ${i + 1}: "${ann.text}"\n`;
      });

      // Summarize visual annotations
      const visualSummary: string[] = [];
      if (highlightCount > 0) visualSummary.push(`${highlightCount} highlight(s)`);
      if (circleCount > 0) visualSummary.push(`${circleCount} circle(s)`);
      if (rectangleCount > 0) visualSummary.push(`${rectangleCount} box(es)`);
      if (redactCount > 0) visualSummary.push(`${redactCount} redaction(s)`);

      if (visualSummary.length > 0) {
        appendix += `     - Visual markings: ${visualSummary.join(", ")}\n`;
      }

      appendix += `   See attached annotated image for visual reference.\n`;
    }

    appendix += `\n`;
  });

  return appendix;
}

function generateFooter(client: ClientInfo): string {
  return `Respectfully submitted,


_______________________________
${client.firstName} ${client.lastName}
Date: ${formatDate(new Date())}

Enclosures: Copy of identification, supporting evidence (if applicable)`;
}

// ============================================================================
// CFPB DRAFT GENERATION
// ============================================================================

export function generateCFPBDraft(context: GenerationContext): GeneratedLetter {
  const { client, accounts, cra, flow, round } = context;

  // CFPB drafts are statute-free per spec
  const sections: LetterSection[] = [];

  // Generate the CFPB narrative structure
  const cfpbStructure = generateCFPBStructure(client, accounts, cra);

  sections.push({
    type: "HEADER",
    content: `CFPB COMPLAINT DRAFT\nConsumer: ${client.firstName} ${client.lastName}\nAgainst: ${CRA_INFO[cra].name}`,
  });

  // Intro
  sections.push({
    type: "FACTS",
    content: `INTRODUCTION\n${"—".repeat(40)}\n\n${cfpbStructure.intro}`,
  });

  // When
  sections.push({
    type: "FACTS",
    content: `WHEN DID THIS HAPPEN?\n${"—".repeat(40)}\n\n${cfpbStructure.when}`,
  });

  // How
  sections.push({
    type: "FACTS",
    content: `HOW DID THIS AFFECT YOU?\n${"—".repeat(40)}\n\n${cfpbStructure.how}`,
  });

  // Why
  sections.push({
    type: "FACTS",
    content: `WHY IS THIS A PROBLEM?\n${"—".repeat(40)}\n\n${cfpbStructure.why}`,
  });

  // What
  sections.push({
    type: "STATEMENT",
    content: `WHAT DO YOU WANT TO HAPPEN?\n${"—".repeat(40)}\n\n${cfpbStructure.what}`,
  });

  const fullContent = sections.map(s => s.content).join("\n\n");

  return {
    documentType: DocumentType.CFPB_DRAFT,
    cra,
    flow,
    round,
    sections,
    statutesCited: [], // CFPB drafts are statute-free
    fullContent,
  };
}

function generateCFPBStructure(
  client: ClientInfo,
  accounts: AccountForLetter[],
  cra: CRA
): CFPBDraftStructure {
  const craName = CRA_INFO[cra].name;
  const accountList = accounts.map(a => `${a.creditorName} (${a.maskedAccountId})`).join(", ");

  return {
    intro: `I am filing this complaint against ${craName} regarding inaccurate information appearing on my credit report. Despite my previous attempts to resolve this matter directly with ${craName}, the inaccurate information continues to be reported, causing ongoing harm to my creditworthiness and financial standing.\n\nThe following account(s) contain inaccurate information: ${accountList}.`,

    when: `I first discovered the inaccurate information on my credit report and subsequently sent a written dispute to ${craName}. I have disputed this information through proper channels, but ${craName} has failed to adequately investigate my dispute or correct the inaccurate information. The inaccurate reporting has been ongoing.`,

    how: `The inaccurate information on my credit report has caused me significant harm, including:\n\n• Negative impact on my credit score\n• Difficulty obtaining credit at favorable terms\n• Denial of credit applications\n• Emotional distress and anxiety about my financial standing\n• Time and resources spent attempting to correct this information`,

    why: `${craName} has a legal obligation to investigate consumer disputes thoroughly and to ensure the accuracy of the information they report. By failing to properly investigate my dispute and continuing to report inaccurate information, ${craName} has not met its obligations to me as a consumer. The continued reporting of this inaccurate information is unacceptable and has caused me real harm.`,

    what: `I am requesting that the CFPB:\n\n1. Investigate my complaint against ${craName}\n2. Require ${craName} to conduct a proper investigation of my dispute\n3. Require ${craName} to correct or delete the inaccurate information from my credit report\n4. Provide me with documentation of the investigation and its findings\n5. Take appropriate action if ${craName} is found to have violated my rights as a consumer`,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getRoundDefinition(flow: FlowType, round: number): RoundDefinition | null {
  let rounds: RoundDefinition[];

  switch (flow) {
    case FlowType.ACCURACY:
      rounds = ACCURACY_FLOW_ROUNDS;
      break;
    case FlowType.COLLECTION:
      rounds = COLLECTION_FLOW_ROUNDS;
      break;
    case FlowType.CONSENT:
      rounds = CONSENT_FLOW_ROUNDS;
      break;
    case FlowType.COMBO:
      // Combo uses Accuracy rounds first
      rounds = ACCURACY_FLOW_ROUNDS;
      break;
    default:
      return null;
  }

  return rounds.find(r => r.round === round) || null;
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { ClientInfo, AccountForLetter, EvidenceItem, GenerationContext };
export { CRA_ADDRESSES, STATUTE_TEXT, getRoundDefinition };
