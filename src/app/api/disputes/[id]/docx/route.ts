import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  generateDisputeDocx,
  generateLetterText,
  generateDocxFromAmeliaContent,
  type DisputeFlow,
  type LetterData,
  type DisputeAccountForLetter,
} from "@/lib/docx-generator";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/disputes/[id]/docx - Generate and download DOCX
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: disputeId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get format from query params (docx or text)
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "docx";

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

    // Prepare letter data
    const accounts: DisputeAccountForLetter[] = dispute.items.map((item) => {
      // Parse detected issues
      let issues: Array<{ code: string; description: string }> = [];
      try {
        const parsed = item.accountItem.detectedIssues
          ? JSON.parse(item.accountItem.detectedIssues)
          : [];
        issues = parsed.map((i: { code: string; description: string }) => ({
          code: i.code,
          description: i.description,
        }));
      } catch {
        // Ignore parsing errors
      }

      return {
        creditorName: item.accountItem.creditorName,
        accountNumber: item.accountItem.maskedAccountId || "N/A",
        accountType: item.accountItem.accountType || undefined,
        balance: item.accountItem.balance
          ? `$${Number(item.accountItem.balance).toLocaleString()}`
          : undefined,
        reason: item.disputeReason || "Information is inaccurate and requires verification",
        issues,
      };
    });

    // Get debt collector name if it's a collection account
    const debtCollectorName = accounts.find((a) =>
      a.accountType?.toLowerCase().includes("collection")
    )?.creditorName;

    const letterData: LetterData = {
      clientFirstName: dispute.client.firstName,
      clientLastName: dispute.client.lastName,
      clientAddress: dispute.client.addressLine1 || "[ADDRESS]",
      clientCity: dispute.client.city || "[CITY]",
      clientState: dispute.client.state || "[STATE]",
      clientZip: dispute.client.zipCode || "[ZIP]",
      clientSSN4: dispute.client.ssnLast4 || "XXXX",
      clientDOB: dispute.client.dateOfBirth
        ? new Date(dispute.client.dateOfBirth).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "[DATE OF BIRTH]",
      currentDate: new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      accounts,
      debtCollectorName,
    };

    const cra = dispute.cra as "TRANSUNION" | "EXPERIAN" | "EQUIFAX";
    const flow = dispute.flow as DisputeFlow;
    const round = dispute.round;

    // Check if dispute has AMELIA-generated content
    const hasAmeliaContent = !!dispute.letterContent;

    if (format === "text") {
      // Return text preview - prefer AMELIA content if available
      const textContent = hasAmeliaContent
        ? dispute.letterContent!
        : generateLetterText(cra, letterData, flow, round);
      return new NextResponse(textContent, {
        headers: {
          "Content-Type": "text/plain",
          "Content-Disposition": `inline; filename="${cra}_R${round}_${dispute.client.lastName}.txt"`,
        },
      });
    }

    // Generate DOCX - prefer AMELIA content if available
    try {
      let docxBuffer: Buffer;

      if (hasAmeliaContent) {
        // Use AMELIA-generated content for full fidelity
        // This includes personal info disputes, consumer statements, etc.
        docxBuffer = await generateDocxFromAmeliaContent(
          dispute.letterContent!,
          `${dispute.client.firstName} ${dispute.client.lastName}`,
          cra,
          round
        );
      } else {
        // Fall back to template-based generation
        docxBuffer = generateDisputeDocx(cra, letterData, flow, round);
      }

      // Convert Buffer to Uint8Array for NextResponse
      const uint8Array = new Uint8Array(docxBuffer);

      return new NextResponse(uint8Array, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${cra}_R${round}_${dispute.client.lastName}.docx"`,
          "Content-Length": docxBuffer.length.toString(),
        },
      });
    } catch (error) {
      console.error("DOCX generation error:", error);
      // Fall back to text format if DOCX generation fails - use AMELIA content if available
      const textContent = hasAmeliaContent
        ? dispute.letterContent!
        : generateLetterText(cra, letterData, flow, round);
      return new NextResponse(textContent, {
        headers: {
          "Content-Type": "text/plain",
          "Content-Disposition": `inline; filename="${cra}_R${round}_${dispute.client.lastName}.txt"`,
        },
      });
    }
  } catch (error) {
    console.error("Error generating document:", error);
    return NextResponse.json(
      { error: "Failed to generate document" },
      { status: 500 }
    );
  }
}
