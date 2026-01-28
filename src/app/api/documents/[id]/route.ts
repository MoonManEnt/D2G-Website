import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { updateDocumentSchema } from "@/lib/api-validation-schemas";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/documents/[id] - Get document details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: documentId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        organizationId: session.user.organizationId,
      },
      include: {
        dispute: {
          select: {
            id: true,
            cra: true,
            flow: true,
            round: true,
            client: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json(document);
  } catch (error) {
    console.error("Error fetching document:", error);
    return NextResponse.json(
      { error: "Failed to fetch document" },
      { status: 500 }
    );
  }
}

// PATCH /api/documents/[id] - Update document content
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: documentId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { content, approvalStatus } = parsed.data;

    // Verify document belongs to organization
    const existingDocument = await prisma.document.findFirst({
      where: {
        id: documentId,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingDocument) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    if (content !== undefined) {
      updateData.content = content;
    }

    if (approvalStatus !== undefined) {
      updateData.approvalStatus = approvalStatus;
      if (approvalStatus === "APPROVED") {
        updateData.approvedAt = new Date();
        updateData.approvedById = session.user.id;
      }
    }

    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: updateData,
    });

    // Log the event
    await prisma.eventLog.create({
      data: {
        eventType: "DOCUMENT_UPDATED",
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetType: "Document",
        targetId: documentId,
        eventData: JSON.stringify({
          contentUpdated: content !== undefined,
          approvalStatus,
        }),
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json(updatedDocument);
  } catch (error) {
    console.error("Error updating document:", error);
    return NextResponse.json(
      { error: "Failed to update document" },
      { status: 500 }
    );
  }
}
