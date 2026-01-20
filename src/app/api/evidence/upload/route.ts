import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { v4 as uuid } from "uuid";

const EVIDENCE_DIR = process.env.EVIDENCE_DIR || "./public/evidence";

// POST /api/evidence/upload - Upload a captured screenshot as evidence
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { accountId, reportId, imageData, pageNumber, description } = body;

    if (!accountId || !reportId || !imageData || !pageNumber) {
      return NextResponse.json(
        { error: "accountId, reportId, imageData, and pageNumber are required" },
        { status: 400 }
      );
    }

    // Validate base64 image data
    if (!imageData.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Invalid image data format" },
        { status: 400 }
      );
    }

    // Verify account belongs to organization
    const account = await prisma.accountItem.findFirst({
      where: {
        id: accountId,
        organizationId: session.user.organizationId,
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Verify report belongs to organization and get original file
    const report = await prisma.creditReport.findFirst({
      where: {
        id: reportId,
        organizationId: session.user.organizationId,
      },
      include: {
        originalFile: true,
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Create evidence directory
    const evidenceDir = join(EVIDENCE_DIR, session.user.organizationId, accountId);
    await mkdir(evidenceDir, { recursive: true });

    // Extract base64 data and determine file extension
    const matches = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json(
        { error: "Invalid image data format" },
        { status: 400 }
      );
    }

    const [, extension, base64Data] = matches;
    const imageBuffer = Buffer.from(base64Data, "base64");

    // Save the screenshot
    const evidenceId = uuid();
    const evidenceFileName = `${evidenceId}_page${pageNumber}.${extension}`;
    const evidenceFilePath = join(evidenceDir, evidenceFileName);
    const publicPath = `/evidence/${session.user.organizationId}/${accountId}/${evidenceFileName}`;

    await writeFile(evidenceFilePath, imageBuffer);

    // Create stored file record for the screenshot
    const storedFile = await prisma.storedFile.create({
      data: {
        filename: evidenceFileName,
        mimeType: `image/${extension}`,
        sizeBytes: imageBuffer.length,
        storagePath: evidenceFilePath,
        storageType: "LOCAL",
        checksum: evidenceId,
        organizationId: session.user.organizationId,
      },
    });

    // Create evidence record
    const evidence = await prisma.evidence.create({
      data: {
        evidenceType: "PDF_SCREENSHOT",
        title: `Page ${pageNumber} Screenshot - ${account.creditorName}`,
        description: description || `Screenshot of credit report page ${pageNumber} for ${account.creditorName}`,
        renderedFileId: storedFile.id,
        sourceFileId: report.originalFile?.id,
        sourcePageNum: pageNumber,
        accountItemId: accountId,
        organizationId: session.user.organizationId,
      },
    });

    // Log the capture event
    await prisma.eventLog.create({
      data: {
        eventType: "EVIDENCE_SCREENSHOT_CAPTURED",
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetType: "AccountItem",
        targetId: accountId,
        eventData: JSON.stringify({
          reportId,
          pageNumber,
          evidenceId: evidence.id,
          fileSize: imageBuffer.length,
        }),
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json({
      success: true,
      evidence: {
        id: evidence.id,
        pageNumber,
        filePath: publicPath,
        description: evidence.description,
        createdAt: evidence.createdAt,
      },
    });

  } catch (error) {
    console.error("Error uploading evidence screenshot:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload evidence" },
      { status: 500 }
    );
  }
}
