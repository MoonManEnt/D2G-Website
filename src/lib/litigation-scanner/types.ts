/**
 * Litigation Scanner Types
 *
 * Type definitions for the automated FCRA/FDCPA violation detection engine.
 */

// =============================================================================
// ENUMS & CONSTANTS
// =============================================================================

export type ViolationCategory = "FCRA" | "FDCPA" | "METRO2";

export type ViolationSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type ViolationRuleId =
  | "INCORRECT_BALANCE"
  | "WRONG_ACCOUNT_STATUS"
  | "INCORRECT_PAYMENT_HISTORY"
  | "RE_AGED_DEBT"
  | "OBSOLETE_INFORMATION"
  | "MISSING_DISPUTE_NOTATION"
  | "DUPLICATE_TRADELINES"
  | "WRONG_CREDITOR_REPORTING"
  | "INCORRECT_CREDIT_LIMIT"
  | "FAILURE_TO_INVESTIGATE"
  | "COLLECTING_ON_PAID_DEBT"
  | "WRONG_DEBT_AMOUNT"
  | "TIME_BARRED_COLLECTION"
  | "MULTIPLE_COLLECTORS_SAME_DEBT"
  | "METRO2_ERRORS";

export type DamageType = "STATUTORY" | "ACTUAL" | "PUNITIVE" | "ATTORNEY_FEES" | "COURT_COSTS";

export type CaseStrength = "STRONG" | "MODERATE" | "WEAK";

export type EscalationStage =
  | "DISPUTE_LETTER"
  | "DIRECT_FURNISHER"
  | "CFPB_COMPLAINT"
  | "ATTORNEY_CONSULTATION"
  | "LITIGATION";

// =============================================================================
// VIOLATION
// =============================================================================

export interface LitigationViolation {
  id: string;
  ruleId: ViolationRuleId;
  category: ViolationCategory;
  severity: ViolationSeverity;
  statute: string;
  statuteShortName: string;
  title: string;
  description: string;
  evidence: ViolationEvidence[];
  affectedAccounts: AffectedAccount[];
  defendants: string[];
  caselaw: string[];
  estimatedDamagesMin: number; // cents
  estimatedDamagesMax: number; // cents
}

export interface ViolationEvidence {
  type: "CROSS_BUREAU_DATA" | "ACCOUNT_DATA" | "DATE_COMPARISON" | "DISPUTE_HISTORY" | "STATUS_CONTRADICTION";
  description: string;
  bureauData?: Record<string, string | number | null>;
}

export interface AffectedAccount {
  accountId: string;
  creditorName: string;
  cra: string;
  fingerprint: string;
  accountType: string | null;
  accountStatus: string;
  balance: number | null;
}

// =============================================================================
// DAMAGE ESTIMATE
// =============================================================================

export interface DamageEstimate {
  totalMin: number; // cents
  totalMax: number; // cents
  breakdown: DamageBreakdown[];
  perDefendant: DefendantDamage[];
}

export interface DamageBreakdown {
  type: DamageType;
  label: string;
  min: number; // cents
  max: number; // cents
  description: string;
}

export interface DefendantDamage {
  name: string;
  type: "CRA" | "FURNISHER" | "COLLECTOR";
  violationCount: number;
  estimatedMin: number; // cents
  estimatedMax: number; // cents
}

// =============================================================================
// CASE SUMMARY
// =============================================================================

export interface CaseSummary {
  strengthScore: number; // 0-100
  strengthLabel: CaseStrength;
  defendants: Defendant[];
  causesOfAction: CauseOfAction[];
  keyFindings: string[];
  riskFactors: string[];
}

export interface Defendant {
  name: string;
  type: "CRA" | "FURNISHER" | "COLLECTOR";
  violationCount: number;
  primaryStatutes: string[];
  estimatedLiabilityMin: number; // cents
  estimatedLiabilityMax: number; // cents
}

export interface CauseOfAction {
  statute: string;
  shortName: string;
  description: string;
  violationCount: number;
  isWillful: boolean;
}

// =============================================================================
// ESCALATION PLAN
// =============================================================================

export interface EscalationPlan {
  currentStage: EscalationStage;
  recommendedNextStage: EscalationStage;
  steps: EscalationStep[];
}

export interface EscalationStep {
  stage: EscalationStage;
  title: string;
  description: string;
  isCompleted: boolean;
  isCurrent: boolean;
  isRecommended: boolean;
  actions: string[];
}

// =============================================================================
// SCAN INPUT / OUTPUT
// =============================================================================

export interface LitigationScanInput {
  clientId: string;
  organizationId: string;
  reportId: string;
  reportDate: Date;
  clientState?: string;
  accounts: ScanAccount[];
  disputes: ScanDispute[];
}

export interface ScanAccount {
  id: string;
  creditorName: string;
  maskedAccountId: string;
  fingerprint: string;
  cra: string;
  accountType: string | null;
  accountStatus: string;
  balance: number | null;
  pastDue: number | null;
  creditLimit: number | null;
  highBalance: number | null;
  monthlyPayment: number | null;
  dateOpened: Date | null;
  dateReported: Date | null;
  lastActivityDate: Date | null;
  paymentStatus: string | null;
  detectedIssues: string | null;
  isDisputable: boolean;
  issueCount: number;
}

export interface ScanDispute {
  id: string;
  cra: string;
  status: string;
  sentDate: Date | null;
  respondedAt: Date | null;
  items: ScanDisputeItem[];
}

export interface ScanDisputeItem {
  accountItemId: string;
  outcome: string | null;
}

export interface LitigationScanResult {
  violations: LitigationViolation[];
  damageEstimate: DamageEstimate;
  caseSummary: CaseSummary;
  escalationPlan: EscalationPlan;
  metadata: ScanMetadata;
}

export interface ScanMetadata {
  totalViolations: number;
  fcraViolations: number;
  fdcpaViolations: number;
  metro2Errors: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  estimatedTotalMin: number; // cents
  estimatedTotalMax: number; // cents
  computeTimeMs: number;
  version: string;
}

// =============================================================================
// STATE SOL LOOKUP
// =============================================================================

export interface StateSOL {
  state: string;
  writtenContractYears: number;
  oralContractYears: number;
  promissoryNoteYears: number;
  openAccountYears: number;
}
