/**
 * Amelia Recommendation Engine
 *
 * Scans all active clients in an organization and generates actionable
 * recommendations for the dashboard. Results are cached in AmeliaRecommendationCache.
 *
 * Recommendation Types:
 * - ACTION_NEEDED: CRA response overdue (30+ days), needs follow-up
 * - MILESTONE: Score improvement (20+ points), celebrate and plan next steps
 * - WARNING: Stale client (30+ days no activity), risk of losing progress
 * - OPPORTUNITY: Credit readiness trigger, vendor referral opportunity
 */

import prisma from "@/lib/prisma";

export type RecommendationType = "ACTION_NEEDED" | "MILESTONE" | "WARNING" | "OPPORTUNITY";
export type RecommendationPriority = "HIGH" | "MEDIUM" | "LOW";

export interface Recommendation {
  type: RecommendationType;
  priority: RecommendationPriority;
  title: string;
  description: string;
  clientId: string;
  clientName: string;
  disputeId?: string;
  actionUrl: string;
  metadata?: Record<string, unknown>;
}

/**
 * Compute recommendations for all active clients in an organization.
 * Stores results in AmeliaRecommendationCache for instant dashboard load.
 */
export async function computeRecommendationsForOrg(orgId: string): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [];

  // Fetch all active clients with their disputes and scores
  const clients = await prisma.client.findMany({
    where: {
      organizationId: orgId,
      isActive: true,
      archivedAt: null,
    },
    include: {
      disputes: {
        where: { status: { not: "CANCELLED" } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          cra: true,
          flow: true,
          round: true,
          status: true,
          sentDate: true,
          deadlineDate: true,
          respondedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      creditScores: {
        orderBy: { scoreDate: "desc" },
        take: 6,
        select: {
          cra: true,
          score: true,
          scoreDate: true,
        },
      },
    },
  });

  const now = new Date();

  for (const client of clients) {
    const clientName = `${client.firstName} ${client.lastName}`;

    // 1. Check for overdue CRA responses (30+ days since sent, no response)
    for (const dispute of client.disputes) {
      if (
        dispute.status === "SENT" &&
        dispute.sentDate &&
        !dispute.respondedAt
      ) {
        const daysSinceSent = Math.floor(
          (now.getTime() - dispute.sentDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceSent >= 30) {
          recommendations.push({
            type: "ACTION_NEEDED",
            priority: "HIGH",
            title: `${dispute.cra} response overdue`,
            description: `${clientName}'s R${dispute.round} ${dispute.flow} dispute to ${dispute.cra} was sent ${daysSinceSent} days ago with no response. FCRA requires a response within 30 days — this is a violation.`,
            clientId: client.id,
            clientName,
            disputeId: dispute.id,
            actionUrl: `/clients/${client.id}`,
            metadata: { daysSinceSent, cra: dispute.cra, round: dispute.round },
          });
        }
      }
    }

    // 2. Check for score improvements (20+ points)
    const scoresByCRA = new Map<string, { score: number; date: Date }[]>();
    for (const s of client.creditScores) {
      const cra = s.cra;
      if (!scoresByCRA.has(cra)) scoresByCRA.set(cra, []);
      scoresByCRA.get(cra)!.push({ score: s.score, date: s.scoreDate });
    }

    for (const [cra, entries] of scoresByCRA) {
      if (entries.length >= 2) {
        const latest = entries[0];
        const previous = entries[1];
        const diff = latest.score - previous.score;

        if (diff >= 20) {
          recommendations.push({
            type: "MILESTONE",
            priority: "MEDIUM",
            title: `${cra} score jumped +${diff} points`,
            description: `${clientName}'s ${cra} score increased from ${previous.score} to ${latest.score}. Great progress! Consider checking credit readiness for new opportunities.`,
            clientId: client.id,
            clientName,
            actionUrl: `/clients/${client.id}`,
            metadata: { cra, previousScore: previous.score, currentScore: latest.score, diff },
          });
        }
      }
    }

    // 3. Check for stale clients (30+ days no activity)
    const lastActivity = client.lastActivityAt || client.updatedAt;
    const daysSinceActivity = Math.floor(
      (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceActivity >= 30 && client.stage !== "COMPLETED") {
      recommendations.push({
        type: "WARNING",
        priority: "MEDIUM",
        title: `${clientName} has been inactive`,
        description: `No activity for ${daysSinceActivity} days. Client is in ${client.stage} stage with ${client.totalDisputesSent} disputes sent. Consider reaching out to prevent loss of momentum.`,
        clientId: client.id,
        clientName,
        actionUrl: `/clients/${client.id}`,
        metadata: { daysSinceActivity, stage: client.stage },
      });
    }

    // 4. Check for credit readiness opportunities
    // If score is 620+ on any bureau and client has active disputes resolving
    const highestScore = Math.max(
      ...client.creditScores.map((s) => s.score),
      0
    );

    if (highestScore >= 620 && client.stage !== "COMPLETED") {
      const hasRecentDeletions = client.totalItemsDeleted > 0;
      if (hasRecentDeletions) {
        recommendations.push({
          type: "OPPORTUNITY",
          priority: "LOW",
          title: `${clientName} may qualify for credit products`,
          description: `Score of ${highestScore} with ${client.totalItemsDeleted} items deleted. Run a credit readiness analysis to identify opportunities.`,
          clientId: client.id,
          clientName,
          actionUrl: `/clients/${client.id}`,
          metadata: { highestScore, itemsDeleted: client.totalItemsDeleted },
        });
      }
    }
  }

  // Sort by priority: HIGH > MEDIUM > LOW
  const priorityOrder: Record<RecommendationPriority, number> = {
    HIGH: 0,
    MEDIUM: 1,
    LOW: 2,
  };

  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Cache the results
  await cacheRecommendations(orgId, recommendations);

  return recommendations;
}

/**
 * Store recommendations in cache with 24-hour expiry.
 */
async function cacheRecommendations(
  orgId: string,
  recommendations: Recommendation[]
): Promise<void> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Delete existing org-wide cache
  await prisma.ameliaRecommendationCache.deleteMany({
    where: {
      organizationId: orgId,
      cacheType: "DASHBOARD",
    },
  });

  // Store fresh recommendations
  if (recommendations.length > 0) {
    await prisma.ameliaRecommendationCache.create({
      data: {
        organizationId: orgId,
        cacheType: "DASHBOARD",
        content: JSON.stringify(recommendations),
        priority: recommendations[0]?.priority || "MEDIUM",
        expiresAt,
      },
    });
  }
}

/**
 * Retrieve cached recommendations. Returns null if cache is expired or missing.
 */
export async function getCachedRecommendations(
  orgId: string
): Promise<Recommendation[] | null> {
  const cached = await prisma.ameliaRecommendationCache.findFirst({
    where: {
      organizationId: orgId,
      cacheType: "DASHBOARD",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!cached) return null;

  try {
    return JSON.parse(cached.content) as Recommendation[];
  } catch {
    return null;
  }
}
