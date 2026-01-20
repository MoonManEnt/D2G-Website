import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPortalToken, extractBearerToken } from "@/lib/jwt";

// GET /api/portal/dashboard - Get client portal dashboard data
export async function GET(request: NextRequest) {
  try {
    // Verify JWT token
    const authHeader = request.headers.get("Authorization");
    const token = extractBearerToken(authHeader);

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyPortalToken(token);

    if (!payload) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const clientId = payload.sub;

    // Fetch client data
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        creditScores: {
          orderBy: { scoreDate: "desc" },
          take: 50,
        },
        accounts: {
          include: {
            disputes: {
              select: {
                id: true,
                outcome: true,
              },
            },
          },
        },
        disputes: {
          orderBy: { createdAt: "desc" },
          include: {
            items: {
              include: {
                accountItem: {
                  select: {
                    id: true,
                    creditorName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Calculate credit score stats
    const latestScores: Record<string, number> = {};
    const change30Days: Record<string, number> = {};
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const cra of ["TRANSUNION", "EXPERIAN", "EQUIFAX"]) {
      const craScores = client.creditScores.filter((s) => s.cra === cra);
      if (craScores.length > 0) {
        latestScores[cra] = craScores[0].score;

        // Find score from ~30 days ago
        const oldScore = craScores.find(
          (s) => new Date(s.scoreDate) <= thirtyDaysAgo
        );
        if (oldScore) {
          change30Days[cra] = craScores[0].score - oldScore.score;
        }
      }
    }

    // Calculate dispute stats
    const disputeStats = {
      total: client.disputes.length,
      resolved: client.disputes.filter(
        (d) => d.status === "RESOLVED_POSITIVE" || d.status === "RESOLVED_NEGATIVE"
      ).length,
      inProgress: client.disputes.filter(
        (d) => ["SENT", "RESPONDED"].includes(d.status)
      ).length,
      pending: client.disputes.filter(
        (d) => ["DRAFT", "APPROVED"].includes(d.status)
      ).length,
      items: client.disputes.slice(0, 10).map((d) => ({
        id: d.id,
        cra: d.cra,
        status: d.status,
        createdAt: d.createdAt.toISOString(),
        accounts: d.items.map((item) => ({
          creditorName: item.accountItem.creditorName,
        })),
      })),
    };

    // Calculate negative items stats
    const negativeAccounts = client.accounts.filter(
      (a) =>
        ["COLLECTION", "CHARGE_OFF", "LATE", "DEROGATORY", "CLOSED"].includes(a.accountStatus) ||
        a.issueCount > 0
    );

    const resolvedAccounts = negativeAccounts.filter((a) =>
      a.disputes.some(
        (d) => d.outcome === "DELETED" || d.outcome === "UPDATED" || d.outcome === "VERIFIED_REMOVED"
      )
    );

    const negativeItemsStats = {
      total: negativeAccounts.length,
      resolved: resolvedAccounts.length,
      remaining: negativeAccounts.length - resolvedAccounts.length,
    };

    return NextResponse.json({
      creditScores: {
        latest: latestScores,
        change30Days,
      },
      disputes: disputeStats,
      negativeItems: negativeItemsStats,
      recentActivity: [],
    });
  } catch (error) {
    console.error("Portal dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
