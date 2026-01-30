/**
 * Amelia Credit Readiness Engine
 *
 * Evaluates a client's credit profile against product-specific FICO models
 * and generates approval likelihood, score gap analysis, DTI calculations,
 * and prioritized action plans.
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
  ScoringModelProfile,
  ActionPlanStep,
  ScoreGapAnalysis,
  ScoreGapFactor,
  DTIResult,
  ApprovalAnalysisResult,
  Finding,
  CreditDataInput,
} from "./types";

// Scoring models & profiles
export {
  PRODUCT_SCORING_PROFILES,
  STORED_SCORE_TYPE_MAP,
  estimateScore,
  getRelevantScore,
} from "./scoring-models";

// DTI calculator
export { calculateDTI } from "./dti-calculator";

// Score gap analyzer
export { analyzeScoreGap } from "./score-gap-analyzer";

// Action plan generator
export { generateActionPlan } from "./action-plan-generator";

// Main analyzer
export { analyzeApprovalLikelihood } from "./approval-analyzer";
