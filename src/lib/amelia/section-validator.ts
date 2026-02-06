/**
 * AMELIA Section Validator
 *
 * Validates each section of an AI-generated letter.
 * Checks for legal requirements, voice consistency, and prohibited phrases.
 */

import type { ConsumerVoiceProfile } from "../amelia-soul-engine";
import type { LegalFramework } from "./legal-frameworks";
import type { ParsedLetterSections } from "./section-parser";
import { containsBlacklistedPhrase, hasAIStructurePatterns } from "./phrase-blacklist";

// =============================================================================
// TYPES
// =============================================================================

export interface ValidationIssue {
  code: string;
  severity: "error" | "warning";
  section: keyof ParsedLetterSections;
  description: string;
  suggestion?: string;
}

export interface SectionValidationResult {
  section: keyof ParsedLetterSections;
  isValid: boolean;
  issues: ValidationIssue[];
  score: number; // 0-100
}

export interface FullValidationResult {
  isValid: boolean;
  overallScore: number;
  sectionResults: SectionValidationResult[];
  invalidSections: (keyof ParsedLetterSections)[];
  criticalIssues: ValidationIssue[];
  allIssues: ValidationIssue[];
}

export interface ValidationContext {
  voiceProfile: ConsumerVoiceProfile;
  legalFramework: LegalFramework;
  round: number;
  previousLetters: string[];
}

// =============================================================================
// SECTION-SPECIFIC VALIDATORS
// =============================================================================

function validateOpeningSection(
  content: string,
  ctx: ValidationContext
): SectionValidationResult {
  const issues: ValidationIssue[] = [];
  let score = 100;

  // Check minimum length
  if (content.length < 200) {
    issues.push({
      code: "OPENING_TOO_SHORT",
      severity: "error",
      section: "opening",
      description: "Opening section is too short - needs more personal narrative",
      suggestion: "Add more details about how the errors have affected daily life",
    });
    score -= 30;
  }

  // Check for blacklisted phrases
  const blacklistCheck = containsBlacklistedPhrase(content);
  if (blacklistCheck.found) {
    issues.push({
      code: "OPENING_BLACKLISTED",
      severity: "error",
      section: "opening",
      description: `Contains template phrases: ${blacklistCheck.phrases.slice(0, 3).join(", ")}`,
      suggestion: "Rewrite without using template language",
    });
    score -= 40;
  }

  // Check for AI structure patterns
  const structureCheck = hasAIStructurePatterns(content);
  if (structureCheck.found) {
    issues.push({
      code: "OPENING_AI_PATTERNS",
      severity: "warning",
      section: "opening",
      description: structureCheck.patterns.join("; "),
      suggestion: "Vary sentence structure more",
    });
    score -= 15;
  }

  // Check for personal specificity
  const hasPersonalDetails = /(\d+\s*(years?|months?|weeks?|days?)|family|wife|husband|kids?|children|job|work|mortgage|rent|car|apartment|house)/i.test(content);
  if (!hasPersonalDetails) {
    issues.push({
      code: "OPENING_NO_PERSONAL",
      severity: "warning",
      section: "opening",
      description: "Opening lacks specific personal details",
      suggestion: "Include concrete life details (family, work, housing, timeframes)",
    });
    score -= 15;
  }

  // Check for emotional content matching voice profile
  const emotionalIndicators = /(frustrat|stress|worr|anxi|exhaust|angry|upset|confus|disappoint|devastat|shock)/i.test(content);
  if (!emotionalIndicators && ctx.voiceProfile.emotionalState !== "determined") {
    issues.push({
      code: "OPENING_NO_EMOTION",
      severity: "warning",
      section: "opening",
      description: "Opening lacks emotional expression",
      suggestion: "Express genuine frustration appropriate to the situation",
    });
    score -= 10;
  }

  return {
    section: "opening",
    isValid: !issues.some(i => i.severity === "error"),
    issues,
    score: Math.max(0, score),
  };
}

function validateBodyFactsSection(
  content: string,
  ctx: ValidationContext
): SectionValidationResult {
  const issues: ValidationIssue[] = [];
  let score = 100;

  // Check minimum length
  if (content.length < 300) {
    issues.push({
      code: "BODY_TOO_SHORT",
      severity: "error",
      section: "bodyFacts",
      description: "Body facts section is too short",
      suggestion: "Expand legal arguments and narrative",
    });
    score -= 25;
  }

  // Check for blacklisted phrases
  const blacklistCheck = containsBlacklistedPhrase(content);
  if (blacklistCheck.found) {
    issues.push({
      code: "BODY_BLACKLISTED",
      severity: "error",
      section: "bodyFacts",
      description: `Contains template phrases: ${blacklistCheck.phrases.slice(0, 3).join(", ")}`,
      suggestion: "Rewrite legal arguments in natural language",
    });
    score -= 40;
  }

  // Check for legal citations
  const hasLegalCitation = /15\s*U\.?S\.?C\.?\s*§?\s*168[0-9][a-z]?/i.test(content) ||
    content.toLowerCase().includes(ctx.legalFramework.statutes.primaryCode.toLowerCase());
  if (!hasLegalCitation) {
    issues.push({
      code: "BODY_NO_CITATION",
      severity: "error",
      section: "bodyFacts",
      description: `Missing required legal citation (${ctx.legalFramework.statutes.primaryCode})`,
      suggestion: "Include the primary statute citation naturally in the argument",
    });
    score -= 30;
  }

  // Check for court case references (if available and round >= 4)
  if (ctx.round >= 4 && ctx.legalFramework.courtCases && ctx.legalFramework.courtCases.length > 0) {
    const hasCaseRef = ctx.legalFramework.courtCases.some(c =>
      content.toLowerCase().includes(c.name.toLowerCase().split(" ")[0])
    );
    if (!hasCaseRef) {
      issues.push({
        code: "BODY_NO_CASE_REF",
        severity: "warning",
        section: "bodyFacts",
        description: "Consider citing relevant court case for stronger argument",
        suggestion: `Reference ${ctx.legalFramework.courtCases[0].name}`,
      });
      score -= 10;
    }
  }

  return {
    section: "bodyFacts",
    isValid: !issues.some(i => i.severity === "error"),
    issues,
    score: Math.max(0, score),
  };
}

function validateAccountListSection(
  content: string,
  _ctx: ValidationContext
): SectionValidationResult {
  const issues: ValidationIssue[] = [];
  let score = 100;

  // Check for account formatting
  const hasAccountNumbers = /account\s*#?:?\s*[\dX*]+/i.test(content) ||
    /account\s*number/i.test(content);
  if (!hasAccountNumbers) {
    issues.push({
      code: "ACCOUNTS_NO_NUMBERS",
      severity: "warning",
      section: "accountList",
      description: "Account numbers not clearly listed",
      suggestion: "Include account numbers for each disputed account",
    });
    score -= 15;
  }

  // Check for inaccurate categories
  const hasCategories = /inaccurate|incorrect|wrong|error|discrepanc/i.test(content);
  if (!hasCategories) {
    issues.push({
      code: "ACCOUNTS_NO_CATEGORIES",
      severity: "warning",
      section: "accountList",
      description: "Not clearly stating what's inaccurate about each account",
      suggestion: "Specify inaccurate categories for each account",
    });
    score -= 20;
  }

  // Check for blacklisted phrases (less strict here as some structure is needed)
  const blacklistCheck = containsBlacklistedPhrase(content);
  if (blacklistCheck.phrases.length > 2) {
    issues.push({
      code: "ACCOUNTS_BLACKLISTED",
      severity: "warning",
      section: "accountList",
      description: `Contains multiple template phrases`,
      suggestion: "Use more natural language even in account listing",
    });
    score -= 15;
  }

  return {
    section: "accountList",
    isValid: !issues.some(i => i.severity === "error"),
    issues,
    score: Math.max(0, score),
  };
}

function validateCorrectionsSection(
  content: string,
  _ctx: ValidationContext
): SectionValidationResult {
  const issues: ValidationIssue[] = [];
  let score = 100;

  // Check for action requests
  const hasActionRequest = /correct|delete|remove|update|verify|investigate/i.test(content);
  if (!hasActionRequest) {
    issues.push({
      code: "CORRECTIONS_NO_ACTION",
      severity: "error",
      section: "corrections",
      description: "Missing clear action requests",
      suggestion: "State what needs to be corrected or deleted for each account",
    });
    score -= 30;
  }

  // Check for blacklisted phrases
  const blacklistCheck = containsBlacklistedPhrase(content);
  if (blacklistCheck.found) {
    issues.push({
      code: "CORRECTIONS_BLACKLISTED",
      severity: "warning",
      section: "corrections",
      description: `Contains template phrases: ${blacklistCheck.phrases.slice(0, 2).join(", ")}`,
      suggestion: "Use unique language for correction requests",
    });
    score -= 20;
  }

  // Check minimum length
  if (content.length < 100) {
    issues.push({
      code: "CORRECTIONS_TOO_SHORT",
      severity: "warning",
      section: "corrections",
      description: "Corrections section is brief",
      suggestion: "Provide more detail about required corrections",
    });
    score -= 15;
  }

  return {
    section: "corrections",
    isValid: !issues.some(i => i.severity === "error"),
    issues,
    score: Math.max(0, score),
  };
}

function validateConsumerStatementSection(
  content: string,
  ctx: ValidationContext
): SectionValidationResult {
  const issues: ValidationIssue[] = [];
  let score = 100;

  // Check minimum length
  if (content.length < 100) {
    issues.push({
      code: "STATEMENT_TOO_SHORT",
      severity: "warning",
      section: "consumerStatement",
      description: "Consumer statement is too brief",
      suggestion: "Add more emotional impact and penalty warning",
    });
    score -= 20;
  }

  // Check for blacklisted phrases
  const blacklistCheck = containsBlacklistedPhrase(content);
  if (blacklistCheck.found) {
    issues.push({
      code: "STATEMENT_BLACKLISTED",
      severity: "error",
      section: "consumerStatement",
      description: `Contains template phrases: ${blacklistCheck.phrases.slice(0, 2).join(", ")}`,
      suggestion: "Rewrite in unique voice",
    });
    score -= 35;
  }

  // Check for penalty/consequence warning (Round 2+)
  if (ctx.round >= 2) {
    const hasPenaltyRef = /damage|lawsuit|legal|attorney|court|complain|ftc|cfpb/i.test(content);
    if (!hasPenaltyRef) {
      issues.push({
        code: "STATEMENT_NO_PENALTY",
        severity: "warning",
        section: "consumerStatement",
        description: "Missing penalty or consequence warning",
        suggestion: "Reference potential legal consequences appropriate to round",
      });
      score -= 15;
    }
  }

  // Check for emotional content
  const hasEmotion = /(frustrat|stress|suffer|struggle|impact|affect|devastat|harm)/i.test(content);
  if (!hasEmotion) {
    issues.push({
      code: "STATEMENT_NO_EMOTION",
      severity: "warning",
      section: "consumerStatement",
      description: "Consumer statement lacks emotional impact",
      suggestion: "Express how the errors have affected daily life",
    });
    score -= 10;
  }

  return {
    section: "consumerStatement",
    isValid: !issues.some(i => i.severity === "error"),
    issues,
    score: Math.max(0, score),
  };
}

function validateGenericSection(
  content: string,
  sectionName: keyof ParsedLetterSections
): SectionValidationResult {
  const issues: ValidationIssue[] = [];
  let score = 100;

  // Basic blacklist check
  const blacklistCheck = containsBlacklistedPhrase(content);
  if (blacklistCheck.found && blacklistCheck.phrases.length > 1) {
    issues.push({
      code: `${sectionName.toUpperCase()}_BLACKLISTED`,
      severity: "warning",
      section: sectionName,
      description: `Contains template phrases`,
      suggestion: "Use more natural language",
    });
    score -= 15;
  }

  return {
    section: sectionName,
    isValid: true,
    issues,
    score: Math.max(0, score),
  };
}

// =============================================================================
// MAIN VALIDATION FUNCTION
// =============================================================================

/**
 * Validate all sections of a parsed letter
 */
export function validateAllSections(
  sections: ParsedLetterSections,
  ctx: ValidationContext
): FullValidationResult {
  const sectionResults: SectionValidationResult[] = [];

  // Validate each section
  sectionResults.push(
    sections.opening
      ? validateOpeningSection(sections.opening, ctx)
      : { section: "opening" as const, isValid: false, issues: [{ code: "OPENING_MISSING", severity: "error" as const, section: "opening" as const, description: "Opening section is missing" }], score: 0 }
  );

  sectionResults.push(
    sections.bodyFacts
      ? validateBodyFactsSection(sections.bodyFacts, ctx)
      : { section: "bodyFacts" as const, isValid: false, issues: [{ code: "BODY_MISSING", severity: "error" as const, section: "bodyFacts" as const, description: "Body facts section is missing" }], score: 0 }
  );

  sectionResults.push(
    sections.accountList
      ? validateAccountListSection(sections.accountList, ctx)
      : { section: "accountList" as const, isValid: false, issues: [{ code: "ACCOUNTS_MISSING", severity: "error" as const, section: "accountList" as const, description: "Account list section is missing" }], score: 0 }
  );

  sectionResults.push(
    sections.corrections
      ? validateCorrectionsSection(sections.corrections, ctx)
      : { section: "corrections" as const, isValid: false, issues: [{ code: "CORRECTIONS_MISSING", severity: "error" as const, section: "corrections" as const, description: "Corrections section is missing" }], score: 0 }
  );

  sectionResults.push(
    sections.consumerStatement
      ? validateConsumerStatementSection(sections.consumerStatement, ctx)
      : { section: "consumerStatement" as const, isValid: false, issues: [{ code: "STATEMENT_MISSING", severity: "error" as const, section: "consumerStatement" as const, description: "Consumer statement is missing" }], score: 0 }
  );

  // Validate optional sections
  if (sections.header) {
    sectionResults.push(validateGenericSection(sections.header, "header"));
  }
  if (sections.headline) {
    sectionResults.push(validateGenericSection(sections.headline, "headline"));
  }
  if (sections.closing) {
    sectionResults.push(validateGenericSection(sections.closing, "closing"));
  }

  // Aggregate results
  const allIssues = sectionResults.flatMap(r => r.issues);
  const criticalIssues = allIssues.filter(i => i.severity === "error");
  const invalidSections = sectionResults
    .filter(r => !r.isValid)
    .map(r => r.section);

  const overallScore = Math.round(
    sectionResults.reduce((sum, r) => sum + r.score, 0) / sectionResults.length
  );

  return {
    isValid: criticalIssues.length === 0,
    overallScore,
    sectionResults,
    invalidSections,
    criticalIssues,
    allIssues,
  };
}

/**
 * Get issues for a specific section
 */
export function getIssuesForSection(
  result: FullValidationResult,
  sectionName: keyof ParsedLetterSections
): ValidationIssue[] {
  return result.allIssues.filter(i => i.section === sectionName);
}
