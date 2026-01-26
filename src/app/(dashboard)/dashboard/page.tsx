import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

// ============================================================================
// Types for Dashboard Data
// ============================================================================

interface ActionQueueItem {
  id: string;
  type: "response" | "send" | "parse" | "followup" | "escalate";
  priority: "urgent" | "high" | "medium" | "low";
  title: string;
  client: { id: string; name: string; initials: string };
  detail: string;
  bureau: string | null;
  age: string;
  action: string;
  linkTo: string;
}

interface RecentResponse {
  id: string;
  bureau: string;
  client: string;
  clientId: string;
  time: string;
  result: "success" | "stall" | "mixed";
  deleted: number;
  verified: number;
}

interface ApproachingDeadline {
  id: string;
  client: string;
  clientId: string;
  bureau: string;
  daysLeft: number;
  round: number;
  sentDate: string;
}

interface DashboardStats {
  totalClients: number;
  activeDisputes: number;
  successRate: number;
  deletionsThisMonth: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function timeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getBureauShort(cra: string): string {
  const map: Record<string, string> = {
    TRANSUNION: "TU",
    EXPERIAN: "EX",
    EQUIFAX: "EQ",
  };
  return map[cra] || cra;
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// ============================================================================
// Data Fetching
// ============================================================================

async function getDashboardData(organizationId: string) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Filter for active clients only
  const activeClientFilter = { isActive: true, archivedAt: null };

  // Parallel fetch all data
  const [
    // Stats
    totalClients,
    activeDisputes,
    totalDisputes,
    resolvedDisputes,
    deletionsThisMonth,

    // Action Queue Sources
    pendingResponses,
    readyToSendDisputes,
    pendingParseReports,
    upcomingReminders,
    escalationCandidates,

    // Recent Responses
    recentResponses,

    // Approaching Deadlines
    sentDisputes,
  ] = await Promise.all([
    // Stats
    prisma.client.count({ where: { organizationId, ...activeClientFilter } }),
    prisma.dispute.count({
      where: {
        organizationId,
        status: { in: ["DRAFT", "PENDING_REVIEW", "APPROVED", "SENT"] },
        client: activeClientFilter,
      },
    }),
    prisma.dispute.count({ where: { organizationId, client: activeClientFilter } }),
    prisma.dispute.count({ where: { organizationId, status: "RESOLVED", client: activeClientFilter } }),
    prisma.disputeItem.count({
      where: {
        dispute: { organizationId, client: activeClientFilter },
        outcome: "DELETED",
        createdAt: { gte: startOfMonth },
      },
    }),

    // Disputes with RESPONDED status (need review)
    prisma.dispute.findMany({
      where: { organizationId, status: "RESPONDED", client: activeClientFilter },
      orderBy: { respondedAt: "desc" },
      take: 10,
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        items: {
          include: {
            responses: { orderBy: { responseDate: "desc" }, take: 1 },
          },
        },
      },
    }),

    // Disputes ready to send (approved)
    prisma.dispute.findMany({
      where: { organizationId, status: "APPROVED", client: activeClientFilter },
      orderBy: { approvedAt: "desc" },
      take: 10,
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { items: true } },
      },
    }),

    // Reports pending parse
    prisma.creditReport.findMany({
      where: { organizationId, parseStatus: "PENDING", client: activeClientFilter },
      orderBy: { uploadedAt: "desc" },
      take: 10,
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
      },
    }),

    // Upcoming reminders (today)
    prisma.reminder.findMany({
      where: {
        client: { organizationId, ...activeClientFilter },
        status: "PENDING",
        scheduledFor: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lte: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      },
      orderBy: { scheduledFor: "asc" },
      take: 10,
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
      },
    }),

    // Disputes sent 30+ days ago with no response (escalation candidates)
    prisma.dispute.findMany({
      where: {
        organizationId,
        status: "SENT",
        sentDate: { lte: thirtyDaysAgo },
        client: activeClientFilter,
      },
      orderBy: { sentDate: "asc" },
      take: 10,
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
      },
    }),

    // Recent responses (from DisputeResponse table)
    prisma.disputeResponse.findMany({
      where: {
        disputeItem: {
          dispute: { organizationId, client: activeClientFilter },
        },
      },
      orderBy: { responseDate: "desc" },
      take: 5,
      include: {
        disputeItem: {
          include: {
            accountItem: { select: { cra: true } },
            dispute: {
              include: {
                client: { select: { id: true, firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    }),

    // Sent disputes approaching deadline
    prisma.dispute.findMany({
      where: {
        organizationId,
        status: "SENT",
        sentDate: { not: null },
        client: activeClientFilter,
      },
      orderBy: { sentDate: "asc" },
      take: 10,
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
  ]);

  // Calculate success rate
  const successRate = totalDisputes > 0 ? Math.round((resolvedDisputes / totalDisputes) * 100) : 0;

  // Build Action Queue
  const actionQueue: ActionQueueItem[] = [];

  // 1. Responses to review (urgent)
  pendingResponses.forEach((dispute) => {
    const deletedCount = dispute.items.filter((i) =>
      i.responses.some((r) => r.outcome === "DELETED")
    ).length;
    const verifiedCount = dispute.items.filter((i) =>
      i.responses.some((r) => r.outcome === "VERIFIED")
    ).length;
    const hasStall = dispute.items.some((i) =>
      i.responses.some((r) => r.outcome === "STALL_LETTER")
    );

    let detail = "";
    if (hasStall) {
      detail = "Stall letter received";
    } else if (deletedCount > 0 || verifiedCount > 0) {
      detail = `Contains ${verifiedCount} verified, ${deletedCount} deleted items`;
    } else {
      detail = `${dispute.items.length} items responded`;
    }

    actionQueue.push({
      id: dispute.id,
      type: "response",
      priority: "urgent",
      title: `Review ${getBureauShort(dispute.cra)} response`,
      client: {
        id: dispute.client.id,
        name: `${dispute.client.firstName} ${dispute.client.lastName}`,
        initials: getInitials(dispute.client.firstName, dispute.client.lastName),
      },
      detail,
      bureau: getBureauShort(dispute.cra),
      age: dispute.respondedAt ? timeAgo(dispute.respondedAt) : "Recently",
      action: "Review Now",
      linkTo: `/clients/${dispute.client.id}?tab=disputes&dispute=${dispute.id}`,
    });
  });

  // 2. Letters ready to send (urgent)
  readyToSendDisputes.forEach((dispute) => {
    actionQueue.push({
      id: dispute.id,
      type: "send",
      priority: "urgent",
      title: `R${dispute.round} letters ready to send`,
      client: {
        id: dispute.client.id,
        name: `${dispute.client.firstName} ${dispute.client.lastName}`,
        initials: getInitials(dispute.client.firstName, dispute.client.lastName),
      },
      detail: `${dispute._count.items} dispute letters generated`,
      bureau: getBureauShort(dispute.cra),
      age: dispute.approvedAt ? timeAgo(dispute.approvedAt) : "Due today",
      action: "Send Letters",
      linkTo: `/clients/${dispute.client.id}?tab=disputes&dispute=${dispute.id}`,
    });
  });

  // 3. Reports to parse (medium)
  pendingParseReports.forEach((report) => {
    actionQueue.push({
      id: report.id,
      type: "parse",
      priority: "medium",
      title: "New credit report uploaded",
      client: {
        id: report.client.id,
        name: `${report.client.firstName} ${report.client.lastName}`,
        initials: getInitials(report.client.firstName, report.client.lastName),
      },
      detail: `${report.sourceType} report`,
      bureau: "ALL",
      age: timeAgo(report.uploadedAt),
      action: "Parse Report",
      linkTo: `/clients/${report.client.id}?tab=reports`,
    });
  });

  // 4. Follow-up reminders (medium)
  upcomingReminders.forEach((reminder) => {
    const reminderTime = reminder.scheduledFor.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    actionQueue.push({
      id: reminder.id,
      type: "followup",
      priority: "medium",
      title: reminder.title || "Follow-up scheduled",
      client: {
        id: reminder.client.id,
        name: `${reminder.client.firstName} ${reminder.client.lastName}`,
        initials: getInitials(reminder.client.firstName, reminder.client.lastName),
      },
      detail: reminder.description || "Client follow-up",
      bureau: null,
      age: `Today ${reminderTime}`,
      action: "View Details",
      linkTo: `/clients/${reminder.client.id}`,
    });
  });

  // 5. Escalation candidates (low)
  escalationCandidates.forEach((dispute) => {
    const daysSinceSent = dispute.sentDate
      ? Math.floor((now.getTime() - dispute.sentDate.getTime()) / 86400000)
      : 30;

    actionQueue.push({
      id: dispute.id,
      type: "escalate",
      priority: "low",
      title: `Ready for Round ${dispute.round + 1} escalation`,
      client: {
        id: dispute.client.id,
        name: `${dispute.client.firstName} ${dispute.client.lastName}`,
        initials: getInitials(dispute.client.firstName, dispute.client.lastName),
      },
      detail: `${daysSinceSent} days passed, no bureau response`,
      bureau: getBureauShort(dispute.cra),
      age: dispute.sentDate ? timeAgo(dispute.sentDate) : "30+ days",
      action: `Start R${dispute.round + 1}`,
      linkTo: `/clients/${dispute.client.id}?tab=disputes`,
    });
  });

  // Sort action queue by priority
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  actionQueue.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Format Recent Responses
  const formattedResponses: RecentResponse[] = [];
  const seenDisputes = new Set<string>();

  recentResponses.forEach((response) => {
    const dispute = response.disputeItem.dispute;
    if (seenDisputes.has(dispute.id)) return;
    seenDisputes.add(dispute.id);

    // Count outcomes for this dispute
    const allResponses = response.disputeItem.dispute.id; // We'd need another query for full accuracy
    const isSuccess = response.outcome === "DELETED";
    const isStall = response.outcome === "STALL_LETTER";

    formattedResponses.push({
      id: response.id,
      bureau: getBureauShort(response.disputeItem.accountItem.cra),
      client: `${dispute.client.firstName} ${dispute.client.lastName}`,
      clientId: dispute.client.id,
      time: timeAgo(response.responseDate),
      result: isStall ? "stall" : isSuccess ? "success" : "mixed",
      deleted: isSuccess ? 1 : 0,
      verified: response.outcome === "VERIFIED" ? 1 : 0,
    });
  });

  // Format Approaching Deadlines
  const formattedDeadlines: ApproachingDeadline[] = sentDisputes
    .map((dispute) => {
      if (!dispute.sentDate) return null;

      const deadlineDate = new Date(dispute.sentDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      const daysLeft = Math.max(
        0,
        Math.ceil((deadlineDate.getTime() - now.getTime()) / 86400000)
      );

      // Only show if within 30 days
      if (daysLeft > 30) return null;

      return {
        id: dispute.id,
        client: `${dispute.client.firstName} ${dispute.client.lastName}`,
        clientId: dispute.client.id,
        bureau: getBureauShort(dispute.cra),
        daysLeft,
        round: dispute.round,
        sentDate: formatShortDate(dispute.sentDate),
      };
    })
    .filter((d): d is ApproachingDeadline => d !== null)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 5);

  // Build Stats
  const stats: DashboardStats = {
    totalClients,
    activeDisputes,
    successRate,
    deletionsThisMonth,
  };

  return {
    stats,
    actionQueue,
    responses: formattedResponses,
    deadlines: formattedDeadlines,
  };
}

// ============================================================================
// Page Component
// ============================================================================

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const data = await getDashboardData(session.user.organizationId);

  return (
    <DashboardClient
      userName={session.user.name?.split(" ")[0] || "User"}
      stats={data.stats}
      actionQueue={data.actionQueue}
      responses={data.responses}
      deadlines={data.deadlines}
    />
  );
}
