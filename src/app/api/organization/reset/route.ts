import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { orgResetSchema } from "@/lib/api-validation-schemas";

export const dynamic = "force-dynamic";

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
    const parsed = orgResetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid confirmation phrase",
          required: "DELETE ALL MY DATA",
          details: parsed.error.flatten(),
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

    // 4. Delete sentry dispute items (references accountItem FK)
    await prisma.sentryDisputeItem.deleteMany({
      where: { accountItem: { organizationId } },
    });

    // 5. Delete sentry disputes
    await prisma.sentryDispute.deleteMany({
      where: { organizationId },
    });

    // 6. Delete pending evidence (references accountItem FK)
    await prisma.pendingEvidence.deleteMany({
      where: { accountItem: { organizationId } },
    });

    // 7. Get all report IDs for diff results and stored files
    const reports = await prisma.creditReport.findMany({
      where: { organizationId },
      select: { id: true, originalFileId: true },
    });
    const reportIds = reports.map((r) => r.id);
    const fileIds = reports.map((r) => r.originalFileId).filter(Boolean) as string[];

    // 8. Delete diff results
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

    // 9. Delete account items
    await prisma.accountItem.deleteMany({
      where: { organizationId },
    });

    // 10. Delete credit reports
    await prisma.creditReport.deleteMany({
      where: { organizationId },
    });

    // 11. Delete stored files (reports)
    if (fileIds.length > 0) {
      await prisma.storedFile.deleteMany({
        where: { id: { in: fileIds } },
      });
    }

    // 12. Delete client documents
    await prisma.clientDocument.deleteMany({
      where: { client: { organizationId } },
    });

    // 13. Delete AMELIA content hashes (no relation, need client IDs)
    const orgClients = await prisma.client.findMany({
      where: { organizationId },
      select: { id: true },
    });
    const orgClientIds = orgClients.map(c => c.id);
    if (orgClientIds.length > 0) {
      await prisma.ameliaContentHash.deleteMany({
        where: { clientId: { in: orgClientIds } },
      });
    }

    // 14. Delete personal info disputes
    await prisma.personalInfoDispute.deleteMany({
      where: { organizationId },
    });

    // 15. Delete credit DNA (has organizationId directly)
    await prisma.creditDNA.deleteMany({
      where: { organizationId },
    });

    // 16. Delete credit scores (only has clientId, use nested filter)
    await prisma.creditScore.deleteMany({
      where: { client: { organizationId } },
    });

    // 17. Delete communications (has organizationId directly)
    await prisma.communication.deleteMany({
      where: { organizationId },
    });

    // 18. Delete clients
    await prisma.client.deleteMany({
      where: { organizationId },
    });

    // 19. Clean up any orphaned stored files
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
      sentryDisputeCount,
    ] = await Promise.all([
      prisma.client.count({ where: { organizationId } }),
      prisma.creditReport.count({ where: { organizationId } }),
      prisma.dispute.count({ where: { organizationId } }),
      prisma.accountItem.count({ where: { organizationId } }),
      prisma.evidence.count({ where: { organizationId } }),
      prisma.clientDocument.count({ where: { client: { organizationId } } }),
      prisma.sentryDispute.count({ where: { organizationId } }),
    ]);

    return NextResponse.json({
      counts: {
        clients: clientCount,
        reports: reportCount,
        disputes: disputeCount,
        accounts: accountCount,
        evidence: evidenceCount,
        documents: documentCount,
        sentryDisputes: sentryDisputeCount,
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
