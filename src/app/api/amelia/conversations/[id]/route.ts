import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/amelia/conversations/[id] - Get conversation with all messages
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;

    const conversation = await prisma.ameliaConversation.findFirst({
      where: {
        id,
        organizationId,
        userId: session.user.id,
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            stage: true,
            currentRound: true,
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            role: true,
            content: true,
            tokenCount: true,
            createdAt: true,
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(conversation);
  } catch (error) {
    console.error("Error fetching Amelia conversation:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch conversation",
      },
      { status: 500 }
    );
  }
}

// DELETE /api/amelia/conversations/[id] - Archive a conversation
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;

    // Verify the conversation exists and belongs to the user's organization
    const conversation = await prisma.ameliaConversation.findFirst({
      where: {
        id,
        organizationId,
        userId: session.user.id,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Set status to ARCHIVED instead of deleting
    await prisma.ameliaConversation.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });

    return NextResponse.json({
      success: true,
      message: "Conversation archived successfully",
    });
  } catch (error) {
    console.error("Error archiving Amelia conversation:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to archive conversation",
      },
      { status: 500 }
    );
  }
}
