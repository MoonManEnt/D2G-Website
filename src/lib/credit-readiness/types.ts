/**
 * Amelia Credit Readiness Engine - Type Definitions
 *
 * Defines the complete type system for credit readiness analysis,
 * including FICO model awareness, approval likelihood scoring,
 * score gap analysis, DTI calculations, and action plan generation.
 */

// =============================================================================
// CORE ENUMS
// =============================================================================

export type ProductType = "MORTGAGE" | "AUTO" | "CREDIT_CARD" | "PERSONAL_LOAN" | "BUSINESS_LOC" | "GENERAL";
export type ApprovalTier = "LIKELY" | "POSSIBLE" | "UNLIKELY" | "NOT_READY";
export type ActionPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type ActionCategory = "DISPUTE" | "PAY_DOWN" | "BUILD_CREDIT" | "INCOME" | "WAIT" | "VENDOR_SERVICE";

export type FICOModel =
  | "FICO_8" | "FICO_9" | "FICO_10"
  | "FICO_AUTO_5" | "FICO_AUTO_8" | "FICO_AUTO_9" | "FICO_AUTO_10"
  | "FICO_BANKCARD_5" | "FICO_BANKCARD_8" | "FICO_BANKCARD_9" | "FICO_BANKCARD_10"
  | "FICO_SCORE_2" | "FICO_SCORE_4" | "FICO_SCORE_5"
  | "VANTAGE_3" | "VANTAGE_4";

// =============================================================================
// SCORING MODEL PROFILE
// =============================================================================

export interface ScoringModelProfile {
  productType: ProductType;
  displayName: string;
  primaryModels: FICOModel[];
  scoringMethod: "SINGLE" | "TRI_MERGE_MIDDLE" | "HIGHEST" | "LOWEST";
  bureauPreference?: string[];
  minimumScoreRanges: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
  maxDTI?: number;
  additionalFactors: string[];
  description: string;
}

// =============================================================================
// ACTION PLAN
// =============================================================================

export interface ActionPlanStep {
  stepNumber: number;
  priority: ActionPriority;
  category: ActionCategory;
  title: string;
  whatToDo: string;
  howToDoIt: string;
  whereToGo: string;
  estimatedImpact: string;
  estimatedTimeline: string;
  vendorId?: string;
  vendorName?: string;
}

// =============================================================================
// SCORE GAP ANALYSIS
// =============================================================================

export interface ScoreGapAnalysis {
  currentScore: number;
  targetScore: number;
  gap: number;
  scoreModel: string;
  factors: ScoreGapFactor[];
  estimatedTimeToTarget: string;
}

export interface ScoreGapFactor {
  factor: string;
  currentImpact: string;
  potentialGain: number;
  action: string;
}

// =============================================================================
// DTI ANALYSIS
// =============================================================================

export interface DTIResult {
  estimatedDTI: number;
  totalMonthlyDebt: number;
  monthlyIncome: number;
  maxRecommendedDTI: number;
  status: "GOOD" | "BORDERLINE" | "HIGH" | "CRITICAL";
  details: string;
}

// =============================================================================
// APPROVAL ANALYSIS RESULT
// =============================================================================

export interface ApprovalAnalysisResult {
  productType: ProductType;
  approvalLikelihood: number;
  approvalTier: ApprovalTier;
  explanation: string;
  relevantScoreModel: string;
  relevantScore: number | null;
  triMergeMiddle: number | null;
  dti: DTIResult | null;
  scoreGap: ScoreGapAnalysis;
  findings: Finding[];
  actionPlan: ActionPlanStep[];
}

// =============================================================================
// FINDINGS
// =============================================================================

export interface Finding {
  category: string;
  severity: "POSITIVE" | "WARNING" | "NEGATIVE" | "CRITICAL";
  title: string;
  detail: string;
  impact: string;
}

// =============================================================================
// CREDIT DATA INPUT
// =============================================================================

export interface CreditDataInput {
  creditScores: Array<{ cra: string; score: number; scoreType: string }>;
  accounts: Array<{
    creditorName: string;
    accountType: string | null;
    accountStatus: string;
    balance: number | null;
    creditLimit: number | null;
    monthlyPayment: number | null;
    dateOpened: Date | null;
    isDisputable: boolean;
    issueCount: number;
  }>;
  statedIncome?: number;
  inquiryCount?: number;
  dnaProfile?: {
    classification: string;
    healthScore: number;
    improvementPotential: number;
    utilization: string; // JSON
    derogatoryProfile: string; // JSON
  };
}
