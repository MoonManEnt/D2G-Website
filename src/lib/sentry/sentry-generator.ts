/**
 * SENTRY LETTER GENERATOR
 *
 * Generates dispute letters using the Sentry intelligence engines.
 * Integrates e-OSCAR optimization, legal validation, OCR safety,
 * Metro 2 targeting, and success prediction.
 *
 * KEY FEATURES:
 * - Template-based generation with variable substitution
 * - Automatic Metro 2 field targeting language
 * - e-OSCAR code optimization
 * - OCR safety scoring and auto-fixing
 * - Legal citation validation
 * - Success probability calculation
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
  getSentryTemplate,
  TEMPLATE_VARIABLES,
  type SentryTemplate,
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
}

export interface GenerationResult {
  // Generated letter
  letterContent: string;
  letterContentPlain: string; // Without variable markers

  // Template used
  templateId: string;
  templateName: string;

  // Intelligence results
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
// VARIABLE SUBSTITUTION
// =============================================================================

function formatDate(date?: Date | string): string {
  if (!date) return new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function calculateDeadlineDate(): string {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 30);
  return formatDate(deadline);
}

function substituteVariables(
  content: string,
  context: GenerationContext,
  extras: {
    accountList: string;
    metro2FieldDisputes: string;
    verificationChallenges: string;
    eoscarCodeReason: string;
  }
): string {
  const bureauAddress = SENTRY_BUREAU_ADDRESSES[context.cra];

  let result = content;

  // Client info
  result = result.replace(
    new RegExp(TEMPLATE_VARIABLES.CLIENT_NAME, "g"),
    context.clientName
  );
  result = result.replace(
    new RegExp(TEMPLATE_VARIABLES.CLIENT_ADDRESS, "g"),
    context.clientAddress
  );
  result = result.replace(
    new RegExp(TEMPLATE_VARIABLES.CLIENT_CITY_STATE_ZIP, "g"),
    context.clientCityStateZip
  );
  result = result.replace(
    new RegExp(TEMPLATE_VARIABLES.CLIENT_SSN_LAST4, "g"),
    context.clientSSNLast4
  );
  result = result.replace(
    new RegExp(TEMPLATE_VARIABLES.CLIENT_DOB, "g"),
    context.clientDOB
  );

  // Bureau info
  result = result.replace(
    new RegExp(TEMPLATE_VARIABLES.BUREAU_NAME, "g"),
    bureauAddress.name
  );
  result = result.replace(
    new RegExp(TEMPLATE_VARIABLES.BUREAU_ADDRESS, "g"),
    `${bureauAddress.address}\n${bureauAddress.city}, ${bureauAddress.state} ${bureauAddress.zip}`
  );

  // Dates
  result = result.replace(
    new RegExp(TEMPLATE_VARIABLES.CURRENT_DATE, "g"),
    formatDate()
  );
  result = result.replace(
    new RegExp(TEMPLATE_VARIABLES.DEADLINE_DATE, "g"),
    calculateDeadlineDate()
  );

  // Account info
  result = result.replace(
    new RegExp(TEMPLATE_VARIABLES.ACCOUNT_LIST, "g"),
    extras.accountList
  );
  result = result.replace(
    new RegExp(TEMPLATE_VARIABLES.METRO2_FIELD_DISPUTES, "g"),
    extras.metro2FieldDisputes
  );
  result = result.replace(
    new RegExp(TEMPLATE_VARIABLES.VERIFICATION_CHALLENGES, "g"),
    extras.verificationChallenges
  );
  result = result.replace(
    new RegExp(TEMPLATE_VARIABLES.EOSCAR_CODE_REASON, "g"),
    extras.eoscarCodeReason
  );

  // Previous dispute info
  if (context.previousDisputeDate) {
    result = result.replace(
      new RegExp(TEMPLATE_VARIABLES.PREVIOUS_DISPUTE_DATE, "g"),
      context.previousDisputeDate
    );
  }
  if (context.confirmationNumber) {
    result = result.replace(
      new RegExp(TEMPLATE_VARIABLES.CONFIRMATION_NUMBER, "g"),
      context.confirmationNumber
    );
  }

  return result;
}

// =============================================================================
// ACCOUNT LIST BUILDING
// =============================================================================

function buildAccountList(
  accounts: SentryAccountItem[],
  metro2Disputes: Map<string, Metro2FieldDispute[]>
): string {
  const lines: string[] = [];

  for (const account of accounts) {
    const disputes = metro2Disputes.get(account.id) || [];
    const entry = buildAccountListEntry(
      account.creditorName,
      account.maskedAccountId,
      disputes
    );
    lines.push(entry);
  }

  return lines.join("\n");
}

function buildMetro2FieldDisputeSection(
  metro2Disputes: Map<string, Metro2FieldDispute[]>
): string {
  const allDisputes = Array.from(metro2Disputes.values()).flat();
  if (allDisputes.length === 0) return "";

  const lines = ["The following specific data fields are disputed:"];

  for (const dispute of allDisputes) {
    lines.push(`\n- ${dispute.field.name}: ${dispute.generatedLanguage}`);
  }

  return lines.join("");
}

function buildVerificationChallengeSection(
  metro2Disputes: Map<string, Metro2FieldDispute[]>
): string {
  const allFieldCodes = new Set<string>();

  for (const disputes of metro2Disputes.values()) {
    for (const dispute of disputes) {
      allFieldCodes.add(dispute.field.code);
    }
  }

  if (allFieldCodes.size === 0) return "";

  const challenges = getVerificationChallenges(Array.from(allFieldCodes));
  const lines = challenges.map(
    (c) => `- ${c.field}: ${c.challenge}`
  );

  return lines.join("\n");
}

// =============================================================================
// MAIN GENERATION FUNCTION
// =============================================================================

/**
 * Generate a Sentry dispute letter with full intelligence analysis
 */
export function generateSentryLetter(
  context: GenerationContext
): GenerationResult {
  const warnings: string[] = [];

  // 1. Select template
  const template = context.templateId
    ? getSentryTemplate(context.templateId)
    : selectBestTemplate(context.flow, context.round, "CRA");

  if (!template) {
    throw new Error(
      `No template found for flow=${context.flow} round=${context.round}`
    );
  }

  // 2. Generate e-OSCAR recommendations for each account
  const eoscarRecommendations: EOSCARRecommendation[] = [];
  for (const account of context.accounts) {
    const recs = recommendCodesForAccount(account, context.flow);
    eoscarRecommendations.push(...recs);
  }

  // Select primary e-OSCAR code (highest priority from recommendations)
  const selectedEOSCARCode: string =
    context.eoscarCodeOverride ||
    (eoscarRecommendations.length > 0
      ? eoscarRecommendations.sort((a, b) => b.confidence - a.confidence)[0].code.code
      : template.eoscarCodeHint || "105");

  const eoscarCodeReason = getCodeDescription(selectedEOSCARCode) || "";

  // 3. Generate Metro 2 field disputes for each account
  const metro2Disputes = new Map<string, Metro2FieldDispute[]>();
  const allDiscrepancies: { field: string; language: string }[] = [];

  for (const account of context.accounts) {
    // Get recommended fields based on account type
    const recommendedFields = getRecommendedFields(
      account.accountType,
      account.isCollection
    );

    const accountDisputes: Metro2FieldDispute[] = [];

    // Create disputes for recommended fields
    for (const field of recommendedFields) {
      // Get the value from the account if available
      let reportedValue = "as reported";
      if (field.code === "BALANCE" && account.balance !== undefined) {
        reportedValue = `$${account.balance.toLocaleString()}`;
      } else if (field.code === "DOFD" && account.dofd) {
        reportedValue = new Date(account.dofd).toLocaleDateString();
      } else if (field.code === "ACCOUNT_STATUS" && account.accountStatus) {
        reportedValue = account.accountStatus;
      }

      const dispute = createFieldDispute(
        field.code,
        reportedValue,
        undefined,
        account.disputeReason
      );

      if (dispute) {
        accountDisputes.push(dispute);
      }
    }

    metro2Disputes.set(account.id, accountDisputes);

    // Detect cross-bureau discrepancies
    const discrepancies = detectFieldDiscrepancies(account);
    for (const disc of discrepancies) {
      allDiscrepancies.push({
        field: disc.fieldName,
        language: generateDiscrepancyLanguage(disc),
      });
    }
  }

  // 4. Build account list and field sections
  const accountList = buildAccountList(context.accounts, metro2Disputes);
  const metro2FieldDisputeSection = buildMetro2FieldDisputeSection(metro2Disputes);
  const verificationChallenges = buildVerificationChallengeSection(metro2Disputes);

  // 5. Assemble template sections
  let letterContent = "";
  for (const section of template.sections) {
    letterContent += section.content + "\n\n";
  }

  // Add custom language if provided
  if (context.customLanguage) {
    letterContent += `\nAdditional information:\n${context.customLanguage}\n`;
  }

  // 6. Substitute variables
  letterContent = substituteVariables(letterContent, context, {
    accountList,
    metro2FieldDisputes: metro2FieldDisputeSection,
    verificationChallenges,
    eoscarCodeReason,
  });

  // Store original for comparison
  const originalContent = letterContent;

  // 7. Run OCR analysis
  let ocrAnalysis = analyzeOCRRisk(letterContent);
  let ocrAutoFixApplied = false;

  // Auto-fix if score is below minimum
  if (!meetsMinimumSafety(letterContent)) {
    const { fixedContent, fixesApplied } = applyOCRFixes(letterContent);
    if (fixesApplied.length > 0) {
      letterContent = fixedContent;
      ocrAnalysis = analyzeOCRRisk(letterContent);
      ocrAutoFixApplied = true;
      warnings.push(
        `OCR safety fixes applied: ${fixesApplied.length} phrases replaced to reduce frivolous flagging risk`
      );
    }
  }

  // 8. Validate legal citations
  const citationValidation = validateCitations(letterContent, "CRA");

  if (!citationValidation.isValid) {
    for (const invalid of citationValidation.invalidCitations) {
      warnings.push(
        `Invalid citation detected: ${invalid.statute} - ${invalid.reason}`
      );
    }
  }

  // 9. Calculate success probability
  const hasDiscrepancies = allDiscrepancies.length > 0;
  const avgAccountAge = context.accounts.reduce((sum, a) => {
    if (!a.dateOpened) return sum;
    const ageMonths =
      (new Date().getTime() - new Date(a.dateOpened).getTime()) /
      (1000 * 60 * 60 * 24 * 30);
    return sum + ageMonths;
  }, 0) / context.accounts.length;

  const predictionRequest: SuccessPredictionRequest = {
    accountAge: avgAccountAge || 24,
    furnisherName: context.accounts[0]?.creditorName || "",
    hasMetro2Targeting: metro2Disputes.size > 0,
    eoscarCode: selectedEOSCARCode,
    hasPoliceReport: false,
    hasBureauDiscrepancy: hasDiscrepancies,
    hasPaymentProof: false,
    citationAccuracyScore: citationValidation.isValid ? 1 : 0.7,
    ocrSafetyScore: ocrAnalysis.score,
  };

  const successPrediction = calculateSuccessProbability(predictionRequest);

  // Add recommendations as warnings
  for (const rec of successPrediction.recommendations) {
    if (!rec.includes("well-optimized")) {
      warnings.push(`Improvement suggestion: ${rec}`);
    }
  }

  // 10. Build result
  const allMetro2Disputes = Array.from(metro2Disputes.values()).flat();

  return {
    letterContent,
    letterContentPlain: letterContent, // Already substituted

    templateId: template.id,
    templateName: template.name,

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

/**
 * Generate a preview without full intelligence analysis
 */
export function generateSentryPreview(
  context: GenerationContext
): { letterContent: string; templateName: string } {
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

  // Simple account list
  const accountList = context.accounts
    .map((a) => `- ${a.creditorName} (Account ending ${a.maskedAccountId || "XXXX"})`)
    .join("\n");

  letterContent = substituteVariables(letterContent, context, {
    accountList,
    metro2FieldDisputes: "[Metro 2 field targeting will be added]",
    verificationChallenges: "[Verification challenges will be added]",
    eoscarCodeReason: "[e-OSCAR code reason will be added]",
  });

  return {
    letterContent,
    templateName: template.name,
  };
}

/**
 * Regenerate a letter with new parameters
 */
export function regenerateSentryLetter(
  originalContext: GenerationContext,
  overrides: Partial<GenerationContext>
): GenerationResult {
  const newContext: GenerationContext = {
    ...originalContext,
    ...overrides,
  };

  return generateSentryLetter(newContext);
}

/**
 * Analyze an existing letter (not generated by Sentry)
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

  // OCR suggestions
  if (ocrAnalysis.risk === "HIGH") {
    suggestions.push(
      "This letter has HIGH risk of being flagged as frivolous. Consider rewriting with more professional language."
    );
  } else if (ocrAnalysis.risk === "MEDIUM") {
    suggestions.push(
      "This letter has moderate OCR risk. Consider replacing flagged phrases."
    );
  }

  // Citation suggestions
  if (!citationValidation.isValid) {
    suggestions.push(
      `Found ${citationValidation.invalidCitations.length} problematic legal citation(s). Review and correct before sending.`
    );
  }

  for (const warning of citationValidation.warnings) {
    suggestions.push(`Citation warning: ${warning.warning}`);
  }

  return {
    ocrAnalysis,
    citationValidation,
    suggestions,
  };
}

/**
 * Get available templates for selection
 */
export function getAvailableTemplates(
  flow?: SentryFlowType,
  round?: SentryRound
): { id: string; name: string; description: string; flow: SentryFlowType; round: SentryRound }[] {
  const { getSentryTemplates } = require("./sentry-templates");
  const templates = getSentryTemplates();

  return templates
    .filter((t: SentryTemplate) => {
      if (flow && t.flow !== flow) return false;
      if (round && t.round !== round) return false;
      return true;
    })
    .map((t: SentryTemplate) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      flow: t.flow,
      round: t.round,
    }));
}
