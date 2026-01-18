import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { EventType, PARSE_ERROR_CODES } from "@/types";
import { isFeatureEnabled } from "@/lib/subscription";
import { SubscriptionTier, SubscriptionStatus } from "@/types";
import { v4 as uuid } from "uuid";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";

// GET /api/reports - List reports
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    
    const where = {
      organizationId: session.user.organizationId,
      ...(clientId && { clientId }),
    };
    
    const [reports, total] = await Promise.all([
      prisma.creditReport.findMany({
        where,
        include: {
          client: {
            select: { firstName: true, lastName: true },
          },
          _count: {
            select: { accounts: true },
          },
        },
        orderBy: { uploadedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.creditReport.count({ where }),
    ]);
    
    return NextResponse.json({
      items: reports.map(report => ({
        ...report,
        clientName: `${report.client.firstName} ${report.client.lastName}`,
        accountCount: report._count.accounts,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
    
  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 }
    );
  }
}

// POST /api/reports - Upload and parse new report
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Check subscription
    const canUpload = isFeatureEnabled(
      "canUploadReports",
      session.user.subscriptionTier as SubscriptionTier,
      session.user.subscriptionStatus as SubscriptionStatus
    );
    
    if (!canUpload) {
      return NextResponse.json(
        { error: "Report upload requires Pro subscription" },
        { status: 403 }
      );
    }
    
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const clientId = formData.get("clientId") as string;
    const reportDate = formData.get("reportDate") as string;
    
    if (!file || !clientId) {
      return NextResponse.json(
        { error: "File and clientId are required" },
        { status: 400 }
      );
    }
    
    // Validate file type
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are allowed" },
        { status: 400 }
      );
    }
    
    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 50MB limit" },
        { status: 400 }
      );
    }
    
    // Verify client belongs to organization
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: session.user.organizationId,
      },
    });
    
    if (!client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }
    
    // Save file
    const fileId = uuid();
    const orgDir = join(UPLOAD_DIR, session.user.organizationId);
    const fileName = `${fileId}.pdf`;
    const filePath = join(orgDir, fileName);
    
    await mkdir(orgDir, { recursive: true });
    
    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));
    
    // Create file record
    const storedFile = await prisma.storedFile.create({
      data: {
        id: fileId,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        storagePath: filePath,
        storageType: "LOCAL",
        organizationId: session.user.organizationId,
      },
    });
    
    // Create report record
    const report = await prisma.creditReport.create({
      data: {
        reportDate: reportDate ? new Date(reportDate) : new Date(),
        sourceType: "IDENTITYIQ",
        originalFileId: storedFile.id,
        parseStatus: "PENDING",
        organizationId: session.user.organizationId,
        clientId,
        uploadedById: session.user.id,
      },
    });
    
    // Log event
    await prisma.eventLog.create({
      data: {
        eventType: EventType.REPORT_UPLOADED,
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetType: "CreditReport",
        targetId: report.id,
        eventData: {
          clientId,
          fileName: file.name,
          fileSize: file.size,
        },
        organizationId: session.user.organizationId,
      },
    });
    
    // TODO: Queue parsing job (would use a job queue in production)
    // For now, return immediately and client can poll for status
    
    return NextResponse.json({
      id: report.id,
      status: "PENDING",
      message: "Report uploaded successfully. Parsing will begin shortly.",
    }, { status: 201 });
    
  } catch (error) {
    console.error("Error uploading report:", error);
    return NextResponse.json(
      { error: "Failed to upload report" },
      { status: 500 }
    );
  }
}
