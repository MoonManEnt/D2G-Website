/**
 * LITIGATION DOCUMENT DETAIL API
 *
 * GET   /api/clients/[id]/litigation-cases/[caseId]/documents/[docId] - Get document
 * PATCH /api/clients/[id]/litigation-cases/[caseId]/documents/[docId] - Edit content/status
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { SubscriptionTier } from "@/types";
import { LITIGATION_EVENT_TYPES } from "@/lib/litigation-engine/types";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateDocSchema = z.object({
  content: z.string().optional(),
  title: z.string().optional(),
  approvalStatus: z.enum(["DRAFT", "PENDING_REVIEW", "APPROVED", "SENT", "FILED"]).optional(),
});

// =============================================================================
// GET
// =============================================================================

export const GET = withAuth(async (req, ctx) => {
  try {
    const { docId } = ctx.params;

    const document = await prisma.litigationDocument.findUnique({
      where: { id: docId },
      include: {
        generatedFile: true,
        case: { select: { organizationId: true, caseNumber: true } },
      },
    });

    if (!document || document.case.organizationId !== ctx.organizationId) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, document });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get document" },
      { status: 500 },
    );
  }
}, { minTier: SubscriptionTier.PROFESSIONAL });

// =============================================================================
// PATCH
// =============================================================================

export const PATCH = withAuth<z.infer<typeof updateDocSchema>>(async (req, ctx) => {
  try {
    const { docId } = ctx.params;
    const { content, title, approvalStatus } = ctx.body;

    const existing = await prisma.litigationDocument.findUnique({
      where: { id: docId },
      include: { case: { select: { organizationId: true } } },
    });

    if (!existing || existing.case.organizationId !== ctx.organizationId) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (content !== undefined) updateData.content = content;
    if (title !== undefined) updateData.title = title;
    if (approvalStatus !== undefined) updateData.approvalStatus = approvalStatus;

    const document = await prisma.litigationDocument.update({
      where: { id: docId },
      data: updateData as Parameters<typeof prisma.litigationDocument.update>[0]["data"],
    });

    // Log approval events
    if (approvalStatus === "APPROVED") {
      await prisma.eventLog.create({
        data: {
          eventType: LITIGATION_EVENT_TYPES.DOCUMENT_APPROVED,
          actorId: ctx.userId,
          actorEmail: ctx.session.user?.email,
          targetType: "LitigationDocument",
          targetId: docId,
          eventData: JSON.stringify({
            caseId: existing.caseId,
            documentType: existing.documentType,
          }),
          organizationId: ctx.organizationId,
        },
      });
    }

    return NextResponse.json({ success: true, document });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update document" },
      { status: 500 },
    );
  }
}, { minTier: SubscriptionTier.PROFESSIONAL, schema: updateDocSchema });
