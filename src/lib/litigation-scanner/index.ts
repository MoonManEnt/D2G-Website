/**
 * Litigation Scanner
 *
 * Automated FCRA/FDCPA violation detection engine.
 * Scans parsed credit report data to identify actionable legal violations,
 * estimate potential damages, build case summaries, and provide escalation paths.
 *
 * Usage:
 *   import { runLitigationScan } from "@/lib/litigation-scanner";
 *
 *   const result = runLitigationScan(scanInput);
 */

// Types
export type {
  ViolationCategory,
  ViolationSeverity,
  ViolationRuleId,
  DamageType,
  CaseStrength,
  EscalationStage,
  LitigationViolation,
  ViolationEvidence,
  AffectedAccount,
  DamageEstimate,
  DamageBreakdown,
  DefendantDamage,
  CaseSummary,
  Defendant,
  CauseOfAction,
  EscalationPlan,
  EscalationStep,
  LitigationScanInput,
  ScanAccount,
  ScanDispute,
  ScanDisputeItem,
  LitigationScanResult,
  ScanMetadata,
  StateSOL,
} from "./types";

// Violation rules
export { runAllViolationRules } from "./violation-rules";

// Damage estimator
export { estimateDamages } from "./damage-estimator";

// Case builder
export { buildCaseSummary, buildEscalationPlan } from "./case-builder";

// Main scanner
export { runLitigationScan } from "./scanner";
