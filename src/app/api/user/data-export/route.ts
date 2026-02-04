import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { decryptPIIFields } from "@/lib/encryption";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/data-export
 *
 * GDPR Data Export - Lets authenticated users (OWNER/ADMIN only) download
 * all of their organization's data as a JSON file.
 *
 * This satisfies GDPR Article 20 (Right to Data Portability).
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only OWNER or ADMIN roles can export organization data
    if (session.user.role !== "OWNER" && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only OWNER or ADMIN roles can export data" },
        { status: 403 }
      );
    }

    const organizationId = session.user.organizationId;

    // Fetch all organization data in parallel
    const [
      organization,
      users,
      clients,
      disputes,
      creditReports,
      creditScores,
      eventLogs,
    ] = await Promise.all([
      // Organization details
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          name: true,
          slug: true,
          createdAt: true,
        },
      }),

      // All users in the org (excluding password hashes)
      prisma.user.findMany({
        where: { organizationId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      }),

      // All clients (PII will be decrypted below)
      prisma.client.findMany({
        where: { organizationId },
      }),

      // All disputes
      prisma.dispute.findMany({
        where: { organizationId },
        select: {
          id: true,
          cra: true,
          flow: true,
          round: true,
          status: true,
          createdAt: true,
        },
      }),

      // All credit reports metadata
      prisma.creditReport.findMany({
        where: { organizationId },
        select: {
          id: true,
          sourceType: true,
          reportDate: true,
          parseStatus: true,
        },
      }),

      // All credit scores (via clients in the org)
      prisma.creditScore.findMany({
        where: {
          client: {
            organizationId,
          },
        },
        select: {
          cra: true,
          score: true,
          scoreDate: true,
        },
      }),

      // Last 1000 event logs
      prisma.eventLog.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 1000,
      }),
    ]);

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Decrypt PII fields on all client records
    const decryptedClients = clients.map((client) => {
      const clientObj = { ...client } as Record<string, unknown>;
      return decryptPIIFields(clientObj);
    });

    const exportData = {
      format: "dispute2go-gdpr-export-v1",
      exportedAt: new Date().toISOString(),
      exportedBy: {
        userId: session.user.id,
        email: session.user.email,
      },
      organization,
      users,
      clients: decryptedClients,
      disputes,
      creditReports,
      creditScores,
      eventLogs,
    };

    // Log the export event
    await prisma.eventLog.create({
      data: {
        eventType: "GDPR_DATA_EXPORT",
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetType: "Organization",
        targetId: organizationId,
        eventData: JSON.stringify({
          timestamp: new Date().toISOString(),
          clientCount: clients.length,
          disputeCount: disputes.length,
          reportCount: creditReports.length,
        }),
        organizationId,
      },
    });

    const jsonString = JSON.stringify(exportData, null, 2);

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="dispute2go-export-${organizationId}-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    console.error("Error exporting data:", error);
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 }
    );
  }
}
