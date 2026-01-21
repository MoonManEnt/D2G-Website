/**
 * PDF Text Extraction Service
 *
 * Uses pdfjs-dist to extract text from PDF files.
 * For IdentityIQ reports which have embedded text layers.
 */

import { readFile } from "fs/promises";
// Use legacy build for serverless compatibility (no worker required)
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

// Explicitly disable worker for serverless
pdfjsLib.GlobalWorkerOptions.workerSrc = "";

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
    // Read the PDF file
    const dataBuffer = await readFile(filePath);
    const uint8Array = new Uint8Array(dataBuffer);

    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      useSystemFonts: true,
      isEvalSupported: false,
      useWorkerFetch: false,
      disableFontFace: true,
      // @ts-expect-error - disableWorker exists but types are outdated
      disableWorker: true,
    });

    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    // Extract text from all pages
    let fullText = "";

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Concatenate text items
      const pageText = textContent.items
        .map((item) => {
          if ("str" in item) {
            return item.str;
          }
          return "";
        })
        .join(" ");

      fullText += pageText + "\n\n";
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

/**
 * Extract text from a PDF buffer
 */
export async function extractTextFromBuffer(buffer: Buffer): Promise<PDFExtractionResult> {
  try {
    const uint8Array = new Uint8Array(buffer);

    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      useSystemFonts: true,
      isEvalSupported: false,
      useWorkerFetch: false,
      disableFontFace: true,
      // @ts-expect-error - disableWorker exists but types are outdated
      disableWorker: true,
    });

    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    let fullText = "";

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map((item) => {
          if ("str" in item) {
            return item.str;
          }
          return "";
        })
        .join(" ");

      fullText += pageText + "\n\n";
    }

    if (!fullText || fullText.trim().length < 100) {
      return {
        success: false,
        text: "",
        pageCount: numPages,
        error: "PDF appears to be image-based or contains no extractable text.",
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
