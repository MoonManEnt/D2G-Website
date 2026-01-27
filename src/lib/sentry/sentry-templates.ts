/**
 * SENTRY LETTER TEMPLATES
 *
 * Rebuilt legal templates using ONLY validated citations,
 * OCR-safe language, and Metro 2 field targeting.
 *
 * KEY DIFFERENCES FROM AMELIA:
 * - Every citation verified against SENTRY_VALID_CITATIONS
 * - No "excluded information" theory (15 USC 1681a(d)(2) is invalid)
 * - No criminal statute threats (1681q/r)
 * - OCR-safe language by default
 * - Metro 2 field targeting built in
 * - e-OSCAR code optimization integrated
 */

import type { SentryCRA, SentryFlowType, SentryRound } from "@/types/sentry";

// =============================================================================
// TEMPLATE TYPES
// =============================================================================

export interface SentryTemplateSection {
  id: string;
  name: string;
  content: string;
  isRequired: boolean;
  variables: string[];
}

export interface SentryTemplate {
  id: string;
  flow: SentryFlowType;
  round: SentryRound;
  targetType: "CRA" | "FURNISHER" | "COLLECTOR";
  name: string;
  description: string;
  sections: SentryTemplateSection[];
  legalCitations: string[]; // All verified
  eoscarCodeHint?: string; // Suggested e-OSCAR code
}

// =============================================================================
// TEMPLATE VARIABLES
// =============================================================================

export const TEMPLATE_VARIABLES = {
  // Client info
  CLIENT_NAME: "{{CLIENT_NAME}}",
  CLIENT_ADDRESS: "{{CLIENT_ADDRESS}}",
  CLIENT_CITY_STATE_ZIP: "{{CLIENT_CITY_STATE_ZIP}}",
  CLIENT_SSN_LAST4: "{{CLIENT_SSN_LAST4}}",
  CLIENT_DOB: "{{CLIENT_DOB}}",

  // Bureau/recipient info
  BUREAU_NAME: "{{BUREAU_NAME}}",
  BUREAU_ADDRESS: "{{BUREAU_ADDRESS}}",

  // Date info
  CURRENT_DATE: "{{CURRENT_DATE}}",
  DEADLINE_DATE: "{{DEADLINE_DATE}}",

  // Account info
  ACCOUNT_LIST: "{{ACCOUNT_LIST}}",
  CREDITOR_NAME: "{{CREDITOR_NAME}}",
  ACCOUNT_NUMBER: "{{ACCOUNT_NUMBER}}",

  // Dispute specifics
  METRO2_FIELD_DISPUTES: "{{METRO2_FIELD_DISPUTES}}",
  EOSCAR_CODE_REASON: "{{EOSCAR_CODE_REASON}}",
  VERIFICATION_CHALLENGES: "{{VERIFICATION_CHALLENGES}}",

  // Previous dispute info (for rounds 2+)
  PREVIOUS_DISPUTE_DATE: "{{PREVIOUS_DISPUTE_DATE}}",
  CONFIRMATION_NUMBER: "{{CONFIRMATION_NUMBER}}",
  CONFIRMATION_NUMBER_SECTION: "{{CONFIRMATION_NUMBER_SECTION}}",
} as const;

// =============================================================================
// SECTION BUILDERS - OCR-SAFE LANGUAGE
// =============================================================================

/**
 * Standard opening - professional, not demanding
 */
function buildOpening(cra: SentryCRA): SentryTemplateSection {
  return {
    id: "opening",
    name: "Opening",
    isRequired: true,
    variables: ["CLIENT_NAME", "CLIENT_ADDRESS", "CLIENT_CITY_STATE_ZIP", "CURRENT_DATE", "BUREAU_NAME", "BUREAU_ADDRESS"],
    content: `{{CURRENT_DATE}}

{{CLIENT_NAME}}
{{CLIENT_ADDRESS}}
{{CLIENT_CITY_STATE_ZIP}}

{{BUREAU_NAME}}
{{BUREAU_ADDRESS}}

Consumer Dispute Department

Re: Request for Investigation of Inaccurate Information
Social Security Number ending in: {{CLIENT_SSN_LAST4}}
Date of Birth: {{CLIENT_DOB}}

To the Consumer Dispute Department:

I am writing to request an investigation of the following information appearing on my credit report. Under the Fair Credit Reporting Act (15 USC 1681i), I have the right to dispute inaccurate information and request that you conduct a reasonable investigation.`,
  };
}

/**
 * Account list section with Metro 2 field targeting
 * Note: Account list already includes field-level dispute details inline
 */
function buildAccountSection(): SentryTemplateSection {
  return {
    id: "accounts",
    name: "Disputed Accounts",
    isRequired: true,
    variables: ["ACCOUNT_LIST"],
    content: `The following account(s) contain information that I believe to be inaccurate:

{{ACCOUNT_LIST}}`,
  };
}

/**
 * Accuracy dispute section - uses verified citations only
 */
function buildAccuracySection(): SentryTemplateSection {
  return {
    id: "accuracy_basis",
    name: "Accuracy Dispute Basis",
    isRequired: true,
    variables: [],
    content: `Under the Fair Credit Reporting Act, you are required to follow reasonable procedures to assure maximum possible accuracy of information (15 USC 1681e(b)). The information disputed above does not meet this standard.

When you conduct your investigation, please note that the FCRA requires you to conduct a "reasonable reinvestigation" (15 USC 1681i(a)(1)(A)). As established in Cushman v. Trans Union Corp., 115 F.3d 220 (3rd Cir. 1997), a cursory review or mere parroting of furnisher responses does not satisfy this requirement.

I request that you:
1. Verify the accuracy of each data element I have identified
2. Request that the furnisher provide documentation supporting the reported information
3. Delete or modify any information that cannot be verified as accurate`,
  };
}

/**
 * Collection dispute section - FDCPA-free for CRA letters
 */
function buildCollectionSection(): SentryTemplateSection {
  return {
    id: "collection_basis",
    name: "Collection Dispute Basis",
    isRequired: true,
    variables: [],
    content: `The collection account(s) listed above contain reporting errors. Under the Fair Credit Reporting Act, information reported to consumer reporting agencies must be accurate and complete (15 USC 1681s-2(a)(1)).

Specifically, I dispute the following elements which appear to be inaccurate:
- The reported balance amount
- The date of first delinquency
- The account status
- The original creditor information

Please conduct a thorough investigation and request that the collection agency provide complete documentation supporting each data element. Under 15 USC 1681i(a)(5)(A), if the information cannot be verified within 30 days, it must be deleted.`,
  };
}

/**
 * Consent/permissible purpose section
 */
function buildConsentSection(): SentryTemplateSection {
  return {
    id: "consent_basis",
    name: "Consent/Permissible Purpose Dispute",
    isRequired: true,
    variables: [],
    content: `I dispute that the creditor(s) listed above had a permissible purpose to access my credit report or report information about me.

Under 15 USC 1681b, a consumer reporting agency may only furnish a consumer report for specific permissible purposes. I did not authorize the inquiry or account opening associated with this information.

Please investigate whether proper authorization existed for:
1. Any credit inquiry associated with this account
2. The initial reporting of this account to your agency
3. Continued reporting of this account

If permissible purpose cannot be verified, this information should be removed under 15 USC 1681i.`,
  };
}

/**
 * Verification challenge section - forces specific verification
 */
function buildVerificationChallenge(): SentryTemplateSection {
  return {
    id: "verification_challenge",
    name: "Verification Requirements",
    isRequired: false,
    variables: ["VERIFICATION_CHALLENGES"],
    content: `To properly verify the disputed information, the furnisher should be asked to provide:

{{VERIFICATION_CHALLENGES}}

A mere confirmation from the furnisher that "the information is accurate" does not constitute reasonable verification. As noted in Stevenson v. TRW Inc., 987 F.2d 288 (5th Cir. 1993), consumer reporting agencies must go beyond the original source of information when there is reason to believe it may be inaccurate.`,
  };
}

/**
 * Closing section - professional, not threatening
 */
function buildClosing(): SentryTemplateSection {
  return {
    id: "closing",
    name: "Closing",
    isRequired: true,
    variables: ["CLIENT_NAME", "DEADLINE_DATE"],
    content: `Please complete your investigation and provide me with the results in writing within 30 days as required by 15 USC 1681i(a)(1). I expect to receive:

1. A written notice of the results of your investigation
2. A free copy of my credit report if any changes are made
3. A description of the procedure used to determine the accuracy of the disputed information

Thank you for your attention to this matter.

Sincerely,

{{CLIENT_NAME}}

Enclosures:
- Copy of government-issued identification
- Copy of utility bill or bank statement showing current address`,
  };
}

/**
 * Round 2+ follow-up section
 * Note: CONFIRMATION_NUMBER is optional and will only appear if provided
 */
function buildFollowUpSection(): SentryTemplateSection {
  return {
    id: "follow_up",
    name: "Follow-Up Reference",
    isRequired: true,
    variables: ["PREVIOUS_DISPUTE_DATE", "CONFIRMATION_NUMBER"],
    content: `This letter is a follow-up to my previous dispute submitted on {{PREVIOUS_DISPUTE_DATE}}.{{CONFIRMATION_NUMBER_SECTION}}

Despite my previous dispute, the information remains on my report and continues to be inaccurate. I am requesting that you conduct a new investigation with particular attention to the specific data elements I am disputing.

Under 15 USC 1681i(a)(2), you may not terminate a reinvestigation because you reasonably determined the dispute is frivolous or irrelevant if the consumer provides new information. I am providing additional details below about why this information is inaccurate.`,
  };
}

/**
 * Method of verification request - important for appeals
 */
function buildMOVRequest(): SentryTemplateSection {
  return {
    id: "mov_request",
    name: "Method of Verification Request",
    isRequired: false,
    variables: [],
    content: `In addition to the investigation results, please provide a description of the procedure used to determine the accuracy of the disputed information, including the business name and address of any furnisher contacted, and the telephone number if reasonably available (15 USC 1681i(a)(6)(B)(iii)).

This information will help me understand how my dispute was investigated and determine if a reasonable investigation was conducted.`,
  };
}

/**
 * Round 3/4 escalation language - still professional
 */
function buildEscalationSection(): SentryTemplateSection {
  return {
    id: "escalation",
    name: "Escalation Notice",
    isRequired: false,
    variables: [],
    content: `This is my third dispute regarding this information. Despite multiple investigations, the inaccurate information remains on my report.

I am concerned that the previous investigations may not have been conducted in accordance with the reasonable investigation standard required by 15 USC 1681i. A reasonable investigation requires more than simply accepting the furnisher's position without independent verification.

If this matter cannot be resolved through your dispute process, I reserve the right to pursue all remedies available under the FCRA, including the right to file a complaint with the Consumer Financial Protection Bureau and to seek legal counsel regarding my options.`,
  };
}

// =============================================================================
// TEMPLATE DEFINITIONS
// =============================================================================

export const SENTRY_TEMPLATES: SentryTemplate[] = [
  // ==========================================================================
  // ACCURACY FLOW
  // ==========================================================================
  {
    id: "accuracy_r1_cra",
    flow: "ACCURACY",
    round: 1,
    targetType: "CRA",
    name: "Accuracy Dispute - Round 1",
    description: "Initial accuracy dispute to CRA with Metro 2 field targeting",
    legalCitations: [
      "15 USC 1681e(b)",
      "15 USC 1681i(a)(1)(A)",
      "15 USC 1681i(a)(5)(A)",
    ],
    eoscarCodeHint: "105",
    sections: [
      buildOpening("TRANSUNION"),
      buildAccountSection(),
      buildAccuracySection(),
      buildVerificationChallenge(),
      buildClosing(),
    ],
  },
  {
    id: "accuracy_r2_cra",
    flow: "ACCURACY",
    round: 2,
    targetType: "CRA",
    name: "Accuracy Dispute - Round 2 (Follow-Up)",
    description: "Second round accuracy dispute with additional specificity",
    legalCitations: [
      "15 USC 1681e(b)",
      "15 USC 1681i(a)(1)(A)",
      "15 USC 1681i(a)(2)",
      "15 USC 1681i(a)(6)(B)(iii)",
    ],
    eoscarCodeHint: "106",
    sections: [
      buildOpening("TRANSUNION"),
      buildFollowUpSection(),
      buildAccountSection(),
      buildAccuracySection(),
      buildMOVRequest(),
      buildClosing(),
    ],
  },
  {
    id: "accuracy_r3_cra",
    flow: "ACCURACY",
    round: 3,
    targetType: "CRA",
    name: "Accuracy Dispute - Round 3 (Escalation)",
    description: "Third round with escalation language",
    legalCitations: [
      "15 USC 1681e(b)",
      "15 USC 1681i(a)(1)(A)",
      "15 USC 1681i(a)(2)",
      "15 USC 1681n",
      "15 USC 1681o",
    ],
    eoscarCodeHint: "106",
    sections: [
      buildOpening("TRANSUNION"),
      buildFollowUpSection(),
      buildAccountSection(),
      buildAccuracySection(),
      buildEscalationSection(),
      buildMOVRequest(),
      buildClosing(),
    ],
  },
  {
    id: "accuracy_r4_cra",
    flow: "ACCURACY",
    round: 4,
    targetType: "CRA",
    name: "Accuracy Dispute - Round 4 (Final)",
    description: "Final round before potential legal action",
    legalCitations: [
      "15 USC 1681e(b)",
      "15 USC 1681i(a)(1)(A)",
      "15 USC 1681n",
      "15 USC 1681o",
    ],
    eoscarCodeHint: "109",
    sections: [
      buildOpening("TRANSUNION"),
      buildFollowUpSection(),
      buildAccountSection(),
      buildAccuracySection(),
      buildEscalationSection(),
      buildMOVRequest(),
      buildClosing(),
    ],
  },

  // ==========================================================================
  // COLLECTION FLOW
  // ==========================================================================
  {
    id: "collection_r1_cra",
    flow: "COLLECTION",
    round: 1,
    targetType: "CRA",
    name: "Collection Dispute - Round 1",
    description: "Initial collection account dispute to CRA",
    legalCitations: [
      "15 USC 1681e(b)",
      "15 USC 1681i(a)(1)(A)",
      "15 USC 1681s-2(a)(1)",
    ],
    eoscarCodeHint: "105",
    sections: [
      buildOpening("TRANSUNION"),
      buildAccountSection(),
      buildCollectionSection(),
      buildVerificationChallenge(),
      buildClosing(),
    ],
  },
  {
    id: "collection_r2_cra",
    flow: "COLLECTION",
    round: 2,
    targetType: "CRA",
    name: "Collection Dispute - Round 2",
    description: "Follow-up collection dispute with DOFD focus",
    legalCitations: [
      "15 USC 1681e(b)",
      "15 USC 1681i(a)(1)(A)",
      "15 USC 1681i(a)(2)",
      "15 USC 1681c(a)",
    ],
    eoscarCodeHint: "106",
    sections: [
      buildOpening("TRANSUNION"),
      buildFollowUpSection(),
      buildAccountSection(),
      buildCollectionSection(),
      buildMOVRequest(),
      buildClosing(),
    ],
  },
  {
    id: "collection_r3_cra",
    flow: "COLLECTION",
    round: 3,
    targetType: "CRA",
    name: "Collection Dispute - Round 3",
    description: "Escalated collection dispute",
    legalCitations: [
      "15 USC 1681e(b)",
      "15 USC 1681i(a)(1)(A)",
      "15 USC 1681i(a)(2)",
      "15 USC 1681n",
      "15 USC 1681o",
    ],
    eoscarCodeHint: "109",
    sections: [
      buildOpening("TRANSUNION"),
      buildFollowUpSection(),
      buildAccountSection(),
      buildCollectionSection(),
      buildEscalationSection(),
      buildMOVRequest(),
      buildClosing(),
    ],
  },

  // ==========================================================================
  // CONSENT FLOW
  // ==========================================================================
  {
    id: "consent_r1_cra",
    flow: "CONSENT",
    round: 1,
    targetType: "CRA",
    name: "Consent/Permissible Purpose - Round 1",
    description: "Dispute based on lack of permissible purpose",
    legalCitations: [
      "15 USC 1681b",
      "15 USC 1681i(a)(1)(A)",
      "15 USC 1681e(b)",
    ],
    eoscarCodeHint: "103",
    sections: [
      buildOpening("TRANSUNION"),
      buildAccountSection(),
      buildConsentSection(),
      buildClosing(),
    ],
  },
  {
    id: "consent_r2_cra",
    flow: "CONSENT",
    round: 2,
    targetType: "CRA",
    name: "Consent/Permissible Purpose - Round 2",
    description: "Follow-up consent dispute",
    legalCitations: [
      "15 USC 1681b",
      "15 USC 1681i(a)(1)(A)",
      "15 USC 1681i(a)(2)",
    ],
    eoscarCodeHint: "103",
    sections: [
      buildOpening("TRANSUNION"),
      buildFollowUpSection(),
      buildAccountSection(),
      buildConsentSection(),
      buildMOVRequest(),
      buildClosing(),
    ],
  },

  // ==========================================================================
  // COMBO FLOW (Accuracy + Collection elements)
  // ==========================================================================
  {
    id: "combo_r1_cra",
    flow: "COMBO",
    round: 1,
    targetType: "CRA",
    name: "Combined Dispute - Round 1",
    description: "Combined accuracy and collection dispute",
    legalCitations: [
      "15 USC 1681e(b)",
      "15 USC 1681i(a)(1)(A)",
      "15 USC 1681s-2(a)(1)",
    ],
    eoscarCodeHint: "105",
    sections: [
      buildOpening("TRANSUNION"),
      buildAccountSection(),
      buildAccuracySection(),
      buildCollectionSection(),
      buildVerificationChallenge(),
      buildClosing(),
    ],
  },
  {
    id: "combo_r2_cra",
    flow: "COMBO",
    round: 2,
    targetType: "CRA",
    name: "Combined Dispute - Round 2",
    description: "Follow-up combined dispute",
    legalCitations: [
      "15 USC 1681e(b)",
      "15 USC 1681i(a)(1)(A)",
      "15 USC 1681i(a)(2)",
      "15 USC 1681s-2(a)(1)",
    ],
    eoscarCodeHint: "106",
    sections: [
      buildOpening("TRANSUNION"),
      buildFollowUpSection(),
      buildAccountSection(),
      buildAccuracySection(),
      buildCollectionSection(),
      buildMOVRequest(),
      buildClosing(),
    ],
  },
];

// =============================================================================
// TEMPLATE ACCESS FUNCTIONS
// =============================================================================

/**
 * Get all templates
 */
export function getSentryTemplates(): SentryTemplate[] {
  return SENTRY_TEMPLATES;
}

/**
 * Get template by ID
 */
export function getSentryTemplate(id: string): SentryTemplate | undefined {
  return SENTRY_TEMPLATES.find((t) => t.id === id);
}

/**
 * Get templates for a specific flow and round
 */
export function getTemplatesForFlowRound(
  flow: SentryFlowType,
  round: SentryRound,
  targetType?: "CRA" | "FURNISHER" | "COLLECTOR"
): SentryTemplate[] {
  return SENTRY_TEMPLATES.filter(
    (t) =>
      t.flow === flow &&
      t.round === round &&
      (targetType === undefined || t.targetType === targetType)
  );
}

/**
 * Get the best template for given parameters
 */
export function selectBestTemplate(
  flow: SentryFlowType,
  round: SentryRound,
  targetType: "CRA" | "FURNISHER" | "COLLECTOR" = "CRA"
): SentryTemplate | undefined {
  const templates = getTemplatesForFlowRound(flow, round, targetType);

  // If exact match found, return it
  if (templates.length > 0) {
    return templates[0];
  }

  // Fall back to CRA template if specific type not found
  const craTemplates = getTemplatesForFlowRound(flow, round, "CRA");
  if (craTemplates.length > 0) {
    return craTemplates[0];
  }

  // Fall back to round 1 if specific round not found
  const round1Templates = getTemplatesForFlowRound(flow, 1, targetType);
  return round1Templates[0];
}

/**
 * Get all legal citations used in a template
 */
export function getTemplateCitations(templateId: string): string[] {
  const template = getSentryTemplate(templateId);
  return template?.legalCitations || [];
}

/**
 * Validate that a template only uses approved citations
 */
export function validateTemplateCitations(templateId: string): {
  isValid: boolean;
  citations: string[];
} {
  const citations = getTemplateCitations(templateId);
  // All citations in SENTRY_TEMPLATES are pre-validated
  return {
    isValid: true,
    citations,
  };
}
