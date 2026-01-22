import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { v4 as uuid } from "uuid";
import { extractTextFromBuffer } from "@/lib/pdf-extract";
import { parseIdentityIQReport, analyzeAccountsForIssues, getIssuesSummary } from "@/lib/parser";
import { computeConfidenceLevel } from "@/types";
import { withAuth } from "@/lib/api-middleware";
import { z } from "zod";
import path from "path";
import fs from "fs";

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

// GET /api/reports - List reports
export const GET = withAuth(async (req, { organizationId }) => {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('clientId');

  const where: any = {
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

// POST /api/reports - Upload new report
export const POST = withAuth<UploadReportBody>(async (req, { session, body, organizationId }) => {
  // Check subscription
  if (session.user.subscriptionTier === "FREE") {
    return NextResponse.json(
      { error: "Report upload requires Pro subscription" },
      { status: 403 }
    );
  }

  const { clientId, blobUrl, fileName, reportDate } = body;
  console.log("📂 [REPORTS] Processing upload:", { clientId, fileName, blobUrl });

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

      console.log(`📂 [REPORTS] Trying local paths: ${localPath} OR ${uploadsPath}`);

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
    console.error("PDF retrieval error:", fetchError);
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

  // Create file record
  const fileId = uuid();
  const storedFile = await prisma.storedFile.create({
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
  const report = await prisma.creditReport.create({
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
  await prisma.eventLog.create({
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

  // Auto-trigger parsing
  let accountsParsed = 0;

  try {
    // Update status to processing
    await prisma.creditReport.update({
      where: { id: report.id },
      data: { parseStatus: "PROCESSING" },
    });

    // Extract text from PDF buffer (in-memory processing)
    const extractionResult = await extractTextFromBuffer(pdfBuffer);

    if (extractionResult.success) {
      // Parse the extracted text
      const parseResult = await parseIdentityIQReport(extractionResult.text);

      if (parseResult.success) {
        // Analyze accounts for potential FCRA violations and issues
        const analyzedAccounts = analyzeAccountsForIssues(parseResult.accounts);
        const issuesSummary = getIssuesSummary(analyzedAccounts);

        console.log(`Analysis complete: ${issuesSummary.disputableAccounts} disputable accounts, ${issuesSummary.highSeverityIssues} high severity issues`);

        // Create AccountItem records with issues
        for (const account of analyzedAccounts) {
          const confidenceLevel = computeConfidenceLevel(account.confidenceScore);

          await prisma.accountItem.create({
            data: {
              creditorName: account.creditorName,
              maskedAccountId: account.maskedAccountId,
              fingerprint: account.fingerprint || `${account.creditorName}:${account.maskedAccountId}`,
              cra: account.cra,
              accountType: account.accountType,
              accountStatus: account.accountStatus,
              balance: account.balance,
              pastDue: account.pastDue,
              creditLimit: account.creditLimit,
              highBalance: account.highBalance,
              monthlyPayment: account.monthlyPayment,
              dateOpened: account.dateOpened ? new Date(account.dateOpened) : null,
              dateReported: account.dateReported ? new Date(account.dateReported) : null,
              lastActivityDate: account.lastActivityDate ? new Date(account.lastActivityDate) : null,
              paymentStatus: account.paymentStatus,
              disputeComment: account.disputeComment,
              confidenceScore: account.confidenceScore,
              confidenceLevel: confidenceLevel,
              suggestedFlow: account.suggestedFlow,
              isDisputable: account.isDisputable,
              issueCount: account.issues.length,
              detectedIssues: account.issues.length > 0 ? JSON.stringify(account.issues) : null,
              rawExtractedData: account.rawExtractedData ? JSON.stringify(account.rawExtractedData) : null,
              reportId: report.id,
              organizationId,
              clientId,
            },
          });

          accountsParsed++;
        }

        // Update report status to completed
        await prisma.creditReport.update({
          where: { id: report.id },
          data: {
            parseStatus: "COMPLETED",
            pageCount: extractionResult.pageCount,
            parseError: null,
          },
        });

        // Log parse success
        await prisma.eventLog.create({
          data: {
            eventType: "REPORT_PARSED",
            actorId: session.user.id,
            actorEmail: session.user.email,
            targetType: "CreditReport",
            targetId: report.id,
            eventData: JSON.stringify({
              accountsParsed,
              pageCount: extractionResult.pageCount,
              warnings: parseResult.warnings.length,
            }),
            organizationId,
          },
        });
      } else {
        // Parse failed
        const errorMessage = parseResult.errors[0]?.message || "Failed to parse report";
        await prisma.creditReport.update({
          where: { id: report.id },
          data: {
            parseStatus: "FAILED",
            parseError: errorMessage,
          },
        });
      }
    } else {
      // Extraction failed
      await prisma.creditReport.update({
        where: { id: report.id },
        data: {
          parseStatus: "FAILED",
          parseError: extractionResult.error || "Failed to extract text from PDF",
        },
      });
    }
  } catch (parseError) {
    console.error("Auto-parse trigger error:", parseError);

    const errorMessage = parseError instanceof Error ? parseError.message : "Unknown parsing error during trigger";

    // Update the report status to FAILED with the specific error
    await prisma.creditReport.update({
      where: { id: report.id },
      data: {
        parseStatus: "FAILED",
        parseError: `Auto-parse failed: ${errorMessage}`,
      },
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
    message: finalReport?.parseStatus === "COMPLETED"
      ? `Report uploaded and parsed successfully. ${accountsParsed} accounts found.`
      : finalReport?.parseStatus === "FAILED"
        ? `Report uploaded but parsing failed: ${finalReport.parseError}`
        : "Report uploaded successfully.",
    accountsParsed: finalReport?._count?.accounts || 0,
    pageCount: finalReport?.pageCount || 0,
  }, { status: 201 });
}, { schema: uploadReportSchema });
