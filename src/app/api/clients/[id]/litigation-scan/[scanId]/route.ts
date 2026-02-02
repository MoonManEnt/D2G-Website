/**
 * LITIGATION SCAN DETAIL API
 *
 * GET    /api/clients/[id]/litigation-scan/[scanId] - Get specific scan
 * DELETE /api/clients/[id]/litigation-scan/[scanId] - Delete scan
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

// =============================================================================
// HELPERS
// =============================================================================

function parseJSON<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// =============================================================================
// GET /api/clients/[id]/litigation-scan/[scanId]
// =============================================================================

export const GET = withAuth(async (req, ctx) => {
  try {
    const clientId = ctx.params.id;
    const scanId = ctx.params.scanId;

    const scan = await prisma.litigationScan.findFirst({
      where: {
        id: scanId,
        clientId,
        organizationId: ctx.organizationId,
      },
    });

    if (!scan) {
      return NextResponse.json(
        { error: "Scan not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      scan: {
        ...scan,
        violations: parseJSON(scan.violations, []),
        damageEstimate: parseJSON(scan.damageEstimate, {}),
        caseSummary: parseJSON(scan.caseSummary, {}),
        escalationPlan: parseJSON(scan.escalationPlan, {}),
      },
    });
  } catch (error) {
    console.error("Error fetching litigation scan:", error);
    return NextResponse.json(
      { error: "Failed to fetch litigation scan", code: "FETCH_ERROR" },
      { status: 500 }
    );
  }
});

// =============================================================================
// DELETE /api/clients/[id]/litigation-scan/[scanId]
// =============================================================================

export const DELETE = withAuth(async (req, ctx) => {
  try {
    const clientId = ctx.params.id;
    const scanId = ctx.params.scanId;

    const scan = await prisma.litigationScan.findFirst({
      where: {
        id: scanId,
        clientId,
        organizationId: ctx.organizationId,
      },
      select: { id: true },
    });

    if (!scan) {
      return NextResponse.json(
        { error: "Scan not found" },
        { status: 404 }
      );
    }

    await prisma.litigationScan.delete({
      where: { id: scanId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting litigation scan:", error);
    return NextResponse.json(
      { error: "Failed to delete litigation scan", code: "DELETE_ERROR" },
      { status: 500 }
    );
  }
});
