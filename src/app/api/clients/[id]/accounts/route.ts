import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
const log = createLogger("client-accounts-api");

export const dynamic = 'force-dynamic';

// Response waiting period in days (FCRA requires response within 30 days, allow 45 for buffer)
const RESPONSE_WAITING_PERIOD_DAYS = 45;

/**
 * GET /api/clients/[id]/accounts - Get accounts for a client
 *
 * Query params:
 * - reportId: (optional) Filter accounts by specific report
 * - cra: (optional) Filter by credit bureau (TRANSUNION, EQUIFAX, EXPERIAN)
 * - disputableOnly: (optional) Only return disputable accounts
 * - includeDisputeStatus: (optional) Include dispute availability info per account
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: clientId } = await params;
    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get("reportId");
    const cra = searchParams.get("cra");
    const disputableOnly = searchParams.get("disputableOnly") === "true";
    const includeDisputeStatus = searchParams.get("includeDisputeStatus") === "true";

    // Verify client belongs to organization and is active
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: session.user.organizationId,
        isActive: true,
        archivedAt: null,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Build query
    const where: Record<string, unknown> = {
      clientId,
      organizationId: session.user.organizationId,
    };

    if (reportId) {
      where.reportId = reportId;
    }

    if (cra) {
      where.cra = cra.toUpperCase();
    }

    if (disputableOnly) {
      where.isDisputable = true;
    }

    // Fetch accounts
    const accounts = await prisma.accountItem.findMany({
      where,
      select: {
        id: true,
        creditorName: true,
        maskedAccountId: true,
        cra: true,
        accountType: true,
        accountStatus: true,
        balance: true,
        pastDue: true,
        creditLimit: true,
        highBalance: true,
        dateOpened: true,
        dateReported: true,
        paymentStatus: true,
        isDisputable: true,
        issueCount: true,
        detectedIssues: true,
        suggestedFlow: true,
        sourcePageNum: true,
        reportId: true,
        confidenceScore: true,
        confidenceLevel: true,
      },
      orderBy: [
        { issueCount: "desc" },
        { creditorName: "asc" },
      ],
    });

    // Fetch dispute status for each account if requested
    let disputeStatusMap: Map<string, {
      status: "available" | "in_active_dispute" | "waiting_response" | "locked";
      reason?: string;
      disputeId?: string;
      round?: number;
      sentDate?: Date;
      daysRemaining?: number;
    }> = new Map();

    if (includeDisputeStatus && accounts.length > 0) {
      const accountIds = accounts.map(a => a.id);
      const targetCra = cra?.toUpperCase();

      // Get all dispute items for these accounts
      const disputeItems = await prisma.disputeItem.findMany({
        where: {
          accountItemId: { in: accountIds },
          ...(targetCra && {
            dispute: { cra: targetCra },
          }),
        },
        include: {
          dispute: {
            select: {
              id: true,
              cra: true,
              status: true,
              round: true,
              sentDate: true,
              deadlineDate: true,
            },
          },
        },
      });

      // Also check for locked accounts
      const lockedAccounts = await prisma.accountItem.findMany({
        where: {
          id: { in: accountIds },
          isLockedInDispute: true,
        },
        select: {
          id: true,
          lockedByDisputeId: true,
          lockedBySystem: true,
        },
      });

      const lockedMap = new Map(lockedAccounts.map(a => [a.id, a]));

      // Calculate status for each account
      const now = new Date();
      const waitingPeriodMs = RESPONSE_WAITING_PERIOD_DAYS * 24 * 60 * 60 * 1000;

      for (const accountId of accountIds) {
        // Check if locked first
        const locked = lockedMap.get(accountId);
        if (locked) {
          disputeStatusMap.set(accountId, {
            status: "locked",
            reason: `Locked by ${locked.lockedBySystem || "dispute"}`,
            disputeId: locked.lockedByDisputeId || undefined,
          });
          continue;
        }

        // Find disputes for this account (filtered by CRA if specified)
        const accountDisputes = disputeItems.filter(
          item => item.accountItemId === accountId &&
            (!targetCra || item.dispute.cra === targetCra)
        );

        if (accountDisputes.length === 0) {
          disputeStatusMap.set(accountId, { status: "available" });
          continue;
        }

        // Check for active (DRAFT) disputes
        const activeDispute = accountDisputes.find(
          item => item.dispute.status === "DRAFT"
        );
        if (activeDispute) {
          disputeStatusMap.set(accountId, {
            status: "in_active_dispute",
            reason: `Draft dispute in progress (Round ${activeDispute.dispute.round})`,
            disputeId: activeDispute.dispute.id,
            round: activeDispute.dispute.round,
          });
          continue;
        }

        // Check for sent disputes within waiting period
        const sentDispute = accountDisputes.find(item => {
          if (item.dispute.status !== "SENT" || !item.dispute.sentDate) {
            return false;
          }
          const sentTime = new Date(item.dispute.sentDate).getTime();
          return now.getTime() - sentTime < waitingPeriodMs;
        });

        if (sentDispute && sentDispute.dispute.sentDate) {
          const sentTime = new Date(sentDispute.dispute.sentDate).getTime();
          const daysElapsed = Math.floor((now.getTime() - sentTime) / (24 * 60 * 60 * 1000));
          const daysRemaining = RESPONSE_WAITING_PERIOD_DAYS - daysElapsed;

          disputeStatusMap.set(accountId, {
            status: "waiting_response",
            reason: `Awaiting CRA response (${daysRemaining} days remaining)`,
            disputeId: sentDispute.dispute.id,
            round: sentDispute.dispute.round,
            sentDate: sentDispute.dispute.sentDate,
            daysRemaining,
          });
          continue;
        }

        // Account is available (previous disputes completed or expired)
        disputeStatusMap.set(accountId, { status: "available" });
      }
    }

    // Transform for response
    const transformedAccounts = accounts.map((account) => {
      const disputeStatus = disputeStatusMap.get(account.id);
      return {
        ...account,
        balance: account.balance ? Number(account.balance) : null,
        pastDue: account.pastDue ? Number(account.pastDue) : null,
        creditLimit: account.creditLimit ? Number(account.creditLimit) : null,
        highBalance: account.highBalance ? Number(account.highBalance) : null,
        ...(includeDisputeStatus && disputeStatus && {
          disputeStatus: disputeStatus.status,
          disputeStatusReason: disputeStatus.reason,
          disputeId: disputeStatus.disputeId,
          currentRound: disputeStatus.round,
          daysRemaining: disputeStatus.daysRemaining,
        }),
      };
    });

    // Calculate summary stats
    const availableCount = includeDisputeStatus
      ? Array.from(disputeStatusMap.values()).filter(s => s.status === "available").length
      : accounts.length;

    const stats = {
      total: accounts.length,
      available: availableCount,
      byBureau: {
        transunion: accounts.filter(a => a.cra === "TRANSUNION").length,
        equifax: accounts.filter(a => a.cra === "EQUIFAX").length,
        experian: accounts.filter(a => a.cra === "EXPERIAN").length,
      },
      disputable: accounts.filter(a => a.isDisputable).length,
      withIssues: accounts.filter(a => a.issueCount > 0).length,
      ...(includeDisputeStatus && {
        unavailable: {
          inActiveDispute: Array.from(disputeStatusMap.values()).filter(s => s.status === "in_active_dispute").length,
          waitingResponse: Array.from(disputeStatusMap.values()).filter(s => s.status === "waiting_response").length,
          locked: Array.from(disputeStatusMap.values()).filter(s => s.status === "locked").length,
        },
      }),
    };

    return NextResponse.json({
      accounts: transformedAccounts,
      stats,
    });
  } catch (error) {
    log.error({ err: error }, "Error fetching client accounts");
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}
