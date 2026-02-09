/**
 * SENTRY LETTER GENERATOR - Human First Edition
 *
 * Generates dispute letters using story-first approach.
 * Technical compliance (e-OSCAR, Metro 2) maintained behind the scenes.
 *
 * LETTER STRUCTURE:
 * 1. MY STORY (2-3 sentences) - Generated first, always included
 * 2. WHAT'S WRONG (Simple statement) - Human-readable issue
 * 3. WHAT I NEED (Clear demand) - Straightforward ask
 * 4. LEGAL FOOTER (Brief, at end) - Like fine print
 */

import type {
  SentryCRA,
  SentryFlowType,
  SentryRound,
  SentryAccountItem,
  Metro2FieldDispute,
  EOSCARRecommendation,
  OCRAnalysisResult,
  CitationValidationResult,
  SuccessPrediction,
  SuccessPredictionRequest,
} from "@/types/sentry";

import {
  selectBestTemplate,
  selectHumanFirstTemplate,
  getSentryTemplate,
  TEMPLATE_VARIABLES,
  type SentryTemplate,
  type HumanFirstTemplate,
} from "./sentry-templates";

import { SENTRY_BUREAU_ADDRESSES } from "./index";
import { recommendCodesForAccount, getCodeDescription } from "./eoscar-engine";
import { validateCitations, getRecommendedCitations } from "./legal-validator";
import { analyzeOCRRisk, applyOCRFixes, meetsMinimumSafety } from "./ocr-detector";
import {
  createFieldDispute,
  detectFieldDiscrepancies,
  generateDiscrepancyLanguage,
  getRecommendedFields,
  getVerificationChallenges,
  buildAccountListEntry,
} from "./metro2-targeting";
import { calculateSuccessProbability } from "./success-calculator";
import {
  type WritingMode,
  type StoryContext,
  type GeneratedStory,
  EOSCAR_TO_DISPUTE_TYPE,
} from "./writing-modes";
import {
  generateRequiredStory,
  generateStoriesForAccounts,
  combineStories,
  generateSummaryStory,
} from "./story-generator";
import { createLogger } from "@/lib/logger";

const log = createLogger("sentry-generator");

// =============================================================================
// TYPES
// =============================================================================

export interface GenerationContext {
  // Client info
  clientName: string;
  clientAddress: string;
  clientCityStateZip: string;
  clientSSNLast4: string;
  clientDOB: string;

  // Dispute info
  cra: SentryCRA;
  flow: SentryFlowType;
  round: SentryRound;

  // Accounts to dispute
  accounts: SentryAccountItem[];

  // Optional overrides
  templateId?: string;
  customLanguage?: string;
  eoscarCodeOverride?: string;

  // Previous dispute info (for rounds 2+)
  previousDisputeDate?: string;
  confirmationNumber?: string;

  // Date options
  backdateDays?: number;

  // Writing mode - DEPRECATED, always uses human-first
  writingMode?: WritingMode;

  // Client context for story generation
  clientContext?: StoryContext["clientContext"];

  // Organization ID for LLM calls
  organizationId?: string;
}

export interface GenerationResult {
  // Generated letter
  letterContent: string;
  letterContentPlain: string;

  // Template used
  templateId: string;
  templateName: string;

  // Writing mode (always NORMAL_PEOPLE now)
  writingMode: WritingMode;

  // Generated stories
  impactStories?: GeneratedStory[];
  combinedStory?: string;

  // Intelligence results (hidden from UI but kept for compliance)
  eoscarRecommendations: EOSCARRecommendation[];
  selectedEOSCARCode: string;
  metro2Disputes: Metro2FieldDispute[];
  discrepancies: { field: string; language: string }[];

  // Validation results
  ocrAnalysis: OCRAnalysisResult;
  citationValidation: CitationValidationResult;
  successPrediction: SuccessPrediction;

  // Warnings
  warnings: string[];

  // Was auto-fix applied?
  ocrAutoFixApplied: boolean;
}

// =============================================================================
// DATE FORMATTING
// =============================================================================

function formatDate(date?: Date | string, backdateDays?: number): string {
  let d: Date;

  if (!date) {
    d = new Date();
  } else {
    d = typeof date === "string" ? new Date(date) : date;
  }

  if (backdateDays && backdateDays > 0) {
    d = new Date(d.getTime() - backdateDays * 24 * 60 * 60 * 1000);
  }

  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function calculateDeadlineDate(backdateDays?: number): string {
  const letterDate = new Date();
  if (backdateDays && backdateDays > 0) {
    letterDate.setDate(letterDate.getDate() - backdateDays);
  }
  letterDate.setDate(letterDate.getDate() + 30);
  return formatDate(letterDate);
}

// =============================================================================
// DISPUTE TYPE DETECTION
// =============================================================================

function detectDisputeType(account: SentryAccountItem): StoryContext["disputeType"] {
  // Check detected issues first
  if (account.detectedIssues && account.detectedIssues.length > 0) {
    const primaryIssue = account.detectedIssues[0];
    if (primaryIssue.suggestedEOSCARCode) {
      return EOSCAR_TO_DISPUTE_TYPE[primaryIssue.suggestedEOSCARCode] || "INACCURATE";
    }

    // Infer from issue code
    const code = primaryIssue.code.toUpperCase();
    if (code.includes("NOT_MINE") || code.includes("IDENTITY") || code.includes("FRAUD")) {
      return "NOT_MINE";
    }
    if (code.includes("PAID") || code.includes("SETTLED")) {
      return "PAID";
    }
    if (code.includes("OLD") || code.includes("OBSOLETE") || code.includes("EXPIRED")) {
      return "TOO_OLD";
    }
    if (code.includes("UNAUTHORIZED") || code.includes("CONSENT")) {
      return "UNAUTHORIZED";
    }
    if (code.includes("DUPLICATE")) {
      return "DUPLICATE";
    }
    if (code.includes("COLLECTION")) {
      return "COLLECTION";
    }
  }

  // Check account characteristics
  if (account.isCollection) {
    return "COLLECTION";
  }

  // Default
  return "INACCURATE";
}

// =============================================================================
// HUMAN-FIRST LETTER BUILDING
// =============================================================================

function buildHumanFirstLetter(
  template: HumanFirstTemplate,
  context: GenerationContext,
  story: string,
  issueStatement: string
): string {
  const bureauAddress = SENTRY_BUREAU_ADDRESSES[context.cra];
  const backdateDays = context.round === 1 ? (context.backdateDays ?? 30) : 0;

  // Build the account list (simple, human-readable)
  const accountListSimple = context.accounts
    .map((a) => {
      const accountId = a.maskedAccountId ? ` (ending in ${a.maskedAccountId})` : "";
      const balance = a.balance ? ` - showing $${a.balance.toLocaleString()}` : "";
      return `• ${a.creditorName}${accountId}${balance}`;
    })
    .join("\n");

  // Build letter content
  let letter = "";

  // Header - date and addresses
  letter += `${formatDate(undefined, backdateDays)}\n\n`;
  letter += `${context.clientName}\n`;
  letter += `${context.clientAddress}\n`;
  letter += `${context.clientCityStateZip}\n\n`;
  letter += `${bureauAddress.name}\n`;
  letter += `${bureauAddress.address}\n`;
  letter += `${bureauAddress.city}, ${bureauAddress.state} ${bureauAddress.zip}\n\n`;

  // Identification
  letter += `My name is ${context.clientName} and my Social Security Number ends in ${context.clientSSNLast4}.\n\n`;

  // MY STORY (The hook - this is what makes it human)
  letter += `${story}\n\n`;

  // WHAT'S WRONG (Simple issue statement)
  letter += `${issueStatement}\n\n`;

  // Account list
  if (context.accounts.length > 1) {
    letter += `I'm disputing these accounts:\n${accountListSimple}\n\n`;
  }

  // Follow-up context for R2+
  if (context.round > 1 && template.followUpOpening) {
    let followUp = template.followUpOpening;
    // Replace all placeholders
    followUp = followUp.replace(/\{\{CREDITOR_NAME\}\}/g, context.accounts[0]?.creditorName || "the creditor");
    if (context.previousDisputeDate) {
      followUp = followUp.replace(/\{\{PREVIOUS_DISPUTE_DATE\}\}/g, context.previousDisputeDate);
      followUp = followUp.replace(/\{\{PREVIOUS_DATE\}\}/g, context.previousDisputeDate);
    } else {
      followUp = followUp.replace(/\{\{PREVIOUS_DISPUTE_DATE\}\}/g, "a previous date");
      followUp = followUp.replace(/\{\{PREVIOUS_DATE\}\}/g, "a previous date");
    }
    if (context.confirmationNumber) {
      followUp = followUp.replace(/\{\{CONFIRMATION\}\}/g, context.confirmationNumber);
    }
    letter += `${followUp}\n\n`;
  }

  // WHAT I NEED (Clear demand)
  letter += `${template.demandText}\n\n`;

  // Custom language if any
  if (context.customLanguage) {
    letter += `${context.customLanguage}\n\n`;
  }

  // Signature
  letter += `${context.clientName}\n\n`;

  // LEGAL FOOTER (at the end, like fine print)
  letter += template.legalFooter;

  return letter;
}

function selectIssueStatement(
  template: HumanFirstTemplate,
  disputeType: StoryContext["disputeType"],
  account: SentryAccountItem
): string {
  // Get template based on dispute type
  const templates = template.issueTemplates;
  let statement = "";

  switch (disputeType) {
    case "NOT_MINE":
      statement = templates.notMine;
      break;
    case "PAID":
      statement = templates.paid;
      break;
    case "TOO_OLD":
      statement = templates.tooOld;
      break;
    case "UNAUTHORIZED":
      statement = templates.unauthorized;
      break;
    case "DUPLICATE":
      statement = templates.duplicate || templates.inaccurate;
      break;
    case "COLLECTION":
      statement = templates.collection;
      break;
    case "INACCURATE":
    default:
      statement = templates.inaccurate;
  }

  // Replace placeholders
  statement = statement.replace(/\{\{CREDITOR_NAME\}\}/g, account.creditorName);
  if (account.balance) {
    statement = statement.replace(/\{\{BALANCE\}\}/g, `$${account.balance.toLocaleString()}`);
  } else {
    statement = statement.replace(/\{\{BALANCE\}\}/g, "the amount shown");
  }
  if (account.maskedAccountId) {
    statement = statement.replace(/\{\{ACCOUNT_ID\}\}/g, account.maskedAccountId);
  }

  // Replace issue details with account-specific info
  let issueDetails = "";
  if (account.detectedIssues && account.detectedIssues.length > 0) {
    issueDetails = account.detectedIssues[0].description;
  } else if (account.disputeReason) {
    issueDetails = account.disputeReason;
  } else if (account.balance) {
    issueDetails = `It's showing $${account.balance.toLocaleString()} but that doesn't match my records.`;
  } else {
    issueDetails = "The information doesn't match what I have in my records.";
  }
  statement = statement.replace(/\{\{ISSUE_DETAILS\}\}/g, issueDetails);

  return statement;
}

// =============================================================================
// MAIN GENERATION FUNCTION - STORY FIRST
// =============================================================================

/**
 * Generate a human-first dispute letter
 * Story is generated FIRST - it's required, not optional
 */
export async function generateSentryLetter(
  context: GenerationContext
): Promise<GenerationResult> {
  const warnings: string[] = [];
  const writingMode: WritingMode = "NORMAL_PEOPLE"; // Always human-first now

  log.info({ flow: context.flow, round: context.round, accounts: context.accounts.length }, "Generating human-first letter");

  // 1. GENERATE STORY FIRST (Required!)
  // This is the heart of the human-first approach
  let impactStories: GeneratedStory[] = [];
  let combinedStory = "";

  try {
    const storiesMap = await generateStoriesForAccounts(
      context.accounts,
      context.flow,
      context.round,
      context.clientContext,
      context.organizationId
    );

    impactStories = Array.from(storiesMap.values());

    // Combine or summarize based on account count
    if (impactStories.length === 1) {
      combinedStory = impactStories[0].storyParagraph;
    } else if (impactStories.length <= 3) {
      combinedStory = combineStories(impactStories);
    } else {
      // Many accounts - generate summary story
      const primaryDisputeType = detectDisputeType(context.accounts[0]);
      combinedStory = await generateSummaryStory(
        context.accounts.length,
        primaryDisputeType,
        context.organizationId
      );
    }
  } catch (error) {
    log.error({ err: error }, "Story generation failed, using fallback");
    // Even if AI fails, we always get a story from fallback
    warnings.push("Story generated using template (AI unavailable)");

    // Generate fallback story synchronously
    const primaryAccount = context.accounts[0];
    const disputeType = detectDisputeType(primaryAccount);

    // Simple fallback story
    const fallbackStories = {
      NOT_MINE: `I was checking my credit report and found this ${primaryAccount.creditorName} account that I've never seen before. I've never done business with this company and this is affecting my credit.`,
      PAID: `I paid off my ${primaryAccount.creditorName} account but it's still showing like I owe money. I have the receipts and this isn't right.`,
      INACCURATE: `The information on my ${primaryAccount.creditorName} account isn't accurate. The numbers don't match what I have in my records.`,
      TOO_OLD: `This ${primaryAccount.creditorName} account is from years ago. It should have fallen off my report by now but it's still affecting my credit.`,
      UNAUTHORIZED: `I never authorized this ${primaryAccount.creditorName} account. Nobody asked me before opening it and I never agreed to it.`,
      DUPLICATE: `This ${primaryAccount.creditorName} account is showing up more than once. I shouldn't be penalized twice for the same thing.`,
      COLLECTION: `I got this collection from ${primaryAccount.creditorName} but something doesn't add up. I need this looked into.`,
    };

    combinedStory = fallbackStories[disputeType];
  }

  // 2. Select human-first template (or fall back to legacy)
  let humanTemplate: HumanFirstTemplate | undefined;
  let legacyTemplate: SentryTemplate | undefined;

  humanTemplate = selectHumanFirstTemplate(context.flow, context.round);

  if (!humanTemplate) {
    // Fall back to legacy template
    legacyTemplate = context.templateId
      ? getSentryTemplate(context.templateId)
      : selectBestTemplate(context.flow, context.round, "CRA");

    if (!legacyTemplate) {
      throw new Error(`No template found for flow=${context.flow} round=${context.round}`);
    }
    warnings.push("Using legacy template format");
  }

  // 3. Detect primary dispute type and select issue statement
  const primaryAccount = context.accounts[0];
  const primaryDisputeType = detectDisputeType(primaryAccount);

  // 4. E-OSCAR recommendations (hidden from user, for compliance)
  const eoscarRecommendations: EOSCARRecommendation[] = [];
  for (const account of context.accounts) {
    const recs = recommendCodesForAccount(account, context.flow);
    eoscarRecommendations.push(...recs);
  }

  const selectedEOSCARCode: string =
    context.eoscarCodeOverride ||
    (eoscarRecommendations.length > 0
      ? eoscarRecommendations.sort((a, b) => b.confidence - a.confidence)[0].code.code
      : humanTemplate?.eoscarCodeHint || legacyTemplate?.eoscarCodeHint || "105");

  // 5. Metro 2 field disputes (hidden from user, for compliance)
  const metro2Disputes = new Map<string, Metro2FieldDispute[]>();
  const allDiscrepancies: { field: string; language: string }[] = [];

  for (const account of context.accounts) {
    const accountDisputes: Metro2FieldDispute[] = [];

    // Use detected issues to create field disputes
    if (account.detectedIssues && account.detectedIssues.length > 0) {
      for (const issue of account.detectedIssues) {
        let fieldCode = issue.suggestedMetro2Field || "ACCOUNT_STATUS";

        if (!issue.suggestedMetro2Field) {
          const code = issue.code.toUpperCase();
          if (code.includes("BALANCE")) fieldCode = "BALANCE";
          else if (code.includes("DATE")) fieldCode = "DOFD";
          else if (code.includes("STATUS")) fieldCode = "ACCOUNT_STATUS";
        }

        const dispute = createFieldDispute(
          fieldCode,
          "the currently reported value",
          undefined,
          issue.description
        );

        if (dispute) accountDisputes.push(dispute);
      }
    }

    metro2Disputes.set(account.id, accountDisputes);

    // Detect discrepancies
    const discrepancies = detectFieldDiscrepancies(account);
    for (const disc of discrepancies) {
      allDiscrepancies.push({
        field: disc.fieldName,
        language: generateDiscrepancyLanguage(disc),
      });
    }
  }

  // 6. Build the letter
  let letterContent = "";

  if (humanTemplate) {
    // Use human-first template
    const issueStatement = selectIssueStatement(humanTemplate, primaryDisputeType, primaryAccount);
    letterContent = buildHumanFirstLetter(humanTemplate, context, combinedStory, issueStatement);
  } else if (legacyTemplate) {
    // Fall back to legacy template with story injection
    for (const section of legacyTemplate.sections) {
      letterContent += section.content + "\n\n";
    }

    // Inject story after header
    const headerEnd = letterContent.indexOf("\n\n\n");
    if (headerEnd > 0) {
      const before = letterContent.substring(0, headerEnd + 3);
      const after = letterContent.substring(headerEnd + 3);
      letterContent = before + combinedStory + "\n\n" + after;
    }

    // Variable substitution for legacy
    letterContent = substituteLegacyVariables(letterContent, context, metro2Disputes);
  }

  // 7. OCR Safety Check (auto-apply fixes)
  let ocrAnalysis = analyzeOCRRisk(letterContent);
  let ocrAutoFixApplied = false;

  if (!meetsMinimumSafety(letterContent)) {
    const { fixedContent, fixesApplied } = applyOCRFixes(letterContent);
    if (fixesApplied.length > 0) {
      letterContent = fixedContent;
      ocrAnalysis = analyzeOCRRisk(letterContent);
      ocrAutoFixApplied = true;
    }
  }

  // 8. Citation Validation
  const citationValidation = validateCitations(letterContent, "CRA");

  // 9. Success Prediction (simplified for user)
  const hasDiscrepancies = allDiscrepancies.length > 0;
  const avgAccountAge = context.accounts.reduce((sum, a) => {
    if (!a.dateOpened) return sum;
    const ageMonths = (Date.now() - new Date(a.dateOpened).getTime()) / (1000 * 60 * 60 * 24 * 30);
    return sum + ageMonths;
  }, 0) / context.accounts.length;

  const predictionRequest: SuccessPredictionRequest = {
    accountAge: avgAccountAge || 24,
    furnisherName: primaryAccount.creditorName || "",
    hasMetro2Targeting: metro2Disputes.size > 0,
    eoscarCode: selectedEOSCARCode,
    hasPoliceReport: false,
    hasBureauDiscrepancy: hasDiscrepancies,
    hasPaymentProof: false,
    citationAccuracyScore: citationValidation.isValid ? 1 : 0.7,
    ocrSafetyScore: ocrAnalysis.score,
  };

  const successPrediction = calculateSuccessProbability(predictionRequest);

  // 10. Build result
  const allMetro2Disputes = Array.from(metro2Disputes.values()).flat();

  return {
    letterContent,
    letterContentPlain: letterContent,

    templateId: humanTemplate?.id || legacyTemplate?.id || "unknown",
    templateName: humanTemplate?.name || legacyTemplate?.name || "Unknown Template",

    writingMode,
    impactStories,
    combinedStory,

    eoscarRecommendations,
    selectedEOSCARCode,
    metro2Disputes: allMetro2Disputes,
    discrepancies: allDiscrepancies,

    ocrAnalysis,
    citationValidation,
    successPrediction,

    warnings,
    ocrAutoFixApplied,
  };
}

// =============================================================================
// LEGACY VARIABLE SUBSTITUTION (for backward compatibility)
// =============================================================================

function substituteLegacyVariables(
  content: string,
  context: GenerationContext,
  metro2Disputes: Map<string, Metro2FieldDispute[]>
): string {
  const bureauAddress = SENTRY_BUREAU_ADDRESSES[context.cra];
  const backdateDays = context.round === 1 ? (context.backdateDays ?? 30) : 0;

  let result = content;

  // Client info
  result = result.replace(new RegExp(TEMPLATE_VARIABLES.CLIENT_NAME, "g"), context.clientName);
  result = result.replace(new RegExp(TEMPLATE_VARIABLES.CLIENT_ADDRESS, "g"), context.clientAddress);
  result = result.replace(new RegExp(TEMPLATE_VARIABLES.CLIENT_CITY_STATE_ZIP, "g"), context.clientCityStateZip);
  result = result.replace(new RegExp(TEMPLATE_VARIABLES.CLIENT_SSN_LAST4, "g"), context.clientSSNLast4);
  result = result.replace(new RegExp(TEMPLATE_VARIABLES.CLIENT_DOB, "g"), context.clientDOB);

  // Bureau info
  result = result.replace(new RegExp(TEMPLATE_VARIABLES.BUREAU_NAME, "g"), bureauAddress.name);
  result = result.replace(
    new RegExp(TEMPLATE_VARIABLES.BUREAU_ADDRESS, "g"),
    `${bureauAddress.address}\n${bureauAddress.city}, ${bureauAddress.state} ${bureauAddress.zip}`
  );

  // Dates
  result = result.replace(new RegExp(TEMPLATE_VARIABLES.CURRENT_DATE, "g"), formatDate(undefined, backdateDays));
  result = result.replace(new RegExp(TEMPLATE_VARIABLES.DEADLINE_DATE, "g"), calculateDeadlineDate(backdateDays));

  // Account list (simple)
  const accountList = context.accounts
    .map((a) => `• ${a.creditorName}${a.maskedAccountId ? ` (ending ${a.maskedAccountId})` : ""}`)
    .join("\n");
  result = result.replace(new RegExp(TEMPLATE_VARIABLES.ACCOUNT_LIST, "g"), accountList);

  // Other placeholders
  result = result.replace(new RegExp(TEMPLATE_VARIABLES.METRO2_FIELD_DISPUTES, "g"), "");
  result = result.replace(new RegExp(TEMPLATE_VARIABLES.VERIFICATION_CHALLENGES, "g"), "");
  result = result.replace(new RegExp(TEMPLATE_VARIABLES.EOSCAR_CODE_REASON, "g"), "");

  // Previous dispute info
  if (context.previousDisputeDate) {
    result = result.replace(new RegExp(TEMPLATE_VARIABLES.PREVIOUS_DISPUTE_DATE, "g"), context.previousDisputeDate);
  }

  // Confirmation number
  if (context.confirmationNumber) {
    result = result.replace(new RegExp(TEMPLATE_VARIABLES.CONFIRMATION_NUMBER_SECTION, "g"), ` Reference: ${context.confirmationNumber}.`);
    result = result.replace(new RegExp(TEMPLATE_VARIABLES.CONFIRMATION_NUMBER, "g"), context.confirmationNumber);
  } else {
    result = result.replace(new RegExp(TEMPLATE_VARIABLES.CONFIRMATION_NUMBER_SECTION, "g"), "");
    result = result.replace(new RegExp(TEMPLATE_VARIABLES.CONFIRMATION_NUMBER, "g"), "");
  }

  return result;
}

// =============================================================================
// PREVIEW GENERATION
// =============================================================================

/**
 * Generate a quick preview without full analysis
 */
export function generateSentryPreview(
  context: GenerationContext
): { letterContent: string; templateName: string } {
  const humanTemplate = selectHumanFirstTemplate(context.flow, context.round);

  if (humanTemplate) {
    const primaryAccount = context.accounts[0];
    const disputeType = detectDisputeType(primaryAccount);

    // Use a placeholder story for preview
    const previewStory = "[Your personal story will appear here - how this issue is affecting your life]";
    const issueStatement = selectIssueStatement(humanTemplate, disputeType, primaryAccount);

    const letterContent = buildHumanFirstLetter(humanTemplate, context, previewStory, issueStatement);

    return {
      letterContent,
      templateName: humanTemplate.name,
    };
  }

  // Fall back to legacy preview
  const template = context.templateId
    ? getSentryTemplate(context.templateId)
    : selectBestTemplate(context.flow, context.round, "CRA");

  if (!template) {
    throw new Error("No template found");
  }

  let letterContent = "";
  for (const section of template.sections) {
    letterContent += section.content + "\n\n";
  }

  const accountList = context.accounts
    .map((a) => `- ${a.creditorName} (Account ending ${a.maskedAccountId || "XXXX"})`)
    .join("\n");

  letterContent = letterContent.replace(new RegExp(TEMPLATE_VARIABLES.ACCOUNT_LIST, "g"), accountList);

  return {
    letterContent,
    templateName: template.name,
  };
}

// =============================================================================
// REGENERATION
// =============================================================================

/**
 * Regenerate a letter with new parameters
 */
export async function regenerateSentryLetter(
  originalContext: GenerationContext,
  overrides: Partial<GenerationContext>
): Promise<GenerationResult> {
  const newContext: GenerationContext = {
    ...originalContext,
    ...overrides,
  };

  return generateSentryLetter(newContext);
}

// =============================================================================
// ANALYSIS FUNCTIONS
// =============================================================================

/**
 * Analyze an existing letter
 */
export function analyzeExistingLetter(
  letterContent: string,
  targetType: "CRA" | "FURNISHER" | "COLLECTOR" = "CRA"
): {
  ocrAnalysis: OCRAnalysisResult;
  citationValidation: CitationValidationResult;
  suggestions: string[];
} {
  const ocrAnalysis = analyzeOCRRisk(letterContent);
  const citationValidation = validateCitations(letterContent, targetType);

  const suggestions: string[] = [];

  if (ocrAnalysis.risk === "HIGH") {
    suggestions.push("This letter may be flagged. Consider using simpler language.");
  } else if (ocrAnalysis.risk === "MEDIUM") {
    suggestions.push("Some phrases could be simplified for better processing.");
  }

  if (!citationValidation.isValid) {
    suggestions.push(`Found ${citationValidation.invalidCitations.length} citation issue(s) to review.`);
  }

  return {
    ocrAnalysis,
    citationValidation,
    suggestions,
  };
}

/**
 * Get available templates
 */
export function getAvailableTemplates(
  flow?: SentryFlowType,
  round?: SentryRound
): { id: string; name: string; description: string; flow: SentryFlowType; round: SentryRound }[] {
  const { getSentryTemplates, getHumanFirstTemplates } = require("./sentry-templates");

  // Prefer human-first templates
  const humanTemplates = getHumanFirstTemplates() as HumanFirstTemplate[];
  const templates: { id: string; name: string; description: string; flow: SentryFlowType; round: SentryRound }[] = [];

  for (const t of humanTemplates) {
    if (flow && t.flow !== flow) continue;
    if (round && t.round !== round) continue;

    templates.push({
      id: t.id,
      name: t.name,
      description: t.description,
      flow: t.flow,
      round: t.round,
    });
  }

  // If no human-first templates match, fall back to legacy
  if (templates.length === 0) {
    const legacyTemplates = getSentryTemplates() as SentryTemplate[];

    for (const t of legacyTemplates) {
      if (flow && t.flow !== flow) continue;
      if (round && t.round !== round) continue;

      templates.push({
        id: t.id,
        name: t.name,
        description: t.description,
        flow: t.flow,
        round: t.round,
      });
    }
  }

  return templates;
}

// Re-export writing mode types
export { type WritingMode, getWritingModeConfig, getAvailableWritingModes } from "./writing-modes";
