/**
 * SENTRY TRACKING API
 *
 * GET /api/sentry/tracking?clientId=xxx - Get tracking matrix data for a client
 *
 * Returns comprehensive tracking data including:
 * - Account matrix across all bureaus and rounds
 * - Quick stats (active, awaiting, overdue, success rate)
 * - Recent activity
 * - Pending actions
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';

interface BureauStatus {
  round: number;
  status: "NOT_STARTED" | "DRAFT" | "SENT" | "RESPONDED" | "RESOLVED";
  outcome?: "DELETED" | "VERIFIED" | "UPDATED" | "NO_RESPONSE" | "STALL_LETTER" | null;
  disputeId?: string;
  disputeItemId?: string;
  sentDate?: string;
  responseDate?: string;
  daysRemaining?: number;
  isOverdue?: boolean;
}

interface AccountTracking {
  accountId: string;
  creditorName: string;
  maskedAccountId: string;
  transunion: BureauStatus;
  experian: BureauStatus;
  equifax: BureauStatus;
  bestOutcome: "DELETED" | "VERIFIED" | "UPDATED" | "PENDING" | "NOT_STARTED";
}

interface QuickStats {
  activeDisputes: number;
  awaitingResponse: number;
  overdue: number;
  successRate: number;
  totalDeleted: number;
  totalDisputed: number;
  byBureau: {
    transunion: { active: number; deleted: number; total: number };
    experian: { active: number; deleted: number; total: number };
    equifax: { active: number; deleted: number; total: number };
  };
}

interface RecentActivity {
  id: string;
  date: string;
  type: "CREATED" | "SENT" | "RESPONSE" | "RESOLVED";
  creditorName: string;
  cra: string;
  round: number;
  outcome?: string;
  disputeId: string;
}

interface PendingAction {
  id: string;
  type: "SEND_DRAFT" | "RECORD_RESPONSE" | "OVERDUE" | "START_NEXT_ROUND";
  priority: "HIGH" | "MEDIUM" | "LOW";
  creditorName: string;
  cra: string;
  round: number;
  disputeId?: string;
  accountId?: string;
  message: string;
  daysOverdue?: number;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");

    if (!clientId) {
      return NextResponse.json(
        { error: "clientId is required" },
        { status: 400 }
      );
    }

    // Verify client belongs to organization
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: session.user.organizationId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get all unique accounts for this client (from most recent report)
    const accounts = await prisma.accountItem.findMany({
      where: {
        clientId,
        organizationId: session.user.organizationId,
      },
      select: {
        id: true,
        creditorName: true,
        maskedAccountId: true,
        cra: true,
      },
      orderBy: { creditorName: "asc" },
    });

    // Group accounts by creditor name (to show same account across bureaus)
    const accountsByCreditor = new Map<string, typeof accounts>();
    for (const account of accounts) {
      const key = account.creditorName.toUpperCase().trim();
      if (!accountsByCreditor.has(key)) {
        accountsByCreditor.set(key, []);
      }
      accountsByCreditor.get(key)!.push(account);
    }

    // Get all Sentry disputes for this client
    const disputes = await prisma.sentryDispute.findMany({
      where: {
        clientId,
        organizationId: session.user.organizationId,
      },
      include: {
        items: {
          include: {
            accountItem: {
              select: {
                id: true,
                creditorName: true,
                maskedAccountId: true,
                cra: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Build tracking matrix
    const trackingMatrix: AccountTracking[] = [];
    const now = new Date();

    for (const [creditorKey, creditorAccounts] of accountsByCreditor) {
      const firstAccount = creditorAccounts[0];

      const getBureauStatus = (cra: string): BureauStatus => {
        const craAccount = creditorAccounts.find(a => a.cra === cra);
        if (!craAccount) {
          return { round: 0, status: "NOT_STARTED" };
        }

        // Find all disputes for this account
        const accountDisputes = disputes.filter(d =>
          d.cra === cra &&
          d.items.some(i => i.accountItem.creditorName.toUpperCase().trim() === creditorKey)
        ).sort((a, b) => b.round - a.round);

        if (accountDisputes.length === 0) {
          return { round: 0, status: "NOT_STARTED" };
        }

        const latestDispute = accountDisputes[0];
        const disputeItem = latestDispute.items.find(
          i => i.accountItem.creditorName.toUpperCase().trim() === creditorKey
        );

        let status: BureauStatus["status"] = "DRAFT";
        let daysRemaining: number | undefined;
        let isOverdue = false;

        if (latestDispute.status === "DRAFT") {
          status = "DRAFT";
        } else if (latestDispute.status === "SENT") {
          status = "SENT";
          if (latestDispute.sentDate) {
            const sentDate = new Date(latestDispute.sentDate);
            const deadline = new Date(sentDate.getTime() + 30 * 24 * 60 * 60 * 1000);
            daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
            isOverdue = daysRemaining < 0;
          }
        } else if (latestDispute.status === "RESPONDED") {
          status = "RESPONDED";
        } else if (latestDispute.status === "RESOLVED") {
          status = "RESOLVED";
        }

        return {
          round: latestDispute.round,
          status,
          outcome: disputeItem?.outcome as BureauStatus["outcome"] || null,
          disputeId: latestDispute.id,
          disputeItemId: disputeItem?.id,
          sentDate: latestDispute.sentDate?.toISOString(),
          responseDate: disputeItem?.responseDate?.toISOString(),
          daysRemaining: daysRemaining !== undefined ? Math.max(0, daysRemaining) : undefined,
          isOverdue,
        };
      };

      const tuStatus = getBureauStatus("TRANSUNION");
      const exStatus = getBureauStatus("EXPERIAN");
      const eqStatus = getBureauStatus("EQUIFAX");

      // Determine best outcome
      let bestOutcome: AccountTracking["bestOutcome"] = "NOT_STARTED";
      const outcomes = [tuStatus.outcome, exStatus.outcome, eqStatus.outcome].filter(Boolean);
      if (outcomes.includes("DELETED")) {
        bestOutcome = "DELETED";
      } else if (outcomes.includes("UPDATED")) {
        bestOutcome = "UPDATED";
      } else if (outcomes.includes("VERIFIED")) {
        bestOutcome = "VERIFIED";
      } else if (tuStatus.status !== "NOT_STARTED" || exStatus.status !== "NOT_STARTED" || eqStatus.status !== "NOT_STARTED") {
        bestOutcome = "PENDING";
      }

      trackingMatrix.push({
        accountId: firstAccount.id,
        creditorName: firstAccount.creditorName,
        maskedAccountId: firstAccount.maskedAccountId,
        transunion: tuStatus,
        experian: exStatus,
        equifax: eqStatus,
        bestOutcome,
      });
    }

    // Calculate quick stats
    const allDisputeItems = disputes.flatMap(d => d.items);
    const sentDisputes = disputes.filter(d => d.status === "SENT");
    const resolvedItems = allDisputeItems.filter(i => i.outcome);
    const deletedItems = allDisputeItems.filter(i => i.outcome === "DELETED");

    const overdueDisputes = sentDisputes.filter(d => {
      if (!d.sentDate) return false;
      const deadline = new Date(d.sentDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      return deadline < now;
    });

    const getBureauStats = (cra: string) => {
      const bureauDisputes = disputes.filter(d => d.cra === cra);
      const bureauItems = bureauDisputes.flatMap(d => d.items);
      return {
        active: bureauDisputes.filter(d => d.status === "SENT" || d.status === "DRAFT").length,
        deleted: bureauItems.filter(i => i.outcome === "DELETED").length,
        total: bureauItems.filter(i => i.outcome).length,
      };
    };

    const quickStats: QuickStats = {
      activeDisputes: disputes.filter(d => d.status === "DRAFT" || d.status === "SENT").length,
      awaitingResponse: sentDisputes.length,
      overdue: overdueDisputes.length,
      successRate: resolvedItems.length > 0
        ? Math.round((deletedItems.length / resolvedItems.length) * 100)
        : 0,
      totalDeleted: deletedItems.length,
      totalDisputed: resolvedItems.length,
      byBureau: {
        transunion: getBureauStats("TRANSUNION"),
        experian: getBureauStats("EXPERIAN"),
        equifax: getBureauStats("EQUIFAX"),
      },
    };

    // Build recent activity
    const recentActivity: RecentActivity[] = [];
    for (const dispute of disputes.slice(0, 20)) {
      // Add creation event
      recentActivity.push({
        id: `${dispute.id}-created`,
        date: dispute.createdAt.toISOString(),
        type: "CREATED",
        creditorName: dispute.items[0]?.accountItem.creditorName || "Unknown",
        cra: dispute.cra,
        round: dispute.round,
        disputeId: dispute.id,
      });

      // Add sent event if applicable
      if (dispute.sentDate) {
        recentActivity.push({
          id: `${dispute.id}-sent`,
          date: dispute.sentDate.toISOString(),
          type: "SENT",
          creditorName: dispute.items[0]?.accountItem.creditorName || "Unknown",
          cra: dispute.cra,
          round: dispute.round,
          disputeId: dispute.id,
        });
      }

      // Add response events
      for (const item of dispute.items) {
        if (item.responseDate) {
          recentActivity.push({
            id: `${item.id}-response`,
            date: item.responseDate.toISOString(),
            type: item.outcome ? "RESOLVED" : "RESPONSE",
            creditorName: item.accountItem.creditorName,
            cra: dispute.cra,
            round: dispute.round,
            outcome: item.outcome || undefined,
            disputeId: dispute.id,
          });
        }
      }
    }

    // Sort by date descending
    recentActivity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Build pending actions
    const pendingActions: PendingAction[] = [];

    // Draft disputes that need to be sent
    const draftDisputes = disputes.filter(d => d.status === "DRAFT");
    for (const draft of draftDisputes) {
      pendingActions.push({
        id: `send-${draft.id}`,
        type: "SEND_DRAFT",
        priority: "HIGH",
        creditorName: draft.items.map(i => i.accountItem.creditorName).join(", "),
        cra: draft.cra,
        round: draft.round,
        disputeId: draft.id,
        message: `Round ${draft.round} draft needs to be sent`,
      });
    }

    // Overdue responses
    for (const dispute of overdueDisputes) {
      const sentDate = new Date(dispute.sentDate!);
      const daysOverdue = Math.ceil((now.getTime() - sentDate.getTime()) / (24 * 60 * 60 * 1000)) - 30;
      pendingActions.push({
        id: `overdue-${dispute.id}`,
        type: "OVERDUE",
        priority: "HIGH",
        creditorName: dispute.items.map(i => i.accountItem.creditorName).join(", "),
        cra: dispute.cra,
        round: dispute.round,
        disputeId: dispute.id,
        message: `Response overdue by ${daysOverdue} days`,
        daysOverdue,
      });
    }

    // Sent disputes awaiting response (not overdue)
    const awaitingDisputes = sentDisputes.filter(d => !overdueDisputes.includes(d));
    for (const dispute of awaitingDisputes) {
      pendingActions.push({
        id: `record-${dispute.id}`,
        type: "RECORD_RESPONSE",
        priority: "MEDIUM",
        creditorName: dispute.items.map(i => i.accountItem.creditorName).join(", "),
        cra: dispute.cra,
        round: dispute.round,
        disputeId: dispute.id,
        message: `Awaiting response - record when received`,
      });
    }

    // Accounts ready for next round (responded with VERIFIED)
    for (const dispute of disputes.filter(d => d.status === "RESPONDED" || d.status === "RESOLVED")) {
      for (const item of dispute.items) {
        if (item.outcome === "VERIFIED" && dispute.round < 4) {
          pendingActions.push({
            id: `next-round-${item.id}`,
            type: "START_NEXT_ROUND",
            priority: "LOW",
            creditorName: item.accountItem.creditorName,
            cra: dispute.cra,
            round: dispute.round + 1,
            accountId: item.accountItemId,
            message: `Ready for Round ${dispute.round + 1}`,
          });
        }
      }
    }

    // Sort pending actions by priority
    const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    pendingActions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return NextResponse.json({
      success: true,
      client: {
        id: client.id,
        name: `${client.firstName} ${client.lastName}`,
      },
      trackingMatrix,
      quickStats,
      recentActivity: recentActivity.slice(0, 15),
      pendingActions,
    });
  } catch (error) {
    console.error("Error fetching Sentry tracking data:", error);
    return NextResponse.json(
      { error: "Failed to fetch tracking data" },
      { status: 500 }
    );
  }
}
