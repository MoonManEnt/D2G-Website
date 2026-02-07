/**
 * Unified Report Parsing Utility
 *
 * This module provides a single, consistent interface for parsing credit reports.
 * Both auto-parse (on upload) and manual parse routes should use this utility
 * to ensure consistent data is saved regardless of when parsing occurs.
 *
 * Supports two parsing modes:
 * 1. Legacy regex-based parsing (IdentityIQ only)
 * 2. AI-powered parsing (any format, with OCR support)
 */

import prisma from "@/lib/prisma";
import { extractTextFromPDF, extractTextFromBuffer } from "@/lib/pdf-extract";
import { parseIdentityIQReport, analyzeAccountsForIssues, getIssuesSummary, ParsedAccountWithIssues, extractCreditScores, ExtractedCreditScores, extractHardInquiries } from "@/lib/parser";
import { parseCreditReport, type ParseResult as AIParseResult } from "@/lib/credit-report";
import { computeConfidenceLevel } from "@/types";
import { cacheDelPrefix } from "@/lib/redis";
import { createLogger } from "./logger";
const log = createLogger("report-parser");

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
 * Save extracted credit scores to the database
 */
async function saveCreditScores({
  clientId,
  reportId,
  scores,
  reportDate,
}: {
  clientId: string;
  reportId: string;
  scores: ExtractedCreditScores;
  reportDate: Date;
}): Promise<number> {
  let saved = 0;

  const bureaus = [
    { key: "transunion" as const, cra: "TRANSUNION" },
    { key: "equifax" as const, cra: "EQUIFAX" },
    { key: "experian" as const, cra: "EXPERIAN" },
  ];

  for (const { key, cra } of bureaus) {
    const score = scores[key];
    if (score !== null) {
      // Check if a score already exists for this report
      const existing = await prisma.creditScore.findFirst({
        where: {
          clientId,
          reportId,
          cra,
        },
      });

      if (!existing) {
        await prisma.creditScore.create({
          data: {
            clientId,
            reportId,
            cra,
            score,
            scoreType: "VANTAGE3", // IdentityIQ typically uses VantageScore 3.0
            scoreDate: reportDate,
            source: "REPORT_PARSE",
          },
        });
        saved++;
      }
    }
  }

  return saved;
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

    // Step 2: Parse the extracted text (passing pages for page tracking)
    const parseResult = await parseIdentityIQReport(extractionResult.text, extractionResult.pages);

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

    log.info({ disputableAccounts: issuesSummary.disputableAccounts, highSeverityIssues: issuesSummary.highSeverityIssues }, "[PARSER] Analysis complete: disputable accounts, high severity issues");

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
          // Page tracking for evidence capture
          sourcePageNum: account.sourcePageNum || null,
          sourcePageEnd: account.sourcePageEnd || null,
          reportId: reportId,
          organizationId,
          clientId,
        },
      });

      accountsParsed++;
    }

    // Step 5: Extract and save credit scores
    const extractedScores = extractCreditScores(extractionResult.text);
    const scoresExtracted = await saveCreditScores({
      clientId,
      reportId,
      scores: extractedScores,
      reportDate: new Date(), // Will be updated with actual report date if available
    });

    log.info({ transunion: extractedScores.transunion, equifax: extractedScores.equifax, experian: extractedScores.experian }, "[PARSER] Credit scores extracted: TU=, EQ=, EX=");

    // Step 5c: Extract and save hard inquiries
    const hardInquiries = extractHardInquiries(extractionResult.text);
    if (hardInquiries.length > 0) {
      await prisma.creditReport.update({
        where: { id: reportId },
        data: {
          hardInquiries: JSON.stringify(hardInquiries),
        },
      });
      log.info({ length: hardInquiries.length }, "[PARSER] Hard inquiries extracted");
    }

    // Step 5b: Create pending evidence suggestions for accounts with issues
    const accountsWithIssues = await prisma.accountItem.findMany({
      where: {
        reportId,
        issueCount: { gt: 0 },
      },
      select: { id: true },
    });

    if (accountsWithIssues.length > 0) {
      await prisma.pendingEvidence.createMany({
        data: accountsWithIssues.map(acc => ({
          accountItemId: acc.id,
          reportId,
          organizationId,
          status: "PENDING",
        })),
        skipDuplicates: true,
      });
      log.info({ length: accountsWithIssues.length }, "[PARSER] Created pending evidence suggestions");
    }

    // Step 6: Update report status to completed
    await prisma.creditReport.update({
      where: { id: reportId },
      data: {
        parseStatus: "COMPLETED",
        pageCount: extractionResult.pageCount,
        parseError: null,
      },
    });

    // Step 6b: Invalidate caches so client pages show fresh data
    await cacheDelPrefix(`clients:detail:${organizationId}:${clientId}`);
    await cacheDelPrefix(`clients:list:${organizationId}`);
    await cacheDelPrefix(`clients:stats:${organizationId}`);

    // Step 7: Log the parsing event
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

// Options for AI-powered parsing
export interface ParseReportAIOptions {
  reportId: string;
  organizationId: string;
  clientId: string;
  actorId: string;
  actorEmail: string;
  /** File buffer (PDF or image) */
  fileBuffer: Buffer;
  /** File type hint */
  fileType?: "PDF" | "PNG" | "JPG" | "JPEG" | "WEBP";
}

/**
 * Parse a credit report using the AI-powered parsing engine.
 *
 * This function:
 * 1. Uses OCR for image-based files
 * 2. Detects the report format automatically
 * 3. Extracts data using Claude/OpenAI
 * 4. Analyzes accounts for FCRA issues
 * 5. Saves all data to the database
 *
 * Supports any credit report format, not just IdentityIQ.
 */
export async function parseAndAnalyzeReportAI(options: ParseReportAIOptions): Promise<ParseReportResult> {
  const { reportId, organizationId, clientId, actorId, actorEmail, fileBuffer, fileType } = options;

  // Update status to processing
  await prisma.creditReport.update({
    where: { id: reportId },
    data: { parseStatus: "PROCESSING" },
  });

  try {
    log.info({ reportId, fileType, bufferSize: fileBuffer.length }, "[AI-PARSER] Starting AI-powered parsing");

    // Use the unified parser
    const result = await parseCreditReport(fileBuffer, {
      enableOCR: true,
      preferAI: true,
      organizationId,
      detectIssues: true,
      fileType,
    });

    if (!result.success || !result.report) {
      const errorMessage = result.metadata.errors[0] || "AI parsing failed";
      log.error({ errors: result.metadata.errors }, "[AI-PARSER] Parsing failed");

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
        pageCount: result.metadata.pageCount,
        error: errorMessage,
      };
    }

    const report = result.report;
    log.info({
      accountCount: report.accounts.length,
      format: result.metadata.format,
      extractionMethod: result.metadata.extractionMethod,
      confidence: result.metadata.confidence,
    }, "[AI-PARSER] AI parsing successful");

    // Save accounts to database
    let accountsParsed = 0;

    for (const account of report.accounts) {
      // Map AI-parsed account to database format
      const confidenceScore = Math.round((account.extractionConfidence || result.metadata.confidence) * 100);
      const confidenceLevel = computeConfidenceLevel(confidenceScore);

      // Find matching issues for this account
      const accountIssues = result.issues.filter((issue) => issue.accountId === account.id);
      const suggestedFlow = accountIssues.length > 0 ? accountIssues[0].recommendedFlow : null;

      await prisma.accountItem.create({
        data: {
          creditorName: account.creditorName,
          maskedAccountId: account.accountNumber,
          fingerprint: `${account.creditorName}:${account.accountNumber}:${account.bureau}`,
          cra: account.bureau,
          accountType: mapAccountType(account.accountType),
          accountStatus: mapAccountStatus(account.accountStatus || account.status || "UNKNOWN"),
          balance: account.balance,
          pastDue: account.pastDue,
          creditLimit: account.creditLimit,
          highBalance: account.highBalance,
          monthlyPayment: account.monthlyPayment,
          dateOpened: account.dateOpened ? new Date(account.dateOpened) : null,
          dateReported: account.dateReported ? new Date(account.dateReported) : null,
          lastActivityDate: account.dateLastActive ? new Date(account.dateLastActive) : null,
          paymentStatus: account.paymentStatus,
          disputeComment: account.disputeComment,
          confidenceScore,
          confidenceLevel,
          suggestedFlow,
          isDisputable: accountIssues.length > 0,
          issueCount: accountIssues.length,
          detectedIssues: accountIssues.length > 0 ? JSON.stringify(accountIssues) : null,
          rawExtractedData: account.rawExtractedText ? JSON.stringify({ text: account.rawExtractedText }) : null,
          sourcePageNum: account.sourcePageNum || null,
          reportId,
          organizationId,
          clientId,
        },
      });

      accountsParsed++;
    }

    // Save credit scores if available
    for (const bureau of report.bureaus) {
      if (bureau.creditScore) {
        const bureauName = bureau.name || bureau.bureau || "UNKNOWN";
        const existing = await prisma.creditScore.findFirst({
          where: {
            clientId,
            reportId,
            cra: bureauName,
          },
        });

        if (!existing) {
          await prisma.creditScore.create({
            data: {
              clientId,
              reportId,
              cra: bureauName,
              score: bureau.creditScore,
              scoreType: bureau.scoreType || bureau.scoreModel || "VANTAGE3",
              scoreDate: bureau.reportDate ? new Date(bureau.reportDate) : new Date(),
              source: "REPORT_PARSE",
            },
          });
        }
      }
    }

    // Save inquiries as hard inquiries JSON
    if (report.inquiries.length > 0) {
      await prisma.creditReport.update({
        where: { id: reportId },
        data: {
          hardInquiries: JSON.stringify(report.inquiries),
        },
      });
    }

    // Create pending evidence suggestions for accounts with issues
    const accountsWithIssues = await prisma.accountItem.findMany({
      where: {
        reportId,
        issueCount: { gt: 0 },
      },
      select: { id: true },
    });

    if (accountsWithIssues.length > 0) {
      await prisma.pendingEvidence.createMany({
        data: accountsWithIssues.map((acc) => ({
          accountItemId: acc.id,
          reportId,
          organizationId,
          status: "PENDING",
        })),
        skipDuplicates: true,
      });
      log.info({ count: accountsWithIssues.length }, "[AI-PARSER] Created pending evidence suggestions");
    }

    // Update report with parsing results
    await prisma.creditReport.update({
      where: { id: reportId },
      data: {
        parseStatus: "COMPLETED",
        pageCount: result.metadata.pageCount,
        parseError: null,
        // Update source type based on detected format
        sourceType: mapFormatToSourceType(result.metadata.format),
      },
    });

    // Invalidate caches
    await cacheDelPrefix(`clients:detail:${organizationId}:${clientId}`);
    await cacheDelPrefix(`clients:list:${organizationId}`);
    await cacheDelPrefix(`clients:stats:${organizationId}`);

    // Log the parsing event
    await prisma.eventLog.create({
      data: {
        eventType: "REPORT_PARSED",
        actorId,
        actorEmail,
        targetType: "CreditReport",
        targetId: reportId,
        eventData: JSON.stringify({
          accountsParsed,
          pageCount: result.metadata.pageCount,
          format: result.metadata.format,
          extractionMethod: result.metadata.extractionMethod,
          confidence: result.metadata.confidence,
          issueCount: result.issues.length,
          parsingMethod: "AI",
        }),
        organizationId,
      },
    });

    // Calculate issue summary
    const highSeverity = result.issues.filter((i) => i.severity === "HIGH").length;
    const mediumSeverity = result.issues.filter((i) => i.severity === "MEDIUM").length;
    const lowSeverity = result.issues.filter((i) => i.severity === "LOW").length;
    const disputableAccounts = new Set(result.issues.map((i) => i.accountId).filter(Boolean)).size;

    return {
      success: true,
      accountsParsed,
      pageCount: result.metadata.pageCount,
      warnings: result.metadata.warnings,
      issuesSummary: {
        disputableAccounts,
        highSeverityIssues: highSeverity,
        mediumSeverityIssues: mediumSeverity,
        lowSeverityIssues: lowSeverity,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown AI parsing error";
    log.error({ err: error }, "[AI-PARSER] Parsing error");

    await prisma.creditReport.update({
      where: { id: reportId },
      data: {
        parseStatus: "FAILED",
        parseError: errorMessage,
      },
    });

    await prisma.eventLog.create({
      data: {
        eventType: "REPORT_PARSE_FAILED",
        actorId,
        actorEmail,
        targetType: "CreditReport",
        targetId: reportId,
        eventData: JSON.stringify({ error: errorMessage, parsingMethod: "AI" }),
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

// Helper function to map AI account types to database enum
function mapAccountType(aiType: string): string {
  const mapping: Record<string, string> = {
    CREDIT_CARD: "Credit Card",
    MORTGAGE: "Mortgage",
    AUTO_LOAN: "Auto",
    STUDENT_LOAN: "Student Loan",
    PERSONAL_LOAN: "Personal Loan",
    HELOC: "HELOC",
    INSTALLMENT: "Installment",
    COLLECTION: "Collection",
    CHARGE_CARD: "Charge Card",
    RETAIL_CARD: "Retail Card",
    MEDICAL: "Medical",
    UTILITY: "Utility",
    OTHER: "Other",
  };
  return mapping[aiType] || aiType || "Other";
}

// Helper function to map AI account status to database enum
function mapAccountStatus(aiStatus: string): string {
  const mapping: Record<string, string> = {
    OPEN: "Open",
    CLOSED: "Closed",
    PAID: "Paid",
    COLLECTION: "Collection",
    CHARGE_OFF: "ChargeOff",
    FORECLOSURE: "Foreclosure",
    REPOSSESSION: "Repossession",
    TRANSFERRED: "Transferred",
    DEFERRED: "Deferred",
    UNKNOWN: "Unknown",
  };
  return mapping[aiStatus] || aiStatus || "Unknown";
}

// Helper function to map format to source type
function mapFormatToSourceType(format: string): string {
  const mapping: Record<string, string> = {
    IDENTITY_IQ: "IDENTITYIQ",
    ANNUAL_CREDIT_REPORT: "ANNUALCREDITREPORT",
    CREDIT_KARMA: "CREDITKARMA",
    MYFICO: "MYFICO",
    EXPERIAN_DIRECT: "EXPERIAN",
    EQUIFAX_DIRECT: "EQUIFAX",
    TRANSUNION_DIRECT: "TRANSUNION",
    SMART_CREDIT: "SMARTCREDIT",
    PRIVACY_GUARD: "PRIVACYGUARD",
    CREDIT_SESAME: "CREDITSESAME",
    NAV: "NAV",
    BANK_PROVIDED: "BANKPROVIDED",
    UNKNOWN: "OTHER",
  };
  return mapping[format] || "OTHER";
}
