import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

async function getDashboardStats(organizationId: string) {
  const [
    clientCount,
    reportCount,
    pendingDisputes,
    resolvedDisputes,
    needsReviewCount,
    negativeItemCount,
    evidenceCount,
    sentDisputes,
  ] = await Promise.all([
    prisma.client.count({ where: { organizationId, isActive: true } }),
    prisma.creditReport.count({ where: { organizationId } }),
    prisma.dispute.count({ where: { organizationId, status: { in: ["DRAFT", "PENDING_REVIEW", "APPROVED"] } } }),
    prisma.dispute.count({ where: { organizationId, status: "RESOLVED" } }),
    prisma.accountItem.count({ where: { organizationId, isConfirmed: false, confidenceLevel: "LOW" } }),
    prisma.accountItem.count({ where: { organizationId, isDisputable: true, issueCount: { gt: 0 } } }),
    prisma.evidence.count({ where: { organizationId } }),
    prisma.dispute.count({ where: { organizationId, status: "SENT" } }),
  ]);

  return {
    clientCount,
    reportCount,
    pendingDisputes,
    resolvedDisputes,
    needsReviewCount,
    negativeItemCount,
    evidenceCount,
    sentDisputes,
  };
}

async function getRecentActivity(organizationId: string) {
  return prisma.eventLog.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      actor: { select: { name: true } },
    },
  });
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const stats = await getDashboardStats(session.user.organizationId);
  const recentActivity = await getRecentActivity(session.user.organizationId);

  const statCards = [
    {
      title: "Active Clients",
      value: stats.clientCount,
      icon: "Users",
      color: "text-brand-info",
      bgColor: "bg-brand-info/10",
      href: "/clients",
    },
    {
      title: "Negative Items",
      value: stats.negativeItemCount,
      icon: "AlertTriangle",
      color: "text-brand-error",
      bgColor: "bg-brand-error/10",
      href: "/negative-items",
    },
    {
      title: "Active Disputes",
      value: stats.pendingDisputes + stats.sentDisputes,
      icon: "Scale",
      color: "text-brand-warning",
      bgColor: "bg-brand-warning/10",
      href: "/disputes",
    },
    {
      title: "Resolved",
      value: stats.resolvedDisputes,
      icon: "CheckCircle2",
      color: "text-brand-success",
      bgColor: "bg-brand-success/10",
      href: "/disputes",
    },
  ];

  return (
    <DashboardClient
      userName={session.user.name || "User"}
      statCards={statCards}
      needsReviewCount={stats.needsReviewCount}
      recentActivity={recentActivity.map(e => ({
        id: e.id,
        eventType: e.eventType,
        createdAt: e.createdAt,
        actor: e.actor,
      }))}
      subscriptionTier={session.user.subscriptionTier || "FREE"}
    />
  );
}
