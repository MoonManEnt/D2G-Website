import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, trackUsage } from "@/lib/api-middleware";
import { getDisputeReasonFromIssueCode } from "@/lib/dispute-templates";
import { format } from "date-fns";
import {
  generateLetter,
  type ClientPersonalInfo,
  type DisputeAccount,
  type HardInquiry,
  type ActivePersonalInfoDispute,
} from "@/lib/amelia/index";
import { CRA } from "@/types";
import {
  getActiveDisputes,
  getLastDisputeDate,
  recordDisputedItems,
} from "@/lib/personal-info-dispute-service";

// GET /api/disputes - List all disputes
export const GET = withAuth(async (req, ctx) => {
  try {
    // Support filtering by clientId
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");

    const disputes = await prisma.dispute.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(clientId && { clientId }),
        // Only show disputes for active, non-archived clients
        client: {
          isActive: true,
          archivedAt: null,
        },
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
      { error: "Failed to fetch disputes", code: "FETCH_ERROR" },
      { status: 500 }
    );
  }
});

// =============================================================================
// POST /api/disputes - Create dispute with automatic AMELIA letter generation
// =============================================================================
// SIMPLIFIED WORKFLOW:
// 1. Create dispute as DRAFT
// 2. Automatically generate AMELIA letter
// 3. Return dispute ready for review/edit
//
// Statuses: DRAFT → SENT → RESPONDED → RESOLVED
// Account locking: Only when status = SENT
// =============================================================================

export const POST = withAuth(async (req, ctx) => {
  try {
    const body = await req.json();
    const { clientId, cra, flow, accountIds, tone } = body;

    // Validate required fields
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

    // Validate flow
    if (!["ACCURACY", "COLLECTION", "CONSENT", "COMBO"].includes(flow)) {
      return NextResponse.json(
        { error: "Invalid flow. Must be ACCURACY, COLLECTION, CONSENT, or COMBO" },
        { status: 400 }
      );
    }

    // Get client info
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: ctx.organizationId,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get account items - verify they belong to this CRA and organization
    const accounts = await prisma.accountItem.findMany({
      where: {
        id: { in: accountIds },
        organizationId: ctx.organizationId,
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
      where: { clientId, cra },
      orderBy: { round: "desc" },
    });

    // WORKFLOW ENFORCEMENT: Previous round must be SENT or RESPONDED before creating new round
    // This allows flexibility while ensuring proper sequencing
    if (lastDispute) {
      const validStatusesForNextRound = ["SENT", "RESPONDED", "RESOLVED"];
      if (!validStatusesForNextRound.includes(lastDispute.status)) {
        return NextResponse.json(
          {
            error: `Cannot create Round ${lastDispute.round + 1}`,
            details: {
              currentRound: lastDispute.round,
              currentStatus: lastDispute.status,
              message: `Round ${lastDispute.round} must be sent first. Current status: ${lastDispute.status}`
            }
          },
          { status: 400 }
        );
      }
    }

    const round = (lastDispute?.round || 0) + 1;

    // Create the dispute with items
    const dispute = await prisma.dispute.create({
      data: {
        clientId,
        organizationId: ctx.organizationId,
        cra,
        flow,
        round,
        status: "DRAFT",
        items: {
          create: accounts.map((account) => {
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
              suggestedFlow: account.suggestedFlow || flow,
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

    // =========================================================================
    // AMELIA LETTER GENERATION - Automatic on creation
    // =========================================================================

    // Fetch the most recent credit report for personal info
    const latestReport = await prisma.creditReport.findFirst({
      where: {
        clientId: client.id,
        parseStatus: "COMPLETED",
      },
      orderBy: { reportDate: "desc" },
    });

    // Parse personal info from report
    let previousNames: string[] = [];
    let previousAddresses: string[] = [];
    let hardInquiries: HardInquiry[] = [];

    if (latestReport) {
      try {
        previousNames = JSON.parse(latestReport.previousNames || "[]");
        previousAddresses = JSON.parse(latestReport.previousAddresses || "[]");
        const rawInquiries = JSON.parse(latestReport.hardInquiries || "[]");
        hardInquiries = rawInquiries.map((inq: { creditorName: string; inquiryDate: string; cra: string }) => ({
          creditorName: inq.creditorName,
          inquiryDate: inq.inquiryDate,
          cra: inq.cra as CRA,
        }));
      } catch {
        // If parsing fails, use empty arrays
      }
    }

    // Build client personal info for AMELIA
    const clientInfo: ClientPersonalInfo = {
      firstName: client.firstName,
      lastName: client.lastName,
      fullName: `${client.firstName} ${client.lastName}`,
      addressLine1: client.addressLine1 || "",
      addressLine2: client.addressLine2 || undefined,
      city: client.city || "",
      state: client.state || "",
      zipCode: client.zipCode || "",
      ssnLast4: client.ssnLast4 || "XXXX",
      dateOfBirth: client.dateOfBirth
        ? format(new Date(client.dateOfBirth), "MM/dd/yyyy")
        : "XX/XX/XXXX",
      phone: client.phone || undefined,
      previousNames,
      previousAddresses,
      hardInquiries,
    };

    // Build dispute accounts for AMELIA
    const disputeAccounts: DisputeAccount[] = dispute.items.map((item) => {
      const acc = item.accountItem;
      const issues = acc?.detectedIssues ? JSON.parse(acc.detectedIssues) : [];

      return {
        creditorName: acc?.creditorName || "Unknown Creditor",
        accountNumber: acc?.maskedAccountId || "XXXXXXXX****",
        accountType: acc?.accountType || undefined,
        balance: acc?.balance ? parseFloat(acc.balance.toString()) : undefined,
        pastDue: acc?.pastDue ? parseFloat(acc.pastDue.toString()) : undefined,
        dateOpened: acc?.dateOpened
          ? format(new Date(acc.dateOpened), "MM/dd/yyyy")
          : undefined,
        dateReported: acc?.dateReported
          ? format(new Date(acc.dateReported), "MM/dd/yyyy")
          : undefined,
        paymentStatus: acc?.paymentStatus || undefined,
        issues: issues,
        inaccurateCategories: [],
      };
    });

    // Get used content hashes to ensure uniqueness
    const usedHashes = await prisma.ameliaContentHash.findMany({
      where: { clientId: client.id },
      select: { contentHash: true },
    });
    const usedHashSet = new Set(usedHashes.map((h) => h.contentHash));

    // For R2+, fetch last dispute date and active personal info disputes
    let lastDisputeDateStr: string | undefined;
    let activePersonalInfoDisputes: ActivePersonalInfoDispute[] | undefined;

    if (round >= 2) {
      const lastDisputeDate = await getLastDisputeDate(client.id, cra as CRA);
      if (lastDisputeDate) {
        lastDisputeDateStr = format(lastDisputeDate, "MMMM d, yyyy");
      }
      activePersonalInfoDisputes = await getActiveDisputes(client.id, cra as CRA);
    }

    // Generate the letter using AMELIA doctrine
    const generatedLetter = generateLetter({
      client: clientInfo,
      accounts: disputeAccounts,
      cra: cra as CRA,
      flow: flow as "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO",
      round,
      usedContentHashes: usedHashSet,
      lastDisputeDate: lastDisputeDateStr,
      activePersonalInfoDisputes,
      // TODO: Add toneOverride support to AMELIA generator
    });

    // Store the content hash
    await prisma.ameliaContentHash.create({
      data: {
        clientId: client.id,
        contentHash: generatedLetter.contentHash,
        contentType: "LETTER",
        sourceDocId: dispute.id,
      },
    });

    // Update dispute with AMELIA letter content
    const updatedDispute = await prisma.dispute.update({
      where: { id: dispute.id },
      data: {
        letterContent: generatedLetter.content,
        aiStrategy: JSON.stringify({
          generatedAt: new Date().toISOString(),
          tone: generatedLetter.tone,
          isBackdated: generatedLetter.isBackdated,
          backdatedDays: generatedLetter.backdatedDays,
          letterDate: generatedLetter.letterDate.toISOString(),
          flow: generatedLetter.flow,
          effectiveFlow: generatedLetter.effectiveFlow,
          round: generatedLetter.round,
          statute: generatedLetter.statute,
          includesScreenshots: generatedLetter.includesScreenshots,
          personalInfoDisputed: generatedLetter.personalInfoDisputed,
          ameliaVersion: "2.2",
        }),
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
                accountType: true,
                detectedIssues: true,
              },
            },
          },
        },
      },
    });

    // Record disputed items for persistent tracking
    await recordDisputedItems(
      client.id,
      ctx.organizationId,
      cra as CRA,
      generatedLetter.personalInfoDisputed
    );

    // Log the event
    await prisma.eventLog.create({
      data: {
        eventType: "DISPUTE_CREATED",
        actorId: ctx.userId,
        actorEmail: ctx.session.user.email,
        targetType: "Dispute",
        targetId: dispute.id,
        eventData: JSON.stringify({
          cra,
          flow,
          round,
          accountCount: accounts.length,
          ameliaGenerated: true,
          tone: generatedLetter.tone,
          isBackdated: generatedLetter.isBackdated,
        }),
        organizationId: ctx.organizationId,
      },
    });

    // Track usage
    await trackUsage(ctx.organizationId, ctx.userId, "dispute_created", {
      disputeId: dispute.id,
      cra,
      flow,
      round,
    });

    return NextResponse.json({
      success: true,
      dispute: {
        id: updatedDispute.id,
        clientId: updatedDispute.clientId,
        client: updatedDispute.client,
        cra: updatedDispute.cra,
        flow: updatedDispute.flow,
        round: updatedDispute.round,
        status: updatedDispute.status,
        letterContent: updatedDispute.letterContent,
        items: updatedDispute.items.map((item) => ({
          id: item.id,
          disputeReason: item.disputeReason,
          accountItem: {
            ...item.accountItem,
            balance: item.accountItem.balance ? Number(item.accountItem.balance) : null,
          },
        })),
        createdAt: updatedDispute.createdAt,
      },
      amelia: {
        tone: generatedLetter.tone,
        isBackdated: generatedLetter.isBackdated,
        backdatedDays: generatedLetter.backdatedDays,
        letterDate: generatedLetter.letterDate.toISOString(),
        effectiveFlow: generatedLetter.effectiveFlow,
        statute: generatedLetter.statute,
        personalInfoDisputed: {
          previousNames: generatedLetter.personalInfoDisputed.previousNames.length,
          previousAddresses: generatedLetter.personalInfoDisputed.previousAddresses.length,
          hardInquiries: generatedLetter.personalInfoDisputed.hardInquiries.length,
        },
      },
    });
  } catch (error) {
    console.error("Error creating dispute:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create dispute", code: "CREATE_ERROR" },
      { status: 500 }
    );
  }
}, { checkLimit: "disputes" });
