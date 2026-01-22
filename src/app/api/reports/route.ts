import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { v4 as uuid } from "uuid";
import { extractTextFromBuffer } from "@/lib/pdf-extract";
import { parseIdentityIQReport, analyzeAccountsForIssues, getIssuesSummary } from "@/lib/parser";
import { computeConfidenceLevel } from "@/types";

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds for PDF processing

// GET /api/reports - List reports
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reports = await prisma.creditReport.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      include: {
        client: {
          select: { firstName: true, lastName: true },
        },
        _count: {
          select: { accounts: true },
        },
      },
      orderBy: { uploadedAt: "desc" },
    });

    return NextResponse.json(reports);

  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 }
    );
  }
}

// POST /api/reports - Upload new report (supports both direct upload and blob URL)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check subscription
    if (session.user.subscriptionTier === "FREE") {
      return NextResponse.json(
        { error: "Report upload requires Pro subscription" },
        { status: 403 }
      );
    }

    const contentType = request.headers.get("content-type") || "";

    let clientId: string;
    let reportDate: string | null = null;
    let pdfBuffer: Buffer;
    let fileName: string;
    let fileSize: number;
    let blobUrl: string | undefined;

    // Check if this is a JSON request (blob URL)
    if (contentType.includes("application/json")) {
      // Blob URL mode - fetch PDF from blob storage
      const body = await request.json();
      clientId = body.clientId;
      reportDate = body.reportDate;
      blobUrl = body.blobUrl;
      fileName = body.fileName || "report.pdf";

      if (!clientId || !blobUrl) {
        return NextResponse.json(
          { error: "clientId and blobUrl are required" },
          { status: 400 }
        );
      }

      // Fetch the PDF from blob storage
      const blobResponse = await fetch(blobUrl);
      if (!blobResponse.ok) {
        return NextResponse.json(
          { error: "Failed to fetch PDF from storage" },
          { status: 400 }
        );
      }

      const arrayBuffer = await blobResponse.arrayBuffer();
      pdfBuffer = Buffer.from(arrayBuffer);
      fileSize = pdfBuffer.length;

    } else {
      // Direct upload mode is disabled because we cannot persist files in serverless environment
      // reliably without an external storage provider (which is what Vercel Blob is for).
      // Falling back to direct upload creates "zombie" reports with unviewable PDFs.
      console.error(`Unsupported content-type: ${contentType}`);
      return NextResponse.json(
        { error: "Unsupported content-type. Please use the client-side upload flow." },
        { status: 415 }
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
        storagePath: blobUrl || `blob://${fileId}`, // Use actual URL if available
        storageType: "BLOB",
        organizationId: session.user.organizationId,
      },
    });

    // Create report record
    const report = await prisma.creditReport.create({
      data: {
        reportDate: reportDate ? new Date(reportDate) : new Date(),
        sourceType: "IDENTITYIQ",
        originalFileId: storedFile.id,
        parseStatus: "PENDING",
        organizationId: session.user.organizationId,
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
        organizationId: session.user.organizationId,
      },
    });

    // Auto-trigger parsing
    let parseResult = null;
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
        parseResult = await parseIdentityIQReport(extractionResult.text);

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
                organizationId: session.user.organizationId,
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
              organizationId: session.user.organizationId,
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

      // We don't throw here to ensure the upload itself is still considered successful
      // The user will see the "FAILED" status in the UI
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

  } catch (error) {
    console.error("Error uploading report:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to upload report: ${errorMessage}` },
      { status: 500 }
    );
  }
}
