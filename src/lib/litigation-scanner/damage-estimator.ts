/**
 * Damage Estimator
 *
 * Calculates potential damages from FCRA/FDCPA violations detected by the
 * litigation scanner. All monetary amounts are in CENTS.
 *
 * DISCLAIMER: These estimates are informational only and do not constitute
 * legal advice. Actual damages vary based on jurisdiction, judge, jury, and
 * the specific facts of each case.
 */

import type {
  LitigationViolation,
  DamageEstimate,
  DamageBreakdown,
  DefendantDamage,
} from "./types";

// =============================================================================
// CONSTANTS (all in cents)
// =============================================================================

const CRA_NAMES = ["TRANSUNION", "EXPERIAN", "EQUIFAX"] as const;

/** FCRA statutory damages per violation by severity */
const FCRA_STATUTORY = {
  CRITICAL: { min: 500_00, max: 1_000_00 },
  HIGH: { min: 100_00, max: 500_00 },
  MEDIUM: { min: 0, max: 100_00 },
  LOW: { min: 0, max: 0 },
} as const;

/** FDCPA statutory damages — capped per case, not per violation */
const FDCPA_STATUTORY_MAX = 1_000_00;

/** Actual damages: estimated credit-score impact dollars per point */
const SCORE_IMPACT_PER_POINT = { min: 100_00, max: 200_00 } as const;

/** Estimated score-point impact per severity level */
const SCORE_POINT_IMPACT = {
  CRITICAL: { min: 10, max: 50 },
  HIGH: { min: 5, max: 15 },
  MEDIUM: { min: 0, max: 0 },
  LOW: { min: 0, max: 0 },
} as const;

/** Punitive damages multiplier range (applied to statutory) */
const PUNITIVE_MULTIPLIER = { min: 1, max: 3 } as const;

/** Minimum willful violations needed to claim punitive damages (pattern) */
const PUNITIVE_MIN_VIOLATIONS = 3;

/** Attorney fee estimates */
const ATTORNEY_RATE = { min: 300_00, max: 500_00 } as const; // per hour
const ATTORNEY_HOURS = { min: 20, max: 40 } as const;

/** Minimum total violations to justify attorney fee inclusion */
const ATTORNEY_MIN_VIOLATIONS = 2;

/** Court costs (flat estimate) */
const COURT_COSTS = { min: 400_00, max: 600_00 } as const;

// =============================================================================
// HELPERS
// =============================================================================

function isCRA(name: string): boolean {
  const upper = name.toUpperCase();
  return CRA_NAMES.some((cra) => upper.includes(cra));
}

function isCollector(violation: LitigationViolation): boolean {
  const collectionRules = new Set([
    "COLLECTING_ON_PAID_DEBT",
    "WRONG_DEBT_AMOUNT",
    "TIME_BARRED_COLLECTION",
    "MULTIPLE_COLLECTORS_SAME_DEBT",
  ]);
  return collectionRules.has(violation.ruleId);
}

function classifyDefendant(
  name: string,
  violations: LitigationViolation[]
): "CRA" | "FURNISHER" | "COLLECTOR" {
  if (isCRA(name)) return "CRA";

  // If any violation tied to this defendant is collection-related, tag as COLLECTOR
  const hasCollectionViolation = violations.some(
    (v) => v.defendants.includes(name) && isCollector(v)
  );
  if (hasCollectionViolation) return "COLLECTOR";

  return "FURNISHER";
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

export function estimateDamages(
  violations: LitigationViolation[]
): DamageEstimate {
  // No violations — return zeroed-out estimate
  if (violations.length === 0) {
    return {
      totalMin: 0,
      totalMax: 0,
      breakdown: [],
      perDefendant: [],
    };
  }

  // -------------------------------------------------------------------------
  // 1. Group violations by category
  // -------------------------------------------------------------------------
  const fcraViolations = violations.filter((v) => v.category === "FCRA");
  const fdcpaViolations = violations.filter((v) => v.category === "FDCPA");
  // METRO2 violations don't carry standalone statutory damages but are counted

  const totalViolationCount = violations.length;

  // -------------------------------------------------------------------------
  // 2. Statutory damages
  // -------------------------------------------------------------------------
  let statutoryMin = 0;
  let statutoryMax = 0;

  // FCRA: per-violation statutory damages
  for (const v of fcraViolations) {
    const range = FCRA_STATUTORY[v.severity];
    statutoryMin += range.min;
    statutoryMax += range.max;
  }

  // FDCPA: capped at $1,000 per case (not per violation)
  if (fdcpaViolations.length > 0) {
    // Min: proportional to severity of worst FDCPA violation
    const worstFdcpa = fdcpaViolations.reduce((worst, v) => {
      const order: Record<string, number> = {
        CRITICAL: 4,
        HIGH: 3,
        MEDIUM: 2,
        LOW: 1,
      };
      return (order[v.severity] ?? 0) > (order[worst.severity] ?? 0)
        ? v
        : worst;
    }, fdcpaViolations[0]);

    const fdcpaMinMap: Record<string, number> = {
      CRITICAL: 750_00,
      HIGH: 500_00,
      MEDIUM: 250_00,
      LOW: 0,
    };

    statutoryMin += fdcpaMinMap[worstFdcpa.severity] ?? 0;
    statutoryMax += FDCPA_STATUTORY_MAX;
  }

  // -------------------------------------------------------------------------
  // 3. Actual damages (credit score impact)
  // -------------------------------------------------------------------------
  let actualMin = 0;
  let actualMax = 0;

  for (const v of violations) {
    const pointImpact = SCORE_POINT_IMPACT[v.severity];
    actualMin += pointImpact.min * SCORE_IMPACT_PER_POINT.min;
    actualMax += pointImpact.max * SCORE_IMPACT_PER_POINT.max;
  }

  // -------------------------------------------------------------------------
  // 4. Punitive damages
  // -------------------------------------------------------------------------
  let punitiveMin = 0;
  let punitiveMax = 0;

  const willfulViolations = violations.filter(
    (v) => v.severity === "CRITICAL" || v.severity === "HIGH"
  );

  if (willfulViolations.length >= PUNITIVE_MIN_VIOLATIONS) {
    // Punitive is a multiplier of the statutory damages from willful violations only
    let willfulStatutoryMin = 0;
    let willfulStatutoryMax = 0;

    for (const v of willfulViolations) {
      if (v.category === "FCRA") {
        const range = FCRA_STATUTORY[v.severity];
        willfulStatutoryMin += range.min;
        willfulStatutoryMax += range.max;
      }
    }

    // Include FDCPA statutory in punitive base if FDCPA violations are willful
    const willfulFdcpa = fdcpaViolations.filter(
      (v) => v.severity === "CRITICAL" || v.severity === "HIGH"
    );
    if (willfulFdcpa.length > 0) {
      const fdcpaMinMap: Record<string, number> = {
        CRITICAL: 750_00,
        HIGH: 500_00,
      };
      const worstWillfulFdcpa = willfulFdcpa.reduce((worst, v) => {
        const order: Record<string, number> = { CRITICAL: 4, HIGH: 3 };
        return (order[v.severity] ?? 0) > (order[worst.severity] ?? 0)
          ? v
          : worst;
      }, willfulFdcpa[0]);

      willfulStatutoryMin += fdcpaMinMap[worstWillfulFdcpa.severity] ?? 0;
      willfulStatutoryMax += FDCPA_STATUTORY_MAX;
    }

    punitiveMin = willfulStatutoryMin * PUNITIVE_MULTIPLIER.min;
    punitiveMax = willfulStatutoryMax * PUNITIVE_MULTIPLIER.max;
  }

  // -------------------------------------------------------------------------
  // 5. Attorney fees
  // -------------------------------------------------------------------------
  let attorneyMin = 0;
  let attorneyMax = 0;

  if (totalViolationCount >= ATTORNEY_MIN_VIOLATIONS) {
    attorneyMin = ATTORNEY_RATE.min * ATTORNEY_HOURS.min;
    attorneyMax = ATTORNEY_RATE.max * ATTORNEY_HOURS.max;
  }

  // -------------------------------------------------------------------------
  // 6. Court costs
  // -------------------------------------------------------------------------
  const courtCostsMin = COURT_COSTS.min;
  const courtCostsMax = COURT_COSTS.max;

  // -------------------------------------------------------------------------
  // Build breakdown
  // -------------------------------------------------------------------------
  const breakdown: DamageBreakdown[] = [];

  if (statutoryMin > 0 || statutoryMax > 0) {
    breakdown.push({
      type: "STATUTORY",
      label: "Statutory Damages",
      min: statutoryMin,
      max: statutoryMax,
      description:
        "FCRA \u00A71681n/\u00A71681o and FDCPA statutory damages based on violation severity and willfulness.",
    });
  }

  if (actualMin > 0 || actualMax > 0) {
    breakdown.push({
      type: "ACTUAL",
      label: "Actual Damages",
      min: actualMin,
      max: actualMax,
      description:
        "Estimated damages from credit score impact, including higher interest rates, denied applications, and emotional distress.",
    });
  }

  if (punitiveMin > 0 || punitiveMax > 0) {
    breakdown.push({
      type: "PUNITIVE",
      label: "Punitive Damages",
      min: punitiveMin,
      max: punitiveMax,
      description:
        "Punitive damages for willful violations demonstrating a pattern of behavior (1x-3x statutory).",
    });
  }

  if (attorneyMin > 0 || attorneyMax > 0) {
    breakdown.push({
      type: "ATTORNEY_FEES",
      label: "Attorney Fees",
      min: attorneyMin,
      max: attorneyMax,
      description:
        "Estimated attorney fees recoverable under FCRA/FDCPA fee-shifting provisions.",
    });
  }

  breakdown.push({
    type: "COURT_COSTS",
    label: "Court Costs",
    min: courtCostsMin,
    max: courtCostsMax,
    description: "Filing fees, service costs, and other court-related expenses.",
  });

  // -------------------------------------------------------------------------
  // 7. Per-defendant breakdown
  // -------------------------------------------------------------------------
  const defendantMap = new Map<
    string,
    { violations: LitigationViolation[]; count: number }
  >();

  for (const v of violations) {
    for (const defendant of v.defendants) {
      const existing = defendantMap.get(defendant);
      if (existing) {
        existing.violations.push(v);
        existing.count += 1;
      } else {
        defendantMap.set(defendant, { violations: [v], count: 1 });
      }
    }
  }

  const perDefendant: DefendantDamage[] = [];

  for (const [name, data] of defendantMap) {
    let defMin = 0;
    let defMax = 0;

    for (const v of data.violations) {
      // Statutory portion per defendant
      if (v.category === "FCRA") {
        const range = FCRA_STATUTORY[v.severity];
        defMin += range.min;
        defMax += range.max;
      }

      // Actual damages portion per defendant
      const pointImpact = SCORE_POINT_IMPACT[v.severity];
      defMin += pointImpact.min * SCORE_IMPACT_PER_POINT.min;
      defMax += pointImpact.max * SCORE_IMPACT_PER_POINT.max;
    }

    // FDCPA cap applied per defendant
    const defFdcpa = data.violations.filter((v) => v.category === "FDCPA");
    if (defFdcpa.length > 0) {
      const worstFdcpa = defFdcpa.reduce((worst, v) => {
        const order: Record<string, number> = {
          CRITICAL: 4,
          HIGH: 3,
          MEDIUM: 2,
          LOW: 1,
        };
        return (order[v.severity] ?? 0) > (order[worst.severity] ?? 0)
          ? v
          : worst;
      }, defFdcpa[0]);

      const fdcpaMinMap: Record<string, number> = {
        CRITICAL: 750_00,
        HIGH: 500_00,
        MEDIUM: 250_00,
        LOW: 0,
      };

      defMin += fdcpaMinMap[worstFdcpa.severity] ?? 0;
      defMax += FDCPA_STATUTORY_MAX;
    }

    perDefendant.push({
      name,
      type: classifyDefendant(name, violations),
      violationCount: data.count,
      estimatedMin: defMin,
      estimatedMax: defMax,
    });
  }

  // Sort defendants by max estimated damages descending
  perDefendant.sort((a, b) => b.estimatedMax - a.estimatedMax);

  // -------------------------------------------------------------------------
  // 8. Totals
  // -------------------------------------------------------------------------
  const totalMin = breakdown.reduce((sum, b) => sum + b.min, 0);
  const totalMax = breakdown.reduce((sum, b) => sum + b.max, 0);

  return {
    totalMin,
    totalMax,
    breakdown,
    perDefendant,
  };
}
