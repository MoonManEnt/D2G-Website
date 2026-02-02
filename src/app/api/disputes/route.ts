import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, trackUsage } from "@/lib/api-middleware";
import { getDisputeReasonFromIssueCode } from "@/lib/dispute-templates";
import { format } from "date-fns";
import { parsePaginationParams, buildPaginatedResponse } from "@/lib/pagination";
import { cacheGet, cacheSet, cacheDel, cacheDelPrefix } from "@/lib/redis";
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
import { createDisputeBodySchema } from "@/lib/api-validation-schemas";
import { generateDisputeCode } from "@/lib/dispute-id-generator";
import { checkAccountAvailability } from "@/lib/account-lock-service";

export const dynamic = "force-dynamic";

// GET /api/disputes - List all disputes
export const GET = withAuth(async (req, ctx) => {
  try {
    // Support filtering by clientId
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    const pagination = parsePaginationParams(searchParams);
    const page = searchParams.get("page") || "1";
    const limit = searchParams.get("limit") || "20";

    // Check cache
    const cacheKey = `disputes:list:${ctx.organizationId}:${clientId || "all"}:${page}:${limit}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return NextResponse.json(JSON.parse(cached));
    }

    const where = {
      organizationId: ctx.organizationId,
      ...(clientId && { clientId }),
      // Only show disputes for active, non-archived clients
      client: {
        isActive: true,
        archivedAt: null,
      },
    };

    const total = await prisma.dispute.count({ where });

    const disputes = await prisma.dispute.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
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

    const response = buildPaginatedResponse(transformedDisputes, total, pagination);

    // Cache for 30s
    await cacheSet(cacheKey, JSON.stringify(response), 30);

    return NextResponse.json(response);
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
    const parsed = createDisputeBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { clientId, cra, flow, accountIds, tone, letterStructure } = parsed.data;

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

    // Check account availability - prevent adding locked accounts
    const availability = await checkAccountAvailability(accountIds, cra, ctx.organizationId);
    if (availability.locked.length > 0) {
      return NextResponse.json(
        {
          error: "Some accounts are unavailable",
          code: "ACCOUNTS_LOCKED",
          details: {
            message: "One or more accounts are already in active disputes and cannot be added.",
            lockedAccounts: availability.locked.map((l) => ({
              accountId: l.accountId,
              creditorName: l.creditorName,
              lockedBy: l.lockedBy ? {
                disputeCode: l.lockedBy.disputeCode,
                system: l.lockedBy.system,
                status: l.lockedBy.status,
                round: l.lockedBy.round,
              } : null,
            })),
            availableAccounts: availability.available,
          },
        },
        { status: 409 }
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

    // Generate human-readable dispute code
    const { code: disputeCode } = await generateDisputeCode("DISPUTE");

    // Create the dispute with items
    const dispute = await prisma.dispute.create({
      data: {
        clientId,
        organizationId: ctx.organizationId,
        cra,
        flow,
        round,
        status: "DRAFT",
        disputeCode,
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

    // Fetch all pre-generation data in parallel (independent reads)
    const [latestReport, usedHashes, lastDisputeDateResult, activePersonalInfoDisputesResult] = await Promise.all([
      // Most recent credit report for personal info
      prisma.creditReport.findFirst({
        where: {
          clientId: client.id,
          parseStatus: "COMPLETED",
        },
        orderBy: { reportDate: "desc" },
      }),
      // Used content hashes to ensure uniqueness
      prisma.ameliaContentHash.findMany({
        where: { clientId: client.id },
        select: { contentHash: true },
      }),
      // For R2+, fetch last dispute date
      round >= 2 ? getLastDisputeDate(client.id, cra as CRA) : Promise.resolve(null),
      // For R2+, fetch active personal info disputes
      round >= 2 ? getActiveDisputes(client.id, cra as CRA) : Promise.resolve(undefined),
    ]);

    const usedHashSet = new Set(usedHashes.map((h) => h.contentHash));

    // For R2+, format last dispute date
    let lastDisputeDateStr: string | undefined;
    let activePersonalInfoDisputes: ActivePersonalInfoDispute[] | undefined;

    if (round >= 2) {
      if (lastDisputeDateResult) {
        lastDisputeDateStr = format(lastDisputeDateResult, "MMMM d, yyyy");
      }
      activePersonalInfoDisputes = activePersonalInfoDisputesResult;
    }

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
      // Letter structure: DAMAGES_FIRST (default) or FACTS_FIRST
      letterStructure: letterStructure === "FACTS_FIRST" ? "FACTS_FIRST" : "DAMAGES_FIRST",
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
          letterStructure: generatedLetter.letterStructure,
          ameliaVersion: "2.3", // Bumped for structure toggle feature
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

    // Run post-update side effects in parallel (all independent operations)
    await Promise.all([
      // Record disputed items for persistent tracking
      recordDisputedItems(
        client.id,
        ctx.organizationId,
        cra as CRA,
        generatedLetter.personalInfoDisputed
      ),
      // Log the event
      prisma.eventLog.create({
        data: {
          eventType: "DISPUTE_CREATED",
          actorId: ctx.userId,
          actorEmail: ctx.session.user.email,
          targetType: "Dispute",
          targetId: dispute.id,
          eventData: JSON.stringify({
            disputeCode,
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
      }),
      // Track usage
      trackUsage(ctx.organizationId, ctx.userId, "dispute_created", {
        disputeId: dispute.id,
        cra,
        flow,
        round,
      }),
      // Invalidate caches - disputes list + client detail + client stats
      cacheDelPrefix(`disputes:list:${ctx.organizationId}`),
      cacheDel(`clients:detail:${ctx.organizationId}:${clientId}`),
      cacheDelPrefix(`clients:stats:${ctx.organizationId}`),
      cacheDelPrefix(`clients:list:${ctx.organizationId}`),
    ]);

    return NextResponse.json({
      success: true,
      dispute: {
        id: updatedDispute.id,
        disputeCode: updatedDispute.disputeCode,
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
        letterStructure: generatedLetter.letterStructure,
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
