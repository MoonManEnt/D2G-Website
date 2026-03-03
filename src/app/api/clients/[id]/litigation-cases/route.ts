/**
 * LITIGATION CASES API
 *
 * GET  /api/clients/[id]/litigation-cases - List cases for client
 * POST /api/clients/[id]/litigation-cases - Create case from scan
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { SubscriptionTier } from "@/types";
import { createCase } from "@/lib/litigation-engine/case-manager";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createCaseSchema = z.object({
  scanId: z.string().uuid(),
});

// =============================================================================
// GET /api/clients/[id]/litigation-cases
// =============================================================================

export const GET = withAuth(async (req, ctx) => {
  try {
    const clientId = ctx.params.id;

    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: ctx.organizationId,
        isActive: true,
        archivedAt: null,
      },
      select: { id: true },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const cases = await prisma.litigationCase.findMany({
      where: { clientId, organizationId: ctx.organizationId },
      include: {
        defendants: { select: { id: true, name: true, type: true } },
        _count: { select: { actions: true, documents: true, deadlines: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, cases, count: cases.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list cases" },
      { status: 500 },
    );
  }
}, { minTier: SubscriptionTier.PROFESSIONAL });

// =============================================================================
// POST /api/clients/[id]/litigation-cases
// =============================================================================

export const POST = withAuth<z.infer<typeof createCaseSchema>>(async (req, ctx) => {
  try {
    const clientId = ctx.params.id;
    const { scanId } = ctx.body;

    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: ctx.organizationId,
        isActive: true,
        archivedAt: null,
      },
      select: { id: true },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const result = await createCase(
      scanId,
      clientId,
      ctx.organizationId,
      ctx.userId,
      ctx.session.user?.email || undefined,
    );

    // Load the created case with full data
    const litCase = await prisma.litigationCase.findUnique({
      where: { id: result.caseId },
      include: {
        defendants: true,
        actions: { orderBy: { sortOrder: "asc" } },
        deadlines: { orderBy: { dueDate: "asc" } },
      },
    });

    return NextResponse.json({ success: true, case: litCase }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create case" },
      { status: 500 },
    );
  }
}, { minTier: SubscriptionTier.PROFESSIONAL, schema: createCaseSchema });
