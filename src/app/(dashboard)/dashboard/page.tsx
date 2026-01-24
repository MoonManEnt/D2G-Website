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

  // Get recent clients with dispute info
  const recentClients = await prisma.client.findMany({
    where: { organizationId, isActive: true, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 5,
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
      _count: {
        select: { disputes: true },
      },
    },
  });

  // Transform clients for the UI
  const formattedClients = recentClients.map((client) => {
    const latestDispute = client.disputes[0];
    let status: "active" | "pending" | "completed" = "pending";

    if (latestDispute) {
      if (latestDispute.status === "RESOLVED") {
        status = "completed";
      } else if (["SENT", "APPROVED", "DRAFT"].includes(latestDispute.status)) {
        status = "active";
      } else {
        status = "pending";
      }
    }

    // Map CRA to bureau code
    const bureauMap: Record<string, "TU" | "EQ" | "EX"> = {
      TRANSUNION: "TU",
      EQUIFAX: "EQ",
      EXPERIAN: "EX",
    };

    return {
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      disputeCount: client._count.disputes,
      currentRound: latestDispute?.round || 1,
      activeBureau: latestDispute ? bureauMap[latestDispute.cra] || "TU" : null,
      status,
    };
  });

  return {
    stats: {
      totalClients,
      activeDisputes,
      pendingReview,
      successRate,
      // For demo, we could calculate actual changes by comparing to last month
      // For now, show static demo values if there's data
      clientsChange: totalClients > 0 ? 12 : undefined,
      disputesChange: activeDisputes > 0 ? 8 : undefined,
      reviewChange: pendingReview > 0 ? -5 : undefined,
      successChange: successRate > 0 ? 3 : undefined,
    },
    recentClients: formattedClients,
    needsReviewCount,
  };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const data = await getDashboardData(session.user.organizationId);

  return (
    <DashboardClient
      userName={session.user.name || "User"}
      stats={data.stats}
      recentClients={data.recentClients}
      needsReviewCount={data.needsReviewCount}
      subscriptionTier={session.user.subscriptionTier || "FREE"}
    />
  );
}
