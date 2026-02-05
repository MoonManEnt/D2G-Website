/**
 * AMELIA V3 INTEGRATION
 *
 * This module integrates the Soul Engine, validation systems, and grammar posturing
 * framework with the existing letter generation system.
 *
 * V3 ENHANCEMENTS:
 * 1. Automatic Voice Profiling (Soul Engine)
 * 2. Kitchen Table Test validation
 * 3. Anti-AI Voice Checklist
 * 4. Grammar Posturing Framework (Levels 1-4)
 * 5. Narrative Architecture Patterns (A-F)
 * 6. Dynamic Opening Strategies based on voice profile
 * 7. Legal citation integration per voice level
 * 8. Metadata output with inferred voice profile
 */

import {
  inferConsumerVoice,
  type ConsumerVoiceProfile,
  type SoulEngineInput,
  getVoicePhrases,
  applyVoiceToText,
  AGE_VOICE_MARKERS,
} from "./amelia-soul-engine";

import {
  validateLetter as runValidation,
  runKitchenTableTest,
  runAntiAIChecklist,
  runUniquenessCheck,
  type LetterValidationInput,
  type ValidationResult,
} from "./amelia-validation";

import {
  generateBackdatedDate,
  formatDateForVoice,
  generateTemporalReferences,
  checkCFPBEligibility,
  generateCFPBLanguage,
  type TemporalConfig,
  type TemporalOutput,
} from "./amelia-temporal-engine";

// Re-export validateLetter under a different name
const validateLetterFull = runValidation;

import type { FlowType, LetterStructure } from "./amelia-templates";
import type { CRA } from "@/types";

// =============================================================================
// TYPES
// =============================================================================

export type NarrativePattern = "A" | "B" | "C" | "D" | "E" | "F";

export interface AmeliaV3Input {
  client: {
    name: string;
    firstName: string;
    lastName: string;
    dob: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    ssnLast4: string;
  };
  account: {
    creditorName: string;
    accountNumberPartial?: string;
    accountType: string;
    reportedBalance?: number;
    dateOpened?: string;
    dateOfFirstDelinquency?: string;
    currentStatus: string;
  };
  disputeConfig: {
    mode: "dispute_flow" | "sentry";
    round: number;
    disputeReason: string;
    legalBasis?: string[];
    priorDisputeDates?: string[];
    priorResponses?: string[];
    supportingEvidence?: string[];
    clientNarrative?: string;
    targetOutcome: "deletion" | "correction" | "status_change";
    sentryTrigger?: string;
    priorRoundLetterDate?: Date; // For temporal consistency
    firstDisputeDate?: Date; // For CFPB 45-day eligibility
  };
  disputeTarget: {
    entityType: "CRA" | "furnisher" | "collector";
    entityName: string;
  };
  generationConfig?: {
    grammarPosture?: 1 | 2 | 3 | 4;
    tonality?: string;
    uniquenessSeed?: string;
    bureau: CRA;
  };
  // Prior letters for uniqueness checking
  priorLetters?: string[];
}

export interface AmeliaV3Output {
  letter: {
    subjectLine: string;
    date: string;
    senderBlock: string;
    recipientBlock: string;
    salutation: string;
    body: string;
    closing: string;
    signatureBlock: string;
    enclosures: string[];
  };
  metadata: {
    disputeType: string;
    round: number;
    legalProvisionsCited: string[];
    grammarPostureUsed: number;
    tonalityUsed: string;
    narrativePatternUsed: NarrativePattern;
    openingStrategyUsed: string;
    inferredVoiceProfile: ConsumerVoiceProfile;
    humanAuthenticityScore: number;
    kitchenTableTest: "pass" | "fail";
    antiAICheck: "pass" | "fail";
    nextRoundStrategy: string;
    validationDetails: {
      kitchenTableTest: ValidationResult;
      antiAICheck: ValidationResult;
      uniquenessCheck: ValidationResult;
    };
    // Temporal Authenticity Engine metadata
    temporal: {
      actualGenerationDate: string;
      backdatedLetterDate: string;
      backdateOffsetDays: number;
      priorRoundLetterDate: string | null;
      gapFromPriorRoundDays: number | null;
      cfpbEligibleAtLetterDate: boolean;
      daysSinceFirstDisputeAtLetterDate: number;
      cfpbEligibility: {
        eligible: boolean;
        reason: string;
        alternativeEscalation: string;
      };
    };
  };
}

// =============================================================================
// NARRATIVE ARCHITECTURE PATTERNS
// =============================================================================

/**
 * Narrative patterns from v3 spec:
 * A - Story-First: What happened → What I found → Why it's wrong → What I need → What happens if not
 * B - Evidence-First: Discrepancy → Proof → Why data is wrong → What I need → Legal support
 * C - Rights-Anchored: My rights → Specific right at issue → How you're violating → What I need → Timeline
 * D - Emotional Arc: Discovery emotion → What I found → Life impact → What I'm asking → What I'll do
 * E - Investigative: Looking into this → What doesn't add up → What to verify → Standard to meet → Watching
 * F - Confrontational (R3+): History → Failures → What law requires → What's next
 */
export const NARRATIVE_PATTERNS: Record<NarrativePattern, {
  name: string;
  structure: string[];
  minRound: number;
  bestFor: string[];
}> = {
  A: {
    name: "Story-First",
    structure: ["personal_story", "discovery", "inaccuracy_explanation", "demand", "consequence"],
    minRound: 1,
    bestFor: ["first_time_disputer", "emotional_consumer", "strong_personal_stakes"],
  },
  B: {
    name: "Evidence-First",
    structure: ["discrepancy", "proof", "data_analysis", "demand", "legal_support"],
    minRound: 1,
    bestFor: ["data_driven_consumer", "has_documentation", "factual_dispute"],
  },
  C: {
    name: "Rights-Anchored",
    structure: ["rights_awareness", "specific_right", "violation_explanation", "demand", "timeline"],
    minRound: 2,
    bestFor: ["informed_consumer", "medium_high_legal_literacy", "procedural_violation"],
  },
  D: {
    name: "Emotional Arc",
    structure: ["emotional_discovery", "findings", "life_impact", "request", "future_action"],
    minRound: 1,
    bestFor: ["frustrated_consumer", "significant_life_stakes", "empathy_approach"],
  },
  E: {
    name: "Investigative",
    structure: ["investigation_statement", "inconsistencies", "verification_demand", "standard", "monitoring"],
    minRound: 2,
    bestFor: ["suspicious_consumer", "re_aging", "duplicate_reporting", "balance_discrepancy"],
  },
  F: {
    name: "Confrontational",
    structure: ["dispute_history", "failures", "legal_requirements", "next_steps"],
    minRound: 3,
    bestFor: ["exhausted_consumer", "multiple_failed_disputes", "willful_noncompliance"],
  },
};

// =============================================================================
// OPENING STRATEGY LIBRARY
// =============================================================================

export type OpeningStrategy =
  | "personal_discovery"
  | "direct_challenge"
  | "situational_urgency"
  | "frustrated_followup"
  | "authority"
  | "sentry_vigilant"
  | "sentry_surprised";

export const OPENING_STRATEGIES: Record<OpeningStrategy, {
  templates: string[];
  bestFor: {
    rounds: number[];
    emotionalStates: string[];
    modes: string[];
  };
}> = {
  personal_discovery: {
    templates: [
      "I was going through my credit report because {reason} and I found something that doesn't look right.",
      "I recently requested a copy of my credit report and I need to bring something to your attention.",
      "When I checked my report on {date}, I noticed {issue} that I need corrected.",
      "I pulled my credit report {timeframe} and found an error that needs to be addressed.",
      "While reviewing my credit file for {reason}, I discovered inaccurate information.",
    ],
    bestFor: {
      rounds: [1],
      emotionalStates: ["concerned", "confused"],
      modes: ["dispute_flow"],
    },
  },
  direct_challenge: {
    templates: [
      "There's an error on my credit report and I'm writing to get it fixed.",
      "The {creditor} account on my report is wrong and here's why.",
      "I'm disputing the {account_type} listed under {creditor} because the information doesn't match my records.",
      "I need to dispute an inaccurate entry on my credit report.",
      "This letter is about an error I found on my {bureau} report that needs immediate correction.",
    ],
    bestFor: {
      rounds: [1, 2],
      emotionalStates: ["determined", "frustrated"],
      modes: ["dispute_flow"],
    },
  },
  situational_urgency: {
    templates: [
      "I'm in the process of {life_event} and I've discovered an inaccuracy on my report that needs to be addressed immediately.",
      "I need to resolve this quickly because {life_stake} depends on my credit being accurate.",
      "Time is critical — I'm {life_event} and this error is holding everything up.",
      "I have a {deadline} coming up and this inaccurate information is blocking my progress.",
    ],
    bestFor: {
      rounds: [1, 2],
      emotionalStates: ["concerned", "determined"],
      modes: ["dispute_flow"],
    },
  },
  frustrated_followup: {
    templates: [
      "I wrote to you about this on {date} and I'm writing again because your response didn't resolve anything.",
      "This is now my {ordinal} letter about the same account. I still haven't gotten a real answer.",
      "Your response to my {date} dispute was a generic form letter that didn't address what I actually raised.",
      "I've been waiting {timeframe} since my last dispute and nothing has changed.",
      "I'm following up because your investigation didn't actually investigate anything.",
    ],
    bestFor: {
      rounds: [2, 3, 4],
      emotionalStates: ["frustrated", "angry_controlled", "exhausted"],
      modes: ["dispute_flow"],
    },
  },
  authority: {
    templates: [
      "I've now disputed this account {count} times and it's still being reported inaccurately. I need to be very clear about where things stand.",
      "After {months} months of correspondence about this account, I'm escalating this matter.",
      "This is a formal notice regarding your continued failure to properly investigate my disputes.",
      "I've documented every step of this process and I'm prepared to take further action.",
    ],
    bestFor: {
      rounds: [3, 4, 5],
      emotionalStates: ["resolute", "angry_controlled"],
      modes: ["dispute_flow"],
    },
  },
  sentry_vigilant: {
    templates: [
      "I check my credit regularly and I noticed a change that I need to bring to your attention.",
      "Something changed on my report between {date1} and {date2} and I need answers.",
      "I monitor my credit closely and I've caught something that doesn't add up.",
      "My regular credit check revealed an issue that needs immediate investigation.",
    ],
    bestFor: {
      rounds: [1, 2],
      emotionalStates: ["vigilant", "determined"],
      modes: ["sentry"],
    },
  },
  sentry_surprised: {
    templates: [
      "I just pulled my credit report and there's something new that I don't recognize.",
      "A new item appeared on my report that wasn't there before and I need to dispute it.",
      "I was surprised to find {item} on my report — I have no idea where this came from.",
      "Something showed up on my credit file that I need to challenge immediately.",
    ],
    bestFor: {
      rounds: [1],
      emotionalStates: ["surprised", "confused"],
      modes: ["sentry"],
    },
  },
};

// =============================================================================
// GRAMMAR POSTURING FRAMEWORK
// =============================================================================

export interface GrammarPostureConfig {
  level: 1 | 2 | 3 | 4;
  sentenceComplexity: "simple" | "moderate" | "complex" | "dense";
  contractionUsage: "frequent" | "moderate" | "occasional" | "rare";
  legalCitationStyle: "paraphrase" | "mixed" | "precise" | "authoritative";
  fragmentsAllowed: boolean;
  formalTransitions: boolean;
  paragraphStructure: "loose" | "moderate" | "structured" | "dense";
}

export const GRAMMAR_POSTURE_CONFIGS: Record<1 | 2 | 3 | 4, GrammarPostureConfig> = {
  1: {
    level: 1,
    sentenceComplexity: "simple",
    contractionUsage: "frequent",
    legalCitationStyle: "paraphrase",
    fragmentsAllowed: true,
    formalTransitions: false,
    paragraphStructure: "loose",
  },
  2: {
    level: 2,
    sentenceComplexity: "moderate",
    contractionUsage: "moderate",
    legalCitationStyle: "mixed",
    fragmentsAllowed: true,
    formalTransitions: false,
    paragraphStructure: "moderate",
  },
  3: {
    level: 3,
    sentenceComplexity: "complex",
    contractionUsage: "occasional",
    legalCitationStyle: "precise",
    fragmentsAllowed: false,
    formalTransitions: true,
    paragraphStructure: "structured",
  },
  4: {
    level: 4,
    sentenceComplexity: "dense",
    contractionUsage: "rare",
    legalCitationStyle: "authoritative",
    fragmentsAllowed: false,
    formalTransitions: true,
    paragraphStructure: "dense",
  },
};

// =============================================================================
// LEGAL CITATION INTEGRATION
// =============================================================================

export interface LegalCitation {
  code: string;
  name: string;
  paraphrase: string;
  formal: string;
  authoritative: string;
  useContext: string[];
}

export const LEGAL_CITATIONS: LegalCitation[] = [
  {
    code: "§611(a)(1)(A)",
    name: "Right to Dispute",
    paraphrase: "the law says you have to investigate when I tell you something is wrong",
    formal: "Under the Fair Credit Reporting Act, I have the right to dispute any information I believe to be inaccurate",
    authoritative: "Pursuant to 15 U.S.C. §1681i(a)(1)(A), I am exercising my statutory right to dispute the accuracy of information in my consumer file",
    useContext: ["round_1", "initial_dispute"],
  },
  {
    code: "§611(a)(6)(B)(iii)",
    name: "Method of Verification",
    paraphrase: "you have to tell me how you checked this, not just say 'we verified it'",
    formal: "I demand to know the method of verification used in your investigation as required by law",
    authoritative: "Under 15 U.S.C. §1681i(a)(6)(B)(iii), you are required to provide, upon request, a description of the procedure used to determine the accuracy of the disputed information",
    useContext: ["round_2_plus", "verified_response", "method_of_verification"],
  },
  {
    code: "§611(a)(5)(A)",
    name: "Results Notification",
    paraphrase: "I know you're supposed to send me the results within 5 business days of finishing",
    formal: "The FCRA requires you to notify me of the results of your reinvestigation within 5 business days of completion",
    authoritative: "Pursuant to 15 U.S.C. §1681i(a)(5)(A), prompt written notice of investigation results is statutorily mandated",
    useContext: ["timeline", "results_pending"],
  },
  {
    code: "§1681e(b)",
    name: "Maximum Accuracy",
    paraphrase: "the law requires you to report my credit with maximum accuracy — that means no mistakes",
    formal: "You have a duty to ensure maximum possible accuracy in credit reporting",
    authoritative: "15 U.S.C. §1681e(b) imposes a statutory obligation to follow reasonable procedures to assure maximum possible accuracy",
    useContext: ["accuracy_dispute", "general"],
  },
  {
    code: "§1681s-2(b)",
    name: "Furnisher Investigation Duties",
    paraphrase: "when I dispute with you, the company that reported this has to actually look into it too",
    formal: "The data furnisher has an independent obligation to investigate disputed information",
    authoritative: "Under 15 U.S.C. §1681s-2(b), upon receiving notice of a dispute, the furnisher must conduct a reasonable investigation",
    useContext: ["furnisher_dispute", "investigation_inadequacy"],
  },
  {
    code: "§1681n",
    name: "Willful Noncompliance",
    paraphrase: "if you keep ignoring this on purpose, I can sue for damages and you'll have to pay my lawyer",
    formal: "Willful failure to comply with the FCRA exposes you to statutory damages, punitive damages, and attorney's fees",
    authoritative: "Pursuant to 15 U.S.C. §1681n, willful noncompliance subjects the violator to actual damages, statutory damages of $100-$1,000, punitive damages, and costs plus reasonable attorney's fees",
    useContext: ["round_3_plus", "escalation", "willful_violation"],
  },
  {
    code: "§1681o",
    name: "Negligent Noncompliance",
    paraphrase: "even if it's not intentional, mistakes that hurt me mean you may owe me money",
    formal: "Negligent noncompliance with the FCRA creates liability for actual damages",
    authoritative: "Under 15 U.S.C. §1681o, negligent noncompliance renders the violator liable for actual damages sustained as a result of the failure",
    useContext: ["damages", "negligence"],
  },
  {
    code: "§1681c(a)",
    name: "Obsolete Information",
    paraphrase: "this information is too old to be on my report — it should have fallen off already",
    formal: "This item has exceeded the 7-year reporting period and must be removed",
    authoritative: "Pursuant to 15 U.S.C. §1681c(a), consumer reporting agencies are prohibited from reporting obsolete information exceeding the prescribed time periods",
    useContext: ["re_aging", "time_barred"],
  },
  {
    code: "§1692g",
    name: "Debt Validation",
    paraphrase: "this debt collector never sent me proof that I owe this money in the first place",
    formal: "The debt collector failed to provide validation as required within 5 days of initial communication",
    authoritative: "Under 15 U.S.C. §1692g, a debt collector must provide written notice of the debt within 5 days of initial communication, including the amount, creditor name, and dispute rights",
    useContext: ["collection_dispute", "debt_validation"],
  },
];

/**
 * Get appropriately styled legal citation based on voice profile
 */
export function getLegalCitationForVoice(
  citation: LegalCitation,
  voiceProfile: ConsumerVoiceProfile
): string {
  const posture = GRAMMAR_POSTURE_CONFIGS[voiceProfile.grammarPosture];

  switch (posture.legalCitationStyle) {
    case "paraphrase":
      return citation.paraphrase;
    case "mixed":
      // 50/50 chance of paraphrase vs formal
      return Math.random() > 0.5 ? citation.paraphrase : citation.formal;
    case "precise":
      return citation.formal;
    case "authoritative":
      return citation.authoritative;
  }
}

// =============================================================================
// PATTERN SELECTION
// =============================================================================

/**
 * Select the best narrative pattern based on voice profile and dispute context
 */
export function selectNarrativePattern(
  voiceProfile: ConsumerVoiceProfile,
  round: number,
  disputeReason: string
): NarrativePattern {
  const candidates: NarrativePattern[] = [];

  // Filter by minimum round
  for (const [pattern, config] of Object.entries(NARRATIVE_PATTERNS) as [NarrativePattern, typeof NARRATIVE_PATTERNS[NarrativePattern]][]) {
    if (round >= config.minRound) {
      candidates.push(pattern);
    }
  }

  // Preference based on emotional state
  if (voiceProfile.emotionalState === "angry_controlled" || voiceProfile.emotionalState === "exhausted") {
    if (round >= 3 && candidates.includes("F")) return "F"; // Confrontational
  }

  if (voiceProfile.emotionalState === "concerned" || voiceProfile.emotionalState === "confused") {
    if (candidates.includes("D")) return "D"; // Emotional Arc
    if (candidates.includes("A")) return "A"; // Story-First
  }

  if (voiceProfile.emotionalState === "vigilant") {
    if (candidates.includes("E")) return "E"; // Investigative
  }

  // Preference based on dispute reason
  const lowerReason = disputeReason.toLowerCase();
  if (lowerReason.includes("balance") || lowerReason.includes("duplicate") || lowerReason.includes("re-ag")) {
    if (candidates.includes("E")) return "E"; // Investigative
  }

  if (lowerReason.includes("collection") || lowerReason.includes("valid")) {
    if (candidates.includes("C")) return "C"; // Rights-Anchored
  }

  // Preference based on legal literacy
  if (voiceProfile.legalLiteracy === "high") {
    if (candidates.includes("C")) return "C"; // Rights-Anchored
    if (candidates.includes("B")) return "B"; // Evidence-First
  }

  // Default based on round
  if (round === 1) return "A"; // Story-First
  if (round === 2) return "B"; // Evidence-First
  if (round >= 3) return candidates.includes("F") ? "F" : "C";

  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Select the best opening strategy based on voice profile and context
 */
export function selectOpeningStrategy(
  voiceProfile: ConsumerVoiceProfile,
  round: number,
  mode: "dispute_flow" | "sentry",
  lifeStakes?: string
): OpeningStrategy {
  // Sentry mode has specific strategies
  if (mode === "sentry") {
    if (voiceProfile.emotionalState === "surprised" || voiceProfile.emotionalState === "confused") {
      return "sentry_surprised";
    }
    return "sentry_vigilant";
  }

  // Round 3+ with authority
  if (round >= 3 && (voiceProfile.emotionalState === "resolute" || voiceProfile.emotionalState === "angry_controlled")) {
    return "authority";
  }

  // Round 2+ frustrated follow-up
  if (round >= 2 && (voiceProfile.emotionalState === "frustrated" || voiceProfile.emotionalState === "exhausted")) {
    return "frustrated_followup";
  }

  // Urgent life stakes
  if (lifeStakes && (lifeStakes.includes("mortgage") || lifeStakes.includes("home") || lifeStakes.includes("job"))) {
    return "situational_urgency";
  }

  // Direct challenge for determined consumers
  if (voiceProfile.emotionalState === "determined" || voiceProfile.communicationStyle === "direct") {
    return "direct_challenge";
  }

  // Default: personal discovery
  return "personal_discovery";
}

// =============================================================================
// MAIN V3 GENERATION FUNCTION
// =============================================================================

/**
 * Generate a letter using the Amelia V3 system
 *
 * This function:
 * 1. Generates strategically backdated date using Temporal Engine
 * 2. Infers the consumer's voice profile using the Soul Engine
 * 3. Selects appropriate narrative pattern and opening strategy
 * 4. Applies grammar posturing based on voice profile
 * 5. Checks CFPB 45-day eligibility
 * 6. Runs all validation checks
 * 7. Returns structured output with full metadata including temporal data
 */
export function generateAmeliaV3Letter(input: AmeliaV3Input): AmeliaV3Output {
  // 1. Generate strategically backdated date
  const temporalConfig: TemporalConfig = {
    mode: input.disputeConfig.mode,
    round: input.disputeConfig.round,
    priorRoundDate: input.disputeConfig.priorRoundLetterDate,
    uniquenessSeed: input.generationConfig?.uniquenessSeed,
    clientName: input.client.name,
    accountNumberPartial: input.account.accountNumberPartial,
    clientDob: input.client.dob,
  };

  const temporalOutput = generateBackdatedDate(temporalConfig);

  // Check CFPB eligibility based on backdated timeline
  const cfpbEligibility = checkCFPBEligibility(
    input.disputeConfig.round,
    temporalOutput.daysSinceFirstDisputeAtLetterDate,
    input.disputeConfig.mode
  );

  // 2. Infer consumer voice using Soul Engine
  const soulEngineInput: SoulEngineInput = {
    client: {
      name: input.client.name,
      dob: input.client.dob,
      address: input.client.address,
    },
    account: {
      creditorName: input.account.creditorName,
      accountType: input.account.accountType,
      currentStatus: input.account.currentStatus,
      reportedBalance: input.account.reportedBalance,
    },
    disputeConfig: {
      mode: input.disputeConfig.mode,
      round: input.disputeConfig.round,
      clientNarrative: input.disputeConfig.clientNarrative,
      priorDisputeDates: input.disputeConfig.priorDisputeDates,
      priorResponses: input.disputeConfig.priorResponses,
      sentryTrigger: input.disputeConfig.sentryTrigger,
    },
    disputeTarget: {
      entityType: input.disputeTarget.entityType,
    },
  };

  const voiceProfile = inferConsumerVoice(soulEngineInput);

  // Override grammar posture if specified
  if (input.generationConfig?.grammarPosture) {
    voiceProfile.grammarPosture = input.generationConfig.grammarPosture;
  }

  // 3. Select narrative pattern
  const narrativePattern = selectNarrativePattern(
    voiceProfile,
    input.disputeConfig.round,
    input.disputeConfig.disputeReason
  );

  // 4. Select opening strategy
  const openingStrategy = selectOpeningStrategy(
    voiceProfile,
    input.disputeConfig.round,
    input.disputeConfig.mode,
    voiceProfile.lifeStakes
  );

  // 5. Get voice-appropriate phrases
  const phrases = getVoicePhrases(voiceProfile);

  // 6. Build the letter components using BACKDATED date
  const letterDate = temporalOutput.backdatedLetterDate;
  const formattedDate = formatDateForVoice(letterDate, voiceProfile);

  // Generate temporal references for letter body (relative to backdated date)
  const temporalRefs = generateTemporalReferences(
    temporalOutput.backdatedLetterDate,
    temporalOutput.priorRoundLetterDate
  );

  // Sender block
  const senderBlock = [
    input.client.name,
    input.client.address,
    `${input.client.city}, ${input.client.state} ${input.client.zip}`,
    `SSN: XXX-XX-${input.client.ssnLast4}`,
  ].join("\n");

  // Recipient block
  const recipientBlock = [
    input.disputeTarget.entityName,
    // Address would come from CRA_ADDRESSES in real implementation
  ].join("\n");

  // Generate opening
  const openingTemplates = OPENING_STRATEGIES[openingStrategy].templates;
  let opening = openingTemplates[Math.floor(Math.random() * openingTemplates.length)];

  // Fill in opening template variables
  opening = opening
    .replace("{reason}", "I'm planning to apply for a mortgage")
    .replace("{date}", formattedDate)
    .replace("{timeframe}", "last week")
    .replace("{issue}", `an inaccurate entry from ${input.account.creditorName}`)
    .replace("{creditor}", input.account.creditorName)
    .replace("{account_type}", input.account.accountType)
    .replace("{bureau}", input.generationConfig?.bureau || "the credit bureau")
    .replace("{life_event}", voiceProfile.lifeStakes || "making an important financial decision")
    .replace("{life_stake}", voiceProfile.lifeStakes || "my financial future")
    .replace("{deadline}", "important deadline")
    .replace("{ordinal}", getOrdinal(input.disputeConfig.round))
    .replace("{count}", input.disputeConfig.round.toString())
    .replace("{months}", ((input.disputeConfig.round - 1) * 2).toString())
    .replace("{date1}", "last month")
    .replace("{date2}", "this month")
    .replace("{item}", `a collection from ${input.account.creditorName}`);

  // Apply voice profile to opening
  opening = applyVoiceToText(opening, voiceProfile);

  // Generate body sections based on narrative pattern
  const pattern = NARRATIVE_PATTERNS[narrativePattern];
  const bodySections: string[] = [];

  for (const section of pattern.structure) {
    bodySections.push(generateBodySection(section, voiceProfile, input, phrases, temporalRefs));
  }

  // Add CFPB escalation language if eligible (only for Round 3+)
  const cfpbLanguage = generateCFPBLanguage(
    cfpbEligibility.eligible,
    temporalOutput.daysSinceFirstDisputeAtLetterDate,
    voiceProfile
  );

  if (cfpbLanguage) {
    bodySections.push(cfpbLanguage);
  }

  // Combine into full body
  const body = [opening, "", ...bodySections.map(s => s + "\n")].join("\n");

  // Apply voice adjustments to full body
  const finalBody = applyVoiceToText(body, voiceProfile);

  // Generate subject line
  const subjectLine = generateSubjectLine(input.account.creditorName, input.disputeConfig.targetOutcome);

  // Generate closing
  const closing = generateClosing(voiceProfile);

  // 6. Run validation
  const validationInput: LetterValidationInput = {
    letterBody: finalBody,
    voiceProfile,
    round: input.disputeConfig.round,
    priorLetters: input.priorLetters,
  };

  const kitchenTableResult = runKitchenTableTest(validationInput);
  const antiAIResult = runAntiAIChecklist(validationInput);
  const uniquenessResult = runUniquenessCheck(validationInput);

  // Calculate human authenticity score
  const humanAuthenticityScore = Math.round(
    (kitchenTableResult.score * 0.4) +
    (antiAIResult.score * 0.35) +
    (uniquenessResult.score * 0.25)
  );

  // Determine legal provisions cited
  const legalProvisionsCited: string[] = [];
  for (const citation of LEGAL_CITATIONS) {
    const citationText = getLegalCitationForVoice(citation, voiceProfile);
    if (finalBody.includes(citationText) || finalBody.includes(citation.code)) {
      legalProvisionsCited.push(citation.code);
    }
  }

  // Generate next round strategy
  const nextRoundStrategy = generateNextRoundStrategy(
    input.disputeConfig.round,
    input.disputeConfig.targetOutcome
  );

  // 8. Return structured output with temporal metadata
  return {
    letter: {
      subjectLine,
      date: formattedDate,
      senderBlock,
      recipientBlock,
      salutation: `Dear ${input.disputeTarget.entityName},`,
      body: finalBody,
      closing,
      signatureBlock: `\n_______________________________\n${input.client.name}`,
      enclosures: input.disputeConfig.supportingEvidence || [],
    },
    metadata: {
      disputeType: input.disputeConfig.disputeReason,
      round: input.disputeConfig.round,
      legalProvisionsCited,
      grammarPostureUsed: voiceProfile.grammarPosture,
      tonalityUsed: voiceProfile.emotionalState,
      narrativePatternUsed: narrativePattern,
      openingStrategyUsed: openingStrategy,
      inferredVoiceProfile: voiceProfile,
      humanAuthenticityScore,
      kitchenTableTest: kitchenTableResult.passed ? "pass" : "fail",
      antiAICheck: antiAIResult.passed ? "pass" : "fail",
      nextRoundStrategy,
      validationDetails: {
        kitchenTableTest: kitchenTableResult,
        antiAICheck: antiAIResult,
        uniquenessCheck: uniquenessResult,
      },
      // Temporal Authenticity Engine metadata
      temporal: {
        actualGenerationDate: temporalOutput.actualGenerationDate.toISOString(),
        backdatedLetterDate: temporalOutput.backdatedLetterDate.toISOString(),
        backdateOffsetDays: temporalOutput.backdateOffsetDays,
        priorRoundLetterDate: temporalOutput.priorRoundLetterDate
          ? temporalOutput.priorRoundLetterDate.toISOString()
          : null,
        gapFromPriorRoundDays: temporalOutput.gapFromPriorRoundDays,
        cfpbEligibleAtLetterDate: temporalOutput.cfpbEligibleAtLetterDate,
        daysSinceFirstDisputeAtLetterDate: temporalOutput.daysSinceFirstDisputeAtLetterDate,
        cfpbEligibility,
      },
    },
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getOrdinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

function generateSubjectLine(creditorName: string, targetOutcome: string): string {
  const variations = [
    `Disputing the ${creditorName} account on my report`,
    `Account dispute — ${creditorName}`,
    `RE: Inaccurate reporting by ${creditorName}`,
    `Please investigate — ${creditorName} account`,
    `Dispute: ${creditorName}`,
  ];
  return variations[Math.floor(Math.random() * variations.length)];
}

function generateClosing(voiceProfile: ConsumerVoiceProfile): string {
  const closings: Record<string, string[]> = {
    conversational: [
      "Please get back to me as soon as you can.",
      "I look forward to hearing from you.",
      "I'm waiting to hear back from you.",
    ],
    measured: [
      "I expect a response within the legally mandated timeframe.",
      "Please respond to this dispute promptly.",
      "I await your written response.",
    ],
    formal: [
      "Please provide your written response within 30 days as required by law.",
      "I expect compliance with all applicable FCRA timelines.",
    ],
    assertive: [
      "I will be monitoring for your response and will act accordingly.",
      "Respond within 30 days or I will take further action.",
    ],
  };

  const styleClosings = closings[voiceProfile.communicationStyle] || closings.measured;
  const closing = styleClosings[Math.floor(Math.random() * styleClosings.length)];

  return closing + "\n\nSincerely,";
}

function generateBodySection(
  sectionType: string,
  voiceProfile: ConsumerVoiceProfile,
  input: AmeliaV3Input,
  phrases: ReturnType<typeof getVoicePhrases>,
  temporalRefs?: ReturnType<typeof generateTemporalReferences>
): string {
  // This would be expanded with actual section generation logic
  // For now, return placeholder text based on section type

  const creditor = input.account.creditorName;
  const reason = input.disputeConfig.disputeReason;

  // Use temporal references for time-based phrases
  const reportReview = temporalRefs?.reportReviewReference || "recently";
  const timeSincePrior = temporalRefs?.timeSincePriorDispute || "some time";
  const urgencyFrame = temporalRefs?.urgencyTimeframe || "within 30 days";

  switch (sectionType) {
    case "personal_story":
    case "emotional_discovery":
      return phrases.frustrationExpressions[Math.floor(Math.random() * phrases.frustrationExpressions.length)] +
        ` The ${creditor} account showing on my report is affecting my life in ways you probably don't realize.`;

    case "discovery":
    case "findings":
      return `When I reviewed my credit report ${reportReview}, I found that the ${creditor} account is showing ${reason}. ` +
        phrases.inaccuracyStatements[Math.floor(Math.random() * phrases.inaccuracyStatements.length)];

    case "inaccuracy_explanation":
    case "data_analysis":
    case "inconsistencies":
      return `According to my records, this information is not accurate. ${reason}. ` +
        `I need you to actually look into this and verify the data with documentation.`;

    case "demand":
    case "request":
    case "verification_demand":
      return phrases.investigationRequests[Math.floor(Math.random() * phrases.investigationRequests.length)] +
        ` I expect a real investigation, not just a rubber stamp from the data furnisher.`;

    case "consequence":
    case "future_action":
    case "next_steps":
      // Note: CFPB language is now added separately based on eligibility
      return `If this isn't resolved ${urgencyFrame}, I will explore all available options including regulatory complaints. ` +
        `I've documented everything and I'm prepared to take this further if needed.`;

    case "rights_awareness":
    case "specific_right":
      const citation = LEGAL_CITATIONS.find(c => c.useContext.includes("round_1"));
      return citation ? getLegalCitationForVoice(citation, voiceProfile) : "I know my rights under the FCRA.";

    case "violation_explanation":
    case "failures":
      return `You have failed to properly investigate my previous disputes. Simply saying "verified" without ` +
        `providing any documentation of how you verified it is not acceptable.`;

    case "timeline":
    case "monitoring":
    case "standard":
      return `You have 30 days to respond to this dispute. I will be tracking the timeline and ` +
        `documenting your response — or lack thereof.`;

    case "dispute_history":
    case "investigation_statement":
      const priorRef = temporalRefs?.priorDisputeReference || input.disputeConfig.priorDisputeDates?.[0] || "months ago";
      const timeElapsed = timeSincePrior ? `It's been ${timeSincePrior} since my last dispute. ` : "";
      return `I have been disputing this account since ${priorRef}. ${timeElapsed}` +
        `This is not a new issue — it's an ongoing failure on your part to correct inaccurate information.`;

    case "legal_requirements":
      const enforcementCitation = LEGAL_CITATIONS.find(c => c.code.includes("1681n"));
      return enforcementCitation
        ? getLegalCitationForVoice(enforcementCitation, voiceProfile)
        : "The law is clear about your obligations.";

    case "proof":
      return `I have documentation to support my position. My records show a different picture than what you're reporting.`;

    case "legal_support":
      return `The Fair Credit Reporting Act requires you to ensure maximum possible accuracy. You're not meeting that standard.`;

    case "life_impact":
      return voiceProfile.lifeStakes
        ? `This is affecting my ${voiceProfile.lifeStakes}. This isn't just a number on a report — it's my life.`
        : `This is affecting my ability to access credit and financial opportunities I deserve.`;

    case "discrepancy":
      return phrases.inaccuracyStatements[Math.floor(Math.random() * phrases.inaccuracyStatements.length)] +
        ` There's a clear discrepancy between what you're reporting and what my records show.`;

    default:
      return "";
  }
}

function generateNextRoundStrategy(round: number, targetOutcome: string): string {
  if (round === 1) {
    return "If no response or inadequate response, escalate to Round 2 with method of verification demand";
  }
  if (round === 2) {
    return "If verified without documentation, escalate to Round 3 with regulatory escalation threat";
  }
  if (round === 3) {
    return "File CFPB complaint, consider direct furnisher dispute, document for potential litigation";
  }
  return "Continue escalation, consider legal consultation, maintain documentation trail";
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  inferConsumerVoice,
  runKitchenTableTest,
  runAntiAIChecklist,
  runUniquenessCheck,
  validateLetterFull as runFullValidation,
  // Temporal Engine exports
  generateBackdatedDate,
  formatDateForVoice,
  generateTemporalReferences,
  checkCFPBEligibility,
  generateCFPBLanguage,
  type ConsumerVoiceProfile,
  type ValidationResult,
  type TemporalConfig,
  type TemporalOutput,
};
