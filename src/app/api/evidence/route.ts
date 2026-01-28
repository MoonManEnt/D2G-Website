import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { parsePaginationParams, buildPaginatedResponse } from "@/lib/pagination";

// GET /api/evidence - List all evidence for organization
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const clientId = searchParams.get("clientId");
    const reportId = searchParams.get("reportId");

    // Build where clause
    const whereClause: Record<string, unknown> = {
      organizationId: session.user.organizationId,
    };

    if (accountId) {
      whereClause.accountItemId = accountId;
    }

    // Only show evidence for active (non-archived, non-deleted) clients
    const activeClientFilter = { client: { isActive: true, archivedAt: null } };

    // If filtering by reportId, get all accounts for that report
    if (reportId) {
      const reportAccounts = await prisma.accountItem.findMany({
        where: {
          organizationId: session.user.organizationId,
          reportId: reportId,
          report: activeClientFilter,
        },
        select: { id: true },
      });
      whereClause.accountItemId = {
        in: reportAccounts.map((a) => a.id),
      };
    }
    // If filtering by client (and no reportId), get all accounts for that client
    else if (clientId) {
      const clientAccounts = await prisma.accountItem.findMany({
        where: {
          organizationId: session.user.organizationId,
          report: {
            clientId: clientId,
            ...activeClientFilter,
          },
        },
        select: { id: true },
      });
      whereClause.accountItemId = {
        in: clientAccounts.map((a) => a.id),
      };
    }
    // No specific filter — still exclude evidence from deleted/archived clients
    else {
      const activeAccounts = await prisma.accountItem.findMany({
        where: {
          organizationId: session.user.organizationId,
          ...activeClientFilter,
        },
        select: { id: true },
      });
      whereClause.accountItemId = {
        in: activeAccounts.map((a) => a.id),
      };
    }

    const pagination = parsePaginationParams(searchParams);
    const total = await prisma.evidence.count({ where: whereClause });

    const evidence = await prisma.evidence.findMany({
      where: whereClause,
      skip: pagination.skip,
      take: pagination.limit,
      include: {
        accountItem: {
          select: {
            id: true,
            creditorName: true,
            maskedAccountId: true,
            cra: true,
            accountStatus: true,
            issueCount: true,
            report: {
              select: {
                id: true,
                client: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
        sourceFile: {
          select: {
            id: true,
            filename: true,
            storagePath: true,
          },
        },
        renderedFile: {
          select: {
            id: true,
            filename: true,
            storagePath: true,
          },
        },
        documentAttachments: {
          select: {
            documentId: true,
            document: {
              select: {
                id: true,
                title: true,
                disputeId: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get summary stats
    const stats = {
      total: evidence.length,
      byType: {} as Record<string, number>,
      byCra: {} as Record<string, number>,
      attachedToDisputes: 0,
    };

    evidence.forEach((e) => {
      // Count by type
      stats.byType[e.evidenceType] = (stats.byType[e.evidenceType] || 0) + 1;

      // Count by CRA
      if (e.accountItem?.cra) {
        stats.byCra[e.accountItem.cra] = (stats.byCra[e.accountItem.cra] || 0) + 1;
      }

      // Count attached to disputes
      if (e.documentAttachments.length > 0) {
        stats.attachedToDisputes++;
      }
    });

    return NextResponse.json({
      ...buildPaginatedResponse(evidence, total, pagination),
      stats,
    });
  } catch (error) {
    console.error("Error fetching evidence:", error);
    return NextResponse.json(
      { error: "Failed to fetch evidence" },
      { status: 500 }
    );
  }
}

// PATCH /api/evidence - Update evidence (annotations, title, description)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, annotations, title, description } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Evidence ID is required" },
        { status: 400 }
      );
    }

    // Verify evidence belongs to organization
    const evidence = await prisma.evidence.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!evidence) {
      return NextResponse.json(
        { error: "Evidence not found" },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (annotations !== undefined) {
      // Annotations should be a JSON string of annotation objects
      updateData.annotations = typeof annotations === "string"
        ? annotations
        : JSON.stringify(annotations);
    }

    if (title !== undefined) {
      updateData.title = title;
    }

    if (description !== undefined) {
      updateData.description = description;
    }

    const updated = await prisma.evidence.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      evidence: updated,
    });
  } catch (error) {
    console.error("Error updating evidence:", error);
    return NextResponse.json(
      { error: "Failed to update evidence" },
      { status: 500 }
    );
  }
}

// DELETE /api/evidence - Delete evidence by ID
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const evidenceId = searchParams.get("id");

    if (!evidenceId) {
      return NextResponse.json(
        { error: "Evidence ID is required" },
        { status: 400 }
      );
    }

    // Verify evidence belongs to organization
    const evidence = await prisma.evidence.findFirst({
      where: {
        id: evidenceId,
        organizationId: session.user.organizationId,
      },
    });

    if (!evidence) {
      return NextResponse.json(
        { error: "Evidence not found" },
        { status: 404 }
      );
    }

    await prisma.evidence.delete({
      where: { id: evidenceId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting evidence:", error);
    return NextResponse.json(
      { error: "Failed to delete evidence" },
      { status: 500 }
    );
  }
}
