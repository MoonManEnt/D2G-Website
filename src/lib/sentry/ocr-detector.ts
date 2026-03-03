/**
 * Enhanced OCR Frivolous Detector
 *
 * Analyzes dispute letter content for phrases and patterns that trigger
 * e-OSCAR frivolous detection systems. Provides risk scoring and auto-fixes.
 */

import type { FrivolousPhrase, OCRAnalysisResult, OCRFinding, AutoFix } from "./types";

// =============================================================================
// FRIVOLOUS PHRASE DATABASE
// =============================================================================

export const FRIVOLOUS_PATTERNS: FrivolousPhrase[] = [
  // HIGH severity — immediate red flags
  {
    pattern: /I demand you delete/gi,
    severity: "HIGH",
    replacement: "Please correct the following discrepancy",
    explanation: "Demanding deletion is a template hallmark that triggers frivolous classification",
  },
  {
    pattern: /broken the law/gi,
    severity: "HIGH",
    replacement: "appears to fall short of compliance standards",
    explanation: "Accusatory legal language signals template-generated content",
  },
  {
    pattern: /delete the illegal items/gi,
    severity: "HIGH",
    replacement: "remove information that fails accuracy requirements",
    explanation: "Calling items 'illegal' is a known template phrase",
  },
  {
    pattern: /criminal debt collector/gi,
    severity: "HIGH",
    replacement: "the collection entity",
    explanation: "Name-calling triggers frivolous classification immediately",
  },
  {
    pattern: /5[\s-]?figure lawsuit|6[\s-]?figure/gi,
    severity: "HIGH",
    replacement: "seek all available remedies",
    explanation: "Specific dollar threats are frivolous template markers",
  },
  {
    pattern: /defamation of character/gi,
    severity: "HIGH",
    replacement: "damage to my creditworthiness",
    explanation: "Defamation claims in credit disputes signal template usage",
  },
  {
    pattern: /you have (?:violated|broken) (?:my|the|all) (?:rights|laws)/gi,
    severity: "HIGH",
    replacement: "the reported information appears to contain inaccuracies",
    explanation: "Blanket violation claims trigger frivolous detection",
  },
  {
    pattern: /I will sue you/gi,
    severity: "HIGH",
    replacement: "I reserve all rights under applicable law",
    explanation: "Direct litigation threats without basis are template markers",
  },
  {
    pattern: /this is a formal complaint/gi,
    severity: "HIGH",
    replacement: "I am writing to dispute the following information",
    explanation: "Over-formal language is a template indicator",
  },
  {
    pattern: /cease and desist/gi,
    severity: "HIGH",
    replacement: "please discontinue reporting this inaccurate information",
    explanation: "Cease and desist language in CRA disputes is misapplied and signals template",
  },
  {
    pattern: /pursuant to my rights/gi,
    severity: "HIGH",
    replacement: "under federal law",
    explanation: "Overly formal template language that flags as mass-generated",
  },
  // MEDIUM severity — concerning patterns
  {
    pattern: /intend to litigate/gi,
    severity: "MEDIUM",
    replacement: "reserve all rights under applicable law",
    explanation: "Vague litigation threats reduce credibility",
  },
  {
    pattern: /failure to comply will result in/gi,
    severity: "MEDIUM",
    replacement: "I am requesting that you",
    explanation: "Threatening language triggers scrutiny",
  },
  {
    pattern: /I (?:hereby|formally) (?:demand|request|require)/gi,
    severity: "MEDIUM",
    replacement: "I am asking that you",
    explanation: "Overly formal demands signal template generation",
  },
  {
    pattern: /you are in (?:direct )?violation/gi,
    severity: "MEDIUM",
    replacement: "the current reporting may not comply with",
    explanation: "Accusatory tone triggers defensive response",
  },
  {
    pattern: /contact (?:my|an?) attorney/gi,
    severity: "MEDIUM",
    replacement: "consult with legal counsel",
    explanation: "Attorney threats without actual representation reduce credibility",
  },
  {
    pattern: /report(?:ing)? (?:is |are )?illegal/gi,
    severity: "MEDIUM",
    replacement: "reporting appears inaccurate",
    explanation: "Calling reporting 'illegal' is imprecise and template-like",
  },
  {
    pattern: /without my (?:written )?(?:consent|permission|authorization)/gi,
    severity: "MEDIUM",
    replacement: "without proper verification procedures",
    explanation: "Consent-based arguments are often misapplied in credit disputes",
  },
  {
    pattern: /respond within \d+ days or/gi,
    severity: "MEDIUM",
    replacement: "respond within the timeframe required by the FCRA",
    explanation: "Arbitrary deadline threats with consequences are template markers",
  },
  // LOW severity — minor flags
  {
    pattern: /to whom it may concern/gi,
    severity: "LOW",
    replacement: "Dear Dispute Department",
    explanation: "Generic salutation suggests template-based letter",
  },
  {
    pattern: /I am a consumer/gi,
    severity: "LOW",
    replacement: "I",
    explanation: "Stating you are a consumer is unnecessary and template-like",
  },
  {
    pattern: /this letter (?:is to )?(?:serve|inform) (?:as|you)/gi,
    severity: "LOW",
    replacement: "I am writing to",
    explanation: "Overly formal opening is a template indicator",
  },
  {
    pattern: /respectfully (?:demand|request|require)/gi,
    severity: "LOW",
    replacement: "ask",
    explanation: "Faux-polite demands are a template pattern",
  },
];

// =============================================================================
// SECTION DETECTION
// =============================================================================

function detectSection(lineIndex: number, totalLines: number): "opening" | "body" | "closing" {
  const position = lineIndex / totalLines;
  if (position < 0.2) return "opening";
  if (position > 0.8) return "closing";
  return "body";
}

// Section weights — openings and closings are more scrutinized by OCR systems
const SECTION_WEIGHTS: Record<string, number> = {
  opening: 1.5,
  body: 1.0,
  closing: 1.3,
};

// =============================================================================
// ANALYSIS ENGINE
// =============================================================================

/**
 * Analyze letter content for OCR frivolous detection risk.
 * Returns a score from 0 (highest risk) to 100 (safest).
 */
export function analyzeOCRRisk(content: string): OCRAnalysisResult {
  const lines = content.split("\n");
  const totalLines = lines.length;
  const findings: OCRFinding[] = [];
  const autoFixes: AutoFix[] = [];

  // Track section scores
  const sectionPenalties: Record<string, number> = {
    opening: 0,
    body: 0,
    closing: 0,
  };

  // Scan each line for frivolous patterns
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const section = detectSection(lineIdx, totalLines);

    for (const phrase of FRIVOLOUS_PATTERNS) {
      const matches = line.match(phrase.pattern);
      if (!matches) continue;

      for (const match of matches) {
        // Calculate weighted penalty
        const basePenalty =
          phrase.severity === "HIGH" ? 15 : phrase.severity === "MEDIUM" ? 8 : 3;
        const weightedPenalty = basePenalty * SECTION_WEIGHTS[section];

        sectionPenalties[section] += weightedPenalty;

        findings.push({
          phrase: match,
          severity: phrase.severity,
          lineNumber: lineIdx + 1,
          section,
          explanation: phrase.explanation,
          suggestedReplacement: phrase.replacement,
        });

        autoFixes.push({
          original: match,
          replacement: phrase.replacement,
          lineNumber: lineIdx + 1,
          applied: false,
        });
      }
    }
  }

  // Calculate overall score (start at 100, subtract penalties)
  const totalPenalty = Object.values(sectionPenalties).reduce((a, b) => a + b, 0);
  const score = Math.max(0, Math.round(100 - totalPenalty));

  // Calculate projected score after applying all fixes
  const projectedScoreAfterFixes = Math.min(100, score + totalPenalty);

  // Determine risk level
  let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  if (score >= 70) riskLevel = "LOW";
  else if (score >= 40) riskLevel = "MEDIUM";
  else if (score >= 20) riskLevel = "HIGH";
  else riskLevel = "CRITICAL";

  // Section breakdown (100 minus section penalties, capped at 0-100)
  const sectionBreakdown = {
    opening: Math.max(0, Math.round(100 - sectionPenalties.opening)),
    body: Math.max(0, Math.round(100 - sectionPenalties.body)),
    closing: Math.max(0, Math.round(100 - sectionPenalties.closing)),
  };

  return {
    score,
    riskLevel,
    findings,
    autoFixes,
    projectedScoreAfterFixes,
    sectionBreakdown,
  };
}

// =============================================================================
// AUTO-FIX ENGINE
// =============================================================================

/**
 * Apply OCR fixes to letter content, replacing flagged phrases with safe alternatives.
 */
export function applyOCRFixes(content: string, fixes: AutoFix[]): string {
  let fixed = content;

  // Sort fixes by line number descending to avoid offset issues
  const sortedFixes = [...fixes].sort((a, b) => b.lineNumber - a.lineNumber);

  for (const fix of sortedFixes) {
    // Use case-insensitive replacement
    const pattern = new RegExp(escapeRegex(fix.original), "gi");
    fixed = fixed.replace(pattern, fix.replacement);
    fix.applied = true;
  }

  return fixed;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
