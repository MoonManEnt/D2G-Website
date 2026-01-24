import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * POST /api/organization/reset - Reset all organization data
 *
 * This permanently deletes ALL client data for the organization:
 * - Clients
 * - Reports
 * - Disputes
 * - Accounts
 * - Evidence
 * - Documents
 * - Credit DNA & Scores
 *
 * Requires confirmation phrase: "DELETE ALL MY DATA"
 * Only organization owners/admins can perform this action.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { confirmationPhrase } = body;

    // Require confirmation phrase
    if (confirmationPhrase !== "DELETE ALL MY DATA") {
      return NextResponse.json(
        {
          error: "Invalid confirmation phrase",
          required: "DELETE ALL MY DATA",
        },
        { status: 400 }
      );
    }

    const organizationId = session.user.organizationId;

    // Get counts before deletion for the response
    const [
      clientCount,
      reportCount,
      disputeCount,
      accountCount,
      evidenceCount,
    ] = await Promise.all([
      prisma.client.count({ where: { organizationId } }),
      prisma.creditReport.count({ where: { organizationId } }),
      prisma.dispute.count({ where: { organizationId } }),
      prisma.accountItem.count({ where: { organizationId } }),
      prisma.evidence.count({ where: { organizationId } }),
    ]);

    // Delete in order to respect foreign key constraints
    // Use transactions for safety

    // 1. Delete dispute items
    await prisma.disputeItem.deleteMany({
      where: { dispute: { organizationId } },
    });

    // 2. Delete disputes
    await prisma.dispute.deleteMany({
      where: { organizationId },
    });

    // 3. Delete evidence
    await prisma.evidence.deleteMany({
      where: { organizationId },
    });

    // 4. Get all report IDs for diff results and stored files
    const reports = await prisma.creditReport.findMany({
      where: { organizationId },
      select: { id: true, originalFileId: true },
    });
    const reportIds = reports.map((r) => r.id);
    const fileIds = reports.map((r) => r.originalFileId).filter(Boolean) as string[];

    // 5. Delete diff results
    if (reportIds.length > 0) {
      await prisma.diffResult.deleteMany({
        where: {
          OR: [
            { newReportId: { in: reportIds } },
            { priorReportId: { in: reportIds } },
          ],
        },
      });
    }

    // 6. Delete account items
    await prisma.accountItem.deleteMany({
      where: { organizationId },
    });

    // 7. Delete credit reports
    await prisma.creditReport.deleteMany({
      where: { organizationId },
    });

    // 8. Delete stored files (reports)
    if (fileIds.length > 0) {
      await prisma.storedFile.deleteMany({
        where: { id: { in: fileIds } },
      });
    }

    // 9. Delete client documents
    await prisma.clientDocument.deleteMany({
      where: { client: { organizationId } },
    });

    // 10. Delete credit DNA (has organizationId directly)
    await prisma.creditDNA.deleteMany({
      where: { organizationId },
    });

    // 11. Delete credit scores (only has clientId, use nested filter)
    await prisma.creditScore.deleteMany({
      where: { client: { organizationId } },
    });

    // 12. Delete communications (has organizationId directly)
    await prisma.communication.deleteMany({
      where: { organizationId },
    });

    // 13. Delete clients
    await prisma.client.deleteMany({
      where: { organizationId },
    });

    // 14. Clean up any orphaned stored files
    await prisma.storedFile.deleteMany({
      where: { organizationId },
    });

    // Log the reset event
    await prisma.eventLog.create({
      data: {
        eventType: "ORGANIZATION_DATA_RESET",
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetType: "Organization",
        targetId: organizationId,
        eventData: JSON.stringify({
          deletedCounts: {
            clients: clientCount,
            reports: reportCount,
            disputes: disputeCount,
            accounts: accountCount,
            evidence: evidenceCount,
          },
        }),
        organizationId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "All organization data has been permanently deleted",
      deleted: {
        clients: clientCount,
        reports: reportCount,
        disputes: disputeCount,
        accounts: accountCount,
        evidence: evidenceCount,
      },
    });
  } catch (error) {
    console.error("Error resetting organization data:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reset data" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/organization/reset - Get data counts (preview before reset)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;

    const [
      clientCount,
      reportCount,
      disputeCount,
      accountCount,
      evidenceCount,
      documentCount,
    ] = await Promise.all([
      prisma.client.count({ where: { organizationId } }),
      prisma.creditReport.count({ where: { organizationId } }),
      prisma.dispute.count({ where: { organizationId } }),
      prisma.accountItem.count({ where: { organizationId } }),
      prisma.evidence.count({ where: { organizationId } }),
      prisma.clientDocument.count({ where: { client: { organizationId } } }),
    ]);

    return NextResponse.json({
      counts: {
        clients: clientCount,
        reports: reportCount,
        disputes: disputeCount,
        accounts: accountCount,
        evidence: evidenceCount,
        documents: documentCount,
      },
      confirmationPhrase: "DELETE ALL MY DATA",
    });
  } catch (error) {
    console.error("Error fetching data counts:", error);
    return NextResponse.json(
      { error: "Failed to fetch data counts" },
      { status: 500 }
    );
  }
}
