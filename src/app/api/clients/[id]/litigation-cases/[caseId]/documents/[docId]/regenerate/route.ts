/**
 * DOCUMENT REGENERATE API
 *
 * POST /api/clients/[id]/litigation-cases/[caseId]/documents/[docId]/regenerate
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { SubscriptionTier } from "@/types";
import { regenerateDocument } from "@/lib/litigation-engine/document-generator";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (req, ctx) => {
  try {
    const { docId } = ctx.params;

    const existing = await prisma.litigationDocument.findUnique({
      where: { id: docId },
      include: { case: { select: { organizationId: true } } },
    });

    if (!existing || existing.case.organizationId !== ctx.organizationId) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const result = await regenerateDocument(
      docId,
      ctx.organizationId,
      ctx.userId,
      ctx.session.user?.email || undefined,
    );

    const document = await prisma.litigationDocument.findUnique({
      where: { id: result.documentId },
    });

    return NextResponse.json({ success: true, document }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to regenerate document" },
      { status: 500 },
    );
  }
}, { minTier: SubscriptionTier.PROFESSIONAL });
