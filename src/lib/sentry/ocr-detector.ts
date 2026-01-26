/**
 * SENTRY OCR FRIVOLOUS DETECTION ANALYZER
 *
 * Analyzes dispute letters for phrases that trigger OCR-based
 * frivolous flagging systems used by credit bureaus.
 *
 * DETECTION STRATEGY:
 * - HIGH RISK: Demanding language, legal threats, template markers
 * - MEDIUM RISK: Generic legal references, damages mentions
 * - LOW RISK: Minor template-like phrases
 *
 * The goal is to produce letters that read as genuinely human while
 * still being legally effective.
 */

import type {
  OCRSeverity,
  OCRFrivolousPhrase,
  OCRFinding,
  OCRAnalysisResult,
} from "@/types/sentry";

import { SENTRY_DOCTRINE } from "./sentry-doctrine";

// =============================================================================
// FRIVOLOUS PHRASE DATABASE
// =============================================================================

export const OCR_PHRASE_DATABASE: OCRFrivolousPhrase[] = [
  // ==========================================================================
  // HIGH RISK - These trigger immediate frivolous flags
  // ==========================================================================
  {
    pattern: /I demand you delete/gi,
    severity: "HIGH",
    replacement: "Please correct the following discrepancy",
    explanation: "Demanding language is a major template marker",
  },
  {
    pattern: /delete the illegal items/gi,
    severity: "HIGH",
    replacement: "remove information that fails accuracy requirements",
    explanation: '"Illegal items" is classic credit repair mill language',
  },
  {
    pattern: /broken the law/gi,
    severity: "HIGH",
    replacement: "appears to fall short of compliance standards",
    explanation: "Accusatory language flags as template",
  },
  {
    pattern: /criminal debt collector/gi,
    severity: "HIGH",
    replacement: "the collection entity",
    explanation: "Inflammatory language damages credibility",
  },
  {
    pattern: /serious punishment/gi,
    severity: "HIGH",
    replacement: "potential liability",
    explanation: '"Punishment" language is a template marker',
  },
  {
    pattern: /intend to litigate/gi,
    severity: "HIGH",
    replacement: "reserve all rights under applicable law",
    explanation: "Litigation threats without specifics flag as template",
  },
  {
    pattern: /5\s*figure lawsuit/gi,
    severity: "HIGH",
    replacement: "seek all available remedies",
    explanation: "Specific damage numbers flag as template",
  },
  {
    pattern: /6\s*figure lawsuit/gi,
    severity: "HIGH",
    replacement: "seek all available remedies",
    explanation: "Specific damage numbers flag as template",
  },
  {
    pattern: /defamation of character/gi,
    severity: "HIGH",
    replacement: "damage to my creditworthiness",
    explanation: "Legal term misuse (defamation requires different elements)",
  },
  {
    pattern: /criminal penalty/gi,
    severity: "HIGH",
    replacement: "civil liability",
    explanation: "Consumers cannot pursue criminal penalties",
  },
  {
    pattern: /you will be punished/gi,
    severity: "HIGH",
    replacement: "you may face liability",
    explanation: "Threatening language flags as template",
  },
  {
    pattern: /I will sue/gi,
    severity: "HIGH",
    replacement: "I reserve all rights",
    explanation: "Direct litigation threats flag as template",
  },
  {
    pattern: /illegal information/gi,
    severity: "HIGH",
    replacement: "inaccurate information",
    explanation: '"Illegal" is not the correct legal term for inaccurate data',
  },
  {
    pattern: /violation of law/gi,
    severity: "HIGH",
    replacement: "compliance concern",
    explanation: "Accusatory language flags as template",
  },

  // ==========================================================================
  // MEDIUM RISK - These raise suspicion
  // ==========================================================================
  {
    pattern: /may have to pay/gi,
    severity: "MEDIUM",
    replacement: "could be subject to",
    explanation: "Vague damage threats are template markers",
  },
  {
    pattern: /seek damages/gi,
    severity: "MEDIUM",
    replacement: "pursue available remedies",
    explanation: "Generic damages language",
  },
  {
    pattern: /contact(?:ing)? lawyers/gi,
    severity: "MEDIUM",
    replacement: "consulting with legal counsel",
    explanation: "Vague attorney references",
  },
  {
    pattern: /legal action/gi,
    severity: "MEDIUM",
    replacement: "appropriate remedies",
    explanation: "Generic legal threat language",
  },
  {
    pattern: /federal court/gi,
    severity: "MEDIUM",
    replacement: "appropriate venue",
    explanation: "Specific court threats without basis",
  },
  {
    pattern: /actual damages/gi,
    severity: "MEDIUM",
    replacement: "the harm caused",
    explanation: "Legal jargon that suggests template",
  },
  {
    pattern: /statutory damages/gi,
    severity: "MEDIUM",
    replacement: "available relief",
    explanation: "Legal jargon that suggests template",
  },
  {
    pattern: /punitive damages/gi,
    severity: "MEDIUM",
    replacement: "appropriate relief",
    explanation: "Punitive damages require willful conduct proof",
  },
  {
    pattern: /pursuant to/gi,
    severity: "MEDIUM",
    replacement: "under",
    explanation: "Overly formal language suggests template",
  },
  {
    pattern: /hereby demand/gi,
    severity: "MEDIUM",
    replacement: "request",
    explanation: "Legalese suggests template",
  },
  {
    pattern: /cease and desist/gi,
    severity: "MEDIUM",
    replacement: "stop",
    explanation: "Legal phrase often misused",
  },
  {
    pattern: /willful noncompliance/gi,
    severity: "MEDIUM",
    replacement: "failure to comply",
    explanation: "Willful requires specific proof",
  },

  // ==========================================================================
  // LOW RISK - Minor flags
  // ==========================================================================
  {
    pattern: /to whom it may concern/gi,
    severity: "LOW",
    replacement: "Consumer Dispute Department",
    explanation: "Generic salutation suggests template",
  },
  {
    pattern: /in accordance with/gi,
    severity: "LOW",
    replacement: "following",
    explanation: "Slightly formal language",
  },
  {
    pattern: /the above-mentioned/gi,
    severity: "LOW",
    replacement: "these",
    explanation: "Overly formal reference",
  },
  {
    pattern: /forthwith/gi,
    severity: "LOW",
    replacement: "promptly",
    explanation: "Archaic language",
  },
  {
    pattern: /herein/gi,
    severity: "LOW",
    replacement: "in this letter",
    explanation: "Legalese",
  },
  {
    pattern: /thereof/gi,
    severity: "LOW",
    replacement: "of it",
    explanation: "Archaic legalese",
  },
];

// =============================================================================
// ANALYSIS FUNCTIONS
// =============================================================================

/**
 * Get the full OCR phrase database
 */
export function getOCRPhraseDatabase(): OCRFrivolousPhrase[] {
  return OCR_PHRASE_DATABASE;
}

/**
 * Find the line number of a phrase in text
 */
function findLineNumber(text: string, phrase: string): string {
  const lines = text.split("\n");
  const lowerPhrase = phrase.toLowerCase();

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(lowerPhrase)) {
      return `Line ${i + 1}`;
    }
  }

  return "Found in letter";
}

/**
 * Analyze a letter for OCR frivolous detection risk
 */
export function analyzeOCRRisk(letterContent: string): OCRAnalysisResult {
  let score = 100; // Start at 100% safe
  const findings: OCRFinding[] = [];
  const lowerContent = letterContent.toLowerCase();

  // Check each phrase pattern
  for (const phrase of OCR_PHRASE_DATABASE) {
    const pattern =
      typeof phrase.pattern === "string"
        ? new RegExp(phrase.pattern, "gi")
        : phrase.pattern;

    const matches = letterContent.match(pattern);
    if (matches) {
      // Deduct points based on severity
      const deduction =
        phrase.severity === "HIGH"
          ? SENTRY_DOCTRINE.ocrRules.highRiskDeduction
          : phrase.severity === "MEDIUM"
            ? SENTRY_DOCTRINE.ocrRules.mediumRiskDeduction
            : SENTRY_DOCTRINE.ocrRules.lowRiskDeduction;

      // Deduct for each occurrence, but cap total deduction per phrase
      const occurrences = matches.length;
      const totalDeduction = Math.min(deduction * occurrences, deduction * 2);
      score -= totalDeduction;

      // Add finding for first occurrence
      findings.push({
        phrase: matches[0],
        severity: phrase.severity,
        location: findLineNumber(letterContent, matches[0]),
        suggestion: phrase.replacement,
        explanation: phrase.explanation,
      });
    }
  }

  // Additional pattern checks not in main database
  // Check for excessive exclamation marks
  const exclamationCount = (letterContent.match(/!/g) || []).length;
  if (exclamationCount > 3) {
    score -= 5;
    findings.push({
      phrase: "Multiple exclamation marks",
      severity: "LOW",
      location: "Throughout letter",
      suggestion: "Use periods for a more professional tone",
      explanation: "Excessive punctuation suggests emotional/template content",
    });
  }

  // Check for ALL CAPS sections
  const capsMatches = letterContent.match(/[A-Z]{10,}/g);
  if (capsMatches && capsMatches.length > 2) {
    score -= 8;
    findings.push({
      phrase: "Excessive capitalization",
      severity: "MEDIUM",
      location: "Throughout letter",
      suggestion: "Use normal capitalization",
      explanation: "ALL CAPS sections are template markers",
    });
  }

  // Check for repetitive phrasing
  const sentences = letterContent.split(/[.!?]/).filter((s) => s.trim().length > 20);
  const uniqueSentences = new Set(sentences.map((s) => s.trim().toLowerCase()));
  if (sentences.length > 5 && uniqueSentences.size < sentences.length * 0.7) {
    score -= 10;
    findings.push({
      phrase: "Repetitive phrasing detected",
      severity: "MEDIUM",
      location: "Throughout letter",
      suggestion: "Vary sentence structure and wording",
      explanation: "Repetitive language suggests template",
    });
  }

  // Ensure score stays in bounds
  score = Math.max(0, Math.min(100, score));

  // Determine risk level
  let risk: "LOW" | "MEDIUM" | "HIGH";
  if (score >= 70) {
    risk = "LOW";
  } else if (score >= 40) {
    risk = "MEDIUM";
  } else {
    risk = "HIGH";
  }

  return {
    score,
    risk,
    findings,
    autoFixAvailable: findings.some((f) => f.suggestion),
  };
}

/**
 * Apply OCR fixes to a letter
 */
export function applyOCRFixes(letterContent: string): {
  fixedContent: string;
  fixesApplied: { original: string; replacement: string }[];
} {
  let fixedContent = letterContent;
  const fixesApplied: { original: string; replacement: string }[] = [];

  for (const phrase of OCR_PHRASE_DATABASE) {
    if (phrase.severity === "HIGH" || phrase.severity === "MEDIUM") {
      const pattern =
        typeof phrase.pattern === "string"
          ? new RegExp(phrase.pattern, "gi")
          : phrase.pattern;

      const matches = fixedContent.match(pattern);
      if (matches) {
        for (const match of matches) {
          fixedContent = fixedContent.replace(match, phrase.replacement);
          fixesApplied.push({
            original: match,
            replacement: phrase.replacement,
          });
        }
      }
    }
  }

  return { fixedContent, fixesApplied };
}

/**
 * Check if a letter meets the minimum safety threshold
 */
export function meetsMinimumSafety(letterContent: string): boolean {
  const analysis = analyzeOCRRisk(letterContent);
  return analysis.score >= SENTRY_DOCTRINE.ocrRules.minSafetyScore;
}

/**
 * Check if a letter meets the target safety score
 */
export function meetsTargetSafety(letterContent: string): boolean {
  const analysis = analyzeOCRRisk(letterContent);
  return analysis.score >= SENTRY_DOCTRINE.ocrRules.targetSafetyScore;
}

/**
 * Get a human-readable risk summary
 */
export function getRiskSummary(analysis: OCRAnalysisResult): string {
  const highRisk = analysis.findings.filter((f) => f.severity === "HIGH").length;
  const mediumRisk = analysis.findings.filter((f) => f.severity === "MEDIUM").length;
  const lowRisk = analysis.findings.filter((f) => f.severity === "LOW").length;

  if (analysis.risk === "HIGH") {
    return `High risk of frivolous flagging. Found ${highRisk} critical issues that need immediate attention.`;
  } else if (analysis.risk === "MEDIUM") {
    return `Moderate risk. Found ${highRisk} high and ${mediumRisk} medium severity issues. Recommend fixing before sending.`;
  } else {
    if (analysis.findings.length === 0) {
      return "Excellent! No frivolous detection triggers found.";
    }
    return `Low risk. Found ${lowRisk + mediumRisk} minor issues that could be improved.`;
  }
}

/**
 * Get improvement suggestions sorted by impact
 */
export function getImprovementSuggestions(
  analysis: OCRAnalysisResult
): { fix: string; impact: number }[] {
  const suggestions = analysis.findings
    .filter((f) => f.suggestion)
    .map((f) => ({
      fix: `Replace "${f.phrase}" with "${f.suggestion}"`,
      impact:
        f.severity === "HIGH"
          ? SENTRY_DOCTRINE.ocrRules.highRiskDeduction
          : f.severity === "MEDIUM"
            ? SENTRY_DOCTRINE.ocrRules.mediumRiskDeduction
            : SENTRY_DOCTRINE.ocrRules.lowRiskDeduction,
    }))
    .sort((a, b) => b.impact - a.impact);

  return suggestions;
}
