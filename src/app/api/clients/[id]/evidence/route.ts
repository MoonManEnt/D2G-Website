/**
 * Evidence API — List & Create
 *
 * GET  /api/clients/[id]/evidence — List evidence for a client
 * POST /api/clients/[id]/evidence — Create evidence record after file upload
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createLogger } from "@/lib/logger";

const log = createLogger("evidence-api");

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/clients/[id]/evidence
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: clientId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const disputeId = searchParams.get("disputeId");
    const captureSource = searchParams.get("captureSource");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Verify client belongs to org
    const client = await prisma.client.findFirst({
      where: { id: clientId, organizationId: session.user.organizationId },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Build where clause
    const where: Record<string, unknown> = {
      clientId,
      organizationId: session.user.organizationId,
    };

    if (disputeId) {
      where.disputeId = disputeId;
    }

    if (captureSource) {
      where.captureSource = captureSource;
    }

    const [evidence, total] = await Promise.all([
      prisma.evidence.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          renderedFile: true,
          sourceFile: true,
          dispute: { select: { id: true, cra: true, round: true, status: true } },
        },
      }),
      prisma.evidence.count({ where }),
    ]);

    return NextResponse.json({
      evidence,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    log.error({ err: error }, "Error listing evidence");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list evidence" },
      { status: 500 }
    );
  }
}

// POST /api/clients/[id]/evidence
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: clientId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify client belongs to org
    const client = await prisma.client.findFirst({
      where: { id: clientId, organizationId: session.user.organizationId },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      fileUrl,
      fileName,
      fileType,
      fileSize,
      storagePath,
      disputeId,
      label,
      description,
      captureSource = "UPLOAD",
      accountItemId,
      sourcePageNum,
    } = body as {
      fileUrl: string;
      fileName: string;
      fileType: string;
      fileSize: number;
      storagePath?: string;
      disputeId?: string;
      label?: string;
      description?: string;
      captureSource?: string;
      accountItemId?: string;
      sourcePageNum?: number;
    };

    if (!fileUrl || !fileName) {
      return NextResponse.json(
        { error: "fileUrl and fileName are required" },
        { status: 400 }
      );
    }

    // Create StoredFile record
    const storedFile = await prisma.storedFile.create({
      data: {
        filename: fileName,
        mimeType: fileType || "image/png",
        sizeBytes: fileSize || 0,
        storagePath: storagePath || fileUrl,
        storageType: fileUrl.startsWith("https://") ? "CLOUD" : "LOCAL",
        organizationId: session.user.organizationId,
      },
    });

    // Create Evidence record
    const evidence = await prisma.evidence.create({
      data: {
        evidenceType: captureSource === "PDF_CROP" ? "SCREENSHOT" : "UPLOAD",
        title: label || fileName,
        description,
        captureSource,
        clientId,
        disputeId: disputeId || undefined,
        accountItemId: accountItemId || undefined,
        sourcePageNum: sourcePageNum || undefined,
        renderedFileId: storedFile.id,
        organizationId: session.user.organizationId,
      },
      include: {
        renderedFile: true,
        dispute: { select: { id: true, cra: true, round: true, status: true } },
      },
    });

    log.info({ evidenceId: evidence.id, clientId, captureSource }, "Evidence created");

    return NextResponse.json({ evidence }, { status: 201 });
  } catch (error) {
    log.error({ err: error }, "Error creating evidence");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create evidence" },
      { status: 500 }
    );
  }
}
