import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { v4 as uuid } from "uuid";
import { addJob } from "@/lib/queue";
import { createLogger } from "@/lib/logger";
import { uploadFile, generateFileKey, getStorageProvider } from "@/lib/storage";
const log = createLogger("reports-upload-api");

// Supported file types for credit report uploads
const SUPPORTED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

const MIME_TO_TYPE: Record<string, "PDF" | "PNG" | "JPG" | "JPEG" | "WEBP"> = {
  "application/pdf": "PDF",
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "image/jpg": "JPG",
  "image/webp": "WEBP",
};

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Allow up to 120 seconds for OCR+AI processing

/**
 * POST /api/reports/upload - Direct file upload endpoint
 *
 * Accepts FormData with:
 * - file: PDF file
 * - clientId: Client ID to associate the report with
 *
 * This endpoint handles the complete upload flow:
 * 1. Saves file to local uploads directory
 * 2. Creates database records
 * 3. Triggers PDF parsing
 */
export async function POST(req: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId, email: userEmail, organizationId, subscriptionTier } = session.user;

    // Subscription check - FREE tier cannot upload reports
    if (subscriptionTier === "FREE") {
      return NextResponse.json(
        {
          error: "Report upload requires a paid subscription",
          code: "SUBSCRIPTION_REQUIRED",
          upgradeUrl: "/settings/billing"
        },
        { status: 403 }
      );
    }

    // Parse form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const clientId = formData.get("clientId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!clientId) {
      return NextResponse.json({ error: "Client ID is required" }, { status: 400 });
    }

    // Validate file type
    const mimeType = file.type || "application/pdf";
    if (!SUPPORTED_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${mimeType}. Supported: PDF, PNG, JPG, WEBP` },
        { status: 400 }
      );
    }

    const fileType = MIME_TO_TYPE[mimeType] || "PDF";
    const isImage = fileType !== "PDF";

    // Check for AI parsing preference (optional query param or form field)
    const useAIParsing = formData.get("useAI") === "true" || isImage;

    // Verify client belongs to organization
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    const fileSize = fileBuffer.length;

    // Generate unique filename using unified storage
    const fileId = uuid();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storageKey = `reports/${fileId}-${safeFileName}`;

    // Upload using unified storage API
    const uploadResult = await uploadFile(fileBuffer, storageKey, mimeType);
    const relativePath = uploadResult.url;
    const storageType = uploadResult.provider === "local" ? "LOCAL" :
                        uploadResult.provider === "vercel-blob" ? "VERCEL_BLOB" : "BLOB";

    log.info({
      key: storageKey,
      url: relativePath,
      provider: uploadResult.provider,
      fileType
    }, "[UPLOAD] File saved via unified storage");

    // Create database records in transaction
    const { storedFile, report } = await prisma.$transaction(async (tx) => {
      // Create file record
      const storedFile = await tx.storedFile.create({
        data: {
          id: fileId,
          filename: file.name,
          mimeType: mimeType,
          sizeBytes: fileSize,
          storagePath: relativePath,
          storageType: storageType,
          organizationId,
        },
      });

      // Create report record - sourceType determined by parsing
      const report = await tx.creditReport.create({
        data: {
          reportDate: new Date(),
          sourceType: isImage ? "OTHER" : "IDENTITYIQ", // Will be updated after parsing
          originalFileId: storedFile.id,
          parseStatus: "PENDING",
          organizationId,
          clientId,
          uploadedById: userId,
        },
      });

      // Log upload event
      await tx.eventLog.create({
        data: {
          eventType: "REPORT_UPLOADED",
          actorId: userId,
          actorEmail: userEmail,
          targetType: "CreditReport",
          targetId: report.id,
          eventData: JSON.stringify({
            clientId,
            fileName: file.name,
            fileSize,
          }),
          organizationId,
        },
      });

      return { storedFile, report };
    });

    // Enqueue background parsing job
    // This returns immediately so the upload doesn't block on parsing
    const jobId = await addJob("parse-credit-report", {
      reportId: report.id,
      organizationId,
      clientId,
      actorId: userId,
      actorEmail: userEmail || "",
      storagePath: relativePath,
      fileBuffer: fileBuffer.toString("base64"), // Pass buffer for immediate processing
      useAIParsing,
      fileType,
    });

    log.info({ reportId: report.id, jobId, useAI: useAIParsing }, "[UPLOAD] Parse job enqueued");

    // Return immediately with pending status
    // Client should poll /api/reports/[id] or /api/reports/[id]/parse for status
    return NextResponse.json({
      id: report.id,
      status: "PENDING",
      message: "Report uploaded successfully. Parsing in progress...",
      jobId,
      pollUrl: `/api/reports/${report.id}/parse`,
    }, { status: 202 }); // 202 Accepted - processing started

  } catch (error) {
    log.error({ err: error }, "Upload error");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
