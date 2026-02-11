import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { v4 as uuid } from "uuid";
import { withAuth } from "@/lib/api-middleware";
import { z } from "zod";
import path from "path";
import fs from "fs";
import { addJob } from "@/lib/queue";
import { createLogger } from "@/lib/logger";
const log = createLogger("reports-api");

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds for PDF processing

// Schema for report upload
const uploadReportSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  blobUrl: z.string().min(1, "Blob URL is required"),
  fileName: z.string().optional().default("report.pdf"),
  reportDate: z.string().datetime().optional().nullable(),
});

type UploadReportBody = z.infer<typeof uploadReportSchema>;

/**
 * GET /api/reports - List reports
 */
export const GET = withAuth(async (req, { organizationId }) => {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('clientId');

  const where: Record<string, unknown> = {
    organizationId,
  };

  if (clientId && clientId !== "all") {
    where.clientId = clientId;
  }

  const reports = await prisma.creditReport.findMany({
    where,
    include: {
      client: {
        select: { firstName: true, lastName: true },
      },
      _count: {
        select: { accounts: true },
      },
    },
    orderBy: { uploadedAt: "desc" },
    take: 100,
  });

  return NextResponse.json(reports);
});

/**
 * POST /api/reports - Upload new report
 *
 * This route:
 * 1. Validates subscription tier
 * 2. Fetches PDF from storage (cloud or local)
 * 3. Creates file and report records in a transaction
 * 4. Triggers parsing using the shared parseAndAnalyzeReport utility
 *
 * The parsing logic is centralized in lib/report-parser.ts to ensure
 * consistency with manual re-parse operations.
 */
export const POST = withAuth<UploadReportBody>(async (req, { session, body, organizationId }) => {
  // Subscription check - FREE tier cannot upload reports
  if (session.user.subscriptionTier === "FREE") {
    return NextResponse.json(
      {
        error: "Report upload requires a paid subscription",
        code: "SUBSCRIPTION_REQUIRED",
        upgradeUrl: "/settings/billing"
      },
      { status: 403 }
    );
  }

  const { clientId, blobUrl, fileName, reportDate } = body;
  log.info({ data: { clientId, fileName, blobUrl } }, "[REPORTS] Processing upload");

  let pdfBuffer: Buffer = Buffer.alloc(0);
  let fileSize: number = 0;

  // Fetch the PDF from storage (could be cloud URL or local public path)
  try {
    let blobResponse;
    if (blobUrl.startsWith('http')) {
      blobResponse = await fetch(blobUrl);
    } else {
      // Local file fetch from public folder or absolute path
      const rootDir = process.cwd();
      const localPath = path.join(rootDir, 'public', blobUrl.replace(/^\/public/, ''));
      const uploadsPath = path.join(rootDir, blobUrl.startsWith('/') ? blobUrl.slice(1) : blobUrl);

      log.info({ localPath, uploadsPath }, "[REPORTS] Trying local paths: OR");

      let fileBuffer: Buffer;
      if (fs.existsSync(localPath)) {
        fileBuffer = fs.readFileSync(localPath);
      } else if (fs.existsSync(uploadsPath)) {
        fileBuffer = fs.readFileSync(uploadsPath);
      } else {
        throw new Error(`Local file not found at ${localPath} or ${uploadsPath}`);
      }

      pdfBuffer = fileBuffer;
      fileSize = fileBuffer.length;
    }

    if (blobResponse) {
      if (!blobResponse.ok) {
        return NextResponse.json(
          { error: "Failed to fetch PDF from cloud storage" },
          { status: 400 }
        );
      }
      const arrayBuffer = await blobResponse.arrayBuffer();
      pdfBuffer = Buffer.from(arrayBuffer);
      fileSize = pdfBuffer.length;
    }
  } catch (fetchError) {
    log.error({ err: fetchError }, "PDF retrieval error");
    return NextResponse.json(
      { error: `Failed to retrieve uploaded file: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}` },
      { status: 400 }
    );
  }

  // Verify client belongs to organization
  const client = await prisma.client.findFirst({
    where: {
      id: clientId,
      organizationId,
    },
  });

  if (!client) {
    return NextResponse.json(
      { error: "Client not found" },
      { status: 404 }
    );
  }

  // Use transaction to create file and report records atomically
  const fileId = uuid();

  const { storedFile, report } = await prisma.$transaction(async (tx) => {
    // Create file record
    const storedFile = await tx.storedFile.create({
      data: {
        id: fileId,
        filename: fileName,
        mimeType: "application/pdf",
        sizeBytes: fileSize,
        storagePath: blobUrl,
        storageType: blobUrl.startsWith('http') ? "BLOB" : "LOCAL",
        organizationId,
      },
    });

    // Create report record
    const report = await tx.creditReport.create({
      data: {
        reportDate: reportDate ? new Date(reportDate) : new Date(),
        sourceType: "IDENTITYIQ",
        originalFileId: storedFile.id,
        parseStatus: "PENDING",
        organizationId,
        clientId,
        uploadedById: session.user.id,
      },
    });

    // Log upload event
    await tx.eventLog.create({
      data: {
        eventType: "REPORT_UPLOADED",
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetType: "CreditReport",
        targetId: report.id,
        eventData: JSON.stringify({
          clientId,
          fileName,
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
    actorId: session.user.id,
    actorEmail: session.user.email || "",
    storagePath: blobUrl,
    fileBuffer: pdfBuffer.toString("base64"), // Pass buffer for immediate processing
    useAIParsing: false,
    fileType: "PDF",
  });

  log.info({ reportId: report.id, jobId }, "[REPORTS] Parse job enqueued");

  // Return immediately with pending status
  // Client should poll /api/reports/[id] or /api/reports/[id]/parse for status
  return NextResponse.json({
    id: report.id,
    status: "PENDING",
    message: "Report uploaded successfully. Parsing in progress...",
    jobId,
    pollUrl: `/api/reports/${report.id}/parse`,
  }, { status: 202 }); // 202 Accepted - processing started
}, { schema: uploadReportSchema });
