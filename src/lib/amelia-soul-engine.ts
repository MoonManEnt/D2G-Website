/**
 * AMELIA SOUL ENGINE - Automatic Voice Inference System
 *
 * The Soul Engine is Amelia's most critical capability. It automatically infers
 * the consumer's voice from available data without requiring specialist configuration.
 *
 * CORE PRINCIPLE: Every letter must sound like it was written by the actual consumer,
 * sitting at their kitchen table, with their specific frustrations and circumstances.
 *
 * The Soul Engine reads:
 * - client.dob → age_range
 * - dispute_config.round → emotional_state + legal_literacy progression
 * - dispute_config.client_narrative → personal_story, life_stakes, specific_phrases
 * - account.account_type + account.current_status → relationship_to_account
 * - dispute_target.entity_type → formality_baseline
 * - prior_dispute_dates + prior_responses → dispute_fatigue + knowledge_accumulation
 * - client.address → geographic_region for subtle voice calibration
 */

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export type AgeRange = "18-29" | "30-44" | "45-59" | "60+";
export type CommunicationStyle = "conversational" | "direct" | "measured" | "formal" | "assertive";
export type LegalLiteracy = "low" | "medium" | "high";
export type EmotionalState =
  | "confused"
  | "concerned"
  | "frustrated"
  | "determined"
  | "angry_controlled"
  | "exhausted"
  | "resolute"
  | "surprised"
  | "vigilant"
  | "diplomatic";
export type GrammarPosture = 1 | 2 | 3 | 4;
export type VoiceSource = "narrative-driven" | "data-inferred" | "minimal-default";
export type DisputeMode = "dispute_flow" | "sentry";

export interface ConsumerVoiceProfile {
  ageRange: AgeRange;
  communicationStyle: CommunicationStyle;
  legalLiteracy: LegalLiteracy;
  emotionalState: EmotionalState;
  grammarPosture: GrammarPosture;
  lifeStakes: string;
  personalNarrativeElements: string[];
  relationshipToAccount: string;
  formalityBaseline: "moderate" | "personal" | "assertive";
  disputeFatigue: "none" | "mild" | "significant" | "severe";
  voiceSource: VoiceSource;
  geographicRegion?: string;
}

export interface SoulEngineInput {
  client: {
    name: string;
    dob: string; // ISO date string
    address?: string;
  };
  account: {
    creditorName: string;
    accountType: string;
    currentStatus: string;
    reportedBalance?: number;
  };
  disputeConfig: {
    mode: DisputeMode;
    round: number;
    clientNarrative?: string;
    priorDisputeDates?: string[];
    priorResponses?: string[];
    sentryTrigger?: string;
  };
  disputeTarget: {
    entityType: "CRA" | "furnisher" | "collector";
  };
}

// =============================================================================
// AGE INFERENCE
// =============================================================================

function calculateAge(dob: string): number {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function inferAgeRange(dob: string): AgeRange {
  const age = calculateAge(dob);
  if (age < 30) return "18-29";
  if (age < 45) return "30-44";
  if (age < 60) return "45-59";
  return "60+";
}

/**
 * Age affects vocabulary, cultural references, formality level, and communication expectations
 */
export const AGE_VOICE_MARKERS: Record<AgeRange, {
  formality: "less" | "mixed" | "more" | "most";
  contractions: "frequent" | "moderate" | "occasional";
  directness: "high" | "medium" | "measured";
  institutionalDeference: "low" | "moderate" | "high";
  commonPhrases: string[];
}> = {
  "18-29": {
    formality: "less",
    contractions: "frequent",
    directness: "high",
    institutionalDeference: "low",
    commonPhrases: [
      "I don't understand how",
      "This is seriously affecting",
      "I need this fixed",
      "Why is this still showing",
      "I've been dealing with this",
    ],
  },
  "30-44": {
    formality: "mixed",
    contractions: "moderate",
    directness: "medium",
    institutionalDeference: "moderate",
    commonPhrases: [
      "I'm writing because",
      "This is impacting my family's ability to",
      "I've reviewed my records and",
      "As a responsible consumer",
      "I need to resolve this quickly because",
    ],
  },
  "45-59": {
    formality: "more",
    contractions: "occasional",
    directness: "measured",
    institutionalDeference: "moderate",
    commonPhrases: [
      "After reviewing my credit report",
      "I have maintained excellent payment history",
      "This inaccuracy is affecting",
      "I expect this matter to be resolved",
      "I have been a customer for many years",
    ],
  },
  "60+": {
    formality: "most",
    contractions: "occasional",
    directness: "measured",
    institutionalDeference: "high",
    commonPhrases: [
      "I am writing to bring to your attention",
      "In all my years of managing my credit",
      "I have always paid my obligations",
      "This is the first time in my life",
      "I trust you will give this matter proper attention",
    ],
  },
};

// =============================================================================
// EMOTIONAL STATE INFERENCE
// =============================================================================

function inferEmotionalState(
  round: number,
  mode: DisputeMode,
  priorResponses?: string[],
  sentryTrigger?: string
): EmotionalState {
  // Sentry mode emotional states
  if (mode === "sentry") {
    if (!sentryTrigger || round === 1) {
      return Math.random() > 0.5 ? "surprised" : "vigilant";
    }
    // Escalated sentry follows dispute flow pattern
    if (round === 2) return "frustrated";
    if (round === 3) return "angry_controlled";
    return "resolute";
  }

  // Dispute Flow emotional states based on round
  switch (round) {
    case 1:
      return Math.random() > 0.6 ? "concerned" : "confused";
    case 2:
      // If prior response was dismissive, increase frustration
      if (priorResponses?.some(r => r.toLowerCase().includes("verified") || r.toLowerCase().includes("accurate"))) {
        return "frustrated";
      }
      return Math.random() > 0.4 ? "frustrated" : "determined";
    case 3:
      return Math.random() > 0.3 ? "angry_controlled" : "exhausted";
    default:
      return "resolute";
  }
}

// =============================================================================
// LEGAL LITERACY INFERENCE
// =============================================================================

function inferLegalLiteracy(round: number, mode: DisputeMode): LegalLiteracy {
  if (mode === "sentry" && round === 1) {
    return Math.random() > 0.7 ? "medium" : "low";
  }

  switch (round) {
    case 1:
      return Math.random() > 0.7 ? "medium" : "low";
    case 2:
      return "medium";
    case 3:
      return Math.random() > 0.4 ? "high" : "medium";
    default:
      return "high";
  }
}

// =============================================================================
// GRAMMAR POSTURE INFERENCE
// =============================================================================

function inferGrammarPosture(
  round: number,
  legalLiteracy: LegalLiteracy,
  communicationStyle: CommunicationStyle
): GrammarPosture {
  // Start with round-based baseline
  let basePosture: GrammarPosture;
  switch (round) {
    case 1:
      basePosture = 1;
      break;
    case 2:
      basePosture = 2;
      break;
    case 3:
      basePosture = 3;
      break;
    default:
      basePosture = 4;
  }

  // Adjust based on legal literacy
  if (legalLiteracy === "high" && basePosture < 4) {
    basePosture = (basePosture + 1) as GrammarPosture;
  } else if (legalLiteracy === "low" && basePosture > 1) {
    basePosture = (basePosture - 1) as GrammarPosture;
  }

  // Adjust based on communication style
  if (communicationStyle === "formal" && basePosture < 4) {
    basePosture = Math.min(4, basePosture + 1) as GrammarPosture;
  } else if (communicationStyle === "conversational" && basePosture > 1) {
    basePosture = Math.max(1, basePosture - 1) as GrammarPosture;
  }

  return basePosture;
}

// =============================================================================
// ACCOUNT-TYPE RELATIONSHIP INFERENCE
// =============================================================================

function inferRelationshipToAccount(accountType: string, currentStatus: string): string {
  const type = accountType.toLowerCase();
  const status = currentStatus.toLowerCase();

  // Check medical FIRST (before collection, since medical collections exist)
  if (type.includes("medical")) {
    return "medical_debt_stressed";
  }

  if (type.includes("collection") || type.includes("debt")) {
    if (status.includes("unknown") || status.includes("dispute")) {
      return "unknown_debt_defensive";
    }
    return "collection_frustrated";
  }

  if (type.includes("student")) {
    return "student_loan_bureaucratic_frustration";
  }

  if (type.includes("mortgage") || type.includes("home")) {
    return "long_term_customer_disappointed";
  }

  if (type.includes("credit card") || type.includes("revolving")) {
    if (status.includes("late") || status.includes("delinquent")) {
      return "customer_with_issue";
    }
    return "customer_relationship";
  }

  if (type.includes("auto") || type.includes("vehicle")) {
    return "customer_relationship";
  }

  if (type.includes("utility") || type.includes("telecom")) {
    return "service_dispute";
  }

  return "general_dispute";
}

// =============================================================================
// FORMALITY BASELINE INFERENCE
// =============================================================================

function inferFormalityBaseline(entityType: "CRA" | "furnisher" | "collector"): "moderate" | "personal" | "assertive" {
  switch (entityType) {
    case "CRA":
      return "moderate";
    case "furnisher":
      return "personal";
    case "collector":
      return "assertive";
  }
}

// =============================================================================
// DISPUTE FATIGUE INFERENCE
// =============================================================================

function inferDisputeFatigue(priorDisputeDates?: string[]): "none" | "mild" | "significant" | "severe" {
  if (!priorDisputeDates || priorDisputeDates.length === 0) return "none";
  if (priorDisputeDates.length === 1) return "mild";
  if (priorDisputeDates.length === 2) return "significant";
  return "severe";
}

// =============================================================================
// NARRATIVE MINING
// =============================================================================

interface NarrativeElements {
  personalPhrases: string[];
  lifeStakes: string;
  emotionalTemperature: EmotionalState | null;
  relationshipContext: string | null;
}

function mineNarrative(narrative: string): NarrativeElements {
  const elements: NarrativeElements = {
    personalPhrases: [],
    lifeStakes: "",
    emotionalTemperature: null,
    relationshipContext: null,
  };

  if (!narrative) return elements;

  // Extract quoted phrases (things the client actually said)
  const quotedPhrases = narrative.match(/"([^"]+)"|'([^']+)'/g);
  if (quotedPhrases) {
    elements.personalPhrases = quotedPhrases.map(p => p.replace(/['"]/g, ""));
  }

  // Detect life stakes
  const stakesPatterns = [
    { pattern: /mortgage|home|house/i, stake: "home purchase or refinance" },
    { pattern: /car|vehicle|auto/i, stake: "vehicle purchase or financing" },
    { pattern: /apartment|rental|landlord/i, stake: "housing rental" },
    { pattern: /job|employment|work/i, stake: "employment opportunity" },
    { pattern: /business|loan/i, stake: "business financing" },
    { pattern: /medical|health|surgery/i, stake: "medical financing" },
    { pattern: /family|kids|children/i, stake: "family financial security" },
    { pattern: /retire|retirement/i, stake: "retirement security" },
    { pattern: /divorce|ex-spouse|separation/i, stake: "post-divorce financial recovery" },
  ];

  for (const { pattern, stake } of stakesPatterns) {
    if (pattern.test(narrative)) {
      elements.lifeStakes = stake;
      break;
    }
  }

  // Detect emotional temperature from narrative
  const emotionPatterns: { pattern: RegExp; emotion: EmotionalState }[] = [
    { pattern: /calm|patient|understand/i, emotion: "concerned" },
    { pattern: /furious|angry|livid/i, emotion: "angry_controlled" },
    { pattern: /frustrated|annoyed|irritated/i, emotion: "frustrated" },
    { pattern: /confused|don't understand|makes no sense/i, emotion: "confused" },
    { pattern: /determined|won't give up|keep fighting/i, emotion: "determined" },
    { pattern: /exhausted|tired|worn out/i, emotion: "exhausted" },
  ];

  for (const { pattern, emotion } of emotionPatterns) {
    if (pattern.test(narrative)) {
      elements.emotionalTemperature = emotion;
      break;
    }
  }

  // Detect relationship context
  const relationshipPatterns = [
    { pattern: /long.?time customer|years? (as )?customer|customer (for|since)/i, context: "long_term_customer" },
    { pattern: /never heard of|don't know|who is this/i, context: "unknown_company" },
    { pattern: /ex.?spouse|ex.?husband|ex.?wife/i, context: "ex_spouse_issue" },
    { pattern: /identity theft|stolen|fraud/i, context: "identity_theft" },
  ];

  for (const { pattern, context } of relationshipPatterns) {
    if (pattern.test(narrative)) {
      elements.relationshipContext = context;
      break;
    }
  }

  return elements;
}

// =============================================================================
// COMMUNICATION STYLE INFERENCE
// =============================================================================

function inferCommunicationStyle(
  ageRange: AgeRange,
  emotionalState: EmotionalState,
  entityType: "CRA" | "furnisher" | "collector"
): CommunicationStyle {
  // Younger consumers tend to be more direct
  if (ageRange === "18-29") {
    return emotionalState === "angry_controlled" ? "assertive" : "direct";
  }

  // Older consumers tend to be more formal
  if (ageRange === "60+") {
    return emotionalState === "concerned" ? "measured" : "formal";
  }

  // Collectors get assertive responses
  if (entityType === "collector") {
    return "assertive";
  }

  // Default based on emotional state
  switch (emotionalState) {
    case "concerned":
    case "confused":
      return "conversational";
    case "frustrated":
      return "direct";
    case "determined":
    case "resolute":
      return "measured";
    case "angry_controlled":
      return "assertive";
    default:
      return "conversational";
  }
}

// =============================================================================
// GEOGRAPHIC REGION INFERENCE
// =============================================================================

function inferGeographicRegion(address?: string): string | undefined {
  if (!address) return undefined;

  const state = extractStateFromAddress(address);
  if (!state) return undefined;

  // Regional groupings for subtle voice calibration
  const regions: Record<string, string[]> = {
    south: ["AL", "AR", "FL", "GA", "KY", "LA", "MS", "NC", "SC", "TN", "TX", "VA", "WV"],
    northeast: ["CT", "DC", "DE", "MA", "MD", "ME", "NH", "NJ", "NY", "PA", "RI", "VT"],
    midwest: ["IA", "IL", "IN", "KS", "MI", "MN", "MO", "ND", "NE", "OH", "SD", "WI"],
    west: ["AZ", "CA", "CO", "ID", "MT", "NM", "NV", "OR", "UT", "WA", "WY"],
  };

  for (const [region, states] of Object.entries(regions)) {
    if (states.includes(state)) {
      return region;
    }
  }

  return undefined;
}

function extractStateFromAddress(address: string): string | null {
  // Match common state patterns (e.g., ", GA 30301" or ", Georgia")
  const stateAbbrevMatch = address.match(/,\s*([A-Z]{2})\s+\d{5}/);
  if (stateAbbrevMatch) return stateAbbrevMatch[1];

  // Full state name matching could be added here
  return null;
}

// =============================================================================
// LIFE STAKES INFERENCE (when no narrative provided)
// =============================================================================

function inferLifeStakesFromAccount(
  accountType: string,
  currentStatus: string,
  reportedBalance?: number
): string {
  const type = accountType.toLowerCase();
  const status = currentStatus.toLowerCase();

  // Medical debt suggests health + financial stress
  if (type.includes("medical")) {
    return "medical treatment and financial stability";
  }

  // Collection accounts
  if (type.includes("collection")) {
    if (reportedBalance && reportedBalance < 500) {
      return "credit access for everyday needs";
    }
    if (reportedBalance && reportedBalance > 5000) {
      return "major financial goals and creditworthiness";
    }
    return "credit reputation and financial opportunities";
  }

  // Student loans
  if (type.includes("student")) {
    return "student loan management and financial future";
  }

  // Mortgage/home
  if (type.includes("mortgage") || type.includes("home")) {
    return "homeownership and family stability";
  }

  // Auto
  if (type.includes("auto") || type.includes("vehicle")) {
    return "reliable transportation for work and family";
  }

  // Credit cards with late payments
  if ((type.includes("credit card") || type.includes("revolving")) && status.includes("late")) {
    return "credit score and financial flexibility";
  }

  // Default
  return "creditworthiness and financial opportunities";
}

// =============================================================================
// MAIN SOUL ENGINE FUNCTION
// =============================================================================

/**
 * The Soul Engine - Automatic Consumer Voice Inference
 *
 * This function reads available data and constructs a complete consumer voice
 * profile. No specialist configuration required.
 *
 * @param input - The dispute data available
 * @returns A complete ConsumerVoiceProfile
 */
export function inferConsumerVoice(input: SoulEngineInput): ConsumerVoiceProfile {
  const { client, account, disputeConfig, disputeTarget } = input;

  // 1. Infer age range from DOB
  const ageRange = inferAgeRange(client.dob);

  // 2. Infer emotional state from round, mode, and prior responses
  const emotionalState = inferEmotionalState(
    disputeConfig.round,
    disputeConfig.mode,
    disputeConfig.priorResponses,
    disputeConfig.sentryTrigger
  );

  // 3. Infer legal literacy from round and mode
  const legalLiteracy = inferLegalLiteracy(disputeConfig.round, disputeConfig.mode);

  // 4. Infer formality baseline from target entity
  const formalityBaseline = inferFormalityBaseline(disputeTarget.entityType);

  // 5. Infer dispute fatigue from prior disputes
  const disputeFatigue = inferDisputeFatigue(disputeConfig.priorDisputeDates);

  // 6. Infer relationship to account
  let relationshipToAccount = inferRelationshipToAccount(account.accountType, account.currentStatus);

  // 7. Infer communication style
  let communicationStyle = inferCommunicationStyle(ageRange, emotionalState, disputeTarget.entityType);

  // 8. Infer geographic region
  const geographicRegion = inferGeographicRegion(client.address);

  // 9. Mine narrative for enrichment (if present)
  let lifeStakes = inferLifeStakesFromAccount(
    account.accountType,
    account.currentStatus,
    account.reportedBalance
  );
  let personalNarrativeElements: string[] = [];
  let voiceSource: VoiceSource = "data-inferred";
  let finalEmotionalState = emotionalState;

  if (disputeConfig.clientNarrative && disputeConfig.clientNarrative.trim().length > 0) {
    const narrativeElements = mineNarrative(disputeConfig.clientNarrative);
    voiceSource = "narrative-driven";

    // Override with narrative-extracted elements
    if (narrativeElements.lifeStakes) {
      lifeStakes = narrativeElements.lifeStakes;
    }
    if (narrativeElements.personalPhrases.length > 0) {
      personalNarrativeElements = narrativeElements.personalPhrases;
    }
    if (narrativeElements.emotionalTemperature) {
      finalEmotionalState = narrativeElements.emotionalTemperature;
    }
    if (narrativeElements.relationshipContext) {
      relationshipToAccount = narrativeElements.relationshipContext;
    }
  } else if (disputeConfig.round === 1 && !disputeConfig.priorDisputeDates?.length) {
    // Minimal data, use defaults
    voiceSource = "minimal-default";
    communicationStyle = "conversational";
  }

  // 10. Infer grammar posture from round, literacy, and style
  const grammarPosture = inferGrammarPosture(disputeConfig.round, legalLiteracy, communicationStyle);

  return {
    ageRange,
    communicationStyle,
    legalLiteracy,
    emotionalState: finalEmotionalState,
    grammarPosture,
    lifeStakes,
    personalNarrativeElements,
    relationshipToAccount,
    formalityBaseline,
    disputeFatigue,
    voiceSource,
    geographicRegion,
  };
}

// =============================================================================
// VOICE-BASED TEXT GENERATION HELPERS
// =============================================================================

/**
 * Get appropriate phrases for the consumer's voice profile
 */
export function getVoicePhrases(profile: ConsumerVoiceProfile): {
  disputeOpeners: string[];
  investigationRequests: string[];
  inaccuracyStatements: string[];
  frustrationExpressions: string[];
  closingStatements: string[];
} {
  const { communicationStyle, emotionalState, legalLiteracy, ageRange } = profile;

  // Base phrases by communication style
  const phrases = {
    disputeOpeners: [] as string[],
    investigationRequests: [] as string[],
    inaccuracyStatements: [] as string[],
    frustrationExpressions: [] as string[],
    closingStatements: [] as string[],
  };

  // Dispute openers by style
  switch (communicationStyle) {
    case "conversational":
      phrases.disputeOpeners = [
        "This is wrong",
        "I'm challenging this",
        "I need this looked at",
        "This doesn't belong on my report",
        "I'm writing about something that's not right",
      ];
      break;
    case "direct":
      phrases.disputeOpeners = [
        "I'm disputing this account",
        "There's an error that needs to be fixed",
        "This information is wrong and I want it corrected",
        "I'm formally disputing this entry",
      ];
      break;
    case "measured":
      phrases.disputeOpeners = [
        "I'm raising a formal dispute regarding this account",
        "I take issue with how this is being reported",
        "After reviewing my report, I need to dispute this information",
        "I am writing to dispute the accuracy of this entry",
      ];
      break;
    case "formal":
    case "assertive":
      phrases.disputeOpeners = [
        "I formally contest the accuracy of this entry",
        "I am initiating a dispute regarding this tradeline",
        "This reporting constitutes a verifiable inaccuracy",
        "I demand correction of this inaccurately reported item",
      ];
      break;
  }

  // Investigation requests by legal literacy
  switch (legalLiteracy) {
    case "low":
      phrases.investigationRequests = [
        "I need you to look into this",
        "Can you check on this?",
        "Please find out what's going on",
        "Someone needs to actually investigate this",
      ];
      break;
    case "medium":
      phrases.investigationRequests = [
        "I'm asking for a thorough investigation",
        "Please investigate this and get back to me",
        "I want to know how you verified this",
        "I need you to actually look into this, not just rubber stamp it",
      ];
      break;
    case "high":
      phrases.investigationRequests = [
        "I request that you conduct a reinvestigation pursuant to Section 611",
        "Please initiate your investigation procedures as required by law",
        "I demand a substantive reinvestigation, not a perfunctory ACDV response",
        "I expect a meaningful investigation that goes beyond the data furnisher",
      ];
      break;
  }

  // Inaccuracy statements by style
  switch (communicationStyle) {
    case "conversational":
      phrases.inaccuracyStatements = [
        "This is wrong",
        "The numbers don't match",
        "That's not what happened",
        "This isn't right",
        "My records show something different",
      ];
      break;
    case "direct":
      phrases.inaccuracyStatements = [
        "This information is inaccurate",
        "The reported data doesn't match my records",
        "This is factually incorrect",
        "The data you're showing is wrong",
      ];
      break;
    case "measured":
    case "formal":
      phrases.inaccuracyStatements = [
        "This entry contains material inaccuracies",
        "The reported information fails to reflect the actual account history",
        "This tradeline is reported in a manner inconsistent with verifiable documentation",
        "The information being reported is materially inaccurate",
      ];
      break;
    case "assertive":
      phrases.inaccuracyStatements = [
        "This is unverifiable and must be removed",
        "You are reporting false information",
        "This data is demonstrably inaccurate",
        "The information you're furnishing is wrong and I can prove it",
      ];
      break;
  }

  // Frustration expressions by emotional state
  switch (emotionalState) {
    case "confused":
      phrases.frustrationExpressions = [
        "I honestly don't understand how this is showing up",
        "This doesn't make any sense to me",
        "I'm confused about where this came from",
      ];
      break;
    case "concerned":
      phrases.frustrationExpressions = [
        "I'm worried about how this is going to affect me",
        "I need this handled because it's impacting my life",
        "This is causing me problems I don't deserve",
      ];
      break;
    case "frustrated":
      phrases.frustrationExpressions = [
        "I already told you this and nothing happened",
        "Your response didn't actually address anything",
        "I've been trying to resolve this and getting nowhere",
        "This is the runaround and I'm tired of it",
      ];
      break;
    case "determined":
      phrases.frustrationExpressions = [
        "I'm not going to let this go",
        "I have the records to prove this is wrong",
        "I will keep disputing until this is corrected",
        "I know I'm right and I can back it up",
      ];
      break;
    case "angry_controlled":
      phrases.frustrationExpressions = [
        "At this point I have to question whether you're taking this seriously",
        "I've been more than patient",
        "This is unacceptable and you know it",
        "I'm done being polite about this",
      ];
      break;
    case "exhausted":
      phrases.frustrationExpressions = [
        "I'm tired of fighting about this",
        "This has gone on way too long",
        "I've spent more time on this than anyone should have to",
        "I just want this resolved so I can move on",
      ];
      break;
    case "resolute":
      phrases.frustrationExpressions = [
        "I know exactly what my rights are",
        "You have an obligation and you're not meeting it",
        "This ends one way or another",
        "I'm prepared to take this as far as I need to",
      ];
      break;
    default:
      phrases.frustrationExpressions = [
        "I need this issue resolved",
        "Please take this seriously",
        "I expect better from your agency",
      ];
  }

  // Closing statements
  phrases.closingStatements = AGE_VOICE_MARKERS[ageRange].commonPhrases;

  return phrases;
}

/**
 * Apply voice profile to adjust text for authenticity
 */
export function applyVoiceToText(
  text: string,
  profile: ConsumerVoiceProfile
): string {
  let result = text;

  // Apply contractions based on age range
  const ageMarkers = AGE_VOICE_MARKERS[profile.ageRange];

  if (ageMarkers.contractions === "frequent") {
    // Apply contractions more liberally
    result = result
      .replace(/\bI am\b/g, "I'm")
      .replace(/\bI have\b/g, "I've")
      .replace(/\bI will\b/g, "I'll")
      .replace(/\bdo not\b/g, "don't")
      .replace(/\bcannot\b/g, "can't")
      .replace(/\bwill not\b/g, "won't")
      .replace(/\bit is\b/g, "it's")
      .replace(/\byou are\b/g, "you're")
      .replace(/\bthat is\b/g, "that's")
      .replace(/\bwould not\b/g, "wouldn't")
      .replace(/\bshould not\b/g, "shouldn't")
      .replace(/\bhave not\b/g, "haven't")
      .replace(/\bhas not\b/g, "hasn't")
      .replace(/\bis not\b/g, "isn't");
  } else if (ageMarkers.contractions === "moderate") {
    // Apply some contractions selectively
    result = result
      .replace(/\bI am\b/g, "I'm")
      .replace(/\bI have\b/g, "I've")
      .replace(/\bdo not\b/g, "don't")
      .replace(/\bcannot\b/g, "can't");
  }
  // "occasional" - leave most formal

  return result;
}

// =============================================================================
// VOICE PROFILE FORMATTING FOR AI PROMPTS
// =============================================================================

const STYLE_DESCRIPTIONS: Record<string, string> = {
  conversational: "Write like you're explaining to a friend - natural, flowing, with occasional tangents and personal asides",
  direct: "Get to the point - short sentences, clear demands, minimal fluff. You're not here to make friends.",
  measured: "Balanced approach - mix of explanation and direct statements. Professional but not robotic.",
  formal: "More structured language, but still human. You know the law and you're citing it properly.",
  assertive: "Strong, confident language. You know your rights and you're not backing down.",
};

const EMOTION_DESCRIPTIONS: Record<string, string> = {
  confused: "Show genuine confusion - why is this happening? You've done everything right and somehow your credit is wrong.",
  concerned: "Express worry about real consequences - can't get a mortgage, car loan, apartment. Your future is at stake.",
  frustrated: "Let frustration show - you've been dealing with this for too long. Multiple letters, no real answers.",
  determined: "Focused and persistent - you won't give up until this is fixed. You know your rights.",
  angry_controlled: "Angry but channeling it productively. You're furious but you're going to win this the right way.",
  exhausted: "Tired of fighting but still pushing forward. You can't afford to stop now.",
  resolute: "Firm and unwavering - this ends now. You're done playing games.",
};

const FATIGUE_DESCRIPTIONS: Record<string, string> = {
  none: "First time disputing - unfamiliar with the process but ready to fight",
  mild: "You've been through this before - you know what to expect but still hopeful",
  significant: "Multiple disputes, same problems - you're tired of repeating yourself",
  severe: "This has been going on too long - you're exhausted but determined to see it through",
};

/**
 * Format voice profile for AI prompt injection
 *
 * This creates a detailed voice description that guides the AI
 * to write in the consumer's authentic voice.
 */
export function formatVoiceProfileForPrompt(profile: ConsumerVoiceProfile): string {
  const ageGuidance: Record<AgeRange, string> = {
    "18-29": "Younger voice - uses contractions frequently (I'm, don't, can't), more casual sentence structure, comfortable with direct language",
    "30-44": "Mid-range voice - natural contractions, mix of casual and professional, confident but not aggressive",
    "45-59": "Moderate formality - some contractions, more measured language, draws on life experience",
    "60+": "More formal approach - fewer contractions, dignified tone, references to decades of responsible credit history",
  };

  const literacyGuidance: Record<string, string> = {
    low: "Knows something is wrong but not sure of the legal specifics. References 'the law' generally. Focuses on fairness.",
    medium: "Familiar with FCRA basics. Can cite the 30-day rule and accuracy requirements. Getting more confident.",
    high: "Well-versed in credit law. Cites specific statutes, references court cases, knows the procedural requirements.",
  };

  const formalityGuidance: Record<number, string> = {
    1: "Very casual - sentence fragments OK, conversational asides, emotional expressions",
    2: "Casual-moderate - mostly complete sentences, natural flow, some informal language",
    3: "Moderate-formal - proper sentences, professional tone, occasional personal touches",
    4: "Formal - complete sentences, precise language, minimal casual expressions",
  };

  const styleDesc = STYLE_DESCRIPTIONS[profile.communicationStyle] || STYLE_DESCRIPTIONS.direct;
  const emotionDesc = EMOTION_DESCRIPTIONS[profile.emotionalState] || EMOTION_DESCRIPTIONS.frustrated;
  const fatigueDesc = FATIGUE_DESCRIPTIONS[profile.disputeFatigue] || FATIGUE_DESCRIPTIONS.none;
  const ageDesc = ageGuidance[profile.ageRange];
  const literacyDesc = literacyGuidance[profile.legalLiteracy] || literacyGuidance.medium;
  const formalityDesc = formalityGuidance[profile.grammarPosture] || formalityGuidance[2];

  const lines = [
    "=== CONSUMER VOICE PROFILE ===",
    "",
    `AGE RANGE: ${profile.ageRange}`,
    ageDesc,
    "",
    `EMOTIONAL STATE: ${profile.emotionalState}`,
    emotionDesc,
    "",
    `COMMUNICATION STYLE: ${profile.communicationStyle}`,
    styleDesc,
    "",
    `LEGAL LITERACY: ${profile.legalLiteracy}`,
    literacyDesc,
    "",
    `FORMALITY LEVEL: ${profile.grammarPosture}/4`,
    formalityDesc,
    "",
    `DISPUTE FATIGUE: ${profile.disputeFatigue}`,
    fatigueDesc,
    "",
    `LIFE STAKES: ${profile.lifeStakes}`,
    "",
    "=== VOICE DIRECTIVES ===",
    "",
    "1. Write AS this person, not ABOUT them",
    "2. Use their vocabulary and sentence patterns",
    "3. Express their specific emotional state",
    "4. Match their level of legal sophistication",
    "5. Reflect their frustration/fatigue level",
    "",
  ];

  // Add personal narrative elements if available
  if (profile.personalNarrativeElements && profile.personalNarrativeElements.length > 0) {
    lines.push("PERSONAL ELEMENTS TO INCORPORATE:");
    for (const element of profile.personalNarrativeElements) {
      lines.push(`- ${element}`);
    }
    lines.push("");
  }

  // Add region-specific guidance if available
  if (profile.geographicRegion) {
    const regionHints: Record<string, string> = {
      south: "Slightly warmer tone, may use 'y'all' or other regional expressions naturally",
      northeast: "More direct and assertive, less small talk",
      midwest: "Polite but firm, may use softer language",
      west: "Casual and direct, less formal structure",
    };
    lines.push(`REGIONAL VOICE HINT: ${regionHints[profile.geographicRegion] || ""}`);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Get prohibited phrases for this voice profile
 *
 * Some phrases are especially wrong for certain voices.
 */
export function getProhibitedPhrasesForVoice(profile: ConsumerVoiceProfile): string[] {
  const prohibited: string[] = [
    // Always prohibited
    "this letter is to inform you",
    "i am writing to dispute",
    "please be advised",
    "pursuant to",
    "in accordance with",
    "i hereby",
  ];

  // Age-specific prohibitions
  if (profile.ageRange === "18-29" || profile.ageRange === "30-44") {
    prohibited.push(
      "kindly",
      "henceforth",
      "aforementioned",
      "heretofore",
      "furthermore"
    );
  }

  // Style-specific prohibitions
  if (profile.communicationStyle === "direct") {
    prohibited.push(
      "i would like to",
      "perhaps you could",
      "it would be appreciated if",
      "at your earliest convenience"
    );
  }

  // Literacy-specific prohibitions
  if (profile.legalLiteracy === "low") {
    prohibited.push(
      "prima facie",
      "ipso facto",
      "inter alia",
      "supra"
    );
  }

  return prohibited;
}

export default inferConsumerVoice;
