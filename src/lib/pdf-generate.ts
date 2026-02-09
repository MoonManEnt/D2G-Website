/**
 * PDF Generation Service
 *
 * Creates professional PDF dispute letters from AI-generated drafts.
 * Uses pdf-lib for pure JavaScript PDF generation.
 */

import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage, degrees } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { format } from "date-fns";
import { createLogger } from "./logger";
const log = createLogger("pdf-generate");

// Page configuration
const PAGE_WIDTH = 612; // 8.5 inches in points
const PAGE_HEIGHT = 792; // 11 inches in points
const MARGIN_TOP = 72; // 1 inch
const MARGIN_BOTTOM = 72;
const MARGIN_LEFT = 72;
const MARGIN_RIGHT = 72;
const LINE_HEIGHT = 14;
const PARAGRAPH_SPACING = 20;

// Colors
const BLACK = rgb(0, 0, 0);
const DARK_GRAY = rgb(0.25, 0.25, 0.25);
const GRAY = rgb(0.5, 0.5, 0.5);

// Letter branding configuration
export interface LetterBranding {
  companyName?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoBase64?: string;
}

// Dispute letter data
export interface DisputeLetterData {
  // Sender (client) information
  clientName: string;
  clientAddress: string;
  clientCity: string;
  clientState: string;
  clientZip: string;
  clientSSNLast4?: string;
  clientDOB?: string;

  // Recipient (CRA) information
  craName: string;
  craAddress: string;
  craCity: string;
  craState: string;
  craZip: string;

  // Letter content
  letterDate: Date;
  subject: string;
  letterBody: string;
  accountsDisputed: Array<{
    creditorName: string;
    accountNumber: string;
    reason: string;
  }>;

  // Reference info
  disputeId: string;
  referenceNumber?: string;

  // Organization branding (optional)
  branding?: LetterBranding;
}

// Generation options
export interface PDFGenerationOptions {
  includeAccountTable?: boolean;
  includeSignatureLine?: boolean;
  includeFooter?: boolean;
  watermark?: string;
  useScriptSignature?: boolean;
}

// Script signature font URL (Google Fonts - Dancing Script)
const SCRIPT_FONT_URL = "https://fonts.gstatic.com/s/dancingscript/v25/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7BMSo3Sup6hNX6plRP.woff";

// Cache for script font bytes
let scriptFontCache: ArrayBuffer | null = null;

/**
 * Load script font for signatures
 */
async function loadScriptFont(): Promise<ArrayBuffer> {
  if (scriptFontCache) {
    return scriptFontCache;
  }

  try {
    const response = await fetch(SCRIPT_FONT_URL);
    if (!response.ok) {
      throw new Error("Failed to fetch script font");
    }
    scriptFontCache = await response.arrayBuffer();
    return scriptFontCache;
  } catch (error) {
    log.error({ err: error }, "Failed to load script font, using fallback");
    throw error;
  }
}

/**
 * Generate a professional dispute letter PDF
 */
export async function generateDisputeLetterPDF(
  data: DisputeLetterData,
  options: PDFGenerationOptions = {}
): Promise<Uint8Array> {
  const {
    includeAccountTable = true,
    includeSignatureLine = true,
    includeFooter = true,
    watermark,
    useScriptSignature = false,
  } = options;

  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Embed standard fonts
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Load script font for signature if requested
  let scriptFont: PDFFont | null = null;
  if (useScriptSignature) {
    try {
      const scriptFontBytes = await loadScriptFont();
      scriptFont = await pdfDoc.embedFont(scriptFontBytes);
    } catch {
      // Fall back to italic if script font fails to load
      scriptFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
    }
  }

  // Add the first page
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let currentY = PAGE_HEIGHT - MARGIN_TOP;

  // Helper function to add new page if needed
  const checkAndAddPage = (requiredSpace: number): PDFPage => {
    if (currentY - requiredSpace < MARGIN_BOTTOM) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      currentY = PAGE_HEIGHT - MARGIN_TOP;
    }
    return page;
  };

  // Helper function to draw text with word wrap
  const drawText = (
    text: string,
    font: PDFFont,
    fontSize: number,
    color = BLACK,
    maxWidth = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT
  ): void => {
    const words = text.split(" ");
    let line = "";
    const lines: string[] = [];

    for (const word of words) {
      const testLine = line + (line ? " " : "") + word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);

      if (testWidth > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      lines.push(line);
    }

    for (const l of lines) {
      checkAndAddPage(LINE_HEIGHT);
      page.drawText(l, {
        x: MARGIN_LEFT,
        y: currentY,
        size: fontSize,
        font,
        color,
      });
      currentY -= LINE_HEIGHT;
    }
  };

  // Add watermark if specified
  if (watermark) {
    const watermarkFont = helvetica;
    const watermarkSize = 60;
    const watermarkText = watermark.toUpperCase();
    const watermarkWidth = watermarkFont.widthOfTextAtSize(watermarkText, watermarkSize);

    page.drawText(watermarkText, {
      x: (PAGE_WIDTH - watermarkWidth) / 2,
      y: PAGE_HEIGHT / 2,
      size: watermarkSize,
      font: watermarkFont,
      color: rgb(0.9, 0.9, 0.9),
      rotate: degrees(45),
    });
  }

  // ===== SENDER ADDRESS (Top Left) =====
  currentY = PAGE_HEIGHT - MARGIN_TOP;

  page.drawText(data.clientName, {
    x: MARGIN_LEFT,
    y: currentY,
    size: 11,
    font: timesRomanBold,
    color: BLACK,
  });
  currentY -= LINE_HEIGHT;

  page.drawText(data.clientAddress, {
    x: MARGIN_LEFT,
    y: currentY,
    size: 11,
    font: timesRoman,
    color: BLACK,
  });
  currentY -= LINE_HEIGHT;

  page.drawText(`${data.clientCity}, ${data.clientState} ${data.clientZip}`, {
    x: MARGIN_LEFT,
    y: currentY,
    size: 11,
    font: timesRoman,
    color: BLACK,
  });
  currentY -= LINE_HEIGHT * 2;

  // ===== DATE =====
  const formattedDate = format(data.letterDate, "MMMM d, yyyy");
  page.drawText(formattedDate, {
    x: MARGIN_LEFT,
    y: currentY,
    size: 11,
    font: timesRoman,
    color: BLACK,
  });
  currentY -= LINE_HEIGHT * 2;

  // ===== RECIPIENT ADDRESS =====
  page.drawText(data.craName, {
    x: MARGIN_LEFT,
    y: currentY,
    size: 11,
    font: timesRomanBold,
    color: BLACK,
  });
  currentY -= LINE_HEIGHT;

  page.drawText(data.craAddress, {
    x: MARGIN_LEFT,
    y: currentY,
    size: 11,
    font: timesRoman,
    color: BLACK,
  });
  currentY -= LINE_HEIGHT;

  page.drawText(`${data.craCity}, ${data.craState} ${data.craZip}`, {
    x: MARGIN_LEFT,
    y: currentY,
    size: 11,
    font: timesRoman,
    color: BLACK,
  });
  currentY -= LINE_HEIGHT * 2;

  // ===== SUBJECT LINE =====
  page.drawText("Re: " + data.subject, {
    x: MARGIN_LEFT,
    y: currentY,
    size: 11,
    font: timesRomanBold,
    color: BLACK,
  });
  currentY -= LINE_HEIGHT;

  // Add reference number if present
  if (data.referenceNumber) {
    page.drawText(`Reference #: ${data.referenceNumber}`, {
      x: MARGIN_LEFT,
      y: currentY,
      size: 10,
      font: timesRoman,
      color: GRAY,
    });
    currentY -= LINE_HEIGHT;
  }

  currentY -= LINE_HEIGHT;

  // ===== SALUTATION =====
  page.drawText("To Whom It May Concern:", {
    x: MARGIN_LEFT,
    y: currentY,
    size: 11,
    font: timesRoman,
    color: BLACK,
  });
  currentY -= PARAGRAPH_SPACING;

  // ===== LETTER BODY =====
  const paragraphs = data.letterBody.split("\n\n");
  for (const paragraph of paragraphs) {
    if (paragraph.trim()) {
      drawText(paragraph.trim(), timesRoman, 11);
      currentY -= PARAGRAPH_SPACING - LINE_HEIGHT;
    }
  }

  // ===== ACCOUNT TABLE =====
  if (includeAccountTable && data.accountsDisputed.length > 0) {
    currentY -= LINE_HEIGHT;
    checkAndAddPage(100);

    page.drawText("Disputed Accounts:", {
      x: MARGIN_LEFT,
      y: currentY,
      size: 11,
      font: timesRomanBold,
      color: BLACK,
    });
    currentY -= LINE_HEIGHT * 1.5;

    // Draw table header
    const colWidths = [180, 120, 168];
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);

    // Header background
    page.drawRectangle({
      x: MARGIN_LEFT,
      y: currentY - 4,
      width: tableWidth,
      height: LINE_HEIGHT + 4,
      color: rgb(0.95, 0.95, 0.95),
    });

    // Header text
    page.drawText("Creditor Name", {
      x: MARGIN_LEFT + 4,
      y: currentY,
      size: 10,
      font: timesRomanBold,
      color: BLACK,
    });
    page.drawText("Account #", {
      x: MARGIN_LEFT + colWidths[0] + 4,
      y: currentY,
      size: 10,
      font: timesRomanBold,
      color: BLACK,
    });
    page.drawText("Reason for Dispute", {
      x: MARGIN_LEFT + colWidths[0] + colWidths[1] + 4,
      y: currentY,
      size: 10,
      font: timesRomanBold,
      color: BLACK,
    });
    currentY -= LINE_HEIGHT + 4;

    // Table rows
    for (const account of data.accountsDisputed) {
      checkAndAddPage(LINE_HEIGHT + 4);

      // Draw border line
      page.drawLine({
        start: { x: MARGIN_LEFT, y: currentY + LINE_HEIGHT - 2 },
        end: { x: MARGIN_LEFT + tableWidth, y: currentY + LINE_HEIGHT - 2 },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      });

      // Truncate text if too long
      const truncate = (text: string, maxWidth: number, font: PDFFont, size: number) => {
        if (font.widthOfTextAtSize(text, size) <= maxWidth - 8) return text;
        let truncated = text;
        while (font.widthOfTextAtSize(truncated + "...", size) > maxWidth - 8 && truncated.length > 0) {
          truncated = truncated.slice(0, -1);
        }
        return truncated + "...";
      };

      page.drawText(truncate(account.creditorName, colWidths[0], timesRoman, 10), {
        x: MARGIN_LEFT + 4,
        y: currentY,
        size: 10,
        font: timesRoman,
        color: BLACK,
      });
      page.drawText(truncate(account.accountNumber, colWidths[1], timesRoman, 10), {
        x: MARGIN_LEFT + colWidths[0] + 4,
        y: currentY,
        size: 10,
        font: timesRoman,
        color: BLACK,
      });
      page.drawText(truncate(account.reason, colWidths[2], timesRoman, 10), {
        x: MARGIN_LEFT + colWidths[0] + colWidths[1] + 4,
        y: currentY,
        size: 10,
        font: timesRoman,
        color: BLACK,
      });
      currentY -= LINE_HEIGHT + 4;
    }

    // Bottom border
    page.drawLine({
      start: { x: MARGIN_LEFT, y: currentY + LINE_HEIGHT + 2 },
      end: { x: MARGIN_LEFT + tableWidth, y: currentY + LINE_HEIGHT + 2 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });

    currentY -= LINE_HEIGHT;
  }

  // ===== CLOSING =====
  currentY -= PARAGRAPH_SPACING;
  checkAndAddPage(100);

  // FCRA Notice
  const fcraNotice =
    "Pursuant to the Fair Credit Reporting Act, 15 U.S.C. § 1681i, you are required to investigate these disputes within 30 days and provide me with written notification of the results.";
  drawText(fcraNotice, timesRoman, 10, DARK_GRAY);

  currentY -= PARAGRAPH_SPACING;

  page.drawText("Thank you for your prompt attention to this matter.", {
    x: MARGIN_LEFT,
    y: currentY,
    size: 11,
    font: timesRoman,
    color: BLACK,
  });
  currentY -= PARAGRAPH_SPACING;

  page.drawText("Sincerely,", {
    x: MARGIN_LEFT,
    y: currentY,
    size: 11,
    font: timesRoman,
    color: BLACK,
  });
  currentY -= LINE_HEIGHT * 3;

  // ===== SIGNATURE LINE =====
  if (includeSignatureLine) {
    // Draw script signature if script font is available
    if (scriptFont) {
      // Draw the signature in script font (above the line)
      page.drawText(data.clientName, {
        x: MARGIN_LEFT,
        y: currentY + LINE_HEIGHT + 5,
        size: 24,
        font: scriptFont,
        color: rgb(0.1, 0.1, 0.3), // Dark blue-ish for signature
      });
      currentY -= 5;
    }

    // Signature line
    page.drawLine({
      start: { x: MARGIN_LEFT, y: currentY + LINE_HEIGHT },
      end: { x: MARGIN_LEFT + 200, y: currentY + LINE_HEIGHT },
      thickness: 0.5,
      color: BLACK,
    });

    // Print name below line
    page.drawText(data.clientName, {
      x: MARGIN_LEFT,
      y: currentY,
      size: 11,
      font: timesRomanBold,
      color: BLACK,
    });
    currentY -= LINE_HEIGHT * 2;

    // Include identifiers
    if (data.clientSSNLast4) {
      page.drawText(`SSN (last 4 digits): XXX-XX-${data.clientSSNLast4}`, {
        x: MARGIN_LEFT,
        y: currentY,
        size: 10,
        font: timesRoman,
        color: BLACK,
      });
      currentY -= LINE_HEIGHT;
    }

    if (data.clientDOB) {
      page.drawText(`Date of Birth: ${data.clientDOB}`, {
        x: MARGIN_LEFT,
        y: currentY,
        size: 10,
        font: timesRoman,
        color: BLACK,
      });
      currentY -= LINE_HEIGHT;
    }
  }

  // ===== FOOTER =====
  if (includeFooter) {
    const footerY = MARGIN_BOTTOM - 20;
    const footerText = `Dispute ID: ${data.disputeId.slice(0, 8).toUpperCase()} | Generated: ${format(new Date(), "MM/dd/yyyy")}`;

    // Draw on all pages
    const pages = pdfDoc.getPages();
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];

      // Footer line
      p.drawLine({
        start: { x: MARGIN_LEFT, y: footerY + 10 },
        end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: footerY + 10 },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      });

      p.drawText(footerText, {
        x: MARGIN_LEFT,
        y: footerY,
        size: 8,
        font: helvetica,
        color: GRAY,
      });

      // Page number
      p.drawText(`Page ${i + 1} of ${pages.length}`, {
        x: PAGE_WIDTH - MARGIN_RIGHT - 50,
        y: footerY,
        size: 8,
        font: helvetica,
        color: GRAY,
      });
    }
  }

  // Save and return the PDF bytes
  return pdfDoc.save();
}

/**
 * Generate a dispute letter PDF with script signature (convenience wrapper)
 * This is the preferred function for generating dispute letters with
 * professional-looking cursive signatures.
 */
export async function generateDisputeLetterPDFWithSignature(
  data: DisputeLetterData,
  options: Omit<PDFGenerationOptions, 'useScriptSignature'> & { useScriptSignature?: boolean } = {}
): Promise<Uint8Array> {
  return generateDisputeLetterPDF(data, {
    ...options,
    useScriptSignature: options.useScriptSignature ?? true, // Default to script signature
  });
}

/**
 * Generate a simple letter PDF from plain text
 */
export async function generateSimpleLetterPDF(
  content: string,
  options: {
    title?: string;
    date?: Date;
    footer?: string;
  } = {}
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let currentY = PAGE_HEIGHT - MARGIN_TOP;

  // Title if provided
  if (options.title) {
    page.drawText(options.title, {
      x: MARGIN_LEFT,
      y: currentY,
      size: 14,
      font: timesRomanBold,
      color: BLACK,
    });
    currentY -= LINE_HEIGHT * 2;
  }

  // Date
  if (options.date) {
    page.drawText(format(options.date, "MMMM d, yyyy"), {
      x: MARGIN_LEFT,
      y: currentY,
      size: 11,
      font: timesRoman,
      color: BLACK,
    });
    currentY -= LINE_HEIGHT * 2;
  }

  // Content with word wrap
  const maxWidth = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
  const lines = content.split("\n");

  for (const line of lines) {
    if (line.trim() === "") {
      currentY -= LINE_HEIGHT;
      continue;
    }

    // Word wrap
    const words = line.split(" ");
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine + (currentLine ? " " : "") + word;
      const testWidth = timesRoman.widthOfTextAtSize(testLine, 11);

      if (testWidth > maxWidth && currentLine) {
        // Check if new page needed
        if (currentY < MARGIN_BOTTOM) {
          page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
          currentY = PAGE_HEIGHT - MARGIN_TOP;
        }

        page.drawText(currentLine, {
          x: MARGIN_LEFT,
          y: currentY,
          size: 11,
          font: timesRoman,
          color: BLACK,
        });
        currentY -= LINE_HEIGHT;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    // Draw remaining text
    if (currentLine) {
      if (currentY < MARGIN_BOTTOM) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        currentY = PAGE_HEIGHT - MARGIN_TOP;
      }

      page.drawText(currentLine, {
        x: MARGIN_LEFT,
        y: currentY,
        size: 11,
        font: timesRoman,
        color: BLACK,
      });
      currentY -= LINE_HEIGHT;
    }
  }

  // Footer on all pages
  if (options.footer) {
    const pages = pdfDoc.getPages();
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      p.drawLine({
        start: { x: MARGIN_LEFT, y: MARGIN_BOTTOM - 10 },
        end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: MARGIN_BOTTOM - 10 },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      });
      p.drawText(options.footer, {
        x: MARGIN_LEFT,
        y: MARGIN_BOTTOM - 25,
        size: 8,
        font: helvetica,
        color: GRAY,
      });
      p.drawText(`Page ${i + 1} of ${pages.length}`, {
        x: PAGE_WIDTH - MARGIN_RIGHT - 50,
        y: MARGIN_BOTTOM - 25,
        size: 8,
        font: helvetica,
        color: GRAY,
      });
    }
  }

  return pdfDoc.save();
}

/**
 * Add signature to existing PDF buffer
 */
export async function addSignatureToPDF(
  pdfBuffer: Buffer | Uint8Array,
  signatureImageBase64: string,
  position: { x: number; y: number; width?: number; height?: number }
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);

  // Embed the signature image
  let signatureImage;
  if (signatureImageBase64.includes("data:image/png")) {
    const base64Data = signatureImageBase64.split(",")[1];
    signatureImage = await pdfDoc.embedPng(Buffer.from(base64Data, "base64"));
  } else if (signatureImageBase64.includes("data:image/jpeg") || signatureImageBase64.includes("data:image/jpg")) {
    const base64Data = signatureImageBase64.split(",")[1];
    signatureImage = await pdfDoc.embedJpg(Buffer.from(base64Data, "base64"));
  } else {
    // Assume raw base64 PNG
    signatureImage = await pdfDoc.embedPng(Buffer.from(signatureImageBase64, "base64"));
  }

  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1];

  // Scale signature to fit
  const imgDims = signatureImage.scale(1);
  const width = position.width || 150;
  const height = position.height || (width / imgDims.width) * imgDims.height;

  lastPage.drawImage(signatureImage, {
    x: position.x,
    y: position.y,
    width,
    height,
  });

  return pdfDoc.save();
}

/**
 * Merge multiple PDFs into one
 */
export async function mergePDFs(pdfBuffers: Array<Buffer | Uint8Array>): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();

  for (const buffer of pdfBuffers) {
    const pdf = await PDFDocument.load(buffer);
    const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    pages.forEach((page) => mergedPdf.addPage(page));
  }

  return mergedPdf.save();
}

/**
 * CRA Addresses for dispute letters
 */
export const CRA_ADDRESSES = {
  EQUIFAX: {
    name: "Equifax Information Services LLC",
    address: "P.O. Box 740256",
    city: "Atlanta",
    state: "GA",
    zip: "30374-0256",
  },
  EXPERIAN: {
    name: "Experian",
    address: "P.O. Box 4500",
    city: "Allen",
    state: "TX",
    zip: "75013",
  },
  TRANSUNION: {
    name: "TransUnion LLC",
    address: "P.O. Box 2000",
    city: "Chester",
    state: "PA",
    zip: "19016",
  },
} as const;

export type CRAName = keyof typeof CRA_ADDRESSES;

// ============================================================================
// EXHIBIT PACKAGE PDF GENERATION
// ============================================================================

export interface ExhibitItem {
  label: string; // "A", "B", "C", etc.
  caption: string;
  creditorName?: string;
  evidenceType: string;
  imageBase64?: string; // Base64 encoded image (data:image/png;base64,... or raw)
  imageUrl?: string; // URL to fetch image from
  notes?: string;
}

export interface ExhibitPackageData {
  title?: string;
  clientName?: string;
  disputeId?: string;
  generatedDate: Date;
  exhibits: ExhibitItem[];
}

/**
 * Generate an Exhibit Package PDF with embedded evidence images.
 *
 * Creates a professional PDF with:
 * - Cover page with index of exhibits
 * - One page per exhibit with embedded image
 * - Captions and labels
 */
export async function generateExhibitPackagePDF(
  data: ExhibitPackageData
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Embed fonts
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // ========================================================================
  // COVER PAGE
  // ========================================================================
  const coverPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let yPosition = PAGE_HEIGHT - MARGIN_TOP;

  // Title
  const title = data.title || "EXHIBIT PACKAGE";
  coverPage.drawText(title, {
    x: MARGIN_LEFT,
    y: yPosition,
    size: 18,
    font: helveticaBold,
    color: BLACK,
  });
  yPosition -= 30;

  // Date and reference
  coverPage.drawText(`Date: ${format(data.generatedDate, "MMMM d, yyyy")}`, {
    x: MARGIN_LEFT,
    y: yPosition,
    size: 11,
    font: helvetica,
    color: GRAY,
  });
  yPosition -= 16;

  if (data.clientName) {
    coverPage.drawText(`Client: ${data.clientName}`, {
      x: MARGIN_LEFT,
      y: yPosition,
      size: 11,
      font: helvetica,
      color: GRAY,
    });
    yPosition -= 16;
  }

  if (data.disputeId) {
    coverPage.drawText(`Reference: ${data.disputeId}`, {
      x: MARGIN_LEFT,
      y: yPosition,
      size: 11,
      font: helvetica,
      color: GRAY,
    });
    yPosition -= 16;
  }

  yPosition -= 30;

  // Index of Exhibits header
  coverPage.drawText("Index of Exhibits", {
    x: MARGIN_LEFT,
    y: yPosition,
    size: 14,
    font: helveticaBold,
    color: BLACK,
  });
  yPosition -= 25;

  // Draw index items
  for (const exhibit of data.exhibits) {
    const indexLine = `Exhibit ${exhibit.label}: ${exhibit.caption || exhibit.creditorName || "Evidence"}`;
    coverPage.drawText(indexLine, {
      x: MARGIN_LEFT + 20,
      y: yPosition,
      size: 11,
      font: helvetica,
      color: DARK_GRAY,
    });
    yPosition -= 18;

    // Prevent overflow
    if (yPosition < MARGIN_BOTTOM + 50) {
      break;
    }
  }

  // ========================================================================
  // EXHIBIT PAGES
  // ========================================================================
  for (const exhibit of data.exhibits) {
    const exhibitPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let pageY = PAGE_HEIGHT - MARGIN_TOP;

    // Exhibit header bar
    const headerHeight = 40;
    exhibitPage.drawRectangle({
      x: MARGIN_LEFT,
      y: PAGE_HEIGHT - MARGIN_TOP - headerHeight,
      width: PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT,
      height: headerHeight,
      color: rgb(0.15, 0.15, 0.15),
    });

    // Exhibit label
    exhibitPage.drawText(`EXHIBIT ${exhibit.label}`, {
      x: MARGIN_LEFT + 15,
      y: PAGE_HEIGHT - MARGIN_TOP - 28,
      size: 18,
      font: helveticaBold,
      color: rgb(1, 1, 1),
    });

    pageY -= headerHeight + 20;

    // Creditor name if available
    if (exhibit.creditorName) {
      exhibitPage.drawText(exhibit.creditorName, {
        x: MARGIN_LEFT,
        y: pageY,
        size: 12,
        font: helveticaBold,
        color: BLACK,
      });
      pageY -= 18;
    }

    // Evidence type
    exhibitPage.drawText(`Type: ${exhibit.evidenceType}`, {
      x: MARGIN_LEFT,
      y: pageY,
      size: 10,
      font: helvetica,
      color: GRAY,
    });
    pageY -= 25;

    // Image area dimensions
    const imageAreaWidth = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
    const imageAreaHeight = 400; // Max height for image

    // Embed image if available
    if (exhibit.imageBase64) {
      try {
        let embeddedImage;

        // Handle different base64 formats
        if (exhibit.imageBase64.includes("data:image/png")) {
          const base64Data = exhibit.imageBase64.split(",")[1];
          embeddedImage = await pdfDoc.embedPng(Buffer.from(base64Data, "base64"));
        } else if (
          exhibit.imageBase64.includes("data:image/jpeg") ||
          exhibit.imageBase64.includes("data:image/jpg")
        ) {
          const base64Data = exhibit.imageBase64.split(",")[1];
          embeddedImage = await pdfDoc.embedJpg(Buffer.from(base64Data, "base64"));
        } else {
          // Assume raw base64 PNG
          embeddedImage = await pdfDoc.embedPng(Buffer.from(exhibit.imageBase64, "base64"));
        }

        // Calculate scaled dimensions to fit
        const imgDims = embeddedImage.scale(1);
        let drawWidth = imageAreaWidth;
        let drawHeight = (imageAreaWidth / imgDims.width) * imgDims.height;

        // If too tall, scale by height instead
        if (drawHeight > imageAreaHeight) {
          drawHeight = imageAreaHeight;
          drawWidth = (imageAreaHeight / imgDims.height) * imgDims.width;
        }

        // Center the image horizontally
        const xOffset = MARGIN_LEFT + (imageAreaWidth - drawWidth) / 2;

        exhibitPage.drawImage(embeddedImage, {
          x: xOffset,
          y: pageY - drawHeight,
          width: drawWidth,
          height: drawHeight,
        });

        pageY -= drawHeight + 20;
      } catch (imageError) {
        log.error({ err: imageError }, "Failed to embed image for Exhibit ${exhibit.label}");

        // Draw placeholder for failed image
        exhibitPage.drawRectangle({
          x: MARGIN_LEFT,
          y: pageY - 200,
          width: imageAreaWidth,
          height: 200,
          borderColor: GRAY,
          borderWidth: 1,
        });

        exhibitPage.drawText("Image could not be loaded", {
          x: MARGIN_LEFT + imageAreaWidth / 2 - 80,
          y: pageY - 105,
          size: 12,
          font: helvetica,
          color: GRAY,
        });

        pageY -= 220;
      }
    } else {
      // No image - draw placeholder
      exhibitPage.drawRectangle({
        x: MARGIN_LEFT,
        y: pageY - 200,
        width: imageAreaWidth,
        height: 200,
        borderColor: GRAY,
        borderWidth: 1,
      });

      exhibitPage.drawText("No image available", {
        x: MARGIN_LEFT + imageAreaWidth / 2 - 60,
        y: pageY - 105,
        size: 12,
        font: helvetica,
        color: GRAY,
      });

      pageY -= 220;
    }

    // Caption
    if (exhibit.caption) {
      exhibitPage.drawText(exhibit.caption, {
        x: MARGIN_LEFT,
        y: pageY,
        size: 10,
        font: helvetica,
        color: DARK_GRAY,
      });
      pageY -= 18;
    }

    // Notes
    if (exhibit.notes) {
      exhibitPage.drawText(`Notes: ${exhibit.notes}`, {
        x: MARGIN_LEFT,
        y: pageY,
        size: 9,
        font: helvetica,
        color: GRAY,
      });
    }

    // Page footer with exhibit reference
    exhibitPage.drawText(`Exhibit ${exhibit.label} - Page ${pdfDoc.getPageCount()}`, {
      x: PAGE_WIDTH / 2 - 50,
      y: MARGIN_BOTTOM - 20,
      size: 9,
      font: helvetica,
      color: GRAY,
    });
  }

  return pdfDoc.save();
}

// ============================================================================
// SENTRY ANALYTICS REPORT PDF
// ============================================================================

/**
 * Analytics report data structure
 */
export interface AnalyticsReportData {
  clientName: string;
  generatedDate: Date;
  // Bureau performance
  bureauStats: {
    transunion: { active: number; deleted: number; total: number };
    experian: { active: number; deleted: number; total: number };
    equifax: { active: number; deleted: number; total: number };
  };
  // Overall statistics
  totalDeleted: number;
  totalDisputed: number;
  awaitingResponse: number;
  accountsTracked: number;
  successRate: number;
  // Outcome breakdown
  outcomes: {
    deleted: number;
    verified: number;
    updated: number;
    pending: number;
    notStarted: number;
  };
}

/**
 * Generate a Sentry Analytics Report PDF
 *
 * Creates a professional PDF report showing:
 * - Client name and report date
 * - Bureau performance metrics with deletion rates
 * - Overall statistics
 * - Account outcome breakdown
 */
export async function generateAnalyticsReportPDF(
  data: AnalyticsReportData
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  // Embed fonts
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Add page
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let yPosition = PAGE_HEIGHT - MARGIN_TOP;

  // Colors for the report
  const PRIMARY_BLUE = rgb(0.18, 0.35, 0.58);
  const EMERALD = rgb(0.2, 0.78, 0.6);
  const AMBER = rgb(0.96, 0.62, 0.04);
  const RED = rgb(0.87, 0.24, 0.24);
  const PURPLE = rgb(0.58, 0.35, 0.74);
  const LIGHT_GRAY = rgb(0.95, 0.95, 0.95);

  // ========================================================================
  // HEADER
  // ========================================================================

  page.drawText("SENTRY DISPUTE ANALYTICS REPORT", {
    x: MARGIN_LEFT,
    y: yPosition,
    size: 18,
    font: helveticaBold,
    color: PRIMARY_BLUE,
  });
  yPosition -= 24;

  page.drawText(`Client: ${data.clientName}`, {
    x: MARGIN_LEFT,
    y: yPosition,
    size: 11,
    font: helvetica,
    color: DARK_GRAY,
  });
  yPosition -= 16;

  page.drawText(`Generated: ${format(data.generatedDate, "MMMM d, yyyy 'at' h:mm a")}`, {
    x: MARGIN_LEFT,
    y: yPosition,
    size: 11,
    font: helvetica,
    color: GRAY,
  });
  yPosition -= 40;

  // ========================================================================
  // BUREAU PERFORMANCE SECTION
  // ========================================================================

  page.drawText("BUREAU PERFORMANCE", {
    x: MARGIN_LEFT,
    y: yPosition,
    size: 14,
    font: helveticaBold,
    color: BLACK,
  });
  yPosition -= 8;

  // Underline
  page.drawLine({
    start: { x: MARGIN_LEFT, y: yPosition },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: yPosition },
    thickness: 1,
    color: LIGHT_GRAY,
  });
  yPosition -= 24;

  const bureaus = [
    { name: "TransUnion", stats: data.bureauStats.transunion, color: rgb(0.23, 0.51, 0.86) },
    { name: "Experian", stats: data.bureauStats.experian, color: PURPLE },
    { name: "Equifax", stats: data.bureauStats.equifax, color: EMERALD },
  ];

  for (const bureau of bureaus) {
    const rate = bureau.stats.total > 0
      ? Math.round((bureau.stats.deleted / bureau.stats.total) * 100)
      : 0;

    // Bureau name and rate
    page.drawText(bureau.name, {
      x: MARGIN_LEFT,
      y: yPosition,
      size: 11,
      font: helveticaBold,
      color: BLACK,
    });

    page.drawText(`${rate}% deletion rate (${bureau.stats.deleted}/${bureau.stats.total} items)`, {
      x: PAGE_WIDTH - MARGIN_RIGHT - 180,
      y: yPosition,
      size: 10,
      font: helvetica,
      color: GRAY,
    });
    yPosition -= 12;

    // Progress bar background
    const barWidth = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
    const barHeight = 8;
    page.drawRectangle({
      x: MARGIN_LEFT,
      y: yPosition - barHeight,
      width: barWidth,
      height: barHeight,
      color: LIGHT_GRAY,
    });

    // Progress bar fill
    const fillWidth = (rate / 100) * barWidth;
    if (fillWidth > 0) {
      page.drawRectangle({
        x: MARGIN_LEFT,
        y: yPosition - barHeight,
        width: fillWidth,
        height: barHeight,
        color: bureau.color,
      });
    }
    yPosition -= 28;
  }

  yPosition -= 16;

  // ========================================================================
  // OVERALL STATISTICS SECTION
  // ========================================================================

  page.drawText("OVERALL STATISTICS", {
    x: MARGIN_LEFT,
    y: yPosition,
    size: 14,
    font: helveticaBold,
    color: BLACK,
  });
  yPosition -= 8;

  page.drawLine({
    start: { x: MARGIN_LEFT, y: yPosition },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: yPosition },
    thickness: 1,
    color: LIGHT_GRAY,
  });
  yPosition -= 30;

  // Stats grid (2x2)
  const statsBoxWidth = (PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT - 20) / 2;
  const statsBoxHeight = 60;

  const stats = [
    { label: "Items Deleted", value: data.totalDeleted.toString(), color: EMERALD },
    { label: "Total Disputed", value: data.totalDisputed.toString(), color: BLACK },
    { label: "Awaiting Response", value: data.awaitingResponse.toString(), color: AMBER },
    { label: "Accounts Tracked", value: data.accountsTracked.toString(), color: PRIMARY_BLUE },
  ];

  for (let i = 0; i < stats.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const boxX = MARGIN_LEFT + col * (statsBoxWidth + 20);
    const boxY = yPosition - row * (statsBoxHeight + 10);

    // Box background
    page.drawRectangle({
      x: boxX,
      y: boxY - statsBoxHeight,
      width: statsBoxWidth,
      height: statsBoxHeight,
      color: LIGHT_GRAY,
    });

    // Value (large)
    page.drawText(stats[i].value, {
      x: boxX + statsBoxWidth / 2 - helveticaBold.widthOfTextAtSize(stats[i].value, 28) / 2,
      y: boxY - 30,
      size: 28,
      font: helveticaBold,
      color: stats[i].color,
    });

    // Label
    page.drawText(stats[i].label, {
      x: boxX + statsBoxWidth / 2 - helvetica.widthOfTextAtSize(stats[i].label, 10) / 2,
      y: boxY - 50,
      size: 10,
      font: helvetica,
      color: GRAY,
    });
  }

  yPosition -= 2 * (statsBoxHeight + 10) + 30;

  // ========================================================================
  // ACCOUNT OUTCOMES SECTION
  // ========================================================================

  page.drawText("ACCOUNT OUTCOMES", {
    x: MARGIN_LEFT,
    y: yPosition,
    size: 14,
    font: helveticaBold,
    color: BLACK,
  });
  yPosition -= 8;

  page.drawLine({
    start: { x: MARGIN_LEFT, y: yPosition },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: yPosition },
    thickness: 1,
    color: LIGHT_GRAY,
  });
  yPosition -= 30;

  const outcomes = [
    { label: "Deleted", value: data.outcomes.deleted, color: EMERALD },
    { label: "Verified", value: data.outcomes.verified, color: RED },
    { label: "Updated", value: data.outcomes.updated, color: rgb(0.92, 0.72, 0.2) },
    { label: "Pending", value: data.outcomes.pending, color: AMBER },
    { label: "Not Started", value: data.outcomes.notStarted, color: rgb(0.47, 0.53, 0.6) },
  ];

  const outcomeBoxWidth = (PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT - 40) / 5;

  for (let i = 0; i < outcomes.length; i++) {
    const boxX = MARGIN_LEFT + i * (outcomeBoxWidth + 10);

    // Color bar at top
    page.drawRectangle({
      x: boxX,
      y: yPosition,
      width: outcomeBoxWidth,
      height: 6,
      color: outcomes[i].color,
    });

    // Value
    const valueStr = outcomes[i].value.toString();
    page.drawText(valueStr, {
      x: boxX + outcomeBoxWidth / 2 - helveticaBold.widthOfTextAtSize(valueStr, 22) / 2,
      y: yPosition - 28,
      size: 22,
      font: helveticaBold,
      color: BLACK,
    });

    // Label
    page.drawText(outcomes[i].label, {
      x: boxX + outcomeBoxWidth / 2 - helvetica.widthOfTextAtSize(outcomes[i].label, 9) / 2,
      y: yPosition - 44,
      size: 9,
      font: helvetica,
      color: GRAY,
    });
  }

  yPosition -= 70;

  // ========================================================================
  // SUCCESS RATE SUMMARY
  // ========================================================================

  if (data.successRate > 0) {
    page.drawText("SUCCESS RATE", {
      x: MARGIN_LEFT,
      y: yPosition,
      size: 14,
      font: helveticaBold,
      color: BLACK,
    });
    yPosition -= 8;

    page.drawLine({
      start: { x: MARGIN_LEFT, y: yPosition },
      end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: yPosition },
      thickness: 1,
      color: LIGHT_GRAY,
    });
    yPosition -= 30;

    const successText = `${Math.round(data.successRate)}%`;
    page.drawText(successText, {
      x: MARGIN_LEFT,
      y: yPosition,
      size: 36,
      font: helveticaBold,
      color: EMERALD,
    });

    page.drawText("of disputed items have been successfully deleted or updated", {
      x: MARGIN_LEFT + 80,
      y: yPosition + 10,
      size: 11,
      font: helvetica,
      color: DARK_GRAY,
    });
  }

  // ========================================================================
  // FOOTER
  // ========================================================================

  page.drawLine({
    start: { x: MARGIN_LEFT, y: MARGIN_BOTTOM },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: MARGIN_BOTTOM },
    thickness: 0.5,
    color: LIGHT_GRAY,
  });

  page.drawText("Generated by Sentry Dispute System", {
    x: MARGIN_LEFT,
    y: MARGIN_BOTTOM - 15,
    size: 8,
    font: helvetica,
    color: GRAY,
  });

  page.drawText("Confidential - For Client Use Only", {
    x: PAGE_WIDTH - MARGIN_RIGHT - 120,
    y: MARGIN_BOTTOM - 15,
    size: 8,
    font: helvetica,
    color: GRAY,
  });

  return pdfDoc.save();
}
