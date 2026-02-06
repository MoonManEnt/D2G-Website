import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { v4 as uuid } from "uuid";
import path from "path";
import fs from "fs";
import { parseAndAnalyzeReport, parseAndAnalyzeReportAI } from "@/lib/report-parser";
import { put } from "@vercel/blob";
import { createLogger } from "@/lib/logger";
const log = createLogger("reports-upload-api");

// Detect if running on Vercel (production)
const isVercel = process.env.VERCEL === "1";

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

    // Note: Subscription check removed for beta testing
    // In production, uncomment to restrict FREE tier:
    // if (subscriptionTier === "FREE") {
    //   return NextResponse.json(
    //     { error: "Report upload requires Pro subscription" },
    //     { status: 403 }
    //   );
    // }

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

    // Generate unique filename
    const fileId = uuid();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const blobName = `reports/${fileId}-${safeFileName}`;

    let relativePath: string;
    let storageType: "LOCAL" | "VERCEL_BLOB";

    if (isVercel) {
      // Production: Use Vercel Blob storage
      const blob = await put(blobName, fileBuffer, {
        access: "public",
        contentType: mimeType,
      });
      relativePath = blob.url;
      storageType = "VERCEL_BLOB";
      log.info({ url: blob.url }, "[UPLOAD] File saved to Vercel Blob");
    } else {
      // Local: Use filesystem
      const uploadsDir = path.join(process.cwd(), "uploads", "reports");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const storagePath = path.join(uploadsDir, `${fileId}-${safeFileName}`);
      relativePath = `uploads/reports/${fileId}-${safeFileName}`;
      storageType = "LOCAL";
      fs.writeFileSync(storagePath, fileBuffer);
      log.info({ storagePath, fileType }, "[UPLOAD] File saved to");
    }

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

    // Auto-trigger parsing - use AI parser for images or when requested
    let parseResult;
    if (useAIParsing) {
      log.info({ useAI: true, isImage, fileType }, "[UPLOAD] Using AI-powered parsing");
      parseResult = await parseAndAnalyzeReportAI({
        reportId: report.id,
        organizationId,
        clientId,
        actorId: userId,
        actorEmail: userEmail || "",
        fileBuffer,
        fileType,
      });
    } else {
      parseResult = await parseAndAnalyzeReport({
        reportId: report.id,
        organizationId,
        clientId,
        actorId: userId,
        actorEmail: userEmail || "",
        pdfBuffer: fileBuffer,
      });
    }

    // Fetch final report state
    const finalReport = await prisma.creditReport.findUnique({
      where: { id: report.id },
      select: {
        id: true,
        parseStatus: true,
        parseError: true,
        pageCount: true,
        _count: { select: { accounts: true } },
      },
    });

    return NextResponse.json({
      id: report.id,
      status: finalReport?.parseStatus || "PENDING",
      message: parseResult.success
        ? `Report uploaded and parsed successfully. ${parseResult.accountsParsed} accounts found.`
        : `Report uploaded but parsing failed: ${parseResult.error}`,
      accountsParsed: parseResult.accountsParsed,
      pageCount: parseResult.pageCount,
      issuesSummary: parseResult.issuesSummary,
    }, { status: 201 });

  } catch (error) {
    log.error({ err: error }, "Upload error");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
