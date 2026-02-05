import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { v4 as uuid } from "uuid";
import path from "path";
import fs from "fs";
import { parseAndAnalyzeReport } from "@/lib/report-parser";
import { put } from "@vercel/blob";
import { createLogger } from "@/lib/logger";
const log = createLogger("reports-upload-api");

// Detect if running on Vercel (production)
const isVercel = process.env.VERCEL === "1";

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds for PDF processing

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
    const pdfBuffer = Buffer.from(arrayBuffer);
    const fileSize = pdfBuffer.length;

    // Generate unique filename
    const fileId = uuid();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const blobName = `reports/${fileId}-${safeFileName}`;

    let relativePath: string;
    let storageType: "LOCAL" | "VERCEL_BLOB";

    if (isVercel) {
      // Production: Use Vercel Blob storage
      const blob = await put(blobName, pdfBuffer, {
        access: "public",
        contentType: "application/pdf",
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
      fs.writeFileSync(storagePath, pdfBuffer);
      log.info({ storagePath }, "[UPLOAD] File saved to");
    }

    // Create database records in transaction
    const { storedFile, report } = await prisma.$transaction(async (tx) => {
      // Create file record
      const storedFile = await tx.storedFile.create({
        data: {
          id: fileId,
          filename: file.name,
          mimeType: "application/pdf",
          sizeBytes: fileSize,
          storagePath: relativePath,
          storageType: storageType,
          organizationId,
        },
      });

      // Create report record
      const report = await tx.creditReport.create({
        data: {
          reportDate: new Date(),
          sourceType: "IDENTITYIQ",
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

    // Auto-trigger parsing
    const parseResult = await parseAndAnalyzeReport({
      reportId: report.id,
      organizationId,
      clientId,
      actorId: userId,
      actorEmail: userEmail || "",
      pdfBuffer,
    });

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
