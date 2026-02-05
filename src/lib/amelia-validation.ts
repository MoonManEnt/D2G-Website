/**
 * AMELIA VALIDATION ENGINE
 *
 * Validation systems to ensure letters pass authenticity checks:
 * 1. Kitchen Table Test - Could this have been written by the actual consumer?
 * 2. Anti-AI Voice Checklist - Does this letter sound machine-generated?
 * 3. Anti-Template Fingerprint Check - Does this match known templates?
 * 4. Uniqueness Verification - Is this letter forensically unique?
 */

import type { ConsumerVoiceProfile } from "./amelia-soul-engine";

// =============================================================================
// TYPES
// =============================================================================

export interface ValidationResult {
  passed: boolean;
  score: number; // 1-10
  issues: ValidationIssue[];
  recommendations: string[];
}

export interface ValidationIssue {
  code: string;
  severity: "warning" | "error";
  description: string;
  location?: string;
}

export interface LetterValidationInput {
  letterBody: string;
  voiceProfile: ConsumerVoiceProfile;
  round: number;
  priorLetters?: string[];
}

// =============================================================================
// KNOWN TEMPLATE FINGERPRINTS - NEVER USE THESE
// =============================================================================

const TEMPLATE_FINGERPRINTS = [
  "this letter is to inform you that",
  "i am writing to dispute the following",
  "the following items are inaccurate",
  "under the fair credit reporting act",
  "please investigate the following items",
  "i demand that you remove",
  "this is not a duplicate dispute",
  "i have the right to an accurate credit report",
  "i am exercising my rights as a consumer",
  "please be advised that",
  "failure to comply will result in",
  "pursuant to section",
  "in accordance with",
  "i hereby dispute",
  "kindly note that",
  "be informed that",
  "take notice that",
  "for your information",
  "i am formally notifying you",
  "this constitutes formal notice",
];

// =============================================================================
// AI-GENERATED FINGERPRINTS - AVOID THESE PATTERNS
// =============================================================================

const AI_FINGERPRINTS = {
  // Patterns that scream AI
  perfectParallelism: /(.+), (.+), and (.+)\./g, // Three-item lists are AI's favorite
  uniformParagraphStarts: /^(I |The |This |My |Your )/gm,
  overlySmooth: /furthermore|moreover|additionally|consequently|subsequently/gi,
  genericEmpathy: /deeply concerned|value the integrity|understand the importance/gi,
  perfectCommaUsage: true, // This is checked structurally
  noContractions: true, // Checked by counting
  noFragments: true, // Checked structurally
  perfectSummary: /in conclusion|to summarize|in summary|to sum up/gi,
};

// =============================================================================
// KITCHEN TABLE TEST
// =============================================================================

/**
 * The Kitchen Table Test
 *
 * Could this letter have been written by the actual consumer, sitting at their
 * kitchen table, after spending a few hours researching their rights online,
 * feeling frustrated and determined, with their credit report printed out in
 * front of them and a cup of coffee getting cold?
 */
export function runKitchenTableTest(input: LetterValidationInput): ValidationResult {
  const { letterBody, voiceProfile } = input;
  const issues: ValidationIssue[] = [];
  let score = 10;

  // 1. Check for personal specificity
  const hasPersonalDetail = checkPersonalSpecificity(letterBody);
  if (!hasPersonalDetail) {
    issues.push({
      code: "KTT_NO_PERSONAL",
      severity: "error",
      description: "Letter lacks personal life details that make it impossible to template",
    });
    score -= 2;
  }

  // 2. Check for genuine emotion (not performed emotion)
  const hasGenuineEmotion = checkGenuineEmotion(letterBody, voiceProfile);
  if (!hasGenuineEmotion) {
    issues.push({
      code: "KTT_NO_EMOTION",
      severity: "warning",
      description: "Letter lacks authentic emotional texture",
    });
    score -= 1;
  }

  // 3. Check for earned legal knowledge vs inserted legal knowledge
  const legalKnowledgeNatural = checkLegalKnowledgeIntegration(letterBody, voiceProfile);
  if (!legalKnowledgeNatural) {
    issues.push({
      code: "KTT_LEGAL_UNNATURAL",
      severity: "warning",
      description: "Legal citations feel programmed rather than learned",
    });
    score -= 1;
  }

  // 4. Check for personality showing through
  const hasPersonality = checkPersonalityMarkers(letterBody, voiceProfile);
  if (!hasPersonality) {
    issues.push({
      code: "KTT_NO_PERSONALITY",
      severity: "warning",
      description: "Letter lacks individual personality markers",
    });
    score -= 1;
  }

  // 5. Check if it sounds like a credit repair company
  const soundsLikeCRO = checkCreditRepairOrgPatterns(letterBody);
  if (soundsLikeCRO) {
    issues.push({
      code: "KTT_CRO_PATTERN",
      severity: "error",
      description: "Letter sounds like it came from a credit repair organization",
    });
    score -= 3;
  }

  // 6. Check overall natural flow
  const hasNaturalFlow = checkNaturalFlow(letterBody);
  if (!hasNaturalFlow) {
    issues.push({
      code: "KTT_UNNATURAL_FLOW",
      severity: "warning",
      description: "Letter has unnatural paragraph or sentence flow",
    });
    score -= 1;
  }

  return {
    passed: score >= 7,
    score: Math.max(1, score),
    issues,
    recommendations: generateKTTRecommendations(issues),
  };
}

// Kitchen Table Test Helper Functions

function checkPersonalSpecificity(text: string): boolean {
  // Look for specific personal details
  const personalPatterns = [
    /\d{1,2}\s*(years?|months?)\s*(old|ago)/i, // Age or time references
    /my\s+(wife|husband|kids?|daughter|son|family|mother|father)/i, // Family references
    /(applied|denied|rejected)\s+(for|from)\s+/i, // Application references
    /\$\s*[\d,]+/i, // Specific dollar amounts
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}/i, // Specific dates
    /since\s+\d{4}/i, // Year references
    /(mortgage|car|apartment|job|home|loan)\s+(application|approval|denial)/i, // Life events
  ];

  return personalPatterns.some(pattern => pattern.test(text));
}

function checkGenuineEmotion(text: string, profile: ConsumerVoiceProfile): boolean {
  // Generic AI emotions to avoid
  const genericEmotions = [
    "deeply concerned",
    "greatly appreciate",
    "sincerely hope",
    "kindly request",
    "humbly ask",
    "respectfully submit",
  ];

  // Real human emotions
  const genuineEmotions = [
    "frustrat",
    "confus",
    "upset",
    "angry",
    "tired of",
    "sick of",
    "can't believe",
    "don't understand",
    "makes no sense",
    "runaround",
    "ignored",
    "nightmare",
    "struggling",
    "stressed",
    "worried",
    "need this fixed",
  ];

  const hasGeneric = genericEmotions.some(e => text.toLowerCase().includes(e));
  const hasGenuine = genuineEmotions.some(e => text.toLowerCase().includes(e));

  // Penalize generic, reward genuine
  return hasGenuine && !hasGeneric;
}

function checkLegalKnowledgeIntegration(text: string, profile: ConsumerVoiceProfile): boolean {
  // Count legal citations
  const citationCount = (text.match(/§\s*\d+|15\s*U\.?S\.?C\.?\s*§?\s*\d+|section\s+\d+/gi) || []).length;

  // Low literacy should have few/no citations
  if (profile.legalLiteracy === "low" && citationCount > 1) {
    return false;
  }

  // Medium literacy should paraphrase more than cite
  if (profile.legalLiteracy === "medium") {
    const paraphrases = (text.match(/(law says|i (have|know) the right|required (to|by)|supposed to|legally)/gi) || []).length;
    if (citationCount > paraphrases + 2) {
      return false;
    }
  }

  // Check for unnatural citation stacking (AI pattern)
  const citationLines = text.split("\n").filter(line => /§\s*\d+|15\s*U\.?S\.?C/i.test(line));
  if (citationLines.length > 3 && citationCount / citationLines.length > 1.5) {
    return false; // Too many citations clustered
  }

  return true;
}

function checkPersonalityMarkers(text: string, profile: ConsumerVoiceProfile): boolean {
  // Check for elements that show individual personality
  const markers = {
    // Conversational markers
    conversational: [
      "honestly",
      "seriously",
      "basically",
      "look,",
      "listen,",
      "here's the thing",
      "let me be clear",
    ],
    // Emphatic markers
    emphatic: [
      "!",
      "—",
      "...",
      "NOT",
      "NEVER",
      "WRONG",
    ],
    // Personal interjections
    interjections: [
      "I mean",
      "you know",
      "the thing is",
      "what I'm saying is",
    ],
  };

  let markerCount = 0;

  for (const category of Object.values(markers)) {
    for (const marker of category) {
      if (text.toLowerCase().includes(marker.toLowerCase())) {
        markerCount++;
      }
    }
  }

  // Should have at least 2 personality markers
  return markerCount >= 2;
}

function checkCreditRepairOrgPatterns(text: string): boolean {
  const lowerText = text.toLowerCase();

  // Check for template fingerprints
  for (const fingerprint of TEMPLATE_FINGERPRINTS) {
    if (lowerText.includes(fingerprint)) {
      return true;
    }
  }

  // Check for numbered lists (template pattern)
  const numberedLists = text.match(/^\s*\d+\.\s+/gm) || [];
  if (numberedLists.length > 3) {
    return true; // Too many numbered items = template
  }

  // Check for header patterns like "RE: DISPUTE" or "FORMAL DISPUTE LETTER"
  if (/^(RE:|FORMAL|OFFICIAL)\s*(DISPUTE|CREDIT|NOTICE)/mi.test(text)) {
    return true;
  }

  return false;
}

function checkNaturalFlow(text: string): boolean {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

  // Check paragraph length variation (humans vary, templates don't)
  const lengths = paragraphs.map(p => p.length);
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length;

  // Low variance = suspicious uniformity
  if (variance < 1000 && paragraphs.length > 3) {
    return false;
  }

  // Check sentence length variation within paragraphs
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  const sentenceLengths = sentences.map(s => s.trim().split(/\s+/).length);
  const sentenceVariance = sentenceLengths.reduce((sum, len) => {
    const avg = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
    return sum + Math.pow(len - avg, 2);
  }, 0) / sentenceLengths.length;

  // Very uniform sentences = suspicious
  if (sentenceVariance < 10 && sentences.length > 5) {
    return false;
  }

  return true;
}

function generateKTTRecommendations(issues: ValidationIssue[]): string[] {
  const recommendations: string[] = [];

  for (const issue of issues) {
    switch (issue.code) {
      case "KTT_NO_PERSONAL":
        recommendations.push(
          "Add at least one specific personal detail: a date, an amount, a family reference, or a life circumstance that is unique to this consumer"
        );
        break;
      case "KTT_NO_EMOTION":
        recommendations.push(
          "Replace generic emotional language with authentic frustration: 'I don't understand...' or 'This is affecting my ability to...'"
        );
        break;
      case "KTT_LEGAL_UNNATURAL":
        recommendations.push(
          "Paraphrase legal knowledge instead of citing statutes directly. Use phrases like 'I know I have the right to...' or 'The law says you have to...'"
        );
        break;
      case "KTT_NO_PERSONALITY":
        recommendations.push(
          "Add personality markers: an interjection, an emphatic statement, or a conversational aside that shows the person's character"
        );
        break;
      case "KTT_CRO_PATTERN":
        recommendations.push(
          "CRITICAL: Rewrite to remove credit repair organization template language. Start fresh from the consumer's perspective."
        );
        break;
      case "KTT_UNNATURAL_FLOW":
        recommendations.push(
          "Vary paragraph and sentence lengths. Let some points be shorter, some longer. Add natural rhythm variation."
        );
        break;
    }
  }

  return recommendations;
}

// =============================================================================
// ANTI-AI VOICE CHECKLIST
// =============================================================================

/**
 * Anti-AI Voice Checklist
 *
 * Checks for patterns that indicate AI-generated content:
 * - Unnaturally perfect grammar
 * - Uniform sentence sophistication
 * - Generic emotional language
 * - Over-structured argumentation
 * - Vocabulary consistency
 * - Absence of personal specificity
 * - Predictable legal citation patterns
 * - No soul
 */
export function runAntiAIChecklist(input: LetterValidationInput): ValidationResult {
  const { letterBody, voiceProfile } = input;
  const issues: ValidationIssue[] = [];
  let score = 10;

  // 1. Check for unnaturally perfect grammar
  const grammarCheck = checkGrammarPerfection(letterBody, voiceProfile);
  if (grammarCheck.tooPerfect) {
    issues.push({
      code: "AI_PERFECT_GRAMMAR",
      severity: "warning",
      description: "Grammar is suspiciously perfect for the consumer's voice profile",
    });
    score -= 1;
  }

  // 2. Check for uniform sentence sophistication
  const sophisticationCheck = checkSentenceSophistication(letterBody);
  if (sophisticationCheck.tooUniform) {
    issues.push({
      code: "AI_UNIFORM_SOPHISTICATION",
      severity: "warning",
      description: "Sentence complexity is unnaturally uniform throughout",
    });
    score -= 1;
  }

  // 3. Check for generic emotional language
  const emotionCheck = checkGenericEmotions(letterBody);
  if (emotionCheck.hasGeneric) {
    issues.push({
      code: "AI_GENERIC_EMOTION",
      severity: "error",
      description: "Contains generic AI emotional language",
      location: emotionCheck.location,
    });
    score -= 2;
  }

  // 4. Check for over-structured argumentation
  const structureCheck = checkOverStructuredArguments(letterBody);
  if (structureCheck.tooStructured) {
    issues.push({
      code: "AI_OVER_STRUCTURED",
      severity: "warning",
      description: "Paragraphs are too perfectly organized with topic sentences and conclusions",
    });
    score -= 1;
  }

  // 5. Check for vocabulary consistency (should vary)
  const vocabCheck = checkVocabularyVariation(letterBody);
  if (vocabCheck.tooConsistent) {
    issues.push({
      code: "AI_VOCAB_CONSISTENT",
      severity: "warning",
      description: "Vocabulary register is unnaturally consistent throughout",
    });
    score -= 1;
  }

  // 6. Check for smooth transitions (too smooth = AI)
  const transitionCheck = checkTransitions(letterBody);
  if (transitionCheck.tooSmooth) {
    issues.push({
      code: "AI_SMOOTH_TRANSITIONS",
      severity: "warning",
      description: "Transitions between paragraphs are suspiciously smooth",
    });
    score -= 1;
  }

  // 7. Check for three-item pattern (AI's favorite)
  const threeItemCheck = checkThreeItemPattern(letterBody);
  if (threeItemCheck.detected) {
    issues.push({
      code: "AI_THREE_ITEM_PATTERN",
      severity: "warning",
      description: "Contains AI's signature three-item list pattern",
      location: threeItemCheck.location,
    });
    score -= 1;
  }

  // 8. Check for sentence fragments (humans use them, AI avoids them)
  const fragmentCheck = checkForFragments(letterBody);
  if (fragmentCheck.noFragments && voiceProfile.communicationStyle !== "formal") {
    issues.push({
      code: "AI_NO_FRAGMENTS",
      severity: "warning",
      description: "Letter has zero sentence fragments - real people use them for emphasis",
    });
    score -= 0.5;
  }

  // 9. Check for contraction usage (should match voice profile)
  const contractionCheck = checkContractionUsage(letterBody, voiceProfile);
  if (!contractionCheck.appropriate) {
    issues.push({
      code: "AI_CONTRACTION_MISMATCH",
      severity: "warning",
      description: contractionCheck.issue || "Contraction usage doesn't match voice profile",
    });
    score -= 1;
  }

  // 10. Check for perfect summary/conclusion (AI pattern)
  const summaryCheck = checkPerfectSummary(letterBody);
  if (summaryCheck.hasPerfectSummary) {
    issues.push({
      code: "AI_PERFECT_SUMMARY",
      severity: "warning",
      description: "Letter ends with a perfect summary that restates main points - AI pattern",
    });
    score -= 1;
  }

  return {
    passed: score >= 7,
    score: Math.max(1, score),
    issues,
    recommendations: generateAntiAIRecommendations(issues),
  };
}

// Anti-AI Checklist Helper Functions

function checkGrammarPerfection(text: string, profile: ConsumerVoiceProfile): { tooPerfect: boolean } {
  // For conversational or direct styles from non-formal consumers, some imperfection is expected
  if (profile.communicationStyle === "conversational" || profile.communicationStyle === "direct") {
    // Check for imperfections
    const imperfections = [
      /—/g, // Dashes
      /\.\.\./g, // Ellipses
      /^And\s/gm, // Starting with And
      /^But\s/gm, // Starting with But
      /,\s*and\s*$/gm, // Trailing conjunctions
    ];

    const hasImperfections = imperfections.some(pattern => pattern.test(text));
    return { tooPerfect: !hasImperfections };
  }

  return { tooPerfect: false };
}

function checkSentenceSophistication(text: string): { tooUniform: boolean } {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  if (sentences.length < 5) return { tooUniform: false };

  // Calculate complexity scores based on word count and clause indicators
  const complexityScores = sentences.map(s => {
    const words = s.trim().split(/\s+/).length;
    const clauses = (s.match(/,|which|that|because|although|while|if|when/gi) || []).length;
    return words + (clauses * 3);
  });

  // Check variance in complexity
  const avg = complexityScores.reduce((a, b) => a + b, 0) / complexityScores.length;
  const variance = complexityScores.reduce((sum, score) => sum + Math.pow(score - avg, 2), 0) / complexityScores.length;

  // Low variance = too uniform
  return { tooUniform: variance < 20 };
}

function checkGenericEmotions(text: string): { hasGeneric: boolean; location?: string } {
  const genericPhrases = [
    "deeply concerned about the impact",
    "value the integrity",
    "understand the importance of accurate",
    "sincerely appreciate your attention",
    "grateful for your time",
    "i understand that you",
    "i appreciate the opportunity",
    "thank you for your consideration",
  ];

  const lowerText = text.toLowerCase();
  for (const phrase of genericPhrases) {
    if (lowerText.includes(phrase)) {
      return { hasGeneric: true, location: phrase };
    }
  }

  return { hasGeneric: false };
}

function checkOverStructuredArguments(text: string): { tooStructured: boolean } {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  if (paragraphs.length < 3) return { tooStructured: false };

  // Check if every paragraph has a clear topic sentence structure
  let structuredCount = 0;
  for (const para of paragraphs) {
    const sentences = para.match(/[^.!?]+[.!?]+/g) || [];
    if (sentences.length >= 3) {
      // Check for topic sentence → support → conclusion pattern
      const firstSentence = sentences[0];
      const lastSentence = sentences[sentences.length - 1];
      const firstSentenceShort = firstSentence ? firstSentence.split(/\s+/).length < 15 : false;
      const hasTransition = lastSentence ? /therefore|thus|as a result|in conclusion|consequently/i.test(lastSentence) : false;
      if (firstSentenceShort && hasTransition) {
        structuredCount++;
      }
    }
  }

  return { tooStructured: structuredCount > paragraphs.length * 0.6 };
}

function checkVocabularyVariation(text: string): { tooConsistent: boolean } {
  const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  if (words.length < 50) return { tooConsistent: false };

  // Check for mix of formal and informal
  const formalWords = ["therefore", "pursuant", "accordingly", "hereby", "aforementioned", "hereafter"];
  const informalWords = ["basically", "honestly", "seriously", "really", "actually", "just"];

  const formalCount = words.filter(w => formalWords.includes(w)).length;
  const informalCount = words.filter(w => informalWords.includes(w)).length;

  // AI tends to be all formal or all informal
  // Real people mix
  const hasMix = (formalCount > 0 && informalCount > 0) || (formalCount === 0 && informalCount === 0);

  return { tooConsistent: !hasMix && (formalCount > 3 || informalCount > 5) };
}

function checkTransitions(text: string): { tooSmooth: boolean } {
  const smoothTransitions = [
    "furthermore",
    "moreover",
    "additionally",
    "in addition",
    "consequently",
    "as a result",
    "therefore",
    "thus",
    "hence",
    "accordingly",
  ];

  const lowerText = text.toLowerCase();
  let smoothCount = 0;

  for (const transition of smoothTransitions) {
    const matches = lowerText.match(new RegExp(`\\b${transition}\\b`, "g")) || [];
    smoothCount += matches.length;
  }

  // More than 3 smooth transitions in a letter is suspicious
  return { tooSmooth: smoothCount > 3 };
}

function checkThreeItemPattern(text: string): { detected: boolean; location?: string } {
  // AI loves listing exactly three things
  const threeItemPatterns = [
    /(\w+), (\w+), and (\w+)/g, // "accurate, complete, and verifiable"
    /three (\w+)/gi, // "three reasons"
    /first[,.].*second[,.].*third[,.]/gi, // "First, ... Second, ... Third, ..."
  ];

  for (const pattern of threeItemPatterns) {
    const match = text.match(pattern);
    if (match && match.length > 1) {
      return { detected: true, location: match[0] };
    }
  }

  return { detected: false };
}

function checkForFragments(text: string): { noFragments: boolean } {
  // Look for sentence fragments (phrases ending in . ! ? without a main verb)
  const potentialFragments = [
    /^(Not|Never|Nothing|No way|Absolutely|Definitely|Exactly|Wrong)\s*[.!]$/gm,
    /^(And|But|Or|So|Because)\s+[^.!?]*[.!?]$/gm, // Starting with conjunction
    /^[A-Z][^.!?]{0,30}\.$/gm, // Short sentences that might be fragments
  ];

  let fragmentCount = 0;
  for (const pattern of potentialFragments) {
    const matches = text.match(pattern) || [];
    fragmentCount += matches.length;
  }

  return { noFragments: fragmentCount === 0 };
}

function checkContractionUsage(text: string, profile: ConsumerVoiceProfile): {
  appropriate: boolean;
  issue?: string;
} {
  const contractions = (text.match(/\b(I'm|I've|I'll|don't|can't|won't|it's|that's|you're|they're|wouldn't|shouldn't|haven't|hasn't|isn't)\b/gi) || []).length;
  const wordCount = text.split(/\s+/).length;
  const contractionRate = contractions / wordCount;

  // Conversational style should have more contractions
  if (profile.communicationStyle === "conversational" || profile.communicationStyle === "direct") {
    if (contractionRate < 0.02) {
      return {
        appropriate: false,
        issue: "Letter uses too few contractions for a conversational voice",
      };
    }
  }

  // Formal style should have fewer contractions
  if (profile.communicationStyle === "formal" && contractionRate > 0.05) {
    return {
      appropriate: false,
      issue: "Letter uses too many contractions for a formal voice",
    };
  }

  return { appropriate: true };
}

function checkPerfectSummary(text: string): { hasPerfectSummary: boolean } {
  const summaryPatterns = [
    /in (conclusion|summary)/i,
    /to (summarize|sum up|conclude)/i,
    /as (stated|mentioned|noted) (above|earlier)/i,
    /the main points (are|include)/i,
  ];

  const paragraphs = text.split(/\n\s*\n/);
  const lastParagraph = paragraphs[paragraphs.length - 1] || "";

  for (const pattern of summaryPatterns) {
    if (pattern.test(lastParagraph)) {
      return { hasPerfectSummary: true };
    }
  }

  return { hasPerfectSummary: false };
}

function generateAntiAIRecommendations(issues: ValidationIssue[]): string[] {
  const recommendations: string[] = [];

  for (const issue of issues) {
    switch (issue.code) {
      case "AI_PERFECT_GRAMMAR":
        recommendations.push(
          "Add natural imperfections: start a sentence with 'And' or 'But', use a dash for interjection, or include a slightly long run-on"
        );
        break;
      case "AI_UNIFORM_SOPHISTICATION":
        recommendations.push(
          "Vary sentence complexity: follow a complex sentence with a short punchy one. Let the rhythm breathe."
        );
        break;
      case "AI_GENERIC_EMOTION":
        recommendations.push(
          `REMOVE: "${issue.location}". Replace with specific frustration: "This is wrong and I can prove it" or "I've been dealing with this for months"`
        );
        break;
      case "AI_OVER_STRUCTURED":
        recommendations.push(
          "Break the perfect paragraph structure. Let a paragraph be just one emphatic sentence. Let another ramble because the person had a lot to say."
        );
        break;
      case "AI_VOCAB_CONSISTENT":
        recommendations.push(
          "Mix formal and informal language. A person might say 'pursuant to' in one sentence and 'basically' in the next."
        );
        break;
      case "AI_SMOOTH_TRANSITIONS":
        recommendations.push(
          "Remove some formal transitions. Real people jump between points without 'Furthermore' and 'Moreover'. Just say it."
        );
        break;
      case "AI_THREE_ITEM_PATTERN":
        recommendations.push(
          `Avoid three-item lists. Change "${issue.location}" to two items or four, or rephrase entirely.`
        );
        break;
      case "AI_NO_FRAGMENTS":
        recommendations.push(
          "Add a sentence fragment for emphasis. 'Not once.' or 'Wrong.' or 'Unacceptable.' Real people do this."
        );
        break;
      case "AI_CONTRACTION_MISMATCH":
        recommendations.push(issue.description || "Adjust contraction usage to match the consumer's voice");
        break;
      case "AI_PERFECT_SUMMARY":
        recommendations.push(
          "Remove the summary conclusion. End with determination or consequence, not a recap of your points."
        );
        break;
    }
  }

  return recommendations;
}

// =============================================================================
// UNIQUENESS VERIFICATION
// =============================================================================

/**
 * Uniqueness Verification Protocol
 *
 * Ensures no two letters share:
 * - Opening construction
 * - Four-word-or-longer identical phrases
 * - Paragraph structure patterns
 * - Legal citation placement patterns
 * - Closing strategy
 */
export function runUniquenessCheck(input: LetterValidationInput): ValidationResult {
  const { letterBody, priorLetters = [] } = input;
  const issues: ValidationIssue[] = [];
  let score = 10;

  if (priorLetters.length === 0) {
    return { passed: true, score: 10, issues: [], recommendations: [] };
  }

  // 1. Check opening sentence uniqueness
  const openingCheck = checkOpeningUniqueness(letterBody, priorLetters);
  if (!openingCheck.unique) {
    issues.push({
      code: "UNIQUE_OPENING",
      severity: "error",
      description: "Opening sentence matches a prior letter",
    });
    score -= 3;
  }

  // 2. Check for shared phrases (4+ words)
  const phraseCheck = checkSharedPhrases(letterBody, priorLetters);
  if (phraseCheck.sharedPhrases.length > 0) {
    issues.push({
      code: "UNIQUE_PHRASES",
      severity: "warning",
      description: `Found ${phraseCheck.sharedPhrases.length} shared phrases with prior letters`,
      location: phraseCheck.sharedPhrases.slice(0, 3).join(", "),
    });
    score -= Math.min(3, phraseCheck.sharedPhrases.length);
  }

  // 3. Check paragraph structure pattern
  const structureCheck = checkStructurePattern(letterBody, priorLetters);
  if (!structureCheck.unique) {
    issues.push({
      code: "UNIQUE_STRUCTURE",
      severity: "warning",
      description: "Paragraph structure matches a prior letter",
    });
    score -= 1;
  }

  // 4. Check legal citation placement
  const citationCheck = checkCitationPlacement(letterBody, priorLetters);
  if (!citationCheck.unique) {
    issues.push({
      code: "UNIQUE_CITATIONS",
      severity: "warning",
      description: "Legal citation placement pattern matches a prior letter",
    });
    score -= 1;
  }

  // 5. Check closing uniqueness
  const closingCheck = checkClosingUniqueness(letterBody, priorLetters);
  if (!closingCheck.unique) {
    issues.push({
      code: "UNIQUE_CLOSING",
      severity: "warning",
      description: "Closing paragraph strategy matches a prior letter",
    });
    score -= 1;
  }

  return {
    passed: score >= 7,
    score: Math.max(1, score),
    issues,
    recommendations: generateUniquenessRecommendations(issues),
  };
}

// Uniqueness Check Helper Functions

function checkOpeningUniqueness(text: string, priorLetters: string[]): { unique: boolean } {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  const firstSentence = sentences[0];
  if (!firstSentence) return { unique: true };

  const opening = firstSentence.toLowerCase().trim();

  for (const prior of priorLetters) {
    const priorSentences = prior.match(/[^.!?]+[.!?]+/g) || [];
    const priorFirstSentence = priorSentences[0];
    if (priorFirstSentence) {
      const priorOpening = priorFirstSentence.toLowerCase().trim();
      // Check for similarity (not exact match, but close)
      if (opening === priorOpening || levenshteinSimilarity(opening, priorOpening) > 0.8) {
        return { unique: false };
      }
    }
  }

  return { unique: true };
}

function checkSharedPhrases(text: string, priorLetters: string[]): { sharedPhrases: string[] } {
  const sharedPhrases: string[] = [];
  const words = text.toLowerCase().split(/\s+/);

  // Extract all 4+ word phrases
  const phrases = new Set<string>();
  for (let i = 0; i <= words.length - 4; i++) {
    const phrase = words.slice(i, i + 4).join(" ");
    phrases.add(phrase);
  }

  // Check against prior letters
  for (const prior of priorLetters) {
    const priorLower = prior.toLowerCase();
    for (const phrase of phrases) {
      if (priorLower.includes(phrase) && !isCommonPhrase(phrase)) {
        sharedPhrases.push(phrase);
      }
    }
  }

  return { sharedPhrases };
}

function isCommonPhrase(phrase: string): boolean {
  // Common phrases that are okay to repeat
  const commonPhrases = [
    "i am writing to",
    "on my credit report",
    "please let me know",
    "thank you for your",
    "i look forward to",
    "as soon as possible",
    "within 30 days of",
    "under the fair credit",
  ];

  return commonPhrases.some(common => phrase.includes(common));
}

function checkStructurePattern(text: string, priorLetters: string[]): { unique: boolean } {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const pattern = paragraphs.map(p => {
    const wordCount = p.split(/\s+/).length;
    if (wordCount < 30) return "S";
    if (wordCount < 80) return "M";
    return "L";
  }).join("");

  for (const prior of priorLetters) {
    const priorParagraphs = prior.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const priorPattern = priorParagraphs.map(p => {
      const wordCount = p.split(/\s+/).length;
      if (wordCount < 30) return "S";
      if (wordCount < 80) return "M";
      return "L";
    }).join("");

    if (pattern === priorPattern && pattern.length > 2) {
      return { unique: false };
    }
  }

  return { unique: true };
}

function checkCitationPlacement(text: string, priorLetters: string[]): { unique: boolean } {
  const getCitationPositions = (t: string): string => {
    const paragraphs = t.split(/\n\s*\n/);
    return paragraphs.map((p, i) => {
      const hasCitation = /§\s*\d+|15\s*U\.?S\.?C/i.test(p);
      return hasCitation ? i.toString() : "";
    }).filter(x => x).join(",");
  };

  const pattern = getCitationPositions(text);

  for (const prior of priorLetters) {
    if (getCitationPositions(prior) === pattern && pattern.length > 0) {
      return { unique: false };
    }
  }

  return { unique: true };
}

function checkClosingUniqueness(text: string, priorLetters: string[]): { unique: boolean } {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  if (paragraphs.length === 0) return { unique: true };

  const closing = paragraphs[paragraphs.length - 1].toLowerCase().substring(0, 100);

  for (const prior of priorLetters) {
    const priorParagraphs = prior.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    if (priorParagraphs.length > 0) {
      const priorClosing = priorParagraphs[priorParagraphs.length - 1].toLowerCase().substring(0, 100);
      if (levenshteinSimilarity(closing, priorClosing) > 0.7) {
        return { unique: false };
      }
    }
  }

  return { unique: true };
}

function levenshteinSimilarity(a: string, b: string): number {
  if (a.length === 0) return b.length === 0 ? 1 : 0;
  if (b.length === 0) return 0;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const maxLen = Math.max(a.length, b.length);
  return 1 - matrix[b.length][a.length] / maxLen;
}

function generateUniquenessRecommendations(issues: ValidationIssue[]): string[] {
  const recommendations: string[] = [];

  for (const issue of issues) {
    switch (issue.code) {
      case "UNIQUE_OPENING":
        recommendations.push(
          "CRITICAL: Rewrite the opening sentence completely. Use a different strategy from the opening library."
        );
        break;
      case "UNIQUE_PHRASES":
        recommendations.push(
          `Rephrase shared phrases: ${issue.location}. Use synonyms or restructure the sentences.`
        );
        break;
      case "UNIQUE_STRUCTURE":
        recommendations.push(
          "Change the paragraph structure. Add or remove paragraphs, or significantly alter their lengths."
        );
        break;
      case "UNIQUE_CITATIONS":
        recommendations.push(
          "Move legal citations to different positions. Front-load them, back-load them, or cluster them differently."
        );
        break;
      case "UNIQUE_CLOSING":
        recommendations.push(
          "Use a different closing strategy: deadline focus, consequence framing, determined resolve, or forward-looking."
        );
        break;
    }
  }

  return recommendations;
}

// =============================================================================
// COMBINED VALIDATION
// =============================================================================

/**
 * Run all validation checks and return combined results
 */
export function validateLetter(input: LetterValidationInput): {
  kitchenTableTest: ValidationResult;
  antiAICheck: ValidationResult;
  uniquenessCheck: ValidationResult;
  overallScore: number;
  passed: boolean;
  criticalIssues: ValidationIssue[];
} {
  const kitchenTableTest = runKitchenTableTest(input);
  const antiAICheck = runAntiAIChecklist(input);
  const uniquenessCheck = runUniquenessCheck(input);

  // Calculate overall score
  const overallScore = Math.round(
    (kitchenTableTest.score * 0.4) + // Kitchen Table Test is most important
    (antiAICheck.score * 0.35) +
    (uniquenessCheck.score * 0.25)
  );

  // Collect critical issues (errors)
  const criticalIssues = [
    ...kitchenTableTest.issues,
    ...antiAICheck.issues,
    ...uniquenessCheck.issues,
  ].filter(issue => issue.severity === "error");

  return {
    kitchenTableTest,
    antiAICheck,
    uniquenessCheck,
    overallScore,
    passed: overallScore >= 7 && criticalIssues.length === 0,
    criticalIssues,
  };
}

export default validateLetter;
