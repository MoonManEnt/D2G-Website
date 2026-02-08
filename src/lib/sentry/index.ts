/**
 * SENTRY DISPUTE ENGINE
 *
 * Main entry point for the Sentry Dispute system.
 * This module exports all Sentry-specific functionality.
 *
 * ISOLATION: This module is completely separate from the existing AMELIA system.
 * Do NOT import from ../amelia-*.ts files.
 */

// =============================================================================
// TYPE EXPORTS
// =============================================================================
export type {
  // Core types
  SentryCRA,
  SentryFlowType,
  SentryDisputeStatus,
  SentryOutcome,
  // e-OSCAR types
  EOSCARCode,
  EOSCARCodePriority,
  EOSCARRecommendation,
  // Legal types
  LegalCitation,
  CaseLaw,
  InvalidCitation,
  CitationValidationResult,
  CitationApplicability,
  // OCR types
  OCRSeverity,
  OCRFrivolousPhrase,
  OCRFinding,
  OCRAnalysisResult,
  // Metro 2 types
  Metro2Field,
  Metro2FieldDispute,
  Metro2Discrepancy,
  // Success types
  SuccessFactor,
  SuccessPrediction,
  // Main entity types
  SentryDispute,
  SentryDisputeItem,
  SentryAnalysis,
  SentryDisputeInput,
  SentryDisputeItemInput,
  // Account/Client types
  SentryAccountItem,
  SentryDetectedIssue,
  SentryClient,
  // Letter types
  SentryLetterRequest,
  SentryLetterItem,
  SentryLetterOptions,
  SentryGeneratedLetter,
  // Template types
  SentryTemplate,
  SentryTemplateVariables,
  // Furnisher types
  FurnisherProfile,
  // API types
  SentryAPIResponse,
  SentryListResponse,
  // Request types
  AnalyzeLetterRequest,
  RecommendCodesRequest,
  ValidateCitationsRequest,
  SuccessPredictionRequest,
  // Actionable Recommendation types
  ActionableRecommendation,
  RecommendationActionType,
  RecommendationStatus,
  RecommendationPayload,
  EnableMetro2Payload,
  ChangeEOSCARPayload,
  ApplyOCRFixesPayload,
  AddDocumentationPayload,
  AddCitationPayload,
  RemoveCitationPayload,
  AdjustTonePayload,
  AppliedRecommendations,
} from "@/types/sentry";

// =============================================================================
// ENGINE EXPORTS
// =============================================================================

// e-OSCAR Intelligence Engine
export {
  recommendEOSCARCodes,
  recommendCodesForAccount,
  getEOSCARCodeDatabase,
  getCodeDescription,
  getPrimaryCode,
  validateCodeSelection,
  getCodesForFlow,
} from "./eoscar-engine";

// Legal Citation Validator
export {
  validateCitations,
  getLegalCitationDatabase,
  getInvalidCitationDatabase,
  getCaseLawDatabase,
  findValidCitation,
  findInvalidCitation,
  isCitationValidForTarget,
  getRecommendedCitations,
  getCaseLawForCitation,
  suggestCitationFix,
} from "./legal-validator";

// OCR Frivolous Detection
export {
  analyzeOCRRisk,
  getOCRPhraseDatabase,
  applyOCRFixes,
  meetsMinimumSafety,
  meetsTargetSafety,
  getRiskSummary,
  getImprovementSuggestions,
} from "./ocr-detector";

// Metro 2 Field Targeting
export {
  getMetro2FieldDatabase,
  getMetro2Field,
  generateMetro2DisputeLanguage,
  createFieldDispute,
  detectFieldDiscrepancies,
  generateDiscrepancyLanguage,
  getRecommendedFields,
  buildAccountListEntry,
  getVerificationChallenges,
  METRO2_FIELD_DATABASE,
} from "./metro2-targeting";

// Success Probability Calculator
export {
  calculateSuccessProbability,
  getSuccessFactors,
  quickEstimate,
  getProbabilityLabel,
  calculatePotentialImprovement,
  compareStrategies,
  getFactorWeights,
  generateActionableRecommendations,
  type ActionableRecommendationContext,
} from "./success-calculator";

// Recommendation Actions
export {
  applyRecommendation,
  revertRecommendation,
  resetAllRecommendations,
  previewRecommendation,
  calculateCombinedEffect,
  createAppliedRecommendationsTracker,
  updateAppliedRecommendationsTracker,
  type ApplyRecommendationResult,
  type RevertRecommendationResult,
  type PreviewResult,
} from "./recommendation-actions";

// Letter Generation
export {
  generateSentryLetter,
  generateSentryPreview,
  regenerateSentryLetter,
  analyzeExistingLetter,
  getAvailableTemplates,
  type GenerationContext,
  type GenerationResult,
} from "./sentry-generator";

// Writing Modes (Professional vs Normal People)
export {
  type WritingMode,
  type WritingModeConfig,
  type StoryContext,
  type GeneratedStory,
  WRITING_MODE_CONFIGS,
  getWritingModeConfig,
  getAvailableWritingModes,
  buildPlainEnglishReason,
  transformToNormalPeople,
  addHumanTouch,
  PLAIN_ENGLISH_CITATIONS,
  PLAIN_LANGUAGE_SUBSTITUTIONS,
  HUMAN_TOUCH_PATTERNS,
  EOSCAR_TO_DISPUTE_TYPE,
} from "./writing-modes";

// Story Generation (AI-powered impact stories)
export {
  generateImpactStory,
  generateStoriesForAccounts,
  combineStories,
  generateSummaryStory,
} from "./story-generator";

// Templates
export {
  getSentryTemplates,
  getSentryTemplate,
  getTemplatesForFlowRound,
  selectBestTemplate,
  getTemplateCitations,
  validateTemplateCitations,
  SENTRY_TEMPLATES,
  TEMPLATE_VARIABLES,
  type SentryTemplateSection,
} from "./sentry-templates";

// Doctrine (Rules Engine)
export {
  SENTRY_DOCTRINE,
  SENTRY_VALID_CITATIONS,
  SENTRY_INVALID_CITATIONS,
  SENTRY_CASE_LAW,
  validateAgainstDoctrine,
  getSentryEffectiveFlow,
  getSentryToneLevel,
} from "./sentry-doctrine";

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Bureau addresses for Sentry letters
 */
export const SENTRY_BUREAU_ADDRESSES = {
  TRANSUNION: {
    name: "TransUnion",
    address: "P.O. Box 2000",
    city: "Chester",
    state: "PA",
    zip: "19016-2000",
  },
  EQUIFAX: {
    name: "Equifax Information Services LLC",
    address: "P.O. Box 740256",
    city: "Atlanta",
    state: "GA",
    zip: "30374-0256",
  },
  EXPERIAN: {
    name: "Experian",
    address: "P.O. Box 4500",
    city: "Allen",
    state: "TX",
    zip: "75013",
  },
} as const;

/**
 * FCRA deadline in days
 */
export const SENTRY_FCRA_DEADLINE_DAYS = 30;

/**
 * Default backdate for R1 letters
 */
export const SENTRY_R1_BACKDATE_DAYS = 30;

/**
 * Version identifier for A/B testing
 */
export const SENTRY_ENGINE_VERSION = "1.0.0";

/**
 * System identifier for tracking
 */
export const SENTRY_SYSTEM_ID = "SENTRY";
