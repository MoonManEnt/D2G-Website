/**
 * PDF Text Extraction Service
 *
 * Uses pdf-parse for serverless-compatible PDF text extraction.
 * For IdentityIQ reports which have embedded text layers.
 */

import { readFile } from "fs/promises";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require("pdf-parse");

export interface PDFExtractionResult {
  success: boolean;
  text: string;
  pageCount: number;
  error?: string;
}

/**
 * Extract text content from a PDF file
 */
export async function extractTextFromPDF(filePath: string): Promise<PDFExtractionResult> {
  try {
    const dataBuffer = await readFile(filePath);
    return extractTextFromBuffer(dataBuffer);
  } catch (error) {
    console.error("PDF extraction error:", error);
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
  try {
    const data = await pdf(buffer);

    const fullText = data.text;
    const numPages = data.numpages;

    if (!fullText || fullText.trim().length < 100) {
      return {
        success: false,
        text: "",
        pageCount: numPages,
        error: "PDF appears to be image-based or contains no extractable text. Please upload a native IdentityIQ export.",
      };
    }

    return {
      success: true,
      text: fullText,
      pageCount: numPages,
    };

  } catch (error) {
    console.error("PDF extraction error:", error);
    return {
      success: false,
      text: "",
      pageCount: 0,
      error: error instanceof Error ? error.message : "Failed to extract text from PDF",
    };
  }
}
