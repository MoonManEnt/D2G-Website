/**
 * Litigation Case Manager
 *
 * Manages the full lifecycle of a litigation case:
 * - Creating cases from scan results
 * - Building action plans based on violations and jurisdiction
 * - Advancing cases through stages
 * - Calculating deadlines (SOL, response periods, filing)
 * - Updating case status with event logging
 */

import prisma from "@/lib/prisma";
import { resolveJurisdiction, recommendCourtType } from "./jurisdiction-resolver";
import {
  LITIGATION_STAGES,
  LITIGATION_EVENT_TYPES,
  type LitigationStage,
  type LitigationActionType,
  type LitigationDocumentType,
  type ActionPlanStep,
  type DefendantType,
  type DeliveryMethod,
  type TargetEntityType,
  type CaseStatus,
} from "./types";
import { createLogger } from "@/lib/logger";

const log = createLogger("litigation-case-manager");

// ============================================================================
// Case Number Generation
// ============================================================================

function generateCaseNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 900 + 100); // 100-999
  return `LIT-${dateStr}-${random}`;
}

// ============================================================================
// Create Case
// ============================================================================

/**
 * Create a new litigation case from a scan result.
 * Resolves jurisdiction, populates defendants, generates action plan, calculates deadlines.
 */
export async function createCase(
  scanId: string,
  clientId: string,
  organizationId: string,
  userId?: string,
  userEmail?: string,
): Promise<{ caseId: string; caseNumber: string }> {
  // Load scan with client
  const scan = await prisma.litigationScan.findUnique({
    where: { id: scanId },
    include: { client: true },
  });

  if (!scan) {
    throw new Error(`Scan not found: ${scanId}`);
  }

  if (scan.clientId !== clientId) {
    throw new Error("Scan does not belong to this client");
  }

  const client = scan.client;

  // Parse scan JSON data
  const caseSummary = JSON.parse(scan.caseSummary);
  const violations = JSON.parse(scan.violations);
  const damageEstimate = JSON.parse(scan.damageEstimate);

  // Resolve jurisdiction
  const clientState = client.state || "NY"; // fallback
  const hasFCRA = scan.fcraViolations > 0;
  const jurisdiction = resolveJurisdiction(
    clientState,
    client.zipCode || undefined,
    undefined,
    scan.estimatedTotalMax,
  );

  const courtType = recommendCourtType(
    scan.estimatedTotalMax,
    clientState,
    hasFCRA,
  );

  // Generate case number
  const caseNumber = generateCaseNumber();

  // Create the case
  const litigationCase = await prisma.litigationCase.create({
    data: {
      clientId,
      organizationId,
      scanId,
      caseNumber,
      status: "OPEN",
      currentStage: "DEMAND_LETTER",
      filingState: clientState,
      filingCounty: client.city || undefined, // approximate
      filingZipCode: client.zipCode || undefined,
      courtType: courtType,
      courtName: jurisdiction.federalDistrict.name,
      courtAddress: jurisdiction.federalDistrict.courtAddress,
      courtDistrict: jurisdiction.federalDistrict.shortName,
      strengthScore: caseSummary.strengthScore || 0,
      strengthLabel: caseSummary.strengthLabel || "WEAK",
      totalViolations: scan.totalViolations,
      estimatedDamagesMin: scan.estimatedTotalMin,
      estimatedDamagesMax: scan.estimatedTotalMax,
    },
  });

  // Create defendants from scan's caseSummary.defendants
  const defendants: Array<{ id: string; name: string; type: string }> = [];
  if (caseSummary.defendants && Array.isArray(caseSummary.defendants)) {
    for (const def of caseSummary.defendants) {
      const defendant = await prisma.litigationDefendant.create({
        data: {
          caseId: litigationCase.id,
          name: def.name,
          type: def.type || "FURNISHER",
          violationCount: def.violationCount || 0,
          estimatedLiabilityMin: def.estimatedLiabilityMin || def.estimatedLiability?.min || 0,
          estimatedLiabilityMax: def.estimatedLiabilityMax || def.estimatedLiability?.max || 0,
          primaryStatutes: JSON.stringify(def.primaryStatutes || []),
        },
      });
      defendants.push({ id: defendant.id, name: defendant.name, type: defendant.type });
    }
  }

  // Build and save action plan
  const actionPlan = buildActionPlanSteps(
    caseSummary,
    violations,
    damageEstimate,
    defendants,
    clientState,
    courtType,
    jurisdiction.smallClaims.limit,
  );

  for (const step of actionPlan) {
    const targetDef = step.targetDefendantName
      ? defendants.find((d) => d.name === step.targetDefendantName)
      : undefined;

    await prisma.litigationAction.create({
      data: {
        caseId: litigationCase.id,
        stage: step.stage,
        actionType: step.actionType,
        status: step.stage === "DEMAND_LETTER" ? "PENDING" : "PENDING",
        sortOrder: step.sortOrder,
        targetDefendantId: targetDef?.id,
        targetEntityName: step.targetEntityName || step.targetDefendantName,
        targetEntityType: step.targetEntityType || targetDef?.type,
        deliveryMethod: step.deliveryMethod,
      },
    });
  }

  // Calculate and save deadlines
  await calculateDeadlines(litigationCase.id, clientState, violations);

  // Log event
  await prisma.eventLog.create({
    data: {
      eventType: LITIGATION_EVENT_TYPES.CASE_CREATED,
      actorId: userId,
      actorEmail: userEmail,
      targetType: "LitigationCase",
      targetId: litigationCase.id,
      eventData: JSON.stringify({
        caseNumber,
        clientId,
        scanId,
        totalViolations: scan.totalViolations,
        estimatedDamagesMin: scan.estimatedTotalMin,
        estimatedDamagesMax: scan.estimatedTotalMax,
        courtType,
        filingState: clientState,
      }),
      organizationId,
    },
  });

  return { caseId: litigationCase.id, caseNumber };
}

// ============================================================================
// Build Action Plan
// ============================================================================

/**
 * Generate ordered action plan steps based on case data.
 * Adapts to violation severity, damages, dispute history, and state requirements.
 */
function buildActionPlanSteps(
  caseSummary: Record<string, unknown>,
  violations: Array<Record<string, unknown>>,
  damageEstimate: Record<string, unknown>,
  defendants: Array<{ id: string; name: string; type: string }>,
  state: string,
  courtType: string,
  smallClaimsLimit: number,
): ActionPlanStep[] {
  const steps: ActionPlanStep[] = [];
  let sortOrder = 0;

  const totalDamagesMax = (damageEstimate as { totalMax?: number }).totalMax || 0;
  const hasCritical = violations.some((v) => v.severity === "CRITICAL");
  const hasFCRA = violations.some((v) => v.category === "FCRA");
  const hasFDCPA = violations.some((v) => v.category === "FDCPA");

  // Stage 1: Demand Letters — one per defendant
  for (const def of defendants) {
    steps.push({
      stage: "DEMAND_LETTER",
      actionType: "DEMAND_LETTER",
      targetDefendantName: def.name,
      targetDefendantType: def.type as DefendantType,
      targetEntityName: def.name,
      targetEntityType: def.type as TargetEntityType,
      description: `Send demand letter to ${def.name} citing violations and requesting resolution within 30 days.`,
      documentType: "DEMAND_LETTER",
      deliveryMethod: "MAIL",
      sortOrder: sortOrder++,
    });
  }

  // Stage 2: CFPB Complaint — for CRAs and furnishers
  const craDefendants = defendants.filter((d) => d.type === "CRA");
  if (craDefendants.length > 0) {
    for (const cra of craDefendants) {
      steps.push({
        stage: "CFPB_COMPLAINT",
        actionType: "CFPB_COMPLAINT",
        targetDefendantName: cra.name,
        targetDefendantType: "CRA",
        targetEntityName: "Consumer Financial Protection Bureau",
        targetEntityType: "AGENCY",
        description: `File CFPB complaint against ${cra.name} for failure to ensure accuracy.`,
        documentType: "CFPB_COMPLAINT",
        deliveryMethod: "MANUAL",
        sortOrder: sortOrder++,
      });
    }
  }

  // Stage 3: AG Complaint
  steps.push({
    stage: "AG_COMPLAINT",
    actionType: "AG_COMPLAINT",
    targetEntityName: `${state} Attorney General`,
    targetEntityType: "AGENCY",
    description: `File consumer complaint with the ${state} Attorney General's consumer protection division.`,
    documentType: "AG_COMPLAINT",
    deliveryMethod: "MAIL",
    sortOrder: sortOrder++,
  });

  // Stage 4: FTC Complaint (if FDCPA violations)
  if (hasFDCPA) {
    steps.push({
      stage: "FTC_COMPLAINT",
      actionType: "FTC_COMPLAINT",
      targetEntityName: "Federal Trade Commission",
      targetEntityType: "AGENCY",
      description: "File FTC complaint documenting FDCPA violations by debt collectors.",
      documentType: "FTC_COMPLAINT",
      deliveryMethod: "MANUAL",
      sortOrder: sortOrder++,
    });
  }

  // Stage 5: Intent to Sue — one per defendant
  for (const def of defendants) {
    steps.push({
      stage: "INTENT_TO_SUE",
      actionType: "INTENT_TO_SUE",
      targetDefendantName: def.name,
      targetDefendantType: def.type as DefendantType,
      targetEntityName: def.name,
      targetEntityType: def.type as TargetEntityType,
      description: `Send formal notice of intent to sue to ${def.name} with 15-day deadline.`,
      documentType: "INTENT_TO_SUE",
      deliveryMethod: "MAIL",
      sortOrder: sortOrder++,
    });
  }

  // Stage 6: Filing — choose small claims or federal based on court type
  if (courtType === "SMALL_CLAIMS" && totalDamagesMax <= smallClaimsLimit) {
    steps.push({
      stage: "SMALL_CLAIMS",
      actionType: "SMALL_CLAIMS_FILING",
      targetEntityName: "Small Claims Court",
      targetEntityType: "COURT",
      description: "File small claims court complaint seeking damages for FCRA/FDCPA violations.",
      documentType: "SMALL_CLAIMS_COMPLAINT",
      deliveryMethod: "MANUAL",
      sortOrder: sortOrder++,
    });
  } else {
    steps.push({
      stage: "FEDERAL_COMPLAINT",
      actionType: "FEDERAL_COMPLAINT",
      targetEntityName: "Federal District Court",
      targetEntityType: "COURT",
      description: "File federal complaint in U.S. District Court under FCRA/FDCPA.",
      documentType: "FEDERAL_COMPLAINT",
      deliveryMethod: "EFILING",
      sortOrder: sortOrder++,
    });

    // Summons per defendant
    for (const def of defendants) {
      steps.push({
        stage: "FEDERAL_COMPLAINT",
        actionType: "SUMMONS",
        targetDefendantName: def.name,
        targetDefendantType: def.type as DefendantType,
        targetEntityName: def.name,
        targetEntityType: def.type as TargetEntityType,
        description: `Issue and serve summons to ${def.name}.`,
        documentType: "SUMMONS",
        deliveryMethod: "MAIL",
        sortOrder: sortOrder++,
      });
    }
  }

  // Stage 7: Discovery (only for federal/state, not small claims)
  if (courtType !== "SMALL_CLAIMS") {
    steps.push({
      stage: "DISCOVERY",
      actionType: "DISCOVERY_REQUEST",
      description: "Serve interrogatories, requests for production, and requests for admission on all defendants.",
      documentType: "INTERROGATORIES",
      deliveryMethod: "MAIL",
      sortOrder: sortOrder++,
    });
  }

  // Stage 8: Settlement Demand
  steps.push({
    stage: "SETTLEMENT",
    actionType: "SETTLEMENT_DEMAND",
    description: "Send formal settlement demand with specific terms, amounts, and deadline.",
    documentType: "SETTLEMENT_DEMAND",
    deliveryMethod: "MAIL",
    sortOrder: sortOrder++,
  });

  return steps;
}

// ============================================================================
// Calculate Deadlines
// ============================================================================

/**
 * Calculate important deadlines for a case based on state SOL and case data.
 */
async function calculateDeadlines(
  caseId: string,
  state: string,
  violations: Array<Record<string, unknown>>,
): Promise<void> {
  const now = new Date();

  // SOL expiry deadline — find earliest time-barred risk
  // Use 2 years as default FCRA SOL from discovery of violation
  const fcraSolExpiry = new Date(now);
  fcraSolExpiry.setFullYear(fcraSolExpiry.getFullYear() + 2);

  await prisma.litigationDeadline.create({
    data: {
      caseId,
      title: "FCRA Statute of Limitations",
      description: "FCRA allows suits within 2 years of discovery of violation or 5 years after violation occurred, whichever is earlier (15 USC 1681p).",
      deadlineType: "SOL_EXPIRY",
      dueDate: fcraSolExpiry,
      status: "UPCOMING",
    },
  });

  // Demand letter response deadline (30 days from now)
  const demandDeadline = new Date(now);
  demandDeadline.setDate(demandDeadline.getDate() + 30);

  await prisma.litigationDeadline.create({
    data: {
      caseId,
      title: "Demand Letter Response Deadline",
      description: "30-day deadline for defendants to respond to demand letter before escalation.",
      deadlineType: "RESPONSE",
      dueDate: demandDeadline,
      status: "UPCOMING",
    },
  });

  // CFPB response timeline (60 days typical)
  const cfpbDeadline = new Date(now);
  cfpbDeadline.setDate(cfpbDeadline.getDate() + 60);

  await prisma.litigationDeadline.create({
    data: {
      caseId,
      title: "CFPB Company Response Period",
      description: "Companies typically have 15-60 days to respond to CFPB complaints.",
      deadlineType: "RESPONSE",
      dueDate: cfpbDeadline,
      status: "UPCOMING",
    },
  });

  // Federal complaint response deadline (21 days after service per FRCP 12)
  const responseDeadline = new Date(now);
  responseDeadline.setDate(responseDeadline.getDate() + 90); // estimate: ~60 days to file + 21 days response

  await prisma.litigationDeadline.create({
    data: {
      caseId,
      title: "Defendant Response to Complaint",
      description: "Defendant has 21 days to answer or respond to the complaint after service (FRCP 12(a)).",
      deadlineType: "RESPONSE",
      dueDate: responseDeadline,
      status: "UPCOMING",
    },
  });
}

// ============================================================================
// Advance Stage
// ============================================================================

/**
 * Advance a case to the next stage when current stage actions are complete.
 */
export async function advanceToNextStage(caseId: string): Promise<{ newStage: string; advanced: boolean }> {
  const litCase = await prisma.litigationCase.findUnique({
    where: { id: caseId },
    include: { actions: true },
  });

  if (!litCase) {
    throw new Error(`Case not found: ${caseId}`);
  }

  const currentStage = litCase.currentStage as LitigationStage;
  const currentStageActions = litCase.actions.filter((a) => a.stage === currentStage);

  // Check if all current stage actions are completed or skipped
  const allDone = currentStageActions.every(
    (a) => a.status === "COMPLETED" || a.status === "SKIPPED" || a.status === "SENT" || a.status === "FILED",
  );

  if (!allDone) {
    return { newStage: currentStage, advanced: false };
  }

  // Find next stage
  const currentIndex = LITIGATION_STAGES.indexOf(currentStage);
  if (currentIndex === -1 || currentIndex >= LITIGATION_STAGES.length - 1) {
    return { newStage: currentStage, advanced: false };
  }

  // Find the next stage that has actions
  let nextStage: LitigationStage | null = null;
  for (let i = currentIndex + 1; i < LITIGATION_STAGES.length; i++) {
    const stage = LITIGATION_STAGES[i];
    const stageActions = litCase.actions.filter((a) => a.stage === stage);
    if (stageActions.length > 0) {
      nextStage = stage;
      break;
    }
  }

  if (!nextStage) {
    return { newStage: currentStage, advanced: false };
  }

  await prisma.litigationCase.update({
    where: { id: caseId },
    data: {
      currentStage: nextStage,
      status: "IN_PROGRESS",
    },
  });

  return { newStage: nextStage, advanced: true };
}

// ============================================================================
// Update Case Status
// ============================================================================

/**
 * Update case status with event logging.
 */
export async function updateCaseStatus(
  caseId: string,
  status: CaseStatus,
  organizationId: string,
  userId?: string,
  userEmail?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const updateData: Record<string, unknown> = { status };

  // Set timestamps based on status
  if (status === "SETTLED") {
    updateData.settledAt = new Date();
    if (metadata?.settlementAmount) {
      updateData.settlementAmount = metadata.settlementAmount;
    }
  } else if (status === "WON") {
    updateData.closedAt = new Date();
    if (metadata?.awardedAmount) {
      updateData.awardedAmount = metadata.awardedAmount;
    }
  } else if (status === "CLOSED" || status === "DISMISSED" || status === "LOST") {
    updateData.closedAt = new Date();
  }

  if (metadata?.outcomeSummary) {
    updateData.outcomeSummary = metadata.outcomeSummary;
  }

  await prisma.litigationCase.update({
    where: { id: caseId },
    data: updateData as Parameters<typeof prisma.litigationCase.update>[0]["data"],
  });

  // Log event
  await prisma.eventLog.create({
    data: {
      eventType: LITIGATION_EVENT_TYPES.CASE_STATUS_CHANGED,
      actorId: userId,
      actorEmail: userEmail,
      targetType: "LitigationCase",
      targetId: caseId,
      eventData: JSON.stringify({ status, ...metadata }),
      organizationId,
    },
  });
}

// ============================================================================
// Get Case with Full Data
// ============================================================================

/**
 * Load a case with all related data for the dashboard.
 */
export async function getCaseWithFullData(caseId: string) {
  return prisma.litigationCase.findUnique({
    where: { id: caseId },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          zipCode: true,
          ssnLast4: true,
          dateOfBirth: true,
        },
      },
      scan: true,
      defendants: {
        orderBy: { createdAt: "asc" },
      },
      actions: {
        orderBy: { sortOrder: "asc" },
        include: {
          targetDefendant: true,
          document: true,
        },
      },
      documents: {
        orderBy: { createdAt: "desc" },
        include: {
          generatedFile: true,
        },
      },
      deadlines: {
        orderBy: { dueDate: "asc" },
      },
    },
  });
}
