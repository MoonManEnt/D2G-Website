import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { updateDisputeSchema } from "@/lib/api-validation-schemas";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/disputes/[id] - Get dispute details
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
      include: {
        client: true,
        items: {
          include: {
            accountItem: {
              include: {
                evidences: {
                  select: {
                    id: true,
                    evidenceType: true,
                    title: true,
                    description: true,
                    sourcePageNum: true,
                    renderedFile: {
                      select: {
                        id: true,
                        filename: true,
                        storagePath: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        documents: true,
      },
    });

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    // Transform decimal fields
    const transformedDispute = {
      ...dispute,
      items: dispute.items.map((item) => ({
        ...item,
        accountItem: {
          ...item.accountItem,
          balance: item.accountItem.balance ? Number(item.accountItem.balance) : null,
          pastDue: item.accountItem.pastDue ? Number(item.accountItem.pastDue) : null,
        },
      })),
    };

    return NextResponse.json(transformedDispute);
  } catch (error) {
    console.error("Error fetching dispute:", error);
    return NextResponse.json(
      { error: "Failed to fetch dispute" },
      { status: 500 }
    );
  }
}

// PATCH /api/disputes/[id] - Update dispute status
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: disputeId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateDisputeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { status, responseNotes, responseOutcome } = parsed.data;

    // Verify dispute belongs to organization
    const existingDispute = await prisma.dispute.findFirst({
      where: {
        id: disputeId,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingDispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    if (status) {
      updateData.status = status;

      // Set timestamps based on status
      if (status === "APPROVED" && !existingDispute.approvedAt) {
        updateData.approvedAt = new Date();
      }
      if (status === "SENT" && !existingDispute.sentDate) {
        updateData.sentDate = new Date();
      }
      if (status === "RESPONDED" && !existingDispute.respondedAt) {
        updateData.respondedAt = new Date();
      }
      if (status === "RESOLVED" && !existingDispute.resolvedAt) {
        updateData.resolvedAt = new Date();
      }
    }

    if (responseNotes !== undefined) {
      updateData.responseNotes = responseNotes;
    }

    if (responseOutcome !== undefined) {
      updateData.responseOutcome = responseOutcome;
    }

    const updatedDispute = await prisma.dispute.update({
      where: { id: disputeId },
      data: updateData,
    });

    // Log the event
    await prisma.eventLog.create({
      data: {
        eventType: "DISPUTE_UPDATED",
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetType: "Dispute",
        targetId: disputeId,
        eventData: JSON.stringify({ status, responseOutcome }),
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json(updatedDispute);
  } catch (error) {
    console.error("Error updating dispute:", error);
    return NextResponse.json(
      { error: "Failed to update dispute" },
      { status: 500 }
    );
  }
}

// DELETE /api/disputes/[id] - Delete dispute
// By default only DRAFT can be deleted. Use ?force=true to delete any status.
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: disputeId } = await params;
    const { searchParams } = new URL(request.url);
    const force = searchParams.get("force") === "true";

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify dispute belongs to organization
    const existingDispute = await prisma.dispute.findFirst({
      where: {
        id: disputeId,
        organizationId: session.user.organizationId,
      },
      include: {
        client: { select: { firstName: true, lastName: true } },
        _count: { select: { items: true } },
      },
    });

    if (!existingDispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    // Check if force delete is needed
    if (!force && existingDispute.status !== "DRAFT") {
      return NextResponse.json(
        {
          error: "Only draft disputes can be deleted without force flag",
          hint: "Add ?force=true to delete disputes that have been sent or processed",
          disputeStatus: existingDispute.status,
        },
        { status: 400 }
      );
    }

    // Delete dispute items first
    await prisma.disputeItem.deleteMany({
      where: { disputeId },
    });

    // Delete the dispute
    await prisma.dispute.delete({
      where: { id: disputeId },
    });

    // Log the deletion
    await prisma.eventLog.create({
      data: {
        eventType: "DISPUTE_DELETED",
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetType: "Dispute",
        targetId: disputeId,
        eventData: JSON.stringify({
          clientName: `${existingDispute.client.firstName} ${existingDispute.client.lastName}`,
          cra: existingDispute.cra,
          flow: existingDispute.flow,
          round: existingDispute.round,
          status: existingDispute.status,
          itemCount: existingDispute._count.items,
          forceDeleted: force,
        }),
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json({
      success: true,
      deleted: {
        disputeId,
        status: existingDispute.status,
        itemCount: existingDispute._count.items,
      },
    });
  } catch (error) {
    console.error("Error deleting dispute:", error);
    return NextResponse.json(
      { error: "Failed to delete dispute" },
      { status: 500 }
    );
  }
}
