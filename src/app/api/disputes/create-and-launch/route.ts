import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, trackUsage } from "@/lib/api-middleware";
import { getDisputeReasonFromIssueCode } from "@/lib/dispute-templates";

// =============================================================================
// POST /api/disputes/create-and-launch - Create dispute AND mark as SENT atomically
// =============================================================================
// This endpoint creates a dispute and immediately marks it as SENT in one transaction.
// Used when user clicks "Launch Round X" from the preview modal.
//
// This is atomic - either both operations succeed or neither does.
// =============================================================================

export const POST = withAuth(async (req, ctx) => {
  try {
    const body = await req.json();
    const { clientId, cra, flow, accountIds, letterContent, contentHash } = body;

    // Validate required fields
    if (!clientId || !cra || !flow || !accountIds || accountIds.length === 0) {
      return NextResponse.json(
        { error: "clientId, cra, flow, and accountIds are required" },
        { status: 400 }
      );
    }

    if (!letterContent) {
      return NextResponse.json(
        { error: "letterContent is required" },
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

    // Get account items - verify they belong to this organization
    // Note: We don't filter by CRA here because accounts may be multi-bureau
    // The frontend already filters accounts by CRA before selection
    const accounts = await prisma.accountItem.findMany({
      where: {
        id: { in: accountIds },
        organizationId: ctx.organizationId,
      },
    });

    if (accounts.length === 0) {
      return NextResponse.json(
        { error: "No valid accounts found" },
        { status: 400 }
      );
    }

    // Determine the next round number - only count SENT/RESPONDED/RESOLVED disputes
    const lastDispute = await prisma.dispute.findFirst({
      where: {
        clientId,
        cra,
        status: { in: ["SENT", "RESPONDED", "RESOLVED"] },
      },
      orderBy: { round: "desc" },
    });

    const round = (lastDispute?.round || 0) + 1;

    // Set dates
    const sentDate = new Date();
    const responseDeadline = new Date(sentDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Use a transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Create the dispute with SENT status
      const dispute = await tx.dispute.create({
        data: {
          clientId,
          organizationId: ctx.organizationId,
          cra,
          flow,
          round,
          status: "SENT", // Immediately SENT
          sentDate,
          deadlineDate: responseDeadline,
          letterContent,
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
        },
      });

      // Store content hash if provided
      if (contentHash) {
        await tx.ameliaContentHash.create({
          data: {
            clientId: client.id,
            contentHash,
            contentType: "LETTER",
            sourceDocId: dispute.id,
          },
        });
      }

      // Update client stage
      await tx.client.update({
        where: { id: clientId },
        data: {
          stage: `ROUND_${round}`,
          lastActivityAt: new Date(),
          currentRound: round,
          totalDisputesSent: { increment: 1 },
        },
      });

      // Log the event
      await tx.eventLog.create({
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
            launchedImmediately: true,
          }),
          organizationId: ctx.organizationId,
        },
      });

      await tx.eventLog.create({
        data: {
          eventType: "DISPUTE_SENT",
          targetType: "DISPUTE",
          targetId: dispute.id,
          actorId: ctx.userId,
          actorEmail: ctx.session.user.email,
          organizationId: ctx.organizationId,
          eventData: JSON.stringify({
            description: `Launched ${cra} Round ${round} dispute with ${accounts.length} items`,
            cra,
            flow,
            round,
            itemCount: accounts.length,
            sentDate: sentDate.toISOString(),
            responseDeadline: responseDeadline.toISOString(),
          }),
        },
      });

      return dispute;
    });

    // Track usage
    await trackUsage(ctx.organizationId, ctx.userId, "dispute_created", {
      disputeId: result.id,
      cra,
      flow,
      round,
    });

    return NextResponse.json({
      success: true,
      dispute: {
        id: result.id,
        clientId: result.clientId,
        client: result.client,
        cra: result.cra,
        flow: result.flow,
        round: result.round,
        status: result.status,
        sentDate: sentDate.toISOString(),
        deadlineDate: responseDeadline.toISOString(),
        items: result.items.map((item) => ({
          id: item.id,
          disputeReason: item.disputeReason,
          accountItem: {
            ...item.accountItem,
            balance: item.accountItem.balance ? Number(item.accountItem.balance) : null,
          },
        })),
      },
      responseDeadline: responseDeadline.toISOString(),
      message: `Round ${round} launched! 30-day FCRA deadline: ${responseDeadline.toLocaleDateString()}`,
    });
  } catch (error) {
    console.error("Error creating and launching dispute:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create and launch dispute", code: "CREATE_LAUNCH_ERROR" },
      { status: 500 }
    );
  }
}, { checkLimit: "disputes" });
