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
  console.log("Starting PDF extraction, buffer size:", buffer.length);

  return new Promise((resolve) => {
    try {
      const pdfParser = new PDFParser(null, true); // null = no password, true = raw text

      // Set a timeout to prevent hanging (45s to allow graceful shutdown before Vercel 60s limit)
      const timeout = setTimeout(() => {
        console.error("PDF parsing timeout after 45 seconds");
        resolve({
          success: false,
          text: "",
          pageCount: 0,
          error: "PDF parsing timed out. The file is too complex or large for the server to process synchronously.",
        });
      }, 45000);

      pdfParser.on("pdfParser_dataError", (errData: { parserError: Error }) => {
        clearTimeout(timeout);
        console.error("PDF parsing error:", errData.parserError);
        resolve({
          success: false,
          text: "",
          pageCount: 0,
          error: errData.parserError?.message || "Failed to parse PDF structure",
        });
      });

      pdfParser.on("pdfParser_dataReady", (pdfData: { Pages: Array<{ Texts: Array<{ R: Array<{ T: string }> }> }> }) => {
        clearTimeout(timeout);
        console.log("PDF parsing data ready. Pages found:", pdfData?.Pages?.length);

        try {
          const numPages = pdfData.Pages?.length || 0;

          if (numPages === 0) {
            console.warn("PDF parsed but no pages found.");
            resolve({
              success: false,
              text: "",
              pageCount: 0,
              error: "PDF appears empty or corrupted.",
            });
            return;
          }

          // Extract text from all pages
          let fullText = "";
          let totalTextLength = 0;

          for (let i = 0; i < (pdfData.Pages || []).length; i++) {
            const page = pdfData.Pages[i];
            const pageText = page.Texts?.map((textItem) => {
              return textItem.R?.map((r) => decodeURIComponent(r.T || "")).join("") || "";
            }).join(" ") || "";

            // Log first few chars of each page for debug
            console.log(`Page ${i + 1} text length: ${pageText.length}. Sample: ${pageText.substring(0, 50)}...`);

            fullText += pageText + "\n\n";
            totalTextLength += pageText.length;
          }

          console.log("Total extracted text length:", totalTextLength);

          if (!fullText || fullText.trim().length < 100) {
            console.warn("Extracted text is too short. Potential image-only PDF.");
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
          console.error("PDF text extraction processing error:", error);
          resolve({
            success: false,
            text: "",
            pageCount: 0,
            error: error instanceof Error ? error.message : "Failed to process extracted text",
          });
        }
      });

      // Parse the buffer
      pdfParser.parseBuffer(buffer);

    } catch (error) {
      console.error("PDF extraction setup error:", error);
      resolve({
        success: false,
        text: "",
        pageCount: 0,
        error: error instanceof Error ? error.message : "Failed to initialize PDF parser",
      });
    }
  });
}
