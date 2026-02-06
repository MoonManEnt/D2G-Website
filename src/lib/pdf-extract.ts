/**
 * PDF Text Extraction Service
 *
 * Uses unpdf (serverless-friendly wrapper for PDF.js) for robust text extraction.
 * For image-based PDFs, use the OCR module in @/lib/credit-report/ocr-processor
 */

import { readFile } from "fs/promises";
import { extractText } from "unpdf";
import { createLogger } from "./logger";
const log = createLogger("pdf-extract");

export interface PDFExtractionResult {
  success: boolean;
  text: string;
  pageCount: number;
  error?: string;
  /** Array of text content per page (0-indexed). Useful for tracking which page content appears on. */
  pages?: string[];
  /** Indicates if the PDF might be image-based and need OCR */
  mayNeedOCR?: boolean;
}

/**
 * Extract text content from a PDF file
 */
export async function extractTextFromPDF(filePath: string): Promise<PDFExtractionResult> {
  try {
    const dataBuffer = await readFile(filePath);
    return extractTextFromBuffer(dataBuffer);
  } catch (error) {
    log.error({ err: error }, "PDF extraction error");
    return {
      success: false,
      text: "",
      pageCount: 0,
      error: error instanceof Error ? error.message : "Failed to extract text from PDF",
    };
  }
}

/**
 * Extract text from a PDF buffer
 */
export async function extractTextFromBuffer(buffer: Buffer): Promise<PDFExtractionResult> {
  log.info({ data: buffer.length }, "Starting PDF extraction with unpdf, buffer size");

  try {
    // Convert to Uint8Array for unpdf
    const dataArray = new Uint8Array(buffer);
    const { text, totalPages } = await extractText(dataArray);

    // Handle array of strings (pages) or single string
    const pages = Array.isArray(text) ? text : [text];
    const fullText = pages.join("\n\n");
    const pageCount = totalPages || pages.length;

    // Validations
    if (!fullText || fullText.trim().length === 0) {
      log.info({ pageCount }, "PDF has no selectable text - may need OCR");
      return {
        success: false,
        text: "",
        pageCount: pageCount,
        pages: [],
        error: "PDF appears to be empty or image-based (no selectable text found).",
        mayNeedOCR: true,
      };
    }

    log.info({ pageCount, length: fullText.length }, "PDF Extraction complete. Pages, Length");

    if (fullText.length < 100) {
      log.warn("Extracted text is suspiciously short - may need OCR");
      return {
        success: false,
        text: fullText,
        pageCount: pageCount,
        pages,
        error: "Extracted text is too short. The PDF might be an image scan.",
        mayNeedOCR: true,
      };
    }

    return {
      success: true,
      text: fullText,
      pageCount: pageCount,
      pages,
    };

  } catch (error) {
    log.error({ err: error }, "unpdf error");
    return {
      success: false,
      text: "",
      pageCount: 0,
      error: error instanceof Error ? error.message : "Failed to parse PDF",
    };
  }
}
