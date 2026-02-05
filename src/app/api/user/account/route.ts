import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
const log = createLogger("user-account-api");

/**
 * DELETE /api/user/account
 *
 * GDPR Right to Erasure (Article 17) - Permanently deletes the user's
 * organization and ALL associated data. Only the OWNER role can perform
 * this action. Requires explicit confirmation in the request body.
 *
 * Body: { "confirmation": "DELETE MY ACCOUNT" }
 *
 * Deletion order respects foreign key constraints:
 * 1. Event logs
 * 2. Dispute items, then disputes
 * 3. Account items, then credit reports
 * 4. Credit scores
 * 5. Clients (cascade handles remaining related records)
 * 6. Users
 * 7. Organization
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only OWNER can delete the entire organization
    if (session.user.role !== "OWNER") {
      return NextResponse.json(
        { error: "Forbidden: Only the OWNER can delete the organization" },
        { status: 403 }
      );
    }

    // Require explicit confirmation
    const body = await request.json();
    if (body.confirmation !== "DELETE MY ACCOUNT") {
      return NextResponse.json(
        {
          error:
            'Confirmation required. Send { "confirmation": "DELETE MY ACCOUNT" } to proceed.',
        },
        { status: 400 }
      );
    }

    const organizationId = session.user.organizationId;

    // Log the deletion event BEFORE deleting (for audit trail)
    // This record will be deleted as part of the transaction, but the
    // server logs will retain evidence of the action.
    log.info({ email: session.user.email, id: session.user.id, organizationId, toISOString: new Date().toISOString() }, "[GDPR] Account deletion initiated by () for organization at");

    await prisma.eventLog.create({
      data: {
        eventType: "GDPR_ACCOUNT_DELETION",
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetType: "Organization",
        targetId: organizationId,
        eventData: JSON.stringify({
          timestamp: new Date().toISOString(),
          organizationName: session.user.organizationName,
          requestedBy: session.user.email,
        }),
        organizationId,
      },
    });

    // Cascade delete everything in a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Delete all event logs for the org
      await tx.eventLog.deleteMany({
        where: { organizationId },
      });

      // 2. Delete dispute items first (FK to disputes and account items)
      const orgDisputes = await tx.dispute.findMany({
        where: { organizationId },
        select: { id: true },
      });
      const disputeIds = orgDisputes.map((d) => d.id);

      if (disputeIds.length > 0) {
        await tx.disputeItem.deleteMany({
          where: { disputeId: { in: disputeIds } },
        });
      }

      // Delete disputes
      await tx.dispute.deleteMany({
        where: { organizationId },
      });

      // 3. Delete account items first (FK to credit reports)
      await tx.accountItem.deleteMany({
        where: { organizationId },
      });

      // Delete credit reports
      await tx.creditReport.deleteMany({
        where: { organizationId },
      });

      // 4. Delete credit scores (via clients in the org)
      const orgClients = await tx.client.findMany({
        where: { organizationId },
        select: { id: true },
      });
      const clientIds = orgClients.map((c) => c.id);

      if (clientIds.length > 0) {
        await tx.creditScore.deleteMany({
          where: { clientId: { in: clientIds } },
        });
      }

      // 5. Delete clients (cascade handles remaining related records like
      //    ClientPortalAccess, Reminders, Communications, etc.)
      await tx.client.deleteMany({
        where: { organizationId },
      });

      // 6. Delete all users in the org
      await tx.user.deleteMany({
        where: { organizationId },
      });

      // 7. Delete the organization itself
      await tx.organization.delete({
        where: { id: organizationId },
      });
    });

    return NextResponse.json(
      {
        deleted: true,
        organizationId,
      },
      { status: 200 }
    );
  } catch (error) {
    log.error({ err: error }, "Error deleting account");
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
