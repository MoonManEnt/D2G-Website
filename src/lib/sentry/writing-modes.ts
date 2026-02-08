/**
 * SENTRY WRITING MODES
 *
 * Configurable writing styles for dispute letters:
 * - PROFESSIONAL: Legal/formal tone (default, existing behavior)
 * - NORMAL_PEOPLE: Conversational, 8th-11th grade reading level,
 *   sounds like a real person wrote it (NOT AI, NOT English teacher)
 *
 * Normal People mode features:
 * - Colloquial, everyday language
 * - 8th-11th grade reading level
 * - Real-life impact stories (AI-generated, infinite, unique)
 * - Legal citations translated to plain English
 * - Intentional human imperfections in grammar
 * - Must STILL pass e-OSCAR compliance
 */

import type { SentryFlowType, SentryCRA } from "@/types/sentry";

// =============================================================================
// WRITING MODE TYPES
// =============================================================================

export type WritingMode = "PROFESSIONAL" | "NORMAL_PEOPLE";

export interface WritingModeConfig {
  mode: WritingMode;
  name: string;
  description: string;
  readingLevel: string;
  tone: string;
  features: string[];
}

export const WRITING_MODE_CONFIGS: Record<WritingMode, WritingModeConfig> = {
  PROFESSIONAL: {
    mode: "PROFESSIONAL",
    name: "Professional",
    description: "Formal legal language with proper citations",
    readingLevel: "College/Professional",
    tone: "Formal, legal, structured",
    features: [
      "Full legal citations with statute numbers",
      "Formal business letter format",
      "Technical credit reporting terminology",
      "Structured demands and timelines",
    ],
  },
  NORMAL_PEOPLE: {
    mode: "NORMAL_PEOPLE",
    name: "Normal People",
    description: "Conversational tone that sounds like a real person wrote it",
    readingLevel: "8th-11th grade",
    tone: "Conversational, relatable, human",
    features: [
      "Plain English explanations of rights",
      "Real-life impact stories",
      "Colloquial everyday language",
      "Authentic human voice",
    ],
  },
};

// =============================================================================
// STORY CONTEXT TYPES (for AI-generated impact stories)
// =============================================================================

export interface StoryContext {
  // The dispute type determines the story theme
  disputeType: "NOT_MINE" | "PAID" | "INACCURATE" | "TOO_OLD" | "UNAUTHORIZED" | "DUPLICATE" | "COLLECTION";

  // Account details for context
  creditorName: string;
  accountType?: string;
  balance?: number;

  // Client context (anonymous)
  clientContext?: {
    hasFamily?: boolean;
    isHomebuyer?: boolean;
    isCarbuyer?: boolean;
    isRenter?: boolean;
    isEmployed?: boolean;
    hasSmallBusiness?: boolean;
  };

  // Flow determines the severity of the story
  flow: SentryFlowType;
  round: number;
}

export interface GeneratedStory {
  // The unique impact story paragraph
  storyParagraph: string;

  // The emotional hook
  emotionalHook: string;

  // Why this matters in plain English
  whyItMatters: string;

  // ID for tracking (ensure no repeats)
  storyHash: string;
}

// =============================================================================
// DISPUTE TYPE TO STORY THEME MAPPING
// =============================================================================

/**
 * Maps e-OSCAR codes to dispute types for story theming
 * This ensures stories match the actual dispute reason
 */
export const EOSCAR_TO_DISPUTE_TYPE: Record<string, StoryContext["disputeType"]> = {
  // Not Mine / Identity Issues
  "001": "NOT_MINE",     // Not his/hers
  "103": "NOT_MINE",     // Account of consumer with similar name
  "104": "NOT_MINE",     // Result of identity fraud

  // Paid / Settled
  "107": "PAID",         // Paid in full
  "108": "PAID",         // Settled for less
  "111": "PAID",         // Paid/closed before going to collection

  // Inaccurate Information
  "105": "INACCURATE",   // Inaccurate dates
  "106": "INACCURATE",   // Inaccurate balance
  "109": "INACCURATE",   // Inaccurate account status
  "110": "INACCURATE",   // Inaccurate payment history

  // Too Old / Statute of Limitations
  "113": "TOO_OLD",      // Account is too old to report

  // Unauthorized
  "102": "UNAUTHORIZED", // Not authorized user

  // Duplicate
  "114": "DUPLICATE",    // Duplicate account
  "116": "DUPLICATE",    // Same creditor reporting multiple times

  // Collection specific
  "115": "COLLECTION",   // No knowledge of collection
  "117": "COLLECTION",   // Collection agency bought debt
};

// =============================================================================
// PLAIN ENGLISH LEGAL TRANSLATIONS
// =============================================================================

/**
 * Translates legal citations to plain English while maintaining legal validity
 */
export const PLAIN_ENGLISH_CITATIONS: Record<string, { formal: string; plain: string }> = {
  "FCRA_609": {
    formal: "Under 15 U.S.C. § 1681g (Section 609 of the FCRA)",
    plain: "There's a law called the Fair Credit Reporting Act that says I have the right to see what's in my file and you have to give me a copy",
  },
  "FCRA_611": {
    formal: "Pursuant to 15 U.S.C. § 1681i (Section 611 of the FCRA)",
    plain: "The law says you have 30 days to investigate when someone says something on their credit report is wrong",
  },
  "FCRA_623": {
    formal: "Under 15 U.S.C. § 1681s-2 (Section 623 of the FCRA)",
    plain: "The law says companies can't report things they know are wrong, and if I tell them something's wrong they have to look into it",
  },
  "FCRA_ACCURACY": {
    formal: "The FCRA requires consumer reporting agencies to follow reasonable procedures to assure maximum possible accuracy (15 U.S.C. § 1681e(b))",
    plain: "The credit reporting law says you're supposed to make sure the information is as accurate as possible - that's literally what the law requires",
  },
  "FDCPA_VALIDATION": {
    formal: "Pursuant to 15 U.S.C. § 1692g of the Fair Debt Collection Practices Act",
    plain: "The debt collection law says I have the right to ask you to prove I actually owe this money",
  },
  "30_DAY_DEADLINE": {
    formal: "As required by 15 U.S.C. § 1681i(a)(1)(A), you must complete your investigation within 30 days",
    plain: "You have 30 days to look into this - that's what the law says, it's not a request it's a requirement",
  },
  "DELETION_REQUIRED": {
    formal: "Unverifiable information must be deleted pursuant to 15 U.S.C. § 1681i(a)(5)",
    plain: "If you can't prove it's accurate, you have to take it off. That's the law",
  },
};

// =============================================================================
// HUMAN IMPERFECTION PATTERNS
// =============================================================================

/**
 * Patterns to add intentional human touches to letters
 * These make the letter sound MORE human, not less
 */
export const HUMAN_TOUCH_PATTERNS = {
  // Conversational starters
  starters: [
    "Look,",
    "Here's the thing -",
    "I need to tell you something.",
    "I'm writing because",
    "I don't know what else to do, so",
    "I've been trying to fix this for a while now, and",
  ],

  // Expressions of frustration (authentic)
  frustration: [
    "This has been really stressful.",
    "I can't tell you how much this has affected me.",
    "Every time I think I'm getting somewhere, something else comes up.",
    "I just want my credit to be accurate - is that too much to ask?",
    "I've done everything right and I'm still dealing with this.",
  ],

  // Everyday person language
  everyday: [
    "I'm not a lawyer or anything",
    "I don't really understand all the legal stuff",
    "I looked it up and found out",
    "From what I understand",
    "I might not know all the fancy terms but",
  ],

  // Authentic asks
  asks: [
    "Can you please look into this?",
    "I really need this fixed.",
    "Please help me sort this out.",
    "I'm counting on you to make this right.",
    "I hope you can help me.",
  ],

  // Natural closings
  closings: [
    "Thanks for reading all this.",
    "I appreciate you taking the time to look into this.",
    "Thank you for your help with this.",
    "I'm hoping to hear back from you soon.",
  ],
};

// =============================================================================
// READING LEVEL GUIDELINES
// =============================================================================

/**
 * Word substitutions to maintain 8th-11th grade reading level
 */
export const PLAIN_LANGUAGE_SUBSTITUTIONS: Record<string, string> = {
  "pursuant to": "according to",
  "hereby": "now",
  "aforementioned": "mentioned above",
  "herein": "in this letter",
  "thereafter": "after that",
  "notwithstanding": "even though",
  "consumer reporting agency": "credit bureau",
  "furnisher": "the company that reported this",
  "tradeline": "account on my credit report",
  "dispute resolution": "looking into my complaint",
  "verification procedure": "checking if this is correct",
  "reinvestigation": "second look at this",
  "maximum possible accuracy": "getting my information right",
  "willful noncompliance": "ignoring the law on purpose",
  "statutory damages": "money the law says you owe me if you mess up",
};

// =============================================================================
// STORY GENERATION PROMPTS
// =============================================================================

/**
 * Base prompt for generating unique impact stories
 * This is used with the LLM to generate infinite unique stories
 */
export function buildStoryGenerationPrompt(context: StoryContext): string {
  const disputeTypeDescriptions: Record<StoryContext["disputeType"], string> = {
    NOT_MINE: "an account on their credit report that isn't theirs (identity issue or mixed file)",
    PAID: "an account showing as unpaid or delinquent when they actually paid it",
    INACCURATE: "wrong information on an account (wrong balance, dates, or status)",
    TOO_OLD: "an account that's too old to legally be on their credit report anymore",
    UNAUTHORIZED: "an account they never authorized or agreed to",
    DUPLICATE: "the same account showing up multiple times on their report",
    COLLECTION: "a collection account they don't recognize or that has problems",
  };

  const flowEscalation: Record<SentryFlowType, string> = {
    ACCURACY: "first attempt to fix the problem",
    COLLECTION: "dealing with collection agencies",
    CONSENT: "unauthorized accounts or inquiries",
    COMBO: "multiple issues affecting their credit",
  };

  const clientContextDetails = context.clientContext
    ? `
The person writing has these life circumstances (pick 1-2 to weave into the story naturally):
${context.clientContext.hasFamily ? "- Has a family to support" : ""}
${context.clientContext.isHomebuyer ? "- Trying to buy a home" : ""}
${context.clientContext.isCarbuyer ? "- Needs a reliable car" : ""}
${context.clientContext.isRenter ? "- Having trouble finding an apartment" : ""}
${context.clientContext.isEmployed ? "- Their job does credit checks" : ""}
${context.clientContext.hasSmallBusiness ? "- Owns or starting a small business" : ""}
`.trim()
    : "";

  return `You are helping a regular person write about how a credit report error is affecting their life.
This is for a dispute letter to a credit bureau.

CRITICAL RULES:
1. Generate a COMPLETELY NEW and UNIQUE story every time - never repeat
2. Write at an 8th-11th grade reading level
3. Sound like a REAL PERSON, not an AI or English teacher
4. Include specific but realistic details
5. Show emotional impact without being dramatic or over-the-top
6. Keep it to 2-3 sentences max
7. Make it relatable - this is someone working hard in a capitalist society
8. NO fancy vocabulary, NO perfect grammar - this is everyday speech

THE SITUATION:
The person is dealing with ${disputeTypeDescriptions[context.disputeType]}.
The account is with: ${context.creditorName}
${context.balance ? `Amount showing: $${context.balance.toLocaleString()}` : ""}
This is their ${context.round === 1 ? "first" : context.round === 2 ? "second" : context.round === 3 ? "third" : "fourth"} ${flowEscalation[context.flow]}.

${clientContextDetails}

Generate a short personal impact statement. Examples of the STYLE (not content - make up new ones):

Bad (too formal): "This erroneous entry has significantly impacted my creditworthiness and caused financial hardship."

Good (human): "I tried to get a loan for a used car last month and got denied. The dealer showed me my credit report and there it was - this account I've never even seen before. My kids need me to get them to school."

Good (human): "I've been putting money aside for two years to buy a house. Last week I got pre-approved and was so excited, then this showed up and now the bank says they can't help me until I fix it."

Generate ONE unique impact story now. Just the story, no labels or explanations:`;
}

/**
 * Build the e-OSCAR compliant reason while keeping human voice
 */
export function buildPlainEnglishReason(
  eoscarCode: string,
  creditorName: string,
  accountDetails?: string
): string {
  // Map e-OSCAR codes to plain English reasons that still align with the code
  const reasonTemplates: Record<string, string[]> = {
    "001": [
      `This ${creditorName} account is not mine. I have never opened an account with this company and I don't recognize it at all.`,
      `I don't know where this ${creditorName} account came from. I've never done business with them and this isn't my account.`,
      `This account from ${creditorName} does not belong to me. I've checked my records and I have never had any dealings with this company.`,
    ],
    "103": [
      `I think this ${creditorName} account might belong to someone with a similar name. This is not my account and needs to be removed from my file.`,
      `There seems to be a mix-up - this ${creditorName} account is showing on my report but it's not mine. Maybe someone has a name like mine?`,
    ],
    "104": [
      `I am a victim of identity theft and this ${creditorName} account was opened fraudulently. I never authorized this account.`,
      `This ${creditorName} account was opened without my knowledge or permission. Someone stole my identity and opened this account.`,
    ],
    "105": [
      `The dates on this ${creditorName} account are wrong. ${accountDetails || "The account is showing incorrect date information that needs to be corrected."}`,
      `I'm disputing the dates reported for this ${creditorName} account because they don't match my records.`,
    ],
    "106": [
      `The balance shown for this ${creditorName} account is incorrect. ${accountDetails || "The amount being reported is not accurate."}`,
      `This ${creditorName} account is showing the wrong balance. I need this corrected because it's not what I actually owe.`,
    ],
    "107": [
      `I paid this ${creditorName} account in full and it should show as paid, not as owing money.`,
      `This account with ${creditorName} was paid off completely. Please update it to show paid in full.`,
    ],
    "108": [
      `I settled this ${creditorName} account and it should reflect that the matter is resolved.`,
      `This ${creditorName} account was settled. We came to an agreement and I held up my end.`,
    ],
    "109": [
      `The status showing for this ${creditorName} account is wrong. ${accountDetails || "The account status needs to be corrected."}`,
      `This ${creditorName} account is showing the wrong status. It needs to be updated to show the correct information.`,
    ],
    "113": [
      `This ${creditorName} account is too old to be on my credit report. It's past the 7 year limit and needs to be removed.`,
      `I believe this old ${creditorName} account should no longer be reported. It's been more than 7 years.`,
    ],
    "115": [
      `I don't recognize this collection account from ${creditorName}. I have no idea what this is for.`,
      `This collection from ${creditorName} is unfamiliar to me. I need information about what this supposedly is.`,
    ],
  };

  // Get random template for the code, or use generic
  const templates = reasonTemplates[eoscarCode];
  if (templates && templates.length > 0) {
    return templates[Math.floor(Math.random() * templates.length)];
  }

  // Generic fallback
  return `I am disputing this ${creditorName} account because the information being reported is not accurate and needs to be corrected or removed.`;
}

// =============================================================================
// LETTER TRANSFORMATION FUNCTIONS
// =============================================================================

/**
 * Transform a professional letter to Normal People mode
 */
export function transformToNormalPeople(
  letterContent: string,
  options: {
    includeStory?: string;
    preserveLegalBasis?: boolean;
  } = {}
): string {
  let content = letterContent;

  // Apply plain language substitutions
  for (const [formal, plain] of Object.entries(PLAIN_LANGUAGE_SUBSTITUTIONS)) {
    content = content.replace(new RegExp(formal, "gi"), plain);
  }

  // Transform legal citations to plain English (keeping the legal reference)
  for (const [key, citation] of Object.entries(PLAIN_ENGLISH_CITATIONS)) {
    if (options.preserveLegalBasis) {
      // Keep citation but add plain explanation
      content = content.replace(
        citation.formal,
        `${citation.plain} (${citation.formal})`
      );
    } else {
      // Replace with just plain English
      content = content.replace(citation.formal, citation.plain);
    }
  }

  // Add story if provided
  if (options.includeStory) {
    // Find a good place to insert the story (after opening, before demands)
    const demandIndex = content.toLowerCase().indexOf("demand") ||
                        content.toLowerCase().indexOf("request that you") ||
                        content.toLowerCase().indexOf("i am asking");

    if (demandIndex > 0) {
      const before = content.substring(0, demandIndex);
      const after = content.substring(demandIndex);
      content = `${before}\n\n${options.includeStory}\n\n${after}`;
    } else {
      // Append before closing
      const lastParagraph = content.lastIndexOf("\n\n");
      if (lastParagraph > 0) {
        const before = content.substring(0, lastParagraph);
        const after = content.substring(lastParagraph);
        content = `${before}\n\n${options.includeStory}${after}`;
      }
    }
  }

  return content;
}

/**
 * Add a random human touch from the patterns
 */
export function addHumanTouch(
  content: string,
  touchType: keyof typeof HUMAN_TOUCH_PATTERNS
): string {
  const touches = HUMAN_TOUCH_PATTERNS[touchType];
  const randomTouch = touches[Math.floor(Math.random() * touches.length)];

  switch (touchType) {
    case "starters":
      // Add at the beginning of the main content (after header/address)
      const bodyStart = content.indexOf("\n\n\n") || content.indexOf("Dear");
      if (bodyStart > 0) {
        const nextParagraph = content.indexOf("\n\n", bodyStart + 10);
        if (nextParagraph > 0) {
          return content.substring(0, nextParagraph + 2) +
                 randomTouch + " " +
                 content.substring(nextParagraph + 2);
        }
      }
      break;
    case "closings":
      // Add before signature
      const signatureIndex = content.lastIndexOf("Sincerely") ||
                            content.lastIndexOf("Thank you") ||
                            content.length - 50;
      return content.substring(0, signatureIndex) +
             "\n\n" + randomTouch + "\n\n" +
             content.substring(signatureIndex);
    case "frustration":
    case "asks":
      // Insert in the middle
      const middleIndex = Math.floor(content.length / 2);
      const nearestParagraph = content.indexOf("\n\n", middleIndex);
      if (nearestParagraph > 0) {
        return content.substring(0, nearestParagraph) +
               " " + randomTouch +
               content.substring(nearestParagraph);
      }
      break;
  }

  return content;
}

export function getWritingModeConfig(mode: WritingMode): WritingModeConfig {
  return WRITING_MODE_CONFIGS[mode];
}

export function getAvailableWritingModes(): WritingModeConfig[] {
  return Object.values(WRITING_MODE_CONFIGS);
}
