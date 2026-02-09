/**
 * AMELIA HUMAN-FIRST TEMPLATES
 *
 * Human-first letter templates for AMELIA dispute generation.
 * These follow the same structure as Sentry mode:
 *
 * 1. STORY (2-3 sentences of real-life impact)
 * 2. ISSUE (simple statement of what's wrong)
 * 3. DEMAND (clear request for action)
 * 4. FOOTER (legal stuff at the end, like fine print)
 *
 * Key principles:
 * - 8th-11th grade reading level
 * - Sounds like a real person, not a lawyer
 * - Story leads, legal follows
 * - Frustration escalates naturally with rounds
 */

import type { FlowType } from "./amelia-templates";

// =============================================================================
// TYPES
// =============================================================================

export interface HumanFirstAmeliaTemplate {
  id: string;
  flow: FlowType;
  round: number;
  targetType: "CRA" | "FURNISHER" | "COLLECTOR";
  name: string;
  description: string;

  // Story configuration for AI generation
  storyContext: {
    frustrationLevel: 1 | 2 | 3 | 4;
    toneDescription: string;
  };

  // Simple issue templates by dispute type
  issueTemplates: {
    notMine: string;
    inaccurate: string;
    paid: string;
    collection: string;
    tooOld: string;
    latePayment: string;
    balance: string;
  };

  // Demand text (escalates with rounds)
  demandText: string;

  // Legal footer (at end, like fine print)
  legalFooter: string;

  // Round 2+ opening reference
  followUpOpening?: string;

  // For compliance (not shown in letter)
  statute: string;
  legalCitations: string[];
}

// =============================================================================
// TEMPLATE VARIABLES
// =============================================================================

export const HUMAN_TEMPLATE_VARIABLES = {
  CLIENT_NAME: "{{CLIENT_NAME}}",
  CLIENT_ADDRESS: "{{CLIENT_ADDRESS}}",
  CLIENT_CITY_STATE_ZIP: "{{CLIENT_CITY_STATE_ZIP}}",
  CLIENT_SSN_LAST4: "{{CLIENT_SSN_LAST4}}",
  BUREAU_NAME: "{{BUREAU_NAME}}",
  BUREAU_ADDRESS: "{{BUREAU_ADDRESS}}",
  CURRENT_DATE: "{{CURRENT_DATE}}",
  CREDITOR_NAME: "{{CREDITOR_NAME}}",
  ACCOUNT_NUMBER: "{{ACCOUNT_NUMBER}}",
  ACCOUNT_LIST: "{{ACCOUNT_LIST}}",
  STORY: "{{STORY}}",
  PREVIOUS_DISPUTE_DATE: "{{PREVIOUS_DISPUTE_DATE}}",
  DEBT_COLLECTOR_NAME: "{{DEBT_COLLECTOR_NAME}}",
} as const;

// =============================================================================
// ACCURACY FLOW - HUMAN-FIRST TEMPLATES
// =============================================================================

const ACCURACY_HUMAN_TEMPLATES: HumanFirstAmeliaTemplate[] = [
  // Round 1 - Hopeful, explaining
  {
    id: "accuracy_human_r1",
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
      notMine: "There's an account from {{CREDITOR_NAME}} on my credit report that I've never seen before. I don't recognize this account and I've never had business with them.",
      inaccurate: "The information showing for my {{CREDITOR_NAME}} account isn't right. The details don't match what I have in my records.",
      paid: "My {{CREDITOR_NAME}} account is showing like I still owe money, but I paid this off. I have my records showing it was paid.",
      collection: "There's a collection from {{CREDITOR_NAME}} on my report and something about it doesn't look right.",
      tooOld: "This {{CREDITOR_NAME}} account is really old and I thought it should have fallen off my report by now. It's been more than 7 years.",
      latePayment: "The {{CREDITOR_NAME}} account is showing late payments that don't match my payment records. I've never been late on this account.",
      balance: "The balance showing for {{CREDITOR_NAME}} is wrong. My records show a different amount than what's on your report.",
    },
    demandText: `I'm asking you to please look into this and correct it. I've included copies of my ID and a utility bill showing where I live.

Thank you for your help.`,
    legalFooter: `---
Your rights: Under the Fair Credit Reporting Act, you have 30 days to investigate my dispute. If you can't verify the information is accurate, you have to correct or remove it.`,
    statute: "FCRA Maximum Accuracy",
    legalCitations: ["15 USC 1681i(a)(1)(A)", "15 USC 1681e(b)"],
  },

  // Round 2 - Frustrated, referencing previous attempt
  {
    id: "accuracy_human_r2",
    flow: "ACCURACY",
    round: 2,
    targetType: "CRA",
    name: "Something is wrong - Round 2",
    description: "Second dispute - frustrated, nothing changed",
    storyContext: {
      frustrationLevel: 2,
      toneDescription: "Frustrated but still patient - tried once already",
    },
    followUpOpening: "I'm writing again about an issue I already disputed on {{PREVIOUS_DISPUTE_DATE}}. I got your response, but the problem is still there.",
    issueTemplates: {
      notMine: "I already told you - this {{CREDITOR_NAME}} account is not mine. I don't know why it's still on my report after I disputed it.",
      inaccurate: "The {{CREDITOR_NAME}} account is still showing wrong information even after I disputed it. Nothing has changed.",
      paid: "I disputed this {{CREDITOR_NAME}} account because I paid it off, and it's still showing like I owe money. This isn't right.",
      collection: "This {{CREDITOR_NAME}} collection is still on my report with the same wrong information. Nothing changed from my last dispute.",
      tooOld: "I already disputed this old {{CREDITOR_NAME}} account and it's still there. It's way past the 7-year mark.",
      latePayment: "The late payments I disputed on {{CREDITOR_NAME}} are still showing. I sent you my payment records proving I was never late.",
      balance: "The wrong balance on {{CREDITOR_NAME}} is still showing. I proved in my last dispute what the correct amount should be.",
    },
    demandText: `I really need this fixed. Can you please do a more thorough investigation this time? The wrong information is still hurting my credit.

I'm including my ID again and proof of my address.

Thank you.`,
    legalFooter: `---
Your rights: Under the Fair Credit Reporting Act, you have 30 days to investigate. You can't just accept whatever the company tells you without actually checking if it's true.`,
    statute: "15 USC 1681e(b)",
    legalCitations: ["15 USC 1681i(a)(1)(A)", "15 USC 1681i(a)(2)", "15 USC 1681e(b)"],
  },

  // Round 3 - Angry but controlled
  {
    id: "accuracy_human_r3",
    flow: "ACCURACY",
    round: 3,
    targetType: "CRA",
    name: "Something is wrong - Round 3",
    description: "Third dispute - angry but controlled",
    storyContext: {
      frustrationLevel: 3,
      toneDescription: "Angry but controlled - considering escalation",
    },
    followUpOpening: "This is the third time I'm disputing this issue. I first contacted you on {{PREVIOUS_DISPUTE_DATE}} and nothing has been fixed.",
    issueTemplates: {
      notMine: "I've told you multiple times now - this {{CREDITOR_NAME}} account is NOT MINE. How many times do I have to say this?",
      inaccurate: "Three disputes later and the {{CREDITOR_NAME}} information is still wrong. This is ridiculous.",
      paid: "I keep telling you I PAID this {{CREDITOR_NAME}} account and you keep telling me it's verified. Did anyone actually check?",
      collection: "This {{CREDITOR_NAME}} collection has been disputed three times. The information is still wrong. What kind of investigation are you doing?",
      tooOld: "How is this ancient {{CREDITOR_NAME}} account still on my report? I've disputed it multiple times. It's clearly past the reporting limit.",
      latePayment: "Three times I've disputed these fake late payments on {{CREDITOR_NAME}}. I have proof I paid on time. Why won't you look at it?",
      balance: "For the third time - the balance on {{CREDITOR_NAME}} is WRONG. I've sent you documentation. What more do you need?",
    },
    demandText: `I'm running out of patience. This has been going on for too long and it's affecting my life in real ways.

I need this resolved NOW. If this can't be fixed through your dispute process, I'm going to have to look at other options including filing a complaint with the Consumer Financial Protection Bureau.

I'm attaching my documentation again.`,
    legalFooter: `---
Your rights: The law requires you to conduct a real investigation, not just rubber-stamp whatever the creditor says. I have the right to file complaints with the CFPB and to consult with an attorney about my options.`,
    statute: "15 USC 1681i(a)(5)",
    legalCitations: ["15 USC 1681i(a)(1)(A)", "15 USC 1681i(a)(2)", "15 USC 1681n", "15 USC 1681o"],
  },

  // Round 4 - Final warning
  {
    id: "accuracy_human_r4",
    flow: "ACCURACY",
    round: 4,
    targetType: "CRA",
    name: "Something is wrong - Round 4",
    description: "Fourth dispute - exhausted, final warning",
    storyContext: {
      frustrationLevel: 4,
      toneDescription: "Exhausted but determined - this is the last straw",
    },
    followUpOpening: "This is my FOURTH dispute about this same issue. I first contacted you on {{PREVIOUS_DISPUTE_DATE}}. Four times. Same problem. Still not fixed.",
    issueTemplates: {
      notMine: "For the fourth time: this {{CREDITOR_NAME}} account. Is. Not. Mine. I don't know how else to say it.",
      inaccurate: "Four disputes. The {{CREDITOR_NAME}} information is still wrong. I've done everything I'm supposed to do.",
      paid: "I have disputed this {{CREDITOR_NAME}} account four times because I PAID IT. I have proof. Why won't you fix this?",
      collection: "Fourth dispute about this {{CREDITOR_NAME}} collection. Still wrong. Still damaging my credit. Still no real investigation.",
      tooOld: "Fourth dispute. This {{CREDITOR_NAME}} account is ancient history. It should have been removed years ago.",
      latePayment: "Four times. Same fake late payments on {{CREDITOR_NAME}}. Same proof I paid on time. Same refusal to fix it.",
      balance: "Four disputes about the wrong balance on {{CREDITOR_NAME}}. I've sent proof every single time. Nothing changes.",
    },
    demandText: `I've tried to work with you. I've been patient. I've sent documentation. I've disputed this four times now.

I am filing a complaint with the Consumer Financial Protection Bureau about how this has been handled. I am also consulting with an attorney to understand my legal options.

This needs to be resolved immediately.`,
    legalFooter: `---
The Fair Credit Reporting Act gives me rights that I intend to exercise fully. I have the right to sue for damages if you've willfully or negligently failed to comply with the law.`,
    statute: "15 USC 1681i(a)(1)(a)",
    legalCitations: ["15 USC 1681i(a)(1)(A)", "15 USC 1681n", "15 USC 1681o"],
  },
];

// =============================================================================
// COLLECTION FLOW - HUMAN-FIRST TEMPLATES
// =============================================================================

const COLLECTION_HUMAN_TEMPLATES: HumanFirstAmeliaTemplate[] = [
  // Round 1 - Questioning the debt
  {
    id: "collection_human_r1",
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
      inaccurate: "This collection from {{CREDITOR_NAME}} has wrong information. The amount and dates don't look right.",
      paid: "I see a collection from {{CREDITOR_NAME}} but I already paid the original debt. This shouldn't be here.",
      collection: "There's a collection account from {{CREDITOR_NAME}} that doesn't look right. I'm not even sure what it's supposed to be for.",
      tooOld: "This {{CREDITOR_NAME}} collection is really old. It looks like it's past the time when it should even be on my report.",
      latePayment: "This collection from {{CREDITOR_NAME}} is showing payment history that doesn't match any records I have.",
      balance: "The amount showing on this {{CREDITOR_NAME}} collection doesn't match what the original debt was for.",
    },
    demandText: `Please investigate this collection. I need to know:
- What is this debt actually for?
- Who was the original creditor?
- When did I supposedly owe this?

I've included my ID and proof of address.`,
    legalFooter: `---
Your rights: Under the law, you have 30 days to investigate this dispute. Collection accounts need to have accurate information just like any other account.`,
    statute: "15 USC 1692g",
    legalCitations: ["15 USC 1681i(a)(1)(A)", "15 USC 1681s-2(a)(1)", "15 USC 1692g"],
  },

  // Round 2 - Demanding answers
  {
    id: "collection_human_r2",
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
      inaccurate: "The {{CREDITOR_NAME}} collection still has wrong information. Nothing changed from my first dispute.",
      paid: "I already paid what I owed to the original creditor. This {{CREDITOR_NAME}} collection shouldn't exist.",
      collection: "This {{CREDITOR_NAME}} collection is still showing the same problems I disputed before. The information isn't accurate.",
      tooOld: "This old {{CREDITOR_NAME}} collection is still on my report after I disputed it. It's way too old to be reported.",
      latePayment: "The payment history on this {{CREDITOR_NAME}} collection is still wrong after my dispute.",
      balance: "The wrong amount is still showing for this {{CREDITOR_NAME}} collection. I proved what the actual debt was.",
    },
    demandText: `I need a real investigation this time. Not just asking the collector if they think it's accurate.

Can they prove:
- The original debt was valid?
- They have the right to collect it?
- The amount and dates are correct?

If they can't prove it, it needs to come off my report.`,
    legalFooter: `---
Your rights: You can't just verify the debt by asking the collector. The law requires a real investigation to make sure the information is actually accurate.`,
    statute: "15 USC 1692g",
    legalCitations: ["15 USC 1681i(a)(1)(A)", "15 USC 1681i(a)(2)", "15 USC 1681c(a)", "15 USC 1692g"],
  },

  // Round 3 - Fed up
  {
    id: "collection_human_r3",
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
      inaccurate: "Still wrong after three disputes. The {{CREDITOR_NAME}} collection information is still inaccurate.",
      paid: "How many times do I have to tell you? I PAID the original debt. This {{CREDITOR_NAME}} collection should not exist.",
      collection: "Three disputes about {{CREDITOR_NAME}}. Still wrong information. Still hurting my credit. Still no real investigation.",
      tooOld: "This {{CREDITOR_NAME}} collection is so old it should have been removed automatically. Three disputes later, still there.",
      latePayment: "Three times I've disputed the wrong payment history on {{CREDITOR_NAME}}. It's still there with the same errors.",
      balance: "For the third time - the amount on this {{CREDITOR_NAME}} collection is wrong. I have documentation. Why won't you look at it?",
    },
    demandText: `I'm done waiting. This collection has damaged my credit for too long.

If you can't verify this debt with actual proof - not just the collector's word - then it needs to be removed.

I'm considering filing a complaint with the CFPB about how this has been handled.`,
    legalFooter: `---
Your rights: I have the right to accurate reporting. If a debt can't be properly verified, it must be deleted. I also have the right to file complaints and consult an attorney.`,
    statute: "15 USC 1681s-2(b)",
    legalCitations: ["15 USC 1681i(a)(1)(A)", "15 USC 1681i(a)(2)", "15 USC 1681n", "15 USC 1681o", "15 USC 1692g"],
  },

  // Round 4 - Final warning
  {
    id: "collection_human_r4",
    flow: "COLLECTION",
    round: 4,
    targetType: "CRA",
    name: "Collection dispute - Round 4",
    description: "Fourth collection dispute - final warning",
    storyContext: {
      frustrationLevel: 4,
      toneDescription: "Exhausted and determined - last chance before legal action",
    },
    followUpOpening: "Fourth and final dispute about this {{CREDITOR_NAME}} collection. This started on {{PREVIOUS_DISPUTE_DATE}}. I've been patient. I'm done waiting.",
    issueTemplates: {
      notMine: "Four times. This {{CREDITOR_NAME}} collection is not my debt. I've said it every possible way. Delete it.",
      inaccurate: "Fourth dispute. The {{CREDITOR_NAME}} collection is still wrong. I've proven it. You've ignored it.",
      paid: "I paid the original debt. This {{CREDITOR_NAME}} collection is invalid. Four disputes and you still won't fix it.",
      collection: "This {{CREDITOR_NAME}} collection has been wrong since day one. Four disputes later and it's still destroying my credit.",
      tooOld: "Four disputes about this ancient {{CREDITOR_NAME}} collection. It's years past when it should have been removed.",
      latePayment: "Four times I've disputed the fake payment history on {{CREDITOR_NAME}}. Same errors. Same damage to my credit.",
      balance: "The amount on {{CREDITOR_NAME}} has been wrong through four disputes. I've sent proof every time. Nothing changes.",
    },
    demandText: `This is my final attempt to resolve this through the dispute process.

I am filing a complaint with the Consumer Financial Protection Bureau. I am consulting with an attorney about violations of the Fair Credit Reporting Act and the Fair Debt Collection Practices Act.

Remove this collection immediately or I will pursue all legal options available to me.`,
    legalFooter: `---
The law is clear: unverifiable debts must be deleted. Debt collectors who violate the FDCPA face serious penalties. I intend to pursue every remedy available to me.`,
    statute: "15 USC 1681s-2(b) & 1692g",
    legalCitations: ["15 USC 1681i(a)(1)(A)", "15 USC 1681n", "15 USC 1681o", "15 USC 1692g", "15 USC 1692k"],
  },
];

// =============================================================================
// CONSENT FLOW - HUMAN-FIRST TEMPLATES
// =============================================================================

const CONSENT_HUMAN_TEMPLATES: HumanFirstAmeliaTemplate[] = [
  // Round 1 - Alarmed
  {
    id: "consent_human_r1",
    flow: "CONSENT",
    round: 1,
    targetType: "CRA",
    name: "Unauthorized account - Round 1",
    description: "First unauthorized account dispute",
    storyContext: {
      frustrationLevel: 1,
      toneDescription: "Alarmed - found something I didn't agree to",
    },
    issueTemplates: {
      notMine: "There's a {{CREDITOR_NAME}} account on my report that I never opened. I didn't apply for this and I don't know how it got there.",
      inaccurate: "The {{CREDITOR_NAME}} account shows information I never agreed to. This was opened without my permission.",
      paid: "This {{CREDITOR_NAME}} account was never something I authorized. I don't know why it exists.",
      collection: "There's a collection from {{CREDITOR_NAME}} for something I never agreed to in the first place.",
      tooOld: "This {{CREDITOR_NAME}} account is not only unauthorized, it's also very old.",
      latePayment: "This {{CREDITOR_NAME}} account that I never authorized is showing late payments for something I never agreed to.",
      balance: "There's a balance showing for {{CREDITOR_NAME}} but I never authorized this account in the first place.",
    },
    demandText: `I need you to investigate whether this company actually had permission to:
- Pull my credit report
- Open an account in my name
- Report this account

I did not give that permission.

Enclosed is my ID and proof of address.`,
    legalFooter: `---
Your rights: Under the law, companies can only access your credit report for specific reasons. If they didn't have proper permission, the account shouldn't be on your report.`,
    statute: "15 USC 1681b",
    legalCitations: ["15 USC 1681b", "15 USC 1681i(a)(1)(A)"],
  },

  // Round 2 - Still dealing with it
  {
    id: "consent_human_r2",
    flow: "CONSENT",
    round: 2,
    targetType: "CRA",
    name: "Unauthorized account - Round 2",
    description: "Second unauthorized account dispute",
    storyContext: {
      frustrationLevel: 2,
      toneDescription: "Frustrated - still dealing with unauthorized account",
    },
    followUpOpening: "I disputed this {{CREDITOR_NAME}} account on {{PREVIOUS_DISPUTE_DATE}} because I never authorized it. It's still on my report.",
    issueTemplates: {
      notMine: "I already told you - this {{CREDITOR_NAME}} account is not mine. I never opened it. Why is it still showing?",
      inaccurate: "The unauthorized {{CREDITOR_NAME}} account is still there with wrong information.",
      paid: "I never authorized this {{CREDITOR_NAME}} account in the first place. Why am I still seeing it?",
      collection: "This {{CREDITOR_NAME}} collection is for something I never authorized. It's still on my report after my dispute.",
      tooOld: "This old {{CREDITOR_NAME}} account that I never authorized is still showing up.",
      latePayment: "This unauthorized {{CREDITOR_NAME}} account is still showing fake late payments.",
      balance: "I never authorized this {{CREDITOR_NAME}} account and there's still a balance showing.",
    },
    demandText: `Did you actually ask them to prove they had my permission? Because they don't have it.

If they can't show proof that I authorized this account, it needs to be removed immediately.

I'm getting really frustrated that this unauthorized account is still hurting my credit.`,
    legalFooter: `---
Your rights: Companies need a valid reason (permissible purpose) to access your credit and report accounts. No valid reason = no right to report.`,
    statute: "15 USC 1681b",
    legalCitations: ["15 USC 1681b", "15 USC 1681i(a)(1)(A)", "15 USC 1681i(a)(2)"],
  },

  // Round 3 - Final
  {
    id: "consent_human_r3",
    flow: "CONSENT",
    round: 3,
    targetType: "CRA",
    name: "Unauthorized account - Round 3",
    description: "Third unauthorized account dispute - final",
    storyContext: {
      frustrationLevel: 3,
      toneDescription: "Angry - this unauthorized account won't go away",
    },
    followUpOpening: "Third dispute about this {{CREDITOR_NAME}} account that I NEVER authorized. Started disputing on {{PREVIOUS_DISPUTE_DATE}}. Still on my report.",
    issueTemplates: {
      notMine: "THREE TIMES I've told you - I never authorized {{CREDITOR_NAME}}. Never opened it. Never agreed to it. It's not mine.",
      inaccurate: "This unauthorized {{CREDITOR_NAME}} account is still there with information I never agreed to.",
      paid: "I never authorized {{CREDITOR_NAME}} and yet it's still on my report after three disputes.",
      collection: "This {{CREDITOR_NAME}} collection is for something I never consented to. Three disputes and nothing changes.",
      tooOld: "This unauthorized, ancient {{CREDITOR_NAME}} account is STILL on my report after three disputes.",
      latePayment: "Three disputes about this unauthorized {{CREDITOR_NAME}} account and its fake late payments. Still there.",
      balance: "I never authorized {{CREDITOR_NAME}}. There should be no balance because there should be no account.",
    },
    demandText: `This is unacceptable. I never authorized this account. I've told you three times. I've provided proof of identity three times.

If you can't show me signed authorization, remove this account NOW.

I am filing a CFPB complaint and consulting with an attorney about unauthorized access to my credit report.`,
    legalFooter: `---
Accessing someone's credit report without permission is a serious violation. I intend to pursue all legal remedies including damages under the FCRA.`,
    statute: "15 USC 1681b & 1681i",
    legalCitations: ["15 USC 1681b", "15 USC 1681i(a)(1)(A)", "15 USC 1681n", "15 USC 1681o"],
  },
];

// =============================================================================
// COMBO FLOW - HUMAN-FIRST TEMPLATES
// =============================================================================

const COMBO_HUMAN_TEMPLATES: HumanFirstAmeliaTemplate[] = [
  // Round 1 - Multiple issues discovered
  {
    id: "combo_human_r1",
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
      inaccurate: "There are several errors on my credit report. The {{CREDITOR_NAME}} account has wrong information.",
      paid: "I've found multiple problems on my report. The {{CREDITOR_NAME}} account shows I owe money when I actually paid it.",
      collection: "My credit report has several issues including a questionable collection from {{CREDITOR_NAME}}.",
      tooOld: "I'm finding old accounts that shouldn't be on my report anymore, including one from {{CREDITOR_NAME}}.",
      latePayment: "Multiple accounts are showing late payments that don't match my records, including {{CREDITOR_NAME}}.",
      balance: "Several accounts have wrong balances, including {{CREDITOR_NAME}} which shows an amount I don't owe.",
    },
    demandText: `I just reviewed my credit report and found several problems. I've listed the accounts above that need to be investigated.

Please look into each one and correct the errors. I've included my ID and a utility bill.

Thank you for your help with this.`,
    legalFooter: `---
Your rights: Under the Fair Credit Reporting Act, you have 30 days to investigate all the items I'm disputing. Information that can't be verified must be corrected or removed.`,
    statute: "FCRA Maximum Accuracy",
    legalCitations: ["15 USC 1681i(a)(1)(A)", "15 USC 1681e(b)", "15 USC 1681s-2(a)(1)"],
  },

  // Round 2 - Multiple issues still not fixed
  {
    id: "combo_human_r2",
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
      inaccurate: "The errors I disputed are still on my report. The {{CREDITOR_NAME}} information is still wrong.",
      paid: "I told you about accounts I paid that are showing incorrectly. {{CREDITOR_NAME}} is still one of them.",
      collection: "The collection issues I disputed, including {{CREDITOR_NAME}}, haven't been properly addressed.",
      tooOld: "Old accounts I disputed are still on my report. {{CREDITOR_NAME}} is one that should have been removed.",
      latePayment: "The late payment errors I disputed are still showing, including on {{CREDITOR_NAME}}.",
      balance: "Wrong balances I disputed are still on my report, including {{CREDITOR_NAME}}.",
    },
    demandText: `I already went through this process once. Some of the issues weren't fixed properly.

I need each of these accounts investigated again - and I mean really investigated, not just asking the creditors if they think it's right.

This is affecting my ability to do normal things like get approved for housing and loans.`,
    legalFooter: `---
Your rights: The law requires a real investigation, not just confirming what the creditor says. I have the right to accurate reporting and to pursue further action if needed.`,
    statute: "15 USC 1681e(b) & 1681i(a)(5)",
    legalCitations: ["15 USC 1681i(a)(1)(A)", "15 USC 1681i(a)(2)", "15 USC 1681e(b)", "15 USC 1681s-2(a)(1)"],
  },

  // Round 3 - Fed up with multiple issues
  {
    id: "combo_human_r3",
    flow: "COMBO",
    round: 3,
    targetType: "CRA",
    name: "Multiple issues - Round 3",
    description: "Third dispute with multiple issues",
    storyContext: {
      frustrationLevel: 3,
      toneDescription: "Fed up - these errors keep damaging credit",
    },
    followUpOpening: "Third dispute about these same issues. Started on {{PREVIOUS_DISPUTE_DATE}}. Multiple errors remain unfixed.",
    issueTemplates: {
      notMine: "Three times now - accounts that aren't mine, including {{CREDITOR_NAME}}, are still on my report.",
      inaccurate: "Three disputes. The same errors on {{CREDITOR_NAME}} and other accounts. Nothing fixed.",
      paid: "I've told you three times about paid accounts showing balances. {{CREDITOR_NAME}} is still wrong.",
      collection: "Three disputes about these collections including {{CREDITOR_NAME}}. Still inaccurate. Still damaging my credit.",
      tooOld: "These old accounts including {{CREDITOR_NAME}} should have been removed long ago. Three disputes and they're still there.",
      latePayment: "Three times I've disputed fake late payments including on {{CREDITOR_NAME}}. All still showing.",
      balance: "Three disputes about wrong balances including {{CREDITOR_NAME}}. Nothing has been corrected.",
    },
    demandText: `This is the third time I'm going through this. Multiple accounts. Same errors. No real action.

I'm filing a complaint with the Consumer Financial Protection Bureau about the handling of my disputes.

Fix ALL of these accounts or I will pursue legal action.`,
    legalFooter: `---
Your rights: Repeated failure to investigate disputes is a violation of the FCRA. I have the right to pursue damages for willful or negligent noncompliance.`,
    statute: "15 USC 1681e(b) & 1681i(a)(1)(a)",
    legalCitations: ["15 USC 1681i(a)(1)(A)", "15 USC 1681i(a)(2)", "15 USC 1681n", "15 USC 1681o"],
  },

  // Round 4 - Final warning
  {
    id: "combo_human_r4",
    flow: "COMBO",
    round: 4,
    targetType: "CRA",
    name: "Multiple issues - Round 4",
    description: "Fourth dispute - final warning",
    storyContext: {
      frustrationLevel: 4,
      toneDescription: "Exhausted - last chance before legal action",
    },
    followUpOpening: "Fourth and final dispute. Multiple errors have remained on my report since {{PREVIOUS_DISPUTE_DATE}}. I'm done waiting.",
    issueTemplates: {
      notMine: "Four disputes. Accounts that aren't mine including {{CREDITOR_NAME}} are STILL on my report.",
      inaccurate: "Four times. Same errors on {{CREDITOR_NAME}} and others. You've had every chance to fix this.",
      paid: "Fourth dispute. Paid accounts including {{CREDITOR_NAME}} still showing balances. I'm done explaining.",
      collection: "Four disputes about these invalid collections including {{CREDITOR_NAME}}. Final warning.",
      tooOld: "Fourth time disputing old accounts like {{CREDITOR_NAME}} that should have been removed years ago.",
      latePayment: "Four disputes about fake late payments including {{CREDITOR_NAME}}. Remove them or face consequences.",
      balance: "Fourth dispute about wrong balances including {{CREDITOR_NAME}}. Last chance to correct them.",
    },
    demandText: `I have been patient. I have provided documentation. I have disputed these accounts FOUR times.

CFPB complaint has been filed. Attorney consultation is scheduled.

This is your final opportunity to correct these errors before I pursue all legal remedies available under federal law.`,
    legalFooter: `---
The Fair Credit Reporting Act provides for actual damages, statutory damages up to $1,000 per violation, punitive damages for willful noncompliance, and attorney's fees. I intend to pursue every remedy.`,
    statute: "15 USC 1681e(b) & 1681i & 1681s-2(b)",
    legalCitations: ["15 USC 1681i(a)(1)(A)", "15 USC 1681n", "15 USC 1681o", "15 USC 1681s-2(b)"],
  },
];

// =============================================================================
// EXPORTS
// =============================================================================

export const HUMAN_FIRST_AMELIA_TEMPLATES: HumanFirstAmeliaTemplate[] = [
  ...ACCURACY_HUMAN_TEMPLATES,
  ...COLLECTION_HUMAN_TEMPLATES,
  ...CONSENT_HUMAN_TEMPLATES,
  ...COMBO_HUMAN_TEMPLATES,
];

/**
 * Get human-first template for a specific flow and round
 */
export function getHumanFirstAmeliaTemplate(
  flow: FlowType,
  round: number
): HumanFirstAmeliaTemplate | undefined {
  // Find matching template
  const template = HUMAN_FIRST_AMELIA_TEMPLATES.find(
    (t) => t.flow === flow && t.round === round
  );

  if (template) {
    return template;
  }

  // Fall back to highest available round for this flow
  const flowTemplates = HUMAN_FIRST_AMELIA_TEMPLATES.filter((t) => t.flow === flow);
  if (flowTemplates.length === 0) {
    return undefined;
  }

  // Sort by round descending and return highest that's <= requested round
  flowTemplates.sort((a, b) => b.round - a.round);
  return flowTemplates.find((t) => t.round <= round) || flowTemplates[0];
}

/**
 * Get all human-first templates for a flow
 */
export function getHumanFirstAmeliaTemplatesForFlow(
  flow: FlowType
): HumanFirstAmeliaTemplate[] {
  return HUMAN_FIRST_AMELIA_TEMPLATES.filter((t) => t.flow === flow);
}

/**
 * Get the issue template for a specific issue type
 */
export function getHumanIssueTemplate(
  template: HumanFirstAmeliaTemplate,
  issueType: keyof HumanFirstAmeliaTemplate["issueTemplates"]
): string {
  return template.issueTemplates[issueType] || template.issueTemplates.inaccurate;
}

/**
 * Determine issue type from account issues
 */
export function determineIssueType(
  issues: Array<{ code: string; description?: string }>
): keyof HumanFirstAmeliaTemplate["issueTemplates"] {
  if (!issues || issues.length === 0) {
    return "inaccurate";
  }

  const primaryIssue = issues[0].code.toUpperCase();

  if (primaryIssue.includes("NOT_MINE") || primaryIssue.includes("UNKNOWN")) {
    return "notMine";
  }
  if (primaryIssue.includes("PAID") || primaryIssue.includes("SETTLED")) {
    return "paid";
  }
  if (primaryIssue.includes("COLLECTION") || primaryIssue.includes("CHARGEOFF")) {
    return "collection";
  }
  if (primaryIssue.includes("OLD") || primaryIssue.includes("EXPIRED") || primaryIssue.includes("7_YEAR")) {
    return "tooOld";
  }
  if (primaryIssue.includes("LATE") || primaryIssue.includes("PAYMENT") || primaryIssue.includes("DELINQ")) {
    return "latePayment";
  }
  if (primaryIssue.includes("BALANCE") || primaryIssue.includes("AMOUNT")) {
    return "balance";
  }

  return "inaccurate";
}
