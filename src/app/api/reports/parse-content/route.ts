import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { v4 as uuid } from "uuid";
import { parseCreditReport } from "@/lib/credit-report";
import {
  parseHTMLCreditReport,
  detectCreditReportSource,
  isValidCreditReportHTML,
  type HTMLParseResult,
  type ParsedAccount,
} from "@/lib/credit-report/html-parsers";
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
    let htmlParseResult: HTMLParseResult | null = null;
    let useDirectHTMLParsing = false;

    if (contentType === "html") {
      // Detect the credit report source
      const source = detectCreditReportSource(content);
      log.info({ source, contentLength: content.length }, "Detected HTML source");

      // Try format-specific parsing first
      if (isValidCreditReportHTML(content)) {
        htmlParseResult = parseHTMLCreditReport(content);

        log.info(
          {
            source: htmlParseResult.source,
            accountsFound: htmlParseResult.accounts.length,
            scoresFound: htmlParseResult.scores.length,
            success: htmlParseResult.success,
          },
          "HTML parsing result"
        );

        // If we got good results from format-specific parsing, use them directly
        if (htmlParseResult.success && htmlParseResult.accounts.length > 0) {
          useDirectHTMLParsing = true;
          textToParse = htmlParseResult.rawText; // Keep for reference
        } else {
          // Fall back to AI parsing with extracted text
          textToParse = htmlParseResult.rawText;
        }
      } else {
        // Basic text extraction for unknown formats
        textToParse = content
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/p>/gi, "\n\n")
          .replace(/<\/div>/gi, "\n")
          .replace(/<\/tr>/gi, "\n")
          .replace(/<\/td>/gi, "\t")
          .replace(/<\/th>/gi, "\t")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .replace(/\n\s+/g, "\n")
          .trim();
      }

      log.info(
        {
          originalLength: content.length,
          extractedLength: textToParse.length,
          useDirectParsing: useDirectHTMLParsing,
        },
        "Processed HTML content"
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

    // Determine which parsing path to use
    let accountsToSave: ParsedAccount[] = [];
    let parseConfidence = 0.7;
    let parseErrors: string[] = [];

    if (useDirectHTMLParsing && htmlParseResult) {
      // Use format-specific HTML parsing results directly
      accountsToSave = htmlParseResult.accounts;
      parseConfidence = 0.85;
      parseErrors = htmlParseResult.errors;

      // Save credit scores if extracted
      for (const score of htmlParseResult.scores) {
        try {
          await prisma.creditScore.create({
            data: {
              cra: score.bureau,
              score: score.score,
              scoreType: score.scoreType || "VANTAGESCORE",
              scoreDate: new Date(),
              reportId: report.id,
              clientId,
            },
          });
        } catch (err) {
          log.warn({ err, score }, "Failed to save credit score");
        }
      }

      log.info(
        {
          source: htmlParseResult.source,
          accountCount: accountsToSave.length,
          scoreCount: htmlParseResult.scores.length,
        },
        "Using direct HTML parsing results"
      );
    } else {
      // Fall back to AI parsing
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

      // Convert AI parse results to our account format
      accountsToSave = parseResult.report.accounts.map((acc) => {
        // Convert payment history to our format if needed
        let paymentHistory: { date: string; status: string }[] | undefined;
        if (acc.paymentHistory && Array.isArray(acc.paymentHistory)) {
          paymentHistory = acc.paymentHistory.map((entry) => {
            if (typeof entry === "string") {
              return { date: "", status: entry };
            }
            // AI parser uses month/year format
            const entryAny = entry as { month?: string; year?: string; status?: string; statusCode?: string };
            const dateStr = entryAny.month && entryAny.year
              ? `${entryAny.month} ${entryAny.year}`
              : "";
            return {
              date: dateStr,
              status: String(entryAny.status || entryAny.statusCode || ""),
            };
          });
        }

        return {
          creditorName: acc.creditorName,
          accountNumber: acc.accountNumber,
          accountType: acc.accountType || "OTHER",
          accountStatus: acc.accountStatus || acc.status || "UNKNOWN",
          bureau: acc.bureau as "TRANSUNION" | "EXPERIAN" | "EQUIFAX",
          balance: acc.balance,
          creditLimit: acc.creditLimit,
          highBalance: acc.highBalance,
          pastDue: acc.pastDue,
          monthlyPayment: acc.monthlyPayment,
          dateOpened: acc.dateOpened,
          dateReported: acc.dateReported,
          lastActivityDate: acc.lastActivityDate,
          paymentStatus: acc.paymentStatus,
          paymentHistory,
          responsibility: acc.responsibility,
          extractionConfidence: acc.extractionConfidence || 0.7,
        };
      });
      parseConfidence = parseResult.metadata.confidence;
      parseErrors = parseResult.metadata.errors;
    }

    if (accountsToSave.length === 0) {
      await prisma.creditReport.update({
        where: { id: report.id },
        data: {
          parseStatus: "FAILED",
          parseError: "No accounts found in the content",
        },
      });

      return NextResponse.json(
        { error: "No accounts found in the credit report content" },
        { status: 422 }
      );
    }

    // Save parsed accounts
    let accountsParsed = 0;
    for (const account of accountsToSave) {
      try {
        // Generate fingerprint
        const fingerprint = `${account.creditorName}:${account.accountNumber}:${account.bureau}`;

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
              accountStatus: account.accountStatus || "UNKNOWN",
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
              isAuthorizedUser: false,
              hasBeenPreviouslyDisputed: false,
              sequenceIndex: accountsParsed,
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
        extractionMethod: useDirectHTMLParsing ? "HTML" : "TEXT",
        extractionConfidence: parseConfidence,
        // Store source type if detected
        sourceType: htmlParseResult?.source || "PASTED",
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
        confidence: parseConfidence,
        source: htmlParseResult?.source || "AI",
        scoresFound: htmlParseResult?.scores.length || 0,
      },
      "Pasted content parsed successfully"
    );

    return NextResponse.json(
      {
        id: report.id,
        status: "COMPLETED",
        message: `Content parsed successfully. ${accountsParsed} accounts found.`,
        accountsParsed,
        source: htmlParseResult?.source || "AI_PARSED",
        scoresFound: htmlParseResult?.scores.length || 0,
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
