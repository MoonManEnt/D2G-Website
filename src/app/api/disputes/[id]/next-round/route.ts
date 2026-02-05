/**
 * Next Round Generation API
 *
 * POST /api/disputes/[id]/next-round - Generate the next round dispute with adapted letter
 *
 * Uses the stored response context to generate an appropriately escalated letter
 * for the next round, incorporating:
 * - Item-specific responses from the previous round
 * - Escalation language based on outcomes
 * - FCRA/FDCPA violation citations where applicable
 * - Tone escalation based on round number and response patterns
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
  type FlowType,
} from "@/lib/amelia/index";
import type { NextRoundContext } from "@/lib/dispute-intelligence/types";
import { CRA } from "@/types";
import { createLogger } from "@/lib/logger";
const log = createLogger("dispute-next-round-api");

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/disputes/[id]/next-round - Generate next round with adapted letter
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: disputeId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      targetCra,       // Optional: override CRA for next round
      targetFlow,      // Optional: override flow for next round
      excludeItemIds,  // Optional: item IDs to exclude from next round
    } = body;

    // Fetch the dispute with all related data
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
            responses: {
              orderBy: { responseDate: "desc" },
              take: 1, // Get most recent response
            },
          },
        },
      },
    });

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    // Check if dispute is ready for next round
    if (dispute.status !== "RESPONSE_RECEIVED" && dispute.status !== "RESOLVED") {
      return NextResponse.json(
        { error: "Dispute is not ready for next round. Status: " + dispute.status },
        { status: 400 }
      );
    }

    // Get the round history with next round context
    const roundHistory = await prisma.disputeRoundHistory.findFirst({
      where: {
        disputeId,
        round: dispute.round,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!roundHistory) {
      return NextResponse.json(
        { error: "No round history found. Please record responses first." },
        { status: 400 }
      );
    }

    // Parse the stored next round context
    let nextRoundContext: NextRoundContext | undefined;
    try {
      nextRoundContext = JSON.parse(roundHistory.nextRoundContext);
    } catch {
      // Context not available, will generate without it
    }

    // Determine items to include in next round (exclude deleted items)
    const excludeSet = new Set(excludeItemIds || []);
    const itemsForNextRound = dispute.items.filter(item => {
      // Exclude deleted items
      if (item.outcome === "DELETED") return false;
      // Exclude manually excluded items
      if (excludeSet.has(item.id)) return false;
      return true;
    });

    if (itemsForNextRound.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All items have been resolved! No next round needed.",
        allResolved: true,
      });
    }

    // Determine CRA and flow for next round
    const nextCra = targetCra ||
      (nextRoundContext?.shouldChangeBureau
        ? nextRoundContext.targetBureau
        : dispute.cra);

    const nextFlow = targetFlow ||
      nextRoundContext?.recommendedFlow ||
      dispute.flow;

    const nextRound = dispute.round + 1;

    // Get client info
    const client = dispute.client;

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
      previousNames: [],
      previousAddresses: [],
      hardInquiries: [],
    };

    // Build dispute accounts for AMELIA
    const accounts: DisputeAccount[] = itemsForNextRound.map((item) => {
      const acc = item.accountItem;
      const issues = acc.detectedIssues ? JSON.parse(acc.detectedIssues) : [];

      return {
        creditorName: acc.creditorName,
        accountNumber: acc.maskedAccountId,
        accountType: acc.accountType || undefined,
        balance: acc.balance ? parseFloat(acc.balance.toString()) : undefined,
        pastDue: acc.pastDue ? parseFloat(acc.pastDue.toString()) : undefined,
        dateOpened: acc.dateOpened
          ? format(new Date(acc.dateOpened), "MM/dd/yyyy")
          : undefined,
        dateReported: acc.dateReported
          ? format(new Date(acc.dateReported), "MM/dd/yyyy")
          : undefined,
        paymentStatus: acc.paymentStatus || undefined,
        issues: issues,
        inaccurateCategories: [],
      };
    });

    // Get used content hashes for uniqueness
    const usedHashes = await prisma.ameliaContentHash.findMany({
      where: { clientId: client.id },
      select: { contentHash: true },
    });
    const usedHashSet = new Set(usedHashes.map((h) => h.contentHash));

    // Generate the next round letter using AMELIA with response context
    const generatedLetter = generateLetter({
      client: clientInfo,
      accounts,
      cra: nextCra as CRA,
      flow: nextFlow as FlowType,
      round: nextRound,
      usedContentHashes: usedHashSet,
      lastDisputeDate: dispute.sentDate
        ? format(new Date(dispute.sentDate), "MMMM d, yyyy")
        : undefined,
      previousRoundContext: nextRoundContext,
    });

    // Store the content hash
    await prisma.ameliaContentHash.create({
      data: {
        clientId: client.id,
        contentHash: generatedLetter.contentHash,
        contentType: "LETTER",
        sourceDocId: disputeId,
      },
    });

    // Create the new dispute for the next round
    const newDispute = await prisma.dispute.create({
      data: {
        clientId: client.id,
        organizationId: dispute.organizationId,
        flow: nextFlow,
        round: nextRound,
        cra: nextCra,
        status: "DRAFT",
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
          previousDisputeId: disputeId,
          adaptedFromContext: !!nextRoundContext,
          ameliaVersion: "2.0",
        }),
      },
    });

    // Create dispute items for the new dispute
    for (const item of itemsForNextRound) {
      await prisma.disputeItem.create({
        data: {
          disputeId: newDispute.id,
          accountItemId: item.accountItemId,
          disputeReason: item.disputeReason,
          suggestedFlow: nextFlow,
        },
      });
    }

    // Update the original dispute to reference the next round
    await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: "ESCALATED",
        responseNotes: `Escalated to Round ${nextRound}. New dispute ID: ${newDispute.id}`,
      },
    });

    // Log the event
    await prisma.eventLog.create({
      data: {
        eventType: "DISPUTE_NEXT_ROUND_CREATED",
        actorId: session.user.id,
        actorEmail: session.user.email || undefined,
        targetType: "DISPUTE",
        targetId: newDispute.id,
        eventData: JSON.stringify({
          previousDisputeId: disputeId,
          previousRound: dispute.round,
          newRound: nextRound,
          cra: nextCra,
          flow: nextFlow,
          itemCount: itemsForNextRound.length,
          tone: generatedLetter.tone,
          adaptedFromContext: !!nextRoundContext,
        }),
        organizationId: dispute.organizationId,
      },
    });

    return NextResponse.json({
      success: true,
      newDispute: {
        id: newDispute.id,
        round: nextRound,
        cra: nextCra,
        flow: nextFlow,
        status: newDispute.status,
        itemCount: itemsForNextRound.length,
      },
      letterMetadata: {
        tone: generatedLetter.tone,
        effectiveFlow: generatedLetter.effectiveFlow,
        statute: generatedLetter.statute,
        isBackdated: generatedLetter.isBackdated,
        adaptedFromContext: !!nextRoundContext,
      },
      previousDispute: {
        id: disputeId,
        round: dispute.round,
        status: "ESCALATED",
      },
    });
  } catch (error) {
    log.error({ err: error }, "Error creating next round dispute");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create next round" },
      { status: 500 }
    );
  }
}
