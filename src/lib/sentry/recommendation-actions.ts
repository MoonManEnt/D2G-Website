/**
 * SENTRY RECOMMENDATION ACTIONS
 *
 * Handles applying and reverting actionable recommendations to dispute letters.
 * Each recommendation type has a specific handler that modifies the letter content
 * and recalculates success probability.
 */

import type {
  ActionableRecommendation,
  RecommendationPayload,
  EnableMetro2Payload,
  ChangeEOSCARPayload,
  ApplyOCRFixesPayload,
  AppliedRecommendations,
  SentryAccountItem,
} from "@/types/sentry";
import { applyOCRFixes, analyzeOCRRisk } from "./ocr-detector";
import { buildAccountListEntry, getMetro2Field, METRO2_FIELD_DATABASE } from "./metro2-targeting";

// =============================================================================
// TYPES
// =============================================================================

export interface ApplyRecommendationResult {
  success: boolean;
  updatedLetterContent: string;
  previousLetterContent: string;
  recommendation: ActionableRecommendation;
  newSuccessProbability?: number;
  error?: string;
}

export interface RevertRecommendationResult {
  success: boolean;
  restoredLetterContent: string;
  error?: string;
}

export interface PreviewResult {
  previewContent: string;
  changesSummary: string[];
  estimatedGain: number;
}

// =============================================================================
// APPLY RECOMMENDATION
// =============================================================================

/**
 * Apply a single recommendation to a dispute letter
 */
export async function applyRecommendation(
  recommendation: ActionableRecommendation,
  currentLetterContent: string,
  accounts: SentryAccountItem[]
): Promise<ApplyRecommendationResult> {
  const previousLetterContent = currentLetterContent;
  let updatedLetterContent = currentLetterContent;

  try {
    switch (recommendation.type) {
      case "ENABLE_METRO2":
        updatedLetterContent = applyEnableMetro2(
          currentLetterContent,
          recommendation.payload as EnableMetro2Payload,
          accounts
        );
        break;

      case "DISABLE_METRO2":
        updatedLetterContent = applyDisableMetro2(
          currentLetterContent,
          recommendation.payload as EnableMetro2Payload,
          accounts
        );
        break;

      case "CHANGE_EOSCAR_CODE":
        updatedLetterContent = applyChangeEOSCARCode(
          currentLetterContent,
          recommendation.payload as ChangeEOSCARPayload,
          accounts
        );
        break;

      case "APPLY_OCR_FIXES":
        updatedLetterContent = applyOCRFixesAction(
          currentLetterContent,
          recommendation.payload as ApplyOCRFixesPayload
        );
        break;

      case "ADD_LEGAL_CITATION":
        updatedLetterContent = applyAddCitation(
          currentLetterContent,
          recommendation.payload
        );
        break;

      case "REMOVE_INVALID_CITATION":
        updatedLetterContent = applyRemoveCitation(
          currentLetterContent,
          recommendation.payload
        );
        break;

      case "ADD_DOCUMENTATION":
        updatedLetterContent = applyAddDocumentation(
          currentLetterContent,
          recommendation.payload,
          accounts
        );
        break;

      case "REMOVE_HARD_INQUIRY":
        updatedLetterContent = applyRemoveHardInquiry(
          currentLetterContent,
          recommendation.payload
        );
        break;

      case "CORRECT_NAME_SPELLING":
        updatedLetterContent = applyCorrectNameSpelling(
          currentLetterContent,
          recommendation.payload
        );
        break;

      case "REMOVE_PREVIOUS_ADDRESS":
        updatedLetterContent = applyRemovePreviousAddress(
          currentLetterContent,
          recommendation.payload
        );
        break;

      default:
        return {
          success: false,
          updatedLetterContent: currentLetterContent,
          previousLetterContent,
          recommendation,
          error: `Unsupported recommendation type: ${recommendation.type}`,
        };
    }

    // Update recommendation status
    recommendation.status = "APPLIED";
    recommendation.appliedAt = new Date();

    return {
      success: true,
      updatedLetterContent,
      previousLetterContent,
      recommendation,
    };
  } catch (error) {
    return {
      success: false,
      updatedLetterContent: currentLetterContent,
      previousLetterContent,
      recommendation,
      error: error instanceof Error ? error.message : "Unknown error applying recommendation",
    };
  }
}

/**
 * Revert a recommendation to restore original content
 */
export function revertRecommendation(
  appliedRecommendations: AppliedRecommendations,
  recommendationId: string
): RevertRecommendationResult {
  const applied = appliedRecommendations.appliedRecommendations.find(
    (r) => r.recommendationId === recommendationId
  );

  if (!applied) {
    return {
      success: false,
      restoredLetterContent: appliedRecommendations.currentLetterContent,
      error: "Recommendation not found in applied list",
    };
  }

  // Find the index of this recommendation
  const index = appliedRecommendations.appliedRecommendations.indexOf(applied);

  // If this is the only recommendation or the first one, revert to original
  if (index === 0) {
    return {
      success: true,
      restoredLetterContent: appliedRecommendations.originalLetterContent,
    };
  }

  // Otherwise, revert to the state before this recommendation was applied
  const previousState = appliedRecommendations.appliedRecommendations[index - 1];
  return {
    success: true,
    restoredLetterContent: previousState.letterContentAfter,
  };
}

/**
 * Reset all recommendations and restore original letter
 */
export function resetAllRecommendations(
  appliedRecommendations: AppliedRecommendations
): string {
  return appliedRecommendations.originalLetterContent;
}

// =============================================================================
// PREVIEW FUNCTIONS
// =============================================================================

/**
 * Preview what the letter will look like after applying a recommendation
 */
export function previewRecommendation(
  recommendation: ActionableRecommendation,
  currentLetterContent: string,
  accounts: SentryAccountItem[]
): PreviewResult {
  const changesSummary: string[] = [];

  switch (recommendation.type) {
    case "ENABLE_METRO2": {
      const payload = recommendation.payload as EnableMetro2Payload;
      changesSummary.push(
        `Add Metro 2 field targeting for ${payload.suggestedFields?.length || 3} fields`
      );
      changesSummary.push("Forces furnisher to verify specific data fields");
      changesSummary.push("Increases dispute specificity score");
      break;
    }

    case "CHANGE_EOSCAR_CODE": {
      const payload = recommendation.payload as ChangeEOSCARPayload;
      changesSummary.push(`Change e-OSCAR code from ${payload.currentCode} to ${payload.suggestedCode}`);
      changesSummary.push(`New code: "${payload.suggestedCodeName}"`);
      changesSummary.push(payload.reasoning);
      break;
    }

    case "APPLY_OCR_FIXES": {
      const payload = recommendation.payload as ApplyOCRFixesPayload;
      changesSummary.push(`Replace ${payload.fixes.length} risky phrase(s)`);
      for (const fix of payload.fixes.slice(0, 3)) {
        changesSummary.push(`"${fix.original}" → "${fix.replacement}"`);
      }
      if (payload.fixes.length > 3) {
        changesSummary.push(`...and ${payload.fixes.length - 3} more`);
      }
      break;
    }

    default:
      changesSummary.push(recommendation.description);
  }

  return {
    previewContent: recommendation.previewAfter || "",
    changesSummary,
    estimatedGain: recommendation.potentialGainValue,
  };
}

// =============================================================================
// INDIVIDUAL ACTION HANDLERS
// =============================================================================

/**
 * Apply Metro 2 field targeting to the letter
 */
function applyEnableMetro2(
  letterContent: string,
  payload: EnableMetro2Payload,
  accounts: SentryAccountItem[]
): string {
  let updatedContent = letterContent;

  // Find the accounts section
  const accountsSectionMatch = letterContent.match(
    /The following account\(s\) contain information that I believe to be inaccurate:([\s\S]*?)(?=\n\n[A-Z]|$)/
  );

  if (!accountsSectionMatch) {
    // If no accounts section found, return unchanged
    return letterContent;
  }

  // Build new account entries with Metro 2 targeting
  const newAccountEntries: string[] = [];

  for (const account of accounts) {
    const suggestedFields = payload.suggestedFields || ["BALANCE", "PAYMENT_STATUS", "DATE_OF_LAST_ACTIVITY"];
    const fieldDisputes = suggestedFields.map((fieldCode) => {
      const field = getMetro2Field(fieldCode);
      if (!field) {
        return null;
      }
      return {
        field,
        reportedValue: "as reported",
        generatedLanguage: field.disputeLanguageTemplate
          .replace("{reported_value}", "the currently reported value")
          .replace("{correct_value}", "the accurate value")
          .replace("{month_year}", "the accurate date"),
      };
    }).filter(Boolean);

    if (fieldDisputes.length > 0) {
      const entry = buildAccountListEntry(
        account.creditorName,
        account.maskedAccountId,
        fieldDisputes as Parameters<typeof buildAccountListEntry>[2]
      );
      newAccountEntries.push(entry);
    }
  }

  if (newAccountEntries.length === 0) {
    return letterContent;
  }

  // Replace the accounts section
  const newAccountsSection = `The following account(s) contain information that I believe to be inaccurate:

${newAccountEntries.join("\n")}`;

  updatedContent = updatedContent.replace(
    /The following account\(s\) contain information that I believe to be inaccurate:[\s\S]*?(?=\n\n[A-Z]|$)/,
    newAccountsSection
  );

  return updatedContent;
}

/**
 * Remove Metro 2 field targeting from the letter
 */
function applyDisableMetro2(
  letterContent: string,
  payload: EnableMetro2Payload,
  accounts: SentryAccountItem[]
): string {
  let updatedContent = letterContent;

  // Build simple account entries without Metro 2 targeting
  const simpleAccountEntries = accounts.map((account) => {
    let entry = `• **${account.creditorName}**`;
    if (account.maskedAccountId) {
      entry += ` (Account ending **${account.maskedAccountId}**)`;
    }
    entry += "\n  - The information reported for this account is inaccurate.";
    return entry;
  });

  const newAccountsSection = `The following account(s) contain information that I believe to be inaccurate:

${simpleAccountEntries.join("\n\n")}`;

  updatedContent = updatedContent.replace(
    /The following account\(s\) contain information that I believe to be inaccurate:[\s\S]*?(?=\n\n[A-Z]|$)/,
    newAccountsSection
  );

  return updatedContent;
}

/**
 * Update e-OSCAR code language in the letter
 */
function applyChangeEOSCARCode(
  letterContent: string,
  payload: ChangeEOSCARPayload,
  accounts: SentryAccountItem[]
): string {
  // Map e-OSCAR codes to dispute reason language
  const codeReasonMap: Record<string, string> = {
    "102": "This account belongs to another individual with a similar name.",
    "103": "This is not my account. I have no knowledge of this obligation.",
    "104": "This account was closed by me and should not show as open.",
    "105": "This account was paid in full as agreed.",
    "106": "The current account status is incorrectly reported.",
    "108": "I was never late on this account as indicated.",
    "109": "The balance shown is incorrect.",
    "112": "I dispute the accuracy of the information reported.",
  };

  const newReason = codeReasonMap[payload.suggestedCode] ||
    `Dispute code ${payload.suggestedCode}: ${payload.suggestedCodeName}`;

  // Find and replace the generic dispute language with the specific code language
  const genericPatterns = [
    /The information reported for this account is inaccurate\./gi,
    /I dispute the accuracy of the information reported\./gi,
    /This account contains inaccurate information\./gi,
  ];

  let updatedContent = letterContent;
  for (const pattern of genericPatterns) {
    updatedContent = updatedContent.replace(pattern, newReason);
  }

  return updatedContent;
}

/**
 * Apply OCR safety fixes to the letter
 */
function applyOCRFixesAction(
  letterContent: string,
  payload: ApplyOCRFixesPayload
): string {
  let updatedContent = letterContent;

  // Apply each fix
  for (const fix of payload.fixes) {
    // Use case-insensitive replacement
    const pattern = new RegExp(escapeRegExp(fix.original), "gi");
    updatedContent = updatedContent.replace(pattern, fix.replacement);
  }

  return updatedContent;
}

/**
 * Add a legal citation to the letter
 */
function applyAddCitation(
  letterContent: string,
  payload: unknown
): string {
  const citationPayload = payload as {
    type: string;
    statute: string;
    name: string;
    insertLocation: string;
    citationText: string;
  };

  let updatedContent = letterContent;

  // Find appropriate insertion point based on location
  switch (citationPayload.insertLocation) {
    case "OPENING":
      // Insert after the first paragraph
      const firstParaEnd = updatedContent.indexOf("\n\n");
      if (firstParaEnd !== -1) {
        updatedContent =
          updatedContent.slice(0, firstParaEnd) +
          `\n\n${citationPayload.citationText}` +
          updatedContent.slice(firstParaEnd);
      }
      break;

    case "BODY":
      // Insert before the accounts section
      const accountsIndex = updatedContent.indexOf("The following account(s)");
      if (accountsIndex !== -1) {
        updatedContent =
          updatedContent.slice(0, accountsIndex) +
          `${citationPayload.citationText}\n\n` +
          updatedContent.slice(accountsIndex);
      }
      break;

    case "DEMAND":
      // Insert before the demand/closing section
      const demandPatterns = [
        /I request that you/i,
        /Please investigate/i,
        /I demand/i,
      ];
      for (const pattern of demandPatterns) {
        const match = updatedContent.match(pattern);
        if (match && match.index !== undefined) {
          updatedContent =
            updatedContent.slice(0, match.index) +
            `${citationPayload.citationText}\n\n` +
            updatedContent.slice(match.index);
          break;
        }
      }
      break;
  }

  return updatedContent;
}

/**
 * Add documentation language (e.g., cross-bureau discrepancy) to the letter
 */
function applyAddDocumentation(
  letterContent: string,
  payload: unknown,
  accounts: SentryAccountItem[]
): string {
  const docPayload = payload as {
    type: string;
    documentationType: string;
    description: string;
    requiredFields: string[];
  };

  let updatedContent = letterContent;

  // Find the accounts section to add documentation after it
  const accountsSectionEnd = letterContent.search(/\n\n(?=I request|Please investigate|Under the|I am exercising)/i);

  if (accountsSectionEnd === -1) {
    // Fallback: add before the closing section
    const closingIndex = letterContent.lastIndexOf("\n\nSincerely");
    if (closingIndex !== -1) {
      const documentationText = buildDocumentationText(docPayload.documentationType, accounts);
      updatedContent =
        letterContent.slice(0, closingIndex) +
        `\n\n${documentationText}` +
        letterContent.slice(closingIndex);
    }
    return updatedContent;
  }

  // Build documentation paragraph based on type
  const documentationText = buildDocumentationText(docPayload.documentationType, accounts);

  // Insert after accounts section
  updatedContent =
    letterContent.slice(0, accountsSectionEnd) +
    `\n\n${documentationText}` +
    letterContent.slice(accountsSectionEnd);

  return updatedContent;
}

/**
 * Build documentation text based on type
 */
function buildDocumentationText(documentationType: string, accounts: SentryAccountItem[]): string {
  switch (documentationType) {
    case "BUREAU_DISCREPANCY":
      const creditorNames = [...new Set(accounts.map(a => a.creditorName))].slice(0, 3);
      return `**Cross-Bureau Discrepancy Notice:**

I have obtained my credit reports from all three major credit bureaus (TransUnion, Experian, and Equifax) and have identified significant discrepancies in how the account(s) listed above are being reported. These inconsistencies between bureaus demonstrate that at least one (and possibly all) of the credit bureaus is reporting inaccurate information.

The discrepancies include but are not limited to: varying balances, different dates of last activity, inconsistent payment statuses, and conflicting account statuses across bureaus. Under 15 U.S.C. § 1681e(b), you are required to follow reasonable procedures to assure maximum possible accuracy. The existence of these discrepancies between bureaus is prima facie evidence that your reporting procedures have failed.

I demand that you conduct a thorough investigation and reconcile these discrepancies by verifying the actual account data with the original creditor${creditorNames.length > 0 ? ` (${creditorNames.join(', ')})` : ''}.`;

    case "PAYMENT_PROOF":
      return `**Payment Documentation:**

I have documentation proving that payments were made on the disputed account(s) that are not reflected in your current reporting. I am prepared to provide copies of canceled checks, bank statements, or other payment verification upon request. Your failure to accurately report my payment history is a violation of the Fair Credit Reporting Act.`;

    default:
      return `**Documentation Notice:**

I have additional documentation supporting my dispute that demonstrates the inaccuracy of the information currently reported. Please conduct a thorough investigation to verify the accuracy of this account.`;
  }
}

/**
 * Remove an invalid citation from the letter
 */
function applyRemoveCitation(
  letterContent: string,
  payload: unknown
): string {
  const removePayload = payload as {
    type: string;
    statute: string;
    reason: string;
    replacementStatute?: string;
    replacementText?: string;
  };

  let updatedContent = letterContent;

  // Find and remove sentences containing the invalid citation
  const pattern = new RegExp(
    `[^.]*${escapeRegExp(removePayload.statute)}[^.]*\\.`,
    "gi"
  );

  if (removePayload.replacementText) {
    // Replace with correct citation
    updatedContent = updatedContent.replace(pattern, removePayload.replacementText);
  } else {
    // Just remove
    updatedContent = updatedContent.replace(pattern, "");
  }

  // Clean up any double spaces or newlines
  updatedContent = updatedContent.replace(/\n{3,}/g, "\n\n");
  updatedContent = updatedContent.replace(/  +/g, " ");

  return updatedContent;
}

// =============================================================================
// PERSONAL INFORMATION CLEANUP HANDLERS (HUMAN-FIRST TONE)
// =============================================================================

/**
 * Add hard inquiry removal language to the letter - HUMAN FIRST
 */
function applyRemoveHardInquiry(
  letterContent: string,
  payload: unknown
): string {
  const p = payload as { hardInquiries?: { creditorName: string; date: string }[] };

  // Build the list of specific inquiries if provided
  let inquiryList = "";
  if (p.hardInquiries && p.hardInquiries.length > 0) {
    inquiryList = p.hardInquiries
      .map(inq => `  - ${inq.creditorName} (${inq.date})`)
      .join("\n");
  }

  const hardInquiryText = `
While reviewing my credit report, I also noticed some hard inquiries that I never authorized. I don't remember applying for credit with these companies, and seeing them on my report is concerning:

${inquiryList || "  - [The unauthorized inquiries listed on my report]"}

I never gave permission for these credit checks. They're hurting my score and I need them removed. Please look into who pulled my credit and why - if there's no valid reason, take them off my report.
`;

  // Find insertion point - before the closing/signature
  const closingIndex = letterContent.lastIndexOf("\n\nSincerely");
  const thankYouIndex = letterContent.lastIndexOf("\n\nThank you");
  const insertIndex = Math.max(closingIndex, thankYouIndex);

  if (insertIndex !== -1) {
    return (
      letterContent.slice(0, insertIndex) +
      hardInquiryText +
      letterContent.slice(insertIndex)
    );
  }

  return letterContent + hardInquiryText;
}

/**
 * Add name spelling correction language to the letter - HUMAN FIRST
 */
function applyCorrectNameSpelling(
  letterContent: string,
  payload: unknown
): string {
  const p = payload as { nameVariations?: string[]; clientLegalName?: string };

  // Build the list of wrong names if provided
  let nameList = "";
  if (p.nameVariations && p.nameVariations.length > 0) {
    nameList = p.nameVariations
      .map(name => `  - "${name}"`)
      .join("\n");
  }

  const legalName = p.clientLegalName || "[my legal name]";

  const nameText = `
There's another problem I need to address. My credit file has names on it that aren't mine:

${nameList || "  - [The incorrect name variations on my report]"}

My real name is ${legalName} - that's what's on my driver's license and all my documents. These other names make me worried that someone else's information got mixed into my file. This happens more than people think, and it can really mess things up.

Please remove these wrong names and make sure my file only has my actual name on it.
`;

  // Find insertion point - before the closing/signature
  const closingIndex = letterContent.lastIndexOf("\n\nSincerely");
  const thankYouIndex = letterContent.lastIndexOf("\n\nThank you");
  const insertIndex = Math.max(closingIndex, thankYouIndex);

  if (insertIndex !== -1) {
    return (
      letterContent.slice(0, insertIndex) +
      nameText +
      letterContent.slice(insertIndex)
    );
  }

  return letterContent + nameText;
}

/**
 * Add previous address removal language to the letter - HUMAN FIRST
 */
function applyRemovePreviousAddress(
  letterContent: string,
  payload: unknown
): string {
  const p = payload as { incorrectAddresses?: string[] };

  // Build the list of wrong addresses if provided
  let addressList = "";
  if (p.incorrectAddresses && p.incorrectAddresses.length > 0) {
    addressList = p.incorrectAddresses
      .map(addr => `  - ${addr}`)
      .join("\n");
  }

  const addressText = `
I also see addresses on my credit report that I've never lived at:

${addressList || "  - [The incorrect addresses on my report]"}

I have no idea why these addresses are showing up. I've never lived there, never received mail there, nothing. This is really concerning because it might mean my credit file is mixed up with someone else's, or worse, someone could be using my information.

Please take these addresses off my report. They don't belong to me and they shouldn't be there.
`;

  // Find insertion point - before the closing/signature
  const closingIndex = letterContent.lastIndexOf("\n\nSincerely");
  const thankYouIndex = letterContent.lastIndexOf("\n\nThank you");
  const insertIndex = Math.max(closingIndex, thankYouIndex);

  if (insertIndex !== -1) {
    return (
      letterContent.slice(0, insertIndex) +
      addressText +
      letterContent.slice(insertIndex)
    );
  }

  return letterContent + addressText;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Calculate the combined effect of multiple recommendations
 */
export function calculateCombinedEffect(
  recommendations: ActionableRecommendation[]
): {
  totalPotentialGain: number;
  appliedGain: number;
  remainingGain: number;
} {
  const applied = recommendations.filter((r) => r.status === "APPLIED");
  const pending = recommendations.filter((r) => r.status === "PENDING");

  // Gains don't simply add - there's diminishing returns
  const appliedGain = applied.reduce((sum, r) => sum + r.potentialGainValue * 0.8, 0);
  const remainingGain = pending.reduce((sum, r) => sum + r.potentialGainValue * 0.7, 0);
  const totalPotentialGain = Math.min(0.35, appliedGain + remainingGain);

  return {
    totalPotentialGain,
    appliedGain,
    remainingGain,
  };
}

/**
 * Create an applied recommendations tracker
 */
export function createAppliedRecommendationsTracker(
  disputeId: string,
  originalContent: string
): AppliedRecommendations {
  return {
    disputeId,
    originalLetterContent: originalContent,
    currentLetterContent: originalContent,
    appliedRecommendations: [],
  };
}

/**
 * Update the tracker after applying a recommendation
 */
export function updateAppliedRecommendationsTracker(
  tracker: AppliedRecommendations,
  recommendationId: string,
  newContent: string
): AppliedRecommendations {
  return {
    ...tracker,
    currentLetterContent: newContent,
    appliedRecommendations: [
      ...tracker.appliedRecommendations,
      {
        recommendationId,
        appliedAt: new Date(),
        letterContentAfter: newContent,
      },
    ],
  };
}
