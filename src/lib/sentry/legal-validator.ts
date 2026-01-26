/**
 * SENTRY LEGAL CITATION VALIDATOR
 *
 * Validates legal citations in dispute letters against the verified
 * citation database. Catches common misapplications and ensures
 * legal accuracy.
 *
 * KEY VALIDATIONS:
 * 1. Invalid citations (misapplied statutes)
 * 2. FDCPA statutes sent to CRAs (only apply to collectors)
 * 3. Criminal statutes (consumers can't prosecute)
 * 4. Correct statute for target type
 */

import type {
  LegalCitation,
  InvalidCitation,
  CitationValidationResult,
  CitationApplicability,
  CaseLaw,
} from "@/types/sentry";

import {
  SENTRY_VALID_CITATIONS,
  SENTRY_INVALID_CITATIONS,
  SENTRY_CASE_LAW,
} from "./sentry-doctrine";

// =============================================================================
// CITATION PATTERN MATCHING
// =============================================================================

// Regex patterns to detect statute citations in text
const STATUTE_PATTERNS = [
  // "15 USC 1681e(b)" style
  /15\s*U\.?S\.?C\.?\s*(?:§\s*)?(\d{4}[a-z]?)(?:\([a-z0-9]+\))?(?:\([a-z0-9]+\))*/gi,
  // "FCRA Section 604" style (less common but valid)
  /FCRA\s+(?:Section|§)\s*(\d+)/gi,
  // "Fair Credit Reporting Act Section" style
  /Fair\s+Credit\s+Reporting\s+Act\s+(?:Section|§)\s*(\d+)/gi,
  // "FDCPA Section 809" style
  /FDCPA\s+(?:Section|§)\s*(\d+)/gi,
];

/**
 * Extract all statute citations from text
 */
function extractCitations(text: string): string[] {
  const citations = new Set<string>();

  for (const pattern of STATUTE_PATTERNS) {
    const matches = text.matchAll(new RegExp(pattern));
    for (const match of matches) {
      citations.add(match[0].trim());
    }
  }

  return Array.from(citations);
}

/**
 * Normalize a citation for comparison
 */
function normalizeCitation(citation: string): string {
  return citation
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(/§/g, "")
    .replace(/usc/g, "usc");
}

/**
 * Check if a citation matches a statute from the database
 */
function matchesStatute(citation: string, statute: string): boolean {
  const normalizedCitation = normalizeCitation(citation);
  const normalizedStatute = normalizeCitation(statute);

  // Extract the core statute number (e.g., "1681e" from "15 USC 1681e(b)")
  const statuteMatch = normalizedStatute.match(/(\d{4}[a-z]?)/);
  if (!statuteMatch) return false;

  const coreStatute = statuteMatch[1];
  return normalizedCitation.includes(coreStatute);
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Get the legal citation database
 */
export function getLegalCitationDatabase(): LegalCitation[] {
  return SENTRY_VALID_CITATIONS;
}

/**
 * Get the invalid citation database
 */
export function getInvalidCitationDatabase(): InvalidCitation[] {
  return SENTRY_INVALID_CITATIONS;
}

/**
 * Get the case law database
 */
export function getCaseLawDatabase(): CaseLaw[] {
  return SENTRY_CASE_LAW;
}

/**
 * Find a valid citation by statute
 */
export function findValidCitation(statute: string): LegalCitation | undefined {
  return SENTRY_VALID_CITATIONS.find((c) => matchesStatute(statute, c.statute));
}

/**
 * Find an invalid citation by statute
 */
export function findInvalidCitation(
  statute: string
): InvalidCitation | undefined {
  return SENTRY_INVALID_CITATIONS.find((c) =>
    matchesStatute(statute, c.statute)
  );
}

/**
 * Check if a citation is valid for the target type
 */
export function isCitationValidForTarget(
  citation: string,
  targetType: CitationApplicability
): { isValid: boolean; reason?: string; suggestion?: string } {
  // Check against invalid citations first
  const invalidMatch = findInvalidCitation(citation);
  if (invalidMatch) {
    return {
      isValid: false,
      reason: invalidMatch.whyItFails,
      suggestion: invalidMatch.correctApproach,
    };
  }

  // Check if it's a valid citation
  const validMatch = findValidCitation(citation);
  if (validMatch) {
    // Check if it applies to the target
    if (!validMatch.applicableTo.includes(targetType)) {
      return {
        isValid: false,
        reason: `This statute applies to ${validMatch.applicableTo.join(
          ", "
        )}, not ${targetType}`,
        suggestion:
          validMatch.commonMisuse ||
          `Use this statute only when sending to ${validMatch.applicableTo.join(
            " or "
          )}`,
      };
    }

    // Check for "never use for" conditions
    if (validMatch.neverUseFor.length > 0) {
      return {
        isValid: true,
        reason: `Valid citation. Note: Do not use for: ${validMatch.neverUseFor.join(
          ", "
        )}`,
      };
    }

    return { isValid: true };
  }

  // Unknown citation - warn but allow
  return {
    isValid: true,
    reason: "Citation not in database - verify manually",
  };
}

/**
 * Check for FDCPA statutes in CRA letters
 */
function checkFDCPAtoCRA(citation: string): {
  isViolation: boolean;
  warning?: string;
} {
  const fdcpaPatterns = [
    /1692[a-z]/i,
    /fdcpa/i,
    /fair\s+debt\s+collection/i,
  ];

  for (const pattern of fdcpaPatterns) {
    if (pattern.test(citation)) {
      return {
        isViolation: true,
        warning:
          "FDCPA (15 USC 1692) statutes only apply to debt collectors, not CRAs. This citation will be rejected.",
      };
    }
  }

  return { isViolation: false };
}

/**
 * Check for criminal statute citations
 */
function checkCriminalStatute(citation: string): {
  isViolation: boolean;
  warning?: string;
} {
  const criminalPatterns = [/1681q/i, /1681r/i];

  for (const pattern of criminalPatterns) {
    if (pattern.test(citation)) {
      return {
        isViolation: true,
        warning:
          "Criminal statutes (1681q, 1681r) cannot be prosecuted by consumers. Only government prosecutors can pursue criminal violations.",
      };
    }
  }

  return { isViolation: false };
}

/**
 * Validate all citations in a letter
 */
export function validateCitations(
  letterContent: string,
  targetType: CitationApplicability
): CitationValidationResult {
  const extractedCitations = extractCitations(letterContent);
  const validCitations: LegalCitation[] = [];
  const invalidCitations: CitationValidationResult["invalidCitations"] = [];
  const warnings: CitationValidationResult["warnings"] = [];

  for (const citation of extractedCitations) {
    // Check for FDCPA to CRA
    if (targetType === "CRA") {
      const fdcpaCheck = checkFDCPAtoCRA(citation);
      if (fdcpaCheck.isViolation) {
        invalidCitations.push({
          statute: citation,
          location: `Found in letter`,
          reason: fdcpaCheck.warning!,
          suggestion: "Remove FDCPA citations from CRA letters. Use FCRA (15 USC 1681) instead.",
        });
        continue;
      }
    }

    // Check for criminal statutes
    const criminalCheck = checkCriminalStatute(citation);
    if (criminalCheck.isViolation) {
      invalidCitations.push({
        statute: citation,
        location: "Found in letter",
        reason: criminalCheck.warning!,
        suggestion: "Use 15 USC 1681n/o for civil remedies instead of criminal statutes.",
      });
      continue;
    }

    // Check against invalid citation database
    const invalidMatch = findInvalidCitation(citation);
    if (invalidMatch) {
      invalidCitations.push({
        statute: citation,
        location: "Found in letter",
        reason: invalidMatch.whyItFails,
        suggestion: invalidMatch.correctApproach,
      });
      continue;
    }

    // Check against valid citation database
    const validMatch = findValidCitation(citation);
    if (validMatch) {
      // Check if applicable to target
      if (!validMatch.applicableTo.includes(targetType)) {
        invalidCitations.push({
          statute: citation,
          location: "Found in letter",
          reason: `This statute applies to ${validMatch.applicableTo.join(", ")}, not ${targetType}`,
          suggestion: validMatch.commonMisuse || "Use appropriate statute for this recipient type",
        });
        continue;
      }

      // Valid citation
      validCitations.push(validMatch);

      // Add warning if there's a common misuse
      if (validMatch.commonMisuse) {
        warnings.push({
          statute: citation,
          warning: validMatch.commonMisuse,
          suggestion: `Ensure correct application: ${validMatch.useFor.slice(0, 2).join(", ")}`,
        });
      }
    } else {
      // Unknown citation - add warning
      warnings.push({
        statute: citation,
        warning: "Citation not in verified database",
        suggestion: "Verify this citation is applicable before sending",
      });
    }
  }

  return {
    isValid: invalidCitations.length === 0,
    validCitations,
    invalidCitations,
    warnings,
  };
}

/**
 * Get recommended citations for a specific use case
 */
export function getRecommendedCitations(
  useCase: string,
  targetType: CitationApplicability
): LegalCitation[] {
  return SENTRY_VALID_CITATIONS.filter(
    (c) =>
      c.applicableTo.includes(targetType) &&
      c.useFor.some((use) =>
        use.toLowerCase().includes(useCase.toLowerCase())
      )
  );
}

/**
 * Get case law support for a citation
 */
export function getCaseLawForCitation(statute: string): CaseLaw[] {
  const citation = findValidCitation(statute);
  if (citation && citation.caseSupport) {
    return citation.caseSupport;
  }
  return [];
}

/**
 * Generate a citation fix suggestion
 */
export function suggestCitationFix(
  invalidStatute: string,
  targetType: CitationApplicability
): { replacement?: string; explanation: string } {
  const invalidMatch = findInvalidCitation(invalidStatute);
  if (invalidMatch) {
    return {
      explanation: invalidMatch.correctApproach,
    };
  }

  // Check if it's an FDCPA citation to CRA
  if (targetType === "CRA" && /1692/.test(invalidStatute)) {
    return {
      replacement: "15 USC 1681i",
      explanation:
        "FDCPA applies to collectors only. For CRA disputes, use FCRA Section 1681i (reinvestigation duty).",
    };
  }

  // Check if it's a criminal statute
  if (/1681q|1681r/.test(invalidStatute)) {
    return {
      replacement: "15 USC 1681n/o",
      explanation:
        "Criminal statutes cannot be cited by consumers. Use civil liability provisions (1681n for willful, 1681o for negligent violations).",
    };
  }

  return {
    explanation: "Review the statute and ensure it applies to your dispute type and recipient.",
  };
}
