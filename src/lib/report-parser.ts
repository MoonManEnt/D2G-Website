/**
 * Unified Report Parsing Utility
 *
 * This module provides a single, consistent interface for parsing credit reports.
 * Both auto-parse (on upload) and manual parse routes should use this utility
 * to ensure consistent data is saved regardless of when parsing occurs.
 */

import prisma from "@/lib/prisma";
import { extractTextFromPDF, extractTextFromBuffer } from "@/lib/pdf-extract";
import { parseIdentityIQReport, analyzeAccountsForIssues, getIssuesSummary, ParsedAccountWithIssues } from "@/lib/parser";
import { computeConfidenceLevel } from "@/types";

export interface ParseReportOptions {
  reportId: string;
  organizationId: string;
  clientId: string;
  actorId: string;
  actorEmail: string;
  /** If provided, parse from buffer (in-memory). Otherwise, read from disk. */
  pdfBuffer?: Buffer;
  /** If provided, read PDF from this path. Ignored if pdfBuffer is provided. */
  storagePath?: string;
}

export interface ParseReportResult {
  success: boolean;
  accountsParsed: number;
  pageCount: number;
  error?: string;
  warnings?: string[];
  issuesSummary?: {
    disputableAccounts: number;
    highSeverityIssues: number;
    mediumSeverityIssues: number;
    lowSeverityIssues: number;
  };
}

/**
 * Parse a credit report and save analyzed accounts to the database.
 *
 * This is the SINGLE source of truth for parsing logic. It:
 * 1. Extracts text from PDF (from buffer or disk)
 * 2. Parses the extracted text using IdentityIQ parser
 * 3. Analyzes accounts for FCRA violations and issues
 * 4. Saves all accounts with full analysis data
 * 5. Updates report status and logs events
 *
 * Both /api/reports (auto-parse) and /api/reports/[id]/parse (manual) use this.
 */
export async function parseAndAnalyzeReport(options: ParseReportOptions): Promise<ParseReportResult> {
  const { reportId, organizationId, clientId, actorId, actorEmail, pdfBuffer, storagePath } = options;

  // Update status to processing
  await prisma.creditReport.update({
    where: { id: reportId },
    data: { parseStatus: "PROCESSING" },
  });

  try {
    // Step 1: Extract text from PDF
    let extractionResult;

    if (pdfBuffer) {
      // Parse from in-memory buffer (faster, used for auto-parse on upload)
      extractionResult = await extractTextFromBuffer(pdfBuffer);
    } else if (storagePath) {
      // Parse from disk (used for manual re-parse)
      extractionResult = await extractTextFromPDF(storagePath);
    } else {
      throw new Error("Either pdfBuffer or storagePath must be provided");
    }

    if (!extractionResult.success) {
      const errorMessage = extractionResult.error || "Failed to extract text from PDF";

      await prisma.creditReport.update({
        where: { id: reportId },
        data: {
          parseStatus: "FAILED",
          parseError: errorMessage,
        },
      });

      return {
        success: false,
        accountsParsed: 0,
        pageCount: 0,
        error: errorMessage,
      };
    }

    // Step 2: Parse the extracted text
    const parseResult = await parseIdentityIQReport(extractionResult.text);

    if (!parseResult.success) {
      const errorMessage = parseResult.errors[0]?.message || "Failed to parse report";

      await prisma.creditReport.update({
        where: { id: reportId },
        data: {
          parseStatus: "FAILED",
          parseError: errorMessage,
        },
      });

      return {
        success: false,
        accountsParsed: 0,
        pageCount: extractionResult.pageCount,
        error: errorMessage,
      };
    }

    // Step 3: Analyze accounts for FCRA violations and issues
    // This is CRITICAL - both auto-parse and manual parse must do this
    const analyzedAccounts = analyzeAccountsForIssues(parseResult.accounts);
    const issuesSummary = getIssuesSummary(analyzedAccounts);

    console.log(`[PARSER] Analysis complete: ${issuesSummary.disputableAccounts} disputable accounts, ${issuesSummary.highSeverityIssues} high severity issues`);

    // Step 4: Save all accounts with full analysis data
    let accountsParsed = 0;

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
          // CRITICAL: Always include analysis fields
          suggestedFlow: account.suggestedFlow,
          isDisputable: account.isDisputable,
          issueCount: account.issues.length,
          detectedIssues: account.issues.length > 0 ? JSON.stringify(account.issues) : null,
          rawExtractedData: account.rawExtractedData ? JSON.stringify(account.rawExtractedData) : null,
          reportId: reportId,
          organizationId,
          clientId,
        },
      });

      accountsParsed++;
    }

    // Step 5: Update report status to completed
    await prisma.creditReport.update({
      where: { id: reportId },
      data: {
        parseStatus: "COMPLETED",
        pageCount: extractionResult.pageCount,
        parseError: null,
      },
    });

    // Step 6: Log the parsing event
    await prisma.eventLog.create({
      data: {
        eventType: "REPORT_PARSED",
        actorId,
        actorEmail,
        targetType: "CreditReport",
        targetId: reportId,
        eventData: JSON.stringify({
          accountsParsed,
          pageCount: extractionResult.pageCount,
          warnings: parseResult.warnings.length,
          disputableAccounts: issuesSummary.disputableAccounts,
          highSeverityIssues: issuesSummary.highSeverityIssues,
        }),
        organizationId,
      },
    });

    return {
      success: true,
      accountsParsed,
      pageCount: extractionResult.pageCount,
      warnings: parseResult.warnings.map(w => w.message),
      issuesSummary: {
        disputableAccounts: issuesSummary.disputableAccounts,
        highSeverityIssues: issuesSummary.highSeverityIssues,
        mediumSeverityIssues: issuesSummary.mediumSeverityIssues,
        lowSeverityIssues: issuesSummary.lowSeverityIssues,
      },
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown parsing error";

    // Update status to failed
    await prisma.creditReport.update({
      where: { id: reportId },
      data: {
        parseStatus: "FAILED",
        parseError: errorMessage,
      },
    });

    // Log the failure
    await prisma.eventLog.create({
      data: {
        eventType: "REPORT_PARSE_FAILED",
        actorId,
        actorEmail,
        targetType: "CreditReport",
        targetId: reportId,
        eventData: JSON.stringify({ error: errorMessage }),
        organizationId,
      },
    });

    return {
      success: false,
      accountsParsed: 0,
      pageCount: 0,
      error: errorMessage,
    };
  }
}
