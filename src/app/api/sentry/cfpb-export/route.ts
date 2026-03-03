/**
 * Sentry CFPB Export API
 *
 * POST /api/sentry/cfpb-export
 * Generates a complete CFPB complaint data package for a dispute.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createLogger } from "@/lib/logger";

const log = createLogger("sentry-cfpb-export-api");

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { disputeId, clientId } = body as { disputeId: string; clientId: string };

    if (!disputeId || !clientId) {
      return NextResponse.json(
        { error: "disputeId and clientId are required" },
        { status: 400 }
      );
    }

    // Fetch dispute with full context
    const dispute = await prisma.dispute.findFirst({
      where: {
        id: disputeId,
        clientId,
        organizationId: session.user.organizationId,
      },
      include: {
        client: true,
        items: {
          include: {
            accountItem: true,
            responses: true,
          },
        },
        sentryAnalysis: true,
      },
    });

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    // Build CFPB complaint data package
    const complaintData = {
      complainant: {
        firstName: dispute.client.firstName,
        lastName: dispute.client.lastName,
        address: dispute.client.addressLine1,
        city: dispute.client.city,
        state: dispute.client.state,
        zipCode: dispute.client.zipCode,
      },
      company: dispute.cra,
      product: "Credit reporting",
      subProduct: "Credit reporting",
      issue: "Incorrect information on your report",
      subIssue: "Information belongs to someone else",
      disputeTimeline: {
        originalDisputeDate: dispute.createdAt,
        sentDate: dispute.sentDate,
        respondedDate: dispute.respondedAt,
        round: dispute.round,
        flow: dispute.flow,
      },
      items: dispute.items.map((item) => ({
        creditorName: item.accountItem.creditorName,
        accountNumber: item.accountItem.maskedAccountId,
        accountType: item.accountItem.accountType,
        accountStatus: item.accountItem.accountStatus,
        balance: item.accountItem.balance,
        disputeReason: item.disputeReason,
        outcome: item.outcome,
        responses: item.responses.map((r) => ({
          outcome: r.outcome,
          responseDate: r.responseDate,
          method: r.responseMethod,
          stallTactic: r.stallTactic,
          wasLate: r.wasLate,
          daysToRespond: r.daysToRespond,
        })),
      })),
      sentryAnalysis: dispute.sentryAnalysis
        ? {
            eoscarCodes: JSON.parse(dispute.sentryAnalysis.eoscarCodes),
            ocrRiskScore: dispute.sentryAnalysis.ocrRiskScore,
            successProbability: dispute.sentryAnalysis.successProbability,
            citationsValidated: dispute.sentryAnalysis.citationsValidated,
          }
        : null,
      narrative: buildCFPBNarrative(dispute),
      generatedAt: new Date().toISOString(),
    };

    // Log activity
    await prisma.sentryActivityLog.create({
      data: {
        organizationId: session.user.organizationId,
        clientId,
        activityType: "CFPB_EXPORT",
        summary: `CFPB complaint data exported for ${dispute.cra} dispute (${dispute.items.length} items)`,
        triggeredBy: session.user.id,
      },
    });

    return NextResponse.json({ success: true, complaintData });
  } catch (error) {
    log.error({ err: error }, "CFPB export failed");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export failed" },
      { status: 500 }
    );
  }
}

function buildCFPBNarrative(dispute: any): string {
  const client = dispute.client;
  const items = dispute.items;

  const verifiedItems = items.filter((i: any) => i.outcome === "VERIFIED");
  const lateResponses = items.flatMap((i: any) =>
    i.responses.filter((r: any) => r.wasLate)
  );

  let narrative = `I disputed ${items.length} item(s) with ${dispute.cra} `;
  narrative += `on ${dispute.sentDate ? new Date(dispute.sentDate).toLocaleDateString() : "an earlier date"}. `;

  if (verifiedItems.length > 0) {
    narrative += `${verifiedItems.length} item(s) were verified without adequate investigation. `;
  }

  if (lateResponses.length > 0) {
    narrative += `${dispute.cra} exceeded the 30-day FCRA response deadline for ${lateResponses.length} item(s). `;
  }

  narrative += `This dispute is currently in Round ${dispute.round} of the ${dispute.flow} flow. `;
  narrative += `I believe ${dispute.cra} has failed to conduct a reasonable reinvestigation as required under 15 USC 1681i(a)(1)(A).`;

  return narrative;
}
