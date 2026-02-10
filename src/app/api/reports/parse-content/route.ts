import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { v4 as uuid } from "uuid";
import { parseCreditReport } from "@/lib/credit-report";
import { createLogger } from "@/lib/logger";
const log = createLogger("reports-parse-content-api");

export const dynamic = "force-dynamic";
export const maxDuration = 120; // Allow up to 120 seconds for AI parsing

/**
 * POST /api/reports/parse-content - Parse pasted JSON or HTML content
 *
 * Accepts JSON body with:
 * - clientId: Client ID to associate the report with
 * - content: The pasted JSON or HTML string
 * - contentType: "json" | "html"
 */
export async function POST(req: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId, email: userEmail, organizationId } = session.user;

    // Parse request body
    const body = await req.json();
    const { clientId, content, contentType } = body;

    if (!clientId) {
      return NextResponse.json({ error: "Client ID is required" }, { status: 400 });
    }

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    if (!contentType || !["json", "html"].includes(contentType)) {
      return NextResponse.json({ error: "Content type must be 'json' or 'html'" }, { status: 400 });
    }

    log.info(
      {
        clientId,
        contentType,
        contentLength: content.length,
      },
      "Processing pasted content"
    );

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

    // Process content based on type
    let textToParse = content;

    if (contentType === "html") {
      // Extract text from HTML - basic extraction
      // Remove script and style tags
      textToParse = content
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        // Replace common HTML entities
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        // Replace tags with spaces/newlines
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<\/tr>/gi, "\n")
        .replace(/<\/td>/gi, "\t")
        .replace(/<\/th>/gi, "\t")
        .replace(/<[^>]+>/g, " ")
        // Clean up whitespace
        .replace(/\s+/g, " ")
        .replace(/\n\s+/g, "\n")
        .trim();

      log.info(
        { originalLength: content.length, extractedLength: textToParse.length },
        "Extracted text from HTML"
      );
    } else if (contentType === "json") {
      // For JSON, try to extract meaningful text
      try {
        const jsonData = JSON.parse(content);

        // Check if it's already in our expected format
        if (jsonData.accounts || jsonData.consumer || jsonData.bureaus) {
          // It's structured data, convert to text for parsing
          textToParse = JSON.stringify(jsonData, null, 2);
        } else {
          // Try to extract any text content
          textToParse = extractTextFromJSON(jsonData);
        }
      } catch {
        // If JSON parse fails, use as-is
        log.warn("JSON parse failed, using content as-is");
      }
    }

    // Validate we have enough content
    if (textToParse.length < 100) {
      return NextResponse.json(
        { error: "Content is too short to be a valid credit report" },
        { status: 400 }
      );
    }

    // Create a stored file record for the content
    const fileId = uuid();
    const storedFile = await prisma.storedFile.create({
      data: {
        id: fileId,
        filename: `pasted-${contentType}-${Date.now()}.txt`,
        mimeType: contentType === "json" ? "application/json" : "text/html",
        sizeBytes: content.length,
        storagePath: `pasted-content/${fileId}`, // Virtual path
        storageType: "MEMORY", // Indicates content was pasted, not stored
        organizationId,
      },
    });

    // Create report record
    const report = await prisma.creditReport.create({
      data: {
        reportDate: new Date(),
        sourceType: "PASTED",
        originalFileId: storedFile.id,
        parseStatus: "PARSING",
        parserVersion: "2.0.0",
        organizationId,
        clientId,
        uploadedById: userId,
      },
    });

    // Log the event
    await prisma.eventLog.create({
      data: {
        eventType: "REPORT_PASTED",
        actorId: userId,
        actorEmail: userEmail,
        targetType: "CreditReport",
        targetId: report.id,
        eventData: JSON.stringify({
          clientId,
          contentType,
          contentLength: content.length,
        }),
        organizationId,
      },
    });

    // Parse the content using our unified parser
    const parseResult = await parseCreditReport(textToParse, {
      enableOCR: false, // No OCR needed for pasted text
      preferAI: true,
      organizationId,
      detectIssues: true,
    });

    if (!parseResult.success || !parseResult.report) {
      // Update report status to failed
      await prisma.creditReport.update({
        where: { id: report.id },
        data: {
          parseStatus: "FAILED",
          parseError: parseResult.metadata.errors.join("; ") || "Failed to parse content",
        },
      });

      return NextResponse.json(
        {
          error: "Failed to parse credit report content",
          details: parseResult.metadata.errors,
        },
        { status: 422 }
      );
    }

    // Save parsed accounts
    let accountsParsed = 0;
    for (const account of parseResult.report.accounts) {
      try {
        // Generate fingerprint
        const fingerprint =
          account.fingerprint ||
          `${account.creditorName}:${account.accountNumber}:${account.bureau}`;

        // Check for existing account with same fingerprint
        const existing = await prisma.accountItem.findFirst({
          where: {
            reportId: report.id,
            fingerprint,
            cra: account.bureau,
          },
        });

        if (!existing) {
          await prisma.accountItem.create({
            data: {
              creditorName: account.creditorName,
              maskedAccountId: account.accountNumber,
              fingerprint,
              cra: account.bureau,
              accountType: account.accountType || "OTHER",
              accountStatus: account.accountStatus || account.status || "UNKNOWN",
              balance: account.balance,
              pastDue: account.pastDue,
              creditLimit: account.creditLimit,
              highBalance: account.highBalance,
              monthlyPayment: account.monthlyPayment,
              dateOpened: account.dateOpened ? new Date(account.dateOpened) : null,
              dateReported: account.dateReported ? new Date(account.dateReported) : null,
              lastActivityDate: account.lastActivityDate
                ? new Date(account.lastActivityDate)
                : null,
              paymentStatus: account.paymentStatus,
              paymentHistory: account.paymentHistory
                ? JSON.stringify(account.paymentHistory)
                : null,
              responsibility: account.responsibility,
              isAuthorizedUser: account.isAuthorizedUser || false,
              disputeNotations: account.disputeNotation,
              hasBeenPreviouslyDisputed: account.hasBeenPreviouslyDisputed || false,
              dateOfFirstDelinquency: account.dateOfFirstDelinquency
                ? new Date(account.dateOfFirstDelinquency)
                : null,
              bureauCode: account.bureauCode,
              sequenceIndex: account.sequenceIndex || 0,
              confidenceScore: Math.round((account.extractionConfidence || 0.7) * 100),
              confidenceLevel:
                (account.extractionConfidence || 0.7) >= 0.8
                  ? "HIGH"
                  : (account.extractionConfidence || 0.7) >= 0.5
                  ? "MEDIUM"
                  : "LOW",
              reportId: report.id,
              organizationId,
              clientId,
            },
          });
          accountsParsed++;
        }
      } catch (err) {
        log.error({ err, account: account.creditorName }, "Failed to save account");
      }
    }

    // Update report with success
    await prisma.creditReport.update({
      where: { id: report.id },
      data: {
        parseStatus: "COMPLETED",
        pageCount: 1,
        extractionMethod: "TEXT",
        extractionConfidence: parseResult.metadata.confidence,
      },
    });

    // Update client's last activity
    await prisma.client.update({
      where: { id: clientId },
      data: { lastActivityAt: new Date() },
    });

    log.info(
      {
        reportId: report.id,
        accountsParsed,
        confidence: parseResult.metadata.confidence,
      },
      "Pasted content parsed successfully"
    );

    return NextResponse.json(
      {
        id: report.id,
        status: "COMPLETED",
        message: `Content parsed successfully. ${accountsParsed} accounts found.`,
        accountsParsed,
        issuesSummary: parseResult.issues.length > 0
          ? {
              total: parseResult.issues.length,
              highPriority: parseResult.issues.filter((i) => i.severity === "HIGH").length,
            }
          : null,
      },
      { status: 201 }
    );
  } catch (error) {
    log.error({ err: error }, "Parse content error");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to parse content" },
      { status: 500 }
    );
  }
}

/**
 * Recursively extract text from JSON object
 */
function extractTextFromJSON(obj: unknown, depth = 0): string {
  if (depth > 10) return ""; // Prevent infinite recursion

  if (typeof obj === "string") {
    return obj;
  }

  if (typeof obj === "number" || typeof obj === "boolean") {
    return String(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => extractTextFromJSON(item, depth + 1)).join("\n");
  }

  if (typeof obj === "object" && obj !== null) {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      const valueStr = extractTextFromJSON(value, depth + 1);
      if (valueStr) {
        parts.push(`${key}: ${valueStr}`);
      }
    }
    return parts.join("\n");
  }

  return "";
}
