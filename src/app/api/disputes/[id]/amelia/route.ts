/**
 * AMELIA Letter Generation API
 *
 * POST /api/disputes/[id]/amelia - Generate letter content using AMELIA doctrine
 *
 * This endpoint generates unique, human-written dispute letters following
 * the AMELIA doctrine rules:
 * - 30-day backdating for Round 1
 * - DAMAGES → STORY → FACTS → PENALTY structure
 * - Personal info disputes (names, addresses, inquiries)
 * - eOSCAR-resistant unique stories
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { format } from "date-fns";
import {
  generateLetter,
  type ClientPersonalInfo,
  type DisputeAccount,
  type HardInquiry,
} from "@/lib/amelia/index";
import { CRA } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/disputes/[id]/amelia - Generate AMELIA letter
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: disputeId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { regenerate = false } = body;

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

    // Don't regenerate if letter already exists unless explicitly requested
    if (dispute.letterContent && !regenerate) {
      return NextResponse.json({
        success: true,
        message: "Letter already generated",
        letterContent: dispute.letterContent,
        isExisting: true,
      });
    }

    const client = dispute.client;
    const cra = dispute.cra as CRA;

    // Fetch the most recent credit report for this client to get personal info
    const latestReport = await prisma.creditReport.findFirst({
      where: {
        clientId: client.id,
        parseStatus: "COMPLETED",
      },
      orderBy: {
        reportDate: "desc",
      },
    });

    // Parse personal info from report (stored as JSON strings)
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

    // Build client personal info
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

    // Build dispute accounts
    const accounts: DisputeAccount[] = dispute.items.map((item) => {
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
        inaccurateCategories: [], // Will be determined by doctrine
      };
    });

    // Get used content hashes for this client to ensure uniqueness
    const usedHashes = await prisma.ameliaContentHash.findMany({
      where: { clientId: client.id },
      select: { contentHash: true },
    });
    const usedHashSet = new Set(usedHashes.map((h) => h.contentHash));

    // Determine flow type
    const flowType = dispute.flow as "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO";

    // Generate the letter using AMELIA doctrine (supports all rounds)
    const generatedLetter = generateLetter({
      client: clientInfo,
      accounts,
      cra,
      flow: flowType,
      round: dispute.round,
      usedContentHashes: usedHashSet,
    });

    // Store the content hash to prevent future reuse
    await prisma.ameliaContentHash.create({
      data: {
        clientId: client.id,
        contentHash: generatedLetter.contentHash,
        contentType: "LETTER",
        sourceDocId: disputeId,
      },
    });

    // Update the dispute with the generated letter content
    await prisma.dispute.update({
      where: { id: disputeId },
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
          ameliaVersion: "2.0",
        }),
      },
    });

    // Log the event
    await prisma.eventLog.create({
      data: {
        eventType: "DOCUMENT_GENERATED",
        actorId: session.user.id,
        actorEmail: session.user.email || undefined,
        targetType: "DISPUTE",
        targetId: disputeId,
        eventData: JSON.stringify({
          type: "AMELIA_LETTER",
          flow: flowType,
          round: dispute.round,
          cra,
          tone: generatedLetter.tone,
          isBackdated: generatedLetter.isBackdated,
          accountCount: accounts.length,
          previousNamesDisputed: generatedLetter.personalInfoDisputed.previousNames.length,
          previousAddressesDisputed: generatedLetter.personalInfoDisputed.previousAddresses.length,
          hardInquiriesDisputed: generatedLetter.personalInfoDisputed.hardInquiries.length,
        }),
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json({
      success: true,
      letterContent: generatedLetter.content,
      metadata: {
        letterDate: generatedLetter.letterDate.toISOString(),
        isBackdated: generatedLetter.isBackdated,
        backdatedDays: generatedLetter.backdatedDays,
        tone: generatedLetter.tone,
        flow: generatedLetter.flow,
        effectiveFlow: generatedLetter.effectiveFlow,
        round: generatedLetter.round,
        statute: generatedLetter.statute,
        includesScreenshots: generatedLetter.includesScreenshots,
        personalInfoDisputed: {
          previousNames: generatedLetter.personalInfoDisputed.previousNames.length,
          previousAddresses: generatedLetter.personalInfoDisputed.previousAddresses.length,
          hardInquiries: generatedLetter.personalInfoDisputed.hardInquiries.length,
        },
        ameliaVersion: "2.0",
      },
    });
  } catch (error) {
    console.error("Error generating AMELIA letter:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate letter",
      },
      { status: 500 }
    );
  }
}

// GET /api/disputes/[id]/amelia - Get AMELIA letter metadata
export async function GET(request: NextRequest, { params }: RouteParams) {
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
      select: {
        id: true,
        letterContent: true,
        aiStrategy: true,
        round: true,
        flow: true,
        cra: true,
        status: true,
      },
    });

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    let metadata = null;
    if (dispute.aiStrategy) {
      try {
        metadata = JSON.parse(dispute.aiStrategy);
      } catch {
        // If parsing fails, leave as null
      }
    }

    return NextResponse.json({
      hasLetter: !!dispute.letterContent,
      letterLength: dispute.letterContent?.length || 0,
      metadata,
      dispute: {
        round: dispute.round,
        flow: dispute.flow,
        cra: dispute.cra,
        status: dispute.status,
      },
    });
  } catch (error) {
    console.error("Error fetching AMELIA letter:", error);
    return NextResponse.json(
      { error: "Failed to fetch letter metadata" },
      { status: 500 }
    );
  }
}
