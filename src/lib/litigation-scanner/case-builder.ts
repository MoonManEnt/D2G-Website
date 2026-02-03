import type {
  LitigationViolation,
  DamageEstimate,
  CaseSummary,
  Defendant,
  CauseOfAction,
  CaseStrength,
  EscalationPlan,
  EscalationStep,
  EscalationStage,
  LitigationScanInput,
} from "./types";

// =============================================================================
// STATUTE DESCRIPTIONS
// =============================================================================

const STATUTE_DESCRIPTIONS: Record<string, string> = {
  "§1681e(b)":
    "Failure to assure maximum possible accuracy of consumer report",
  "§1681s-2(a)": "Furnisher duty to provide accurate information",
  "§1681s-2(a)(1)":
    "Prohibition on reporting information known to be inaccurate",
  "§1681s-2(a)(3)": "Duty to note consumer disputes",
  "§1681s-2(b)":
    "Furnisher duty to investigate after dispute notice",
  "§1681c":
    "Requirements relating to information contained in consumer reports (obsolete info)",
  "§1681c(c)":
    "Running of reporting period - date of first delinquency",
  "§1692e": "False or misleading representations",
  "§1692e(2)(A)":
    "False representation of the character, amount, or legal status of debt",
  "§1692e(5)": "Threat to take action that cannot legally be taken",
  "Metro 2 Format":
    "Credit Reporting Resource Guide (CRRG) compliance errors",
};

// =============================================================================
// ESCALATION STAGE ORDERING
// =============================================================================

const STAGE_ORDER: EscalationStage[] = [
  "DISPUTE_LETTER",
  "DIRECT_FURNISHER",
  "CFPB_COMPLAINT",
  "ATTORNEY_CONSULTATION",
  "LITIGATION",
];

const CRA_NAMES = new Set(["TRANSUNION", "EXPERIAN", "EQUIFAX"]);

const FDCPA_RULE_IDS = new Set([
  "COLLECTING_ON_PAID_DEBT",
  "WRONG_DEBT_AMOUNT",
  "TIME_BARRED_COLLECTION",
  "MULTIPLE_COLLECTORS_SAME_DEBT",
]);

// =============================================================================
// buildCaseSummary
// =============================================================================

export function buildCaseSummary(
  violations: LitigationViolation[],
  damageEstimate: DamageEstimate,
  input: LitigationScanInput
): CaseSummary {
  const strengthScore = calculateStrengthScore(violations, damageEstimate);
  const strengthLabel = scoreToLabel(strengthScore);
  const defendants = buildDefendants(violations);
  const causesOfAction = buildCausesOfAction(violations);
  const keyFindings = buildKeyFindings(violations, damageEstimate);
  const riskFactors = buildRiskFactors(violations, input);

  return {
    strengthScore,
    strengthLabel,
    defendants,
    causesOfAction,
    keyFindings,
    riskFactors,
  };
}

// =============================================================================
// STRENGTH SCORE
// =============================================================================

function calculateStrengthScore(
  violations: LitigationViolation[],
  damageEstimate: DamageEstimate
): number {
  // Factor 1: Number of violations (weight 25%)
  let violationCountScore: number;
  if (violations.length >= 11) {
    violationCountScore = 100;
  } else if (violations.length >= 6) {
    violationCountScore = 60;
  } else {
    violationCountScore = Math.max(0, violations.length * 10);
  }

  // Factor 2: Severity distribution (weight 30%)
  const severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const v of violations) {
    severityCounts[v.severity]++;
  }
  const total = violations.length || 1;
  const severityScore =
    ((severityCounts.CRITICAL * 100 +
      severityCounts.HIGH * 75 +
      severityCounts.MEDIUM * 40 +
      severityCounts.LOW * 15) /
      total);

  // Factor 3: Number of defendants (weight 15%)
  const uniqueDefendants = new Set(violations.flatMap((v) => v.defendants));
  let defendantScore: number;
  if (uniqueDefendants.size >= 5) {
    defendantScore = 100;
  } else if (uniqueDefendants.size >= 3) {
    defendantScore = 75;
  } else if (uniqueDefendants.size >= 1) {
    defendantScore = 50;
  } else {
    defendantScore = 0;
  }

  // Factor 4: Estimated damages (weight 20%)
  const avgDamage = (damageEstimate.totalMin + damageEstimate.totalMax) / 2;
  let damageScore: number;
  if (avgDamage >= 5000000) {
    // $50,000+
    damageScore = 100;
  } else if (avgDamage >= 2500000) {
    // $25,000+
    damageScore = 85;
  } else if (avgDamage >= 1000000) {
    // $10,000+
    damageScore = 70;
  } else if (avgDamage >= 500000) {
    // $5,000+
    damageScore = 50;
  } else if (avgDamage >= 100000) {
    // $1,000+
    damageScore = 30;
  } else {
    damageScore = 10;
  }

  // Factor 5: Cross-bureau evidence (weight 10%)
  const crossBureauCount = violations.filter((v) =>
    v.evidence.some((e) => e.type === "CROSS_BUREAU_DATA")
  ).length;
  const crossBureauScore =
    violations.length > 0
      ? Math.min(100, (crossBureauCount / total) * 100 + (crossBureauCount > 0 ? 20 : 0))
      : 0;

  const weighted =
    violationCountScore * 0.25 +
    severityScore * 0.3 +
    defendantScore * 0.15 +
    damageScore * 0.2 +
    crossBureauScore * 0.1;

  return Math.round(Math.min(100, Math.max(0, weighted)));
}

function scoreToLabel(score: number): CaseStrength {
  if (score >= 70) return "STRONG";
  if (score >= 40) return "MODERATE";
  return "WEAK";
}

// =============================================================================
// BUILD DEFENDANTS
// =============================================================================

function buildDefendants(violations: LitigationViolation[]): Defendant[] {
  const defendantMap = new Map<
    string,
    {
      name: string;
      type: "CRA" | "FURNISHER" | "COLLECTOR";
      violationCount: number;
      statutes: Set<string>;
      liabilityMin: number;
      liabilityMax: number;
    }
  >();

  for (const v of violations) {
    for (const name of v.defendants) {
      const normalized = name.toUpperCase();

      let type: "CRA" | "FURNISHER" | "COLLECTOR";
      if (CRA_NAMES.has(normalized)) {
        type = "CRA";
      } else if (FDCPA_RULE_IDS.has(v.ruleId)) {
        type = "COLLECTOR";
      } else {
        type = "FURNISHER";
      }

      const existing = defendantMap.get(normalized);
      if (existing) {
        existing.violationCount++;
        existing.statutes.add(v.statute);
        existing.liabilityMin += v.estimatedDamagesMin;
        existing.liabilityMax += v.estimatedDamagesMax;
      } else {
        defendantMap.set(normalized, {
          name,
          type,
          violationCount: 1,
          statutes: new Set([v.statute]),
          liabilityMin: v.estimatedDamagesMin,
          liabilityMax: v.estimatedDamagesMax,
        });
      }
    }
  }

  return Array.from(defendantMap.values()).map((d) => ({
    name: d.name,
    type: d.type,
    violationCount: d.violationCount,
    primaryStatutes: Array.from(d.statutes),
    estimatedLiabilityMin: d.liabilityMin,
    estimatedLiabilityMax: d.liabilityMax,
  }));
}

// =============================================================================
// BUILD CAUSES OF ACTION
// =============================================================================

function buildCausesOfAction(
  violations: LitigationViolation[]
): CauseOfAction[] {
  const statuteMap = new Map<
    string,
    {
      statute: string;
      shortName: string;
      violationCount: number;
      hasWillful: boolean;
    }
  >();

  for (const v of violations) {
    const existing = statuteMap.get(v.statute);
    const isHighSeverity =
      v.severity === "CRITICAL" || v.severity === "HIGH";

    if (existing) {
      existing.violationCount++;
      if (isHighSeverity) {
        existing.hasWillful = true;
      }
    } else {
      statuteMap.set(v.statute, {
        statute: v.statute,
        shortName: v.statuteShortName,
        violationCount: 1,
        hasWillful: isHighSeverity,
      });
    }
  }

  return Array.from(statuteMap.values()).map((s) => ({
    statute: s.statute,
    shortName: s.shortName,
    description:
      STATUTE_DESCRIPTIONS[s.statute] ??
      `Violation of ${s.statute}`,
    violationCount: s.violationCount,
    isWillful: s.hasWillful,
  }));
}

// =============================================================================
// KEY FINDINGS
// =============================================================================

function buildKeyFindings(
  violations: LitigationViolation[],
  damageEstimate: DamageEstimate
): string[] {
  const findings: string[] = [];

  // Total violations across creditors/bureaus
  const uniqueCreditors = new Set<string>();
  const uniqueBureaus = new Set<string>();
  for (const v of violations) {
    for (const acct of v.affectedAccounts) {
      uniqueCreditors.add(acct.creditorName.toUpperCase());
      uniqueBureaus.add(acct.cra.toUpperCase());
    }
  }
  if (violations.length > 0) {
    const entityParts: string[] = [];
    if (uniqueCreditors.size > 0) {
      entityParts.push(
        `${uniqueCreditors.size} creditor${uniqueCreditors.size !== 1 ? "s" : ""}`
      );
    }
    if (uniqueBureaus.size > 0) {
      entityParts.push(
        `${uniqueBureaus.size} bureau${uniqueBureaus.size !== 1 ? "s" : ""}`
      );
    }
    findings.push(
      `${violations.length} violations detected across ${entityParts.join("/")}`
    );
  }

  // Estimated damages
  if (damageEstimate.totalMin > 0 || damageEstimate.totalMax > 0) {
    const minDollars = formatDollars(damageEstimate.totalMin);
    const maxDollars = formatDollars(damageEstimate.totalMax);
    findings.push(`Estimated potential damages of ${minDollars}-${maxDollars}`);
  }

  // Critical violations
  const criticalCount = violations.filter(
    (v) => v.severity === "CRITICAL"
  ).length;
  if (criticalCount > 0) {
    findings.push(
      `${criticalCount} critical violation${criticalCount !== 1 ? "s" : ""} require${criticalCount === 1 ? "s" : ""} immediate attention`
    );
  }

  // Cross-bureau inconsistencies
  const crossBureauViolations = violations.filter((v) =>
    v.evidence.some((e) => e.type === "CROSS_BUREAU_DATA")
  );
  if (crossBureauViolations.length > 0) {
    const affectedFingerprints = new Set<string>();
    for (const v of crossBureauViolations) {
      for (const acct of v.affectedAccounts) {
        affectedFingerprints.add(acct.fingerprint);
      }
    }
    findings.push(
      `Cross-bureau inconsistencies found in ${affectedFingerprints.size} tradeline${affectedFingerprints.size !== 1 ? "s" : ""}`
    );
  }

  // Time-barred debt
  const timeBarredViolations = violations.filter(
    (v) => v.ruleId === "TIME_BARRED_COLLECTION"
  );
  if (timeBarredViolations.length > 0) {
    findings.push("Time-barred debt still being reported");
  }

  // Multiple collectors same debt
  const multiCollectorViolations = violations.filter(
    (v) => v.ruleId === "MULTIPLE_COLLECTORS_SAME_DEBT"
  );
  if (multiCollectorViolations.length > 0) {
    findings.push("Multiple collectors pursuing the same debt");
  }

  // Limit to 3-6 findings
  return findings.slice(0, 6);
}

function formatDollars(cents: number): string {
  const dollars = Math.round(cents / 100);
  return `$${dollars.toLocaleString("en-US")}`;
}

// =============================================================================
// RISK FACTORS
// =============================================================================

function buildRiskFactors(
  violations: LitigationViolation[],
  input: LitigationScanInput
): string[] {
  const factors: string[] = [];

  // Few violations
  if (violations.length > 0 && violations.length <= 3) {
    factors.push(
      "Limited number of violations may reduce litigation value"
    );
  }

  // Mostly low severity
  const lowCount = violations.filter((v) => v.severity === "LOW").length;
  if (violations.length > 0 && lowCount / violations.length > 0.5) {
    factors.push(
      "Most violations are low severity, reducing statutory damages"
    );
  }

  // No cross-bureau evidence
  const hasCrossBureau = violations.some((v) =>
    v.evidence.some((e) => e.type === "CROSS_BUREAU_DATA")
  );
  if (violations.length > 0 && !hasCrossBureau) {
    factors.push("Single-bureau evidence may be harder to prove");
  }

  // No dispute history
  if (input.disputes.length === 0) {
    factors.push("No prior dispute attempts documented");
  }

  // Always include this factor
  factors.push(
    "Damage estimates are approximate and may vary based on jurisdiction"
  );

  return factors;
}

// =============================================================================
// buildEscalationPlan
// =============================================================================

export function buildEscalationPlan(
  violations: LitigationViolation[],
  input: LitigationScanInput
): EscalationPlan {
  const currentStage = determineCurrentStage(input);
  const recommendedNextStage = determineRecommendedNextStage(
    violations,
    currentStage
  );

  const steps = buildSteps(currentStage, recommendedNextStage);

  return {
    currentStage,
    recommendedNextStage,
    steps,
  };
}

// =============================================================================
// DETERMINE CURRENT STAGE
// =============================================================================

function determineCurrentStage(input: LitigationScanInput): EscalationStage {
  const { disputes } = input;

  // No disputes sent at all
  if (disputes.length === 0) {
    return "DISPUTE_LETTER";
  }

  // Check if any disputes were sent
  const sentDisputes = disputes.filter((d) => d.sentDate !== null);
  if (sentDisputes.length === 0) {
    return "DISPUTE_LETTER";
  }

  // Check for disputes sent with no response after 30+ days
  const now = new Date();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const noResponseAfter30Days = sentDisputes.some((d) => {
    if (d.respondedAt !== null) return false;
    const sentDate = d.sentDate instanceof Date ? d.sentDate : new Date(d.sentDate as unknown as string);
    return now.getTime() - sentDate.getTime() >= thirtyDaysMs;
  });

  // Check for multiple rounds with no resolution
  const hasMultipleRounds = sentDisputes.length >= 2;
  const hasUnresolved = sentDisputes.some((d) =>
    d.items.some(
      (item) =>
        item.outcome === null ||
        item.outcome === "NO_CHANGE" ||
        item.outcome === "UNRESOLVED"
    )
  );

  if (hasMultipleRounds && hasUnresolved) {
    return "CFPB_COMPLAINT";
  }

  if (noResponseAfter30Days) {
    return "DIRECT_FURNISHER";
  }

  // Disputes sent but still in initial dispute phase
  return "DISPUTE_LETTER";
}

// =============================================================================
// DETERMINE RECOMMENDED NEXT STAGE
// =============================================================================

function determineRecommendedNextStage(
  violations: LitigationViolation[],
  currentStage: EscalationStage
): EscalationStage {
  const currentIndex = STAGE_ORDER.indexOf(currentStage);

  const hasCritical = violations.some((v) => v.severity === "CRITICAL");
  const hasHighOrCritical = violations.some(
    (v) => v.severity === "CRITICAL" || v.severity === "HIGH"
  );

  // Calculate total estimated damages (average of min/max across all violations)
  let totalDamagesMin = 0;
  let totalDamagesMax = 0;
  for (const v of violations) {
    totalDamagesMin += v.estimatedDamagesMin;
    totalDamagesMax += v.estimatedDamagesMax;
  }
  const avgDamage = (totalDamagesMin + totalDamagesMax) / 2;

  // If estimated damages > $25,000 (2500000 cents): LITIGATION
  if (avgDamage >= 2500000) {
    return "LITIGATION";
  }

  // If estimated damages > $10,000 (1000000 cents) and CRITICAL/HIGH violations: ATTORNEY_CONSULTATION
  if (avgDamage >= 1000000 && hasHighOrCritical) {
    const attyIndex = STAGE_ORDER.indexOf("ATTORNEY_CONSULTATION");
    if (attyIndex > currentIndex) {
      return "ATTORNEY_CONSULTATION";
    }
  }

  // If any CRITICAL violations and disputes already sent: at least CFPB_COMPLAINT
  if (hasCritical && currentIndex >= STAGE_ORDER.indexOf("DISPUTE_LETTER")) {
    const cfpbIndex = STAGE_ORDER.indexOf("CFPB_COMPLAINT");
    if (cfpbIndex > currentIndex) {
      return "CFPB_COMPLAINT";
    }
  }

  // Otherwise: one stage above current
  const nextIndex = Math.min(currentIndex + 1, STAGE_ORDER.length - 1);
  return STAGE_ORDER[nextIndex];
}

// =============================================================================
// BUILD STEPS
// =============================================================================

function buildSteps(
  currentStage: EscalationStage,
  recommendedNextStage: EscalationStage
): EscalationStep[] {
  const currentIndex = STAGE_ORDER.indexOf(currentStage);
  const recommendedIndex = STAGE_ORDER.indexOf(recommendedNextStage);

  const stepDefinitions: Array<{
    stage: EscalationStage;
    title: string;
    description: string;
    actions: string[];
  }> = [
    {
      stage: "DISPUTE_LETTER",
      title: "Send Dispute Letters",
      description:
        "Send formal dispute letters to all three credit bureaus citing specific violations and requesting investigation under FCRA §1681i",
      actions: [
        "Draft dispute letters with specific violation citations",
        "Send via certified mail with return receipt",
        "Document all violations with evidence",
      ],
    },
    {
      stage: "DIRECT_FURNISHER",
      title: "Contact Furnishers Directly",
      description:
        "Send direct disputes to data furnishers under FCRA §1681s-2(b), which triggers independent investigation obligations",
      actions: [
        "Identify furnisher addresses",
        "Send furnisher-specific dispute letters",
        "Include Metro 2 field references where applicable",
      ],
    },
    {
      stage: "CFPB_COMPLAINT",
      title: "File CFPB Complaint",
      description:
        "Submit formal complaint to the Consumer Financial Protection Bureau documenting all unresolved violations",
      actions: [
        "Compile all dispute history and responses",
        "Document each unresolved violation",
        "File online at consumerfinance.gov/complaint",
      ],
    },
    {
      stage: "ATTORNEY_CONSULTATION",
      title: "Consult Consumer Law Attorney",
      description:
        "Review case with an FCRA/FDCPA attorney to evaluate litigation potential based on documented violations",
      actions: [
        "Gather all documentation and dispute history",
        "Prepare violation summary with estimated damages",
        "Consult with NACA member attorney",
      ],
    },
    {
      stage: "LITIGATION",
      title: "File Lawsuit",
      description:
        "Initiate legal action in federal court under FCRA and/or FDCPA for willful noncompliance",
      actions: [
        "Attorney files complaint in federal court",
        "Seek statutory, actual, and punitive damages",
        "Request attorney fees and costs",
      ],
    },
  ];

  return stepDefinitions.map((def, index) => ({
    stage: def.stage,
    title: def.title,
    description: def.description,
    isCompleted: index < currentIndex,
    isCurrent: index === currentIndex,
    isRecommended: index === recommendedIndex,
    actions: def.actions,
  }));
}
