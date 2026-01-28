import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { uploadFile, generateFileKey } from "@/lib/storage";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/clients/[id]/documents - Get client documents
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: clientId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Verify client
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: session.user.organizationId,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Build where clause
    const where: Record<string, unknown> = {
      clientId,
      organizationId: session.user.organizationId,
    };

    if (category) {
      where.category = category;
    }

    // Get documents
    const [documents, total] = await Promise.all([
      prisma.clientDocument.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          file: {
            select: {
              id: true,
              filename: true,
              mimeType: true,
              sizeBytes: true,
            },
          },
        },
      }),
      prisma.clientDocument.count({ where }),
    ]);

    return NextResponse.json({
      documents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

// POST /api/clients/[id]/documents - Upload a document for a client
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: clientId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify client
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: session.user.organizationId,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string | null;
    const category = (formData.get("category") as string) || "OTHER";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Validate file size (max 50MB)
    const maxSize = parseInt(process.env.MAX_FILE_SIZE_MB || "50") * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File size exceeds maximum of ${process.env.MAX_FILE_SIZE_MB || 50}MB` },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "File type not allowed" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Generate storage key
    const key = generateFileKey(
      session.user.organizationId,
      "documents",
      `client-${clientId}-${file.name}`
    );

    // Upload to storage
    const uploadResult = await uploadFile(buffer, key, file.type);

    // Create database records in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create stored file record
      const storedFile = await tx.storedFile.create({
        data: {
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          storagePath: uploadResult.key,
          storageType: uploadResult.provider.toUpperCase(),
          checksum: uploadResult.checksum,
          organizationId: session.user.organizationId,
        },
      });

      // Create client document record
      const clientDocument = await tx.clientDocument.create({
        data: {
          clientId,
          organizationId: session.user.organizationId,
          fileId: storedFile.id,
          title,
          description,
          category,
          uploadedById: session.user.id,
        },
      });

      return { storedFile, clientDocument };
    });

    return NextResponse.json({
      success: true,
      document: {
        id: result.clientDocument.id,
        title: result.clientDocument.title,
        category: result.clientDocument.category,
        file: {
          id: result.storedFile.id,
          filename: result.storedFile.filename,
          mimeType: result.storedFile.mimeType,
          sizeBytes: result.storedFile.sizeBytes,
        },
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Error uploading document:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload document" },
      { status: 500 }
    );
  }
}
