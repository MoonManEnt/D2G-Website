/**
 * AMELIA Phrase Blacklist
 *
 * Comprehensive list of phrases that should NEVER appear in AI-generated letters.
 * These are patterns that eOSCAR and human reviewers recognize as templated content.
 *
 * The AI must be instructed to avoid all of these patterns.
 */

// =============================================================================
// TEMPLATE FINGERPRINTS - Classic dispute letter templates
// =============================================================================

export const TEMPLATE_PHRASES = [
  // Generic openings
  "this letter is to inform you that",
  "i am writing to dispute the following",
  "i am writing to formally dispute",
  "i am writing this letter to dispute",
  "i am contacting you regarding",
  "i am reaching out to dispute",
  "this letter serves as formal notice",
  "this correspondence is to notify you",
  "please be advised that",
  "please be informed that",
  "kindly note that",
  "take notice that",
  "be informed that",
  "for your information",
  "i hereby dispute",
  "i formally dispute",

  // Generic legal references
  "under the fair credit reporting act",
  "pursuant to the fcra",
  "pursuant to section",
  "in accordance with",
  "as mandated by law",
  "as required by federal law",
  "under federal law",
  "the law requires",
  "you are legally obligated",
  "your legal obligation",

  // Generic demands
  "i demand that you remove",
  "i demand immediate removal",
  "i demand you delete",
  "please investigate the following items",
  "please remove the following",
  "please delete the following",
  "the following items are inaccurate",
  "the following accounts are inaccurate",

  // Boilerplate phrases
  "this is not a duplicate dispute",
  "i have the right to an accurate credit report",
  "i am exercising my rights as a consumer",
  "failure to comply will result in",
  "i am formally notifying you",
  "this constitutes formal notice",
  "you have 30 days to respond",
  "within the 30-day period",
  "i reserve all rights",
  "all rights reserved",

  // Closing boilerplate
  "thank you for your prompt attention",
  "thank you for your immediate attention",
  "i look forward to your prompt response",
  "i await your response",
  "please respond within",
  "your cooperation is appreciated",
  "thank you in advance",
];

// =============================================================================
// AI-GENERATED FINGERPRINTS - Patterns that reveal AI authorship
// =============================================================================

export const AI_PHRASES = [
  // Overly smooth transitions
  "furthermore",
  "moreover",
  "additionally",
  "consequently",
  "subsequently",
  "henceforth",
  "in light of the above",
  "as previously mentioned",
  "as stated above",
  "as noted earlier",

  // Generic empathy (AI loves these)
  "deeply concerned",
  "value the integrity",
  "understand the importance",
  "appreciate your attention",
  "sincerely appreciate",
  "greatly appreciate",
  "truly appreciate",
  "genuinely concerned",
  "profoundly affected",

  // Perfect summary phrases
  "in conclusion",
  "to summarize",
  "in summary",
  "to sum up",
  "to conclude",
  "in closing",
  "in summation",

  // Overly formal constructions
  "it is imperative that",
  "it is essential that",
  "it is crucial that",
  "it should be noted that",
  "it bears mentioning that",
  "it is worth noting that",
  "it must be emphasized",
  "it cannot be overstated",

  // AI hedging language
  "i believe that",
  "i feel that",
  "it seems that",
  "it appears that",
  "it would seem",
  "one might argue",
  "it could be said",

  // Robotic phrasing
  "the above-mentioned",
  "the aforementioned",
  "the undersigned",
  "the below-listed",
  "herein",
  "thereby",
  "therein",
  "whereby",
  "wherein",
];

// =============================================================================
// STRUCTURE PATTERNS TO AVOID
// =============================================================================

export const STRUCTURE_PATTERNS = {
  // Three-item parallel lists are AI's signature
  threeItemList: /(.+), (.+), and (.+)\./g,

  // Uniform paragraph starts
  uniformStarts: /^(I |The |This |My |Your |It |As )/,

  // Perfect bullet point patterns
  perfectBullets: /^[•\-\*]\s+[A-Z]/m,

  // Numbered lists with colons
  numberedWithColon: /^\d+\.\s+[A-Z][^:]+:/m,
};

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Check if text contains any blacklisted phrases
 */
export function containsBlacklistedPhrase(text: string): {
  found: boolean;
  phrases: string[];
} {
  const lowerText = text.toLowerCase();
  const foundPhrases: string[] = [];

  // Check template phrases
  for (const phrase of TEMPLATE_PHRASES) {
    if (lowerText.includes(phrase.toLowerCase())) {
      foundPhrases.push(phrase);
    }
  }

  // Check AI phrases
  for (const phrase of AI_PHRASES) {
    if (lowerText.includes(phrase.toLowerCase())) {
      foundPhrases.push(phrase);
    }
  }

  return {
    found: foundPhrases.length > 0,
    phrases: foundPhrases,
  };
}

/**
 * Check for AI structure patterns
 */
export function hasAIStructurePatterns(text: string): {
  found: boolean;
  patterns: string[];
} {
  const foundPatterns: string[] = [];

  // Check three-item lists (multiple occurrences)
  const threeItemMatches = text.match(STRUCTURE_PATTERNS.threeItemList);
  if (threeItemMatches && threeItemMatches.length > 2) {
    foundPatterns.push("Multiple three-item parallel lists detected");
  }

  // Check uniform paragraph starts
  const paragraphs = text.split(/\n\n+/);
  if (paragraphs.length >= 3) {
    const starts = paragraphs
      .filter(p => p.trim().length > 0)
      .map(p => p.trim().substring(0, 20));
    const uniformCount = starts.filter(s => STRUCTURE_PATTERNS.uniformStarts.test(s)).length;
    if (uniformCount >= paragraphs.length * 0.7) {
      foundPatterns.push("Too many paragraphs start with same pattern");
    }
  }

  return {
    found: foundPatterns.length > 0,
    patterns: foundPatterns,
  };
}

/**
 * Get all blacklisted phrases formatted for AI prompt
 */
export function getBlacklistForPrompt(): string {
  const lines = [
    "=== PHRASES YOU MUST NEVER USE ===",
    "",
    "Template Phrases (instantly flagged by eOSCAR):",
    ...TEMPLATE_PHRASES.slice(0, 20).map(p => `- "${p}"`),
    "...and similar boilerplate language",
    "",
    "AI-Detectable Phrases (reveals non-human authorship):",
    ...AI_PHRASES.slice(0, 15).map(p => `- "${p}"`),
    "...and similar overly-formal constructions",
    "",
    "Structure Patterns to Avoid:",
    "- Multiple three-item parallel lists (X, Y, and Z)",
    "- Starting every paragraph with 'I' or 'The'",
    "- Perfect bullet point formatting",
    "- Overly smooth transitions between paragraphs",
    "",
    "WRITE LIKE A REAL PERSON:",
    "- Use contractions (I'm, don't, can't, won't)",
    "- Vary sentence lengths",
    "- Start sentences differently",
    "- Include natural imperfections",
    "- Express genuine frustration, not performed emotion",
  ];

  return lines.join("\n");
}

/**
 * Get count of blacklisted items for scoring
 */
export function countBlacklistedItems(text: string): number {
  const phraseCheck = containsBlacklistedPhrase(text);
  const structureCheck = hasAIStructurePatterns(text);

  return phraseCheck.phrases.length + structureCheck.patterns.length;
}
