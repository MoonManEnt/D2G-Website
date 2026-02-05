import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
const log = createLogger("client-accounts-api");

export const dynamic = 'force-dynamic';

/**
 * GET /api/clients/[id]/accounts - Get accounts for a client
 *
 * Query params:
 * - reportId: (optional) Filter accounts by specific report
 * - cra: (optional) Filter by credit bureau (TRANSUNION, EQUIFAX, EXPERIAN)
 * - disputableOnly: (optional) Only return disputable accounts
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

    // Transform for response
    const transformedAccounts = accounts.map((account) => ({
      ...account,
      balance: account.balance ? Number(account.balance) : null,
      pastDue: account.pastDue ? Number(account.pastDue) : null,
      creditLimit: account.creditLimit ? Number(account.creditLimit) : null,
      highBalance: account.highBalance ? Number(account.highBalance) : null,
    }));

    // Calculate summary stats
    const stats = {
      total: accounts.length,
      byBureau: {
        transunion: accounts.filter(a => a.cra === "TRANSUNION").length,
        equifax: accounts.filter(a => a.cra === "EQUIFAX").length,
        experian: accounts.filter(a => a.cra === "EXPERIAN").length,
      },
      disputable: accounts.filter(a => a.isDisputable).length,
      withIssues: accounts.filter(a => a.issueCount > 0).length,
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
