import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

async function getDashboardData(organizationId: string) {
  // Get core stats
  const [
    totalClients,
    activeDisputes,
    pendingReview,
    resolvedDisputes,
    totalDisputes,
    needsReviewCount,
  ] = await Promise.all([
    prisma.client.count({ where: { organizationId, isActive: true, archivedAt: null } }),
    prisma.dispute.count({ where: { organizationId, status: { in: ["DRAFT", "PENDING_REVIEW", "APPROVED", "SENT"] } } }),
    prisma.dispute.count({ where: { organizationId, status: { in: ["PENDING_REVIEW", "RESPONDED"] } } }),
    prisma.dispute.count({ where: { organizationId, status: "RESOLVED" } }),
    prisma.dispute.count({ where: { organizationId } }),
    prisma.accountItem.count({ where: { organizationId, isConfirmed: false, confidenceLevel: "LOW" } }),
  ]);

  // Calculate success rate
  const successRate = totalDisputes > 0 ? Math.round((resolvedDisputes / totalDisputes) * 100) : 0;

  // Get flow statistics
  const flowStats = await prisma.dispute.groupBy({
    by: ["flow"],
    where: { organizationId },
    _count: { id: true },
  });

  const resolvedByFlow = await prisma.dispute.groupBy({
    by: ["flow"],
    where: { organizationId, status: "RESOLVED" },
    _count: { id: true },
  });

  // Transform flow stats
  const flows: Record<string, { active: number; rate: number }> = {
    accuracy: { active: 0, rate: 0 },
    collections: { active: 0, rate: 0 },
    consent: { active: 0, rate: 0 },
    combo: { active: 0, rate: 0 },
  };

  const flowMapping: Record<string, string> = {
    ACCURACY: "accuracy",
    COLLECTION: "collections",
    CONSENT: "consent",
    COMBO: "combo",
  };

  flowStats.forEach((stat) => {
    const key = flowMapping[stat.flow] || stat.flow.toLowerCase();
    if (flows[key]) {
      flows[key].active = stat._count.id;
    }
  });

  resolvedByFlow.forEach((stat) => {
    const key = flowMapping[stat.flow] || stat.flow.toLowerCase();
    if (flows[key] && flows[key].active > 0) {
      flows[key].rate = Math.round((stat._count.id / flows[key].active) * 100);
    }
  });

  // Get recent clients with dispute info and scores
  const recentClients = await prisma.client.findMany({
    where: { organizationId, isActive: true, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 4,
    include: {
      disputes: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          round: true,
          cra: true,
          status: true,
        },
      },
      creditScores: {
        orderBy: { createdAt: "desc" },
        take: 2,
        select: {
          score: true,
          createdAt: true,
        },
      },
      _count: {
        select: { disputes: true },
      },
    },
  });

  // Transform clients for the UI
  const formattedClients = recentClients.map((client) => {
    const latestDispute = client.disputes[0];
    let status: "hot" | "active" | "new" | "winning" = "active";

    if (latestDispute) {
      if (latestDispute.status === "RESOLVED") {
        status = "winning";
      } else if (["SENT", "APPROVED"].includes(latestDispute.status)) {
        status = "hot";
      } else if (latestDispute.status === "DRAFT") {
        status = "new";
      }
    } else {
      status = "new";
    }

    // Calculate score gain
    const currentScore = client.creditScores[0]?.score || null;
    const previousScore = client.creditScores[1]?.score || null;
    const scoreGain = currentScore && previousScore ? currentScore - previousScore : null;

    // Get all active bureaus
    const bureauMap: Record<string, string> = {
      TRANSUNION: "TU",
      EQUIFAX: "EQ",
      EXPERIAN: "EX",
    };

    return {
      id: client.id,
      name: `${client.firstName} ${client.lastName}`,
      initials: `${client.firstName.charAt(0)}${client.lastName.charAt(0)}`,
      round: latestDispute?.round || 1,
      bureaus: latestDispute ? [bureauMap[latestDispute.cra] || "TU"] : [],
      score: currentScore,
      gain: scoreGain,
      status,
    };
  });

  // Get recent wins (resolved disputes with account info)
  const recentWins = await prisma.disputeItem.findMany({
    where: {
      dispute: {
        organizationId,
      },
      outcome: "DELETED",
    },
    orderBy: { createdAt: "desc" },
    take: 3,
    include: {
      accountItem: {
        select: {
          creditorName: true,
          accountType: true,
          cra: true,
        },
      },
      dispute: {
        select: {
          client: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  const formattedWins = recentWins.map((win) => ({
    creditor: win.accountItem.creditorName || "Unknown",
    type: win.accountItem.accountType || "Account",
    bureau: win.accountItem.cra === "TRANSUNION" ? "TU" :
            win.accountItem.cra === "EXPERIAN" ? "EX" : "EQ",
    client: win.dispute.client
      ? `${win.dispute.client.firstName.charAt(0)}. ${win.dispute.client.lastName}`
      : "Client",
  }));

  // Calculate average score improvement
  const clientsWithScoreChanges = await prisma.client.findMany({
    where: { organizationId, isActive: true, archivedAt: null },
    include: {
      creditScores: {
        orderBy: { createdAt: "asc" },
        take: 2,
        select: { score: true },
      },
    },
  });

  let totalScoreGain = 0;
  let clientsWithGain = 0;

  clientsWithScoreChanges.forEach((client) => {
    if (client.creditScores.length >= 2) {
      const first = client.creditScores[0].score;
      const last = client.creditScores[client.creditScores.length - 1].score;
      if (last > first) {
        totalScoreGain += last - first;
        clientsWithGain++;
      }
    }
  });

  const avgScoreGain = clientsWithGain > 0 ? Math.round(totalScoreGain / clientsWithGain) : 0;

  // Count items requiring attention today
  const pendingResponses = await prisma.dispute.count({
    where: {
      organizationId,
      status: "SENT",
      sentDate: {
        lte: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), // 25+ days ago (approaching 30-day deadline)
      },
    },
  });

  const itemsRequiringAttention = pendingReview + pendingResponses + needsReviewCount;

  return {
    stats: {
      totalClients,
      activeDisputes: totalDisputes,
      deletions: resolvedDisputes,
      successRate,
      avgScoreGain,
      // Trends (could be calculated from historical data in production)
      clientsTrend: totalClients > 0 ? "+12%" : undefined,
      disputesTrend: totalDisputes > 0 ? "+8%" : undefined,
      deletionsTrend: resolvedDisputes > 0 ? "+23%" : undefined,
    },
    flows,
    activeClients: formattedClients,
    recentWins: formattedWins,
    itemsRequiringAttention,
    needsReviewCount,
  };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const data = await getDashboardData(session.user.organizationId);

  return (
    <DashboardClient
      userName={session.user.name?.split(" ")[0] || "User"}
      subscriptionTier={session.user.subscriptionTier || "FREE"}
      stats={data.stats}
      flows={data.flows}
      activeClients={data.activeClients}
      recentWins={data.recentWins}
      itemsRequiringAttention={data.itemsRequiringAttention}
    />
  );
}
