/**
 * Amelia Credit Readiness Engine
 *
 * Evaluates a client's credit profile against product-specific FICO models
 * and generates approval likelihood, score gap analysis, DTI calculations,
 * and prioritized action plans.
 *
 * v2.0 - Multi-factor weighted readiness formula with:
 *   - Product-specific factor weights (Credit, DTI, LTV, History)
 *   - Score/DTI/LTV normalization to 0-100 scale
 *   - CFPB credit tier classifications
 *   - Hard disqualification rules (bankruptcy, foreclosure, collections)
 *   - VantageScore 4.0 support for Fannie/Freddie mortgages
 *   - FICO version-specific behavior awareness
 *   - Confidence levels (HIGH/MEDIUM/LOW)
 *
 * Usage:
 *   import { analyzeApprovalLikelihood } from "@/lib/credit-readiness";
 *
 *   const result = analyzeApprovalLikelihood("MORTGAGE", creditData);
 */

// Types
export type {
  ProductType,
  ApprovalTier,
  ActionPriority,
  ActionCategory,
  FICOModel,
  CFPBTier,
  ConfidenceLevel,
  ScoringModelProfile,
  ActionPlanStep,
  ScoreGapAnalysis,
  ScoreGapFactor,
  DTIResult,
  LTVInput,
  LTVResult,
  ReadinessFactors,
  HardDisqualification,
  ApprovalAnalysisResult,
  Finding,
  CreditDataInput,
} from "./types";

// Scoring models & profiles
export {
  PRODUCT_SCORING_PROFILES,
  STORED_SCORE_TYPE_MAP,
  CFPB_TIERS,
  FICO_VERSION_BEHAVIOR,
  estimateScore,
  getRelevantScore,
  classifyCFPBTier,
  normalizeScoreTo100,
  normalizeDTITo100,
  normalizeLTVTo100,
} from "./scoring-models";

// DTI calculator
export { calculateDTI } from "./dti-calculator";

// Score gap analyzer
export { analyzeScoreGap } from "./score-gap-analyzer";

// Action plan generator
export { generateActionPlan } from "./action-plan-generator";

// Main analyzer
export { analyzeApprovalLikelihood } from "./approval-analyzer";
