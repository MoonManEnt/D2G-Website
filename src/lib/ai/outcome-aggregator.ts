/**
 * Amelia Outcome Aggregator
 *
 * Computes dispute outcome patterns per CRA/flow/creditor/accountType.
 * Stores results in AmeliaOutcomePattern table for AI consumption.
 *
 * Patterns are used to:
 * 1. Inform AI letter generation ("similar disputes have X% success rate")
 * 2. Surface insights on the dashboard
 * 3. Guide strategy recommendations
 */

import prisma from "@/lib/prisma";

/**
 * Aggregate outcome patterns for an organization.
 * Scans all completed disputes and computes success metrics.
 */
export async function aggregateOutcomePatterns(orgId: string): Promise<number> {
  // Fetch all disputes with outcomes
  const disputes = await prisma.dispute.findMany({
    where: {
      organizationId: orgId,
      status: {
        in: ["RESOLVED", "COMPLETED", "VERIFIED", "REJECTED"],
      },
    },
    select: {
      id: true,
      cra: true,
      flow: true,
      status: true,
      sentDate: true,
      respondedAt: true,
      resolvedAt: true,
      items: {
        select: {
          outcome: true,
          accountItem: {
            select: {
              creditorName: true,
              accountType: true,
            },
          },
        },
      },
    },
  });

  // Build pattern map: key = "cra|flow|creditorName|accountType"
  const patterns = new Map<
    string,
    {
      cra: string;
      flow: string;
      creditorName: string | null;
      accountType: string | null;
      totalDisputes: number;
      deletions: number;
      verifiedOnly: number;
      noResponse: number;
      resolutionDays: number[];
    }
  >();

  for (const dispute of disputes) {
    for (const item of dispute.items) {
      const creditorName = item.accountItem?.creditorName || null;
      const accountType = item.accountItem?.accountType || null;

      // Create pattern keys at two levels:
      // 1. CRA + flow + creditor (specific)
      // 2. CRA + flow (general)
      const keys = [
        `${dispute.cra}|${dispute.flow}|${creditorName}|${accountType}`,
        `${dispute.cra}|${dispute.flow}||`, // General pattern (no creditor/type)
      ];

      for (const key of keys) {
        if (!patterns.has(key)) {
          const [cra, flow, cn, at] = key.split("|");
          patterns.set(key, {
            cra,
            flow,
            creditorName: cn || null,
            accountType: at || null,
            totalDisputes: 0,
            deletions: 0,
            verifiedOnly: 0,
            noResponse: 0,
            resolutionDays: [],
          });
        }

        const p = patterns.get(key)!;
        p.totalDisputes++;

        // Classify outcome
        const outcome = item.outcome?.toUpperCase() || dispute.status;
        if (outcome === "DELETED" || outcome === "RESOLVED" || outcome === "COMPLETED") {
          p.deletions++;
        } else if (outcome === "VERIFIED") {
          p.verifiedOnly++;
        } else if (outcome === "NO_RESPONSE") {
          p.noResponse++;
        }

        // Calculate resolution days
        if (dispute.sentDate && (dispute.respondedAt || dispute.resolvedAt)) {
          const resolveDate = dispute.resolvedAt || dispute.respondedAt!;
          const days = Math.floor(
            (resolveDate.getTime() - dispute.sentDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (days > 0 && days < 365) {
            p.resolutionDays.push(days);
          }
        }
      }
    }
  }

  // Upsert patterns into database
  let upsertCount = 0;

  for (const [, pattern] of patterns) {
    const successRate =
      pattern.totalDisputes > 0
        ? (pattern.deletions / pattern.totalDisputes) * 100
        : 0;

    const avgDaysToResolve =
      pattern.resolutionDays.length > 0
        ? pattern.resolutionDays.reduce((a, b) => a + b, 0) / pattern.resolutionDays.length
        : null;

    const sampleSize = pattern.totalDisputes;
    const isReliable = sampleSize >= 10;

    await prisma.ameliaOutcomePattern.upsert({
      where: {
        organizationId_cra_flow_creditorName_accountType: {
          organizationId: orgId,
          cra: pattern.cra,
          flow: pattern.flow,
          creditorName: pattern.creditorName ?? "",
          accountType: pattern.accountType ?? "",
        },
      },
      create: {
        organizationId: orgId,
        cra: pattern.cra,
        flow: pattern.flow,
        creditorName: pattern.creditorName,
        accountType: pattern.accountType,
        totalDisputes: pattern.totalDisputes,
        deletions: pattern.deletions,
        verifiedOnly: pattern.verifiedOnly,
        noResponse: pattern.noResponse,
        successRate,
        avgDaysToResolve,
        sampleSize,
        isReliable,
        lastComputedAt: new Date(),
      },
      update: {
        totalDisputes: pattern.totalDisputes,
        deletions: pattern.deletions,
        verifiedOnly: pattern.verifiedOnly,
        noResponse: pattern.noResponse,
        successRate,
        avgDaysToResolve,
        sampleSize,
        isReliable,
        lastComputedAt: new Date(),
      },
    });

    upsertCount++;
  }

  return upsertCount;
}
