import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
const log = createLogger("file-download-api");

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: fileId } = await params;

    // Get the stored file
    const storedFile = await prisma.storedFile.findUnique({
      where: { id: fileId },
    });

    if (!storedFile) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Verify the file belongs to the user's organization
    if (storedFile.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if storagePath contains a URL (Vercel Blob) or local path
    if (storedFile.storagePath.startsWith("http")) {
      // Vercel Blob URL stored in storagePath
      return NextResponse.json({ url: storedFile.storagePath });
    }

    if (storedFile.storagePath.startsWith("/")) {
      // Local file path
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const url = `${baseUrl}${storedFile.storagePath}`;
      return NextResponse.json({ url });
    }

    // Try constructing a local path
    if (storedFile.storageType === "LOCAL") {
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const url = `${baseUrl}/uploads/${storedFile.storagePath}`;
      return NextResponse.json({ url });
    }

    return NextResponse.json(
      { error: "File storage location not found" },
      { status: 404 }
    );
  } catch (error) {
    log.error({ err: error }, "Error getting file download URL");
    return NextResponse.json(
      { error: "Failed to get download URL" },
      { status: 500 }
    );
  }
}
