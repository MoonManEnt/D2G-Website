/**
 * EXHIBIT PACKAGE PDF API
 *
 * POST /api/evidence/exhibits/pdf - Generate exhibit package PDF with embedded images
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateExhibitPackagePDF, ExhibitItem } from "@/lib/pdf-generate";

export const dynamic = "force-dynamic";

interface ExhibitInput {
  id: string;
  label: string;
  caption: string;
  evidenceId: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { exhibits, title, clientName, disputeId } = body as {
      exhibits: ExhibitInput[];
      title?: string;
      clientName?: string;
      disputeId?: string;
    };

    if (!exhibits || !Array.isArray(exhibits) || exhibits.length === 0) {
      return NextResponse.json(
        { error: "At least one exhibit is required" },
        { status: 400 }
      );
    }

    // Fetch evidence records with their rendered files
    const evidenceIds = exhibits.map((e) => e.evidenceId);
    const evidenceRecords = await prisma.evidence.findMany({
      where: {
        id: { in: evidenceIds },
        organizationId: session.user.organizationId,
      },
      include: {
        renderedFile: true,
        accountItem: {
          select: {
            creditorName: true,
            maskedAccountId: true,
          },
        },
      },
    });

    // Build exhibit items with images
    const exhibitItems: ExhibitItem[] = [];

    for (const exhibit of exhibits) {
      const evidence = evidenceRecords.find((e) => e.id === exhibit.evidenceId);
      if (!evidence) {
        console.warn(`Evidence not found: ${exhibit.evidenceId}`);
        continue;
      }

      let imageBase64: string | undefined;

      // Fetch image from storage if available
      if (evidence.renderedFile?.storagePath) {
        try {
          let imageUrl = evidence.renderedFile.storagePath;

          // If it's a Vercel Blob URL, fetch directly
          // If it's a local path, construct full URL
          if (!imageUrl.startsWith("http")) {
            const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
            if (imageUrl.startsWith("/")) {
              imageUrl = `${baseUrl}${imageUrl}`;
            } else {
              imageUrl = `${baseUrl}/uploads/${imageUrl}`;
            }
          }

          // Fetch the image
          const imageResponse = await fetch(imageUrl);
          if (imageResponse.ok) {
            const imageBuffer = await imageResponse.arrayBuffer();
            const mimeType = evidence.renderedFile.mimeType || "image/png";
            imageBase64 = `data:${mimeType};base64,${Buffer.from(imageBuffer).toString("base64")}`;
          } else {
            console.warn(`Failed to fetch image: ${imageUrl}`);
          }
        } catch (fetchError) {
          console.error(`Error fetching image for exhibit ${exhibit.label}:`, fetchError);
        }
      }

      exhibitItems.push({
        label: exhibit.label,
        caption: exhibit.caption || evidence.title || "Evidence",
        creditorName: evidence.accountItem?.creditorName,
        evidenceType: evidence.evidenceType,
        imageBase64,
      });
    }

    if (exhibitItems.length === 0) {
      return NextResponse.json(
        { error: "No valid exhibits could be processed" },
        { status: 400 }
      );
    }

    // Generate the PDF
    const pdfBytes = await generateExhibitPackagePDF({
      title: title || "Evidence Exhibit Package",
      clientName,
      disputeId,
      generatedDate: new Date(),
      exhibits: exhibitItems,
    });

    // Return PDF as downloadable file
    const pdfBuffer = Buffer.from(pdfBytes);
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="exhibit-package-${Date.now()}.pdf"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error generating exhibit PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate exhibit package PDF" },
      { status: 500 }
    );
  }
}
