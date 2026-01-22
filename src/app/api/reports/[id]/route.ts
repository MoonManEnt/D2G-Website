
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { del } from "@vercel/blob";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// DELETE /api/reports/[id] - Delete a report and its associated file
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        const { id } = await params;

        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 1. Fetch the report to get file info and verify ownership
        const report = await prisma.creditReport.findUnique({
            where: { id },
            include: { originalFile: true },
        });

        if (!report) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }

        if (report.organizationId !== session.user.organizationId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        // 2. Delete the file from blob storage if it's a remote URL
        if (report.originalFile?.storagePath && report.originalFile.storagePath.startsWith("http")) {
            try {
                await del(report.originalFile.storagePath);
                console.log(`Deleted blob: ${report.originalFile.storagePath}`);
            } catch (blobError) {
                console.error("Failed to delete blob file:", blobError);
                // Continue with DB deletion even if blob deletion fails (it might be already gone)
            }
        }

        // 3. Delete the report from database
        // Note: Prisma schema typically cascades deletes for accounts, but might not for StoredFile if it's a relation
        await prisma.creditReport.delete({
            where: { id },
        });

        // 4. Clean up StoredFile if it exists and wasn't cascaded
        if (report.originalFileId) {
            try {
                // Check if it still exists (in case of cascade)
                const fileExists = await prisma.storedFile.findUnique({ where: { id: report.originalFileId } });
                if (fileExists) {
                    await prisma.storedFile.delete({
                        where: { id: report.originalFileId },
                    });
                }
            } catch (fileError) {
                console.warn("Could not delete stored file record (might have cascaded):", fileError);
            }
        }

        // 5. Log the deletion event
        await prisma.eventLog.create({
            data: {
                eventType: "REPORT_DELETED",
                actorId: session.user.id,
                actorEmail: session.user.email,
                targetType: "CreditReport",
                targetId: id,
                eventData: JSON.stringify({ fileName: report.originalFile?.filename || "unknown" }),
                organizationId: session.user.organizationId,
            },
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Error deleting report:", error);
        return NextResponse.json(
            { error: "Failed to delete report" },
            { status: 500 }
        );
    }
}
