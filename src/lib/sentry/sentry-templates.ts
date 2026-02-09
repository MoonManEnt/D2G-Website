/**
 * SENTRY LETTER TEMPLATES - HUMAN-FIRST DESIGN
 *
 * Letters that sound like real people wrote them:
 * 1. Story first (AI-generated impact)
 * 2. Simple issue statement
 * 3. Clear demand
 * 4. Legal footer (minimal, at end)
 *
 * e-OSCAR compliance is maintained behind the scenes.
 */

import type { SentryFlowType, SentryRound } from "@/types/sentry";

// =============================================================================
// TEMPLATE TYPES
// =============================================================================

export interface HumanFirstTemplate {
  id: string;
  flow: SentryFlowType;
  round: SentryRound;
  targetType: "CRA" | "FURNISHER" | "COLLECTOR";
  name: string;
  description: string;

  // Story configuration
  storyContext: {
    frustrationLevel: 1 | 2 | 3 | 4; // Escalates with round
    toneDescription: string;
  };

  // Simple issue templates by dispute type
  issueTemplates: {
    notMine: string;
    inaccurate: string;
    paid: string;
    collection: string;
    tooOld: string;
    unauthorized: string;
    duplicate?: string; // Optional for duplicate disputes
  };

  // Demand text
  demandText: string;

  // Legal footer
  legalFooter: string;

  // Round-specific opening (for R2+)
  followUpOpening?: string;

  // Hidden compliance data (not shown in letter)
  eoscarCodeHint: string;
  legalCitations: string[]; // For backend validation
}

// Keep old interface for backward compatibility during transition
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
  legalCitations: string[];
  eoscarCodeHint?: string;
}

// =============================================================================
// TEMPLATE VARIABLES (simplified)
// =============================================================================

export const TEMPLATE_VARIABLES = {
  CLIENT_NAME: "{{CLIENT_NAME}}",
  CLIENT_ADDRESS: "{{CLIENT_ADDRESS}}",
  CLIENT_CITY_STATE_ZIP: "{{CLIENT_CITY_STATE_ZIP}}",
  CLIENT_SSN_LAST4: "{{CLIENT_SSN_LAST4}}",
  CLIENT_DOB: "{{CLIENT_DOB}}",
  BUREAU_NAME: "{{BUREAU_NAME}}",
  BUREAU_ADDRESS: "{{BUREAU_ADDRESS}}",
  CURRENT_DATE: "{{CURRENT_DATE}}",
  DEADLINE_DATE: "{{DEADLINE_DATE}}",
  ACCOUNT_LIST: "{{ACCOUNT_LIST}}",
  CREDITOR_NAME: "{{CREDITOR_NAME}}",
  ACCOUNT_NUMBER: "{{ACCOUNT_NUMBER}}",
  // Legacy variables (kept for backward compat but minimally used)
  METRO2_FIELD_DISPUTES: "{{METRO2_FIELD_DISPUTES}}",
  EOSCAR_CODE_REASON: "{{EOSCAR_CODE_REASON}}",
  VERIFICATION_CHALLENGES: "{{VERIFICATION_CHALLENGES}}",
  PREVIOUS_DISPUTE_DATE: "{{PREVIOUS_DISPUTE_DATE}}",
  CONFIRMATION_NUMBER: "{{CONFIRMATION_NUMBER}}",
  CONFIRMATION_NUMBER_SECTION: "{{CONFIRMATION_NUMBER_SECTION}}",
  // New variables
  STORY: "{{STORY}}",
  ISSUE_STATEMENT: "{{ISSUE_STATEMENT}}",
} as const;

// =============================================================================
// HUMAN-FIRST TEMPLATES
// =============================================================================

export const HUMAN_FIRST_TEMPLATES: HumanFirstTemplate[] = [
  // ==========================================================================
  // ACCURACY FLOW
  // ==========================================================================
  {
    id: "accuracy_r1_human",
    flow: "ACCURACY",
    round: 1,
    targetType: "CRA",
    name: "Something is wrong - Round 1",
    description: "First dispute - hopeful, explaining the situation",
    storyContext: {
      frustrationLevel: 1,
      toneDescription: "Hopeful and explaining - just discovered the problem",
    },
    issueTemplates: {
      notMine: "There's an account from {{CREDITOR_NAME}} on my credit report that I've never seen before. I don't recognize this account and I've never done business with this company.",
      inaccurate: "The information showing for my {{CREDITOR_NAME}} account isn't right. {{ISSUE_DETAILS}}",
      paid: "My {{CREDITOR_NAME}} account is showing like I still owe money, but I paid this off. I have my records showing it was paid.",
      collection: "There's a collection from {{CREDITOR_NAME}} on my report and something about it doesn't look right. {{ISSUE_DETAILS}}",
      tooOld: "This {{CREDITOR_NAME}} account is really old and I thought it should have fallen off my report by now. It's been more than 7 years.",
      unauthorized: "I never authorized this {{CREDITOR_NAME}} account. I didn't open this and didn't give permission for it.",
    },
    demandText: `I'm asking you to please look into this and correct it. I've included copies of my ID and a utility bill showing where I live.

Thank you for your help.`,
    legalFooter: `---
Your rights: Under the Fair Credit Reporting Act, you have 30 days to investigate my dispute. If you can't verify the information is accurate, you have to correct or remove it.`,
    eoscarCodeHint: "105",
    legalCitations: ["15 USC 1681i(a)(1)(A)", "15 USC 1681e(b)"],
  },

  {
    id: "accuracy_r2_human",
    flow: "ACCURACY",
    round: 2,
    targetType: "CRA",
    name: "Something is wrong - Round 2",
    description: "Second dispute - frustrated, referencing previous attempt",
    storyContext: {
      frustrationLevel: 2,
      toneDescription: "Frustrated but still patient - they tried once already",
    },
    followUpOpening: "I'm writing again about an issue I already disputed on {{PREVIOUS_DISPUTE_DATE}}. I got your response, but the problem is still there.",
    issueTemplates: {
      notMine: "I already told you - this {{CREDITOR_NAME}} account is not mine. I don't know why it's still on my report after I disputed it.",
      inaccurate: "The {{CREDITOR_NAME}} account is still showing wrong information even after I disputed it. {{ISSUE_DETAILS}}",
      paid: "I disputed this {{CREDITOR_NAME}} account because I paid it off, and it's still showing like I owe money. This isn't right.",
      collection: "This {{CREDITOR_NAME}} collection is still on my report with the same wrong information. Nothing changed from my last dispute.",
      tooOld: "I already disputed this old {{CREDITOR_NAME}} account and it's still there. It's way past the 7-year mark.",
      unauthorized: "I told you before - I never authorized this {{CREDITOR_NAME}} account. Why is it still on my report?",
    },
    demandText: `I really need this fixed. Can you please do a more thorough investigation this time? The wrong information is still hurting my credit.

I'm including my ID again and proof of my address.

Thank you.`,
    legalFooter: `---
Your rights: Under the Fair Credit Reporting Act, you have 30 days to investigate. You can't just accept whatever the company tells you without actually checking if it's true.`,
    eoscarCodeHint: "106",
    legalCitations: ["15 USC 1681i(a)(1)(A)", "15 USC 1681i(a)(2)", "15 USC 1681e(b)"],
  },

  {
    id: "accuracy_r3_human",
    flow: "ACCURACY",
    round: 3,
    targetType: "CRA",
    name: "Something is wrong - Round 3",
    description: "Third dispute - angry but controlled, considering other options",
    storyContext: {
      frustrationLevel: 3,
      toneDescription: "Angry but controlled - considering escalation",
    },
    followUpOpening: "This is the third time I'm disputing this issue. I first contacted you on {{PREVIOUS_DISPUTE_DATE}} and nothing has been fixed.",
    issueTemplates: {
      notMine: "I've told you multiple times now - this {{CREDITOR_NAME}} account is NOT MINE. How many times do I have to say this?",
      inaccurate: "Three disputes later and the {{CREDITOR_NAME}} information is still wrong. {{ISSUE_DETAILS}} This is ridiculous.",
      paid: "I keep telling you I PAID this {{CREDITOR_NAME}} account and you keep telling me it's verified. Did anyone actually check?",
      collection: "This {{CREDITOR_NAME}} collection has been disputed three times. The information is still wrong. What kind of investigation are you doing?",
      tooOld: "How is this ancient {{CREDITOR_NAME}} account still on my report? I've disputed it multiple times. It's clearly past the reporting limit.",
      unauthorized: "I have never - not once - authorized this {{CREDITOR_NAME}} account. Three disputes and it's still there. This is unacceptable.",
    },
    demandText: `I'm running out of patience. This has been going on for too long and it's affecting my life in real ways.

I need this resolved NOW. If this can't be fixed through your dispute process, I'm going to have to look at other options including filing a complaint with the Consumer Financial Protection Bureau.

I'm attaching my documentation again.`,
    legalFooter: `---
Your rights: The law requires you to conduct a real investigation, not just rubber-stamp whatever the creditor says. I have the right to file complaints with the CFPB and to consult with an attorney about my options.`,
    eoscarCodeHint: "106",
    legalCitations: ["15 USC 1681i(a)(1)(A)", "15 USC 1681i(a)(2)", "15 USC 1681n", "15 USC 1681o"],
  },

  {
    id: "accuracy_r4_human",
    flow: "ACCURACY",
    round: 4,
    targetType: "CRA",
    name: "Something is wrong - Round 4",
    description: "Final dispute - exhausted, final warning",
    storyContext: {
      frustrationLevel: 4,
      toneDescription: "Exhausted but determined - this is the last straw",
    },
    followUpOpening: "This is my FOURTH dispute about this same issue. I first contacted you on {{PREVIOUS_DISPUTE_DATE}}. Four times. Same problem. Still not fixed.",
    issueTemplates: {
      notMine: "For the fourth time: this {{CREDITOR_NAME}} account. Is. Not. Mine. I don't know how else to say it.",
      inaccurate: "Four disputes. The {{CREDITOR_NAME}} information is still wrong. {{ISSUE_DETAILS}} I've done everything I'm supposed to do.",
      paid: "I have disputed this {{CREDITOR_NAME}} account four times because I PAID IT. I have proof. Why won't you fix this?",
      collection: "Fourth dispute about this {{CREDITOR_NAME}} collection. Still wrong. Still damaging my credit. Still no real investigation.",
      tooOld: "Fourth dispute. This {{CREDITOR_NAME}} account is ancient history. It should have been removed years ago.",
      unauthorized: "I've said it four times now: I never authorized {{CREDITOR_NAME}}. Never. I'm done explaining this.",
    },
    demandText: `I've tried to work with you. I've been patient. I've sent documentation. I've disputed this four times now.

I am filing a complaint with the Consumer Financial Protection Bureau about how this has been handled. I am also consulting with an attorney to understand my legal options.

This needs to be resolved immediately.`,
    legalFooter: `---
The Fair Credit Reporting Act gives me rights that I intend to exercise fully. I have the right to sue for damages if you've willfully or negligently failed to comply with the law.`,
    eoscarCodeHint: "109",
    legalCitations: ["15 USC 1681i(a)(1)(A)", "15 USC 1681n", "15 USC 1681o"],
  },

  // ==========================================================================
  // COLLECTION FLOW
  // ==========================================================================
  {
    id: "collection_r1_human",
    flow: "COLLECTION",
    round: 1,
    targetType: "CRA",
    name: "Collection dispute - Round 1",
    description: "First collection dispute - questioning the debt",
    storyContext: {
      frustrationLevel: 1,
      toneDescription: "Confused and concerned - who is this collector?",
    },
    issueTemplates: {
      notMine: "There's a collection from {{CREDITOR_NAME}} on my report and I have no idea what it's for. I don't recognize this debt.",
      inaccurate: "This collection from {{CREDITOR_NAME}} has wrong information. {{ISSUE_DETAILS}}",
      paid: "I see a collection from {{CREDITOR_NAME}} but I already paid the original debt. This shouldn't be here.",
      collection: "There's a collection account from {{CREDITOR_NAME}} that doesn't look right. The amount seems wrong and I'm not even sure what it's supposed to be for.",
      tooOld: "This {{CREDITOR_NAME}} collection is really old. It looks like it's past the time when it should even be on my report.",
      unauthorized: "I never agreed to anything with {{CREDITOR_NAME}}. I don't know where this collection came from.",
    },
    demandText: `Please investigate this collection. I need to know:
- What is this debt actually for?
- Who was the original creditor?
- When did I supposedly owe this?

I've included my ID and proof of address.`,
    legalFooter: `---
Your rights: Under the law, you have 30 days to investigate this dispute. Collection accounts need to have accurate information just like any other account.`,
    eoscarCodeHint: "105",
    legalCitations: ["15 USC 1681i(a)(1)(A)", "15 USC 1681s-2(a)(1)"],
  },

  {
    id: "collection_r2_human",
    flow: "COLLECTION",
    round: 2,
    targetType: "CRA",
    name: "Collection dispute - Round 2",
    description: "Second collection dispute - demanding answers",
    storyContext: {
      frustrationLevel: 2,
      toneDescription: "Frustrated - still no real answers about this debt",
    },
    followUpOpening: "I disputed this collection from {{CREDITOR_NAME}} on {{PREVIOUS_DISPUTE_DATE}} and I still don't have real answers.",
    issueTemplates: {
      notMine: "I told you before - I don't recognize this {{CREDITOR_NAME}} collection. It's still on my report. Did anyone actually investigate?",
      inaccurate: "The {{CREDITOR_NAME}} collection still has wrong information. {{ISSUE_DETAILS}} Nothing changed from my first dispute.",
      paid: "I already paid what I owed to the original creditor. This {{CREDITOR_NAME}} collection shouldn't exist.",
      collection: "This {{CREDITOR_NAME}} collection is still showing the same problems I disputed before. The information isn't accurate.",
      tooOld: "This old {{CREDITOR_NAME}} collection is still on my report after I disputed it. It's way too old to be reported.",
      unauthorized: "I never had any agreement with {{CREDITOR_NAME}}. I disputed this before and it's still there.",
    },
    demandText: `I need a real investigation this time. Not just asking the collector if they think it's accurate.

Can they prove:
- The original debt was valid?
- They have the right to collect it?
- The amount and dates are correct?

If they can't prove it, it needs to come off my report.`,
    legalFooter: `---
Your rights: You can't just verify the debt by asking the collector. The law requires a real investigation to make sure the information is actually accurate.`,
    eoscarCodeHint: "106",
    legalCitations: ["15 USC 1681i(a)(1)(A)", "15 USC 1681i(a)(2)", "15 USC 1681c(a)"],
  },

  {
    id: "collection_r3_human",
    flow: "COLLECTION",
    round: 3,
    targetType: "CRA",
    name: "Collection dispute - Round 3",
    description: "Third collection dispute - fed up",
    storyContext: {
      frustrationLevel: 3,
      toneDescription: "Fed up - this questionable collection keeps hurting credit",
    },
    followUpOpening: "Third dispute about this {{CREDITOR_NAME}} collection. I started this on {{PREVIOUS_DISPUTE_DATE}} and nothing has been properly resolved.",
    issueTemplates: {
      notMine: "Three times I've disputed this {{CREDITOR_NAME}} collection. Three times I've told you it's not mine. Three times nothing changes.",
      inaccurate: "Still wrong after three disputes. The {{CREDITOR_NAME}} collection information is still inaccurate. {{ISSUE_DETAILS}}",
      paid: "How many times do I have to tell you? I PAID the original debt. This {{CREDITOR_NAME}} collection should not exist.",
      collection: "Three disputes about {{CREDITOR_NAME}}. Still wrong information. Still hurting my credit. Still no real investigation.",
      tooOld: "This {{CREDITOR_NAME}} collection is so old it should have been removed automatically. Three disputes later, still there.",
      unauthorized: "I've never authorized anything with {{CREDITOR_NAME}}. Three disputes. Still on my report. This is not acceptable.",
    },
    demandText: `I'm done waiting. This collection has damaged my credit for too long.

If you can't verify this debt with actual proof - not just the collector's word - then it needs to be removed.

I'm considering filing a complaint with the CFPB about how this has been handled.`,
    legalFooter: `---
Your rights: I have the right to accurate reporting. If a debt can't be properly verified, it must be deleted. I also have the right to file complaints and consult an attorney.`,
    eoscarCodeHint: "109",
    legalCitations: ["15 USC 1681i(a)(1)(A)", "15 USC 1681i(a)(2)", "15 USC 1681n", "15 USC 1681o"],
  },

  // ==========================================================================
  // CONSENT FLOW
  // ==========================================================================
  {
    id: "consent_r1_human",
    flow: "CONSENT",
    round: 1,
    targetType: "CRA",
    name: "I didn't authorize this - Round 1",
    description: "First unauthorized account dispute",
    storyContext: {
      frustrationLevel: 1,
      toneDescription: "Alarmed - found something I didn't agree to",
    },
    issueTemplates: {
      notMine: "There's a {{CREDITOR_NAME}} account on my report that I never opened. I didn't apply for this and I don't know how it got there.",
      inaccurate: "The {{CREDITOR_NAME}} account shows information I never agreed to. {{ISSUE_DETAILS}}",
      paid: "This {{CREDITOR_NAME}} account was never something I authorized. I don't know why it exists.",
      collection: "There's a collection from {{CREDITOR_NAME}} for something I never agreed to in the first place.",
      tooOld: "This {{CREDITOR_NAME}} account is not only unauthorized, it's also very old.",
      unauthorized: "I never - repeat NEVER - authorized the {{CREDITOR_NAME}} account on my credit report. I didn't apply for it, sign for it, or agree to it in any way.",
    },
    demandText: `I need you to investigate whether this company actually had permission to:
- Pull my credit report
- Open an account in my name
- Report this account

I did not give that permission.

Enclosed is my ID and proof of address.`,
    legalFooter: `---
Your rights: Under the law, companies can only access your credit report for specific reasons. If they didn't have proper permission, the account shouldn't be on your report.`,
    eoscarCodeHint: "103",
    legalCitations: ["15 USC 1681b", "15 USC 1681i(a)(1)(A)"],
  },

  {
    id: "consent_r2_human",
    flow: "CONSENT",
    round: 2,
    targetType: "CRA",
    name: "I didn't authorize this - Round 2",
    description: "Second unauthorized account dispute",
    storyContext: {
      frustrationLevel: 2,
      toneDescription: "Frustrated - still dealing with unauthorized account",
    },
    followUpOpening: "I disputed this {{CREDITOR_NAME}} account on {{PREVIOUS_DISPUTE_DATE}} because I never authorized it. It's still on my report.",
    issueTemplates: {
      notMine: "I already told you - this {{CREDITOR_NAME}} account is not mine. I never opened it. Why is it still showing?",
      inaccurate: "The unauthorized {{CREDITOR_NAME}} account is still there with wrong information. {{ISSUE_DETAILS}}",
      paid: "I never authorized this {{CREDITOR_NAME}} account in the first place. Why am I still seeing it?",
      collection: "This {{CREDITOR_NAME}} collection is for something I never authorized. It's still on my report after my dispute.",
      tooOld: "This old {{CREDITOR_NAME}} account that I never authorized is still showing up.",
      unauthorized: "Second dispute: I DID NOT AUTHORIZE this {{CREDITOR_NAME}} account. How can it still be on my report?",
    },
    demandText: `Did you actually ask them to prove they had my permission? Because they don't have it.

If they can't show proof that I authorized this account, it needs to be removed immediately.

I'm getting really frustrated that this unauthorized account is still hurting my credit.`,
    legalFooter: `---
Your rights: Companies need a valid reason (permissible purpose) to access your credit and report accounts. No valid reason = no right to report.`,
    eoscarCodeHint: "103",
    legalCitations: ["15 USC 1681b", "15 USC 1681i(a)(1)(A)", "15 USC 1681i(a)(2)"],
  },

  // ==========================================================================
  // COMBO FLOW
  // ==========================================================================
  {
    id: "combo_r1_human",
    flow: "COMBO",
    round: 1,
    targetType: "CRA",
    name: "Multiple issues - Round 1",
    description: "First dispute with multiple issues",
    storyContext: {
      frustrationLevel: 1,
      toneDescription: "Overwhelmed - found multiple problems at once",
    },
    issueTemplates: {
      notMine: "Looking at my credit report, I found multiple accounts that don't belong to me, including one from {{CREDITOR_NAME}}.",
      inaccurate: "There are several errors on my credit report. The {{CREDITOR_NAME}} account has wrong information. {{ISSUE_DETAILS}}",
      paid: "I've found multiple problems on my report. For example, the {{CREDITOR_NAME}} account shows I owe money when I actually paid it.",
      collection: "My credit report has several issues including a questionable collection from {{CREDITOR_NAME}}.",
      tooOld: "I'm finding old accounts that shouldn't be on my report anymore, including one from {{CREDITOR_NAME}}.",
      unauthorized: "There are accounts on my report that I never authorized, including {{CREDITOR_NAME}}.",
    },
    demandText: `I just reviewed my credit report and found several problems. I've listed the accounts above that need to be investigated.

Please look into each one and correct the errors. I've included my ID and a utility bill.

Thank you for your help with this.`,
    legalFooter: `---
Your rights: Under the Fair Credit Reporting Act, you have 30 days to investigate all the items I'm disputing. Information that can't be verified must be corrected or removed.`,
    eoscarCodeHint: "105",
    legalCitations: ["15 USC 1681i(a)(1)(A)", "15 USC 1681e(b)", "15 USC 1681s-2(a)(1)"],
  },

  {
    id: "combo_r2_human",
    flow: "COMBO",
    round: 2,
    targetType: "CRA",
    name: "Multiple issues - Round 2",
    description: "Second dispute with multiple issues",
    storyContext: {
      frustrationLevel: 2,
      toneDescription: "Frustrated - multiple problems still not fixed",
    },
    followUpOpening: "I disputed multiple items on {{PREVIOUS_DISPUTE_DATE}}. Some of the problems are still there.",
    issueTemplates: {
      notMine: "I already disputed accounts that aren't mine, including {{CREDITOR_NAME}}. Some are still showing.",
      inaccurate: "The errors I disputed are still on my report. The {{CREDITOR_NAME}} information is still wrong. {{ISSUE_DETAILS}}",
      paid: "I told you about accounts I paid that are showing incorrectly. {{CREDITOR_NAME}} is still one of them.",
      collection: "The collection issues I disputed, including {{CREDITOR_NAME}}, haven't been properly addressed.",
      tooOld: "Old accounts I disputed are still on my report. {{CREDITOR_NAME}} is one that should have been removed.",
      unauthorized: "Unauthorized accounts are still showing. {{CREDITOR_NAME}} is one I never agreed to.",
    },
    demandText: `I already went through this process once. Some of the issues weren't fixed properly.

I need each of these accounts investigated again - and I mean really investigated, not just asking the creditors if they think it's right.

This is affecting my ability to do normal things like get approved for housing and loans.`,
    legalFooter: `---
Your rights: The law requires a real investigation, not just confirming what the creditor says. I have the right to accurate reporting and to pursue further action if needed.`,
    eoscarCodeHint: "106",
    legalCitations: ["15 USC 1681i(a)(1)(A)", "15 USC 1681i(a)(2)", "15 USC 1681e(b)", "15 USC 1681s-2(a)(1)"],
  },
];

// =============================================================================
// LEGACY TEMPLATE SUPPORT (for backward compatibility during transition)
// =============================================================================

/**
 * Convert human-first template to old section-based format
 * This allows the existing generator to work while we transition
 */
function humanTemplateToSections(template: HumanFirstTemplate): SentryTemplateSection[] {
  const sections: SentryTemplateSection[] = [];

  // Opening section (simplified)
  sections.push({
    id: "opening",
    name: "Opening",
    isRequired: true,
    variables: ["CLIENT_NAME", "CLIENT_ADDRESS", "CLIENT_CITY_STATE_ZIP", "CURRENT_DATE", "BUREAU_NAME", "BUREAU_ADDRESS", "CLIENT_SSN_LAST4"],
    content: `{{CURRENT_DATE}}

{{CLIENT_NAME}}
{{CLIENT_ADDRESS}}
{{CLIENT_CITY_STATE_ZIP}}

{{BUREAU_NAME}}
{{BUREAU_ADDRESS}}

My name is {{CLIENT_NAME}} and my Social Security Number ends in {{CLIENT_SSN_LAST4}}.`,
  });

  // Follow-up section (for R2+)
  if (template.followUpOpening) {
    sections.push({
      id: "follow_up",
      name: "Follow-Up Reference",
      isRequired: true,
      variables: ["PREVIOUS_DISPUTE_DATE"],
      content: template.followUpOpening,
    });
  }

  // Story placeholder
  sections.push({
    id: "story",
    name: "Personal Impact Story",
    isRequired: true,
    variables: ["STORY"],
    content: "{{STORY}}",
  });

  // Issue statement
  sections.push({
    id: "issue",
    name: "Issue Statement",
    isRequired: true,
    variables: ["ISSUE_STATEMENT", "ACCOUNT_LIST"],
    content: "{{ISSUE_STATEMENT}}\n\n{{ACCOUNT_LIST}}",
  });

  // Demand
  sections.push({
    id: "demand",
    name: "Request",
    isRequired: true,
    variables: ["CLIENT_NAME"],
    content: `${template.demandText}

Sincerely,

{{CLIENT_NAME}}`,
  });

  // Legal footer
  sections.push({
    id: "legal_footer",
    name: "Legal Footer",
    isRequired: true,
    variables: [],
    content: template.legalFooter,
  });

  return sections;
}

/**
 * Convert all human-first templates to legacy format
 */
export const SENTRY_TEMPLATES: SentryTemplate[] = HUMAN_FIRST_TEMPLATES.map((ht) => ({
  id: ht.id,
  flow: ht.flow,
  round: ht.round,
  targetType: ht.targetType,
  name: ht.name,
  description: ht.description,
  sections: humanTemplateToSections(ht),
  legalCitations: ht.legalCitations,
  eoscarCodeHint: ht.eoscarCodeHint,
}));

// =============================================================================
// TEMPLATE ACCESS FUNCTIONS
// =============================================================================

export function getSentryTemplates(): SentryTemplate[] {
  return SENTRY_TEMPLATES;
}

export function getHumanFirstTemplates(): HumanFirstTemplate[] {
  return HUMAN_FIRST_TEMPLATES;
}

export function getSentryTemplate(id: string): SentryTemplate | undefined {
  return SENTRY_TEMPLATES.find((t) => t.id === id);
}

export function getHumanFirstTemplate(id: string): HumanFirstTemplate | undefined {
  return HUMAN_FIRST_TEMPLATES.find((t) => t.id === id);
}

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

export function getHumanTemplatesForFlowRound(
  flow: SentryFlowType,
  round: SentryRound
): HumanFirstTemplate[] {
  return HUMAN_FIRST_TEMPLATES.filter(
    (t) => t.flow === flow && t.round === round
  );
}

export function selectBestTemplate(
  flow: SentryFlowType,
  round: SentryRound,
  targetType: "CRA" | "FURNISHER" | "COLLECTOR" = "CRA"
): SentryTemplate | undefined {
  const templates = getTemplatesForFlowRound(flow, round, targetType);

  if (templates.length > 0) {
    return templates[0];
  }

  // Fall back to CRA template
  const craTemplates = getTemplatesForFlowRound(flow, round, "CRA");
  if (craTemplates.length > 0) {
    return craTemplates[0];
  }

  // Fall back to round 1
  const round1Templates = getTemplatesForFlowRound(flow, 1, targetType);
  return round1Templates[0];
}

export function selectBestHumanTemplate(
  flow: SentryFlowType,
  round: SentryRound
): HumanFirstTemplate | undefined {
  const templates = getHumanTemplatesForFlowRound(flow, round);

  if (templates.length > 0) {
    return templates[0];
  }

  // Fall back to round 1
  const round1Templates = getHumanTemplatesForFlowRound(flow, 1);
  return round1Templates[0];
}

// Alias for the generator
export const selectHumanFirstTemplate = selectBestHumanTemplate;

export function getTemplateCitations(templateId: string): string[] {
  const template = getSentryTemplate(templateId);
  return template?.legalCitations || [];
}

export function validateTemplateCitations(templateId: string): {
  isValid: boolean;
  citations: string[];
} {
  const citations = getTemplateCitations(templateId);
  return {
    isValid: true,
    citations,
  };
}

/**
 * Get the issue template for a specific dispute type
 */
export function getIssueTemplate(
  template: HumanFirstTemplate,
  disputeType: keyof HumanFirstTemplate["issueTemplates"]
): string {
  return template.issueTemplates[disputeType] || template.issueTemplates.inaccurate;
}
