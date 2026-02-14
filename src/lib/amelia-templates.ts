/**
 * AMELIA Letter Templates
 *
 * Complete template library for all dispute flows and rounds.
 * These templates follow the exact structure from the provided documents.
 *
 * STRUCTURE OPTIONS (User selectable):
 * - DAMAGES_FIRST: DAMAGES → FACTS → PENALTY (default, emotional lead)
 * - FACTS_FIRST: FACTS → DAMAGES → PENALTY (legal lead)
 *
 * STRUCTURE COMPONENTS (Internal - never shown in output):
 * - Header: Client info + CRA address + date
 * - Headline: Bold subject with statute reference
 * - DAMAGES: Opening impact paragraph (personal suffering)
 * - STORY/FACTS: Narrative with legal basis (statute violations)
 * - Account List: Items being disputed
 * - Demand: Request for deletion (escalates naturally)
 * - Consumer Statement: Emotional close with PENALTY warning
 * - Screenshots: Reference for R2+
 *
 * TONE ESCALATION:
 * R1: Polite but firm ("please follow your legal duties")
 * R2: Frustrated ("may have to pay damages")
 * R3: Fed up ("starting to contact lawyers")
 * R4: Warning ("will shake your legal department")
 * R5-7: Demanding (specific statute demands)
 * R8+: Litigation ready ("$20K-$30K loss", "Federal Court")
 *
 * RANDOMIZATION (eOSCAR Resistant):
 * - Stories are PROCEDURALLY GENERATED from 1000s of components
 * - 50+ scenarios × 100+ variables × 20+ structures = MILLIONS of unique combinations
 * - No two clients EVER receive the same letter content
 */

import type { CRA } from "@/types";

// =============================================================================
// TYPES
// =============================================================================

export type FlowType = "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO";

/**
 * Letter Structure Options
 *
 * Controls the paragraph order in the letter body:
 * - DAMAGES_FIRST: Opens with personal impact, then legal facts (default, more emotional)
 * - FACTS_FIRST: Opens with legal violations, then personal impact (more formal/legal)
 *
 * Both structures include:
 * 1. Header (client info, CRA address, date)
 * 2. Headline (subject + statute)
 * 3. [VARIES] Main body paragraphs
 * 4. Account list
 * 5. Demand section
 * 6. Consumer statement (always ends with penalty warning)
 */
export type LetterStructure = "DAMAGES_FIRST" | "FACTS_FIRST";

export const LETTER_STRUCTURE_DESCRIPTIONS: Record<LetterStructure, { name: string; description: string }> = {
  DAMAGES_FIRST: {
    name: "Emotional Lead (Recommended)",
    description: "Opens with personal impact and suffering, then presents legal facts. More persuasive for initial disputes.",
  },
  FACTS_FIRST: {
    name: "Legal Lead",
    description: "Opens with legal violations and statute citations, then describes personal impact. More formal approach.",
  },
};

/**
 * Letter Format Options
 *
 * Controls how accounts and disputed items are presented in the letter:
 * - CONVERSATIONAL: Current AMELIA style - combined sections, casual headers, colloquial
 * - STRUCTURED: PDF-style - bold section headers, separate quick list + detailed explanations
 *
 * eOSCAR Analysis:
 * - CONVERSATIONAL: Lower template detection risk, higher human authenticity
 * - STRUCTURED: Higher specificity score (detailed per-account explanations), clearer for bureau processors
 *
 * Both formats use Kitchen Table voice (6th-9th grade reading level).
 */
export type LetterFormat = "CONVERSATIONAL" | "STRUCTURED";

export const LETTER_FORMAT_DESCRIPTIONS: Record<LetterFormat, {
  name: string;
  description: string;
  eoscarRisk: "LOW" | "MEDIUM" | "HIGH";
  specificityScore: "LOW" | "MEDIUM" | "HIGH";
  recommended: boolean;
}> = {
  CONVERSATIONAL: {
    name: "Conversational",
    description: "Combined sections with casual headers. More natural, less template-like appearance.",
    eoscarRisk: "LOW",
    specificityScore: "MEDIUM",
    recommended: false,
  },
  STRUCTURED: {
    name: "Structured (Recommended)",
    description: "Bold section headers with separate account list and detailed explanations. Higher specificity forces human review.",
    eoscarRisk: "MEDIUM",
    specificityScore: "HIGH",
    recommended: true,
  },
};

/**
 * Randomized bold headers for STRUCTURED format
 * Using variations prevents eOSCAR template detection
 */
export const STRUCTURED_FORMAT_HEADERS = {
  accountList: [
    "Here is the exact information furnishing inaccurate on my {bureauName} credit report:",
    "The following accounts are reporting inaccurately on my {bureauName} file:",
    "These accounts on my {bureauName} report contain errors:",
    "I found the following inaccurate information on my {bureauName} report:",
  ],
  corrections: [
    "Requested Corrections / Deletions (If Not Verified as Accurate):",
    "Items Requiring Correction or Deletion:",
    "Accounts That Must Be Fixed or Removed:",
    "Specific Corrections Needed:",
  ],
  personalInfo: [
    "Personal Information to Investigate and Correct / Remove:",
    "Outdated Personal Information to Remove:",
    "Personal Data Requiring Investigation:",
    "Old Personal Information That Should Not Be On My File:",
  ],
  inquiries: [
    "Hard Inquiries to Investigate (Unauthorized / No Consent):",
    "Unauthorized Inquiries to Remove:",
    "Inquiries Made Without My Permission:",
    "Hard Pulls I Did Not Authorize:",
  ],
  consumerStatement: [
    "Consumer Statement:",
    "My Statement:",
    "In Closing:",
    "Final Statement:",
  ],
};

export interface TemplateVariables {
  clientFirstName: string;
  clientLastName: string;
  clientMiddleName?: string;
  clientAddress: string;
  clientCity: string;
  clientState: string;
  clientZip: string;
  ssnLast4: string;
  dateOfBirth: string;
  bureauName: string;
  bureauAddress: string;
  currentDate: string; // Formatted date (may be backdated for R1)
  lastDisputeDate?: string; // For R2+ references
  debtCollectorNames?: string[]; // For collection/combo flows
  creditorNames?: string[]; // For specific creditor references
  disputeItemsAndExplanation: string; // The account list section
}

export interface RoundTemplate {
  round: number;
  flow: FlowType;
  headline: string;
  statute: string;
  openingParagraph: string; // DAMAGES (default fallback)
  openingParagraphVariants?: string[]; // Multiple unique opening variants
  bodyParagraphs: string[]; // STORY/FACTS (default fallback)
  bodyParagraphVariants?: string[][]; // Array of variant arrays per paragraph slot
  accountListIntro?: string;
  demandSection: string;
  consumerStatement: string; // Default fallback
  consumerStatementVariants?: string[]; // Multiple unique consumer statement variants
  includesScreenshots: boolean;
}

// =============================================================================
// DEMAND LANGUAGE ESCALATION
// The key insight: "I demand" is too aggressive for R1
// =============================================================================

export const DEMAND_LANGUAGE = {
  // R1: Polite request
  R1: "I ask that you please delete the following inaccurate information from my credit report:",

  // R2: Firmer request
  R2: "I am requesting that you delete the inaccurate items from my credit report:",

  // R3: Assertive
  R3: "Please delete the following inaccurate/unverifiable information from my credit report:",

  // R4: Demanding
  R4: "If you delete the illegal information, I will not pursue damages:",

  // R5: Strong demand
  R5: "Delete the inaccurate or unverifiable information right away:",

  // R6: Urgent demand
  R6: "I suggest you delete the illegal information now to avoid further consequences:",

  // R7+: Full demand
  R7_PLUS: "I demand you delete the illegal information from my credit report:",
};

// Map round to demand language
export function getDemandLanguage(round: number): string {
  if (round === 1) return DEMAND_LANGUAGE.R1;
  if (round === 2) return DEMAND_LANGUAGE.R2;
  if (round === 3) return DEMAND_LANGUAGE.R3;
  if (round === 4) return DEMAND_LANGUAGE.R4;
  if (round === 5) return DEMAND_LANGUAGE.R5;
  if (round === 6) return DEMAND_LANGUAGE.R6;
  return DEMAND_LANGUAGE.R7_PLUS;
}

// =============================================================================
// ACCURACY FLOW TEMPLATES (R1-R11)
// =============================================================================

export const ACCURACY_TEMPLATES: Record<number, Omit<RoundTemplate, "round" | "flow">> = {
  1: {
    headline: "FACTUAL DISPUTE—Inaccurate accounts on my credit report.",
    statute: "FCRA Maximum Accuracy",
    // HARD RULE: 6th-9th grade reading level, colloquial
    openingParagraph: `Im writing because {bureauName} got wrong stuff on my credit report. This is causing me real problems. I cant get approved for nothing and its not because I dont pay my bills. Its because yall got bad info. I work hard, I handle my business, and I deserve to have my credit reported right. Something needs to change.`,
    // HARD RULE: 6th-9th grade reading level, colloquial, regional expressions
    openingParagraphVariants: [
      // Variant 1: Working parent
      `Look I work hard every day to take care of my family. Got bills to pay like everybody else. So when I got denied for a loan I knew something was up. Pulled my credit from {bureauName} and found a bunch of stuff thats just wrong. Accounts I dont recognize, balances that aint right, late payments I never made. This is messing up my life and I need it fixed.`,
      // Variant 2: First-time homebuyer
      `Been saving up for a house for years now. Finally found a place I could afford and went to get a mortgage. Got denied because of my credit. Looked at what {bureauName} got on me and I couldnt believe it. Half this stuff aint even mine and the rest is wrong. I did everything right and your bad info is keeping me from my dream.`,
      // Variant 3: Starting over
      `Going through some changes in my life and trying to get back on my feet. Last thing I needed was to find out {bureauName} got wrong info on my credit. I checked my report and its like looking at somebody elses file. The accounts are wrong, the amounts dont match, none of it is right. I need this fixed so I can move on with my life.`,
      // Variant 4: Small business owner
      `I run a small business and credit is how I keep the lights on. When I got turned down for a business loan I had to see why. {bureauName} got me looking like I dont pay my bills but thats not true. I got records going back years. Your data is wrong and its killing my business. This needs to get straight right now.`,
      // Variant 5: Healthcare worker
      `I work at the hospital and you know how crazy these past few years been. Last thing I need is credit problems on top of everything else. Went to refinance my car to save some money and got denied. {bureauName} got all kinds of wrong stuff on my file. I compared it to my own records and its not even close. Fix this.`,
      // Variant 6: Veteran
      `Served my country for years and now Im back trying to build a normal life. Cant even get an apartment because {bureauName} got bad info on my credit. I didnt go through everything I went through just to get blocked by a credit report thats full of mistakes. Check your records because what you got aint right.`,
      // Variant 7: Teacher/Educator
      `I teach kids for a living. Dont make a lot but I always pay my bills. So imagine how I felt when I saw what {bureauName} is reporting about me. The numbers are wrong, the dates are wrong, some of this stuff I never even heard of. I keep good records and I know whats real. Your report is not it.`,
      // Variant 8: Single parent
      `Raising my kids by myself aint easy but I make it work. Every dollar matters so when I got denied for a credit card I had to find out why. {bureauName} got me looking bad when I know I do right by my bills. The info on my report dont match my life at all. I need this corrected so I can take care of my family.`,
    ],
    bodyParagraphs: [
      `The information in this complaint is inaccurate because it reports different information across each consumer reporting agency (or CRA). However, the Fair Credit Reporting Act (or FCRA) requires {bureauName} to report my credit with maximum accuracy. What is maximum accuracy? Well, under the FCRA, this standard forces CRAs to report my credit 100% consistent across each agency, only after I inform you of the errors.`,
      `And for this reason, if you do not modify or delete the accounts I am about to list in this complaint, you may have to pay a hefty fine (over a couple thousand) for the damages your misleading reporting has caused me. Here is a list of the items furnishing incorrect, plus the exact categories that are inaccurate:`,
    ],
    // HARD RULE: R1 = NO CITATIONS, 6th-9th grade reading level, colloquial
    bodyParagraphVariants: [
      [
        // Variant A - Simple comparison explanation
        `I got my credit reports from all three bureaus and they dont match. Like at all. {bureauName} is showing stuff that the other two aint got. Thats not right. When I compare the reports side by side the numbers are different, the dates are different, and some stuff just dont make sense. Yall need to fix this.`,
        // Variant B - Direct call out
        `Something is wrong with what {bureauName} got on me. I looked at all three of my credit reports and yours is the one thats messed up. The other bureaus got different info and honestly theirs looks more like what I remember. Your data is wrong and its hurting me.`,
        // Variant C - Working person angle
        `I been looking at my credit from all three bureaus and {bureauName} got it wrong. I work hard and pay my bills so I know whats what. The stuff on your report dont match my records and it dont match what the other bureaus showing neither. This needs to be fixed.`,
        // Variant D - Frustrated but clear
        `Checked all my credit reports recently. {bureauName} is the problem. What yall showing dont match what Equifax and the others got. And more importantly it dont match my actual records. I got statements and receipts. Your info is just wrong.`,
      ],
      [
        // Variant A - Direct consequence
        `Because of these mistakes I been getting denied left and right. Cant get approved for nothing. If this dont get fixed soon Im gonna have to take this further and nobody wants that. Here is whats wrong on my file:`,
        // Variant B - Family impact
        `These errors are messing up my life for real. My family needs me to have good credit and right now I cant do nothing. Fix these problems or Im gonna have to get help from people who deal with this stuff. Heres whats wrong:`,
        // Variant C - Time pressure
        `I need this handled quick. Every day this wrong info sits on my report is another day I cant get ahead. I know my rights and I know you got 30 days. Heres the accounts that are messed up:`,
        // Variant D - Money impact
        `This is costing me money every single day. Higher interest rates, getting denied, all of it. I shouldnt have to deal with this when I aint even do nothing wrong. Look at these accounts and tell me this is right:`,
      ],
    ],
    // HARD RULE: No sales language, colloquial, direct
    accountListIntro: `You got 30 days to look into this and fix it. I aint trying to cause problems for nobody but this wrong info is causing problems for me. Every day it stays on my report is another day I cant get ahead. Just look into it and make it right. Thats all Im asking.`,
    demandSection: DEMAND_LANGUAGE.R1,
    consumerStatement: `All items listed in this complaint are reporting incorrect information on my credit report. I have not been able to use my credit in a very long time and I am suffering each and every day because of it. Please remove this information ASAP so I can go back to living my normal (less stressful) life.`,
    consumerStatementVariants: [
      // Variant 1: Direct and matter-of-fact
      `The accounts I've listed contain errors that do not reflect my actual credit history. I'm asking for a proper investigation and correction of these inaccuracies so my report accurately represents who I am as a borrower.`,
      // Variant 2: Frustrated but professional
      `I've documented specific inaccuracies in the accounts above. These errors have caused real problems for me, and I expect them to be investigated and corrected. I shouldn't have to fight to have accurate information on my own credit report.`,
      // Variant 3: Emphasizing impact on family
      `My family depends on me having access to fair credit. The errors in these accounts have made that impossible. I'm requesting that you investigate and fix these problems so I can provide for the people who count on me.`,
      // Variant 4: Future-focused
      `I'm trying to build a better future, but these reporting errors keep holding me back. Please investigate the items I've identified and make the necessary corrections. Accurate reporting is all I'm asking for.`,
      // Variant 5: Referencing own records
      `I have my own records showing that the information you're reporting is incorrect. I'm requesting that you verify this data against the original source and correct the errors I've identified above.`,
      // Variant 6: Calm but firm
      `The disputed items contain information that is demonstrably inaccurate. I'm formally requesting an investigation into each account listed. If the data cannot be verified as accurate, it should be removed from my file.`,
      // Variant 7: Expressing determination
      `I will continue to dispute these inaccuracies until my credit report reflects the truth. I'm asking you to conduct a real investigation—not just send a form letter back. These errors affect my daily life.`,
      // Variant 8: Healthcare/essential worker angle
      `I work hard every day to take care of others. The least I can expect is that my credit report accurately reflects my payment history. Please investigate and correct the errors I've identified.`,
    ],
    includesScreenshots: false,
  },

  2: {
    headline: "15 U.S.C. 1681e(b) Accuracy of report—Damages may be owed.",
    statute: "15 USC 1681e(b)",
    openingParagraph: `{bureauName} has broken the law and may have to pay me a good amount in damages because you did not correct the misleading information from my credit report, after getting my dispute over 50 days ago. On {lastDisputeDate}, I spelled out the exact accounts that were furnishing different information on your agency compared to the other CRAs. But on my credit report update, literally, no changes were made. Therefore, I am owed actual damages because I have not been able to use my credit during this time.`,
    openingParagraphVariants: [
      // Variant 1: Direct and frustrated
      `I'm writing again because nothing has changed. On {lastDisputeDate}, I sent you a detailed dispute explaining exactly what was wrong with my credit report. I expected your agency to investigate and correct the errors. Instead, I pulled my updated report and found everything exactly the same. No corrections. No deletions. Nothing. {bureauName} has failed to do its job, and I've suffered real consequences because of it.`,
      // Variant 2: Citing the law clearly
      `Under 15 USC 1681e(b), {bureauName} is required to maintain maximum accuracy. I disputed inaccurate items on {lastDisputeDate} and provided specific details about what was wrong. More than 30 days have passed, and my credit report shows zero changes. Your agency has not met its legal obligations, and I am now facing damages because of your inaction.`,
      // Variant 3: Personal consequences focus
      `Since I sent my dispute on {lastDisputeDate}, I've been turned down for credit twice. Both times, the lender cited information that I specifically told you was inaccurate. I did my part—I identified the errors and gave you time to fix them. You did nothing. Now I'm dealing with the fallout from your failure to investigate.`,
      // Variant 4: Comparison across bureaus
      `I've compared my credit reports from all three bureaus, and the discrepancies are clear. The items I disputed on {lastDisputeDate} still show different information on {bureauName} than what the other agencies report. This proves the data is inaccurate, yet you've made no corrections. How is that meeting the maximum accuracy standard?`,
      // Variant 5: Business impact angle
      `When I disputed these accounts on {lastDisputeDate}, I explained how the errors were affecting my ability to conduct business. Thirty days later, nothing has changed on my report. Meanwhile, I've lost opportunities that won't come back. Your failure to investigate has cost me real money.`,
      // Variant 6: Time and effort invested
      `I've now spent hours documenting errors, writing disputes, and waiting for corrections that never came. My dispute from {lastDisputeDate} laid out everything clearly—the accounts, the discrepancies, the specific categories that were wrong. You had 30 days to act. You chose not to. That decision will cost one of us, and I intend for it to be you.`,
    ],
    bodyParagraphs: [
      `If you do not want me to seek a legal claim against your agency, I suggest you delete the inaccurate information (in this complaint) right away. You see, according to 15 USC 1681e(b), {bureauName} must conduct reasonable procedures—to make certain without a doubt—that every item on my credit report is furnished without error. And after reviewing my updated credit report, NO CHANGES WERE MADE TO THE DISPUTED ITEMS. For this reason, you have, without a doubt, not followed reasonable procedures to report my credit with maximum accuracy.`,
      `Here is a list of the exact information furnishing inaccurate on my credit report:`,
    ],
    bodyParagraphVariants: [
      [
        // Variant A (original)
        `If you do not want me to seek a legal claim against your agency, I suggest you delete the inaccurate information (in this complaint) right away. You see, according to 15 USC 1681e(b), {bureauName} must conduct reasonable procedures—to make certain without a doubt—that every item on my credit report is furnished without error. And after reviewing my updated credit report, NO CHANGES WERE MADE TO THE DISPUTED ITEMS. For this reason, you have, without a doubt, not followed reasonable procedures to report my credit with maximum accuracy.`,
        // Variant B
        `I am giving you one chance to avoid legal action. Under 15 USC 1681e(b), {bureauName} has a duty to follow reasonable procedures that ensure accuracy. I just checked my updated report and not a single disputed item has been changed. That is not what reasonable procedures look like. That is what negligence looks like—and it is actionable under federal law.`,
        // Variant C
        `Let me be direct: 15 USC 1681e(b) requires your agency to use reasonable procedures to ensure maximum accuracy. I received my updated credit report and every single disputed item remains unchanged. No corrections. No deletions. No modifications of any kind. That tells me you either ignored my dispute entirely or conducted a sham investigation. Either way, you have violated the law.`,
      ],
      [
        // Variant A (original)
        `Here is a list of the exact information furnishing inaccurate on my credit report:`,
        // Variant B
        `The following accounts continue to report misleading data on my credit file:`,
        // Variant C
        `Below are the items that remain inaccurate despite my previous dispute:`,
      ],
    ],
    accountListIntro: `To further prove the items are inaccurate, I have attached screenshots showing how the items listed above, are reporting different information on your agency compared to the other CRAs. Confirming these items are inaccurate—according to the maximum accuracy standard of the FCRA. This brings me to my next point…\n\nIf you would like me to drop my complaint (which you will clearly lose if I decide to take it to court)… I will only do so, if you delete the inaccurate information from my credit report. Please review the categories I listed as incorrect, plus the screenshots that prove the items are incorrect. Then I suggest you delete the following items from my credit report to avoid having to pay me actual damages under 15 USC 1681o.`,
    demandSection: DEMAND_LANGUAGE.R2,
    consumerStatement: `60 days flew by and {bureauName} failed to make any changes to the disputed accounts in my last complaint. I mean I gave you double the time to investigate, and you still did not make any changes. This is insane to think about, especially, when you are heavily watched by the FTC for this one job. If you are a creditor and you can see this statement, just know… the items in my report are heavily incorrect.`,
    consumerStatementVariants: [
      // Variant 1: Time passed without action
      `I gave {bureauName} more time than required by law to investigate my dispute. In return, I received no corrections and no explanation. The items remain inaccurate, and my financial situation continues to suffer. I expect action on this follow-up dispute.`,
      // Variant 2: Documentation emphasis
      `I have documented every step of this process. My initial dispute was clear. The errors are verifiable. And {bureauName} has done nothing to address them. Creditors reviewing my file should know that I am actively fighting inaccurate information that your agency refuses to correct.`,
      // Variant 3: Frustration with the system
      `Two months of waiting and nothing to show for it. I followed the proper process, provided the required information, and expected a fair investigation. What I got was silence and inaction. These disputed items are wrong, and I will keep pushing until they're corrected.`,
      // Variant 4: Impact on daily life
      `Every day these errors remain on my report is another day I can't move forward. I can't get approved for what I need. I can't plan for my future. All because {bureauName} won't do its job. To any creditor reading this: the information being reported is inaccurate.`,
      // Variant 5: Prepared for escalation
      `I've been patient. I've followed the rules. And I've gotten nowhere. The disputed accounts contain clear errors that {bureauName} has failed to address. I am prepared to escalate this matter if my second dispute receives the same treatment as the first.`,
      // Variant 6: Simple and direct
      `The items I disputed remain inaccurate. {bureauName} has not corrected them despite having ample time and evidence. I am formally disputing these accounts again and expect a proper investigation this time.`,
    ],
    includesScreenshots: true,
  },

  3: {
    headline: "BROKEN LAW: 15 U.S.C. 1681i(a)(5)—30 days passed, and the items remain incorrect on my credit report.",
    statute: "15 USC 1681i(a)(5)",
    openingParagraph: `If {bureauName} got a letter from me highlighting the exact accounts that are incorrect and after 30 days no changes were made… would that spark a legal violation under 15 USC 1681i(a)(5)? Of course, it would. Well check this out… it has now been over 90 days and I have sent in 2 different disputes challenging the inaccurate information, yet the items in this complaint are furnishing the same way as my initial dispute.`,
    bodyParagraphs: [
      `With that being said, you have clearly broken the law numerous times under 15 USC 1681i(a)(5) because these inaccurate items are still on my credit report. Since you failed to take my disputes seriously, I haven't even tried to use my credit because I know I will get denied—like I have so many times in the past. I get humiliated consistently time and time again simply because you refuse to correct the misleading information on my credit report.`,
      `Therefore, I have gathered a significant amount of damages I am owed by your agency. And I will only drop my complaint under the following condition: You delete the inaccurate information from my credit report within 30 days of getting this complaint.`,
      `This is the only way we can settle this dispute without me chasing you down, under federal jurisdiction, to remove these accounts the hard (and expensive) way. So I encourage you to review this letter thoroughly, and do the right thing… DELETE THE INACCURATE ITEMS.`,
      `In fact, here, once again, is a list of the exact information furnishing incorrect on my credit report:`,
    ],
    bodyParagraphVariants: [
      [
        // Variant A (original)
        `With that being said, you have clearly broken the law numerous times under 15 USC 1681i(a)(5) because these inaccurate items are still on my credit report. Since you failed to take my disputes seriously, I haven't even tried to use my credit because I know I will get denied—like I have so many times in the past. I get humiliated consistently time and time again simply because you refuse to correct the misleading information on my credit report.`,
        // Variant B
        `Your repeated violations of 15 USC 1681i(a)(5) are well documented at this point. I have given you more than enough time and evidence to remove these inaccurate items. Instead of doing your job, you've forced me to live in fear of applying for anything—because the humiliation of yet another denial based on YOUR errors is something I can't take anymore.`,
        // Variant C
        `Three disputes. Over 90 days. And you've done absolutely nothing to fix the errors I've clearly identified. Under 15 USC 1681i(a)(5), you were required to investigate and either verify or delete each disputed item. You did neither. The inaccurate information sits on my report like a permanent scar, preventing me from accessing the credit I rightfully deserve.`,
      ],
      [
        // Variant A (original)
        `Therefore, I have gathered a significant amount of damages I am owed by your agency. And I will only drop my complaint under the following condition: You delete the inaccurate information from my credit report within 30 days of getting this complaint.`,
        // Variant B
        `At this point, my documented damages are substantial. Lost credit opportunities, higher interest rates, denied applications—all because of your reporting failures. I will settle this matter without legal action under one condition: delete every inaccurate item listed below within 30 days.`,
        // Variant C
        `I have been tracking every denial, every missed opportunity, and every sleepless night caused by your negligent reporting. The damages are real, they are documented, and they are growing. The only way I will not pursue these damages is if you remove the disputed items within 30 days of receiving this letter.`,
      ],
      [
        // Variant A (original)
        `This is the only way we can settle this dispute without me chasing you down, under federal jurisdiction, to remove these accounts the hard (and expensive) way. So I encourage you to review this letter thoroughly, and do the right thing… DELETE THE INACCURATE ITEMS.`,
        // Variant B
        `I don't want to spend months in federal court over accounts that should have been corrected months ago. But I will if that's what it takes. You have a simple choice: correct these errors now, or explain to a judge why you refused to after three separate complaints.`,
        // Variant C
        `Consider this your final opportunity to resolve this without court involvement. My documentation is thorough, my damages are real, and I am fully prepared to pursue every remedy available under the FCRA. The easiest path for both of us is simple: delete the inaccurate items immediately.`,
      ],
      [
        // Variant A (original)
        `In fact, here, once again, is a list of the exact information furnishing incorrect on my credit report:`,
        // Variant B
        `For the third time, here are the accounts that remain incorrectly reported:`,
        // Variant C
        `Once again, the following items continue to report inaccurate information despite my repeated disputes:`,
      ],
    ],
    accountListIntro: `You have 30 days to remove these items according to the conditions I have left inside this dispute. I am suffering as we speak because of your unreliable reporting habits. Hopefully, for me and you… this ends after this dispute.`,
    demandSection: DEMAND_LANGUAGE.R3,
    consumerStatement: `This is the third dispute I have sent in 90 days. The items remain incorrect. I remain depressed. My family remains struggling simply because {bureauName} has not listened to me and continues to report false information on my credit report. I am starting to lose hope… and I am starting to contact lawyers to help me resolve this issue.`,
    includesScreenshots: true,
  },

  4: {
    headline: "Creditors cannot be trusted: 15 USC 1681i(a)(1)(a)—NO reasonable reinvestigation has been conducted.",
    statute: "15 USC 1681i(a)(1)(a)",
    openingParagraph: `After conducting hundreds of hours of research, I have found some fascinating information that will violently shake your legal department. In fact, what I'm about to share with you proves you have put in minimal effort (of your legal requirements) when you investigated my last 3 disputes. Translation: If you do not delete the inaccurate items from my credit report you will potentially have to pay me thousands of dollars in damages.`,
    bodyParagraphs: [
      `Here's what I have found: According to 2019 court case, Equifax was smashed by a consumer, who goes by the name of Shepard. Why? Simply because Shepard proved Equifax did not conduct a reasonable investigation about his dispute… and the court's definition of a reasonable investigation was going beyond the data furnishers. Don't believe me? Then have your legal team review this case, Shepard v. Equifax Info. Servs., LLC, 2019 U.S. Dist., which proves my claim.`,
      `Now let's talk about my disputes. I have sent {bureauName} 4 over the last 120 days and I know, for a fact, that no steps surpassed the data furnisher because I received the same parroting response from your agency. Either saying, "Updated" or "Verified by data furnisher." Without giving any details or proof as to why the items are furnishing 100% correct on my credit report.`,
      `Better yet, here is a list of the items furnishing inaccurately after you got 4 separate disputes from me:`,
    ],
    accountListIntro: `The list above proves no reasonable investigation was conducted. Therefore, you legally have to delete the following information from my credit report… or… you will be facing serious punishment under 15 USC 1681i(a)(1)(a), as proven in the court case I referenced in the second paragraph.`,
    demandSection: DEMAND_LANGUAGE.R4,
    consumerStatement: `Do not trust the creditors. I repeat, do not trust the creditors. I have disputed the items in this complaint over 4 times and no changes have been made. Please investigate beyond the creditors so you can see why you must delete this information right away. Otherwise, your agency is going to be punished for the creditor's false investigations. For this reason, you should delete these accounts to save yourself from having to pay a considerable amount of damages.`,
    includesScreenshots: true,
  },

  5: {
    headline: "Immediate Request: 15 USC 1681i(a)(7)—Description Of Reinvestigation Procedure.",
    statute: "15 USC 1681i(a)(7)",
    openingParagraph: `Lines have been crossed… rules have been broken… and families have been injured all because {bureauName} refuses to listen to my instructions over the last 5 months. I informed you in my last letter the creditors cannot be trusted and requested you to investigate past them. Today is the day we find out if my claims are correct. However, I must warn you—if you have not investigated past the data furnishers—you can expect to pay me a good chunk of money in actual damages.`,
    bodyParagraphs: [
      `I sent my last dispute on {lastDisputeDate}, I have also submitted a CFPB complaint about this letter. Inside this letter I not only proved the items were inaccurate with screenshots, but I also displayed the exact information reporting incorrect. Today, the same information reports unchanged. And for this reason, I would like to request a description of your reinvestigation procedure for my last dispute.`,
      `Here is the required information you must include in your description of your reinvestigation procedure under 15 USC 1681i(a)(6)(B)(iii):`,
      `• A statement of the reinvestigation that was completed including the details of the employee who conducted the investigation, plus the date and time it was completed.`,
      `• All documents the data furnishers submitted about this dispute to prove the items are correct regarding the Account number, Account status, Date opened, High credit, Credit limit, Balance, Past due amount, Payment history profile, and Date of first delinquency.`,
      `• Each data furnisher's full name, address, and the telephone number you contacted to make sure the items are correct.`,
      `• The ACDV response you received from each furnisher, plus any steps, in exact order, you took after that to assure each category of the disputed information was correct.`,
      `Legally, under 15 USC 1681i(a)(7), you have 15 days to send me the requested information… or… the following items are considered inaccurate or unverifiable and must be deleted from my credit report.`,
    ],
    demandSection: DEMAND_LANGUAGE.R5,
    consumerStatement: `Please rush my reinvestigation because I am desperately trying to move apartments, but the inaccurate items on my credit report are the only thing stopping me. These items have been dancing on my credit report for over 6 months and I am running out of options. Therefore, you are leaving me no choice but to seek legal action and enforce these deletions myself.`,
    includesScreenshots: true,
  },

  6: {
    headline: "LEGAL VIOLATION PROVED: 15 U.S.C. 1681i(a)(6)(B)(iii)—You never sent my reinvestigation results after my request.",
    statute: "15 USC 1681i(a)(6)(B)(iii)",
    openingParagraph: `Last month, I requested a full description of your reinvestigation procedure for the dispute I sent you on {lastDisputeDate}. Since then, my mailbox has been emptier than a GPS in the middle of the ocean. I have been anxiously waiting for these results, yet you never sent me anything in the mail. So I dashed to my CFPB account inbox and once again… you did not send me the requested description of reinvestigation results.`,
    bodyParagraphs: [
      `That being said, you have broken the law under 15 USC 1681i(a)(6)(B)(iii) because once I request a description of your reinvestigation procedure, you must deliver the description within 15 days. It has now been over 30 days, and I am in the same position as last month. I cannot use my credit, I'm working twice the hours and I'm drowning in depression simply because you left the inaccurate items on my credit report.`,
      `To make things worse (for you), I have spent a considerable amount of time researching this violation and you will not believe what I found… according to the following court case, Brown v. Equifax Info. Servs., 2010 U.S. Dist., a CRA who does not send a consumer (me) the requested description of reinvestigation results… must pay me actual and statutory damages (if I decide to take my claim to federal court).`,
      `Luckily for you, I am giving you a final chance to remove this information from my credit report. If you listen to my demand and delete the inaccurate items, I will drop my claim immediately. However, if you do not listen to my demand, you can expect an invitation to finish this dispute in Federal Circuit Court. Please review this dispute thoroughly, and then review my last dispute, so you can see why you will, obviously, lose if I escalate my claim.`,
    ],
    demandSection: DEMAND_LANGUAGE.R6,
    consumerStatement: `Each item in this complaint is furnishing incorrect information. Plus, I even requested a description of the last reinvestigation procedure for the items listed and I have not received anything. My request was over 30 days ago, therefore, all the items in this complaint are illegally furnished on my credit report and must be deleted right away.`,
    includesScreenshots: true,
  },

  7: {
    headline: "Every Account in This Complaint Is Missing My Last Consumer Statement—Violation 15 USC 1681i(c).",
    statute: "15 USC 1681i(c)",
    openingParagraph: `Before you read this letter, please skip to the final pages after the consumer statement. You will see in bolded letters, "Screenshots of accounts missing my previous consumer statement." Go through each screenshot listed and go to the comments section of each account, as you can see, NOWHERE on my consumer report does it display my previous consumer statement. For this reason, you have broken the law under 15 USC 1681i(c) Notification of consumer dispute in subsequent consumer reports.`,
    bodyParagraphs: [
      `According to 15 USC 1681i(c), {bureauName} must update my consumer statement with each dispute I send you (on every account on my consumer report). However, the accounts in this complaint merely say, "Disputed by consumer" or Nothing at all. Therefore, the following information is incomplete and is not reporting with maximum accuracy.`,
      `Since you did not include my updated consumer statement… my ability to use my credit has run into a dead stop. I cannot get a credit card to help out with my bills. I cannot get a car and I am forced to constantly take Ubers everywhere (which costs me more than owning a car). My family looks down on me as if I'm homeless. I cannot maintain a relationship because I am too embarrassed of my credit score.`,
      `And I have been pushed deep into this miserable lifestyle all because you cannot follow your duties under the FCRA. Well, luckily for me, I am allowed to recover actual and statutory damages for your illegal acts. Yet I will not do that only under the following condition: You delete the illegal accounts listed in this dispute before my next report update.`,
      `That is the only way I will drop my complaint, otherwise, you can expect to pay a significant amount of funds for the daily trauma you dump into my life under 15 USC 1681o.`,
    ],
    demandSection: DEMAND_LANGUAGE.R7_PLUS,
    consumerStatement: `Please review this court case, Klein v. Navient Sols., LLC, 2020 U.S. Dist., Inside you will discover that merely citing, "CONSUMER STATEMENT" without leaving the actual details does not fit Congress's legal requirements under 15 USC 1681i(c). You must include the entire 100-word statement inside my updated consumer report to remain compliant with the FCRA. However, in the screenshots below, I have proved you did not do that. And for this reason, you must delete the accounts in this complaint immediately.`,
    includesScreenshots: true,
  },

  8: {
    headline: "CIVIL PENALTY: 15 U.S.C. 1681s-2(B)—Furnishers Failed To Make Changes To Inaccurate Information.",
    statute: "15 USC 1681s-2(b)",
    openingParagraph: `If I sent about 8 disputes over the last 9 months, and no changes were made to the inaccurate information on my credit report, would that make the data furnishers unreliable? I think so. Well, how about if I attached screenshots (in each dispute) proving the inaccurate accounts on my credit report in 5 out of 8 disputes (including this one)… and no changes were made… would that make {bureauName} liable for bending the law?`,
    bodyParagraphs: [
      `I think it, most definitely, makes {bureauName} liable for bending the law. However, my opinion doesn't really matter about our ongoing battle… but there is one fact I have that will drastically change the facial features of your legal department, and your company's current funds. You see, according to the FCRA—a data furnisher and {bureauName} have parallel obligations to report my credit with maximum accuracy. This means both of your duties are legally binding under 15 USC 1681e(b) and 1681s-2(b)—to correct inaccurate information within 30 days.`,
      `Unfortunately for me, I have been dealing with misinformation on my credit report for the last 10 months. This misinformation has caused me to get denied credit, get publicly humiliated, ruined my appetite, and changed my daily habits. Plus, it's only getting worse… I have isolated myself from almost everyone I love because I cannot stop thinking about my credit score. I spend all my free time studying the law so I can remove this false information for good, yet {bureauName} consistently ignores your duties to correct false information on my credit report (it's been almost a year now).`,
      `I know, it must suck to be me right? Don't worry, what I'm about to prove is actually going to cost you A LOT more than you have already cost me… according to the following court case, McGhee v. Rent Recovery Solutions, LLC, 2018 U.S. Dist., when a circuit court is reviewing a claim of 15 USC 1681s-2(b), the amount of information contained in a consumer's dispute is heavily stressed—when deciding if a furnisher is guilty for unreasonable procedures…`,
      `And after analyzing our communication history over the last 10 months—here's what I've found.`,
      `• {bureauName} received 8 disputes from me.`,
      `• 6 of the disputes included screenshots and explained the exact information which is inaccurate.`,
      `• {bureauName} failed to make any changes to the misleading information on my credit report.`,
      `As a matter of fact, here are the accounts which are still inaccurate on my credit report:`,
    ],
    accountListIntro: `The list above proves {bureauName} and the data furnishers in this dispute are facing SERIOUS LEGAL PUNISHMENT under 15 USC 1681o. This means you will have to pay me, a substantial amount of, damages if I decide to pursue a claim in federal court. Luckily for you, I do not wish to do that as of now, but only if you delete this information from my credit report right away.`,
    demandSection: DEMAND_LANGUAGE.R7_PLUS,
    consumerStatement: `After 10 heartbreaking months, {bureauName} continuously violates the law over and over again. Seriously, what else can I do? I have proved the accounts in this complaint are inaccurate numerous times, I even messaged the data furnishers directly, proving they did not make any changes to the dispute information either. Plus, I have submitted a ton of CFPB complaints for each dispute. The only other option I have left is to litigate… and if that's what I have to do… consider it done.`,
    includesScreenshots: true,
  },

  9: {
    headline: "15 U.S.C. 1681(b) unreasonable investigation procedures—joint infraction!",
    statute: "15 USC 1681e(b) & 1681i(a)(1)(a)",
    openingParagraph: `Please forward this message to your legal department right away. They are the only people who can save {bureauName} from a potential $20,000… to… $30,000 loss if the illegal information is not removed from my credit report today.`,
    bodyParagraphs: [
      `My name is {clientFirstName} and over the last year, I have tried to help you remove all the inaccurate information from my credit report. I'm talking month after month… dispute after dispute… sending you the exact items that are incorrect (highlighting them in bolded letters), while also, attaching screenshots proving my case. Yet you have not made any changes to the misleading information on my credit report.`,
      `As of today, the following accounts are furnishing mismatching information on your agency compared to the other CRAs—making them inaccurate for a fact:`,
    ],
    accountListIntro: `Here's where things get interesting. Since you have not made any changes to the disputed items you have, without a doubt, not conducted a reasonable reinvestigation for my last disputes. And, according to the FCRA, if {bureauName} did not conduct a reasonable reinvestigation, there is no way reasonable procedures were followed to assure maximum accuracy for the items reported. For this reason, {bureauName} is liable for a joint infraction for breaking the law on 2 counts simultaneously.\n\n• Count 1: 15 USC 1681e(b) accuracy of report.\n• Count 2: 15 USC 1681i(a)(1)(a) Failure to conduct a reasonable investigation.\n\nAs of now, you have 2 options… option 1: You can delete the inaccurate items from my credit report and I will drop my claim… or… option 2: if you don't make the changes I will seek a claim immediately to recover actual and statutory damages that your unreasonable investigation procedures have caused me.\n\nI do not wish to give you my sob story as of right now—which you have clearly seen over the last year—In each dispute I've sent you. Currently, I just want results. That being said, you have 30 days to give me a response. And based on your response, I will act accordingly.`,
    demandSection: DEMAND_LANGUAGE.R7_PLUS,
    consumerStatement: `I intend to recover damages under 15 USC 1681o and 1681n for all the stress, depression and hell my life is drowning in, due to your inability to follow the law. I have no reason to smile, my heart is full of hate, and I do not care about anything else besides fixing the misleading information on my credit report. And I will not stop fighting until this information is gone for good.`,
    includesScreenshots: true,
  },

  10: {
    headline: "15 U.S.C. 1681c(e)—Failure to indicate closure of account by consumer.",
    statute: "15 USC 1681c(e)",
    openingParagraph: `I tried to apply for a couple of credit cards earlier this week, but once I got my denial letter, you are not going to believe what it said… "I was denied due to some delinquent accounts on my credit report." This concerned me, so I took a closer look at my credit report and I noticed one specific error that got me denied… and this one error might end up costing {bureauName} a small fortune.`,
    bodyParagraphs: [
      `{creditorNames} are furnishing on my credit report as closed accounts. However, the following accounts are missing "one major detail." They do not disclose I was the one who closed the account… not the creditor. Therefore, you are legally required to display this information in the account status section of my credit report. And since you have not, {bureauName} has committed a violation of law under 15 USC 1681c(e) indication of closure of account by consumer.`,
      `I have attached screenshots at the end of this complaint which prove the accounts in this complaint are not showing I closed the accounts myself. Please review the screenshots rigorously—and delete the inaccurate accounts from my credit report. If you do not listen to my demand, you may have to pay a couple thousand dollars in legal fees under 15 USC 1681o.`,
      `For this reason, I suggest you delete the inaccurate accounts listed below to prevent legal punishment against your agency:`,
    ],
    demandSection: DEMAND_LANGUAGE.R7_PLUS,
    consumerStatement: `I closed all accounts listed in this complaint voluntarily, yet none of the accounts show that in the account status section of my credit report. Please review and delete the inaccurate information. I've already been denied credit once because of this and I'm still recovering from the embarrassing event.`,
    includesScreenshots: true,
  },

  11: {
    headline: "Accounts are inaccurately reporting a balance on a discharged debt—Violation 15 USC 1681e(b).",
    statute: "15 USC 1681e(b)",
    openingParagraph: `I have contacted the creditors in this complaint and discovered a 1099c has been filed from each account listed. This confirms the debts have been discharged and has now become income (according to IRS tax code for form 1099c). Yet for some strange reason, {bureauName} is furnishing a balance on all the accounts in this complaint.`,
    bodyParagraphs: [
      `This confirms you have not taken any further steps in your investigation to go beyond the data furnisher. And according to the federal courts, not investigating beyond the ACDV system is viewed as an unreasonable investigation. This was proven in the following court case, Grigoryan v. Experian Info. Solutions, Inc., 84 F. Supp. 3d, especially after I informed you the furnishers in this complaint cannot be trusted (which I have done twice in the last year).`,
      `Please review this case so you can see why {bureauName} is guilty for not following reasonable procedures to assure maximum accuracy for the accounts in this complaint, entailing a clear breach of 15 USC 1681e(b). In your investigation, you must contact the creditors and get, either a sworn statement from the accountant managing my account in their company saying, "No 1099c has been filed for the listed account"… Or… you must turn in the actual accounting records in relation to my name from each creditor which proves no deductions have been made.`,
      `If you cannot produce the requested information in the last paragraph, you must delete the inaccurate accounts below for reporting a balance on a discharged debt:`,
    ],
    demandSection: DEMAND_LANGUAGE.R7_PLUS,
    consumerStatement: `You are reporting a balance on a discharged debt on all the accounts listed in this complaint. Therefore, they are, obviously, inaccurate. Please remove this misinformation from my credit report—they are the sole reason I cannot use my credit and the fiery match to my burning depression.`,
    includesScreenshots: true,
  },
};

// =============================================================================
// COLLECTION FLOW TEMPLATES (R1-R4, R8-R12)
// Note: R5-R7 uses ACCURACY flow, then returns to COLLECTION
// =============================================================================

export const COLLECTION_TEMPLATES: Record<number, Omit<RoundTemplate, "round" | "flow">> = {
  1: {
    headline: "Debt Collector Violated 15 USC 1692g—I never got a dunning letter within 5 days of the accounts reporting.",
    statute: "15 USC 1692g",
    openingParagraph: `If you want to avoid getting dragged into a civil lawsuit where you may have to pay for damages, for something you did not even intentionally do, I suggest you delete the illegal collection accounts from my credit report today.`,
    openingParagraphVariants: [
      // Variant 1: Discovered through credit check
      `I recently pulled my credit report and discovered collection accounts that I've never been properly notified about. These debt collectors reported to {bureauName} without ever sending me the required validation notice. That's not just unfair—it's a federal violation under 15 USC 1692g.`,
      // Variant 2: Denied because of unknown collections
      `I was denied credit last week, and when I checked my report, I found collection accounts I had no idea existed. No one ever contacted me about these debts. No validation letters. No proper notification. Just surprise entries destroying my credit. This is exactly what the FDCPA was designed to prevent.`,
      // Variant 3: Multiple collections appearing suddenly
      `Multiple collection accounts have appeared on my credit report without any prior communication from the debt collectors. Under federal law, collectors must validate debts before reporting them. They didn't. These accounts are illegally furnished and need to be removed.`,
      // Variant 4: Working toward credit goals blocked
      `I've been working to improve my credit situation, and I was making progress until these collection accounts appeared out of nowhere. The debt collectors never sent validation notices—they just reported to {bureauName} and damaged my score. This violates federal debt collection law.`,
      // Variant 5: Comparing bureaus revealed discrepancies
      `When I compared my credit reports from all three bureaus, I noticed collection accounts that shouldn't be there. I never received any validation letters from these debt collectors. Under 15 USC 1692g, they cannot report debts without first sending proper notice. They skipped that step entirely.`,
      // Variant 6: Direct and legal-focused
      `The collection accounts on my credit report were furnished in violation of 15 USC 1692g. The debt collectors failed to send me the mandatory validation notice within 5 days of initial communication. Reporting to a credit bureau is communication. I received nothing. These items must be deleted.`,
    ],
    bodyParagraphs: [
      `You see, {debtCollectorNames}, has furnished a collection account on my credit report without validating this debt with me beforehand. In fact, the following debt collectors never sent me a dunning letter (which is mandatory to validate a debt) within 5 days of the accounts getting reported (which is also the initial communication). Therefore, the accounts listed below must all get deleted from my credit report under 15 USC 1692g.`,
      `However, there is one way you can leave the items on my credit report unscathed. And in order to do this, you must produce proof a dunning letter was sent to my address (within 5 days of the account getting furnished). If you cannot produce the requested information, then, by law, you must delete the collection items off my credit report by my next report update.`,
      `The only reason I am aware of these accounts are because they were in my credit report. If I got a dunning letter beforehand I would've, without a doubt, disputed the debt and never let these criminal debt collectors get away with this disgusting act. This is the reason, I intend to litigate immediately if these items are not removed from my report. I cannot stand it when people try to take advantage of others… which is obviously what is being done to me.`,
      `So if you want to free yourself from the heinous acts of the debt collectors in this complaint, simply delete the accounts below and I will drop my claim:`,
    ],
    bodyParagraphVariants: [
      [
        `You see, {debtCollectorNames}, has furnished a collection account on my credit report without validating this debt with me beforehand. In fact, the following debt collectors never sent me a dunning letter (which is mandatory to validate a debt) within 5 days of the accounts getting reported (which is also the initial communication). Therefore, the accounts listed below must all get deleted from my credit report under 15 USC 1692g.`,
        `Here's the problem: {debtCollectorNames} placed a collection on my credit report without ever validating the debt. Federal law under 15 USC 1692g is clear—a debt collector must send a dunning letter within 5 days of initial communication. Reporting to a credit bureau IS communication. No dunning letter was sent. The accounts listed below are therefore illegally furnished and must be deleted.`,
        `{debtCollectorNames} reported a collection account to {bureauName} without following basic federal requirements. Under 15 USC 1692g, any debt collector is required to send a validation notice within 5 days of first communicating with a consumer. Furnishing a collection account IS a form of communication. I never received any validation notice. Every account listed below was reported in violation of this law.`,
      ],
      [
        `However, there is one way you can leave the items on my credit report unscathed. And in order to do this, you must produce proof a dunning letter was sent to my address (within 5 days of the account getting furnished). If you cannot produce the requested information, then, by law, you must delete the collection items off my credit report by my next report update.`,
        `If you believe these accounts are legitimate, prove it. Show me documentation that a dunning letter was mailed to my verified address within 5 days of the account first appearing on my report. If you can't produce that evidence—and I'm confident you can't—these items must be removed from my credit file immediately.`,
        `There's a simple way to keep these accounts on my report: produce proof that a validation notice was sent to me within 5 days of the initial reporting date. Without that proof, these collection items have no legal basis to remain on my credit report and must be deleted before your next reporting cycle.`,
      ],
      [
        `The only reason I am aware of these accounts are because they were in my credit report. If I got a dunning letter beforehand I would've, without a doubt, disputed the debt and never let these criminal debt collectors get away with this disgusting act. This is the reason, I intend to litigate immediately if these items are not removed from my report. I cannot stand it when people try to take advantage of others… which is obviously what is being done to me.`,
        `I only discovered these accounts by pulling my own credit report. No letters, no calls, no validation—nothing. These debt collectors bypassed every legal requirement and went straight to damaging my credit. That's not just negligent—it's predatory. If these items aren't removed, I will pursue legal action to protect my rights and recover my damages.`,
        `The first I ever heard of these accounts was when they showed up on my credit report uninvited. If the debt collectors had followed the law and sent proper validation, I would have disputed these debts immediately. Instead, they chose to skip the legal process and go straight to ruining my credit. This is exactly the kind of abuse the FDCPA was written to prevent, and I will enforce my rights if these items are not deleted.`,
      ],
      [
        `So if you want to free yourself from the heinous acts of the debt collectors in this complaint, simply delete the accounts below and I will drop my claim:`,
        `The simplest way to avoid being dragged into the debt collectors' violations is to delete the accounts listed below. Do that, and I'll consider this matter resolved:`,
        `Delete the following illegally furnished collection accounts and I will not pursue further action against your agency for the debt collectors' violations:`,
      ],
    ],
    demandSection: DEMAND_LANGUAGE.R1,
    consumerStatement: `The debt collectors cannot be trusted. They have placed these accounts on my credit report without validating the debt beforehand. I have sent a direct dispute informing the debt collectors of their criminal acts (along with this dispute.) They have committed debt parking, and I will not let them get away with it. So to save yourself the legal trouble, I suggest you delete the items right away.`,
    consumerStatementVariants: [
      // Variant 1: Validation failure focus
      `These collection accounts were reported without any validation notice being sent to me. Under federal law, that's not allowed. I'm disputing these items with the debt collectors directly, but {bureauName} has a responsibility to ensure the information you report is accurate and legally obtained. Remove these accounts.`,
      // Variant 2: Impact on credit goals
      `I've been working hard to manage my finances responsibly, and these illegally reported collections are setting me back. The debt collectors skipped the validation process entirely. I expect {bureauName} to remove accounts that were furnished in violation of federal law.`,
      // Variant 3: Warning about legal action
      `The debt collectors listed in this dispute have violated the Fair Debt Collection Practices Act by reporting debts without proper validation. I have documented this violation and am prepared to take further action if these accounts are not removed from my credit report.`,
      // Variant 4: Protecting consumer rights
      `Debt collection laws exist to protect consumers from exactly this kind of behavior—surprise entries on credit reports without proper notice or validation. I'm exercising my rights under the FDCPA and FCRA. These unvalidated collection accounts must be deleted.`,
      // Variant 5: Direct request
      `No validation letter was ever sent for these collection accounts. That's a clear violation of 15 USC 1692g. I'm requesting that {bureauName} remove these illegally furnished accounts and stop reporting information that was obtained in violation of federal law.`,
      // Variant 6: Comparing to legitimate creditors
      `Legitimate creditors follow the rules. These debt collectors did not. They reported to {bureauName} without validating the debts first. I should not have to suffer credit damage because collectors failed to follow basic federal requirements. Delete these accounts.`,
    ],
    includesScreenshots: false,
  },

  2: {
    headline: "FORBIDDEN ACT: 15 USC 1692g(b)—Furnishing unverified disputed information.",
    statute: "15 USC 1692g(b)",
    openingParagraph: `The accounts in this complaint are furnishing illegally and can destroy your legal teams in the blink of an eye if an immediate correction is not made. You see, I disputed the invalidated debts on my credit report about 2 months ago. And since then, I am yet to receive any verification from the debt collectors or your agency about the accounts in this complaint. Therefore, the items are NOT allowed to be in my credit report according to 15 USC 1692g(b).`,
    bodyParagraphs: [
      `This was also proven in many federal courts. Better yet, here is a court case that explains why a debt collector who does not verify an item after it gets disputed, must cease all collection action (including credit reporting), Semper v. JBC Legal Group, 2005 U.S. Dist. Please have your legal team review this court case to see why every account in this complaint must be removed from my credit report.`,
      `Trust me, this will save you a lot of legal problems you don't want to deal with. Especially when you'll be taking the blame for the debt collector's actions. Listen: I know you're a credit reporting agency, so you may feel you cannot be punished under the FDCPA. However, you are eligible for punishment under the FCRA. And according to 15 USC 1681i(a)(5)… a CRA must delete inaccurate or UNVERIFIABLE information.`,
      `I have just proved the items in this dispute are unverified because the debt collectors never sent me any verifying documents after getting my original dispute. And black law dictionary defines verification as an affidavit or sworn declaration. So unless you can produce a sworn document from the debt collectors in this complaint—proving the debts are due and owing—you must delete the accounts listed below immediately.`,
    ],
    bodyParagraphVariants: [
      [
        `This was also proven in many federal courts. Better yet, here is a court case that explains why a debt collector who does not verify an item after it gets disputed, must cease all collection action (including credit reporting), Semper v. JBC Legal Group, 2005 U.S. Dist. Please have your legal team review this court case to see why every account in this complaint must be removed from my credit report.`,
        `Federal courts have been clear about this. In Semper v. JBC Legal Group, 2005 U.S. Dist., the court ruled that a debt collector who fails to verify a disputed debt must cease ALL collection activity—and that includes credit reporting. I suggest your legal team reviews that case carefully before deciding how to respond to this dispute.`,
        `The courts have already addressed this exact situation. In Semper v. JBC Legal Group (2005 U.S. Dist.), it was established that unverified debts must be removed from credit reporting entirely. The debt collectors in this complaint ignored my dispute and continued reporting. That's a violation. Have your lawyers look it up—they'll tell you to delete these accounts.`,
      ],
      [
        `Trust me, this will save you a lot of legal problems you don't want to deal with. Especially when you'll be taking the blame for the debt collector's actions. Listen: I know you're a credit reporting agency, so you may feel you cannot be punished under the FDCPA. However, you are eligible for punishment under the FCRA. And according to 15 USC 1681i(a)(5)… a CRA must delete inaccurate or UNVERIFIABLE information.`,
        `Here's what you need to understand: even though you're the CRA and not the debt collector, you're not shielded from liability. Under 15 USC 1681i(a)(5), you are required to delete any information that cannot be verified. These debts were never verified. Your obligation is clear—and ignoring it will only compound the legal exposure you're already facing.`,
        `Don't think being the CRA instead of the debt collector protects you. The FCRA has its own requirements, and 15 USC 1681i(a)(5) makes it your duty to remove unverifiable information. The debt collectors never verified these accounts. You're now reporting unverifiable data. That's your violation, separate from theirs.`,
      ],
      [
        `I have just proved the items in this dispute are unverified because the debt collectors never sent me any verifying documents after getting my original dispute. And black law dictionary defines verification as an affidavit or sworn declaration. So unless you can produce a sworn document from the debt collectors in this complaint—proving the debts are due and owing—you must delete the accounts listed below immediately.`,
        `The evidence is straightforward: I disputed these debts, the debt collectors provided zero verification, and the accounts remain on my report. Under Black's Law Dictionary, verification requires an affidavit or sworn statement. Produce a sworn declaration from each debt collector proving the debts are valid—or delete every account listed below.`,
        `Let me make this simple. I sent a dispute. The debt collectors sent nothing back. No sworn statements, no affidavits, no verification of any kind. Black's Law Dictionary defines verification as a formal declaration under oath. Without that, these debts are legally unverified and must be removed from my credit report immediately.`,
      ],
    ],
    demandSection: DEMAND_LANGUAGE.R2,
    consumerStatement: `I have not received any verification for the debts listed in this complaint. These accounts have ruined my credit score. I am embarrassed, disgusted, and enraged these accounts are still on my credit report. Consider this my final warning.`,
    includesScreenshots: true,
  },

  3: {
    headline: "LEGAL PENALTY: 15 USC 1692j—Furnishing deceptive forms.",
    statute: "15 USC 1692j",
    openingParagraph: `If the FDCPA excludes anyone who receives a debt by transfer or assignment from being a creditor, why are {debtCollectorNames} furnishing on my credit report as my creditors? This is proof {bureauName} has furnished a deceptive form and may be charged under the same penalty as a debt collector.`,
    bodyParagraphs: [
      `Let me explain: Under 15 USC 1692a(4) the definition of a creditor, the FDCPA, literally, excludes debt collectors from being a creditor. But for some strange reason, you have listed the debt collectors (whom I mentioned in the last paragraph) as my reporting creditors. This automatically places you under civil penalty for furnishing a deceptive form.`,
      `And according to the following court case, Daley v. Provena Hosps., 88 F. Supp. 2d 881, 887, a person does not have to be a debt collector to be punished under 15 USC 1692j. As a matter of fact, it clearly says, "ANYONE who furnishes a deceptive form shall be punished under the same sanctions as a debt collector would."`,
      `Therefore, if you would like to avoid having to pay statutory damages for breaking the law under 15 USC 1692j… you should delete the account right away. That is the only way I will drop my claim. Otherwise, I will do whatever it takes to get the illegal information off my credit report… including seeking legal assistance.`,
    ],
    demandSection: DEMAND_LANGUAGE.R3,
    consumerStatement: `I get harassed whenever I submit a credit application because of the illegal information on my credit report. This is unfair to me and my family who need my credit to help support our lifestyle. Your inconsiderate reporting methods affect more than just me… and we are about to reach our breaking point, if you do not follow the law and delete the illegal items from my credit report.`,
    includesScreenshots: true,
  },

  4: {
    headline: "Furnishing information that must be excluded—15 USC 1681a(m).",
    statute: "15 USC 1681a(m)",
    openingParagraph: `Did you know under 15 USC 1681a(m) that if an account is based on a transaction which was not initiated by a consumer, it can legally not be on my credit report? No? Well, I didn't think you knew that either… simply because you are furnishing collection accounts which I never initiated a transaction in… in fact, I never transacted with the listed debt collectors at all. And for this reason, {bureauName} has broken the law under 15 USC 1681a(m).`,
    bodyParagraphs: [
      `You see, {debtCollectorNames}, are all furnishing accounts I have no relation towards. I never transacted with them. I never allowed them to use my information to make a transaction. And to be quite honest, I've already proved these debts are unverified in the past, but that's a discussion for another day. For now, let's stick to the point… and my point is… that if you wish to avoid paying a large amount of fees in legal damages… you should delete the listed collection accounts (which are reporting information that must be excluded) today.`,
      `And In your investigation, I demand you request a contract between me and the listed data furnishers, which allowed them to authorize a transaction between me and their agency. If you follow my simple instructions, in your investigation, you will see why these accounts must be deleted from my credit report right away. And why you will also have to pay me a good amount of actual and statutory damages if I decide to take my claim any further.`,
      `However, I will drop my claim entirely if you delete the accounts listed below within 30 days of getting this dispute:`,
    ],
    demandSection: DEMAND_LANGUAGE.R4,
    consumerStatement: `I declare under penalty and perjury I've never initiated a transaction with the debt collectors listed in this complaint. I have gathered a good amount of emotional damages because these items are on my credit report, and I intend to recover the damages I am owed (if these items are not removed at once.)`,
    includesScreenshots: true,
  },

  // R5-R7: Use ACCURACY flow (this is handled in the generator logic)

  8: {
    headline: "15 USC 1681(b) Incorrect use of my consumer report.",
    statute: "15 USC 1681(b)",
    openingParagraph: `Sanctions for willful disregard of your duties of the FCRA are blazing your way if the illegal items are not removed. As explained in my last dispute, the collection accounts in this complaint are furnishing an account based on a transaction I did not initiate. Therefore, you have committed a legal breach for the improper utilization of my credit report under 15 USC 1681(b).`,
    bodyParagraphs: [
      `I have already told you of the exact items reporting this excluded information on my credit report, yet the accounts remain. For this reason, your penalties went from negligence and have escalated, all the way, to willful. This means you are not only facing actual and statutory damages that you may have to pay… but now… you are also facing punitive damages that you will have to pay if I decide to transfer my claim to a Federal Court.`,
      `There is only one way I will drop my claim and not try to rip your company's pockets to shreds for all the mental trauma you have dumped into my life (over the last couple of months). And that one way, strictly, depends on your actions within the next 30 days. Here are your options: Delete the excluded information (collection accounts)… or… continue this dispute under a federal district court.`,
      `You have 30 days to give me a response so I can act accordingly. Please take into great consideration the laws you have broken and delete the illegal items from my credit report below.`,
    ],
    demandSection: DEMAND_LANGUAGE.R7_PLUS,
    consumerStatement: `You have used my consumer report incorrectly and left me more depressed than a child who just found out he's an orphan. I hate the way I am treated by your company and the abusive debt collectors in this complaint. I will not tolerate this disrespect for much longer… and I mean it.`,
    includesScreenshots: true,
  },

  9: {
    headline: "CRIMINAL PENALTY: 15 USC 1681q obtaining/furnishing information under a false pretense.",
    statute: "15 USC 1681q",
    openingParagraph: `Did you know under the FCRA anyone who obtains or furnishes consumer information under a false pretense can be charged for a criminal penalty? Well, it's true and it's been proven in the following court case, Northrop v. Hoffman of Simsbury, Inc., 134 F.3d 41, 49. In this case, they clearly explain, if someone gets ahold of a consumer's information without his express consent—that person may be ruthlessly held under the same constraints as a savage criminal. And for this reason, if {bureauName} does not delete the collection items in this complaint you may suffer the same fate as a criminal.`,
    bodyParagraphs: [
      `I have never allowed {debtCollectorNames} to use my identification information to create an account on my credit report. In fact, I never allowed them to report any information on my credit report. This is why they will be charged under criminal penalty once I submit a complaint to the Office Of Inspector General (who is the supreme authority that handles criminal violations under the United States Code).`,
      `I have already submitted a complaint against the debt collectors listed in this dispute and if {bureauName} wishes to stay out of this… I suggest you delete the following information from my credit report right away. Otherwise, I will submit a civil rights complaint against your agency after my next credit report update.`,
    ],
    demandSection: DEMAND_LANGUAGE.R7_PLUS,
    consumerStatement: `The debt collectors in this dispute have used my identification information to launch a credit transaction under my name. They have then taken the same information and used it to create an account on my credit report, therefore, furnishing the information. This is viewed as a criminal violation which can lead to further punishment under 15 USC 1681q. So if you wish to stay out of this battle, delete the illegal information from my credit report.`,
    includesScreenshots: true,
  },

  10: {
    headline: "FALSE AND DECEPTIVE PRACTICE SPOTTED: 15 USC 1692e(10).",
    statute: "15 USC 1692e(10)",
    openingParagraph: `A long time ago, I contacted {debtCollectorNames} and requested verification of the reported debt. The debt collector not only did not send the requested verification, but they kept furnishing the invalidated item on my credit report. This makes the listed debt collectors willfully liable for committing false and deceptive collection practices under 15 USC 1692e(10).`,
    bodyParagraphs: [
      `You see, according to the FDCPA, whenever someone breaks the law for any violation of the FDCPA they are automatically liable for using false and deceptive practices. However, our situation is much worse because not only did the listed debt collectors break the law… but they did it intentionally. How do I know this? Simply because I have submitted numerous disputes to your agency and straight to the collectors in this complaint. Yet, in their response, they refused to produce ANY VERIFICATION at all.`,
      `Therefore, all collection actions should've been ceased about 8 months ago (including credit reporting). What does this mean to you? Well, 2 things… first this proves you did not investigate beyond the data furnisher… and secondly, it proves you are furnishing unverified information. So if you would like to avoid a joint complaint filed against {bureauName} and the debt collectors in this complaint, you should delete the illegal collection items from my credit report.`,
      `I mean wouldn't that be the right thing to do? Only if you're in compliance with the FCRA and FDCPA that is…`,
    ],
    demandSection: DEMAND_LANGUAGE.R7_PLUS,
    consumerStatement: `I have been barred from receiving credit because of this misinformation and I hope this ends today. Please relentlessly review my dispute and in your investigation request verification from the data furnishers. And once they ignore you the same way they have ignored me… you will have to delete the illegal items from my credit report instantly.`,
    includesScreenshots: true,
  },

  11: {
    headline: "CEASE OF COMMUNICATION IS MANDATORY: 15 USC 1692c(c)(2).",
    statute: "15 USC 1692c(c)(2)",
    openingParagraph: `If you do not remove the following collection accounts, {debtCollectorNames}, from my credit report within 30 days, you may be forced to pay monetary damages.`,
    bodyParagraphs: [
      `You see, I already told the debt collectors I refuse to pay the debts unless they can provide me verification (from the original creditor). And since I haven't gotten any verification, the collection items are currently under a legal cease of communication, therefore, any continued furnishing of the collection items makes you liable for a violation of 15 USC 1692c(c)(2).`,
      `Why is it illegal to report the collection items after I refused to pay the debt collector? Simply because, according to the FDCPA, communication means, "conveying of information about a debt directly or indirectly to any person through any medium." Therefore, according to the legal definition of communication, reporting unverified debts to a credit reporting agency (or CRA) is considered an indirect communication.`,
      `And for this reason, the collection items in this dispute legally cannot be on my credit report under 15 USC 1692c(c)(2). And the statute clearly states, if I submit a refusal of payment to the debt collectors in writing (which I have done), they can only communicate with me by one of three ways: (1) to tell me collection effort is being terminated, (2) to tell me the creditor plans to sue me, or (3) to tell me I am being sued.`,
      `Besides those three statements, the debt collectors literally cannot tell me anything else… including reporting account information on my credit report. Therefore, by law, you must delete the following collection items instantly.`,
    ],
    demandSection: DEMAND_LANGUAGE.R7_PLUS,
    consumerStatement: `My credit score is sinking by the minute, and I cannot use my credit if my life depended on it. This is no way to live in America because, as you know, without my credit I cannot buy a house, get a car, or basically make any big purchase. In fact, I am dead broke without my credit and the sole reason I cannot use it is because of the illegal items you are (knowingly) reporting. If these items are not deleted within 30 days you can expect legal consequences trailblazing your way.`,
    includesScreenshots: true,
  },

  12: {
    headline: "15 USC 1681b(a)(3)(a)—Account In Violation For Reporting a Transaction I Was Not Involved In.",
    statute: "15 USC 1681b(a)(3)(a)",
    openingParagraph: `Imagine if someone took your credit card information without telling you and used it to make purchases, which led to you receiving an invitation to court. You wouldn't like that, would you? Okay, now imagine, instead of your credit card, they took your social security card and identification information to create a negative account on your credit report—by making a whole transaction you have absolutely nothing to do with.`,
    bodyParagraphs: [
      `This is the horrible act {debtCollectorNames} has done to me. I have no relation to these accounts reporting on my credit report. In fact, the only communication I have with these criminals is my dispute letters to remove the account. I don't know how they got my information… I don't know why these accounts are on my credit report… but what I do know is, I never gave these data furnishers my authorization to initiate the transaction they are reporting on my credit report.`,
      `And for this reason, these accounts must be deleted right away under 15 USC 1681b(a)(3)(a) because they do not have a permissible purpose to be on my credit report. You see, according to the statute, any account publishing information about a transaction I was not involved in—is NOT ALLOWED TO BE IN MY CREDIT REPORT.`,
      `These accounts are ruining my life. I am embarrassed about my credit score, whenever someone brings it up I try to change the subject as fast as I can. Sometimes, I'll even pretend like I'm getting a phone call to escape the conversation. This is a deep secret of mine which I am ruthlessly trying to get out of… and I can only free myself from this nightmare… once you follow the law and delete the information furnished without a permissible purpose.`,
    ],
    demandSection: DEMAND_LANGUAGE.R7_PLUS,
    consumerStatement: `All accounts in this dispute are furnishing without a permissible purpose. I was never involved in a transaction with the listed debt collectors and refuse to tolerate your illegal practice for much longer. Delete this information so I can go back to living my regular life please. Otherwise, I will have to seek monetary reward for the trauma you have caused me.`,
    includesScreenshots: true,
  },
};

// =============================================================================
// CONSENT FLOW TEMPLATES (R1-R3)
// =============================================================================

export const CONSENT_TEMPLATES: Record<number, Omit<RoundTemplate, "round" | "flow">> = {
  1: {
    headline: "Legal Breach of 15 USC 1681b(a)(2)—Reporting accounts without a permissible purpose.",
    statute: "15 USC 1681b(a)(2)",
    openingParagraph: `You have stepped on and run over my privacy rights by reporting accounts without my written authorization. And for this reason, you are facing serious legal penalties under 15 USC 1681b(a)(2). This is a real issue, a viscous one (for your company's legal team that is). I'm talking about invasion of privacy, willful neglect, and furnishing information with intention to damage my personal image. This allows me to seek a claim for defamation of character on top of all the FCRA monetary damages you will have to pay.`,
    bodyParagraphs: [
      `So if avoiding a 5 figure lawsuit interests you at all, I suggest you pay close attention to the rest of this letter. Now, of course, I have not been able to use my credit for the last couple of months because of these illegal accounts. Nor have I been able to move apartments, buy a car, or even get a simple credit card to help cover some bills. No, not at all. In fact, I have been stuck at work putting in overtime because you do not follow your duties of the FCRA.`,
      `Therefore, I have piled up an outstanding amount of damages from your agency's disgusting acts. You have placed accounts on my credit report without getting my prior written consent (which is mandatory for all CRAs before broadcasting new information). This confirms the accounts listed below are furnishing without a permissible purpose.`,
      `So unless you can produce a previous agreement between me and {bureauName} which shows mutual assent (which is a signature from each party and is mandatory for a contract to be valid), you will be guilty (in the court of law) for releasing my information without a permissible purpose, which is a clear breach of 15 USC 1681b(a)(2).`,
    ],
    demandSection: DEMAND_LANGUAGE.R1,
    consumerStatement: `I do not consent to the information furnished in this dispute. You do not have my permission to release my nonpublic personal information (including all accounts in this complaint). Therefore, by law, you must remove the disputed items today. Otherwise, I will have to transfer my complaint to a federal circuit court (which will expend much more time and money for your company, than simply deleting the illegal information would.)`,
    includesScreenshots: false,
  },

  2: {
    headline: "MAJOR PUNISHMENT PENDING: 15 U.S.C. 1681a(4)—Privacy invasion… damages owed!",
    statute: "15 USC 1681a(4)",
    openingParagraph: `Did you know the CFPB holds an invasion of privacy to a criminal liability? Well, unfortunately for {bureauName} you may be facing criminal sanctions, very soon, if the illegal information is not deleted from my credit report. I'm only saying this because, in a recent CFPB article, congress explained, any credit agency that furnishes consumer information without a permissible purpose, can face criminal penalties or imprisonment.`,
    bodyParagraphs: [
      `Here is the article that explains the criminal punishment {bureauName} may be facing: https://www.consumerfinance.gov/about-us/newsroom/cfpb-issues-advisory-to-protect-privacy-when-companies-compile-personal-data/.`,
      `This brings me to my next point. In my last letter you received on {lastDisputeDate}, I explained how specific accounts are furnishing without a permissible purpose. Since then, 30 days have breezed by, yet these illegal items are still flaunting on my credit report, like a clown in a dunk tank (hollering and screaming for every creditor to see). And for this reason, I have not been able to use my credit as if it is a vending machine that was out of order.`,
      `If I was able to use my credit, I would not be jumping around from job to job trying to make ends meet. If I was able to use my credit, I would not be spending one hour (4 times a week) calling friends and family members asking for money to pay rent (so I don't get evicted). If I was able to use my credit, I would not be a living embarrassment for my family, who gets laughed at by everyone who knows my, gut-twisting, credit secret that has me sick to stomach every time I think about it.`,
      `Worst of all, this could've all been avoided if {bureauName} listened to your legal duties under 15 USC 1681a(4). By respecting my right to privacy and deleting the information furnishing without a permissible purpose. But you didn't. Instead, you believe, you are above the law—which has left you facing a (potential) criminal penalty under the FCRA.`,
      `However, I am willing to drop my claim, after all the damage you've already done to me, but only if you delete the following information from my credit report right away:`,
    ],
    demandSection: DEMAND_LANGUAGE.R2,
    consumerStatement: `All items in this dispute are furnishing without my consent. Therefore, the placement of these accounts on my credit report is a direct invasion of my privacy rights. A privacy invasion under the FCRA, is charged under criminal penalty (according to the CFPB article I attached in the first paragraph of this dispute). I suggest you review the article to see why your company is in serious trouble if these items do not get deleted from my credit report.`,
    includesScreenshots: true,
  },

  3: {
    headline: "SANCTION OF 15 U.S.C. 1681a(d)(a)(2)(B)—Furnishing Excluded Information.",
    statute: "15 USC 1681a(d)(a)(2)(B)",
    openingParagraph: `{bureauName} is furnishing illegal accounts on my credit report. The accounts in this complaint, are supposed to be excluded from credit reporting under 15 USC 1681a(d)(a)(2)(B)—because they are furnishing a specific extension or authorization of credit from a credit card or similar device.`,
    bodyParagraphs: [
      `You see, to create the accounts in this complaint the following creditors issued me a credit card. This credit card was used to make purchases or, if you want to get technical about it, consumer transactions. Whenever a consumer transaction is initiated a specific extension of credit gets authorized (and that is how a payment is made). These are the same payments or, specific extensions of credit, {bureauName} is illegally furnishing on my credit report.`,
      `And for this reason, my credit score dropped significantly. My score tanked down so far that I literally cannot get credit at all. This ruined my lifestyle because I used to depend pretty heavily on my credit for all my household expenses. And now, without the help of my credit, I am living under extreme conditions. I am babysitting animals, doing Uber Eats, and desperately searching for any other job I can find until I fix this issue.`,
      `And when you think it can't get any worse than this… the only reason I am facing such horrible conditions is because {bureauName} is furnishing information that is legally not allowed to be on my credit report, according to 15 USC 1681a(d)(a)(2)(B). 15 USC 1681a(d)(a)(2)(B) is, according to FCRA definition, excluded information from a credit report. Yet… the accounts below are a blistering hematoma on my credit report.`,
    ],
    demandSection: DEMAND_LANGUAGE.R3,
    consumerStatement: `Every account in this complaint is furnishing information that is either a specific extension of credit or an authorization of credit from a credit card or similar device. And for this reason, all the items must be deleted under 15 USC 1681a(d)(a)(2)(B) because this information is, legally, not allowed to be in a credit report.`,
    includesScreenshots: true,
  },

  4: {
    headline: "FOURTH DEMAND—Permissible Purpose Challenge Under 15 USC 1681b",
    statute: "15 USC 1681b",
    openingParagraph: `This is my fourth time writing about the same unauthorized accounts. I've explained the law. I've cited the statutes. I've given you more than enough time. And still, {bureauName} continues to report accounts that I never authorized and that have no permissible purpose under 15 USC 1681b.`,
    bodyParagraphs: [
      `Let me be absolutely clear: I never gave written consent for these accounts to appear on my credit report. The FCRA requires that before any information is reported, there must be a permissible purpose. Where is your permissible purpose? I've asked before and received no answer.`,
      `Under 15 USC 1681b, you can only report information if you have written instructions from the consumer, a court order, or a legitimate credit transaction. None of these apply here. These accounts were placed without my authorization, and you have been unable to produce any documentation proving otherwise.`,
      `The continued presence of these unauthorized accounts has cost me real money. I've been denied for credit cards, apartments, and financing that would have helped my family. Every month you delay is another month of damage.`,
    ],
    demandSection: DEMAND_LANGUAGE.R4,
    consumerStatement: `I'm running out of patience. Four letters. Four times explaining the same law. Four times asking for the same simple thing: remove the accounts that were never authorized. If you cannot produce my written consent, you have no legal right to report this information. Delete it now.`,
    includesScreenshots: true,
  },

  5: {
    headline: "FIFTH NOTICE—CFPB Complaint Being Prepared Under 15 USC 1681b(c)",
    statute: "15 USC 1681b(c)",
    openingParagraph: `I am now preparing a formal complaint to the Consumer Financial Protection Bureau. {bureauName} has ignored my previous four disputes regarding unauthorized accounts that lack any permissible purpose under the Fair Credit Reporting Act.`,
    bodyParagraphs: [
      `The CFPB takes privacy violations seriously. Under 15 USC 1681b(c), furnishing consumer information without a permissible purpose is a clear violation. I have documented each of my disputes, the dates they were sent, and your failure to respond appropriately.`,
      `Before I file, I am giving you one more opportunity to correct this. The CFPB complaint will include all correspondence, the unauthorized accounts in question, and a detailed timeline of your non-compliance. This will become part of your regulatory record.`,
      `I don't want to escalate this. I want the unauthorized information removed. But if you continue to ignore my legitimate concerns about accounts reported without my consent, I have no other option.`,
    ],
    demandSection: DEMAND_LANGUAGE.R5,
    consumerStatement: `This is my fifth dispute. I have been more than patient. The accounts listed below were never authorized by me, and you have failed to provide any evidence of a permissible purpose. Remove them now, or I will proceed with my CFPB complaint within 10 business days.`,
    includesScreenshots: true,
  },

  6: {
    headline: "SIXTH NOTICE—State Attorney General Notification Under FCRA Privacy Provisions",
    statute: "15 USC 1681n",
    openingParagraph: `Along with my CFPB complaint, I am now copying my state Attorney General's office on this matter. {bureauName}'s continued reporting of accounts without my written authorization constitutes a willful violation of the Fair Credit Reporting Act.`,
    bodyParagraphs: [
      `Under 15 USC 1681n, willful noncompliance with the FCRA allows me to recover actual damages, punitive damages, and attorney's fees. Your refusal to investigate and remove unauthorized accounts after six separate disputes demonstrates willfulness.`,
      `State Attorneys General have the authority to bring actions against credit reporting agencies for pattern violations. My documentation shows a clear pattern: repeated disputes, no meaningful investigation, and no correction of accounts that were never authorized.`,
      `I have kept copies of every letter, every response, and every credit report showing these unauthorized accounts. This evidence will be included in my regulatory complaints and any future legal action.`,
    ],
    demandSection: DEMAND_LANGUAGE.R6,
    consumerStatement: `Six times I've asked. Six times you've ignored the law. I never authorized these accounts. You cannot produce my written consent. Under the FCRA, you have no right to report them. This is your final warning before regulatory action proceeds.`,
    includesScreenshots: true,
  },

  7: {
    headline: "SEVENTH DEMAND—Legal Counsel Engaged Under 15 USC 1681n(a)(1)(A)",
    statute: "15 USC 1681n(a)(1)(A)",
    openingParagraph: `I have now retained legal counsel to review my options regarding {bureauName}'s continued privacy violations. My attorney has reviewed all seven of my disputes and your responses—or lack thereof.`,
    bodyParagraphs: [
      `Under 15 USC 1681n(a)(1)(A), I am entitled to actual damages for each violation. My attorney has calculated preliminary damages including: denied credit applications, higher interest rates on existing credit, emotional distress, and time spent disputing these unauthorized accounts.`,
      `Additionally, 15 USC 1681n allows for punitive damages when violations are willful. Seven disputes with no meaningful correction strongly suggests willfulness. My attorney believes a jury would agree.`,
      `I am not looking for a lawsuit. I am looking for {bureauName} to follow the law and remove accounts that were reported without my authorization. But if legal action is the only way to get compliance, that option is now on the table.`,
    ],
    demandSection: DEMAND_LANGUAGE.R7_PLUS,
    consumerStatement: `My attorney has all documentation ready for filing. The unauthorized accounts below must be deleted immediately. This is not a threat—it is a statement of fact about where this dispute is headed if you continue to violate my privacy rights under the FCRA.`,
    includesScreenshots: true,
  },

  8: {
    headline: "EIGHTH AND PRE-LITIGATION NOTICE—Demand for Immediate Deletion",
    statute: "15 USC 1681n, 15 USC 1681o",
    openingParagraph: `This letter serves as formal pre-litigation notice. I have exhausted every reasonable effort to resolve this matter with {bureauName} directly. Eight separate disputes over unauthorized accounts have been met with willful disregard for my privacy rights under the FCRA.`,
    bodyParagraphs: [
      `My legal team has now prepared a draft complaint for filing in federal court. The complaint will allege willful violations under 15 USC 1681n and negligent violations under 15 USC 1681o. We are seeking actual damages, punitive damages, and attorney's fees.`,
      `The accounts in question were never authorized by me. You have never produced my written consent because it does not exist. Every day these accounts remain on my report is another day of violation.`,
      `This is your final opportunity to resolve this matter without litigation. I am willing to accept deletion of all unauthorized accounts and a letter confirming the correction. Once the complaint is filed, this offer is withdrawn.`,
    ],
    demandSection: DEMAND_LANGUAGE.R7_PLUS,
    consumerStatement: `Eight disputes. No resolution. No evidence of authorization. The path forward is clear: delete the unauthorized accounts within 10 days of receiving this letter, or respond to the federal complaint that will follow.`,
    includesScreenshots: true,
  },

  9: {
    headline: "NINTH NOTICE—Final Demand Before Federal Court Filing",
    statute: "15 USC 1681n(a)(2)",
    openingParagraph: `This is my ninth and final attempt at direct resolution. {bureauName} has demonstrated a pattern of willful noncompliance with the Fair Credit Reporting Act that my attorneys believe warrants significant punitive damages under 15 USC 1681n(a)(2).`,
    bodyParagraphs: [
      `The case law is clear. In Cushman v. Trans Union, the court found that failure to maintain reasonable procedures after being notified of errors constitutes willfulness. I have notified you nine times. Your procedures have clearly failed.`,
      `Punitive damages in FCRA cases have ranged from $5,000 to $100,000 depending on the egregiousness of the conduct. Nine ignored disputes regarding unauthorized accounts demonstrates exactly the kind of conduct courts punish.`,
      `My attorneys are ready to file. The only question is whether {bureauName} wants to resolve this matter now or defend it in federal court. The choice is yours, but my patience has run out.`,
    ],
    demandSection: DEMAND_LANGUAGE.R7_PLUS,
    consumerStatement: `Nine times. Nine chances to do the right thing. The accounts below were never authorized, and you have never produced evidence otherwise. Delete them within 5 business days or prepare to receive service of process.`,
    includesScreenshots: true,
  },

  10: {
    headline: "FINAL ULTIMATUM—Litigation Proceeds Without Further Notice",
    statute: "15 USC 1681n, 15 USC 1681o, 15 USC 1681b",
    openingParagraph: `This is my final communication before filing suit. {bureauName}'s conduct over the past ten disputes has been documented, analyzed, and prepared for presentation to a federal judge. My attorneys are confident in the strength of our case.`,
    bodyParagraphs: [
      `We will be seeking: (1) Actual damages for denied credit, higher interest rates, and emotional distress; (2) Punitive damages for willful violation of the FCRA; (3) Attorney's fees and costs; and (4) Injunctive relief requiring deletion of all unauthorized accounts.`,
      `The complaint will detail ten separate disputes, your failure to investigate, your failure to produce evidence of authorization, and your continued reporting of accounts without a permissible purpose. A jury will decide whether this conduct was reasonable.`,
      `If you wish to avoid litigation, you have 48 hours from receipt of this letter to delete all unauthorized accounts and provide written confirmation. After that deadline, no settlement will be considered until after discovery.`,
    ],
    demandSection: DEMAND_LANGUAGE.R7_PLUS,
    consumerStatement: `Ten disputes. Zero compliance. The unauthorized accounts listed below have damaged my credit, my reputation, and my family's financial stability. This ends now—either through your voluntary deletion or through the federal courts.`,
    includesScreenshots: true,
  },
};

// =============================================================================
// LATE PAYMENT TEMPLATES (Consent Flow variant)
// =============================================================================

export const LATE_PAYMENT_TEMPLATES: Record<number, Omit<RoundTemplate, "round" | "flow">> = {
  1: {
    headline: "ILLEGAL LATE PAYMENT TRANSACTIONS: 15 USC 1681a(d)(a)(2)(a)(i)—this information must be excluded by law.",
    statute: "15 USC 1681a(d)(2)(A)(i)",
    openingParagraph: `I'm reaching out because there's something seriously off about how my report is being handled — and I'm asking that you correct it immediately. Certain late payments are being reported as if they're public or credit-related data, but they are actually private consumer transactions that should never appear on a credit report.`,
    bodyParagraphs: [
      `Under 15 U.S.C. §1681a(d)(2)(A)(i), transactions between me and a creditor for personal, family, or household purposes are non-public information and must be excluded. These are not "credit events" in the sense of public record reporting — they are personal exchanges between me and my creditor.`,
      `To make this clear, the Uniform Commercial Code (U.C.C. 3-103) defines a consumer transaction as one made for personal, family, or household use. Every transaction with the creditor(s) listed below fits that definition, meaning it cannot legally be reported as a "late payment."`,
    ],
    accountListIntro: `These so-called "late payments" are private consumer transactions and not part of any permissible purpose for a consumer report. By continuing to publish this information, {bureauName} is furnishing data that the law explicitly excludes.\n\nI'm requesting that you delete all late payment data tied to these personal transactions immediately and confirm that the information has been removed from my report.`,
    demandSection: DEMAND_LANGUAGE.R1,
    consumerStatement: `I've been dealing with the fallout from these errors for too long. These late payment notations are keeping me from getting credit to support my family — plain and simple. I've had to borrow under other people's names just to get basic things like a phone or a reliable car. It's humiliating, stressful, and unnecessary — all because of inaccurate reporting.\n\nI'm asking you directly and respectfully to fix this. Please remove the illegal information from my credit file so I can start rebuilding my life under fair and lawful conditions.`,
    includesScreenshots: false,
  },

  2: {
    headline: "Privacy Breach — Information Furnished Without Permissible Purpose 15 U.S.C. §1681a(4)",
    statute: "15 USC 1681a(4)",
    openingParagraph: `{bureauName}, I'm writing again because the same inaccurate items I disputed last month are still showing on my credit report. I've already explained that these late-payment entries are actually private consumer transactions that the law says must be excluded under 15 U.S.C. § 1681a(d)(2)(A)(i), yet you continue to publish them.`,
    bodyParagraphs: [
      `Because of this, I've been denied credit, embarrassed in front of lenders, and left feeling completely exposed. This situation has caused me real stress — it's not just numbers on a screen; it's my privacy and reputation on the line.`,
      `Your continued furnishing of these transactions is not just inaccurate — it's an invasion of my privacy under 15 U.S.C. § 1681a(4). According to Hodge v. Texaco, Inc., 975 F.2d 1093, only entities with firsthand knowledge are allowed to report late payments on a consumer report. You, as a third-party CRA, have no such firsthand relationship and therefore no authority to include these consumer transactions. The following accounts remain unlawfully reported and must be deleted:`,
    ],
    accountListIntro: `I am asking you to correct this immediately. These entries have caused measurable harm to my ability to obtain fair credit, and their continued presence leaves my personal information exposed for anyone who runs my file. Please delete the unlawful data within 30 days and confirm the removal in writing.`,
    demandSection: DEMAND_LANGUAGE.R2,
    consumerStatement: `I feel like my privacy has been stripped away. Every time a lender pulls my report, they see private details that were never meant to be public. I'm simply asking for what the law already provides — accuracy, privacy, and respect. Please remove these items so I can move forward with dignity and a fair opportunity to rebuild my credit.`,
    includesScreenshots: true,
  },
};

// =============================================================================
// COMBO FLOW TEMPLATES (R1-R4, R8-R12)
// R5-R7 switches to ACCURACY flow (handled in getEffectiveFlow)
// =============================================================================

export const COMBO_TEMPLATES: Record<number, Omit<RoundTemplate, "round" | "flow">> = {
  1: {
    headline: "DUAL VIOLATION DISPUTE—Accuracy Errors AND Collection Violations on Same Account",
    statute: "FCRA 1681e(b) & FDCPA 1692g",
    openingParagraph: `I'm writing about accounts that have multiple problems at once. Not only is the information being reported inaccurately, but these accounts were also placed by debt collectors who never validated the debts properly. This is a double violation of my rights under both the Fair Credit Reporting Act and the Fair Debt Collection Practices Act.`,
    bodyParagraphs: [
      `Let me explain what's happening: First, the basic information on these accounts is wrong. The balances don't match, the dates are off, and the status doesn't reflect reality. That's an accuracy violation under FCRA Section 1681e(b).`,
      `Second, these are collection accounts that were placed without proper debt validation under FDCPA Section 1692g. When a debt collector reports to the bureaus before validating a debt, they violate federal law. I never received proper validation for these debts, yet here they are on my credit report.`,
      `The combination of these issues has severely damaged my credit. I can't get approved for anything because these accounts show inaccurate balances from collectors who never proved I owed anything in the first place. This needs to stop.`,
    ],
    demandSection: DEMAND_LANGUAGE.R1,
    consumerStatement: `Every account listed below has two problems: the reported information is inaccurate AND the debt collector never provided proper validation. Under both the FCRA and FDCPA, these accounts should not be on my report. Please investigate both issues and delete any accounts that cannot be fully verified as accurate AND properly validated.`,
    includesScreenshots: false,
  },

  2: {
    headline: "SECOND NOTICE—Combined FCRA/FDCPA Violations Remain Unresolved",
    statute: "FCRA 1681i & FDCPA 1692g(b)",
    openingParagraph: `Last month I disputed accounts that have both accuracy problems and collection violations. I explained that the information is wrong AND that the collectors never validated these debts. Nothing has changed. The same accounts with the same errors are still damaging my credit.`,
    bodyParagraphs: [
      `Under FCRA Section 1681i, you had 30 days to conduct a reasonable reinvestigation. Instead, it appears you simply verified the information with the same collectors who reported it incorrectly in the first place. That's not a reasonable investigation.`,
      `Meanwhile, under FDCPA Section 1692g(b), these collectors should have ceased collection activity—including credit reporting—until they validated these debts. They never did. They're violating federal law every day these accounts remain on my report.`,
      `I've now been denied credit twice more since my first dispute. Each denial adds to my damages. Each day these dual violations continue makes your liability greater.`,
    ],
    demandSection: DEMAND_LANGUAGE.R2,
    consumerStatement: `Two violations per account. Two chances to fix this. Zero action from {bureauName}. The accounts below are inaccurate AND were reported without proper debt validation. I'm asking again: conduct a real investigation of both issues and delete any accounts that fail either test.`,
    includesScreenshots: true,
  },

  3: {
    headline: "THIRD DEMAND—Method of Verification Required for Combined Violations",
    statute: "FCRA 1681i(a)(6)(B)(iii) & FDCPA 1692j",
    openingParagraph: `Three disputes later, I still have accounts on my report that are both inaccurate AND were placed by collectors who never validated the underlying debts. I'm now demanding that you provide the method of verification for each account, as required by FCRA Section 1681i(a)(6)(B)(iii).`,
    bodyParagraphs: [
      `When you investigated my disputes, how did you verify the accuracy of the information? What documents did the collectors provide? Did they provide proof of the original debt? Did they show payment history from the original creditor? I have a right to know.`,
      `Under FDCPA Section 1692j, debt collectors cannot use deceptive forms or documents in collection activities. Reporting unvalidated debts to credit bureaus with inaccurate information is exactly the kind of deceptive practice this law prohibits.`,
      `I need answers. How can the same information that I proved was inaccurate come back "verified"? What verification method did you use? Who provided the documents? These are not unreasonable questions.`,
    ],
    demandSection: DEMAND_LANGUAGE.R3,
    consumerStatement: `Three rounds of disputes. The same accounts with the same problems. I want to see the verification documents. Show me how these collectors proved both that the information is accurate AND that they properly validated these debts. If you can't, delete them.`,
    includesScreenshots: true,
  },

  4: {
    headline: "FOURTH NOTICE—Demanding Investigation of Furnisher Duties Under FCRA and FDCPA",
    statute: "FCRA 1681s-2(b) & FDCPA 1692e",
    openingParagraph: `This is my fourth dispute about accounts with combined accuracy and collection violations. I've asked for method of verification. I've cited both FCRA and FDCPA. I've explained the dual violations. And still, {bureauName} has failed to properly investigate.`,
    bodyParagraphs: [
      `Under FCRA Section 1681s-2(b), when a furnisher receives notice of dispute, they must conduct their own investigation. The collectors furnishing these accounts have a duty to verify the accuracy of what they report. Have they done that? Show me the evidence.`,
      `Under FDCPA Section 1692e, debt collectors cannot use false, deceptive, or misleading representations. Reporting debts they cannot validate with inaccurate information is both false and misleading. These collectors are breaking the law.`,
      `I have been patient. I have followed the process. I have cited the law. At some point, patience runs out. We're approaching that point.`,
    ],
    demandSection: DEMAND_LANGUAGE.R4,
    consumerStatement: `Four disputes documenting the same dual violations. The accounts below are inaccurate. The collectors never validated the debts. Both laws are being broken. How many more times do I need to say it before someone at {bureauName} actually investigates?`,
    includesScreenshots: true,
  },

  // R5-R7 use ACCURACY templates (handled by getEffectiveFlow)

  8: {
    headline: "EIGHTH NOTICE—Return to Combined FCRA/FDCPA Claims After Accuracy Investigation",
    statute: "FCRA 1681n & FDCPA 1692k",
    openingParagraph: `I've spent rounds 5 through 7 focusing specifically on the accuracy issues with these accounts. Now I'm returning to the full picture: these accounts have BOTH accuracy violations under FCRA AND collection violations under FDCPA. Both sets of violations expose you to liability.`,
    bodyParagraphs: [
      `Under FCRA Section 1681n, willful noncompliance allows recovery of actual damages, punitive damages, and attorney's fees. Eight disputes with no meaningful correction demonstrates willfulness.`,
      `Under FDCPA Section 1692k, debt collectors who violate the Act are liable for actual damages, statutory damages up to $1,000, and attorney's fees. These collectors have been reporting unvalidated debts for months.`,
      `My attorneys have reviewed both sets of claims. The documentation of eight disputes, combined with the dual violations, creates a strong case for damages under both statutes.`,
    ],
    demandSection: DEMAND_LANGUAGE.R7_PLUS,
    consumerStatement: `Eight rounds. Two statutes violated. Zero meaningful investigation. The accounts below remain on my report with inaccurate information from collectors who never validated these debts. My patience and your time to fix this are both running out.`,
    includesScreenshots: true,
  },

  9: {
    headline: "NINTH NOTICE—Pre-Litigation Demand Under Combined FCRA and FDCPA Claims",
    statute: "FCRA 1681n(a)(1)(A) & FDCPA 1692k(a)",
    openingParagraph: `This serves as formal pre-litigation notice under both the Fair Credit Reporting Act and the Fair Debt Collection Practices Act. After nine disputes, the accounts in question remain on my report with inaccurate information from collectors who never validated the underlying debts.`,
    bodyParagraphs: [
      `My legal team has prepared a draft complaint alleging violations under both statutes. We will seek actual damages from the credit reporting failures, statutory damages from the collection violations, punitive damages for willful conduct, and attorney's fees.`,
      `The combined exposure under both laws is significant. FCRA allows unlimited punitive damages for willful violations. FDCPA provides statutory damages of up to $1,000 per violation. Nine documented disputes demonstrate a clear pattern.`,
      `This is your final opportunity to investigate properly and delete the accounts that cannot be verified as both accurate AND properly validated. After this letter, we proceed to litigation.`,
    ],
    demandSection: DEMAND_LANGUAGE.R7_PLUS,
    consumerStatement: `Nine disputes. Two federal statutes violated. Complete documentation of your failure to investigate. The accounts below must be deleted immediately, or the next document you receive will be a federal court complaint.`,
    includesScreenshots: true,
  },

  10: {
    headline: "TENTH AND FINAL NOTICE—Litigation Proceeds Under FCRA and FDCPA",
    statute: "FCRA 1681n, 1681o & FDCPA 1692k",
    openingParagraph: `This is my final communication before filing suit under both the Fair Credit Reporting Act and the Fair Debt Collection Practices Act. Ten disputes over multiple months have failed to produce any meaningful investigation of accounts that have dual violations.`,
    bodyParagraphs: [
      `The complaint is ready for filing. It alleges: (1) Willful violation of FCRA for failure to maintain reasonable procedures; (2) Willful violation of FCRA for failure to conduct reasonable reinvestigation; (3) Violation of FDCPA for reporting unvalidated debts; (4) Violation of FDCPA for using deceptive practices in collection.`,
      `We will be seeking: actual damages for all credit denials; statutory damages under FDCPA; punitive damages under FCRA; attorney's fees and costs; and injunctive relief requiring deletion and policy changes.`,
      `You have 48 hours from receipt of this letter to delete all accounts that cannot be verified as both accurate AND properly validated. After that deadline, we file.`,
    ],
    demandSection: DEMAND_LANGUAGE.R7_PLUS,
    consumerStatement: `Ten disputes. Two federal statutes. Complete failure to investigate. The accounts below have damaged my credit, my reputation, and my family's financial stability through dual violations of federal law. This ends now—through deletion or through the federal courts.`,
    includesScreenshots: true,
  },

  11: {
    headline: "FINAL ULTIMATUM—Federal Court Filing Imminent Under FCRA and FDCPA",
    statute: "FCRA 1681n, 1681o & FDCPA 1692k",
    openingParagraph: `I have exhausted all reasonable efforts to resolve these dual violations directly with {bureauName}. Eleven separate disputes have documented both accuracy violations under FCRA and collection violations under FDCPA. Your continued inaction leaves me no choice but litigation.`,
    bodyParagraphs: [
      `My attorneys will file in federal court within 5 business days. The complaint details eleven disputes, systematic failure to investigate, inaccurate reporting, and unvalidated collection accounts. Discovery will request all communications with the furnishers, all verification documents, and all policies regarding dispute handling.`,
      `Cases like this typically settle, but we are prepared to take this to trial if necessary. The documentation is comprehensive, the violations are clear, and juries tend to sympathize with consumers who have tried this hard to resolve things directly.`,
      `Final opportunity: delete all accounts that cannot be verified as both accurate AND properly validated within 72 hours. Provide written confirmation. After that, the complaint is filed and settlement discussions will only occur on our terms.`,
    ],
    demandSection: DEMAND_LANGUAGE.R7_PLUS,
    consumerStatement: `Eleven disputes. Two federal laws violated. Complete documentation of every failure. The accounts below must be deleted immediately. This is not negotiable. The only question is whether resolution happens now or in federal court.`,
    includesScreenshots: true,
  },

  12: {
    headline: "LITIGATION NOTICE—Federal Complaint Being Filed Under FCRA and FDCPA",
    statute: "FCRA 1681n, 1681o, 1681p & FDCPA 1692k",
    openingParagraph: `As of this letter, my attorneys are filing the federal complaint against {bureauName} and all furnishers of the disputed accounts. Twelve disputes over the past year have been met with willful disregard for my rights under both the Fair Credit Reporting Act and the Fair Debt Collection Practices Act.`,
    bodyParagraphs: [
      `The complaint has been finalized and includes: twelve documented disputes; evidence of inaccurate reporting; evidence of unvalidated collection debts; communications showing failure to investigate; and expert testimony on credit damage calculation.`,
      `We are filing under 15 USC 1681p (FCRA jurisdiction) and 15 USC 1692k (FDCPA jurisdiction). Venue is proper in this district. We are seeking actual damages, statutory damages, punitive damages, attorney's fees, and injunctive relief.`,
      `This letter serves as formal notice of the litigation. You will be served through your registered agent. All future communications should be directed to my attorneys. Settlement discussions remain possible but will require deletion of all disputed accounts plus damages.`,
    ],
    demandSection: DEMAND_LANGUAGE.R7_PLUS,
    consumerStatement: `Twelve rounds of disputes. Two federal statutes violated. No meaningful investigation. As of this letter, litigation proceeds. The accounts listed below will be the subject of federal court proceedings. You had twelve chances to make this right. You chose not to.`,
    includesScreenshots: true,
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Select a random body paragraph variant for each slot.
 * If bodyParagraphVariants exists, picks one variant per slot.
 * Otherwise falls back to bodyParagraphs.
 *
 * @param template - The round template
 * @param usedVariantCombos - Set of previously used variant combo strings (e.g., "0:2:1")
 * @returns Selected body paragraphs and the variant combo key
 */
export function selectBodyParagraphVariants(
  template: Omit<RoundTemplate, "round" | "flow">,
  usedVariantCombos: Set<string> = new Set()
): { paragraphs: string[]; variantComboKey: string } {
  if (!template.bodyParagraphVariants || template.bodyParagraphVariants.length === 0) {
    return {
      paragraphs: template.bodyParagraphs,
      variantComboKey: "default",
    };
  }

  // Try to find an unused combination (up to 50 attempts)
  for (let attempt = 0; attempt < 50; attempt++) {
    const indices: number[] = [];
    const selected: string[] = [];

    for (let i = 0; i < template.bodyParagraphVariants.length; i++) {
      const variants = template.bodyParagraphVariants[i];
      const idx = Math.floor(Math.random() * variants.length);
      indices.push(idx);
      selected.push(variants[idx]);
    }

    const comboKey = indices.join(":");
    if (!usedVariantCombos.has(comboKey)) {
      return { paragraphs: selected, variantComboKey: comboKey };
    }
  }

  // Fallback: random selection regardless of previous usage
  const selected = template.bodyParagraphVariants.map(
    variants => variants[Math.floor(Math.random() * variants.length)]
  );
  return {
    paragraphs: selected,
    variantComboKey: "fallback",
  };
}

/**
 * Select an opening paragraph variant for uniqueness.
 * Uses a seed for deterministic selection when provided.
 *
 * @param template - The round template
 * @param seed - Optional seed for deterministic randomization
 * @param usedVariantIndices - Set of previously used variant indices
 * @returns Selected opening paragraph and its index
 */
export function selectOpeningVariant(
  template: Omit<RoundTemplate, "round" | "flow">,
  seed?: string,
  usedVariantIndices: Set<number> = new Set()
): { paragraph: string; variantIndex: number } {
  // No variants available, use default
  if (!template.openingParagraphVariants || template.openingParagraphVariants.length === 0) {
    return {
      paragraph: template.openingParagraph,
      variantIndex: -1,
    };
  }

  const variants = template.openingParagraphVariants;

  // If seed provided, use deterministic selection
  if (seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(hash) % variants.length;
    return { paragraph: variants[idx], variantIndex: idx };
  }

  // Try to find an unused variant
  const availableIndices = Array.from({ length: variants.length }, (_, i) => i)
    .filter(i => !usedVariantIndices.has(i));

  if (availableIndices.length > 0) {
    const idx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    return { paragraph: variants[idx], variantIndex: idx };
  }

  // All used, pick random
  const idx = Math.floor(Math.random() * variants.length);
  return { paragraph: variants[idx], variantIndex: idx };
}

/**
 * Select a consumer statement variant for uniqueness.
 * Uses a seed for deterministic selection when provided.
 *
 * @param template - The round template
 * @param seed - Optional seed for deterministic randomization
 * @param usedVariantIndices - Set of previously used variant indices
 * @returns Selected consumer statement and its index
 */
export function selectConsumerStatementVariant(
  template: Omit<RoundTemplate, "round" | "flow">,
  seed?: string,
  usedVariantIndices: Set<number> = new Set()
): { statement: string; variantIndex: number } {
  // No variants available, use default
  if (!template.consumerStatementVariants || template.consumerStatementVariants.length === 0) {
    return {
      statement: template.consumerStatement,
      variantIndex: -1,
    };
  }

  const variants = template.consumerStatementVariants;

  // If seed provided, use deterministic selection
  if (seed) {
    // Use different hash multiplier than opening to avoid correlation
    let hash = 7;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 3) + hash + seed.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(hash) % variants.length;
    return { statement: variants[idx], variantIndex: idx };
  }

  // Try to find an unused variant
  const availableIndices = Array.from({ length: variants.length }, (_, i) => i)
    .filter(i => !usedVariantIndices.has(i));

  if (availableIndices.length > 0) {
    const idx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    return { statement: variants[idx], variantIndex: idx };
  }

  // All used, pick random
  const idx = Math.floor(Math.random() * variants.length);
  return { statement: variants[idx], variantIndex: idx };
}

/**
 * Get the appropriate template for a flow and round
 */
export function getTemplate(flow: FlowType, round: number): RoundTemplate | null {
  let template: Omit<RoundTemplate, "round" | "flow"> | undefined;

  switch (flow) {
    case "ACCURACY":
      template = ACCURACY_TEMPLATES[round];
      break;

    case "COLLECTION":
      // R5-R7 uses ACCURACY flow
      if (round >= 5 && round <= 7) {
        template = ACCURACY_TEMPLATES[round];
        if (template) {
          return { ...template, round, flow: "ACCURACY" };
        }
      }
      template = COLLECTION_TEMPLATES[round];
      break;

    case "CONSENT":
      template = CONSENT_TEMPLATES[round];
      break;

    case "COMBO":
      // COMBO flow has its own templates for R1-R4 and R8-R12
      // R5-R7 switch to ACCURACY (handled by getEffectiveFlow)
      if (round >= 5 && round <= 7) {
        template = ACCURACY_TEMPLATES[round];
      } else {
        template = COMBO_TEMPLATES[round];
        // Fallback to accuracy if combo template doesn't exist for this round
        if (!template) {
          template = ACCURACY_TEMPLATES[round];
        }
      }
      break;
  }

  if (!template) return null;

  return { ...template, round, flow };
}

/**
 * Check if a round should use screenshots
 */
export function shouldIncludeScreenshots(round: number): boolean {
  return round >= 2;
}

/**
 * Get the effective flow for a given round (handles flow switching)
 */
export function getEffectiveFlow(flow: FlowType, round: number): FlowType {
  if (flow === "COLLECTION" && round >= 5 && round <= 7) {
    return "ACCURACY";
  }
  if (flow === "COMBO" && round >= 5 && round <= 7) {
    return "ACCURACY";
  }
  return flow;
}
