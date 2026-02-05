import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
const log = createLogger("amelia-conversations-api");

export const dynamic = "force-dynamic";

// GET /api/amelia/conversations - List conversations for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    const { searchParams } = new URL(request.url);

    const clientId = searchParams.get("clientId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const cursor = searchParams.get("cursor");

    // Build where clause
    const where: Record<string, unknown> = {
      userId: session.user.id,
      organizationId,
      status: "ACTIVE",
    };

    if (clientId) {
      where.clientId = clientId;
    }

    // Fetch conversations with cursor-based pagination
    const conversations = await prisma.ameliaConversation.findMany({
      where,
      take: limit + 1, // Fetch one extra to determine if there's a next page
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1, // Skip the cursor itself
          }
        : {}),
      orderBy: { updatedAt: "desc" },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
          },
        },
      },
    });

    // Determine if there are more results
    const hasMore = conversations.length > limit;
    const results = hasMore ? conversations.slice(0, limit) : conversations;
    const nextCursor = hasMore ? results[results.length - 1].id : null;

    // Shape response with last message preview
    const data = results.map((conversation) => {
      const lastMessage = conversation.messages[0] || null;
      const { messages, ...conversationData } = conversation;

      return {
        ...conversationData,
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              role: lastMessage.role,
              preview:
                lastMessage.content.length > 120
                  ? lastMessage.content.substring(0, 120) + "..."
                  : lastMessage.content,
              createdAt: lastMessage.createdAt,
            }
          : null,
      };
    });

    return NextResponse.json({
      conversations: data,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    log.error({ err: error }, "Error listing Amelia conversations");
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to list conversations",
      },
      { status: 500 }
    );
  }
}

// POST /api/amelia/conversations - Create a new conversation
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    const body = await request.json();
    const { clientId, title } = body as {
      clientId?: string;
      title?: string;
    };

    // If clientId is provided, verify the client belongs to the user's organization
    if (clientId) {
      const client = await prisma.client.findFirst({
        where: {
          id: clientId,
          organizationId,
        },
        select: { id: true, firstName: true, lastName: true },
      });

      if (!client) {
        return NextResponse.json(
          { error: "Client not found" },
          { status: 404 }
        );
      }
    }

    // Generate a default title if none provided
    const conversationTitle =
      title || `Conversation ${new Date().toLocaleDateString()}`;

    const conversation = await prisma.ameliaConversation.create({
      data: {
        title: conversationTitle,
        status: "ACTIVE",
        userId: session.user.id,
        organizationId,
        ...(clientId ? { clientId } : {}),
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    log.error({ err: error }, "Error creating Amelia conversation");
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create conversation",
      },
      { status: 500 }
    );
  }
}
