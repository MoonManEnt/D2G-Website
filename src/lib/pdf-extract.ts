/**
 * PDF Text Extraction Service
 *
 * Uses pdf2json for serverless-compatible PDF text extraction.
 * Pure Node.js implementation - no workers needed.
 */

import { readFile } from "fs/promises";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFParser = require("pdf2json");

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
  return new Promise((resolve) => {
    try {
      const pdfParser = new PDFParser();

      pdfParser.on("pdfParser_dataError", (errData: { parserError: Error }) => {
        console.error("PDF parsing error:", errData.parserError);
        resolve({
          success: false,
          text: "",
          pageCount: 0,
          error: errData.parserError?.message || "Failed to parse PDF",
        });
      });

      pdfParser.on("pdfParser_dataReady", (pdfData: { Pages: Array<{ Texts: Array<{ R: Array<{ T: string }> }> }> }) => {
        try {
          const numPages = pdfData.Pages?.length || 0;

          // Extract text from all pages
          let fullText = "";
          for (const page of pdfData.Pages || []) {
            const pageText = page.Texts?.map((textItem) => {
              return textItem.R?.map((r) => decodeURIComponent(r.T || "")).join("") || "";
            }).join(" ") || "";
            fullText += pageText + "\n\n";
          }

          if (!fullText || fullText.trim().length < 100) {
            resolve({
              success: false,
              text: "",
              pageCount: numPages,
              error: "PDF appears to be image-based or contains no extractable text. Please upload a native IdentityIQ export.",
            });
            return;
          }

          resolve({
            success: true,
            text: fullText,
            pageCount: numPages,
          });
        } catch (error) {
          console.error("PDF text extraction error:", error);
          resolve({
            success: false,
            text: "",
            pageCount: 0,
            error: error instanceof Error ? error.message : "Failed to extract text",
          });
        }
      });

      // Parse the buffer
      pdfParser.parseBuffer(buffer);

    } catch (error) {
      console.error("PDF extraction error:", error);
      resolve({
        success: false,
        text: "",
        pageCount: 0,
        error: error instanceof Error ? error.message : "Failed to extract text from PDF",
      });
    }
  });
}
