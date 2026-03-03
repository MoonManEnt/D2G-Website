/**
 * LITIGATION ACTION API
 *
 * PATCH /api/clients/[id]/litigation-cases/[caseId]/actions/[actionId] - Update action status
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { SubscriptionTier } from "@/types";
import { advanceToNextStage } from "@/lib/litigation-engine/case-manager";
import { LITIGATION_EVENT_TYPES } from "@/lib/litigation-engine/types";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateActionSchema = z.object({
  status: z.enum([
    "PENDING", "IN_PROGRESS", "DRAFT_READY", "REVIEW",
    "APPROVED", "SENT", "FILED", "COMPLETED", "SKIPPED",
  ]),
  deliveryMethod: z.enum(["MAIL", "EMAIL", "EFILING", "MANUAL"]).optional(),
  deliveryId: z.string().optional(),
});

export const PATCH = withAuth<z.infer<typeof updateActionSchema>>(async (req, ctx) => {
  try {
    const { caseId, actionId } = ctx.params;
    const { status, deliveryMethod, deliveryId } = ctx.body;

    // Verify case belongs to org
    const litCase = await prisma.litigationCase.findFirst({
      where: { id: caseId, organizationId: ctx.organizationId },
    });

    if (!litCase) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { status };
    if (deliveryMethod) updateData.deliveryMethod = deliveryMethod;
    if (deliveryId) updateData.deliveryId = deliveryId;
    if (status === "SENT" || status === "FILED") {
      updateData.deliveredAt = new Date();
    }

    const action = await prisma.litigationAction.update({
      where: { id: actionId },
      data: updateData as Parameters<typeof prisma.litigationAction.update>[0]["data"],
    });

    // Log event
    await prisma.eventLog.create({
      data: {
        eventType: LITIGATION_EVENT_TYPES.ACTION_COMPLETED,
        actorId: ctx.userId,
        actorEmail: ctx.session.user?.email,
        targetType: "LitigationAction",
        targetId: actionId,
        eventData: JSON.stringify({ caseId, status, actionType: action.actionType }),
        organizationId: ctx.organizationId,
      },
    });

    // Try to advance to next stage if action is completed
    if (status === "COMPLETED" || status === "SENT" || status === "FILED") {
      const advancement = await advanceToNextStage(caseId);
      return NextResponse.json({ success: true, action, advancement });
    }

    return NextResponse.json({ success: true, action });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update action" },
      { status: 500 },
    );
  }
}, { minTier: SubscriptionTier.PROFESSIONAL, schema: updateActionSchema });
