/**
 * Credit Report Parsing Module
 *
 * AI-powered, format-agnostic credit report parsing with OCR support.
 *
 * Usage:
 * ```typescript
 * import { parseCreditReport } from '@/lib/credit-report';
 *
 * const result = await parseCreditReport(pdfBuffer, {
 *   enableOCR: true,
 *   detectIssues: true,
 *   organizationId: 'org_123',
 * });
 *
 * if (result.success) {
 *   console.log(result.report.accounts);
 *   console.log(result.issues);
 * }
 * ```
 */

// Main entry point
export { parseCreditReport, type ParseOptions, type ParseResult } from "./unified-parser";

// Re-export all types for external use
export type {
  ParsedCreditReport,
  CreditAccount,
  ConsumerInfo,
  CreditInquiry,
  PublicRecord,
  BureauSummary,
  Bureau,
  AccountType,
  AccountStatus,
  PaymentStatusCode,
  Address,
  PaymentHistoryEntry,
} from "./extraction-schema";

// Issue detection
export {
  analyzeForIssues,
  getIssueSummary,
  type DetectedIssue,
  type IssueSeverity,
  type IssueCategory,
} from "./issue-analyzer";

// Validation
export {
  validateParsedReport,
  calculateConfidence,
  type ValidationResult,
  type ValidationWarning,
  type ValidationError,
  type ValidationStats,
} from "./validation";

// Format detection
export {
  detectReportFormat,
  getFormatHints,
  type ReportFormat,
  type FormatHints,
} from "./format-detector";

// OCR
export {
  processImage,
  processImagePDF,
  preprocessImage,
  isLikelyImagePDF,
  type OCRResult,
} from "./ocr-processor";

// AI Parser (for advanced use cases)
export { parseWithAI, parseWithAIChunked } from "./ai-parser";
