import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { subDays, startOfDay, format, startOfMonth, subMonths } from "date-fns";

// GET /api/analytics - Get dashboard analytics
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);

    // Run all queries in parallel
    const [
      clientCount,
      activeDisputeCount,
      resolvedDisputeCount,
      negativeItemCount,
      recentDisputes,
      disputesByStatus,
      disputesByCRA,
      disputesByFlow,
      reportsUploaded,
      dailyActivity,
      topClients,
      llmStats,
      scoreImprovements,
      monthlyDisputes,
    ] = await Promise.all([
      // Total clients
      prisma.client.count({
        where: { organizationId, isActive: true },
      }),

      // Active disputes
      prisma.dispute.count({
        where: {
          organizationId,
          status: { in: ["DRAFT", "APPROVED", "SENT"] },
        },
      }),

      // Resolved disputes
      prisma.dispute.count({
        where: {
          organizationId,
          status: "RESOLVED",
        },
      }),

      // Total negative items (disputable accounts)
      prisma.accountItem.count({
        where: {
          organizationId,
          isDisputable: true,
        },
      }),

      // Recent disputes (last 30 days)
      prisma.dispute.findMany({
        where: {
          organizationId,
          createdAt: { gte: thirtyDaysAgo },
        },
        select: {
          id: true,
          cra: true,
          status: true,
          flow: true,
          round: true,
          createdAt: true,
          resolvedAt: true,
          client: {
            select: { firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),

      // Disputes by status
      prisma.dispute.groupBy({
        by: ["status"],
        where: { organizationId },
        _count: { id: true },
      }),

      // Disputes by CRA
      prisma.dispute.groupBy({
        by: ["cra"],
        where: { organizationId },
        _count: { id: true },
      }),

      // Disputes by flow
      prisma.dispute.groupBy({
        by: ["flow"],
        where: { organizationId },
        _count: { id: true },
      }),

      // Reports uploaded (last 30 days)
      prisma.creditReport.count({
        where: {
          organizationId,
          uploadedAt: { gte: thirtyDaysAgo },
        },
      }),

      // Daily activity (last 14 days)
      getDailyActivity(organizationId, 14),

      // Top clients by dispute count
      prisma.client.findMany({
        where: { organizationId, isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          _count: {
            select: {
              disputes: true,
              accounts: true,
            },
          },
        },
        orderBy: {
          disputes: { _count: "desc" },
        },
        take: 5,
      }),

      // LLM usage stats
      getLLMStats(organizationId),

      // Score change tracking
      getScoreImprovements(organizationId),

      // Disputes by month
      getMonthlyDisputes(organizationId, 6),
    ]);

    // Calculate resolution rate
    const totalDisputes = activeDisputeCount + resolvedDisputeCount;
    const resolutionRate = totalDisputes > 0
      ? Math.round((resolvedDisputeCount / totalDisputes) * 100)
      : 0;

    // Calculate average resolution time
    const resolvedWithDates = await prisma.dispute.findMany({
      where: {
        organizationId,
        status: "RESOLVED",
        resolvedAt: { not: null },
      },
      select: {
        createdAt: true,
        resolvedAt: true,
      },
    });

    let avgResolutionDays = 0;
    if (resolvedWithDates.length > 0) {
      const totalDays = resolvedWithDates.reduce((sum, d) => {
        if (d.resolvedAt) {
          return sum + Math.ceil((d.resolvedAt.getTime() - d.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        }
        return sum;
      }, 0);
      avgResolutionDays = Math.round(totalDays / resolvedWithDates.length);
    }

    return NextResponse.json({
      summary: {
        clientCount,
        activeDisputeCount,
        resolvedDisputeCount,
        negativeItemCount,
        reportsUploaded,
        resolutionRate,
        avgResolutionDays,
      },
      charts: {
        disputesByStatus: disputesByStatus.map((d) => ({
          name: d.status,
          value: d._count.id,
        })),
        disputesByCRA: disputesByCRA.map((d) => ({
          name: d.cra,
          value: d._count.id,
        })),
        disputesByFlow: disputesByFlow.map((d) => ({
          name: d.flow,
          value: d._count.id,
        })),
        dailyActivity,
      },
      recentDisputes: recentDisputes.map((d) => ({
        id: d.id,
        cra: d.cra,
        status: d.status,
        flow: d.flow,
        round: d.round,
        clientName: `${d.client.firstName} ${d.client.lastName}`,
        createdAt: d.createdAt,
        resolvedAt: d.resolvedAt,
      })),
      topClients: topClients.map((c) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        disputeCount: c._count.disputes,
        accountCount: c._count.accounts,
      })),
      llmStats,
      scoreImprovements,
      monthlyDisputes,
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}

async function getDailyActivity(organizationId: string, days: number) {
  const result: Array<{ date: string; disputes: number; reports: number }> = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = subDays(new Date(), i);
    const dayStart = startOfDay(date);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const [disputes, reports] = await Promise.all([
      prisma.dispute.count({
        where: {
          organizationId,
          createdAt: {
            gte: dayStart,
            lt: dayEnd,
          },
        },
      }),
      prisma.creditReport.count({
        where: {
          organizationId,
          uploadedAt: {
            gte: dayStart,
            lt: dayEnd,
          },
        },
      }),
    ]);

    result.push({
      date: format(date, "MMM d"),
      disputes,
      reports,
    });
  }

  return result;
}

async function getLLMStats(organizationId: string) {
  const thirtyDaysAgo = subDays(new Date(), 30);

  const requests = await prisma.lLMRequest.findMany({
    where: {
      organizationId,
      createdAt: { gte: thirtyDaysAgo },
    },
    select: {
      provider: true,
      taskType: true,
      costCents: true,
      latencyMs: true,
      userAccepted: true,
    },
  });

  if (requests.length === 0) {
    return {
      totalRequests: 0,
      totalCostCents: 0,
      avgLatencyMs: 0,
      byProvider: {},
      byTaskType: {},
    };
  }

  const totalCostCents = requests.reduce((sum, r) => sum + r.costCents, 0);
  const avgLatencyMs = Math.round(
    requests.reduce((sum, r) => sum + r.latencyMs, 0) / requests.length
  );

  // Group by provider
  const byProvider: Record<string, { requests: number; cost: number }> = {};
  for (const r of requests) {
    if (!byProvider[r.provider]) {
      byProvider[r.provider] = { requests: 0, cost: 0 };
    }
    byProvider[r.provider].requests++;
    byProvider[r.provider].cost += r.costCents;
  }

  // Group by task type
  const byTaskType: Record<string, { requests: number; cost: number }> = {};
  for (const r of requests) {
    if (!byTaskType[r.taskType]) {
      byTaskType[r.taskType] = { requests: 0, cost: 0 };
    }
    byTaskType[r.taskType].requests++;
    byTaskType[r.taskType].cost += r.costCents;
  }

  return {
    totalRequests: requests.length,
    totalCostCents,
    avgLatencyMs,
    byProvider,
    byTaskType,
  };
}

async function getScoreImprovements(organizationId: string) {
  // Get all clients with their score history
  const clients = await prisma.client.findMany({
    where: { organizationId },
    include: {
      creditScores: {
        orderBy: { scoreDate: "desc" },
        take: 2, // Get latest two scores for comparison
      },
    },
  });

  let improved = 0;
  let declined = 0;
  let noChange = 0;
  let totalImprovement = 0;
  let clientsWithScores = 0;

  for (const client of clients) {
    if (client.creditScores.length >= 2) {
      const latest = client.creditScores[0].score;
      const previous = client.creditScores[1].score;
      const change = latest - previous;

      if (change > 0) {
        improved++;
        totalImprovement += change;
      } else if (change < 0) {
        declined++;
      } else {
        noChange++;
      }
      clientsWithScores++;
    }
  }

  return {
    improved,
    declined,
    noChange,
    averageImprovement: clientsWithScores > 0 ? Math.round(totalImprovement / improved || 0) : 0,
    clientsTracked: clientsWithScores,
  };
}

async function getMonthlyDisputes(organizationId: string, months: number) {
  const results: Array<{ month: string; created: number; resolved: number; sent: number }> = [];

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(new Date(), i));
    const monthEnd = startOfMonth(subMonths(new Date(), i - 1));

    const [created, resolved, sent] = await Promise.all([
      prisma.dispute.count({
        where: {
          organizationId,
          createdAt: { gte: monthStart, lt: monthEnd },
        },
      }),
      prisma.dispute.count({
        where: {
          organizationId,
          resolvedAt: { gte: monthStart, lt: monthEnd },
        },
      }),
      prisma.dispute.count({
        where: {
          organizationId,
          sentDate: { gte: monthStart, lt: monthEnd },
        },
      }),
    ]);

    results.push({
      month: format(monthStart, "MMM yyyy"),
      created,
      resolved,
      sent,
    });
  }

  return results;
}
