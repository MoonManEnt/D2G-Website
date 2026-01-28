import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  generateDisputeLetterPDF,
  DisputeLetterData,
  CRA_ADDRESSES,
  CRAName,
} from "@/lib/pdf-generate";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/disputes/[id]/pdf - Generate PDF for a dispute
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: disputeId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch dispute with client and items
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

    // Build letter data
    const client = dispute.client;
    const cra = dispute.cra as CRAName;
    const craAddress = CRA_ADDRESSES[cra] || CRA_ADDRESSES.EQUIFAX;

    const letterData: DisputeLetterData = {
      clientName: `${client.firstName} ${client.lastName}`,
      clientAddress: client.addressLine1 || "Address Not Provided",
      clientCity: client.city || "City",
      clientState: client.state || "ST",
      clientZip: client.zipCode || "00000",
      clientSSNLast4: client.ssnLast4 || undefined,
      clientDOB: client.dateOfBirth
        ? format(new Date(client.dateOfBirth), "MM/dd/yyyy")
        : undefined,

      craName: craAddress.name,
      craAddress: craAddress.address,
      craCity: craAddress.city,
      craState: craAddress.state,
      craZip: craAddress.zip,

      letterDate: dispute.createdAt,
      subject: `Dispute of Inaccurate Information - ${cra}`,
      letterBody: dispute.letterContent || generateDefaultLetterBody(cra),
      accountsDisputed: dispute.items.map((item) => ({
        creditorName: item.accountItem?.creditorName || "Unknown Creditor",
        accountNumber: item.accountItem?.maskedAccountId || "N/A",
        reason: item.disputeReason || "Inaccurate information",
      })),

      disputeId: dispute.id,
      referenceNumber: dispute.referenceNumber || undefined,
    };

    // Generate the PDF
    const pdfBytes = await generateDisputeLetterPDF(letterData, {
      includeAccountTable: true,
      includeSignatureLine: true,
      includeFooter: true,
      watermark: dispute.status === "DRAFT" ? "DRAFT" : undefined,
    });

    // Return the PDF
    const filename = `dispute-${cra.toLowerCase()}-${dispute.id.slice(0, 8)}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Content-Length": pdfBytes.length.toString(),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate PDF" },
      { status: 500 }
    );
  }
}

// POST /api/disputes/[id]/pdf - Generate PDF with custom options
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: disputeId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { download = false, includeWatermark = true } = body;

    // Fetch dispute with client and items
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

    // Build letter data
    const client = dispute.client;
    const cra = dispute.cra as CRAName;
    const craAddress = CRA_ADDRESSES[cra] || CRA_ADDRESSES.EQUIFAX;

    const letterData: DisputeLetterData = {
      clientName: `${client.firstName} ${client.lastName}`,
      clientAddress: client.addressLine1 || "Address Not Provided",
      clientCity: client.city || "City",
      clientState: client.state || "ST",
      clientZip: client.zipCode || "00000",
      clientSSNLast4: client.ssnLast4 || undefined,
      clientDOB: client.dateOfBirth
        ? format(new Date(client.dateOfBirth), "MM/dd/yyyy")
        : undefined,

      craName: craAddress.name,
      craAddress: craAddress.address,
      craCity: craAddress.city,
      craState: craAddress.state,
      craZip: craAddress.zip,

      letterDate: dispute.createdAt,
      subject: `Dispute of Inaccurate Information - ${cra}`,
      letterBody: dispute.letterContent || generateDefaultLetterBody(cra),
      accountsDisputed: dispute.items.map((item) => ({
        creditorName: item.accountItem?.creditorName || "Unknown Creditor",
        accountNumber: item.accountItem?.maskedAccountId || "N/A",
        reason: item.disputeReason || "Inaccurate information",
      })),

      disputeId: dispute.id,
      referenceNumber: dispute.referenceNumber || undefined,
    };

    // Generate the PDF
    const pdfBytes = await generateDisputeLetterPDF(letterData, {
      includeAccountTable: true,
      includeSignatureLine: true,
      includeFooter: true,
      watermark: includeWatermark && dispute.status === "DRAFT" ? "DRAFT" : undefined,
    });

    const filename = `dispute-${cra.toLowerCase()}-${dispute.id.slice(0, 8)}.pdf`;
    const disposition = download ? "attachment" : "inline";

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${filename}"`,
        "Content-Length": pdfBytes.length.toString(),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate PDF" },
      { status: 500 }
    );
  }
}

function generateDefaultLetterBody(cra: string): string {
  return `I am writing to dispute inaccurate information appearing on my ${cra} credit report. I have identified the following items that are inaccurate, incomplete, or unverifiable, and I request that you investigate these items as required by the Fair Credit Reporting Act.

The disputed items listed below contain errors that are negatively affecting my credit standing. Under the FCRA (15 U.S.C. § 1681i), you are required to conduct a reasonable investigation within 30 days and remove any information that cannot be verified.

Please investigate each disputed item and provide me with:
1. The results of your investigation
2. A free copy of my updated credit report if changes are made
3. Notification to any parties who received my report in the last six months

I have enclosed copies of supporting documents to assist with your investigation. If you have any questions, please contact me at the address listed above.`;
}
