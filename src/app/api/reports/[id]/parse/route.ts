import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { parseAndAnalyzeReport } from "@/lib/report-parser";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/reports/[id]/parse - Manually trigger parsing of a credit report
 *
 * This route uses the shared parseAndAnalyzeReport utility to ensure
 * consistent parsing behavior with auto-parse on upload.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: reportId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the report with file info
    const report = await prisma.creditReport.findFirst({
      where: {
        id: reportId,
        organizationId: session.user.organizationId,
      },
      include: {
        originalFile: true,
        client: true,
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Check if already parsed
    if (report.parseStatus === "COMPLETED") {
      return NextResponse.json({
        error: "Report has already been parsed",
        status: report.parseStatus,
      }, { status: 400 });
    }

    // Use the shared parsing utility
    const result = await parseAndAnalyzeReport({
      reportId,
      organizationId: session.user.organizationId,
      clientId: report.clientId,
      actorId: session.user.id,
      actorEmail: session.user.email,
      storagePath: report.originalFile.storagePath,
    });

    if (!result.success) {
      return NextResponse.json({
        error: result.error || "Failed to parse report",
        hint: "Please ensure you upload a native IdentityIQ PDF with selectable text, not a scanned or printed document.",
      }, { status: 400 });
    }

    // Fetch the created accounts for the response
    const accounts = await prisma.accountItem.findMany({
      where: { reportId },
      select: {
        id: true,
        creditorName: true,
        cra: true,
        balance: true,
        confidenceLevel: true,
        isDisputable: true,
        issueCount: true,
        suggestedFlow: true,
      },
    });

    return NextResponse.json({
      success: true,
      reportId,
      status: "COMPLETED",
      accountsParsed: result.accountsParsed,
      pageCount: result.pageCount,
      warnings: result.warnings || [],
      issuesSummary: result.issuesSummary,
      accounts,
    });

  } catch (error) {
    console.error("Error parsing report:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to parse report" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reports/[id]/parse - Get parse status and account details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: reportId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const report = await prisma.creditReport.findFirst({
      where: {
        id: reportId,
        organizationId: session.user.organizationId,
      },
      include: {
        accounts: {
          select: {
            id: true,
            creditorName: true,
            maskedAccountId: true,
            cra: true,
            accountStatus: true,
            balance: true,
            pastDue: true,
            paymentStatus: true,
            confidenceScore: true,
            confidenceLevel: true,
            isDisputable: true,
            issueCount: true,
            detectedIssues: true,
            suggestedFlow: true,
          },
        },
        _count: {
          select: { accounts: true },
        },
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    return NextResponse.json({
      reportId: report.id,
      parseStatus: report.parseStatus,
      parseError: report.parseError,
      pageCount: report.pageCount,
      accountCount: report._count.accounts,
      accounts: report.accounts,
    });

  } catch (error) {
    console.error("Error fetching parse status:", error);
    return NextResponse.json(
      { error: "Failed to fetch parse status" },
      { status: 500 }
    );
  }
}
