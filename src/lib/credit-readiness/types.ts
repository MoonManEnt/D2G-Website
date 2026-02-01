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
export type CFPBTier = "SUPER_PRIME" | "PRIME" | "NEAR_PRIME" | "SUBPRIME" | "DEEP_SUBPRIME";
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

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
  alternativeModels?: FICOModel[];
  scoringMethod: "SINGLE" | "TRI_MERGE_MIDDLE" | "HIGHEST" | "LOWEST";
  bureauPreference?: string[];
  minimumScoreRanges: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
  maxDTI?: number;
  /** Product-specific DTI thresholds */
  dtiThresholds?: {
    good: number;
    borderline: number;
    high: number;
    /** Absolute max (CRITICAL if above) */
    max: number;
  };
  /** Factor weights for the multi-factor readiness formula (must sum to 1.0) */
  factorWeights: {
    credit: number;
    dti: number;
    ltv: number;
    history: number;
  };
  additionalFactors: string[];
  description: string;
}

// =============================================================================
// LTV (LOAN-TO-VALUE) SUPPORT
// =============================================================================

export interface LTVInput {
  loanAmount: number;
  assetValue: number;
}

export interface LTVResult {
  ltv: number;
  status: "GOOD" | "ACCEPTABLE" | "HIGH" | "CRITICAL";
  details: string;
}

// =============================================================================
// READINESS FACTORS (Multi-Factor Formula)
// =============================================================================

export interface ReadinessFactors {
  creditFactor: number;       // 0-100 normalized credit score factor
  dtiFactor: number;          // 0-100 normalized DTI factor
  ltvFactor: number;          // 0-100 normalized LTV factor (100 if N/A)
  historyFactor: number;      // 0-100 normalized credit history factor
  weights: {
    credit: number;
    dti: number;
    ltv: number;
    history: number;
  };
  compositeScore: number;     // Weighted sum (0-100)
}

// =============================================================================
// HARD DISQUALIFICATION
// =============================================================================

export interface HardDisqualification {
  reason: string;
  detail: string;
  waitPeriod?: string;
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
  cfpbTier: CFPBTier;
  confidenceLevel: ConfidenceLevel;
  explanation: string;
  relevantScoreModel: string;
  relevantScore: number | null;
  triMergeMiddle: number | null;
  dti: DTIResult | null;
  ltv: LTVResult | null;
  readinessFactors: ReadinessFactors;
  hardDisqualifications: HardDisqualification[];
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
  /** LTV input for secured products (mortgage, auto) */
  ltvInput?: LTVInput;
  /** Whether the client has a recent bankruptcy on record */
  hasBankruptcy?: boolean;
  /** Type of bankruptcy if applicable */
  bankruptcyType?: "CHAPTER_7" | "CHAPTER_13";
  /** Date of bankruptcy discharge */
  bankruptcyDischargeDate?: Date | null;
  /** Whether the client has a recent foreclosure */
  hasForeclosure?: boolean;
  /** Date of foreclosure */
  foreclosureDate?: Date | null;
  dnaProfile?: {
    classification: string;
    healthScore: number;
    improvementPotential: number;
    utilization: string; // JSON
    derogatoryProfile: string; // JSON
  };
}
