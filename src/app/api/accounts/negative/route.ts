import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  assessDisputeWorthiness,
  type WorthinessInput,
} from "@/lib/dispute-intelligence/worthiness";
import type { DisputeOutcome } from "@/lib/dispute-intelligence/types";
import { createLogger } from "@/lib/logger";
const log = createLogger("negative-accounts-api");

export const dynamic = 'force-dynamic';

// GET /api/accounts/negative - Get all negative/disputable accounts
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch accounts that are marked as disputable (have issues)
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    // EXPANDED FILTER: Get ALL potentially disputable accounts
    // An account is disputable if ANY of these conditions are true:
    // - Has detected issues (issueCount > 0)
    // - Is marked as disputable
    // - Has negative status (Collection, Charged Off, Derogatory)
    // - Has past due amount
    // - Has low/medium confidence (parsing issues)
    // - Has late payment status
    // - Has any balance (potential for disputes)
    const whereClause: any = {
      organizationId: session.user.organizationId,
      client: { isActive: true, archivedAt: null },
      OR: [
        { isDisputable: true },
        { issueCount: { gt: 0 } },
        { detectedIssues: { not: "[]" } }, // Has any detected issues
        { confidenceLevel: { in: ["LOW", "MEDIUM"] } },
        { accountStatus: { in: ["COLLECTION", "CHARGED_OFF", "DEROGATORY", "DELINQUENT"] } },
        { pastDue: { gt: 0 } },
        { paymentStatus: { contains: "Late" } },
        { paymentStatus: { contains: "Delinquent" } },
        { paymentStatus: { contains: "Chargeoff" } },
        { paymentStatus: { contains: "Collection" } },
        // Include accounts with any balance for cross-bureau comparison
        { balance: { gt: 0 } },
      ],
    };

    if (clientId) {
      whereClause.clientId = clientId;
    }

    const accounts = await prisma.accountItem.findMany({
      where: whereClause,
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        evidences: {
          select: {
            id: true,
            evidenceType: true,
            description: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        disputes: {
          where: {
            dispute: {
              status: { notIn: ["RESOLVED", "CANCELLED"] }
            }
          },
          include: {
            dispute: {
              select: {
                id: true,
                status: true,
                round: true,
                createdAt: true,
                cra: true
              }
            }
          }
        }
      },
      orderBy: [
        { confidenceScore: "asc" },
        { createdAt: "desc" },
      ],
    });

    // Get all account fingerprints to find cross-bureau matches
    const allFingerprints = accounts.map(a => a.fingerprint).filter(Boolean);
    const fingerprintMap = new Map<string, typeof accounts>();

    // Group accounts by fingerprint for cross-bureau analysis
    for (const account of accounts) {
      if (account.fingerprint) {
        const existing = fingerprintMap.get(account.fingerprint) || [];
        existing.push(account);
        fingerprintMap.set(account.fingerprint, existing);
      }
    }

    // Get dispute history for all accounts
    const accountIds = accounts.map(a => a.id);
    const disputeResponses = await prisma.disputeResponse.findMany({
      where: {
        disputeItem: {
          accountItemId: { in: accountIds }
        }
      },
      include: {
        disputeItem: {
          include: {
            dispute: {
              select: {
                round: true,
                cra: true,
                createdAt: true
              }
            }
          }
        }
      }
    });

    // Build dispute history map
    const disputeHistoryMap = new Map<string, Array<{
      round: number;
      outcome: DisputeOutcome;
      cra: string;
      date: Date;
    }>>();

    for (const response of disputeResponses) {
      const accountItemId = response.disputeItem.accountItemId;
      const history = disputeHistoryMap.get(accountItemId) || [];
      history.push({
        round: response.disputeItem.dispute.round,
        outcome: response.outcome as DisputeOutcome,
        cra: response.disputeItem.dispute.cra,
        date: response.responseDate
      });
      disputeHistoryMap.set(accountItemId, history);
    }

    // Transform decimal fields to numbers for JSON and calculate worthiness
    const transformedAccounts = accounts.map(account => {
      // Check for active disputes
      // Since we filtered in the query to only include active disputes,
      // if the array has length > 0, it has an active dispute.
      const activeDisputeItem = account.disputes[0];
      const activeDispute = activeDisputeItem ? {
        id: activeDisputeItem.dispute.id,
        status: activeDisputeItem.dispute.status,
        round: activeDisputeItem.dispute.round,
        date: activeDisputeItem.dispute.createdAt,
        cra: activeDisputeItem.dispute.cra
      } : null;

      // Parse detected issues
      let parsedIssues: Array<{ code: string; severity: string }> = [];
      try {
        parsedIssues = account.detectedIssues ? JSON.parse(account.detectedIssues) : [];
      } catch {
        parsedIssues = [];
      }

      // Get cross-bureau accounts with same fingerprint
      const crossBureauAccounts = account.fingerprint
        ? (fingerprintMap.get(account.fingerprint) || [])
        : [account];

      // Build worthiness input
      const worthinessInput: WorthinessInput = {
        account: {
          id: account.id,
          creditorName: account.creditorName,
          accountNumber: account.maskedAccountId,
          cra: account.cra as "TRANSUNION" | "EXPERIAN" | "EQUIFAX",
          accountType: account.accountType,
          accountStatus: account.accountStatus || "UNKNOWN",
          balance: account.balance ? Number(account.balance) : null,
          creditLimit: account.creditLimit ? Number(account.creditLimit) : null,
          pastDue: account.pastDue ? Number(account.pastDue) : null,
          dateOpened: account.dateOpened,
          dateReported: account.dateReported,
          paymentStatus: account.paymentStatus,
          detectedIssues: parsedIssues,
          fingerprint: account.fingerprint || ""
        },
        allAccountsWithFingerprint: crossBureauAccounts.map(a => ({
          id: a.id,
          creditorName: a.creditorName,
          accountNumber: a.maskedAccountId,
          cra: a.cra as "TRANSUNION" | "EXPERIAN" | "EQUIFAX",
          accountType: a.accountType,
          accountStatus: a.accountStatus || "UNKNOWN",
          balance: a.balance ? Number(a.balance) : null,
          creditLimit: a.creditLimit ? Number(a.creditLimit) : null,
          pastDue: a.pastDue ? Number(a.pastDue) : null,
          dateOpened: a.dateOpened,
          dateReported: a.dateReported,
          paymentStatus: a.paymentStatus,
          detectedIssues: [],
          fingerprint: a.fingerprint || ""
        })),
        disputeHistory: disputeHistoryMap.get(account.id) || [],
        hasEvidence: account.evidences.length > 0,
        evidenceType: account.evidences[0]?.evidenceType
      };

      // Calculate worthiness
      const worthiness = assessDisputeWorthiness(worthinessInput);

      return {
        ...account,
        balance: account.balance ? Number(account.balance) : null,
        pastDue: account.pastDue ? Number(account.pastDue) : null,
        creditLimit: account.creditLimit ? Number(account.creditLimit) : null,
        highBalance: account.highBalance ? Number(account.highBalance) : null,
        monthlyPayment: account.monthlyPayment ? Number(account.monthlyPayment) : null,
        activeDispute, // Attach the active dispute info
        worthiness: {
          worthinessScore: worthiness.worthinessScore,
          priorityScore: worthiness.priorityScore,
          successLikelihood: worthiness.successLikelihood,
          timing: worthiness.timing,
          timingReason: worthiness.timingReason,
          recommendedFlow: worthiness.recommendedFlow,
          recommendedApproach: worthiness.recommendedApproach,
          expectedOutcome: worthiness.expectedOutcome,
          confidenceLevel: worthiness.confidenceLevel,
          estimatedScoreImpact: worthiness.estimatedScoreImpact,
          impactReason: worthiness.impactReason,
          factors: {
            bureauReporting: worthiness.factors.bureauReporting,
            hasDivergence: worthiness.factors.hasDivergence,
            previousDisputes: worthiness.factors.previousDisputes,
            wasEverDeleted: worthiness.factors.wasEverDeleted,
            isTimeBared: worthiness.factors.isTimeBared,
            potentialViolations: worthiness.factors.potentialViolations
          }
        }
      };
    });

    // Sort by priority score (highest first)
    transformedAccounts.sort((a, b) => b.worthiness.priorityScore - a.worthiness.priorityScore);

    // If clientId is provided, also fetch inquiries from the client record
    let inquiries: Array<{
      id: string;
      creditorName: string;
      inquiryDate: string;
      cra: string;
      type: "INQUIRY";
      isDisputable: boolean;
      suggestedFlow: string;
    }> = [];

    if (clientId) {
      // Fetch hardInquiries from the most recent CreditReport (not Client model)
      const latestReport = await prisma.creditReport.findFirst({
        where: { clientId },
        orderBy: { reportDate: 'desc' },
        select: { hardInquiries: true },
      });

      if (latestReport?.hardInquiries) {
        try {
          const parsedInquiries = JSON.parse(latestReport.hardInquiries);
          if (Array.isArray(parsedInquiries)) {
            inquiries = parsedInquiries.map((inq: { creditorName: string; inquiryDate: string; cra: string }, index: number) => ({
              id: `inquiry_${clientId}_${index}_${inq.cra}`,
              creditorName: inq.creditorName,
              inquiryDate: inq.inquiryDate,
              cra: inq.cra,
              type: "INQUIRY" as const,
              isDisputable: true,
              suggestedFlow: "CONSENT", // Inquiries use CONSENT flow
              detectedIssues: [{
                code: "UNAUTHORIZED_INQUIRY",
                severity: "MEDIUM",
                description: `Unauthorized hard inquiry from ${inq.creditorName} on ${inq.inquiryDate}`,
              }],
            }));
          }
        } catch {
          // Invalid JSON, skip
        }
      }
    }

    // Calculate summary
    const summary = {
      totalNegative: accounts.length,
      totalInquiries: inquiries.length,
      highSeverity: accounts.filter(a => {
        try {
          const issues = a.detectedIssues ? JSON.parse(a.detectedIssues) : [];
          return issues.some((i: { severity: string }) => i.severity === "HIGH");
        } catch {
          return false;
        }
      }).length,
      collections: accounts.filter(a => a.accountStatus === "COLLECTION").length,
      chargeOffs: accounts.filter(a => a.accountStatus === "CHARGED_OFF").length,
      withPastDue: accounts.filter(a => a.pastDue && Number(a.pastDue) > 0).length,
      withEvidence: accounts.filter(a => a.evidences.length > 0).length,
    };

    return NextResponse.json({
      accounts: transformedAccounts,
      inquiries, // Include inquiries for CONSENT flow disputes
      summary,
    });

  } catch (error) {
    log.error({ err: error }, "Error fetching negative accounts");
    return NextResponse.json(
      { error: "Failed to fetch negative accounts" },
      { status: 500 }
    );
  }
}
