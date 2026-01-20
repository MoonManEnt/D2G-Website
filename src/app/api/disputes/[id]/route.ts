import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

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
    const { status, responseNotes, responseOutcome } = body;

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
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: disputeId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify dispute belongs to organization and is in DRAFT status
    const existingDispute = await prisma.dispute.findFirst({
      where: {
        id: disputeId,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingDispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    if (existingDispute.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only draft disputes can be deleted" },
        { status: 400 }
      );
    }

    await prisma.dispute.delete({
      where: { id: disputeId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting dispute:", error);
    return NextResponse.json(
      { error: "Failed to delete dispute" },
      { status: 500 }
    );
  }
}
