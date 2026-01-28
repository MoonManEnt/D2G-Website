import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { readFile } from "fs/promises";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/reports/[id]/pdf - Get PDF file for viewing
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: reportId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the report with file info
    const report = await prisma.creditReport.findFirst({
      where: {
        id: reportId,
        organizationId: session.user.organizationId,
      },
      include: {
        originalFile: true,
      },
    });

    if (!report || !report.originalFile) {
      return NextResponse.json({ error: "Report or file not found" }, { status: 404 });
    }

    // Read the PDF file
    let pdfBuffer: Buffer;
    const storagePath = report.originalFile.storagePath;

    console.log(`fetching PDF from: ${storagePath}`);

    if (storagePath.startsWith("http")) {
      const response = await fetch(storagePath);
      if (!response.ok) {
        console.error(`Fetch failed: ${response.status} ${response.statusText}`);
        throw new Error(`Failed to fetch PDF from storage: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      pdfBuffer = Buffer.from(arrayBuffer);
    } else {
      // Handle legacy paths or local files (unlikely to work in serverless unless bundled)
      console.warn(`Attempting to read local file: ${storagePath}`);

      // Check for broken blob:// paths (zombie reports)
      if (storagePath.startsWith("blob:")) {
        console.error("Attempted to access non-persisted blob path:", storagePath);
        return NextResponse.json(
          { error: "PDF file was not permanently saved. Please re-upload this report." },
          { status: 404 }
        );
      }

      try {
        pdfBuffer = await readFile(storagePath);
      } catch (err) {
        console.error("Local file read failed:", err);
        return NextResponse.json({ error: `File not found at path: ${storagePath}` }, { status: 404 });
      }
    }

    // Return the PDF with proper headers
    return new NextResponse(new Blob([new Uint8Array(pdfBuffer)]), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${report.originalFile.filename}"`,
        // "Cache-Control": "private, max-age=3600", // Commented out to prevent caching issues during debug
      },
    });

  } catch (error) {
    console.error("Error fetching PDF:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch PDF" },
      { status: 500 }
    );
  }
}
