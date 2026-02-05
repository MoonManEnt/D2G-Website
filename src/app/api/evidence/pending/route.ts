/**
 * PENDING EVIDENCE API
 *
 * GET /api/evidence/pending - List pending evidence for capture
 * PATCH /api/evidence/pending - Update pending evidence status
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
const log = createLogger("evidence-pending-api");

export const dynamic = "force-dynamic";

// =============================================================================
// GET /api/evidence/pending - List pending evidence
// =============================================================================

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    const reportId = searchParams.get("reportId");
    const status = searchParams.get("status") || "PENDING";

    // Build query — only include pending evidence for active (non-deleted) clients
    const where: any = {
      organizationId: session.user.organizationId,
      status,
      accountItem: {
        client: { isActive: true, archivedAt: null },
      },
    };

    if (clientId) {
      where.accountItem.clientId = clientId;
    }

    if (reportId) {
      where.reportId = reportId;
    }

    const pendingItems = await prisma.pendingEvidence.findMany({
      where,
      include: {
        accountItem: {
          select: {
            id: true,
            creditorName: true,
            maskedAccountId: true,
            cra: true,
            accountStatus: true,
            balance: true,
            detectedIssues: true,
            issueCount: true,
            sourcePageNum: true,
            clientId: true,
            client: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        report: {
          select: {
            id: true,
            reportDate: true,
            parseStatus: true,
            originalFileId: true,
          },
        },
      },
      orderBy: [
        { accountItem: { issueCount: "desc" } },
        { createdAt: "desc" },
      ],
    });

    // Group by client for better organization
    const byClient = pendingItems.reduce((acc, item) => {
      const clientId = item.accountItem.clientId;
      const clientName = `${item.accountItem.client.firstName} ${item.accountItem.client.lastName}`;

      if (!acc[clientId]) {
        acc[clientId] = {
          clientId,
          clientName,
          items: [],
        };
      }
      acc[clientId].items.push(item);
      return acc;
    }, {} as Record<string, { clientId: string; clientName: string; items: typeof pendingItems }>);

    return NextResponse.json({
      success: true,
      total: pendingItems.length,
      byClient: Object.values(byClient),
      items: pendingItems,
    });
  } catch (error) {
    log.error({ err: error }, "Error fetching pending evidence");
    return NextResponse.json(
      { error: "Failed to fetch pending evidence" },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH /api/evidence/pending - Update pending evidence status
// =============================================================================

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, status, ids } = body;

    // Validate status
    const validStatuses = ["PENDING", "CAPTURED", "DISMISSED"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be PENDING, CAPTURED, or DISMISSED" },
        { status: 400 }
      );
    }

    // Handle bulk update
    if (ids && Array.isArray(ids)) {
      const result = await prisma.pendingEvidence.updateMany({
        where: {
          id: { in: ids },
          organizationId: session.user.organizationId,
        },
        data: { status },
      });

      return NextResponse.json({
        success: true,
        updated: result.count,
      });
    }

    // Handle single update
    if (!id) {
      return NextResponse.json(
        { error: "id or ids array is required" },
        { status: 400 }
      );
    }

    const updated = await prisma.pendingEvidence.update({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      data: { status },
    });

    return NextResponse.json({
      success: true,
      pendingEvidence: updated,
    });
  } catch (error) {
    log.error({ err: error }, "Error updating pending evidence");
    return NextResponse.json(
      { error: "Failed to update pending evidence" },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/evidence/pending - Delete pending evidence entries
// =============================================================================

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const reportId = searchParams.get("reportId");

    if (reportId) {
      // Delete all pending evidence for a report
      const result = await prisma.pendingEvidence.deleteMany({
        where: {
          reportId,
          organizationId: session.user.organizationId,
        },
      });

      return NextResponse.json({
        success: true,
        deleted: result.count,
      });
    }

    if (!id) {
      return NextResponse.json(
        { error: "id or reportId is required" },
        { status: 400 }
      );
    }

    await prisma.pendingEvidence.delete({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "Error deleting pending evidence");
    return NextResponse.json(
      { error: "Failed to delete pending evidence" },
      { status: 500 }
    );
  }
}
