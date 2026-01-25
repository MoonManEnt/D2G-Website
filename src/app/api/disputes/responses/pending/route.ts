import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDays, differenceInDays } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pendingDisputes = await prisma.dispute.findMany({
      where: {
        organizationId: session.user.organizationId,
        status: "SENT",
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        items: {
          include: { accountItem: { select: { creditorName: true, maskedAccountId: true } } },
        },
      },
      orderBy: { sentDate: "asc" },
    });

    const loggedDisputes = await prisma.dispute.findMany({
      where: {
        organizationId: session.user.organizationId,
        status: { in: ["RESPONDED", "RESOLVED"] },
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        items: {
          include: {
            responses: { orderBy: { responseDate: "desc" }, take: 1 },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });

    const pending = pendingDisputes.map((d) => {
      const sentDateVal = d.sentDate || d.createdAt;
      const deadline = addDays(sentDateVal, 30);
      const daysRemaining = differenceInDays(deadline, new Date());
      const daysElapsed = differenceInDays(new Date(), sentDateVal);

      return {
        id: d.id,
        disputeId: d.id,
        clientId: d.client.id,
        clientName: d.client.firstName + " " + d.client.lastName,
        cra: d.cra,
        round: d.round,
        flow: d.flow,
        sentDate: sentDateVal.toISOString(),
        responseDeadline: deadline.toISOString(),
        daysRemaining,
        daysElapsed,
        status: d.status,
        itemCount: d.items.length,
        accounts: d.items.map((item) => ({
          name: item.accountItem?.creditorName || "Unknown",
          accountId: item.accountItem?.maskedAccountId || item.id,
        })),
      };
    });

    type LoggedDisputeWithRelations = typeof loggedDisputes[0];
    type DisputeItemWithResponses = LoggedDisputeWithRelations["items"][0];

    const logged = loggedDisputes.map((d: LoggedDisputeWithRelations) => {
      // Get first response from any item
      const firstItemWithResponse = d.items.find((i: DisputeItemWithResponses) => i.responses.length > 0);
      const response = firstItemWithResponse?.responses[0];
      const sentDateVal = d.sentDate || d.createdAt;
      const responseDate = response?.responseDate || d.respondedAt;
      const daysToRespond = responseDate ? differenceInDays(responseDate, sentDateVal) : null;
      const fcraViolation = daysToRespond === null || daysToRespond > 30;

      const deleted = d.items.filter((i: DisputeItemWithResponses) => i.outcome === "DELETED").length;
      const verified = d.items.filter((i: DisputeItemWithResponses) => i.outcome === "VERIFIED").length;
      const updated = d.items.filter((i: DisputeItemWithResponses) => i.outcome === "UPDATED").length;

      return {
        id: d.id,
        disputeId: d.id,
        clientId: d.client.id,
        clientName: d.client.firstName + " " + d.client.lastName,
        cra: d.cra,
        round: d.round,
        flow: d.flow,
        responseDate: responseDate?.toISOString() || null,
        daysToRespond,
        status: d.status,
        responseType: deleted > verified ? "DELETED" : verified > 0 ? "VERIFIED" : "NO_RESPONSE",
        results: { deleted, verified, updated },
        fcraViolation,
        nextAction: fcraViolation
          ? "Items deleted by operation of law"
          : deleted > 0
          ? "Success - continue to next round"
          : "Proceed to Round " + (d.round + 1),
      };
    });

    return NextResponse.json({ pending, logged });
  } catch (error) {
    console.error("Error fetching responses:", error);
    return NextResponse.json({ error: "Failed to fetch responses" }, { status: 500 });
  }
}
