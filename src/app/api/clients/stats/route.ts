import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";

export const GET = withAuth(async (req, { organizationId }) => {
  const [
    totalClients,
    urgentClients,
    activeDisputes,
    needsActionCount,
    newThisWeek,
  ] = await Promise.all([
    prisma.client.count({
      where: { organizationId, isActive: true, archivedAt: null },
    }),
    prisma.client.count({
      where: { organizationId, isActive: true, archivedAt: null, priority: "URGENT" },
    }),
    // Only count disputes for active, non-archived clients
    prisma.dispute.count({
      where: {
        organizationId,
        status: { in: ["DRAFT", "PENDING_REVIEW", "APPROVED", "SENT"] },
        client: {
          isActive: true,
          archivedAt: null,
        },
      },
    }),
    // Only count needs action for active, non-archived clients
    prisma.dispute.count({
      where: {
        organizationId,
        status: { in: ["PENDING_REVIEW", "RESPONDED"] },
        client: {
          isActive: true,
          archivedAt: null,
        },
      },
    }),
    prisma.client.count({
      where: {
        organizationId,
        isActive: true,
        archivedAt: null,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  // Calculate average success rate - only for active clients
  const disputeItems = await prisma.disputeItem.findMany({
    where: {
      dispute: {
        organizationId,
        client: {
          isActive: true,
          archivedAt: null,
        },
      },
      outcome: { not: null },
    },
    select: { outcome: true },
  });

  const successfulOutcomes = disputeItems.filter(
    (i) => i.outcome === "DELETED" || i.outcome === "UPDATED"
  ).length;
  const resolvedOutcomes = disputeItems.filter(
    (i) => i.outcome !== "PENDING"
  ).length;
  const avgSuccessRate = resolvedOutcomes > 0
    ? Math.round((successfulOutcomes / resolvedOutcomes) * 100)
    : 0;

  return NextResponse.json({
    totalClients,
    urgentClients,
    activeDisputes,
    needsActionCount,
    newThisWeek,
    avgSuccessRate,
  });
});
