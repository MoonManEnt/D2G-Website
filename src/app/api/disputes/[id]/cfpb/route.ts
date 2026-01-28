import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  generateCFPBComplaint,
  formatCFPBComplaintForCopy,
  type CFPBComplaintData,
  type DisputeFlow,
} from "@/lib/cfpb-complaints";

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
    console.error("Error generating CFPB complaint:", error);
    return NextResponse.json(
      { error: "Failed to generate CFPB complaint" },
      { status: 500 }
    );
  }
}
