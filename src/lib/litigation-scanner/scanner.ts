/**
 * Litigation Scanner Orchestrator
 *
 * Main entry point that runs all violation rules, estimates damages,
 * builds case summary, and generates escalation plan.
 */

import type {
  LitigationScanInput,
  LitigationScanResult,
  ScanMetadata,
} from "./types";
import { runAllViolationRules } from "./violation-rules";
import { estimateDamages } from "./damage-estimator";
import { buildCaseSummary, buildEscalationPlan } from "./case-builder";

const ENGINE_VERSION = "1.0.0";

/**
 * Run a full litigation scan on the given input data.
 *
 * Flow:
 *   1. Run all 15 violation detection rules
 *   2. Estimate damages from detected violations
 *   3. Build case summary with strength score
 *   4. Generate escalation plan
 *   5. Compute metadata
 */
export function runLitigationScan(input: LitigationScanInput): LitigationScanResult {
  const startTime = Date.now();

  // 1. Detect violations
  const violations = runAllViolationRules(input);

  // 2. Estimate damages
  const damageEstimate = estimateDamages(violations);

  // 3. Build case summary
  const caseSummary = buildCaseSummary(violations, damageEstimate, input);

  // 4. Build escalation plan
  const escalationPlan = buildEscalationPlan(violations, input);

  // 5. Compute metadata
  const computeTimeMs = Date.now() - startTime;

  const metadata: ScanMetadata = {
    totalViolations: violations.length,
    fcraViolations: violations.filter((v) => v.category === "FCRA").length,
    fdcpaViolations: violations.filter((v) => v.category === "FDCPA").length,
    metro2Errors: violations.filter((v) => v.category === "METRO2").length,
    criticalCount: violations.filter((v) => v.severity === "CRITICAL").length,
    highCount: violations.filter((v) => v.severity === "HIGH").length,
    mediumCount: violations.filter((v) => v.severity === "MEDIUM").length,
    lowCount: violations.filter((v) => v.severity === "LOW").length,
    estimatedTotalMin: damageEstimate.totalMin,
    estimatedTotalMax: damageEstimate.totalMax,
    computeTimeMs,
    version: ENGINE_VERSION,
  };

  return {
    violations,
    damageEstimate,
    caseSummary,
    escalationPlan,
    metadata,
  };
}
