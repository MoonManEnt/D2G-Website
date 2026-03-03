/**
 * DOCUMENT EXPORT API
 *
 * GET /api/clients/[id]/litigation-cases/[caseId]/documents/[docId]/export?format=pdf|docx
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { SubscriptionTier } from "@/types";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, ctx) => {
  try {
    const { docId } = ctx.params;
    const url = new URL(req.url);
    const format = url.searchParams.get("format") || "pdf";

    const document = await prisma.litigationDocument.findUnique({
      where: { id: docId },
      include: {
        case: { select: { organizationId: true, caseNumber: true } },
        generatedFile: true,
      },
    });

    if (!document || document.case.organizationId !== ctx.organizationId) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // If a generated file already exists, return its URL
    if (document.generatedFile) {
      return NextResponse.json({
        success: true,
        fileUrl: document.generatedFile.storagePath,
        filename: document.generatedFile.filename,
        mimeType: document.generatedFile.mimeType,
      });
    }

    // Generate the file on-the-fly from content
    if (format === "docx") {
      // Use docx package to generate DOCX from content
      const { Document, Packer, Paragraph, TextRun } = await import("docx");

      const paragraphs = document.content.split("\n").map(
        (line) =>
          new Paragraph({
            children: [new TextRun({ text: line, font: "Times New Roman", size: 24 })],
            spacing: { after: 120 },
          }),
      );

      const doc = new Document({
        sections: [
          {
            properties: {
              page: {
                margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
              },
            },
            children: paragraphs,
          },
        ],
      });

      const buffer = await Packer.toBuffer(doc);

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${document.documentType}-${document.case.caseNumber}.docx"`,
        },
      });
    }

    // For PDF: return content as text for client-side rendering,
    // or use a PDF generation library if available
    return NextResponse.json({
      success: true,
      content: document.content,
      title: document.title,
      documentType: document.documentType,
      caseNumber: document.case.caseNumber,
      format: "text",
      message: "Use client-side PDF generation with this content",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export document" },
      { status: 500 },
    );
  }
}, { minTier: SubscriptionTier.PROFESSIONAL });
