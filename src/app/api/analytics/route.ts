import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { subDays, startOfDay, format, startOfMonth, subMonths } from "date-fns";

export const dynamic = 'force-dynamic';

// GET /api/analytics - Get comprehensive dashboard analytics
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;

    // Parse time range from query params
    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "6m";

    // Calculate date range based on selection
    const rangeMonths: Record<string, number> = {
      "1m": 1,
      "3m": 3,
      "6m": 6,
      "1y": 12,
      "all": 120, // 10 years for "all"
    };
    const months = rangeMonths[range] || 6;
    const startDate = subMonths(new Date(), months);
    const thirtyDaysAgo = subDays(new Date(), 30);

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
      // New comprehensive queries
      disputeResponses,
      clientsByStage,
      monthlyData,
      recentEvents,
      disputeItemsByAccountType,
      clientsWithScoreHistory,
      resolvedDisputeTimes,
    ] = await Promise.all([
      // Total clients
      prisma.client.count({
        where: { organizationId, isActive: true },
      }),

      // Active disputes (within date range)
      prisma.dispute.count({
        where: {
          organizationId,
          status: { in: ["DRAFT", "APPROVED", "SENT"] },
          createdAt: { gte: startDate },
          client: { isActive: true, archivedAt: null },
        },
      }),

      // Resolved disputes (within date range)
      prisma.dispute.count({
        where: {
          organizationId,
          status: "RESOLVED",
          createdAt: { gte: startDate },
          client: { isActive: true, archivedAt: null },
        },
      }),

      // Total negative items (disputable accounts)
      prisma.accountItem.count({
        where: {
          organizationId,
          confidenceLevel: { in: ["LOW", "MEDIUM"] },
          client: { isActive: true, archivedAt: null },
        },
      }),

      // Recent disputes (last 30 days)
      prisma.dispute.findMany({
        where: {
          organizationId,
          createdAt: { gte: thirtyDaysAgo },
          client: { isActive: true, archivedAt: null },
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
        where: { organizationId, createdAt: { gte: startDate }, client: { isActive: true, archivedAt: null } },
        _count: { id: true },
      }),

      // Disputes by CRA
      prisma.dispute.groupBy({
        by: ["cra"],
        where: { organizationId, createdAt: { gte: startDate }, client: { isActive: true, archivedAt: null } },
        _count: { id: true },
      }),

      // Disputes by flow
      prisma.dispute.groupBy({
        by: ["flow"],
        where: { organizationId, createdAt: { gte: startDate }, client: { isActive: true, archivedAt: null } },
        _count: { id: true },
      }),

      // Reports uploaded (within date range)
      prisma.creditReport.count({
        where: {
          organizationId,
          uploadedAt: { gte: startDate },
          client: { isActive: true, archivedAt: null },
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

      // ========== NEW COMPREHENSIVE QUERIES ==========

      // All dispute responses for outcome analysis
      prisma.disputeResponse.findMany({
        where: {
          disputeItem: {
            dispute: {
              organizationId,
              createdAt: { gte: startDate },
              client: { isActive: true, archivedAt: null },
            },
          },
        },
        select: {
          outcome: true,
          wasLate: true,
          stallTactic: true,
          daysToRespond: true,
          disputeItem: {
            select: {
              dispute: {
                select: {
                  cra: true,
                  flow: true,
                  round: true,
                },
              },
              accountItem: {
                select: {
                  accountType: true,
                },
              },
            },
          },
        },
        take: 1000,
      }),

      // Clients by stage for pipeline funnel
      prisma.client.groupBy({
        by: ["stage"],
        where: { organizationId, isActive: true },
        _count: { id: true },
      }),

      // Monthly dispute and client data for trends
      getMonthlyTrends(organizationId, Math.min(months, 12)),

      // Recent events for activity feed (fetch more to allow filtering)
      prisma.eventLog.findMany({
        where: {
          organizationId,
          createdAt: { gte: thirtyDaysAgo },
          eventType: {
            in: [
              "DISPUTE_CREATED",
              "DISPUTE_SENT",
              "DISPUTE_RESOLVED",
              "RESPONSE_RECORDED",
              "REPORT_UPLOADED",
              "CLIENT_CREATED",
            ],
          },
        },
        select: {
          eventType: true,
          targetType: true,
          targetId: true,
          eventData: true,
          createdAt: true,
          actor: {
            select: { name: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50, // Fetch more to allow filtering by active clients
      }),

      // Dispute items by account type for success breakdown
      prisma.disputeItem.findMany({
        where: {
          dispute: {
            organizationId,
            createdAt: { gte: startDate },
            client: { isActive: true, archivedAt: null },
          },
          outcome: { not: null },
        },
        select: {
          outcome: true,
          accountItem: {
            select: { accountType: true },
          },
        },
        take: 1000,
      }),

      // Clients with score history for improvement tracking
      prisma.client.findMany({
        where: { organizationId, isActive: true, archivedAt: null },
        select: {
          id: true,
          creditScores: {
            orderBy: { scoreDate: "asc" },
            take: 10,
          },
        },
        take: 1000,
      }),

      // Resolved disputes with timing for avg completion
      prisma.dispute.findMany({
        where: {
          organizationId,
          status: "RESOLVED",
          resolvedAt: { not: null },
          createdAt: { gte: startDate },
          client: { isActive: true, archivedAt: null },
        },
        select: {
          createdAt: true,
          resolvedAt: true,
        },
        take: 1000,
      }),
    ]);

    // ========== COMPUTE DERIVED METRICS ==========

    // Calculate items deleted and success rates
    const totalResponses = disputeResponses.length;
    const deletedResponses = disputeResponses.filter(r => r.outcome === "DELETED").length;
    const verifiedResponses = disputeResponses.filter(r => r.outcome === "VERIFIED").length;
    const noResponseCount = disputeResponses.filter(r => r.outcome === "NO_RESPONSE").length;
    const stallCount = disputeResponses.filter(r => r.outcome === "STALL_LETTER").length;
    const lateResponses = disputeResponses.filter(r => r.wasLate).length;

    // Overall success rate
    const overallSuccessRate = totalResponses > 0
      ? Math.round((deletedResponses / totalResponses) * 100)
      : 0;

    // Calculate resolution rate
    const totalDisputes = activeDisputeCount + resolvedDisputeCount;
    const resolutionRate = totalDisputes > 0
      ? Math.round((resolvedDisputeCount / totalDisputes) * 100)
      : 0;

    // Average resolution time in days and months
    let avgResolutionDays = 0;
    if (resolvedDisputeTimes.length > 0) {
      const totalDays = resolvedDisputeTimes.reduce((sum, d) => {
        if (d.resolvedAt) {
          return sum + Math.ceil((d.resolvedAt.getTime() - d.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        }
        return sum;
      }, 0);
      avgResolutionDays = Math.round(totalDays / resolvedDisputeTimes.length);
    }

    // Average score improvement
    let totalImprovement = 0;
    let clientsWithImprovement = 0;
    for (const client of clientsWithScoreHistory) {
      if (client.creditScores.length >= 2) {
        const oldest = client.creditScores[0].score;
        const newest = client.creditScores[client.creditScores.length - 1].score;
        const improvement = newest - oldest;
        if (improvement > 0) {
          totalImprovement += improvement;
          clientsWithImprovement++;
        }
      }
    }
    const avgScoreImprovement = clientsWithImprovement > 0
      ? Math.round(totalImprovement / clientsWithImprovement)
      : 0;

    // Success by CRA
    const successByCRA: Record<string, { sent: number; deleted: number; verified: number; noResponse: number; rate: number }> = {};
    for (const cra of ["TRANSUNION", "EXPERIAN", "EQUIFAX"]) {
      const craResponses = disputeResponses.filter(r => r.disputeItem?.dispute?.cra === cra);
      const craDeleted = craResponses.filter(r => r.outcome === "DELETED").length;
      const craVerified = craResponses.filter(r => r.outcome === "VERIFIED").length;
      const craNoResponse = craResponses.filter(r => r.outcome === "NO_RESPONSE").length;
      successByCRA[cra] = {
        sent: craResponses.length,
        deleted: craDeleted,
        verified: craVerified,
        noResponse: craNoResponse,
        rate: craResponses.length > 0 ? Math.round((craDeleted / craResponses.length) * 100) : 0,
      };
    }

    // Success by Flow
    const successByFlow: Record<string, { total: number; success: number; rate: number }> = {};
    for (const flow of ["ACCURACY", "COLLECTION", "CONSENT", "COMBO"]) {
      const flowResponses = disputeResponses.filter(r => r.disputeItem?.dispute?.flow === flow);
      const flowDeleted = flowResponses.filter(r => r.outcome === "DELETED").length;
      successByFlow[flow] = {
        total: flowResponses.length,
        success: flowDeleted,
        rate: flowResponses.length > 0 ? Math.round((flowDeleted / flowResponses.length) * 100) : 0,
      };
    }

    // Round Performance
    const roundPerformance: Array<{ round: string; sent: number; deleted: number; rate: number }> = [];
    for (let r = 1; r <= 4; r++) {
      const roundResponses = disputeResponses.filter(resp => resp.disputeItem?.dispute?.round === r);
      const roundDeleted = roundResponses.filter(resp => resp.outcome === "DELETED").length;
      roundPerformance.push({
        round: `R${r}`,
        sent: roundResponses.length,
        deleted: roundDeleted,
        rate: roundResponses.length > 0 ? Math.round((roundDeleted / roundResponses.length) * 100) : 0,
      });
    }

    // Client Funnel from stages
    const stageOrder = ["INTAKE", "ANALYSIS", "ROUND_1", "ROUND_2", "ROUND_3", "ROUND_4", "MAINTENANCE", "COMPLETED"];
    const clientFunnel: Record<string, number> = {};
    for (const stage of stageOrder) {
      const stageCount = clientsByStage.find(s => s.stage === stage);
      clientFunnel[stage.toLowerCase().replace(/_/g, "")] = stageCount?._count.id || 0;
    }

    // Top Performing Items by Account Type
    const accountTypeStats: Record<string, { deleted: number; total: number }> = {};
    for (const item of disputeItemsByAccountType) {
      const type = item.accountItem?.accountType || "OTHER";
      if (!accountTypeStats[type]) {
        accountTypeStats[type] = { deleted: 0, total: 0 };
      }
      accountTypeStats[type].total++;
      if (item.outcome === "DELETED") {
        accountTypeStats[type].deleted++;
      }
    }

    const topPerformingItems = Object.entries(accountTypeStats)
      .map(([type, stats]) => ({
        type: formatAccountType(type),
        deleted: stats.deleted,
        total: stats.total,
        rate: stats.total > 0 ? Math.round((stats.deleted / stats.total) * 100) : 0,
      }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 5);

    // FCRA Violations
    const fcraViolations = {
      total: lateResponses + stallCount,
      failureToRespond: noResponseCount,
      inadequateInvestigation: stallCount,
      frivolousRejection: disputeResponses.filter(r => r.stallTactic === "FRIVOLOUS_CLAIM").length,
      cfpbComplaints: 0, // Would need separate tracking
    };

    // Recent Activity from events - filter by active clients and show client names
    // First, collect all target IDs by type to batch-check active status (filter out nulls)
    const clientTargetIds = recentEvents
      .filter(e => e.targetType === "Client" && e.targetId)
      .map(e => e.targetId as string);
    const disputeTargetIds = recentEvents
      .filter(e => e.targetType === "Dispute" && e.targetId)
      .map(e => e.targetId as string);
    const reportTargetIds = recentEvents
      .filter(e => e.targetType === "CreditReport" && e.targetId)
      .map(e => e.targetId as string);

    // Fetch active status for each target type
    const [activeClients, disputesWithClients, reportsWithClients] = await Promise.all([
      clientTargetIds.length > 0
        ? prisma.client.findMany({
            where: { id: { in: clientTargetIds }, isActive: true, archivedAt: null },
            select: { id: true, firstName: true, lastName: true },
          })
        : Promise.resolve([]),
      disputeTargetIds.length > 0
        ? prisma.dispute.findMany({
            where: { id: { in: disputeTargetIds }, client: { isActive: true, archivedAt: null } },
            include: { client: { select: { firstName: true, lastName: true } } },
          })
        : Promise.resolve([]),
      reportTargetIds.length > 0
        ? prisma.creditReport.findMany({
            where: { id: { in: reportTargetIds }, client: { isActive: true, archivedAt: null } },
            include: { client: { select: { firstName: true, lastName: true } } },
          })
        : Promise.resolve([]),
    ]);

    // Build lookup maps
    const activeClientMap = new Map(activeClients.map(c => [c.id, `${c.firstName} ${c.lastName}`]));
    const disputeClientMap = new Map(disputesWithClients.map(d => [d.id, `${d.client.firstName} ${d.client.lastName}`]));
    const reportClientMap = new Map(reportsWithClients.map(r => [r.id, `${r.client.firstName} ${r.client.lastName}`]));

    // Filter events to only those with active clients and transform
    const recentActivity = recentEvents
      .filter(event => {
        // Check if the target's client is still active
        if (!event.targetId) return false; // Skip events without targets
        if (event.targetType === "Client") {
          return activeClientMap.has(event.targetId);
        } else if (event.targetType === "Dispute") {
          return disputeClientMap.has(event.targetId);
        } else if (event.targetType === "CreditReport") {
          return reportClientMap.has(event.targetId);
        }
        return false; // Skip events with unknown target types
      })
      .slice(0, 6)
      .map(event => {
        const data = event.eventData ? JSON.parse(event.eventData) : {};
        let activityType = "response";
        let details = "";

        // Get client name from the target lookup or eventData
        let clientName = data.clientName || "Unknown Client";
        if (event.targetType === "Client" && event.targetId) {
          clientName = activeClientMap.get(event.targetId) || clientName;
        } else if (event.targetType === "Dispute" && event.targetId) {
          clientName = disputeClientMap.get(event.targetId) || clientName;
        } else if (event.targetType === "CreditReport" && event.targetId) {
          clientName = reportClientMap.get(event.targetId) || clientName;
        }

        switch (event.eventType) {
          case "DISPUTE_CREATED":
            activityType = "sent";
            details = `${data.flow || "Dispute"} created - ${data.cra || "CRA"}`;
            break;
          case "DISPUTE_SENT":
            activityType = "sent";
            details = `Dispute sent to ${data.cra || "CRA"}`;
            break;
          case "DISPUTE_RESOLVED":
            activityType = "deletion";
            details = `Dispute resolved - ${data.outcome || "complete"}`;
            break;
          case "RESPONSE_RECORDED":
            activityType = data.outcome === "DELETED" ? "deletion" : "response";
            details = `Response: ${data.outcome || "recorded"}`;
            break;
          case "REPORT_UPLOADED":
            activityType = "response";
            details = "Credit report uploaded";
            break;
          case "CLIENT_CREATED":
            activityType = "response";
            details = "New client added";
            break;
          default:
            details = event.eventType.replace(/_/g, " ").toLowerCase();
        }

        return {
          date: format(event.createdAt, "MMM d"),
          type: activityType,
          client: clientName,
          details,
        };
      });

    // Monthly Trends (transform data for frontend)
    const monthlyTrends = monthlyData.map(m => ({
      month: m.month,
      clients: m.newClients,
      disputes: m.sent,
      deleted: m.deleted,
      successRate: m.sent > 0 ? Math.round((m.deleted / m.sent) * 100) : 0,
    }));

    return NextResponse.json({
      summary: {
        clientCount,
        activeDisputeCount,
        resolvedDisputeCount,
        negativeItemCount,
        reportsUploaded,
        resolutionRate,
        avgResolutionDays,
        // New metrics
        totalItemsDeleted: deletedResponses,
        overallSuccessRate,
        avgScoreImprovement,
        avgCompletionMonths: avgResolutionDays > 0 ? Number((avgResolutionDays / 30).toFixed(1)) : 0,
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
      // New comprehensive data
      monthlyTrends,
      successByCRA,
      successByFlow,
      roundPerformance,
      clientFunnel,
      topPerformingItems,
      fcraViolations,
      recentActivity,
      // Existing data
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
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}

// Format account type for display
function formatAccountType(type: string): string {
  const typeMap: Record<string, string> = {
    "COLLECTION": "Collections",
    "CHARGE_OFF": "Charge-offs",
    "CREDIT_CARD": "Credit Cards",
    "MORTGAGE": "Mortgages",
    "AUTO_LOAN": "Auto Loans",
    "STUDENT_LOAN": "Student Loans",
    "PERSONAL_LOAN": "Personal Loans",
    "MEDICAL": "Medical Collections",
    "RETAIL": "Retail Accounts",
    "UTILITY": "Utility Accounts",
    "OTHER": "Other Accounts",
  };
  return typeMap[type] || type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
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
          client: { isActive: true, archivedAt: null },
        },
      }),
      prisma.creditReport.count({
        where: {
          organizationId,
          uploadedAt: {
            gte: dayStart,
            lt: dayEnd,
          },
          client: { isActive: true, archivedAt: null },
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
    take: 500,
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

async function getMonthlyTrends(organizationId: string, months: number) {
  const results: Array<{
    month: string;
    newClients: number;
    sent: number;
    deleted: number;
    resolved: number;
  }> = [];

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(new Date(), i));
    const monthEnd = startOfMonth(subMonths(new Date(), i - 1));

    const [newClients, disputesSent, disputeResponses, resolved] = await Promise.all([
      // New clients this month (count only active clients)
      prisma.client.count({
        where: {
          organizationId,
          createdAt: { gte: monthStart, lt: monthEnd },
          isActive: true,
          archivedAt: null,
        },
      }),
      // Disputes sent this month
      prisma.dispute.count({
        where: {
          organizationId,
          sentDate: { gte: monthStart, lt: monthEnd },
          client: { isActive: true, archivedAt: null },
        },
      }),
      // Responses with deletions this month
      prisma.disputeResponse.count({
        where: {
          outcome: "DELETED",
          responseDate: { gte: monthStart, lt: monthEnd },
          disputeItem: {
            dispute: { organizationId, client: { isActive: true, archivedAt: null } },
          },
        },
      }),
      // Disputes resolved this month
      prisma.dispute.count({
        where: {
          organizationId,
          resolvedAt: { gte: monthStart, lt: monthEnd },
          client: { isActive: true, archivedAt: null },
        },
      }),
    ]);

    results.push({
      month: format(monthStart, "MMM"),
      newClients,
      sent: disputesSent,
      deleted: disputeResponses,
      resolved,
    });
  }

  return results;
}
