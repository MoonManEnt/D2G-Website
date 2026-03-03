/**
 * Single Evidence API — Get, Update, Delete
 *
 * GET    /api/clients/[id]/evidence/[evidenceId] — Get single evidence
 * PATCH  /api/clients/[id]/evidence/[evidenceId] — Update label/description/dispute link
 * DELETE /api/clients/[id]/evidence/[evidenceId] — Delete evidence
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { deleteFile } from "@/lib/storage";
import { createLogger } from "@/lib/logger";

const log = createLogger("evidence-detail-api");

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string; evidenceId: string }>;
}

// GET /api/clients/[id]/evidence/[evidenceId]
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: clientId, evidenceId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const evidence = await prisma.evidence.findFirst({
      where: {
        id: evidenceId,
        clientId,
        organizationId: session.user.organizationId,
      },
      include: {
        renderedFile: true,
        sourceFile: true,
        dispute: { select: { id: true, cra: true, round: true, status: true } },
        accountItem: { select: { id: true, creditorName: true, maskedAccountId: true } },
      },
    });

    if (!evidence) {
      return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
    }

    return NextResponse.json({ evidence });
  } catch (error) {
    log.error({ err: error }, "Error getting evidence");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get evidence" },
      { status: 500 }
    );
  }
}

// PATCH /api/clients/[id]/evidence/[evidenceId]
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: clientId, evidenceId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify evidence exists and belongs to this client/org
    const existing = await prisma.evidence.findFirst({
      where: {
        id: evidenceId,
        clientId,
        organizationId: session.user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
    }

    const body = await request.json();
    const { title, description, disputeId, accountItemId } = body as {
      title?: string;
      description?: string;
      disputeId?: string | null;
      accountItemId?: string | null;
    };

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (disputeId !== undefined) updateData.disputeId = disputeId;
    if (accountItemId !== undefined) updateData.accountItemId = accountItemId;

    const evidence = await prisma.evidence.update({
      where: { id: evidenceId },
      data: updateData,
      include: {
        renderedFile: true,
        sourceFile: true,
        dispute: { select: { id: true, cra: true, round: true, status: true } },
      },
    });

    return NextResponse.json({ evidence });
  } catch (error) {
    log.error({ err: error }, "Error updating evidence");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update evidence" },
      { status: 500 }
    );
  }
}

// DELETE /api/clients/[id]/evidence/[evidenceId]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: clientId, evidenceId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const evidence = await prisma.evidence.findFirst({
      where: {
        id: evidenceId,
        clientId,
        organizationId: session.user.organizationId,
      },
      include: {
        renderedFile: true,
        sourceFile: true,
      },
    });

    if (!evidence) {
      return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
    }

    // Delete files from storage
    if (evidence.renderedFile) {
      await deleteFile(evidence.renderedFile.storagePath).catch((err) => {
        log.error({ err }, "Failed to delete rendered file from storage");
      });
    }
    if (evidence.sourceFile) {
      await deleteFile(evidence.sourceFile.storagePath).catch((err) => {
        log.error({ err }, "Failed to delete source file from storage");
      });
    }

    // Delete evidence (cascades to DocumentEvidence via FK)
    await prisma.evidence.delete({ where: { id: evidenceId } });

    // Clean up orphaned StoredFile records
    if (evidence.renderedFileId) {
      await prisma.storedFile.delete({ where: { id: evidence.renderedFileId } }).catch(() => {});
    }
    if (evidence.sourceFileId) {
      await prisma.storedFile.delete({ where: { id: evidence.sourceFileId } }).catch(() => {});
    }

    log.info({ evidenceId, clientId }, "Evidence deleted");

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, "Error deleting evidence");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete evidence" },
      { status: 500 }
    );
  }
}
