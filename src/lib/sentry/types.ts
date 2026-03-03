/**
 * Sentry Mode - Shared TypeScript Types
 *
 * Types used across all Sentry intelligence modules.
 */

import type { DisputeAccountData, DetectedIssue, DisputeFlow } from "@/lib/dispute-creation/types";

export type { DisputeFlow };

// =============================================================================
// e-OSCAR ENGINE TYPES
// =============================================================================

export interface EOSCARCode {
  code: string;
  name: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  triggerConditions: string[];
  requiredEvidence: string[];
  avoidWith: string[];
  baselineSuccessRate: number;
  description: string;
}

export interface EOSCARRecommendation {
  code: string;
  name: string;
  matchStrength: number; // 0-100
  evidenceAvailable: boolean;
  historicalSuccessRate: number;
  reasoning: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

export interface FurnisherProfile {
  creditorName: string;
  totalDisputes: number;
  deletionRate: number;
  verificationRate: number;
  averageResponseDays: number;
  effectiveCodes: Array<{
    code: string;
    successRate: number;
    sampleSize: number;
    isReliable: boolean; // sampleSize >= 10
  }>;
}

// =============================================================================
// LEGAL CITATION TYPES
// =============================================================================

export interface CaseLaw {
  name: string;
  citation: string;
  relevance: string;
}

export interface ValidCitation {
  statute: string;
  shortName: string;
  fullText: string;
  applicableTo: Array<"CRA" | "FURNISHER" | "COLLECTOR">;
  useFor: string[];
  neverUseFor: string[];
  commonMisuse?: string;
  caseSupport: CaseLaw[];
}

export interface InvalidCitation {
  statute: string;
  commonClaim: string;
  whyItFails: string;
  correctApproach: string;
  correctStatute?: string;
}

export interface CitationFinding {
  statute: string;
  location: number; // character index in content
  lineNumber: number;
  severity: "ERROR" | "WARNING";
  message: string;
  suggestedFix?: string;
}

export interface CitationValidationResult {
  valid: boolean;
  errors: CitationFinding[];
  warnings: CitationFinding[];
  validCitationsUsed: string[];
  totalCitations: number;
}

// =============================================================================
// OCR / FRIVOLOUS DETECTOR TYPES
// =============================================================================

export interface FrivolousPhrase {
  pattern: RegExp;
  severity: "HIGH" | "MEDIUM" | "LOW";
  replacement: string;
  explanation: string;
}

export interface OCRFinding {
  phrase: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  lineNumber: number;
  section: "opening" | "body" | "closing";
  explanation: string;
  suggestedReplacement: string;
}

export interface AutoFix {
  original: string;
  replacement: string;
  lineNumber: number;
  applied: boolean;
}

export interface OCRAnalysisResult {
  score: number; // 0-100 (100 = safest)
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  findings: OCRFinding[];
  autoFixes: AutoFix[];
  projectedScoreAfterFixes: number;
  sectionBreakdown: {
    opening: number;
    body: number;
    closing: number;
  };
}

// =============================================================================
// METRO 2 FIELD TYPES
// =============================================================================

export type Metro2FieldCode =
  | "DOFD"
  | "BALANCE"
  | "PAYMENT_RATING"
  | "ACCOUNT_STATUS"
  | "HIGH_CREDIT"
  | "DATE_OPENED"
  | "DATE_REPORTED";

export interface Metro2Field {
  code: Metro2FieldCode;
  name: string;
  description: string;
  disputeLanguageTemplate: string;
  commonIssues: string[];
  verificationChallenge: string;
  relatedEOSCARCodes: string[];
}

export interface Metro2FieldTarget {
  field: Metro2Field;
  accountId: string;
  creditorName: string;
  reportedValue: string;
  expectedValue?: string;
  discrepancyType: "CROSS_BUREAU" | "LOGICAL_ERROR" | "OUTDATED" | "MISSING";
  discrepancyDetail: string;
  bureauSource?: string;
}

// =============================================================================
// SUCCESS CALCULATOR TYPES
// =============================================================================

export interface SuccessContext {
  accountId: string;
  creditorName: string;
  accountAge?: number; // months
  accountType?: string;
  accountStatus?: string;
  balance?: number;
  flow: DisputeFlow;
  round: number;
  eoscarCodes: string[];
  hasDocumentation: boolean;
  documentationType?: string;
  citationAccuracy: number; // 0-1
  ocrSafetyScore: number; // 0-100
  organizationId: string;
  furnisherProfile?: FurnisherProfile;
}

export interface SuccessBreakdownItem {
  factor: string;
  weight: number;
  score: number;
  weightedScore: number;
  detail: string;
}

export interface SuccessPrediction {
  probability: number; // 0-1
  confidence: "LOW" | "MEDIUM" | "HIGH";
  breakdown: SuccessBreakdownItem[];
  recommendations: string[];
  estimatedDaysToResolve: number;
}

// =============================================================================
// OUTCOME ENGINE TYPES
// =============================================================================

export interface OutcomeInput {
  disputeId: string;
  disputeItemId: string;
  accountItemId: string;
  clientId: string;
  organizationId: string;
  creditorName: string;
  cra: string;
  flow: string;
  round: number;
  outcome: "DELETED" | "VERIFIED" | "UPDATED" | "NO_RESPONSE" | "STALL_LETTER";
  eoscarCodesUsed?: string[];
  metro2FieldsTargeted?: string[];
  successProbabilityAtGeneration?: number;
  daysToRespond?: number;
}

export interface ScoreImpactInput {
  clientId: string;
  accountItemId: string;
  organizationId: string;
  outcome: string;
  cra: string;
  scoreBefore?: number;
  scoreAfter?: number;
  accountType?: string;
  accountStatus?: string;
  balance?: number;
  creditorName?: string;
  flow?: string;
  round?: number;
}

// =============================================================================
// GOAL PROJECTION TYPES
// =============================================================================

export type GoalType = "MORTGAGE" | "AUTO" | "CREDIT_CARD" | "BEST_RATES" | "CUSTOM";

export interface GoalMilestone {
  score: number;
  name: string;
  description: string;
  achievedAt?: Date;
}

export const SCORE_MILESTONES: GoalMilestone[] = [
  { score: 580, name: "Subprime Exit", description: "Exited subprime credit range" },
  { score: 620, name: "FHA Eligible", description: "Eligible for FHA mortgage loans" },
  { score: 650, name: "Good Credit", description: "Entered good credit range" },
  { score: 680, name: "Mortgage Ready", description: "Competitive mortgage rates available" },
  { score: 700, name: "Excellent Threshold", description: "Entered excellent credit territory" },
  { score: 720, name: "Best Rates", description: "Qualify for best available rates" },
  { score: 740, name: "Premium Credit", description: "Premium credit tier achieved" },
  { score: 760, name: "Exceptional", description: "Exceptional credit score achieved" },
];

export interface GoalProjection {
  goalId: string;
  currentScore: number;
  targetScore: number;
  estimatedMonthsToGoal: number;
  estimatedDate: Date;
  averageMonthlyGain: number;
  remainingDisputableItems: number;
  projectedPointsFromDisputes: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  nextMilestone?: GoalMilestone;
}

// =============================================================================
// AUTO-ESCALATION TYPES
// =============================================================================

export interface AutoEscalationResult {
  escalated: boolean;
  draftsCreated: number;
  disputeIds: string[];
  skippedReason?: string;
  notificationSent: boolean;
}

// =============================================================================
// HEARTBEAT TYPES
// =============================================================================

export interface HeartbeatResult {
  processed: boolean;
  outcomesRecorded: number;
  scoresUpdated: number;
  milestonesDetected: string[];
  autoEscalations: number;
  notificationsSent: number;
}

// =============================================================================
// SENTRY ANALYSIS RESULT (ORCHESTRATOR)
// =============================================================================

export interface SentryAccountAnalysis {
  accountId: string;
  creditorName: string;
  maskedAccountId: string | null;
  cra: string;
  recommendedFlow: DisputeFlow;
  eoscarRecommendations: EOSCARRecommendation[];
  metro2Targets: Metro2FieldTarget[];
  successProbability: SuccessPrediction;
  ocrPrecheck?: {
    estimatedRisk: "LOW" | "MEDIUM" | "HIGH";
  };
}

export interface SentryDisputePlan {
  clientId: string;
  analyzedAt: string;
  bureauGroups: Array<{
    cra: string;
    flow: DisputeFlow;
    round: number;
    accounts: SentryAccountAnalysis[];
    aggregateSuccessProbability: number;
  }>;
  overallReadiness: "READY" | "NEEDS_REVIEW" | "NOT_READY";
  totalAccounts: number;
  recommendations: string[];
}

export interface SentryAnalysisResult {
  eoscarRecommendations: EOSCARRecommendation[];
  citationValidation: CitationValidationResult;
  ocrAnalysis: OCRAnalysisResult;
  metro2Targets: Metro2FieldTarget[];
  successProbability: SuccessPrediction;
  overallReadiness: "READY" | "NEEDS_REVIEW" | "NOT_READY";
}

// =============================================================================
// SENTRY CONTEXT FOR AMELIA PIPELINE
// =============================================================================

export interface SentryLetterContext {
  eoscarCodes: string[];
  eoscarCodeNames: Record<string, string>;
  metro2Targets: Metro2FieldTarget[];
  metro2DisputeLanguage: string[];
  applyCitationFixes: boolean;
  applyOCRFixes: boolean;
}
