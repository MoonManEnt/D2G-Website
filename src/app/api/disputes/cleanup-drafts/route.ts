import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { createLogger } from "@/lib/logger";
const log = createLogger("disputes-cleanup-api");

export const dynamic = "force-dynamic";

// =============================================================================
// DELETE /api/disputes/cleanup-drafts - Delete orphaned DRAFT disputes
// =============================================================================
// Removes DRAFT disputes that were created but never launched.
// Can optionally filter by clientId and cra.
// =============================================================================

export const DELETE = withAuth(async (req, ctx) => {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    const cra = searchParams.get("cra");

    // Build where clause
    const where: {
      organizationId: string;
      status: string;
      clientId?: string;
      cra?: string;
    } = {
      organizationId: ctx.organizationId,
      status: "DRAFT",
    };

    if (clientId) {
      where.clientId = clientId;
    }

    if (cra) {
      where.cra = cra;
    }

    // Find drafts to delete
    const drafts = await prisma.dispute.findMany({
      where,
      select: {
        id: true,
        cra: true,
        round: true,
        client: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (drafts.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No DRAFT disputes found to clean up",
        deleted: 0,
      });
    }

    // Delete associated dispute items first
    await prisma.disputeItem.deleteMany({
      where: {
        disputeId: { in: drafts.map((d) => d.id) },
      },
    });

    // Delete the drafts
    const result = await prisma.dispute.deleteMany({
      where: {
        id: { in: drafts.map((d) => d.id) },
      },
    });

    // Log the cleanup
    await prisma.eventLog.create({
      data: {
        eventType: "DRAFTS_CLEANED_UP",
        actorId: ctx.userId,
        actorEmail: ctx.session.user.email,
        targetType: "System",
        targetId: "cleanup",
        eventData: JSON.stringify({
          deletedCount: result.count,
          drafts: drafts.map((d) => ({
            id: d.id,
            cra: d.cra,
            round: d.round,
            client: `${d.client.firstName} ${d.client.lastName}`,
          })),
        }),
        organizationId: ctx.organizationId,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${result.count} DRAFT dispute(s)`,
      deleted: result.count,
      drafts: drafts.map((d) => ({
        id: d.id,
        cra: d.cra,
        round: d.round,
        client: `${d.client.firstName} ${d.client.lastName}`,
      })),
    });
  } catch (error) {
    log.error({ err: error }, "Error cleaning up drafts");
    return NextResponse.json(
      { error: "Failed to clean up drafts" },
      { status: 500 }
    );
  }
});

// GET to check for orphaned drafts
export const GET = withAuth(async (req, ctx) => {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");

    const where: {
      organizationId: string;
      status: string;
      clientId?: string;
    } = {
      organizationId: ctx.organizationId,
      status: "DRAFT",
    };

    if (clientId) {
      where.clientId = clientId;
    }

    const drafts = await prisma.dispute.findMany({
      where,
      select: {
        id: true,
        cra: true,
        flow: true,
        round: true,
        createdAt: true,
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: { items: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      drafts: drafts.map((d) => ({
        id: d.id,
        cra: d.cra,
        flow: d.flow,
        round: d.round,
        createdAt: d.createdAt,
        clientId: d.client.id,
        clientName: `${d.client.firstName} ${d.client.lastName}`,
        itemCount: d._count.items,
      })),
      count: drafts.length,
    });
  } catch (error) {
    log.error({ err: error }, "Error fetching drafts");
    return NextResponse.json(
      { error: "Failed to fetch drafts" },
      { status: 500 }
    );
  }
});
