/**
 * LITIGATION CASE DETAIL API
 *
 * GET    /api/clients/[id]/litigation-cases/[caseId] - Get case with full data
 * PATCH  /api/clients/[id]/litigation-cases/[caseId] - Update status, notes, outcome
 * DELETE /api/clients/[id]/litigation-cases/[caseId] - Close/archive case
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { SubscriptionTier } from "@/types";
import { getCaseWithFullData, updateCaseStatus } from "@/lib/litigation-engine/case-manager";
import { z } from "zod";
import type { CaseStatus } from "@/lib/litigation-engine/types";

export const dynamic = "force-dynamic";

const updateCaseSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "SETTLED", "WON", "LOST", "DISMISSED", "CLOSED"]).optional(),
  notes: z.string().optional(),
  settlementAmount: z.number().optional(),
  awardedAmount: z.number().optional(),
  outcomeSummary: z.string().optional(),
});

// =============================================================================
// GET
// =============================================================================

export const GET = withAuth(async (req, ctx) => {
  try {
    const caseId = ctx.params.caseId;

    const litCase = await getCaseWithFullData(caseId);

    if (!litCase || litCase.organizationId !== ctx.organizationId) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    // Parse JSON fields from scan
    const scanData = litCase.scan
      ? {
          violations: JSON.parse(litCase.scan.violations),
          damageEstimate: JSON.parse(litCase.scan.damageEstimate),
          caseSummary: JSON.parse(litCase.scan.caseSummary),
          escalationPlan: JSON.parse(litCase.scan.escalationPlan),
        }
      : null;

    return NextResponse.json({
      success: true,
      case: {
        ...litCase,
        scan: litCase.scan
          ? {
              id: litCase.scan.id,
              totalViolations: litCase.scan.totalViolations,
              fcraViolations: litCase.scan.fcraViolations,
              fdcpaViolations: litCase.scan.fdcpaViolations,
              estimatedTotalMin: litCase.scan.estimatedTotalMin,
              estimatedTotalMax: litCase.scan.estimatedTotalMax,
              ...scanData,
            }
          : null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get case" },
      { status: 500 },
    );
  }
}, { minTier: SubscriptionTier.PROFESSIONAL });

// =============================================================================
// PATCH
// =============================================================================

export const PATCH = withAuth<z.infer<typeof updateCaseSchema>>(async (req, ctx) => {
  try {
    const caseId = ctx.params.caseId;
    const { status, notes, settlementAmount, awardedAmount, outcomeSummary } = ctx.body;

    // Verify case belongs to org
    const existing = await prisma.litigationCase.findFirst({
      where: { id: caseId, organizationId: ctx.organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    if (status) {
      await updateCaseStatus(
        caseId,
        status as CaseStatus,
        ctx.organizationId,
        ctx.userId,
        ctx.session.user?.email || undefined,
        { settlementAmount, awardedAmount, outcomeSummary },
      );
    }

    if (notes !== undefined) {
      await prisma.litigationCase.update({
        where: { id: caseId },
        data: { notes },
      });
    }

    const updated = await getCaseWithFullData(caseId);

    return NextResponse.json({ success: true, case: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update case" },
      { status: 500 },
    );
  }
}, { minTier: SubscriptionTier.PROFESSIONAL, schema: updateCaseSchema });

// =============================================================================
// DELETE
// =============================================================================

export const DELETE = withAuth(async (req, ctx) => {
  try {
    const caseId = ctx.params.caseId;

    const existing = await prisma.litigationCase.findFirst({
      where: { id: caseId, organizationId: ctx.organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    await updateCaseStatus(
      caseId,
      "CLOSED",
      ctx.organizationId,
      ctx.userId,
      ctx.session.user?.email || undefined,
      { outcomeSummary: "Case closed/archived by user" },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to close case" },
      { status: 500 },
    );
  }
}, { minTier: SubscriptionTier.PROFESSIONAL });
