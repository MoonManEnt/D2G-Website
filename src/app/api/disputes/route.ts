import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getDisputeReasonFromIssueCode, FCRA_SECTIONS } from "@/lib/dispute-templates";
import {
  generateLetterFromTemplate,
  type LetterData,
  type DisputeAccountForLetter,
  type DisputeFlow,
} from "@/lib/docx-generator";

// GET /api/disputes - List all disputes
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const disputes = await prisma.dispute.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        items: {
          include: {
            accountItem: {
              select: {
                id: true,
                creditorName: true,
                maskedAccountId: true,
                balance: true,
              },
            },
          },
        },
        documents: {
          select: {
            id: true,
            title: true,
            approvalStatus: true,
          },
        },
        _count: {
          select: {
            items: true,
            documents: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Transform decimal fields
    const transformedDisputes = disputes.map((dispute) => ({
      ...dispute,
      items: dispute.items.map((item) => ({
        ...item,
        accountItem: {
          ...item.accountItem,
          balance: item.accountItem.balance ? Number(item.accountItem.balance) : null,
        },
      })),
    }));

    return NextResponse.json(transformedDisputes);
  } catch (error) {
    console.error("Error fetching disputes:", error);
    return NextResponse.json(
      { error: "Failed to fetch disputes" },
      { status: 500 }
    );
  }
}

// POST /api/disputes - Create a new dispute
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { clientId, cra, flow, accountIds } = body;

    if (!clientId || !cra || !flow || !accountIds || accountIds.length === 0) {
      return NextResponse.json(
        { error: "clientId, cra, flow, and accountIds are required" },
        { status: 400 }
      );
    }

    // Validate CRA
    if (!["TRANSUNION", "EXPERIAN", "EQUIFAX"].includes(cra)) {
      return NextResponse.json(
        { error: "Invalid CRA. Must be TRANSUNION, EXPERIAN, or EQUIFAX" },
        { status: 400 }
      );
    }

    // Get client info
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: session.user.organizationId,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get account items
    const accounts = await prisma.accountItem.findMany({
      where: {
        id: { in: accountIds },
        organizationId: session.user.organizationId,
        cra: cra,
      },
    });

    if (accounts.length === 0) {
      return NextResponse.json(
        { error: "No valid accounts found for the specified CRA" },
        { status: 400 }
      );
    }

    // Determine the next round number for this client/CRA combination
    const lastDispute = await prisma.dispute.findFirst({
      where: {
        clientId,
        cra,
      },
      orderBy: { round: "desc" },
    });

    const round = (lastDispute?.round || 0) + 1;

    // Create the dispute
    const dispute = await prisma.dispute.create({
      data: {
        clientId,
        organizationId: session.user.organizationId,
        cra,
        flow,
        round,
        status: "DRAFT",
        items: {
          create: accounts.map((account) => {
            // Parse detected issues to get dispute reasons
            let disputeReason = "Information is inaccurate and requires verification";
            try {
              const issues = account.detectedIssues ? JSON.parse(account.detectedIssues) : [];
              if (issues.length > 0) {
                disputeReason = getDisputeReasonFromIssueCode(issues[0].code);
              }
            } catch {
              // Use default reason
            }

            return {
              accountItemId: account.id,
              disputeReason,
            };
          }),
        },
      },
      include: {
        items: {
          include: {
            accountItem: true,
          },
        },
      },
    });

    // Parse detected issues for each account to include in letter
    const accountsForLetter: DisputeAccountForLetter[] = dispute.items.map((item) => {
      // Parse the detected issues JSON
      let issues: Array<{ code: string; severity: string; description: string; suggestedFlow: string; fcraSection?: string }> = [];
      try {
        issues = item.accountItem.detectedIssues
          ? JSON.parse(item.accountItem.detectedIssues)
          : [];
      } catch {
        // Use empty array if parsing fails
      }

      return {
        creditorName: item.accountItem.creditorName,
        accountNumber: item.accountItem.maskedAccountId || "N/A",
        accountType: item.accountItem.accountType || undefined,
        balance: item.accountItem.balance
          ? `$${Number(item.accountItem.balance).toLocaleString()}`
          : undefined,
        reason: item.disputeReason || "Requires verification",
        issues: issues.map((issue) => ({
          code: issue.code,
          description: issue.description,
        })),
      };
    });

    // Get debt collector name if collection flow
    const debtCollectorName = accountsForLetter.find((a) =>
      a.accountType?.toLowerCase().includes("collection")
    )?.creditorName;

    // Prepare letter data for template
    const letterData: LetterData = {
      clientFirstName: client.firstName,
      clientLastName: client.lastName,
      clientAddress: client.addressLine1 || "[ADDRESS]",
      clientCity: client.city || "[CITY]",
      clientState: client.state || "[STATE]",
      clientZip: client.zipCode || "[ZIP]",
      clientSSN4: client.ssnLast4 || "XXXX",
      clientDOB: client.dateOfBirth
        ? new Date(client.dateOfBirth).toLocaleDateString("en-US", {
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
      accounts: accountsForLetter,
      debtCollectorName,
    };

    // Generate letter content from actual eOSCAR template
    const letterContent = generateLetterFromTemplate(
      cra as "TRANSUNION" | "EXPERIAN" | "EQUIFAX",
      letterData,
      flow as DisputeFlow,
      round
    );

    // Create the document
    const document = await prisma.document.create({
      data: {
        documentType: "DISPUTE_LETTER",
        title: `${cra} Dispute Letter - Round ${round}`,
        content: letterContent,
        statutesCited: JSON.stringify([
          "15 U.S.C. § 1681e(b)",
          "15 U.S.C. § 1681i",
          "15 U.S.C. § 1681s-2(b)",
        ]),
        approvalStatus: "DRAFT",
        disputeId: dispute.id,
        organizationId: session.user.organizationId,
        createdById: session.user.id,
      },
    });

    // Log the event
    await prisma.eventLog.create({
      data: {
        eventType: "DISPUTE_CREATED",
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetType: "Dispute",
        targetId: dispute.id,
        eventData: JSON.stringify({
          cra,
          flow,
          round,
          accountCount: accounts.length,
          documentId: document.id,
        }),
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json({
      success: true,
      dispute: {
        id: dispute.id,
        cra,
        flow,
        round,
        status: dispute.status,
        itemCount: dispute.items.length,
      },
      document: {
        id: document.id,
        title: document.title,
      },
    });
  } catch (error) {
    console.error("Error creating dispute:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create dispute" },
      { status: 500 }
    );
  }
}
