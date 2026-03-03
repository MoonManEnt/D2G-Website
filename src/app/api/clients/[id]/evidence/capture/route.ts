/**
 * Evidence Capture API — Save PDF crop captures
 *
 * POST /api/clients/[id]/evidence/capture
 * Accepts base64 PNG from the PDF crop tool, saves to storage,
 * creates StoredFile + Evidence records.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { uploadFile, generateFileKey } from "@/lib/storage";
import { validateBase64Image } from "@/lib/upload-validation";
import { createLogger } from "@/lib/logger";

const log = createLogger("evidence-capture-api");

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/clients/[id]/evidence/capture
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
      imageData,
      sourceDocumentId,
      pageNumber,
      cropRegion,
      label,
      description,
      disputeId,
      accountItemId,
    } = body as {
      imageData: string;
      sourceDocumentId?: string;
      pageNumber?: number;
      cropRegion?: { x: number; y: number; width: number; height: number };
      label?: string;
      description?: string;
      disputeId?: string;
      accountItemId?: string;
    };

    if (!imageData) {
      return NextResponse.json(
        { error: "imageData (base64) is required" },
        { status: 400 }
      );
    }

    // Validate the base64 image
    const validation = validateBase64Image(imageData);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Extract the binary data from base64
    const matches = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json(
        { error: "Invalid base64 image format" },
        { status: 400 }
      );
    }

    const [, extension, base64Data] = matches;
    const buffer = Buffer.from(base64Data, "base64");
    const mimeType = `image/${extension}`;
    const fileName = `capture_${Date.now()}.${extension}`;

    // Upload to storage
    const fileKey = generateFileKey(session.user.organizationId, "evidence", fileName);
    const uploadResult = await uploadFile(buffer, fileKey, mimeType);

    // Create StoredFile record
    const storedFile = await prisma.storedFile.create({
      data: {
        filename: fileName,
        mimeType,
        sizeBytes: buffer.length,
        storagePath: uploadResult.key,
        storageType: uploadResult.provider === "local" ? "LOCAL" : "CLOUD",
        checksum: uploadResult.checksum,
        organizationId: session.user.organizationId,
      },
    });

    // Create Evidence record
    const evidence = await prisma.evidence.create({
      data: {
        evidenceType: "SCREENSHOT",
        title: label || `Page ${pageNumber || "?"} Capture`,
        description,
        captureSource: "PDF_CROP",
        sourcePageNum: pageNumber || undefined,
        cropRegion: cropRegion ? JSON.stringify(cropRegion) : undefined,
        clientId,
        disputeId: disputeId || undefined,
        accountItemId: accountItemId || undefined,
        sourceFileId: sourceDocumentId || undefined,
        renderedFileId: storedFile.id,
        organizationId: session.user.organizationId,
      },
      include: {
        renderedFile: true,
        dispute: { select: { id: true, cra: true, round: true, status: true } },
      },
    });

    log.info(
      { evidenceId: evidence.id, clientId, pageNumber, fileSize: buffer.length },
      "PDF crop capture saved"
    );

    return NextResponse.json({
      evidence,
      fileUrl: uploadResult.url,
    }, { status: 201 });
  } catch (error) {
    log.error({ err: error }, "Error saving capture");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save capture" },
      { status: 500 }
    );
  }
}
