import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  generateCFPBComplaint,
  generateAICFPBComplaint,
  formatCFPBComplaintForCopy,
  type CFPBComplaintData,
  type DisputeFlow,
} from "@/lib/cfpb-complaints";
import { createLogger } from "@/lib/logger";
const log = createLogger("dispute-cfpb-api");

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/disputes/[id]/cfpb - Generate CFPB complaint for a dispute
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: disputeId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get format from query params (json or text)
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "json";

    // Fetch dispute with all related data
    const dispute = await prisma.dispute.findFirst({
      where: {
        id: disputeId,
        organizationId: session.user.organizationId,
      },
      include: {
        client: true,
        items: {
          include: {
            accountItem: true,
          },
        },
      },
    });

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    // Get previous dispute for date reference
    const previousDispute = await prisma.dispute.findFirst({
      where: {
        clientId: dispute.clientId,
        cra: dispute.cra,
        round: dispute.round - 1,
        status: { in: ["SENT", "RESPONDED", "RESOLVED"] },
      },
      orderBy: { sentDate: "desc" },
    });

    // Calculate days since last dispute
    let daysSinceDispute: number | undefined;
    let previousDisputeDate: string | undefined;

    if (previousDispute?.sentDate) {
      daysSinceDispute = Math.floor(
        (Date.now() - new Date(previousDispute.sentDate).getTime()) /
        (1000 * 60 * 60 * 24)
      );
      previousDisputeDate = new Date(previousDispute.sentDate).toLocaleDateString(
        "en-US",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
        }
      );
    }

    // Prepare account data for CFPB complaint
    const accounts: CFPBComplaintData["accounts"] = dispute.items.map((item) => {
      // Parse detected issues
      let issueDescription = "Information is inaccurate and requires verification";
      try {
        const issues = item.accountItem.detectedIssues
          ? JSON.parse(item.accountItem.detectedIssues)
          : [];
        if (issues.length > 0) {
          issueDescription = issues.map((i: { description: string }) => i.description).join("; ");
        }
      } catch {
        // Use default
      }

      return {
        creditorName: item.accountItem.creditorName,
        accountNumber: item.accountItem.maskedAccountId || undefined,
        balance: item.accountItem.balance
          ? `$${Number(item.accountItem.balance).toLocaleString()}`
          : undefined,
        issue: item.disputeReason || issueDescription,
      };
    });

    // Build CFPB complaint data
    const complaintData: CFPBComplaintData = {
      clientName: `${dispute.client.firstName} ${dispute.client.lastName}`,
      clientId: dispute.clientId, // Pass client ID for duplication checking
      cra: dispute.cra as "TRANSUNION" | "EXPERIAN" | "EQUIFAX",
      accounts,
      round: dispute.round,
      flow: dispute.flow as DisputeFlow,
      previousDisputeDate,
      daysSinceDispute,
    };

    if (format === "text") {
      // Return formatted text ready for copy/paste
      const textContent = await formatCFPBComplaintForCopy(complaintData);
      return new NextResponse(textContent, {
        headers: {
          "Content-Type": "text/plain",
        },
      });
    }

    // Return structured JSON
    const complaint = await generateCFPBComplaint(complaintData);

    return NextResponse.json({
      complaint,
      metadata: {
        disputeId: dispute.id,
        cra: dispute.cra,
        round: dispute.round,
        flow: dispute.flow,
        clientName: complaintData.clientName,
        accountCount: accounts.length,
        previousDisputeDate,
        daysSinceDispute,
      },
      copyText: await formatCFPBComplaintForCopy(complaintData),
    });
  } catch (error) {
    log.error({ err: error }, "Error generating CFPB complaint");
    return NextResponse.json(
      { error: "Failed to generate CFPB complaint" },
      { status: 500 }
    );
  }
}

// POST /api/disputes/[id]/cfpb - Generate AI-powered CFPB complaint
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: disputeId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch dispute with all related data
    const dispute = await prisma.dispute.findFirst({
      where: {
        id: disputeId,
        organizationId: session.user.organizationId,
      },
      include: {
        client: true,
        items: {
          include: {
            accountItem: true,
          },
        },
      },
    });

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    // Parse request body for any overrides
    let bodyData: Partial<CFPBComplaintData> = {};
    try {
      bodyData = await request.json();
    } catch {
      // No body or invalid JSON — use dispute data only
    }

    // Get previous dispute for date reference
    const previousDispute = await prisma.dispute.findFirst({
      where: {
        clientId: dispute.clientId,
        cra: dispute.cra,
        round: dispute.round - 1,
        status: { in: ["SENT", "RESPONDED", "RESOLVED"] },
      },
      orderBy: { sentDate: "desc" },
    });

    // Calculate days since last dispute
    let daysSinceDispute: number | undefined;
    let previousDisputeDate: string | undefined;

    if (previousDispute?.sentDate) {
      daysSinceDispute = Math.floor(
        (Date.now() - new Date(previousDispute.sentDate).getTime()) /
        (1000 * 60 * 60 * 24)
      );
      previousDisputeDate = new Date(previousDispute.sentDate).toLocaleDateString(
        "en-US",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
        }
      );
    }

    // Prepare account data for CFPB complaint
    const accounts: CFPBComplaintData["accounts"] = dispute.items.map((item) => {
      let issueDescription = "Information is inaccurate and requires verification";
      try {
        const issues = item.accountItem.detectedIssues
          ? JSON.parse(item.accountItem.detectedIssues)
          : [];
        if (issues.length > 0) {
          issueDescription = issues.map((i: { description: string }) => i.description).join("; ");
        }
      } catch {
        // Use default
      }

      return {
        creditorName: item.accountItem.creditorName,
        accountNumber: item.accountItem.maskedAccountId || undefined,
        balance: item.accountItem.balance
          ? `$${Number(item.accountItem.balance).toLocaleString()}`
          : undefined,
        issue: item.disputeReason || issueDescription,
      };
    });

    // Build CFPB complaint data, merging body overrides with dispute data
    const complaintData: CFPBComplaintData = {
      clientName: bodyData.clientName || `${dispute.client.firstName} ${dispute.client.lastName}`,
      clientId: bodyData.clientId || dispute.clientId,
      cra: (bodyData.cra || dispute.cra) as "TRANSUNION" | "EXPERIAN" | "EQUIFAX",
      accounts: bodyData.accounts || accounts,
      round: bodyData.round || dispute.round,
      flow: (bodyData.flow || dispute.flow) as DisputeFlow,
      previousDisputeDate: bodyData.previousDisputeDate || previousDisputeDate,
      daysSinceDispute: bodyData.daysSinceDispute || daysSinceDispute,
    };

    // Use AI-powered generation with fallback to template
    const result = await generateAICFPBComplaint(
      complaintData,
      session.user.organizationId
    );

    return NextResponse.json({
      ...result,
      metadata: {
        disputeId: dispute.id,
        cra: dispute.cra,
        round: dispute.round,
        flow: dispute.flow,
        clientName: complaintData.clientName,
        accountCount: complaintData.accounts.length,
        previousDisputeDate,
        daysSinceDispute,
      },
    });
  } catch (error) {
    log.error({ err: error }, "Error generating AI CFPB complaint");

    // Attempt template fallback at the route level
    try {
      const session = await getServerSession(authOptions);
      const { id: disputeId } = await params;

      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const dispute = await prisma.dispute.findFirst({
        where: {
          id: disputeId,
          organizationId: session.user.organizationId,
        },
        include: {
          client: true,
          items: {
            include: {
              accountItem: true,
            },
          },
        },
      });

      if (!dispute) {
        return NextResponse.json(
          { error: "Failed to generate CFPB complaint" },
          { status: 500 }
        );
      }

      const accounts: CFPBComplaintData["accounts"] = dispute.items.map((item) => ({
        creditorName: item.accountItem.creditorName,
        accountNumber: item.accountItem.maskedAccountId || undefined,
        balance: item.accountItem.balance
          ? `$${Number(item.accountItem.balance).toLocaleString()}`
          : undefined,
        issue: item.disputeReason || "Information is inaccurate and requires verification",
      }));

      const templateResult = await generateCFPBComplaint({
        clientName: `${dispute.client.firstName} ${dispute.client.lastName}`,
        clientId: dispute.clientId,
        cra: dispute.cra as "TRANSUNION" | "EXPERIAN" | "EQUIFAX",
        accounts,
        round: dispute.round,
        flow: dispute.flow as DisputeFlow,
      });

      return NextResponse.json({
        ...templateResult,
        generationMethod: "template" as const,
      });
    } catch (fallbackError) {
      log.error({ err: fallbackError }, "Template fallback also failed");
      return NextResponse.json(
        { error: "Failed to generate CFPB complaint" },
        { status: 500 }
      );
    }
  }
}
