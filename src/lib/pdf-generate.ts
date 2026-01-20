/**
 * PDF Generation Service
 *
 * Creates professional PDF dispute letters from AI-generated drafts.
 * Uses pdf-lib for pure JavaScript PDF generation.
 */

import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage, degrees } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { format } from "date-fns";

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
  } = options;

  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Embed standard fonts
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

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
    // Signature line
    page.drawLine({
      start: { x: MARGIN_LEFT, y: currentY + LINE_HEIGHT },
      end: { x: MARGIN_LEFT + 200, y: currentY + LINE_HEIGHT },
      thickness: 0.5,
      color: BLACK,
    });

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
