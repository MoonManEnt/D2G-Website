/**
 * AMELIA - Adaptive Multilingual Escalation Letter Intelligence Agent
 *
 * The complete letter generation system for Dispute2Go.
 *
 * SUPPORTED FLOWS:
 * - ACCURACY: R1-R11 (FCRA statute escalation)
 * - COLLECTION: R1-R4, R5-R7 (uses Accuracy), R8-R12 (FDCPA)
 * - CONSENT: R1-R3 (Privacy/permissible purpose)
 * - COMBO: R1-R4, R5-R7 (uses Accuracy), R8-R12 (dual violations)
 *
 * CORE DOCTRINE:
 * 1. Round 1: Backdated 30 days, includes personal info disputes
 * 2. Tone escalates naturally: polite → frustrated → demanding → litigation
 * 3. Stories are randomized and never repeat (eOSCAR resistant)
 * 4. Structure: DAMAGES → STORY → FACTS → PENALTY
 */

// =============================================================================
// MAIN GENERATOR (Use this for all letter generation)
// =============================================================================

export {
  generateLetter,
  validateLetter,
  getFlowRoundInfo,
  type FlowType,
  type LetterGenerationInput,
  type GeneratedLetter,
} from "../amelia-generator";

// =============================================================================
// TEMPLATES (Raw templates for customization)
// =============================================================================

export {
  ACCURACY_TEMPLATES,
  COLLECTION_TEMPLATES,
  CONSENT_TEMPLATES,
  LATE_PAYMENT_TEMPLATES,
  getTemplate,
  getDemandLanguage,
  getEffectiveFlow,
  shouldIncludeScreenshots,
  type TemplateVariables,
  type RoundTemplate,
} from "../amelia-templates";

// =============================================================================
// DOCTRINE (Core rules and utilities)
// =============================================================================

export {
  // Types
  type ClientPersonalInfo,
  type DisputeAccount,
  type AccountIssue,
  type HardInquiry,
  type LetterTone,
  type SeverityGrade,
  type LetterGenerationContext,
  type GeneratedLetterOutput,

  // Severity grading
  calculateSeverityGrade,
  shouldDivertFlow,

  // Date handling (backdating)
  calculateLetterDate,
  formatLetterDate,

  // Tone
  determineTone,
  TONE_DESCRIPTIONS,

  // Categories
  INACCURATE_CATEGORIES,
  determineInaccurateCategories,

  // CRA info
  CRA_ADDRESSES,

  // Content hashing
  hashContent,
  isContentUnique,
  recordContentHash,

  // Personal info extraction
  extractPreviousNames,
  extractPreviousAddresses,
  extractHardInquiries,
} from "../amelia-doctrine";

// =============================================================================
// STORY GENERATION (Unique narratives)
// =============================================================================

export {
  generateUniqueStory,
  humanizeText,
  addEscalationLanguage,
  hashStory,
  type GeneratedStory,
} from "../amelia-stories";

// =============================================================================
// ROUND 1 GENERATOR (Legacy - use generateLetter instead)
// =============================================================================

export {
  generateRound1Letter,
  validateLetterDoctrine,
  generateClientHeader,
  generateAccountListSection,
  generateCorrectionsSection,
  type Round1GenerationInput,
} from "../amelia-round1-generator";

// =============================================================================
// BACKWARD COMPATIBILITY
// =============================================================================

export {
  generateAmeliaLetter,
  generateAmeliaAILetter,
  calculateUniquenessScore,
  getEffectiveFlow as getEffectiveFlowLegacy,
  type ClientInfo,
  type LetterGenerationRequest,
  type GeneratedLetter as LegacyGeneratedLetter,
} from "../amelia";
