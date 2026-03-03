/**
 * LITIGATION DOCUMENTS API
 *
 * GET  /api/clients/[id]/litigation-cases/[caseId]/documents - List documents
 * POST /api/clients/[id]/litigation-cases/[caseId]/documents - Generate document
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { SubscriptionTier } from "@/types";
import { generateLitigationDocument } from "@/lib/litigation-engine/document-generator";
import type { LitigationDocumentType } from "@/lib/litigation-engine/types";
import { z } from "zod";

export const dynamic = "force-dynamic";

const generateDocSchema = z.object({
  documentType: z.enum([
    "DEMAND_LETTER", "CFPB_COMPLAINT", "AG_COMPLAINT", "FTC_COMPLAINT",
    "INTENT_TO_SUE", "SMALL_CLAIMS_COMPLAINT", "FEDERAL_COMPLAINT", "SUMMONS",
    "INTERROGATORIES", "REQUEST_FOR_PRODUCTION", "REQUEST_FOR_ADMISSION", "SETTLEMENT_DEMAND",
  ]),
  targetDefendantId: z.string().uuid().optional(),
  actionId: z.string().uuid().optional(),
});

// =============================================================================
// GET
// =============================================================================

export const GET = withAuth(async (req, ctx) => {
  try {
    const { caseId } = ctx.params;

    const litCase = await prisma.litigationCase.findFirst({
      where: { id: caseId, organizationId: ctx.organizationId },
    });

    if (!litCase) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const documents = await prisma.litigationDocument.findMany({
      where: { caseId },
      include: { generatedFile: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, documents, count: documents.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list documents" },
      { status: 500 },
    );
  }
}, { minTier: SubscriptionTier.PROFESSIONAL });

// =============================================================================
// POST
// =============================================================================

export const POST = withAuth<z.infer<typeof generateDocSchema>>(async (req, ctx) => {
  try {
    const { caseId } = ctx.params;
    const { documentType, targetDefendantId, actionId } = ctx.body;

    const litCase = await prisma.litigationCase.findFirst({
      where: { id: caseId, organizationId: ctx.organizationId },
    });

    if (!litCase) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const result = await generateLitigationDocument(
      caseId,
      documentType as LitigationDocumentType,
      ctx.organizationId,
      targetDefendantId,
      actionId,
      ctx.userId,
      ctx.session.user?.email || undefined,
    );

    const document = await prisma.litigationDocument.findUnique({
      where: { id: result.documentId },
    });

    return NextResponse.json({ success: true, document }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate document" },
      { status: 500 },
    );
  }
}, { minTier: SubscriptionTier.PROFESSIONAL, schema: generateDocSchema });
