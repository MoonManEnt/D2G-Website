import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/clients/[id]/communications - Get communication history for a client
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: clientId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const type = searchParams.get("type"); // Filter by type
    const direction = searchParams.get("direction"); // Filter by direction

    // Verify client belongs to organization
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: session.user.organizationId,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Build where clause
    const where: Record<string, unknown> = {
      clientId,
      organizationId: session.user.organizationId,
    };

    if (type) {
      where.type = type;
    }

    if (direction) {
      where.direction = direction;
    }

    // Get communications with pagination
    const [communications, total] = await Promise.all([
      prisma.communication.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.communication.count({ where }),
    ]);

    return NextResponse.json({
      communications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching communications:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch communications" },
      { status: 500 }
    );
  }
}

// POST /api/clients/[id]/communications - Log a new communication
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: clientId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      type,
      direction = "OUTBOUND",
      subject,
      content,
      contentHtml,
      status = "SENT",
      disputeId,
      documentId,
      metadata = {},
    } = body;

    // Validate required fields
    if (!type || !content) {
      return NextResponse.json(
        { error: "Type and content are required" },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ["EMAIL", "SMS", "CALL", "NOTE", "PORTAL_MESSAGE", "LETTER"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Verify client belongs to organization
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: session.user.organizationId,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Create communication
    const communication = await prisma.communication.create({
      data: {
        clientId,
        organizationId: session.user.organizationId,
        userId: session.user.id,
        type,
        direction,
        subject,
        content,
        contentHtml,
        status,
        sentAt: status === "SENT" ? new Date() : null,
        disputeId,
        documentId,
        metadata: JSON.stringify(metadata),
      },
    });

    return NextResponse.json(communication, { status: 201 });
  } catch (error) {
    console.error("Error creating communication:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create communication" },
      { status: 500 }
    );
  }
}
