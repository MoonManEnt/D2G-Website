/**
 * AMELIA Prompt Builder
 *
 * Builds comprehensive AI prompts for letter generation.
 * The prompt instructs the AI to generate unique, human-sounding letters
 * while maintaining legal compliance and proper structure.
 */

import type { CRA } from "@/types";
import type { FlowType } from "../amelia-templates";
import type { ConsumerVoiceProfile } from "../amelia-soul-engine";
import type { LegalFramework } from "./legal-frameworks";
import { getStatutesForPrompt, getCourtCasesForPrompt } from "./legal-frameworks";
import { getBlacklistForPrompt } from "./phrase-blacklist";
import { determineTone, TONE_DESCRIPTIONS } from "../amelia-doctrine";

// =============================================================================
// TYPES
// =============================================================================

export interface ClientContext {
  firstName: string;
  lastName: string;
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  ssnLast4: string;
  dateOfBirth?: string;
}

export interface AccountContext {
  creditorName: string;
  accountNumber: string;
  accountType: string;
  balance?: number;
  paymentStatus?: string;
  dateOpened?: string;
  issues: {
    code: string;
    description?: string;
  }[];
  inaccurateCategories: string[];
}

export interface PromptContext {
  client: ClientContext;
  accounts: AccountContext[];
  cra: CRA;
  flow: FlowType;
  round: number;
  voiceProfile: ConsumerVoiceProfile;
  legalFramework: LegalFramework;
  previousLetterExcerpts: string[];
  letterDate: string;
  lastDisputeDate?: string;
  debtCollectorNames?: string[];
  isBackdated: boolean;
  backdatedDays: number;
}

// =============================================================================
// CRA INFORMATION
// =============================================================================

const CRA_INFO: Record<CRA, { name: string; address: string[] }> = {
  EQUIFAX: {
    name: "Equifax Information Services, LLC",
    address: ["P.O. Box 740256", "Atlanta, GA 30374"],
  },
  EXPERIAN: {
    name: "Experian",
    address: ["P.O. Box 4500", "Allen, TX 75013"],
  },
  TRANSUNION: {
    name: "TransUnion LLC",
    address: ["P.O. Box 2000", "Chester, PA 19016"],
  },
};

// =============================================================================
// PROMPT SECTIONS
// =============================================================================

function buildDoctrineSummary(ctx: PromptContext): string {
  const tone = determineTone(ctx.round);
  const toneDescription = TONE_DESCRIPTIONS[tone];

  return `
=== AMELIA DOCTRINE (CORE RULES) ===

You are generating a dispute letter for Round ${ctx.round} of the ${ctx.flow} flow.

LETTER STRUCTURE (in this order):
1. OPENING - Personal impact story, unique life scenario
2. BODY FACTS - Legal arguments naturally woven with narrative
3. ACCOUNT LIST - Specific accounts with issues
4. CORRECTIONS - What must be corrected/deleted
5. CONSUMER STATEMENT - Emotional close with penalty reference

TONE FOR ROUND ${ctx.round}: ${tone}
${toneDescription}

CRITICAL RULES:
- Every sentence must be UNIQUE - never repeat template phrases
- Write as if you ARE the consumer, not writing FOR them
- Include specific personal details that make templating impossible
- Use contractions naturally (I'm, don't, can't, won't, it's)
- Vary sentence length and structure
- Express GENUINE emotion, not performed emotion
- Legal citations should flow naturally, not be announced
`.trim();
}

function buildVoiceProfile(profile: ConsumerVoiceProfile): string {
  const contractionGuidance = profile.ageRange === "18-29" || profile.ageRange === "30-44"
    ? "Use contractions frequently (I'm, don't, can't, won't, it's)"
    : profile.ageRange === "45-59"
      ? "Use contractions moderately"
      : "Use fewer contractions, slightly more formal";

  const styleGuidance: Record<string, string> = {
    conversational: "Write like you're explaining to a friend - natural, flowing, with occasional tangents",
    direct: "Get to the point - short sentences, clear demands, no fluff",
    measured: "Balanced approach - mix of explanation and direct statements",
    formal: "More structured, but still human - not robotic",
    assertive: "Strong, confident language - you know your rights",
  };

  const emotionGuidance: Record<string, string> = {
    confused: "Show genuine confusion about why this is happening",
    concerned: "Express worry about the impact on your life",
    frustrated: "Let frustration show through - you've been dealing with this",
    determined: "Focused and persistent - you won't give up",
    angry_controlled: "Angry but channeling it productively",
    exhausted: "Tired of fighting but still pushing forward",
    resolute: "Firm and unwavering - this ends now",
  };

  return `
=== VOICE PROFILE (Write in this voice) ===

Age Range: ${profile.ageRange}
Communication Style: ${profile.communicationStyle}
Emotional State: ${profile.emotionalState}
Legal Literacy: ${profile.legalLiteracy}
Formality Level: ${profile.grammarPosture}/4 (1=casual, 4=formal)
Life Stakes: ${profile.lifeStakes}
Dispute Fatigue: ${profile.disputeFatigue}

VOICE GUIDELINES:
- ${contractionGuidance}
- ${styleGuidance[profile.communicationStyle] || styleGuidance.direct}
- ${emotionGuidance[profile.emotionalState] || emotionGuidance.frustrated}

${profile.personalNarrativeElements && profile.personalNarrativeElements.length > 0
    ? `PERSONAL ELEMENTS TO INCORPORATE:\n${profile.personalNarrativeElements.map(e => `- ${e}`).join("\n")}`
    : ""}
`.trim();
}

function buildLegalFramework(framework: LegalFramework): string {
  return `
=== LEGAL FRAMEWORK (Weave these naturally) ===

Primary Statute: ${framework.statutes.primary}
Primary Code: ${framework.statutes.primaryCode}
${framework.statutes.secondary ? `Secondary: ${framework.statutes.secondary.join(", ")}` : ""}

REQUIRED LEGAL ELEMENTS (must appear naturally in letter):
${framework.requiredElements.map(e => `- ${e}`).join("\n")}

KEY ARGUMENTS TO MAKE:
${framework.keyArguments.map(a => `- ${a}`).join("\n")}

COURT CASES (cite if fits naturally):
${getCourtCasesForPrompt(framework)}

VIOLATIONS TO REFERENCE:
${framework.violationTypes.map(v => `- ${v}`).join("\n")}

DAMAGES CITATION: ${framework.damagesCitation}

TONE GUIDANCE: ${framework.toneGuidance}

DEADLINE TO STATE: ${framework.deadline}
`.trim();
}

function buildClientInfo(ctx: PromptContext): string {
  const craInfo = CRA_INFO[ctx.cra];

  return `
=== CLIENT INFORMATION ===

Consumer Name: ${ctx.client.fullName}
Address: ${ctx.client.addressLine1}${ctx.client.addressLine2 ? `, ${ctx.client.addressLine2}` : ""}
City/State/Zip: ${ctx.client.city}, ${ctx.client.state} ${ctx.client.zipCode}
SSN (last 4): XXX-XX-${ctx.client.ssnLast4}

Credit Bureau: ${craInfo.name}
Bureau Address: ${craInfo.address.join(", ")}

Letter Date: ${ctx.letterDate}
${ctx.lastDisputeDate ? `Previous Dispute Date: ${ctx.lastDisputeDate}` : ""}
${ctx.debtCollectorNames && ctx.debtCollectorNames.length > 0
    ? `Debt Collectors: ${ctx.debtCollectorNames.join(", ")}`
    : ""}
`.trim();
}

function buildAccountsList(accounts: AccountContext[]): string {
  const accountLines = accounts.map((account, index) => {
    const issuesList = account.issues
      .map(i => i.description || i.code)
      .filter(Boolean)
      .join("; ");

    return `
${index + 1}. ${account.creditorName}
   Account #: ${account.accountNumber}
   Type: ${account.accountType}
   ${account.balance ? `Balance: $${account.balance.toLocaleString()}` : ""}
   ${account.paymentStatus ? `Status: ${account.paymentStatus}` : ""}
   Issues: ${issuesList || "General inaccuracy"}
   Inaccurate Categories: ${account.inaccurateCategories.join(", ")}
`.trim();
  });

  return `
=== ACCOUNTS TO DISPUTE ===

${accountLines.join("\n\n")}
`.trim();
}

function buildPreviousLettersSection(excerpts: string[]): string {
  if (excerpts.length === 0) {
    return "";
  }

  return `
=== PREVIOUS LETTERS (DO NOT REPEAT ANY OF THIS) ===

The following excerpts are from previous letters. Your letter must be completely different.
Do NOT use similar phrases, sentence structures, or narrative elements.

${excerpts.slice(0, 3).map((excerpt, i) => `
--- Previous Letter ${i + 1} ---
${excerpt.substring(0, 500)}...
`).join("\n")}
`.trim();
}

function buildOutputStructure(): string {
  return `
=== OUTPUT STRUCTURE ===

Generate the letter with these EXACT section markers. The content between markers is your creative work.

<SECTION:HEADER>
[Generate the header with consumer info, date, and bureau address]
</SECTION:HEADER>

<SECTION:HEADLINE>
[Generate a compelling headline/subject line referencing the statute]
</SECTION:HEADLINE>

<SECTION:OPENING>
[Generate 2-3 paragraphs of personal impact story. Create a unique scenario that explains how these errors have affected the consumer's life. Include specific, believable details.]
</SECTION:OPENING>

<SECTION:BODY_FACTS>
[Generate 2-4 paragraphs weaving legal arguments with narrative. Cite statutes naturally. Reference relevant court cases if appropriate. Build the case for why the CRA has violated the law.]
</SECTION:BODY_FACTS>

<SECTION:ACCOUNT_LIST>
[Generate the account listing. For each account, explain what's wrong and why it must be corrected. Format it clearly but not robotically.]
</SECTION:ACCOUNT_LIST>

<SECTION:CORRECTIONS>
[Generate the corrections/demands section. List what must be corrected or deleted for each account. Be specific about what action is required.]
</SECTION:CORRECTIONS>

<SECTION:CONSUMER_STATEMENT>
[Generate the consumer statement - an emotional closing that summarizes the impact and stakes. Include a penalty warning appropriate to the round.]
</SECTION:CONSUMER_STATEMENT>

<SECTION:CLOSING>
[Generate the closing with signature line]
</SECTION:CLOSING>
`.trim();
}

// =============================================================================
// MAIN PROMPT BUILDER
// =============================================================================

/**
 * Build the complete AI prompt for letter generation
 */
export function buildFullLetterPrompt(ctx: PromptContext): string {
  const sections = [
    `You are AMELIA, an expert dispute letter writer. Generate a 100% unique dispute letter.`,
    "",
    buildDoctrineSummary(ctx),
    "",
    buildVoiceProfile(ctx.voiceProfile),
    "",
    buildLegalFramework(ctx.legalFramework),
    "",
    getBlacklistForPrompt(),
    "",
    buildClientInfo(ctx),
    "",
    buildAccountsList(ctx.accounts),
    "",
    buildPreviousLettersSection(ctx.previousLetterExcerpts),
    "",
    buildOutputStructure(),
    "",
    `
=== FINAL INSTRUCTIONS ===

1. Generate UNIQUE content - no two letters should ever be similar
2. Write as the ACTUAL consumer, not about them
3. Include specific personal details that make this letter impossible to template
4. Use contractions and natural language
5. Vary sentence lengths and structures
6. Express genuine emotion appropriate to Round ${ctx.round}
7. Cite legal statutes naturally, not robotically
8. NEVER use any phrase from the blacklist
9. Make every section distinct from any previous letter
10. The letter should pass the Kitchen Table Test - could a real frustrated consumer have written this?

Generate the letter now, using the section markers exactly as shown.
`.trim(),
  ];

  return sections.join("\n");
}

/**
 * Build a prompt for regenerating a single section
 */
export function buildSectionRegenerationPrompt(
  sectionName: string,
  currentContent: string,
  issues: string[],
  ctx: PromptContext
): string {
  return `
You need to regenerate the ${sectionName} section of a dispute letter.

CURRENT CONTENT (has problems):
${currentContent}

ISSUES TO FIX:
${issues.map(i => `- ${i}`).join("\n")}

VOICE PROFILE:
${buildVoiceProfile(ctx.voiceProfile)}

LEGAL CONTEXT:
${ctx.legalFramework.statutes.primary} (${ctx.legalFramework.statutes.primaryCode})

INSTRUCTIONS:
1. Regenerate this section completely differently
2. Fix all the issues listed above
3. Maintain the consumer's voice
4. Keep the legal requirements
5. Make it unique and human-sounding

Generate ONLY the new content for the <SECTION:${sectionName.toUpperCase()}> section.
`.trim();
}

/**
 * Get the estimated token count for a prompt
 */
export function estimatePromptTokens(prompt: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(prompt.length / 4);
}
