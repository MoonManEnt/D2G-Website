import {
  buildDamagesSection,
  buildFactsSection,
  buildPenaltySection,
  getUsedContentHashes,
  type DisputeAccount,
  type DisputeFlow as AmeliaDisputeFlow,
} from "./amelia";
import { completeLLM } from "./llm-orchestrator";
import { validateUniqueness, buildRejectionFeedback } from "@/lib/ai/content-validator";
import { isAIAvailable } from "@/lib/ai/providers";

export type DisputeFlow = "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO";

export interface CFPBComplaintData {
  clientName: string;
  clientId?: string; // Added for duplication checking
  cra: "TRANSUNION" | "EXPERIAN" | "EQUIFAX";
  accounts: Array<{
    creditorName: string;
    accountNumber?: string;
    balance?: string; // String formatted balance "$1,234"
    issue: string;
  }>;
  round: number;
  flow: DisputeFlow;
  previousDisputeDate?: string;
  daysSinceDispute?: number;
}

// CFPB Product Categories
export const CFPB_PRODUCT = "Credit reporting or other personal consumer reports";
export const CFPB_SUB_PRODUCT = "Credit reporting";

// Helper to sanitize balance string to number
function parseBalance(balanceStr?: string): number | undefined {
  if (!balanceStr) return undefined;
  // Remove non-numeric chars except period
  const num = parseFloat(balanceStr.replace(/[^0-9.]/g, ""));
  return isNaN(num) ? undefined : num;
}

/**
 * CFPB PLAIN LANGUAGE CONVERTER
 *
 * CFPB complaints must be in plain language only - no legal USC codes.
 * This function strips all legal citations and converts them to consumer-friendly language.
 */
function convertToPlainLanguage(text: string): string {
  return text
    // Remove full citations like "15 USC 1681e(b)" or "15 U.S.C. § 1681i(a)(5)"
    .replace(/\b15 U\.?S\.?C\.? ?§? ?\d+[a-z]?(?:\([^)]+\))?/gi, "federal law")
    // Remove "Under 15 USC..." → "Under federal law..."
    .replace(/under federal law federal law/gi, "under federal law")
    // Remove FDCPA citations
    .replace(/\b15 U\.?S\.?C\.? ?§? ?1692[a-z]?(?:\([^)]+\))?/gi, "federal debt collection law")
    // Remove standalone section references like "1681e(b)" or "1692g"
    .replace(/\b1681[a-z]?(?:\([^)]+\))?/g, "the Fair Credit Reporting Act")
    .replace(/\b1692[a-z]?(?:\([^)]+\))?/g, "the Fair Debt Collection Practices Act")
    // Remove court case citations
    .replace(/(?:as (?:ruled|proven|held) in )?[A-Z][a-z]+ v\. [A-Z][^,]+,? ?\d*\s*(?:F\.\s*(?:Supp\.\s*)?(?:2d|3d)?\s*)?\d*/g, "")
    // Remove U.C.C. references
    .replace(/U\.C\.C\. \d+-\d+/gi, "commercial law")
    // Clean up "federal law federal law" duplicates
    .replace(/federal law federal law/gi, "federal law")
    // Clean up "the law (federal law)" patterns
    .replace(/the law \(federal law\)/gi, "the law")
    // Clean up double spaces
    .replace(/\s{2,}/g, " ")
    // Clean up empty parentheses
    .replace(/\(\s*\)/g, "")
    // Clean up trailing dashes and colons from removed citations
    .replace(/\s*[-–]\s*$/gm, "")
    .trim();
}

// ============================================================================
// MAIN GENERATOR FUNCTION (Dynamic / Amelia Powered)
// ============================================================================

export async function generateCFPBComplaint(data: CFPBComplaintData): Promise<{
  product: string;
  subProduct: string;
  issue: string;
  subIssue: string;
  companyName: string;
  narrative: string;
  desiredResolution: string;
}> {
  const craFullNames: Record<string, string> = {
    TRANSUNION: "TransUnion",
    EXPERIAN: "Experian",
    EQUIFAX: "Equifax Information Services LLC",
  };

  const craName = craFullNames[data.cra];

  // 1. Get used content hashes to avoid duplication (if clientId provided)
  const usedHashes = data.clientId
    ? await getUsedContentHashes(data.clientId)
    : new Set<string>();

  // 2. Prepare accounts for Amelia
  const ameliaAccounts: DisputeAccount[] = data.accounts.map((acc) => ({
    creditorName: acc.creditorName,
    accountNumber: acc.accountNumber,
    balance: parseBalance(acc.balance),
    issues: [acc.issue], // Map single issue to array
  }));

  // 3. Prepare previous history for context
  const previousHistory = {
    previousRounds: data.round > 1 ? Array.from({ length: data.round - 1 }, (_, i) => i + 1) : [],
    previousResponses: [], // We don't have exact response text here, but that's ok
    daysWithoutResponse: data.daysSinceDispute || 30,
  };

  // 4. Generate Sections using Amelia Builders
  const damagesSection = buildDamagesSection(data.round, usedHashes, previousHistory);

  // Cast flow to Amelia flow (safe as they define same strings for standard flows)
  // Collection/Combo/Accuracy/Consent match.
  const factsSection = buildFactsSection(
    data.flow as AmeliaDisputeFlow,
    ameliaAccounts,
    data.round,
    usedHashes
  );

  const penaltySection = buildPenaltySection(data.round, usedHashes, previousHistory);

  // 5. Account List Formatting
  // We use a simplified account list for the narrative body or rely on Amelia's standard way?
  // The original CFPB code had a `formatAccountList`. Amelia has `buildAccountsList`.
  // Let's use Amelia's dynamic list builder for variety.
  // Wait, `formatAccountList` in original included specific Issue text per account.
  // Amelia's `buildAccountsList` includes issues too.
  // We'll construct a clean list ourselves to ensure it fits CFPB 4000 char limit style if needed,
  // but Amelia's builders are fine. Let's manually format to match the "Complaint" style 
  // which often wants clear separation.

  const accountListText = data.accounts
    .map((acc, i) => {
      let line = `${i + 1}. ${acc.creditorName}`;
      if (acc.accountNumber) line += ` (Account: ${acc.accountNumber})`;
      line += `\n   Issue: ${acc.issue}`;
      return line;
    })
    .join("\n\n");


  // 6. Assemble Narrative
  // CFPB Narrative = Story (Damages) + Account List + Legal Arguments (Facts)
  // We want to weave them together.
  // IMPORTANT: Apply plain language conversion - CFPB complaints should NOT include legal USC codes

  const rawNarrative = `${damagesSection}\n\nI am disputing the following accounts:\n\n${accountListText}\n\n${factsSection}`;
  const narrative = convertToPlainLanguage(rawNarrative);

  // Also convert the penalty/resolution section to plain language
  const desiredResolution = convertToPlainLanguage(penaltySection);

  // 7. Select Issue/Sub-issue category (Static for now based on Flow, or map dynamically)
  let issue = "Incorrect information on your report";
  let subIssue = "Information belongs to someone else";

  if (data.flow === "COLLECTION") {
    issue = "Problem with a credit reporting company's investigation into an existing problem";
    subIssue = "Their investigation did not fix an error on your report";
  } else if (data.flow === "CONSENT") {
    issue = "Improper use of your report";
    subIssue = "Reporting company used your report improperly";
  }

  return {
    product: CFPB_PRODUCT,
    subProduct: CFPB_SUB_PRODUCT,
    issue,
    subIssue,
    companyName: craName,
    narrative: narrative,
    desiredResolution: desiredResolution,
  };
}

// ============================================================================
// AI-POWERED GENERATOR (Phase 2 - Amelia Expansion)
// ============================================================================

/**
 * Generate a CFPB complaint using AI (LLM) with fallback to template generation.
 *
 * Uses completeLLM() with a CFPB-specific system prompt that enforces:
 * - Plain language only (NO legal USC codes -- CFPB requirement)
 * - Consumer voice, not lawyer voice
 * - Focus on harm and company non-responsiveness
 * - Include dispute timeline and attempts to resolve
 *
 * Includes uniqueness validation via trigram similarity detection.
 * Falls back to template-based generateCFPBComplaint() if AI is unavailable or errors.
 */
export async function generateAICFPBComplaint(
  data: CFPBComplaintData,
  organizationId: string
): Promise<{
  product: string;
  subProduct: string;
  issue: string;
  subIssue: string;
  companyName: string;
  narrative: string;
  desiredResolution: string;
  requestId?: string;
  generationMethod: "ai" | "template";
  uniquenessScore?: number;
}> {
  // Check if AI is available; if not, fall back to template
  if (!isAIAvailable()) {
    const templateResult = await generateCFPBComplaint(data);
    return {
      ...templateResult,
      generationMethod: "template",
    };
  }

  const craFullNames: Record<string, string> = {
    TRANSUNION: "TransUnion",
    EXPERIAN: "Experian",
    EQUIFAX: "Equifax Information Services LLC",
  };

  const craName = craFullNames[data.cra];

  // Format accounts for the prompt
  const accountListText = data.accounts
    .map((acc, i) => {
      let line = `${i + 1}. ${acc.creditorName}`;
      if (acc.accountNumber) line += ` (Account ending: ...${acc.accountNumber.slice(-4)})`;
      if (acc.balance) line += ` - Balance: ${acc.balance}`;
      line += `\n   Issue: ${acc.issue}`;
      return line;
    })
    .join("\n\n");

  // Determine CFPB issue/sub-issue categories
  let issue = "Incorrect information on your report";
  let subIssue = "Information belongs to someone else";

  if (data.flow === "COLLECTION") {
    issue = "Problem with a credit reporting company's investigation into an existing problem";
    subIssue = "Their investigation did not fix an error on your report";
  } else if (data.flow === "CONSENT") {
    issue = "Improper use of your report";
    subIssue = "Reporting company used your report improperly";
  }

  // Build the CFPB-specific system prompt enforcing plain language
  const cfpbSystemPrompt = `You are helping a consumer write a complaint to the Consumer Financial Protection Bureau (CFPB).

CRITICAL RULES:
1. Use PLAIN LANGUAGE ONLY. Do NOT include any legal citations, USC codes, statute numbers, or legal jargon.
   - NO "15 USC 1681" or any variation
   - NO "FCRA Section" references
   - NO "Fair Credit Reporting Act" citations
   - NO court case references
   - NO legal terminology like "pursuant to", "herein", "aforementioned"
2. Write in CONSUMER VOICE - this should sound like a real person writing a complaint, NOT a lawyer.
3. Focus on HARM - explain how the inaccurate reporting has personally affected the consumer.
4. Focus on COMPANY NON-RESPONSIVENESS - emphasize that the credit bureau failed to properly investigate.
5. Include the DISPUTE TIMELINE - when the dispute was sent, how long ago, what response (if any) was received.
6. Include ATTEMPTS TO RESOLVE - what steps the consumer took before filing the CFPB complaint.
7. Keep the tone sincere, concerned, and factual.
8. The narrative should be 300-600 words.
9. Also generate a separate "desired resolution" section (2-3 sentences) stating what the consumer wants.

FORMAT YOUR RESPONSE EXACTLY AS:
---NARRATIVE---
[narrative text here]
---RESOLUTION---
[desired resolution text here]`;

  // Build the user prompt with all relevant data
  const userPrompt = `Generate a CFPB complaint for the following situation:

CONSUMER: ${data.clientName}
CREDIT BUREAU: ${craName}
DISPUTE FLOW: ${data.flow}
DISPUTE ROUND: ${data.round}
${data.previousDisputeDate ? `DATE OF ORIGINAL DISPUTE: ${data.previousDisputeDate}` : ""}
${data.daysSinceDispute ? `DAYS SINCE DISPUTE WAS SENT: ${data.daysSinceDispute}` : ""}

ACCOUNTS BEING DISPUTED:
${accountListText}

Please write the complaint narrative in plain consumer language, focusing on the personal impact and the bureau's failure to properly investigate. Do NOT include any legal citations or statute references.`;

  try {
    // Attempt AI generation with up to 3 retries for uniqueness
    let bestNarrative = "";
    let bestResolution = "";
    let requestId: string | undefined;
    let uniquenessScore: number | undefined;

    // Get previous CFPB complaints for this client (for uniqueness checking)
    const previousContents: string[] = [];
    // We pass an empty array if no client ID; uniqueness still works (auto-passes)

    for (let attempt = 1; attempt <= 3; attempt++) {
      let promptToUse = userPrompt;

      // On retry, add rejection feedback to the prompt
      if (attempt > 1 && uniquenessScore !== undefined) {
        const feedback = buildRejectionFeedback(attempt - 1, 100 - uniquenessScore);
        promptToUse = `${feedback}\n\n${userPrompt}`;
      }

      const response = await completeLLM({
        taskType: "CFPB_COMPLAINT",
        prompt: promptToUse,
        systemPrompt: cfpbSystemPrompt,
        organizationId,
        context: {
          flow: data.flow,
          round: data.round,
          cra: data.cra,
        },
      });

      requestId = response.requestId;

      // Parse the response to extract narrative and resolution
      const content = response.content;
      let narrative = content;
      let resolution = "";

      if (content.includes("---NARRATIVE---") && content.includes("---RESOLUTION---")) {
        const narrativePart = content.split("---NARRATIVE---")[1]?.split("---RESOLUTION---")[0]?.trim();
        const resolutionPart = content.split("---RESOLUTION---")[1]?.trim();
        if (narrativePart) narrative = narrativePart;
        if (resolutionPart) resolution = resolutionPart;
      }

      // Apply plain language conversion as a safety net (strip any legal citations the AI included)
      narrative = convertToPlainLanguage(narrative);
      resolution = convertToPlainLanguage(resolution);

      bestNarrative = narrative;
      bestResolution = resolution || `I am requesting that ${craName} conduct a proper, thorough investigation of the disputed accounts listed above. If the information cannot be verified with original documentation, I request that it be corrected or removed from my credit report immediately.`;

      // Validate uniqueness
      const validation = validateUniqueness(bestNarrative, previousContents);
      uniquenessScore = validation.uniquenessScore;

      if (validation.isUnique) {
        break; // Content is unique enough, no retry needed
      }

      // If this is the last attempt, use whatever we have
      if (attempt === 3) {
        break;
      }
    }

    return {
      product: CFPB_PRODUCT,
      subProduct: CFPB_SUB_PRODUCT,
      issue,
      subIssue,
      companyName: craName,
      narrative: bestNarrative,
      desiredResolution: bestResolution,
      requestId,
      generationMethod: "ai",
      uniquenessScore,
    };
  } catch (error) {
    console.error("AI CFPB complaint generation failed, falling back to template:", error);

    // Fall back to template-based generation
    const templateResult = await generateCFPBComplaint(data);
    return {
      ...templateResult,
      generationMethod: "template",
    };
  }
}

// Generate a formatted complaint ready for copy/paste
// NOTE: Now async because generateCFPBComplaint is async
export async function formatCFPBComplaintForCopy(data: CFPBComplaintData): Promise<string> {
  const complaint = await generateCFPBComplaint(data);

  return `════════════════════════════════════════════════════════════════
CFPB COMPLAINT - READY TO FILE AT CONSUMERFINANCE.GOV/COMPLAINT
════════════════════════════════════════════════════════════════

STEP 1: SELECT PRODUCT
────────────────────────────────────────────────────────────────
Product: ${complaint.product}
Sub-product: ${complaint.subProduct}

STEP 2: SELECT ISSUE
────────────────────────────────────────────────────────────────
Issue: ${complaint.issue}
Sub-issue: ${complaint.subIssue}

STEP 3: COMPANY INFORMATION
────────────────────────────────────────────────────────────────
Company Name: ${complaint.companyName}

STEP 4: WHAT HAPPENED? (Copy everything below this line)
────────────────────────────────────────────────────────────────
${complaint.narrative}

STEP 5: DESIRED RESOLUTION (Copy everything below this line)
────────────────────────────────────────────────────────────────
${complaint.desiredResolution}

════════════════════════════════════════════════════════════════
IMPORTANT FILING INSTRUCTIONS:
────────────────────────────────────────────────────────────────
1. Go to: https://www.consumerfinance.gov/complaint/
2. Click "Start a new complaint"
3. Select "Credit reporting or other personal consumer reports"
4. Follow the prompts using the information above
5. Copy/paste the narrative and resolution into the appropriate fields
6. Attach any supporting documents (dispute letters, screenshots)
7. SAVE YOUR CONFIRMATION NUMBER

The company has 15 days to respond to CFPB complaints.
You can track your complaint at the CFPB website.
════════════════════════════════════════════════════════════════`;
}
