/**
 * Sentry Mode — Barrel Export + Orchestrator
 *
 * Central entry point for all Sentry intelligence modules.
 * The `analyzeDraft()` function runs all modules and returns a unified result.
 */

// Re-export all modules
export * from "./types";
export { EOSCAR_CODE_DATABASE, recommendEOSCARCodes, validateCodeCombination } from "./eoscar-engine";
export { VALID_CITATIONS, INVALID_CITATIONS, validateLetterCitations, autoFixCitations } from "./legal-validator";
export { FRIVOLOUS_PATTERNS, analyzeOCRRisk, applyOCRFixes } from "./ocr-detector";
export { METRO2_FIELD_DATABASE, detectTargetableFields, generateMetro2DisputeLanguage } from "./metro2-fields";
export { calculateSuccessProbability } from "./success-calculator";
export { recordOutcome, correlateScoreImpact, getOutcomePatterns, buildFurnisherProfile } from "./outcome-engine";

// Module imports for orchestrator
import type { DisputeAccountData } from "@/lib/dispute-creation/types";
import type { SentryAnalysisResult, SentryLetterContext, DisputeFlow } from "./types";
import { recommendEOSCARCodes } from "./eoscar-engine";
import { validateLetterCitations, autoFixCitations } from "./legal-validator";
import { analyzeOCRRisk, applyOCRFixes } from "./ocr-detector";
import { detectTargetableFields, generateMetro2DisputeLanguage } from "./metro2-fields";
import { calculateSuccessProbability } from "./success-calculator";
import { buildFurnisherProfile } from "./outcome-engine";
import { parseDetectedIssues } from "@/lib/dispute-creation/letter-strategies";

// =============================================================================
// UNIFIED ANALYSIS ORCHESTRATOR
// =============================================================================

/**
 * Run all Sentry intelligence modules against a draft letter and its accounts.
 * Returns a unified result with overall readiness assessment.
 */
export async function analyzeDraft(
  letterContent: string,
  accounts: DisputeAccountData[],
  cra: string,
  flow: string,
  round: number,
  organizationId: string
): Promise<SentryAnalysisResult> {
  // Determine target type for citation validation
  const targetType = flow === "COLLECTION" ? "COLLECTOR" as const : "CRA" as const;

  // 1. e-OSCAR Recommendations (per account)
  const allEoscarRecs = [];
  for (const account of accounts) {
    const issues = parseDetectedIssues(account.detectedIssues);
    const furnisherProfile = await buildFurnisherProfile(organizationId, account.creditorName);
    const recs = recommendEOSCARCodes(account, issues, furnisherProfile || undefined);
    allEoscarRecs.push(...recs);
  }

  // 2. Citation Validation
  const citationValidation = validateLetterCitations(letterContent, targetType);

  // 3. OCR Risk Analysis
  const ocrAnalysis = analyzeOCRRisk(letterContent);

  // 4. Metro 2 Field Targeting
  const allMetro2Targets = [];
  for (const account of accounts) {
    // Find cross-bureau accounts (same creditor, different CRA)
    const crossBureauAccounts = accounts.filter(
      (a) =>
        a.creditorName === account.creditorName &&
        a.cra !== account.cra
    );
    const targets = detectTargetableFields(account, crossBureauAccounts);
    allMetro2Targets.push(...targets);
  }

  // 5. Success Probability (aggregate across accounts)
  const citationAccuracy = citationValidation.totalCitations > 0
    ? citationValidation.validCitationsUsed.length / citationValidation.totalCitations
    : 1;

  // Use first account for representative calculation
  const primaryAccount = accounts[0];
  const primaryFurnisher = primaryAccount
    ? await buildFurnisherProfile(organizationId, primaryAccount.creditorName)
    : null;

  const topCodes = allEoscarRecs
    .sort((a, b) => b.matchStrength - a.matchStrength)
    .slice(0, 3)
    .map((r) => r.code);

  const successProbability = await calculateSuccessProbability({
    accountId: primaryAccount?.id || "",
    creditorName: primaryAccount?.creditorName || "",
    accountType: primaryAccount?.accountType || undefined,
    accountStatus: primaryAccount?.accountStatus || undefined,
    balance: primaryAccount?.balance || undefined,
    flow: flow as DisputeFlow,
    round,
    eoscarCodes: topCodes,
    hasDocumentation: false, // Will be enhanced when evidence system integrates
    citationAccuracy,
    ocrSafetyScore: ocrAnalysis.score,
    organizationId,
    furnisherProfile: primaryFurnisher || undefined,
  });

  // 6. Determine overall readiness
  let overallReadiness: "READY" | "NEEDS_REVIEW" | "NOT_READY";
  if (
    citationValidation.errors.length === 0 &&
    ocrAnalysis.riskLevel === "LOW" &&
    successProbability.probability >= 0.3
  ) {
    overallReadiness = "READY";
  } else if (
    citationValidation.errors.length <= 2 &&
    ocrAnalysis.riskLevel !== "CRITICAL" &&
    successProbability.probability >= 0.15
  ) {
    overallReadiness = "NEEDS_REVIEW";
  } else {
    overallReadiness = "NOT_READY";
  }

  return {
    eoscarRecommendations: allEoscarRecs,
    citationValidation,
    ocrAnalysis,
    metro2Targets: allMetro2Targets,
    successProbability,
    overallReadiness,
  };
}

// =============================================================================
// SENTRY CONTEXT BUILDER
// =============================================================================

/**
 * Build a SentryLetterContext for injecting into the AMELIA generation pipeline.
 */
export function buildSentryContext(
  accounts: DisputeAccountData[],
  organizationId: string
): SentryLetterContext {
  const allCodes: string[] = [];
  const codeNames: Record<string, string> = {};
  const allTargets = [];
  const metro2Language: string[] = [];

  for (const account of accounts) {
    const issues = parseDetectedIssues(account.detectedIssues);
    const recs = recommendEOSCARCodes(account, issues);

    for (const rec of recs.slice(0, 2)) { // Top 2 per account
      if (!allCodes.includes(rec.code)) {
        allCodes.push(rec.code);
        codeNames[rec.code] = rec.name;
      }
    }

    // Metro 2 targets
    const crossBureauAccounts = accounts.filter(
      (a) => a.creditorName === account.creditorName && a.cra !== account.cra
    );
    const targets = detectTargetableFields(account, crossBureauAccounts);
    allTargets.push(...targets);

    for (const target of targets) {
      const language = generateMetro2DisputeLanguage(
        target.field,
        target.reportedValue,
        target.expectedValue,
        target.discrepancyDetail
      );
      metro2Language.push(language);
    }
  }

  return {
    eoscarCodes: allCodes,
    eoscarCodeNames: codeNames,
    metro2Targets: allTargets,
    metro2DisputeLanguage: metro2Language,
    applyCitationFixes: true,
    applyOCRFixes: true,
  };
}
