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
import type { ParsedCreditReport } from "./extraction-schema";
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
    log.info({
      format: formatDetection.format,
      confidence: formatDetection.confidence,
    }, "Report format detected");

    // Parse with AI
    if (!preferAI) {
      // Future: Could add regex fallback here
      return createFailedResult("AI_REQUIRED", "Non-AI parsing not yet implemented", startTime);
    }

    const parseResult = await parseWithAIChunked({
      rawText: extractedText,
      reportFormat: formatDetection.format,
      organizationId,
      pageCount,
      extractionMethod,
      ocrConfidence,
    });

    log.info({
      accountCount: parseResult.accounts.length,
      inquiryCount: parseResult.inquiries.length,
    }, "AI parsing complete");

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
