/**
 * PDF Text Extraction Service
 *
 * Uses unpdf for serverless-compatible PDF text extraction.
 * For IdentityIQ reports which have embedded text layers.
 */

import { readFile } from "fs/promises";
import { extractText, getDocumentProxy } from "unpdf";

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
    // Get document proxy first to access page count
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const numPages = pdf.numPages;

    // Extract text using unpdf
    const result = await extractText(buffer, { mergePages: true });

    // Handle text result - coerce to string
    let fullText: string;
    if (typeof result.text === 'string') {
      fullText = result.text;
    } else if (Array.isArray(result.text)) {
      fullText = (result.text as string[]).join("\n\n");
    } else {
      fullText = String(result.text);
    }

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
