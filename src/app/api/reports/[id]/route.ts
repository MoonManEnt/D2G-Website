
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { del } from "@vercel/blob";
import { createLogger } from "@/lib/logger";
const log = createLogger("report-detail-api");

export const dynamic = "force-dynamic";

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
                log.info({ storagePath: report.originalFile.storagePath }, "Deleted blob");
            } catch (blobError) {
                log.error({ err: blobError }, "Failed to delete blob file");
                // Continue with DB deletion even if blob deletion fails (it might be already gone)
            }
        }

        // 2.5 Delete related DiffResults (manual cascade because schema lacks onDelete: Cascade)
        await prisma.diffResult.deleteMany({
            where: {
                OR: [
                    { newReportId: id },
                    { priorReportId: id }
                ]
            }
        });

        // 2.6 Get all AccountItem IDs for this report
        const accountItems = await prisma.accountItem.findMany({
            where: { reportId: id },
            select: { id: true }
        });
        const accountItemIds = accountItems.map(a => a.id);

        // 2.7 Delete DisputeItems that reference these AccountItems
        // (DisputeItem -> AccountItem doesn't have cascade delete)
        if (accountItemIds.length > 0) {
            await prisma.disputeItem.deleteMany({
                where: { accountItemId: { in: accountItemIds } }
            });

            // 2.8 Delete Evidence records that reference these AccountItems
            await prisma.evidence.deleteMany({
                where: { accountItemId: { in: accountItemIds } }
            });
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
                log.warn({ err: fileError }, "Could not delete stored file record (might have cascaded)");
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
        log.error({ err: error }, "Error deleting report");
        return NextResponse.json(
            { error: "Failed to delete report" },
            { status: 500 }
        );
    }
}
