/**
 * eOSCAR Detection Risk Calculator
 *
 * eOSCAR (Online Solution for Complete and Accurate Reporting) is the automated
 * system used by credit bureaus to process disputes. This module calculates the
 * risk that a dispute letter will be flagged as a template/frivolous dispute.
 *
 * Lower risk = more likely to trigger a real investigation
 * Higher risk = more likely to be auto-processed with generic verification
 */

// Common template phrases that trigger eOSCAR flags
const TEMPLATE_PHRASES = [
  "not mine",
  "i never opened this account",
  "this is not my account",
  "fraud alert",
  "identity theft",
  "i am disputing",
  "please remove",
  "delete this",
  "remove immediately",
  "this is inaccurate",
  "not accurate",
  "re-investigate",
  "reinvestigate",
  "30 days",
  "pursuant to",
  "in accordance with",
  "under the fair credit reporting act",
  "15 u.s.c. 1681",
  "fcra violations",
  "statutory damages",
  "willful noncompliance",
  "i demand",
  "failure to comply",
  "legal action",
  "attorney",
  "lawsuit",
  "sue",
];

// Phrases that make letters more human/unique
const HUMANIZING_PHRASES = [
  "when i first noticed",
  "i was surprised to see",
  "i have been trying",
  "this has affected",
  "my family",
  "my situation",
  "i remember",
  "back in",
  "at that time",
  "i believe",
  "as i mentioned",
  "i noticed that",
  "confused about",
  "don't understand why",
  "specifically",
  "for example",
  "to clarify",
  "what happened was",
  "the reason i'm writing",
  "i've been",
];

// Story-like elements that reduce detection risk
const NARRATIVE_ELEMENTS = [
  "morning",
  "afternoon",
  "evening",
  "day",
  "week",
  "month",
  "year",
  "yesterday",
  "recently",
  "ago",
  "since then",
  "after that",
  "before",
  "when",
  "while",
  "during",
  "felt",
  "thought",
  "realized",
  "discovered",
  "found out",
  "learned",
];

export interface EOSCARAnalysis {
  risk: number; // 0-100, lower is better
  riskLevel: "low" | "medium" | "high" | "critical";
  flaggedPhrases: string[];
  humanizingPhrases: string[];
  narrativeElements: string[];
  uniquenessScore: number;
  recommendations: string[];
}

/**
 * Calculate the eOSCAR detection risk for a dispute letter
 */
export function calculateEOSCARRisk(content: string): number {
  const analysis = analyzeEOSCARRisk(content);
  return analysis.risk;
}

/**
 * Perform detailed eOSCAR risk analysis
 */
export function analyzeEOSCARRisk(content: string): EOSCARAnalysis {
  const lowerContent = content.toLowerCase();
  const wordCount = content.split(/\s+/).filter(Boolean).length;

  // Count template phrases found
  const flaggedPhrases: string[] = [];
  for (const phrase of TEMPLATE_PHRASES) {
    if (lowerContent.includes(phrase.toLowerCase())) {
      flaggedPhrases.push(phrase);
    }
  }

  // Count humanizing phrases found
  const humanizingPhrases: string[] = [];
  for (const phrase of HUMANIZING_PHRASES) {
    if (lowerContent.includes(phrase.toLowerCase())) {
      humanizingPhrases.push(phrase);
    }
  }

  // Count narrative elements found
  const narrativeElements: string[] = [];
  for (const phrase of NARRATIVE_ELEMENTS) {
    if (lowerContent.includes(phrase.toLowerCase())) {
      narrativeElements.push(phrase);
    }
  }

  // Calculate base risk score
  let risk = 50; // Start at medium

  // Template phrases increase risk significantly
  risk += flaggedPhrases.length * 5;

  // Humanizing phrases decrease risk
  risk -= humanizingPhrases.length * 3;

  // Narrative elements decrease risk
  risk -= narrativeElements.length * 2;

  // Very short letters are suspicious
  if (wordCount < 150) {
    risk += 15;
  } else if (wordCount < 300) {
    risk += 5;
  } else if (wordCount > 500 && wordCount < 1000) {
    risk -= 5;
  }

  // Check for excessive CAPS
  const capsRatio = (content.match(/[A-Z]/g)?.length || 0) / content.length;
  if (capsRatio > 0.15) {
    risk += 10;
  }

  // Check for sentence variety (good letters have varied sentence lengths)
  const sentences = content.split(/[.!?]+/).filter(Boolean);
  if (sentences.length > 3) {
    const lengths = sentences.map((s) => s.trim().split(/\s+/).length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance =
      lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) /
      lengths.length;
    // Good variance (varied sentence lengths) reduces risk
    if (variance > 20) {
      risk -= 5;
    }
  }

  // Check for personal details (dates, partial account numbers)
  const hasSpecificDates = /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(content);
  const hasPartialAccountNumbers = /\*{4,}|x{4,}|\d{2,4}\*+/i.test(content);
  if (hasSpecificDates) risk -= 5;
  if (hasPartialAccountNumbers) risk -= 3;

  // Clamp risk to valid range
  risk = Math.max(0, Math.min(100, risk));

  // Calculate uniqueness score (inverse of template match ratio)
  const uniquenessScore = Math.max(
    0,
    100 - (flaggedPhrases.length / TEMPLATE_PHRASES.length) * 100
  );

  // Determine risk level
  let riskLevel: "low" | "medium" | "high" | "critical";
  if (risk < 30) {
    riskLevel = "low";
  } else if (risk < 50) {
    riskLevel = "medium";
  } else if (risk < 70) {
    riskLevel = "high";
  } else {
    riskLevel = "critical";
  }

  // Generate recommendations
  const recommendations: string[] = [];
  if (flaggedPhrases.length > 3) {
    recommendations.push(
      "Reduce template-like language. Reword common phrases in your own words."
    );
  }
  if (humanizingPhrases.length < 3) {
    recommendations.push(
      "Add more personal narrative. Explain your specific situation."
    );
  }
  if (narrativeElements.length < 2) {
    recommendations.push(
      "Include timeline details. When did you first notice the issue?"
    );
  }
  if (wordCount < 300) {
    recommendations.push(
      "Expand your letter. Include more details about your situation and specific concerns."
    );
  }
  if (capsRatio > 0.15) {
    recommendations.push(
      "Reduce capitalized words. Use normal capitalization for a professional tone."
    );
  }

  return {
    risk,
    riskLevel,
    flaggedPhrases,
    humanizingPhrases,
    narrativeElements,
    uniquenessScore,
    recommendations,
  };
}

/**
 * Get risk level color for UI display
 */
export function getEOSCARRiskColor(risk: number): string {
  if (risk < 30) return "emerald";
  if (risk < 50) return "amber";
  if (risk < 70) return "orange";
  return "red";
}

/**
 * Get risk level label for UI display
 */
export function getEOSCARRiskLabel(risk: number): string {
  if (risk < 30) return "Low Risk - Human-like";
  if (risk < 50) return "Medium Risk - Semi-Unique";
  if (risk < 70) return "High Risk - Template-like";
  return "Critical Risk - Likely Template";
}
