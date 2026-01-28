/**
 * SENTRY DISPUTE API - Single Dispute Routes
 *
 * GET /api/sentry/[id] - Get a single Sentry dispute
 * PATCH /api/sentry/[id] - Update a Sentry dispute
 * DELETE /api/sentry/[id] - Delete a Sentry dispute
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// =============================================================================
// GET /api/sentry/[id] - Get a single Sentry dispute
// =============================================================================

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dispute = await prisma.sentryDispute.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            addressLine1: true,
            city: true,
            state: true,
            zipCode: true,
            ssnLast4: true,
            dateOfBirth: true,
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
                paymentStatus: true,
                dateOpened: true,
                dateReported: true,
                detectedIssues: true,
                cra: true,
              },
            },
          },
        },
        analysis: true,
      },
    });

    if (!dispute) {
      return NextResponse.json(
        { error: "Sentry dispute not found" },
        { status: 404 }
      );
    }

    // Transform decimal fields and parse JSON
    const transformedDispute = {
      ...dispute,
      successProbability: dispute.successProbability
        ? Number(dispute.successProbability)
        : null,
      eoscarCodes: dispute.eoscarCodes
        ? JSON.parse(dispute.eoscarCodes as string)
        : [],
      metro2Fields: dispute.metro2Fields
        ? JSON.parse(dispute.metro2Fields as string)
        : [],
      citationValidation: dispute.citationValidation
        ? JSON.parse(dispute.citationValidation as string)
        : null,
      items: dispute.items.map((item) => ({
        ...item,
        metro2Fields: item.metro2Fields
          ? JSON.parse(item.metro2Fields as string)
          : [],
        accountItem: {
          ...item.accountItem,
          balance: item.accountItem.balance
            ? Number(item.accountItem.balance)
            : null,
          detectedIssues: item.accountItem.detectedIssues
            ? JSON.parse(item.accountItem.detectedIssues)
            : [],
        },
      })),
      analysis: dispute.analysis
        ? {
            ...dispute.analysis,
            successProbability: Number(dispute.analysis.successProbability),
            recommendedCodes: JSON.parse(
              dispute.analysis.recommendedCodes as string
            ),
            validCitations: dispute.analysis.validCitations
              ? JSON.parse(dispute.analysis.validCitations as string)
              : [],
            invalidCitations: dispute.analysis.invalidCitations
              ? JSON.parse(dispute.analysis.invalidCitations as string)
              : [],
            citationWarnings: dispute.analysis.citationWarnings
              ? JSON.parse(dispute.analysis.citationWarnings as string)
              : [],
            ocrFindings: dispute.analysis.ocrFindings
              ? JSON.parse(dispute.analysis.ocrFindings as string)
              : [],
            ocrFixSuggestions: dispute.analysis.ocrFixSuggestions
              ? JSON.parse(dispute.analysis.ocrFixSuggestions as string)
              : [],
            identifiedFields: dispute.analysis.identifiedFields
              ? JSON.parse(dispute.analysis.identifiedFields as string)
              : [],
            fieldDiscrepancies: dispute.analysis.fieldDiscrepancies
              ? JSON.parse(dispute.analysis.fieldDiscrepancies as string)
              : [],
            successBreakdown: JSON.parse(
              dispute.analysis.successBreakdown as string
            ),
            improvementTips: dispute.analysis.improvementTips
              ? JSON.parse(dispute.analysis.improvementTips as string)
              : [],
          }
        : null,
    };

    return NextResponse.json({
      success: true,
      dispute: transformedDispute,
      system: "SENTRY",
    });
  } catch (error) {
    console.error("Error fetching Sentry dispute:", error);
    return NextResponse.json(
      { error: "Failed to fetch Sentry dispute", code: "FETCH_ERROR" },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH /api/sentry/[id] - Update a Sentry dispute
// =============================================================================

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    const body = await request.json();

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify dispute exists and belongs to organization
    const existingDispute = await prisma.sentryDispute.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingDispute) {
      return NextResponse.json(
        { error: "Sentry dispute not found" },
        { status: 404 }
      );
    }

    // Only allow updates to DRAFT disputes (except status changes)
    if (existingDispute.status !== "DRAFT" && !body.status) {
      return NextResponse.json(
        { error: "Can only edit DRAFT disputes" },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (body.letterContent !== undefined) {
      updateData.letterContent = body.letterContent;
      updateData.letterContentHash = generateContentHash(body.letterContent);
    }

    if (body.status !== undefined) {
      // Validate status transitions
      const validTransitions: Record<string, string[]> = {
        DRAFT: ["SENT"],
        SENT: ["RESPONDED", "RESOLVED"],
        RESPONDED: ["RESOLVED"],
      };

      const currentStatus = existingDispute.status;
      if (
        !validTransitions[currentStatus]?.includes(body.status) &&
        body.status !== currentStatus
      ) {
        return NextResponse.json(
          {
            error: `Invalid status transition from ${currentStatus} to ${body.status}`,
          },
          { status: 400 }
        );
      }

      updateData.status = body.status;

      // Set sent date when transitioning to SENT
      if (body.status === "SENT" && currentStatus === "DRAFT") {
        updateData.sentDate = new Date();
        // Set deadline 30 days from sent date
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 30);
        updateData.deadlineDate = deadline;
      }

      // Set responded date
      if (body.status === "RESPONDED") {
        updateData.respondedAt = new Date();
      }

      // Set resolved date
      if (body.status === "RESOLVED") {
        updateData.resolvedAt = new Date();
      }
    }

    if (body.eoscarCodes !== undefined) {
      updateData.eoscarCodes = JSON.stringify(body.eoscarCodes);
    }

    if (body.metro2Fields !== undefined) {
      updateData.metro2Fields = JSON.stringify(body.metro2Fields);
    }

    // Update the dispute
    const updatedDispute = await prisma.sentryDispute.update({
      where: { id },
      data: updateData,
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
        analysis: {
          select: {
            ocrScore: true,
            successProbability: true,
          },
        },
      },
    });

    // Log the update
    await prisma.eventLog.create({
      data: {
        eventType: "SENTRY_DISPUTE_UPDATED",
        actorId: session.user.id,
        targetType: "SentryDispute",
        targetId: id,
        eventData: JSON.stringify({
          updatedFields: Object.keys(updateData),
          newStatus: body.status,
        }),
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json({
      success: true,
      dispute: {
        ...updatedDispute,
        successProbability: updatedDispute.successProbability
          ? Number(updatedDispute.successProbability)
          : null,
        items: updatedDispute.items.map((item) => ({
          ...item,
          accountItem: {
            ...item.accountItem,
            balance: item.accountItem.balance
              ? Number(item.accountItem.balance)
              : null,
          },
        })),
      },
      system: "SENTRY",
    });
  } catch (error) {
    console.error("Error updating Sentry dispute:", error);
    return NextResponse.json(
      { error: "Failed to update Sentry dispute", code: "UPDATE_ERROR" },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/sentry/[id] - Delete a Sentry dispute
// =============================================================================

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify dispute exists and belongs to organization
    const existingDispute = await prisma.sentryDispute.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingDispute) {
      return NextResponse.json(
        { error: "Sentry dispute not found" },
        { status: 404 }
      );
    }

    // Only allow deletion of DRAFT disputes
    if (existingDispute.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Can only delete DRAFT disputes" },
        { status: 400 }
      );
    }

    // Delete the dispute (cascades to items and analysis)
    await prisma.sentryDispute.delete({
      where: { id },
    });

    // Log the deletion
    await prisma.eventLog.create({
      data: {
        eventType: "SENTRY_DISPUTE_DELETED",
        actorId: session.user.id,
        targetType: "SentryDispute",
        targetId: id,
        eventData: JSON.stringify({
          cra: existingDispute.cra,
          flow: existingDispute.flow,
          round: existingDispute.round,
        }),
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Sentry dispute deleted",
      system: "SENTRY",
    });
  } catch (error) {
    console.error("Error deleting Sentry dispute:", error);
    return NextResponse.json(
      { error: "Failed to delete Sentry dispute", code: "DELETE_ERROR" },
      { status: 500 }
    );
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function generateContentHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `sentry_${Math.abs(hash).toString(16)}`;
}
