/**
 * PDF Text Extraction Service
 *
 * Uses unpdf (serverless-friendly wrapper for PDF.js) for robust text extraction.
 */

import { readFile } from "fs/promises";
import { extractText } from "unpdf";

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
  console.log("Starting PDF extraction with unpdf, buffer size:", buffer.length);

  try {
    // Convert to Uint8Array for unpdf
    const dataArray = new Uint8Array(buffer);
    const { text, totalPages } = await extractText(dataArray);

    // Handle array of strings (pages) or single string
    const fullText = Array.isArray(text) ? text.join("\n\n") : text;
    const pageCount = totalPages || 0;

    // Validations
    if (!fullText || fullText.trim().length === 0) {
      return {
        success: false,
        text: "",
        pageCount: pageCount,
        error: "PDF appears to be empty or image-based (no selectable text found).",
      };
    }

    console.log(`PDF Extraction complete. Pages: ${pageCount}, Length: ${fullText.length}`);

    if (fullText.length < 100) {
      console.warn("Extracted text is suspiciously short.");
      return {
        success: false,
        text: fullText,
        pageCount: pageCount,
        error: "Extracted text is too short. The PDF might be an image scan.",
      };
    }

    return {
      success: true,
      text: fullText,
      pageCount: pageCount,
    };

  } catch (error) {
    console.error("unpdf error:", error);
    return {
      success: false,
      text: "",
      pageCount: 0,
      error: error instanceof Error ? error.message : "Failed to parse PDF",
    };
  }
}
