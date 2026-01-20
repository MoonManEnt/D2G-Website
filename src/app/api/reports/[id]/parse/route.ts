import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { extractTextFromPDF } from "@/lib/pdf-extract";
import { parseIdentityIQReport } from "@/lib/parser";
import { computeConfidenceLevel, CRA } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/reports/[id]/parse - Parse a credit report
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

    // Update status to processing
    await prisma.creditReport.update({
      where: { id: reportId },
      data: { parseStatus: "PROCESSING" },
    });

    try {
      // Extract text from PDF
      const extractionResult = await extractTextFromPDF(report.originalFile.storagePath);

      if (!extractionResult.success) {
        await prisma.creditReport.update({
          where: { id: reportId },
          data: {
            parseStatus: "FAILED",
            parseError: extractionResult.error || "Failed to extract text from PDF",
          },
        });

        return NextResponse.json({
          error: extractionResult.error || "Failed to extract text from PDF",
          hint: "Please ensure you upload a native IdentityIQ PDF with selectable text, not a scanned or printed document.",
        }, { status: 400 });
      }

      // Parse the extracted text
      const parseResult = await parseIdentityIQReport(extractionResult.text);

      if (!parseResult.success) {
        const errorMessage = parseResult.errors[0]?.message || "Failed to parse report";

        await prisma.creditReport.update({
          where: { id: reportId },
          data: {
            parseStatus: "FAILED",
            parseError: errorMessage,
          },
        });

        return NextResponse.json({
          error: errorMessage,
          errors: parseResult.errors,
        }, { status: 400 });
      }

      // Create AccountItem records for each parsed account
      const createdAccounts = [];

      for (const account of parseResult.accounts) {
        const confidenceLevel = computeConfidenceLevel(account.confidenceScore);

        const accountItem = await prisma.accountItem.create({
          data: {
            creditorName: account.creditorName,
            maskedAccountId: account.maskedAccountId,
            fingerprint: account.fingerprint || `${account.creditorName}:${account.maskedAccountId}`,
            cra: account.cra,
            accountType: account.accountType,
            accountStatus: account.accountStatus,
            balance: account.balance,
            pastDue: account.pastDue,
            creditLimit: account.creditLimit,
            highBalance: account.highBalance,
            monthlyPayment: account.monthlyPayment,
            dateOpened: account.dateOpened ? new Date(account.dateOpened) : null,
            dateReported: account.dateReported ? new Date(account.dateReported) : null,
            lastActivityDate: account.lastActivityDate ? new Date(account.lastActivityDate) : null,
            disputeComment: account.disputeComment,
            confidenceScore: account.confidenceScore,
            confidenceLevel: confidenceLevel,
            rawExtractedData: account.rawExtractedData ? JSON.stringify(account.rawExtractedData) : null,
            reportId: reportId,
            organizationId: session.user.organizationId,
            clientId: report.clientId,
          },
        });

        createdAccounts.push(accountItem);
      }

      // Update report status to completed
      await prisma.creditReport.update({
        where: { id: reportId },
        data: {
          parseStatus: "COMPLETED",
          pageCount: extractionResult.pageCount,
          parseError: null,
        },
      });

      // Log the parsing event
      await prisma.eventLog.create({
        data: {
          eventType: "REPORT_PARSED",
          actorId: session.user.id,
          actorEmail: session.user.email,
          targetType: "CreditReport",
          targetId: reportId,
          eventData: JSON.stringify({
            accountsParsed: createdAccounts.length,
            pageCount: extractionResult.pageCount,
            warnings: parseResult.warnings.length,
          }),
          organizationId: session.user.organizationId,
        },
      });

      return NextResponse.json({
        success: true,
        reportId,
        status: "COMPLETED",
        accountsParsed: createdAccounts.length,
        pageCount: extractionResult.pageCount,
        warnings: parseResult.warnings,
        accounts: createdAccounts.map(a => ({
          id: a.id,
          creditorName: a.creditorName,
          cra: a.cra,
          balance: a.balance,
          confidenceLevel: a.confidenceLevel,
        })),
      });

    } catch (parseError) {
      // Update status to failed
      const errorMessage = parseError instanceof Error ? parseError.message : "Unknown parsing error";

      await prisma.creditReport.update({
        where: { id: reportId },
        data: {
          parseStatus: "FAILED",
          parseError: errorMessage,
        },
      });

      // Log the failure
      await prisma.eventLog.create({
        data: {
          eventType: "REPORT_PARSE_FAILED",
          actorId: session.user.id,
          actorEmail: session.user.email,
          targetType: "CreditReport",
          targetId: reportId,
          eventData: JSON.stringify({
            error: errorMessage,
          }),
          organizationId: session.user.organizationId,
        },
      });

      throw parseError;
    }

  } catch (error) {
    console.error("Error parsing report:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to parse report" },
      { status: 500 }
    );
  }
}

// GET /api/reports/[id]/parse - Get parse status
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
