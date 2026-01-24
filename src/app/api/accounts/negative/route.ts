import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

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

    const whereClause: any = {
      organizationId: session.user.organizationId,
      OR: [
        { confidenceLevel: { in: ["LOW", "MEDIUM"] } },
        { accountStatus: { in: ["COLLECTION", "CHARGED_OFF"] } },
        { pastDue: { gt: 0 } },
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

    // Transform decimal fields to numbers for JSON
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

      return {
        ...account,
        balance: account.balance ? Number(account.balance) : null,
        pastDue: account.pastDue ? Number(account.pastDue) : null,
        creditLimit: account.creditLimit ? Number(account.creditLimit) : null,
        highBalance: account.highBalance ? Number(account.highBalance) : null,
        monthlyPayment: account.monthlyPayment ? Number(account.monthlyPayment) : null,
        activeDispute, // Attach the active dispute info
      };
    });

    // Calculate summary
    const summary = {
      totalNegative: accounts.length,
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
      summary,
    });

  } catch (error) {
    console.error("Error fetching negative accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch negative accounts" },
      { status: 500 }
    );
  }
}
