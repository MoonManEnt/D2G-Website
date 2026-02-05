import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { v4 as uuid } from "uuid";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import { evidenceCaptureSchema } from "@/lib/api-validation-schemas";
import { createLogger } from "@/lib/logger";
const log = createLogger("evidence-capture-api");

export const dynamic = "force-dynamic";

// Set worker source for pdfjs
const workerPath = join(process.cwd(), "node_modules/pdfjs-dist/build/pdf.worker.mjs");
GlobalWorkerOptions.workerSrc = workerPath;

const EVIDENCE_DIR = process.env.EVIDENCE_DIR || "./public/evidence";

/**
 * POST /api/evidence/capture - SERVER-SIDE PDF page extraction as evidence
 *
 * USE THIS ROUTE WHEN:
 * - You need to automatically extract relevant pages from a credit report PDF
 * - You want to capture pages that contain a specific account/creditor
 * - You need bulk evidence generation for an account
 *
 * DO NOT USE THIS ROUTE FOR:
 * - Client-side screenshot uploads (use /api/evidence/upload instead)
 * - Custom UI captures
 *
 * This route:
 * 1. Reads the original PDF from storage
 * 2. Searches for pages containing the creditor name
 * 3. Extracts text snippets from those pages
 * 4. Creates evidence records with the extracted content
 *
 * Note: Full image rendering would require canvas (not available in Node.js),
 * so this extracts text instead. For visual evidence, use /api/evidence/upload
 * with client-rendered screenshots.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = evidenceCaptureSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { accountId, reportId } = parsed.data;

    // Verify account belongs to organization
    const account = await prisma.accountItem.findFirst({
      where: {
        id: accountId,
        organizationId: session.user.organizationId,
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Get report with file info
    const report = await prisma.creditReport.findFirst({
      where: {
        id: reportId,
        organizationId: session.user.organizationId,
      },
      include: {
        originalFile: true,
      },
    });

    if (!report || !report.originalFile) {
      return NextResponse.json({ error: "Report or file not found" }, { status: 404 });
    }

    // Read the PDF file
    const pdfBuffer = await readFile(report.originalFile.storagePath);
    const uint8Array = new Uint8Array(pdfBuffer);

    // Load PDF
    const loadingTask = getDocument({
      data: uint8Array,
      useSystemFonts: true,
      isEvalSupported: false,
      useWorkerFetch: false,
      disableFontFace: true,
    });

    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    // Find pages that contain this account's creditor name
    const creditorName = account.creditorName.toUpperCase();
    const pagesWithAccount: number[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .toUpperCase();

      if (pageText.includes(creditorName)) {
        pagesWithAccount.push(pageNum);
      }
    }

    if (pagesWithAccount.length === 0) {
      // If no specific pages found, capture first few pages
      pagesWithAccount.push(1, 2, 3);
    }

    // Limit to max 5 pages
    const pagesToCapture = pagesWithAccount.slice(0, 5);

    // Create evidence directory
    const evidenceDir = join(EVIDENCE_DIR, session.user.organizationId, accountId);
    await mkdir(evidenceDir, { recursive: true });

    const capturedEvidence: Array<{
      id: string;
      pageNumber: number;
      filePath: string;
    }> = [];

    // For each page, create a text-based evidence record
    // (Full image rendering would require canvas which isn't available in Node.js)
    // Instead, we'll extract the text snippet around the account
    for (const pageNum of pagesToCapture) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");

      // Find the section containing the account
      const creditorIndex = pageText.toUpperCase().indexOf(creditorName);
      const snippetStart = Math.max(0, creditorIndex - 100);
      const snippetEnd = Math.min(pageText.length, creditorIndex + 500);
      const textSnippet = pageText.substring(snippetStart, snippetEnd);

      // Create a text evidence file
      const evidenceId = uuid();
      const evidenceFileName = `${evidenceId}_page${pageNum}.txt`;
      const evidenceFilePath = join(evidenceDir, evidenceFileName);

      const evidenceContent = `
================================================================================
CREDIT REPORT EVIDENCE
================================================================================
Report ID: ${reportId}
Account: ${account.creditorName}
Account Number: ${account.maskedAccountId}
CRA: ${account.cra}
Page: ${pageNum} of ${numPages}
Captured: ${new Date().toISOString()}
================================================================================

EXTRACTED TEXT FROM PAGE ${pageNum}:
--------------------------------------------------------------------------------
${textSnippet}
--------------------------------------------------------------------------------

ACCOUNT DETAILS:
- Status: ${account.accountStatus}
- Balance: ${account.balance ? `$${Number(account.balance).toLocaleString()}` : "N/A"}
- Past Due: ${account.pastDue ? `$${Number(account.pastDue).toLocaleString()}` : "N/A"}
- Issues Detected: ${account.issueCount}

DETECTED ISSUES:
${account.detectedIssues || "None"}

================================================================================
`;

      await writeFile(evidenceFilePath, evidenceContent);

      // Create evidence record in database
      const evidence = await prisma.evidence.create({
        data: {
          evidenceType: "PDF_TEXT_EXTRACT",
          title: `Page ${pageNum} - ${account.creditorName}`,
          description: `Text extract from credit report page ${pageNum} for account ${account.creditorName}. Snippet: ${textSnippet.substring(0, 200)}...`,
          sourceFileId: report.originalFile.id,
          sourcePageNum: pageNum,
          accountItemId: accountId,
          organizationId: session.user.organizationId,
        },
      });

      capturedEvidence.push({
        id: evidence.id,
        pageNumber: pageNum,
        filePath: evidenceFilePath,
      });
    }

    // Log the capture event
    await prisma.eventLog.create({
      data: {
        eventType: "EVIDENCE_CAPTURED",
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetType: "AccountItem",
        targetId: accountId,
        eventData: JSON.stringify({
          reportId,
          pagesCapture: pagesToCapture,
          evidenceCount: capturedEvidence.length,
        }),
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json({
      success: true,
      accountId,
      capturedCount: capturedEvidence.length,
      evidence: capturedEvidence,
      message: `Captured ${capturedEvidence.length} page(s) as evidence`,
    });

  } catch (error) {
    log.error({ err: error }, "Error capturing evidence");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to capture evidence" },
      { status: 500 }
    );
  }
}
