import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';

interface BureauData {
  score: number | null;
  accounts: number;
  negatives: number;
  inquiries: number;
}

interface ReportSummary {
  totalAccounts: number;
  openAccounts: number;
  closedAccounts: number;
  negativeItems: number;
  collections: number;
  latePayments: number;
  inquiries: number;
  publicRecords: number;
}

interface FormattedReport {
  id: string;
  filename: string;
  uploadDate: string;
  reportDate: string;
  status: string;
  bureaus: {
    transunion: BureauData;
    equifax: BureauData;
    experian: BureauData;
  };
  summary: ReportSummary;
  changes: {
    scoreChange: { transunion: number; equifax: number; experian: number } | null;
    itemsRemoved: number;
    itemsAdded: number;
    inquiriesDropped: number;
  } | null;
}

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

    // Verify client belongs to organization
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: session.user.organizationId,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get all reports for this client with accounts and scores
    const reports = await prisma.creditReport.findMany({
      where: {
        clientId,
        organizationId: session.user.organizationId,
      },
      include: {
        originalFile: true,
        accounts: {
          select: {
            id: true,
            cra: true,
            accountStatus: true,
            accountType: true,
            isDisputable: true,
            detectedIssues: true,
          },
        },
      },
      orderBy: {
        reportDate: "desc",
      },
    });

    // Get credit scores for this client
    const creditScores = await prisma.creditScore.findMany({
      where: {
        clientId,
      },
      orderBy: {
        scoreDate: "desc",
      },
    });

    // Parse hard inquiries from reports
    const parseInquiries = (inquiriesJson: string): Array<{ creditorName: string; inquiryDate: string; cra: string }> => {
      try {
        return JSON.parse(inquiriesJson) || [];
      } catch {
        return [];
      }
    };

    // Format reports with bureau data
    const formattedReports: FormattedReport[] = reports.map((report, index) => {
      // Get scores for this report date
      const reportScores = creditScores.filter(
        (s) => s.reportId === report.id ||
        (s.scoreDate.toISOString().split("T")[0] === report.reportDate.toISOString().split("T")[0])
      );

      // Get bureau-specific data
      const getBureauData = (cra: string): BureauData => {
        const score = reportScores.find((s) => s.cra.toUpperCase() === cra.toUpperCase());
        const accounts = report.accounts.filter((a) => a.cra.toUpperCase() === cra.toUpperCase());
        const inquiries = parseInquiries(report.hardInquiries).filter(
          (i) => i.cra.toUpperCase() === cra.toUpperCase()
        );

        return {
          score: score?.score || null,
          accounts: accounts.length,
          negatives: accounts.filter((a) => a.isDisputable || a.accountStatus === "DEROGATORY").length,
          inquiries: inquiries.length,
        };
      };

      // Calculate summary
      const allAccounts = report.accounts;
      const negativeAccounts = allAccounts.filter((a) => a.isDisputable || a.accountStatus === "DEROGATORY");
      const collections = allAccounts.filter(
        (a) => a.accountType?.toLowerCase().includes("collection") || a.accountStatus === "COLLECTION"
      );
      const allInquiries = parseInquiries(report.hardInquiries);

      const summary: ReportSummary = {
        totalAccounts: allAccounts.length,
        openAccounts: allAccounts.filter((a) => a.accountStatus === "OPEN").length,
        closedAccounts: allAccounts.filter((a) => a.accountStatus === "CLOSED").length,
        negativeItems: negativeAccounts.length,
        collections: collections.length,
        latePayments: negativeAccounts.filter((a) =>
          a.detectedIssues?.toLowerCase().includes("late") ||
          a.accountStatus?.toLowerCase().includes("late")
        ).length,
        inquiries: allInquiries.length,
        publicRecords: 0, // Would need to be parsed from report
      };

      // Calculate changes from previous report
      let changes = null;
      if (index < reports.length - 1) {
        const prevReport = reports[index + 1];
        const prevScores = creditScores.filter(
          (s) => s.reportId === prevReport.id ||
          (s.scoreDate.toISOString().split("T")[0] === prevReport.reportDate.toISOString().split("T")[0])
        );

        const getScoreChange = (cra: string): number => {
          const currentScore = reportScores.find((s) => s.cra.toUpperCase() === cra.toUpperCase())?.score;
          const prevScore = prevScores.find((s) => s.cra.toUpperCase() === cra.toUpperCase())?.score;
          if (currentScore && prevScore) {
            return currentScore - prevScore;
          }
          return 0;
        };

        const prevNegatives = prevReport.accounts.filter(
          (a) => a.isDisputable || a.accountStatus === "DEROGATORY"
        ).length;
        const prevInquiries = parseInquiries(prevReport.hardInquiries).length;

        changes = {
          scoreChange: {
            transunion: getScoreChange("TRANSUNION"),
            equifax: getScoreChange("EQUIFAX"),
            experian: getScoreChange("EXPERIAN"),
          },
          itemsRemoved: Math.max(0, prevNegatives - negativeAccounts.length),
          itemsAdded: Math.max(0, negativeAccounts.length - prevNegatives),
          inquiriesDropped: Math.max(0, prevInquiries - allInquiries.length),
        };
      }

      return {
        id: report.id,
        filename: report.originalFile?.filename || "Unknown",
        uploadDate: report.uploadedAt.toISOString(),
        reportDate: report.reportDate.toISOString(),
        status: report.parseStatus.toLowerCase(),
        bureaus: {
          transunion: getBureauData("TRANSUNION"),
          equifax: getBureauData("EQUIFAX"),
          experian: getBureauData("EXPERIAN"),
        },
        summary,
        changes,
      };
    });

    return NextResponse.json(formattedReports);
  } catch (error) {
    console.error("Error fetching client reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 }
    );
  }
}
