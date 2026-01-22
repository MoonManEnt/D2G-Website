import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const organizationId = session.user.organizationId;

        // Fetch all clients with their dispute and account stats
        const clients = await prisma.client.findMany({
            where: {
                organizationId: organizationId,
                isActive: true,
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                // Accounts that are disputable
                accounts: {
                    where: {
                        isDisputable: true,
                        // Filter out accounts that are currently in an active dispute
                        disputes: {
                            none: {
                                dispute: {
                                    status: { notIn: ["RESOLVED", "CANCELLED"] }
                                }
                            }
                        }
                    },
                    select: { id: true, cra: true }
                },
                // Active disputes
                disputes: {
                    select: {
                        id: true,
                        status: true,
                        sentDate: true,
                        cra: true,
                        round: true,
                    }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        // Transform data for the workbench
        const workbenchData = clients.map(client => {
            // 1. Ready for Dispute (New Items)
            const readyItems = client.accounts.length;

            // 2. Needs Response (Sent > 30 days or Responded status)
            const needsResponseDisputes = client.disputes.filter(d => {
                const isResponded = d.status === "RESPONDED";
                const isOverdue = d.status === "SENT" && d.sentDate &&
                    (new Date().getTime() - new Date(d.sentDate).getTime() > 30 * 24 * 60 * 60 * 1000); // > 30 days
                return isResponded || isOverdue;
            });

            // 3. Active Disputes (Total in progress)
            const activeDisputes = client.disputes.filter(d =>
                ["APPROVED", "SENT", "RESPONDED"].includes(d.status)
            );

            return {
                id: client.id,
                name: `${client.firstName} ${client.lastName}`,
                stats: {
                    readyItems,
                    activeDisputes: activeDisputes.length,
                    needsResponse: needsResponseDisputes.length,
                    totalResolved: client.disputes.filter(d => d.status === "RESOLVED").length
                },
                // Quick access to overdue disputes
                urgentActions: needsResponseDisputes.map(d => ({
                    id: d.id,
                    cra: d.cra,
                    round: d.round,
                    reason: d.status === "RESPONDED" ? "Response Received" : "Overdue (30+ days)"
                }))
            };
        });

        // Sort by priority (needs response > ready items > active)
        const sortedData = workbenchData.sort((a, b) => {
            // Priority 1: Needs Response
            if (b.stats.needsResponse !== a.stats.needsResponse) {
                return b.stats.needsResponse - a.stats.needsResponse;
            }
            // Priority 2: Ready Items
            if (b.stats.readyItems !== a.stats.readyItems) {
                return b.stats.readyItems - a.stats.readyItems;
            }
            return 0; // Keep existing order
        });

        return NextResponse.json({
            clients: sortedData,
            summary: {
                totalReady: sortedData.reduce((acc, c) => acc + c.stats.readyItems, 0),
                totalNeedsResponse: sortedData.reduce((acc, c) => acc + c.stats.needsResponse, 0),
                totalActive: sortedData.reduce((acc, c) => acc + c.stats.activeDisputes, 0)
            }
        });

    } catch (error) {
        console.error("Workbench API Error:", error);
        return NextResponse.json({ error: "Failed to fetch workbench stats" }, { status: 500 });
    }
}
