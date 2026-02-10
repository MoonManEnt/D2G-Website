/**
 * Unified Credit Report Parser
 *
 * Single entry point for parsing credit reports from any source.
 * Handles PDF text extraction, OCR for image-based documents,
 * AI-powered field extraction, and issue detection.
 */

import { extractTextFromBuffer, type PDFExtractionResult } from "../pdf-extract";
import { processImagePDF, processImage, isLikelyImagePDF, type OCRResult } from "./ocr-processor";
import { parseWithAI, parseWithAIChunked } from "./ai-parser";
import { detectReportFormat, type ReportFormat } from "./format-detector";
import { analyzeForIssues, getIssueSummary, type DetectedIssue } from "./issue-analyzer";
import { validateParsedReport, calculateConfidence, type ValidationResult } from "./validation";
import type { ParsedCreditReport, CreditAccount, CreditInquiry, Bureau, AccountType, AccountStatus } from "./extraction-schema";
import {
  parseWithPositions,
  isIdentityIQFormat,
  type PositionParsedAccount,
  type PositionParseResult,
  type BureauValue,
  type ParsedInquiry,
} from "./position-parser";
import { createLogger } from "../logger";
const log = createLogger("unified-parser");

// Parse options
export interface ParseOptions {
  /** Enable OCR for image-based PDFs (default: true) */
  enableOCR?: boolean;
  /** Use AI for parsing (default: true, falls back to regex if false) */
  preferAI?: boolean;
  /** Organization ID for LLM cost tracking */
  organizationId?: string;
  /** Detect and analyze issues (default: true) */
  detectIssues?: boolean;
  /** File type hint for non-PDF inputs */
  fileType?: "PDF" | "PNG" | "JPG" | "JPEG" | "WEBP";
}

// Complete parse result
export interface ParseResult {
  success: boolean;
  report: ParsedCreditReport | null;
  issues: DetectedIssue[];
  validation: ValidationResult | null;
  metadata: {
    extractionMethod: "TEXT" | "OCR";
    parsingMethod: "AI" | "REGEX" | "NONE";
    confidence: number;
    processingTimeMs: number;
    format: ReportFormat;
    pageCount: number;
    warnings: string[];
    errors: string[];
  };
}

// Supported image types
const IMAGE_TYPES = ["PNG", "JPG", "JPEG", "WEBP", "TIFF"] as const;

/**
 * Detect if the input is an image based on file type or magic bytes.
 */
function isImageFile(buffer: Buffer, fileType?: string): boolean {
  // Check explicit file type
  if (fileType && IMAGE_TYPES.includes(fileType.toUpperCase() as typeof IMAGE_TYPES[number])) {
    return true;
  }

  // Check magic bytes for common image formats
  if (buffer.length < 4) return false;

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return true;
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true;
  }

  // WEBP: RIFF + WEBP
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return true;
  }

  return false;
}

/**
 * Detect if the input is a PDF.
 */
function isPDFFile(buffer: Buffer): boolean {
  // PDF magic bytes: %PDF
  return buffer.length >= 4 && buffer.toString("ascii", 0, 4) === "%PDF";
}

/**
 * Parse a credit report from buffer or string.
 *
 * This is the main entry point for the credit report parsing engine.
 * It automatically handles:
 * - PDF text extraction
 * - OCR for image-based PDFs
 * - Direct image OCR
 * - AI-powered field extraction
 * - Issue detection
 * - Validation
 */
export async function parseCreditReport(
  input: Buffer | string,
  options: ParseOptions = {}
): Promise<ParseResult> {
  const startTime = Date.now();
  const warnings: string[] = [];
  const errors: string[] = [];

  // Default options
  const {
    enableOCR = true,
    preferAI = true,
    organizationId = "system",
    detectIssues = true,
    fileType,
  } = options;

  log.info({
    inputType: typeof input === "string" ? "string" : "buffer",
    inputLength: typeof input === "string" ? input.length : input.length,
    options: { enableOCR, preferAI, detectIssues },
  }, "Starting credit report parsing");

  let extractedText = "";
  let extractionMethod: "TEXT" | "OCR" = "TEXT";
  let ocrConfidence: number | undefined;
  let pageCount = 0;

  try {
    // Handle string input (already extracted text)
    if (typeof input === "string") {
      extractedText = input;
      pageCount = 1;
      log.info("Processing pre-extracted text");
    }
    // Handle buffer input
    else {
      const buffer = input;

      // Detect input type
      const isImage = isImageFile(buffer, fileType);
      const isPDF = isPDFFile(buffer);

      if (isImage) {
        // Direct image OCR
        if (!enableOCR) {
          return createFailedResult(
            "IMAGE_NO_OCR",
            "Image file provided but OCR is disabled",
            startTime
          );
        }

        log.info("Processing image file with OCR");
        const ocrResult = await processImage(buffer);
        extractedText = ocrResult.text;
        extractionMethod = "OCR";
        ocrConfidence = ocrResult.confidence;
        pageCount = 1;

        if (ocrResult.warnings) {
          warnings.push(...ocrResult.warnings);
        }
      } else if (isPDF) {
        // PDF processing
        log.info("Processing PDF file");

        // First try text extraction
        const textResult = await extractTextFromBuffer(buffer);

        if (textResult.success && textResult.text.length > 100) {
          // Successful text extraction
          extractedText = textResult.text;
          pageCount = textResult.pageCount;
          log.info({
            pageCount,
            textLength: extractedText.length,
          }, "PDF text extraction successful");
        } else if (enableOCR) {
          // Text extraction failed or insufficient - try OCR
          log.info({
            textExtractSuccess: textResult.success,
            textLength: textResult.text?.length || 0,
          }, "Text extraction insufficient, falling back to OCR");

          warnings.push("PDF text extraction failed or insufficient, using OCR");

          const ocrResult = await processImagePDF(buffer);
          extractedText = ocrResult.text;
          extractionMethod = "OCR";
          ocrConfidence = ocrResult.confidence;
          pageCount = ocrResult.pages;

          if (ocrResult.warnings) {
            warnings.push(...ocrResult.warnings);
          }
        } else {
          // No OCR and text extraction failed
          return createFailedResult(
            "PDF_NO_TEXT",
            textResult.error || "PDF appears to be image-based and OCR is disabled",
            startTime
          );
        }
      } else {
        // Unknown file type - try as text
        try {
          extractedText = buffer.toString("utf-8");
          pageCount = 1;
          log.info("Treating input as raw text");
        } catch {
          return createFailedResult("UNKNOWN_FORMAT", "Unable to process input as text", startTime);
        }
      }
    }

    // Validate we have text to parse
    if (!extractedText || extractedText.trim().length < 50) {
      return createFailedResult("INSUFFICIENT_TEXT", "Extracted text is too short to parse", startTime);
    }

    // Detect report format
    const formatDetection = detectReportFormat(extractedText);
    const isIdentityIQ = formatDetection.format === "IDENTITY_IQ" || isIdentityIQFormat(extractedText);

    log.info({
      format: formatDetection.format,
      confidence: formatDetection.confidence,
      isIdentityIQ,
    }, "Report format detected");

    // For IdentityIQ reports, use position-based parsing for accurate per-bureau data
    let positionParseResult: PositionParseResult | null = null;
    let positionAccounts: CreditAccount[] = [];
    let positionInquiries: CreditInquiry[] = [];

    if (isIdentityIQ) {
      log.info("Using position-based parsing for IdentityIQ format");
      try {
        positionParseResult = await parseWithPositions(extractedText);
        if (positionParseResult.success) {
          if (positionParseResult.accounts.length > 0) {
            positionAccounts = convertPositionAccountsToCreditAccounts(positionParseResult.accounts);
          }
          if (positionParseResult.inquiries.length > 0) {
            positionInquiries = convertPositionInquiriesToCreditInquiries(positionParseResult.inquiries);
          }
          log.info({
            positionAccountBlocks: positionParseResult.accounts.length,
            creditAccounts: positionAccounts.length,
            positionInquiries: positionInquiries.length,
            validationValid: positionParseResult.validationResult.isValid,
          }, "Position parsing complete");
        }
      } catch (posError) {
        log.warn({ err: posError }, "Position parsing failed, falling back to AI only");
      }
    }

    // Also run AI parsing (provides consumer info, inquiries, and fills gaps)
    if (!preferAI && positionAccounts.length === 0) {
      return createFailedResult("AI_REQUIRED", "Non-AI parsing not yet implemented", startTime);
    }

    const aiParseResult = await parseWithAIChunked({
      rawText: extractedText,
      reportFormat: formatDetection.format,
      organizationId,
      pageCount,
      extractionMethod,
      ocrConfidence,
    });

    log.info({
      aiAccountCount: aiParseResult.accounts.length,
      inquiryCount: aiParseResult.inquiries.length,
    }, "AI parsing complete");

    // Merge results: position-parsed data takes priority for IdentityIQ
    let finalAccounts: CreditAccount[];
    let finalInquiries: CreditInquiry[];

    if (positionAccounts.length > 0) {
      finalAccounts = mergeAccountSources(positionAccounts, aiParseResult.accounts);
      warnings.push(`Used position-based parsing for ${positionAccounts.length} account entries across bureaus`);
    } else {
      finalAccounts = aiParseResult.accounts;
    }

    if (positionInquiries.length > 0) {
      finalInquiries = mergeInquirySources(positionInquiries, aiParseResult.inquiries);
      warnings.push(`Used position-based parsing for ${positionInquiries.length} inquiries`);
    } else {
      finalInquiries = aiParseResult.inquiries;
    }

    // Build final parse result
    const parseResult: ParsedCreditReport = {
      consumer: aiParseResult.consumer,
      bureaus: aiParseResult.bureaus,
      accounts: finalAccounts,
      inquiries: finalInquiries,
      publicRecords: aiParseResult.publicRecords,
      metadata: {
        ...aiParseResult.metadata,
        parseConfidence: positionAccounts.length > 0
          ? Math.max(aiParseResult.metadata.parseConfidence, 0.85)
          : aiParseResult.metadata.parseConfidence,
      },
    };

    log.info({
      accountCount: parseResult.accounts.length,
      inquiryCount: parseResult.inquiries.length,
      usedPositionParsing: positionAccounts.length > 0,
    }, "Parsing complete");

    // Validate the parsed report
    const validation = validateParsedReport(parseResult);
    if (validation.warnings.length > 0) {
      warnings.push(...validation.warnings.map((w) => w.message));
    }
    if (validation.errors.length > 0) {
      errors.push(...validation.errors.map((e) => e.message));
    }

    // Detect issues
    let issues: DetectedIssue[] = [];
    if (detectIssues) {
      issues = analyzeForIssues(parseResult);
      const summary = getIssueSummary(issues);
      log.info({
        totalIssues: summary.total,
        highPriority: summary.highPriority,
        disputableAccounts: summary.disputableAccounts,
      }, "Issue analysis complete");
    }

    // Calculate final confidence
    const confidence = calculateConfidence(parseResult, extractionMethod, ocrConfidence);

    const processingTimeMs = Date.now() - startTime;

    log.info({
      success: true,
      confidence,
      processingTimeMs,
      accountCount: parseResult.accounts.length,
      issueCount: issues.length,
    }, "Credit report parsing complete");

    return {
      success: true,
      report: parseResult,
      issues,
      validation,
      metadata: {
        extractionMethod,
        parsingMethod: "AI",
        confidence,
        processingTimeMs,
        format: formatDetection.format,
        pageCount,
        warnings,
        errors,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    log.error({ err: error }, "Credit report parsing failed");

    return createFailedResult("PARSE_ERROR", errorMessage, startTime, warnings);
  }
}

/**
 * Convert PositionParsedAccount (with per-bureau BureauValue fields) to CreditAccount[] array.
 * Creates one CreditAccount per bureau that has data.
 */
function convertPositionAccountsToCreditAccounts(
  positionAccounts: PositionParsedAccount[]
): CreditAccount[] {
  const accounts: CreditAccount[] = [];
  const bureaus: Bureau[] = ["TRANSUNION", "EXPERIAN", "EQUIFAX"];

  for (const posAccount of positionAccounts) {
    for (const bureau of bureaus) {
      // Check if this bureau has meaningful data (at least account number or balance)
      const hasData =
        posAccount.accountNumber[bureau] ||
        posAccount.balance[bureau] !== null ||
        posAccount.accountStatus[bureau] ||
        posAccount.paymentStatus[bureau] ||
        posAccount.highBalance[bureau] !== null;

      if (!hasData) continue;

      // Map account type
      const rawType = posAccount.accountType[bureau] || "";
      let accountType: AccountType = "OTHER";
      if (/credit\s*card|revolving|visa|mastercard|amex/i.test(rawType)) {
        accountType = "CREDIT_CARD";
      } else if (/install/i.test(rawType)) {
        accountType = "INSTALLMENT";
      } else if (/mortgage|home\s*loan/i.test(rawType)) {
        accountType = "MORTGAGE";
      } else if (/auto|car|vehicle/i.test(rawType)) {
        accountType = "AUTO_LOAN";
      } else if (/student/i.test(rawType)) {
        accountType = "STUDENT_LOAN";
      } else if (/collect/i.test(rawType)) {
        accountType = "COLLECTION";
      } else if (/medical/i.test(rawType)) {
        accountType = "MEDICAL";
      }

      // Map account status
      const rawStatus = posAccount.accountStatus[bureau] || posAccount.paymentStatus[bureau] || "";
      let accountStatus: AccountStatus = "UNKNOWN";
      if (/charge[\s-]*off/i.test(rawStatus)) {
        accountStatus = "CHARGE_OFF";
      } else if (/collect/i.test(rawStatus)) {
        accountStatus = "COLLECTION";
      } else if (/foreclos/i.test(rawStatus)) {
        accountStatus = "FORECLOSURE";
      } else if (/repos/i.test(rawStatus)) {
        accountStatus = "REPOSSESSION";
      } else if (/transfer/i.test(rawStatus)) {
        accountStatus = "TRANSFERRED";
      } else if (/defer/i.test(rawStatus)) {
        accountStatus = "DEFERRED";
      } else if (/closed/i.test(rawStatus)) {
        accountStatus = "CLOSED";
      } else if (/paid/i.test(rawStatus)) {
        accountStatus = "PAID";
      } else if (/open|current|as\s*agreed/i.test(rawStatus)) {
        accountStatus = "OPEN";
      } else if (/delinq|late|past\s*due/i.test(rawStatus)) {
        // Delinquent accounts are still open but with issues
        accountStatus = "OPEN";
      }

      // Build payment history array
      const paymentHistory = posAccount.paymentHistory[bureau] || [];

      // Detect issues from payment status
      const paymentStatusRaw = posAccount.paymentStatus[bureau] || "";
      const hasLatePayments = /late|30|60|90|120|150|180/i.test(paymentStatusRaw);

      // Create the CreditAccount entry
      const creditAccount: CreditAccount = {
        id: `pos-${posAccount.creditorName.replace(/\s+/g, "-")}-${bureau}-${posAccount.sequenceIndex}`,
        creditorName: posAccount.creditorName,
        accountNumber: posAccount.accountNumber[bureau] || "****",
        accountType,
        accountStatus,
        bureau,
        balance: posAccount.balance[bureau] ?? undefined,
        creditLimit: posAccount.creditLimit[bureau] ?? undefined,
        highBalance: posAccount.highBalance[bureau] ?? undefined,
        pastDue: posAccount.pastDue[bureau] ?? undefined,
        monthlyPayment: posAccount.monthlyPayment[bureau] ?? undefined,
        dateOpened: posAccount.dateOpened[bureau] ?? undefined,
        dateReported: posAccount.dateReported[bureau] ?? undefined,
        lastActivityDate: posAccount.lastActivityDate[bureau] ?? undefined,
        paymentStatus: posAccount.paymentStatus[bureau] ?? undefined,
        paymentHistory: paymentHistory.length > 0 ? paymentHistory : undefined,
        responsibility: posAccount.responsibility[bureau] ?? undefined,
        comments: posAccount.comments[bureau] ?? undefined,
        // Enhanced fields
        dateOfFirstDelinquency: posAccount.dateOfFirstDelinquency[bureau] ?? undefined,
        bureauCode: posAccount.bureauCode[bureau] ?? undefined,
        sequenceIndex: posAccount.sequenceIndex,
        extractionConfidence: 0.9, // Position parsing is high confidence
        fingerprint: `${posAccount.creditorName}:${posAccount.accountNumber[bureau] || ""}:${bureau}:${posAccount.sequenceIndex}`,
      };

      accounts.push(creditAccount);
    }
  }

  log.info({ positionAccounts: positionAccounts.length, creditAccounts: accounts.length }, "Converted position accounts");
  return accounts;
}

/**
 * Merge position-parsed accounts with AI-parsed accounts.
 * Position parser provides accurate per-bureau data, AI parser fills gaps.
 */
function mergeAccountSources(
  positionAccounts: CreditAccount[],
  aiAccounts: CreditAccount[]
): CreditAccount[] {
  // Start with position-parsed accounts (more accurate for IdentityIQ)
  const merged = [...positionAccounts];
  const positionKeys = new Set(
    positionAccounts.map((a) => `${a.creditorName.toUpperCase()}:${a.bureau}`)
  );

  // Add AI accounts that aren't already covered by position parsing
  for (const aiAccount of aiAccounts) {
    const key = `${aiAccount.creditorName.toUpperCase()}:${aiAccount.bureau}`;
    if (!positionKeys.has(key)) {
      merged.push(aiAccount);
    }
  }

  log.info(
    { position: positionAccounts.length, ai: aiAccounts.length, merged: merged.length },
    "Merged account sources"
  );
  return merged;
}

/**
 * Convert position-parsed inquiries to CreditInquiry format.
 */
function convertPositionInquiriesToCreditInquiries(
  positionInquiries: ParsedInquiry[]
): CreditInquiry[] {
  return positionInquiries.map((inquiry) => ({
    inquirerName: inquiry.inquirerName,
    inquiryDate: inquiry.inquiryDate,
    inquiryType: inquiry.inquiryType,
    bureau: inquiry.bureau,
  }));
}

/**
 * Merge position-parsed inquiries with AI-parsed inquiries.
 * Position parser provides accurate per-bureau inquiry data.
 */
function mergeInquirySources(
  positionInquiries: CreditInquiry[],
  aiInquiries: CreditInquiry[]
): CreditInquiry[] {
  // Start with position-parsed inquiries (more accurate for 3-column format)
  const merged = [...positionInquiries];
  const positionKeys = new Set(
    positionInquiries.map((i) => `${i.inquirerName.toUpperCase()}:${i.inquiryDate}:${i.bureau}`)
  );

  // Add AI inquiries that aren't already covered
  for (const aiInquiry of aiInquiries) {
    const key = `${aiInquiry.inquirerName.toUpperCase()}:${aiInquiry.inquiryDate}:${aiInquiry.bureau}`;
    if (!positionKeys.has(key)) {
      merged.push(aiInquiry);
    }
  }

  log.info(
    { position: positionInquiries.length, ai: aiInquiries.length, merged: merged.length },
    "Merged inquiry sources"
  );
  return merged;
}

/**
 * Create a failed parse result.
 */
function createFailedResult(
  code: string,
  message: string,
  startTime: number,
  warnings: string[] = []
): ParseResult {
  return {
    success: false,
    report: null,
    issues: [],
    validation: null,
    metadata: {
      extractionMethod: "TEXT",
      parsingMethod: "NONE",
      confidence: 0,
      processingTimeMs: Date.now() - startTime,
      format: "UNKNOWN",
      pageCount: 0,
      warnings,
      errors: [`${code}: ${message}`],
    },
  };
}

// Re-export types for convenience
export type {
  ParsedCreditReport,
  CreditAccount,
  ConsumerInfo,
  CreditInquiry,
  PublicRecord,
  Bureau,
} from "./extraction-schema";
export type { DetectedIssue, IssueSeverity, IssueCategory } from "./issue-analyzer";
export type { ValidationResult, ValidationWarning, ValidationError } from "./validation";
export type { ReportFormat } from "./format-detector";
