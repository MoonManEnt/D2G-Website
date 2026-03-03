/**
 * LITIGATION DEFENDANT API
 *
 * PATCH /api/clients/[id]/litigation-cases/[caseId]/defendants/[defId] - Update defendant
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { SubscriptionTier } from "@/types";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateDefendantSchema = z.object({
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  registeredAgent: z.string().optional(),
  registeredAgentAddress: z.string().optional(),
  served: z.boolean().optional(),
  servedAt: z.string().datetime().optional(),
  responseDeadline: z.string().datetime().optional(),
  respondedAt: z.string().datetime().optional(),
});

export const PATCH = withAuth<z.infer<typeof updateDefendantSchema>>(async (req, ctx) => {
  try {
    const { caseId, defId } = ctx.params;

    // Verify case belongs to org
    const litCase = await prisma.litigationCase.findFirst({
      where: { id: caseId, organizationId: ctx.organizationId },
    });

    if (!litCase) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    const { served, servedAt, responseDeadline, respondedAt, ...rest } = ctx.body;

    // Copy simple fields
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) updateData[key] = value;
    }

    // Handle date fields
    if (served !== undefined) updateData.served = served;
    if (servedAt) updateData.servedAt = new Date(servedAt);
    if (responseDeadline) updateData.responseDeadline = new Date(responseDeadline);
    if (respondedAt) updateData.respondedAt = new Date(respondedAt);

    const defendant = await prisma.litigationDefendant.update({
      where: { id: defId },
      data: updateData as Parameters<typeof prisma.litigationDefendant.update>[0]["data"],
    });

    return NextResponse.json({ success: true, defendant });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update defendant" },
      { status: 500 },
    );
  }
}, { minTier: SubscriptionTier.PROFESSIONAL, schema: updateDefendantSchema });
