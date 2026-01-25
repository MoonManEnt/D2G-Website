import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import * as fs from "fs";
import * as path from "path";

// CRA addresses for letters
const CRA_ADDRESSES: Record<string, string> = {
  TRANSUNION: `TransUnion Consumer Solutions
P.O. Box 2000
Chester, PA 19016`,
  EXPERIAN: `Experian
P.O. Box 4500
Allen, TX 75013`,
  EQUIFAX: `Equifax Information Services LLC
P.O. Box 740256
Atlanta, GA 30374`,
};

const CRA_NAMES: Record<string, string> = {
  TRANSUNION: "TransUnion",
  EXPERIAN: "Experian",
  EQUIFAX: "Equifax",
};

// Template file mappings for each flow
const ACCURACY_TEMPLATES: Record<number, string> = {
  1: "R1 Factual Dispute.docx",
  2: "R2 15 USC 1681e(b).docx",
  3: "R3 15 USC 1681i(a)(5) (2).docx",
  4: "R4 15 USC 1681I(a)(1)(a) (1).docx",
  5: "R5 15 USC 1681i(a)(7) (1).docx",
  6: "R6 15 USC 1681i(a)(6)(B) (1).docx",
  7: "R7 15 USC 1681i(c) (all accounts) (1).docx",
  8: "R8 15 USC 1681s-2(B).docx",
  9: "R9 15 USC 1681s-2(b).docx",
  10: "R10 15 USC 1681c(e).docx",
  11: "R11 Reporting a balance on a discharged debt 1681e(b).docx",
};

const COLLECTION_TEMPLATES: Record<number, string> = {
  1: "R1 (1).docx",
  2: "R2 (3).docx",
  3: "R3 (1).docx",
  4: "R4 (2).docx",
  // R5-7 use Accuracy Flow templates
  8: "R8 (2).docx",
  9: "R9.docx",
  10: "R10.docx",
  11: "R11.docx",
  12: "R12.docx",
};

const CONSENT_TEMPLATES: Record<number, string> = {
  1: "R1 15 USC 1681b(a)(2).docx",
  2: "R2 15 USC 1681a(4).docx",
  3: "R3 15 USC 1681a(d)(a)(2)(B).docx",
};

const COMBO_TEMPLATES: Record<number, string> = {
  1: "R1.docx",
  2: "R2.docx",
  3: "R3.docx",
  4: "R4.docx",
  // R5-7 use Accuracy Flow templates
  8: "R8.docx",
  10: "R10.docx",
  11: "R11.docx",
  12: "R12 Consent collection combo.docx",
};

export type DisputeFlow = "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO";

export interface DisputeAccountForLetter {
  creditorName: string;
  accountNumber: string;
  accountType?: string;
  balance?: string;
  reason: string;
  issues?: Array<{
    code: string;
    description: string;
  }>;
}

export interface LetterData {
  clientFirstName: string;
  clientLastName: string;
  clientAddress: string;
  clientCity: string;
  clientState: string;
  clientZip: string;
  clientSSN4: string;
  clientDOB: string;
  currentDate: string;
  accounts: DisputeAccountForLetter[];
  lastDisputeDate?: string;
  debtCollectorName?: string;
}

function getTemplateFilename(flow: DisputeFlow, round: number): { folder: string; filename: string } {
  // Handle R5-7 crossover for Collection and Combo flows
  if ((flow === "COLLECTION" || flow === "COMBO") && round >= 5 && round <= 7) {
    return {
      folder: "accuracy",
      filename: ACCURACY_TEMPLATES[round] || ACCURACY_TEMPLATES[5],
    };
  }

  switch (flow) {
    case "ACCURACY":
      return {
        folder: "accuracy",
        filename: ACCURACY_TEMPLATES[round] || ACCURACY_TEMPLATES[Math.min(round, 11)],
      };
    case "COLLECTION":
      return {
        folder: "collection",
        filename: COLLECTION_TEMPLATES[round] || COLLECTION_TEMPLATES[Math.min(round, 12)],
      };
    case "CONSENT":
      return {
        folder: "consent",
        filename: CONSENT_TEMPLATES[round] || CONSENT_TEMPLATES[Math.min(round, 3)],
      };
    case "COMBO":
      return {
        folder: "combo",
        filename: COMBO_TEMPLATES[round] || COMBO_TEMPLATES[Math.min(round, 12)],
      };
    default:
      return {
        folder: "accuracy",
        filename: ACCURACY_TEMPLATES[1],
      };
  }
}

function formatDisputeItems(accounts: DisputeAccountForLetter[]): string {
  return accounts
    .map((account, idx) => {
      let itemText = `${idx + 1}. ${account.creditorName}`;
      if (account.accountNumber && account.accountNumber !== "N/A") {
        itemText += ` - Account #: ${account.accountNumber}`;
      }
      if (account.balance) {
        itemText += ` - Balance: ${account.balance}`;
      }
      itemText += `\n   Reason: ${account.reason}`;

      if (account.issues && account.issues.length > 0) {
        itemText += `\n   Issues:`;
        account.issues.forEach((issue) => {
          itemText += `\n   - ${issue.description}`;
        });
      }

      return itemText;
    })
    .join("\n\n");
}

export function generateDisputeDocx(
  cra: "TRANSUNION" | "EXPERIAN" | "EQUIFAX",
  data: LetterData,
  flow: DisputeFlow,
  round: number
): Buffer {
  const { folder, filename } = getTemplateFilename(flow, round);
  const templatePath = path.join(process.cwd(), "templates", folder, filename);

  // Check if template exists
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }

  // Read the template
  const content = fs.readFileSync(templatePath, "binary");
  const zip = new PizZip(content);

  // Create docxtemplater instance
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{", end: "}" },
  });

  // Prepare the data for template replacement
  const fullAddress = `${data.clientAddress}\n${data.clientCity}, ${data.clientState} ${data.clientZip}`;
  const disputeItems = formatDisputeItems(data.accounts);

  const templateData = {
    client_first_name: data.clientFirstName,
    client_last_name: data.clientLastName,
    client_address: fullAddress,
    ss_number: `SSN: XXX-XX-${data.clientSSN4}`,
    bdate: data.clientDOB,
    bureau_address: CRA_ADDRESSES[cra],
    bureau_name: CRA_NAMES[cra],
    curr_date: data.currentDate,
    dispute_item_and_explanation: disputeItems,
    // Additional variables used in some templates
    "INSERT DEBT COLLECTOR NAME": data.debtCollectorName || "[DEBT COLLECTOR]",
    "INSERT DATE OF LAST LETTER": data.lastDisputeDate || "[PREVIOUS DISPUTE DATE]",
    "INSERT DATE OF LAST": data.lastDisputeDate || "[PREVIOUS DISPUTE DATE]",
  };

  // Render the document
  doc.render(templateData);

  // Generate output
  const buf = doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  return buf;
}

// Get available rounds for a flow
export function getAvailableRounds(flow: DisputeFlow): number[] {
  switch (flow) {
    case "ACCURACY":
      return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    case "COLLECTION":
      return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    case "CONSENT":
      return [1, 2, 3];
    case "COMBO":
      return [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12];
    default:
      return [1];
  }
}

// Get round description
export function getRoundDescription(flow: DisputeFlow, round: number): string {
  // Handle R5-7 crossover
  if ((flow === "COLLECTION" || flow === "COMBO") && round >= 5 && round <= 7) {
    return `Round ${round} - Using Accuracy Flow (15 USC 1681i series)`;
  }

  const descriptions: Record<DisputeFlow, Record<number, string>> = {
    ACCURACY: {
      1: "R1 - Factual Dispute (Initial)",
      2: "R2 - 15 USC 1681e(b) Maximum Accuracy",
      3: "R3 - 15 USC 1681i(a)(5) 30-Day Violation",
      4: "R4 - 15 USC 1681i(a)(1)(a) No Reasonable Reinvestigation",
      5: "R5 - 15 USC 1681i(a)(7) Reinvestigation Procedure Request",
      6: "R6 - 15 USC 1681i(a)(6)(B) Method of Verification",
      7: "R7 - 15 USC 1681i(c) All Accounts",
      8: "R8 - 15 USC 1681s-2(B) Furnisher Duties",
      9: "R9 - 15 USC 1681s-2(b) Furnisher Investigation",
      10: "R10 - 15 USC 1681c(e) Re-aging Violation",
      11: "R11 - 15 USC 1681e(b) Discharged Debt",
    },
    COLLECTION: {
      1: "R1 - 15 USC 1692g No Dunning Letter",
      2: "R2 - 15 USC 1692g(b) Unverified Disputed Info",
      3: "R3 - Continued Violations",
      4: "R4 - Final Warning",
      8: "R8 - Escalation",
      9: "R9 - Legal Notice",
      10: "R10 - Pre-Litigation",
      11: "R11 - Intent to Sue",
      12: "R12 - Final Demand",
    },
    CONSENT: {
      1: "R1 - 15 USC 1681b(a)(2) No Permissible Purpose",
      2: "R2 - 15 USC 1681a(4) Definition Challenge",
      3: "R3 - 15 USC 1681a(d)(a)(2)(B) Final Notice",
    },
    COMBO: {
      1: "R1 - Combined Accuracy & Collection Dispute",
      2: "R2 - 15 USC 1681e(b) & 1692g(b) Violations",
      3: "R3 - Continued Combined Violations",
      4: "R4 - Escalation",
      8: "R8 - Pre-Litigation",
      10: "R10 - Final Warning",
      11: "R11 - Intent to Sue",
      12: "R12 - Consent Collection Combo Final",
    },
  };

  return descriptions[flow]?.[round] || `Round ${round}`;
}

// Extract text from DOCX template with variables filled in
export function generateLetterFromTemplate(
  cra: "TRANSUNION" | "EXPERIAN" | "EQUIFAX",
  data: LetterData,
  flow: DisputeFlow,
  round: number
): string {
  const { folder, filename } = getTemplateFilename(flow, round);
  const templatePath = path.join(process.cwd(), "templates", folder, filename);

  // Check if template exists
  if (!fs.existsSync(templatePath)) {
    // Fall back to basic text if template not found
    return generateFallbackLetterText(cra, data, flow, round);
  }

  try {
    // Read the template
    const content = fs.readFileSync(templatePath, "binary");
    const zip = new PizZip(content);

    // Create docxtemplater instance
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: "{", end: "}" },
    });

    // Prepare the data for template replacement
    const fullAddress = `${data.clientAddress}\n${data.clientCity}, ${data.clientState} ${data.clientZip}`;
    const disputeItems = formatDisputeItems(data.accounts);

    const templateData: Record<string, string> = {
      client_first_name: data.clientFirstName,
      client_last_name: data.clientLastName,
      client_address: fullAddress,
      ss_number: `SSN: XXX-XX-${data.clientSSN4}`,
      bdate: data.clientDOB,
      bureau_address: CRA_ADDRESSES[cra],
      bureau_name: CRA_NAMES[cra],
      curr_date: data.currentDate,
      dispute_item_and_explanation: disputeItems,
      "INSERT DEBT COLLECTOR NAME": data.debtCollectorName || "[DEBT COLLECTOR NAME]",
      "INSERT DATE OF LAST LETTER": data.lastDisputeDate || "[PREVIOUS DISPUTE DATE]",
      "INSERT DATE OF LAST": data.lastDisputeDate || "[PREVIOUS DISPUTE DATE]",
    };

    // Render the document
    doc.render(templateData);

    // Extract text from rendered document
    const renderedZip = doc.getZip();
    const documentXml = renderedZip.file("word/document.xml")?.asText();

    if (!documentXml) {
      return generateFallbackLetterText(cra, data, flow, round);
    }

    // Parse XML and extract text content
    const text = extractTextFromDocxXml(documentXml);
    return text;
  } catch (error) {
    console.error("Error extracting template text:", error);
    return generateFallbackLetterText(cra, data, flow, round);
  }
}

// Extract plain text from DOCX XML
function extractTextFromDocxXml(xml: string): string {
  // Remove XML tags and extract text content
  // This is a simplified extraction - gets text between <w:t> tags
  const textMatches = xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
  const paragraphBreaks = xml.match(/<w:p[^>]*>/g) || [];

  let result = "";
  let lastIndex = 0;

  // Find all paragraph and text positions
  const elements: Array<{ type: "p" | "t"; index: number; text?: string }> = [];

  // Find paragraphs
  let pMatch;
  const pRegex = /<w:p[^>]*>/g;
  while ((pMatch = pRegex.exec(xml)) !== null) {
    elements.push({ type: "p", index: pMatch.index });
  }

  // Find text
  let tMatch;
  const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  while ((tMatch = tRegex.exec(xml)) !== null) {
    elements.push({ type: "t", index: tMatch.index, text: tMatch[1] });
  }

  // Sort by index
  elements.sort((a, b) => a.index - b.index);

  // Build result
  let currentParagraph = "";
  for (const el of elements) {
    if (el.type === "p") {
      if (currentParagraph.trim()) {
        result += currentParagraph.trim() + "\n\n";
      }
      currentParagraph = "";
    } else if (el.type === "t" && el.text) {
      currentParagraph += el.text;
    }
  }

  // Add last paragraph
  if (currentParagraph.trim()) {
    result += currentParagraph.trim();
  }

  // Clean up multiple newlines
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}

// Fallback text generation if template extraction fails
function generateFallbackLetterText(
  cra: "TRANSUNION" | "EXPERIAN" | "EQUIFAX",
  data: LetterData,
  flow: DisputeFlow,
  round: number
): string {
  const fullAddress = `${data.clientAddress}\n${data.clientCity}, ${data.clientState} ${data.clientZip}`;
  const disputeItems = formatDisputeItems(data.accounts);
  const roundDesc = getRoundDescription(flow, round);

  return `${data.clientFirstName} ${data.clientLastName}
${fullAddress}
SSN: XXX-XX-${data.clientSSN4}

${data.clientDOB}

${CRA_ADDRESSES[cra]}

${data.currentDate}

${roundDesc}
${"=".repeat(60)}

To Whom It May Concern at ${CRA_NAMES[cra]}:

This letter constitutes a formal dispute under the Fair Credit Reporting Act.

DISPUTED ACCOUNTS:
${disputeItems}

I demand that you investigate these items and either verify their accuracy with documentation or delete them from my credit report within 30 days as required by law.

Sincerely,

${data.clientFirstName} ${data.clientLastName}`;
}

// Legacy function name for backward compatibility
export const generateLetterText = generateLetterFromTemplate;

/**
 * Generate a simple DOCX from raw text content (for AMELIA letters)
 * This creates a basic Word document with proper formatting
 */
export function generateDocxFromContent(
  content: string,
  clientName: string,
  cra: string,
  round: number
): Buffer {
  // Use the blank template for custom content
  const blankTemplatePath = path.join(process.cwd(), "templates", "blank.docx");

  // Check if blank template exists, otherwise create document from scratch
  if (fs.existsSync(blankTemplatePath)) {
    const templateContent = fs.readFileSync(blankTemplatePath, "binary");
    const zip = new PizZip(templateContent);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: "{", end: "}" },
    });

    doc.render({ content });

    return doc.getZip().generate({
      type: "nodebuffer",
      compression: "DEFLATE",
    });
  }

  // If no blank template, create a minimal DOCX structure
  // The docxtemplater library requires a template, so we'll use the base64 of a minimal docx
  const minimalDocxBase64 = "UEsDBBQAAAAIAIRVLFMY/ZxKZgAAAIAAAA0AAABDT05URU5UX1RZUEVTLnhtbF3OywrCMBCF4f2gvEKy8OoLILq3cMoQxxoTMpV4extt6+LS/OdH7lQW75SzJ/2Gh8CQMRRxNNM0cS4aqDIEiMIQRO8TBxFHnEJIw9Dsg0nPT0Y9YAnhDZ5gHCIXb8M2eTu/E+dcXpCX1uTpf4PXBwFQSwMEFAAAAAgAgFUsU6O0EGHGAAAA8wAAABEAAABXT1JEL0RPQ1VNRU5ULlhNTF2QzU7DMBCE70i8g+U7dRxKWymlEhJCgkPlB9Gz5WzSCMcbZR3K9LR0s+JI9g1fbq3MFv2cFk+i4tHX4xFlEq2bQkkBL4R35P0AXS/gtDj1kHGU8ABl5UNVmYGfxLHADY9VBNHDq9xTdFhFjIHf+L9UfYHJQUE/IEq9V4ZMJBVwDjHxTHQR6BwTphPyTdnvNJ19x8uPeLcCdLCcJD6ROGOdBCCHH0nE9cXpAl6OPKJvfhwvVPQDUEsDBBQAAAAIAAAAIQBFq1z0PQAAAEoAAAARAAAAV09SRC9SRUxBVElPTlMuWE1MKw4u0Q+xLEvM0Q/OzMnI0Q0uLcvM0UvOz0nVL0ktLlFwD3F31A9KycxLL0ksSgEAUEsDBBQAAAAIAAAAIQBU8BXz4AAAAP0AAAALAAAAd29yZC9zdHlsZXMueG1spZC9CsIwFIXfBfEB8gAmuAoFnRVxcXMSr22k5IYkFVR8d4NYXNzP9p3DO3cqe/GWw5Na4b0FUaSAkIV33pQ13G/ns83hqMz7vn9rLQxdKBrjPDBkEiDfLhHc5c8wHFaC+qGrBLDf8g8MkYzQj4lEfEgVaopO1xVc6f5gGNWIoNtXfvCxQF4rOKlNBGKlmOdIRRwpMRgYCwrjCgYhFRH7C3CRlYJEJhPhZWB/oT9QSwMEFAAAAAgAAAAhANFNJVDzAAAAjQEAAA8AAABbQ29udGVudF9UeXBlc10ueG1sjZDLTsMwEEXfkfgHy3ucpKqQEEqC2AB7kAfMIhNnRPAL2wT1D3BdYANsmE/6nb0yvPj2PU7+4qONdoIQjyYLpplRCpNJvY3uBYKLGmQHY1OMDQkOxoEQDx6bh/K9WIKLdQIW7q9KqNACNcBMqxSCYxBxmgI5mYONhBcMjLAZ9hliEQ1dIZ0IChIsECCdWRMsUFDzKOuOCLI3h0a3Qk8Z1VdIaYxHBQsVT1xJJBBB3wETPCPjSAF9hvL8F1BLAQIUABQAAAAIAIRVLFMY/ZxKZgAAAIAAAAANAAAAAAAAAAAAAAAAAAAAAABDT05URU5UX1RZUEVTLnhtbFBLAQIUABQAAAAIAIBVLFOjtBBhxgAAAPMAAAARAAAAAAAAAAAAAAAApAAAAFdPUkQvRE9DVU1FTlQuWE1MUEsBAhQAFAAAAAgAAAAhAEWrXPQ9AAAASgAAABEAAAAAAAAAAAAAAAAAlwEAAFdPUkQvUkVMQVRJT05TLlhNTFBLAQIUABQAAAAIAAAAIQBU8BXz4AAAAP0AAAALAAAAAAAAAAAAAAAAAPEBAABbQ29udGVudF9UeXBlc10ueG1sUEsBAhQAFAAAAAgAAAAhANFNJVDzAAAAjQEAAA8AAAAAAAAAAAAAAAD+AgAAd29yZC9zdHlsZXMueG1sUEsFBgAAAAAFAAUAGQEAACQEAAAAAAAA";

  // For now, fall back to just returning text as buffer
  // In production, you'd want a proper blank.docx template
  console.warn("No blank.docx template found, DOCX generation may be limited");
  return Buffer.from(content, "utf-8");
}
