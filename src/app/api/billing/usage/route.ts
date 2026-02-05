import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SUBSCRIPTION_LIMITS } from "@/lib/api-middleware";
import { SubscriptionTier } from "@/types";
import { createLogger } from "@/lib/logger";

const log = createLogger("billing-usage-api");

export const dynamic = "force-dynamic";

const STORAGE_LIMITS: Record<string, number> = {
  FREE: 1 * 1024 * 1024 * 1024,
  STARTER: 5 * 1024 * 1024 * 1024,
  PROFESSIONAL: 25 * 1024 * 1024 * 1024,
  ENTERPRISE: -1,
};

const TEAM_LIMITS: Record<string, number> = {
  FREE: 1,
  STARTER: 3,
  PROFESSIONAL: 5,
  ENTERPRISE: -1,
};
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = (session.user as any).organizationId;
    const tier = ((session.user as any).subscriptionTier || "FREE") as string;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const tierLimits = SUBSCRIPTION_LIMITS[tier as SubscriptionTier] || SUBSCRIPTION_LIMITS[SubscriptionTier.FREE];

    const [clientCount, disputeCount, letterCount, reportCount, storageResult, teamCount] = await Promise.all([
      prisma.client.count({ where: { organizationId: orgId, isActive: true } }),
      prisma.dispute.count({ where: { organizationId: orgId, createdAt: { gte: startOfMonth } } }),
      prisma.document.count({ where: { organizationId: orgId, documentType: "DISPUTE_LETTER", createdAt: { gte: startOfMonth } } }),
      prisma.creditReport.count({ where: { organizationId: orgId, createdAt: { gte: startOfMonth } } }),
      prisma.storedFile.aggregate({ where: { organizationId: orgId }, _sum: { sizeBytes: true } }),
      prisma.user.count({ where: { organizationId: orgId, isActive: true } }),
    ]);
    const storageBytes = storageResult._sum.sizeBytes || 0;
    const storageLimitBytes = STORAGE_LIMITS[tier] ?? STORAGE_LIMITS.FREE;
    const teamLimit = TEAM_LIMITS[tier] ?? TEAM_LIMITS.FREE;

    const usage = {
      clients: { current: clientCount, limit: tierLimits.clients.total },
      disputes: { current: disputeCount, limit: tierLimits.disputes.monthly },
      letters: { current: letterCount, limit: tierLimits.letters.monthly },
      reports: { current: reportCount, limit: tierLimits.reports.monthly },
      storage: { currentBytes: storageBytes, limitBytes: storageLimitBytes },
      teamSeats: { current: teamCount, limit: teamLimit },
    };

    // Detect overflows
    const overflows: string[] = [];
    if (tierLimits.clients.total > 0 && clientCount >= tierLimits.clients.total) overflows.push("clients");
    if (tierLimits.disputes.monthly > 0 && disputeCount >= tierLimits.disputes.monthly) overflows.push("disputes");
    if (tierLimits.letters.monthly > 0 && letterCount >= tierLimits.letters.monthly) overflows.push("letters");
    if (tierLimits.reports.monthly > 0 && reportCount >= tierLimits.reports.monthly) overflows.push("reports");

    return NextResponse.json({ usage, tier, overflows });
  } catch (error) {
    log.error({ err: error }, "Failed to fetch usage stats");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
