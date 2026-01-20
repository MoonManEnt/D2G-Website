import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { readFile } from "fs/promises";

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
    const pdfBuffer = await readFile(report.originalFile.storagePath);

    // Return the PDF with proper headers
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${report.originalFile.filename}"`,
        "Cache-Control": "private, max-age=3600",
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
