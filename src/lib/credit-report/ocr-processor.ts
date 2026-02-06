/**
 * OCR Processor for Credit Reports
 *
 * Handles text extraction from image-based PDFs and screenshots using Tesseract.js.
 * Includes image preprocessing for better OCR accuracy.
 */

import Tesseract, { createWorker, type Worker } from "tesseract.js";
import sharp from "sharp";
import { createLogger } from "../logger";
const log = createLogger("ocr-processor");

// OCR Result structure
export interface OCRResult {
  text: string;
  confidence: number; // 0-100 scale from Tesseract
  pages: number;
  processingTimeMs: number;
  warnings?: string[];
}

// OCR Page result
interface OCRPageResult {
  pageNum: number;
  text: string;
  confidence: number;
}

// Worker pool for parallel processing
let workerPool: Worker[] = [];
const MAX_WORKERS = 2;
let workerInitPromise: Promise<void> | null = null;

/**
 * Initialize the Tesseract worker pool.
 * Workers are reused across OCR requests for better performance.
 */
async function initializeWorkers(): Promise<void> {
  if (workerInitPromise) return workerInitPromise;

  workerInitPromise = (async () => {
    log.info("Initializing Tesseract worker pool");

    for (let i = 0; i < MAX_WORKERS; i++) {
      const worker = await createWorker("eng", 1, {
        // Use CDN for worker files
        workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js",
        corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js",
      });

      workerPool.push(worker);
    }

    log.info({ workerCount: workerPool.length }, "Tesseract worker pool initialized");
  })();

  return workerInitPromise;
}

/**
 * Get an available worker from the pool.
 */
async function getWorker(): Promise<Worker> {
  await initializeWorkers();
  // Simple round-robin - in production you'd want a proper queue
  return workerPool[Math.floor(Math.random() * workerPool.length)];
}

/**
 * Preprocess an image for better OCR accuracy.
 * - Convert to grayscale
 * - Increase contrast
 * - Apply sharpening
 * - Remove noise
 */
export async function preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
  try {
    const processed = await sharp(imageBuffer)
      // Convert to grayscale
      .grayscale()
      // Normalize for better contrast
      .normalize()
      // Sharpen slightly
      .sharpen({ sigma: 1 })
      // Threshold to make text more distinct (optional - can help with faded documents)
      // .threshold(128)
      // Output as PNG for lossless quality
      .png()
      .toBuffer();

    log.info({ originalSize: imageBuffer.length, processedSize: processed.length }, "Image preprocessed");

    return processed;
  } catch (error) {
    log.warn({ err: error }, "Image preprocessing failed, using original");
    return imageBuffer;
  }
}

/**
 * Perform OCR on a single image buffer.
 */
export async function processImage(imageBuffer: Buffer): Promise<OCRResult> {
  const startTime = Date.now();
  const warnings: string[] = [];

  try {
    // Preprocess the image
    const preprocessedImage = await preprocessImage(imageBuffer);

    // Get a worker
    const worker = await getWorker();

    // Perform OCR
    const result = await worker.recognize(preprocessedImage);

    const processingTimeMs = Date.now() - startTime;
    const confidence = result.data.confidence;

    if (confidence < 50) {
      warnings.push(`Low OCR confidence: ${confidence.toFixed(1)}%`);
    }

    log.info({
      confidence,
      textLength: result.data.text.length,
      processingTimeMs,
    }, "OCR complete");

    return {
      text: result.data.text,
      confidence,
      pages: 1,
      processingTimeMs,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    log.error({ err: error }, "OCR processing failed");
    throw new Error(`OCR processing failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Convert PDF pages to images and perform OCR on each.
 * Uses pdf-to-img for PDF to image conversion.
 */
export async function processImagePDF(pdfBuffer: Buffer): Promise<OCRResult> {
  const startTime = Date.now();
  const warnings: string[] = [];

  try {
    // Dynamic import for pdf-to-img (ESM module)
    const { pdf } = await import("pdf-to-img");

    log.info({ bufferSize: pdfBuffer.length }, "Starting PDF to image conversion");

    // Convert PDF pages to images
    const pages: OCRPageResult[] = [];
    let pageNum = 0;

    // pdf-to-img returns an async iterator
    for await (const image of await pdf(pdfBuffer, { scale: 2.0 })) {
      pageNum++;
      log.info({ pageNum }, "Processing page");

      // Convert to buffer - pdf-to-img returns Uint8Array
      const imageBuffer = Buffer.from(image);

      // Preprocess and OCR this page
      const preprocessedImage = await preprocessImage(imageBuffer);
      const worker = await getWorker();
      const result = await worker.recognize(preprocessedImage);

      pages.push({
        pageNum,
        text: result.data.text,
        confidence: result.data.confidence,
      });

      log.info({
        pageNum,
        confidence: result.data.confidence,
        textLength: result.data.text.length,
      }, "Page OCR complete");
    }

    if (pages.length === 0) {
      throw new Error("No pages extracted from PDF");
    }

    // Combine all pages
    const combinedText = pages
      .map((p) => `--- Page ${p.pageNum} ---\n${p.text}`)
      .join("\n\n");

    // Calculate average confidence
    const avgConfidence = pages.reduce((sum, p) => sum + p.confidence, 0) / pages.length;

    if (avgConfidence < 50) {
      warnings.push(`Low average OCR confidence: ${avgConfidence.toFixed(1)}%`);
    }

    // Check for very short text (might indicate OCR failure)
    if (combinedText.length < 100 * pages.length) {
      warnings.push("Extracted text is shorter than expected - OCR quality may be low");
    }

    const processingTimeMs = Date.now() - startTime;

    log.info({
      pageCount: pages.length,
      avgConfidence,
      totalTextLength: combinedText.length,
      processingTimeMs,
    }, "PDF OCR complete");

    return {
      text: combinedText,
      confidence: avgConfidence,
      pages: pages.length,
      processingTimeMs,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    log.error({ err: error }, "PDF OCR processing failed");
    throw new Error(`PDF OCR processing failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Detect if a PDF is image-based (scanned) by checking for selectable text.
 * This is a heuristic - returns true if the PDF has very little text.
 */
export function isLikelyImagePDF(textContent: string, pageCount: number): boolean {
  // If there's less than 50 characters per page on average, it's likely image-based
  const charsPerPage = textContent.length / Math.max(pageCount, 1);
  return charsPerPage < 50;
}

/**
 * Cleanup workers on shutdown.
 */
export async function terminateWorkers(): Promise<void> {
  for (const worker of workerPool) {
    await worker.terminate();
  }
  workerPool = [];
  workerInitPromise = null;
  log.info("Tesseract workers terminated");
}

// Graceful shutdown
if (typeof process !== "undefined") {
  process.on("beforeExit", async () => {
    await terminateWorkers();
  });
}
