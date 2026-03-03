/**
 * Exhibit Packet API — Generate exhibit packet PDF
 *
 * POST /api/clients/[id]/evidence/exhibit-packet
 * Takes selected evidence IDs, generates a professional PDF with
 * cover page + labeled exhibits (Exhibit A, B, C...).
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getFile } from "@/lib/storage";
import { generateExhibitPackagePDF, ExhibitItem, ExhibitPackageData } from "@/lib/pdf-generate";
import { createLogger } from "@/lib/logger";

const log = createLogger("exhibit-packet-api");

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Convert index to exhibit label: 0→A, 1→B, ... 25→Z, 26→AA, 27→AB
function indexToLabel(index: number): string {
  if (index < 26) {
    return String.fromCharCode(65 + index);
  }
  const first = String.fromCharCode(65 + Math.floor(index / 26) - 1);
  const second = String.fromCharCode(65 + (index % 26));
  return first + second;
}

// POST /api/clients/[id]/evidence/exhibit-packet
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: clientId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify client belongs to org
    const client = await prisma.client.findFirst({
      where: { id: clientId, organizationId: session.user.organizationId },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const body = await request.json();
    const { evidenceIds, disputeId, title } = body as {
      evidenceIds: string[];
      disputeId?: string;
      title?: string;
    };

    if (!evidenceIds || !Array.isArray(evidenceIds) || evidenceIds.length === 0) {
      return NextResponse.json(
        { error: "evidenceIds array is required and must not be empty" },
        { status: 400 }
      );
    }

    if (evidenceIds.length > 50) {
      return NextResponse.json(
        { error: "Maximum 50 exhibits per packet" },
        { status: 400 }
      );
    }

    // Fetch all evidence records with their files
    const evidenceRecords = await prisma.evidence.findMany({
      where: {
        id: { in: evidenceIds },
        clientId,
        organizationId: session.user.organizationId,
      },
      include: {
        renderedFile: true,
        accountItem: { select: { creditorName: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    if (evidenceRecords.length === 0) {
      return NextResponse.json(
        { error: "No matching evidence found" },
        { status: 404 }
      );
    }

    // Preserve the order from evidenceIds
    const orderedRecords = evidenceIds
      .map((id) => evidenceRecords.find((e) => e.id === id))
      .filter(Boolean) as typeof evidenceRecords;

    // Build exhibit items with image data
    const exhibits: ExhibitItem[] = [];

    for (let i = 0; i < orderedRecords.length; i++) {
      const record = orderedRecords[i];
      let imageBase64: string | undefined;

      // Load the rendered file to get image data
      if (record.renderedFile) {
        try {
          const file = await getFile(record.renderedFile.storagePath);
          if (file) {
            const base64 = file.buffer.toString("base64");
            imageBase64 = `data:${file.contentType};base64,${base64}`;
          }
        } catch (err) {
          log.error({ err, evidenceId: record.id }, "Failed to load evidence file");
        }
      }

      exhibits.push({
        label: indexToLabel(i),
        caption: record.title || record.description || `Evidence ${i + 1}`,
        creditorName: record.accountItem?.creditorName || undefined,
        evidenceType: record.evidenceType,
        imageBase64,
        notes: record.description || undefined,
      });
    }

    // Get dispute reference if provided
    let disputeRef: string | undefined;
    if (disputeId) {
      const dispute = await prisma.dispute.findFirst({
        where: { id: disputeId, organizationId: session.user.organizationId },
      });
      if (dispute) {
        disputeRef = dispute.disputeCode || dispute.id;
      }
    }

    // Generate the exhibit packet PDF
    const clientName = `${client.firstName} ${client.lastName}`;
    const packageData: ExhibitPackageData = {
      title: title || "EXHIBIT PACKET",
      clientName,
      disputeId: disputeRef,
      generatedDate: new Date(),
      exhibits,
    };

    const pdfBytes = await generateExhibitPackagePDF(packageData);

    // Return as downloadable PDF
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Exhibit_Packet_${clientName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf"`,
        "Content-Length": pdfBytes.length.toString(),
      },
    });
  } catch (error) {
    log.error({ err: error }, "Error generating exhibit packet");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate exhibit packet" },
      { status: 500 }
    );
  }
}
