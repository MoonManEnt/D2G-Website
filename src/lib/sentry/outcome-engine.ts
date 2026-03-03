/**
 * Outcome Recording Pipeline
 *
 * Records dispute outcomes, updates aggregate pattern data,
 * and correlates score impacts. This is the learning engine
 * that makes Sentry Mode smarter over time.
 */

import prisma from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import type { OutcomeInput, ScoreImpactInput } from "./types";

const log = createLogger("sentry-outcome-engine");

// =============================================================================
// OUTCOME RECORDING
// =============================================================================

/**
 * Record a dispute outcome and update aggregate patterns.
 * Called when a DisputeResponse is saved.
 */
export async function recordOutcome(input: OutcomeInput): Promise<void> {
  try {
    // 1. Update or create AmeliaOutcomePattern aggregate
    const patternKey = buildPatternKey(input);

    const existing = await prisma.ameliaOutcomePattern.findFirst({
      where: {
        organizationId: input.organizationId,
        cra: input.cra,
        flow: input.flow,
        creditorName: input.creditorName,
      },
    });

    if (existing) {
      // Incremental aggregate update
      const updateData: Record<string, unknown> = {
        totalDisputes: { increment: 1 },
        sampleSize: { increment: 1 },
        updatedAt: new Date(),
      };

      switch (input.outcome) {
        case "DELETED":
          updateData.deletions = { increment: 1 };
          break;
        case "VERIFIED":
          updateData.verifiedOnly = { increment: 1 };
          break;
        case "NO_RESPONSE":
          updateData.noResponse = { increment: 1 };
          break;
      }

      // Update average days to resolve
      if (input.daysToRespond !== undefined && existing.avgDaysToResolve !== null) {
        const newTotal = existing.totalDisputes + 1;
        const currentAvg = existing.avgDaysToResolve || 0;
        const newAvg = (currentAvg * existing.totalDisputes + input.daysToRespond) / newTotal;
        updateData.avgDaysToResolve = Math.round(newAvg * 10) / 10;
      } else if (input.daysToRespond !== undefined) {
        updateData.avgDaysToResolve = input.daysToRespond;
      }

      // Recalculate success rate
      const newDeleted =
        input.outcome === "DELETED"
          ? existing.deletions + 1
          : existing.deletions;
      const newTotal = existing.totalDisputes + 1;
      updateData.successRate = Math.round((newDeleted / newTotal) * 100 * 100) / 100;
      updateData.isReliable = newTotal >= 10;
      updateData.lastComputedAt = new Date();

      // Update e-OSCAR code effectiveness via sentryCodeStats
      if (input.eoscarCodesUsed?.length) {
        const currentStats = existing.sentryCodeStats ? JSON.parse(existing.sentryCodeStats) : {};
        for (const code of input.eoscarCodesUsed) {
          if (!currentStats[code]) {
            currentStats[code] = { total: 0, deleted: 0, verified: 0 };
          }
          currentStats[code].total++;
          if (input.outcome === "DELETED") currentStats[code].deleted++;
          if (input.outcome === "VERIFIED") currentStats[code].verified++;
        }
        updateData.sentryCodeStats = JSON.stringify(currentStats);
      }

      await prisma.ameliaOutcomePattern.update({
        where: { id: existing.id },
        data: updateData,
      });
    } else {
      // Create new pattern record
      const isDeleted = input.outcome === "DELETED" ? 1 : 0;
      const isVerified = input.outcome === "VERIFIED" ? 1 : 0;
      const isNoResponse = input.outcome === "NO_RESPONSE" ? 1 : 0;

      const codeStats: Record<string, { total: number; deleted: number; verified: number }> = {};
      if (input.eoscarCodesUsed?.length) {
        for (const code of input.eoscarCodesUsed) {
          codeStats[code] = {
            total: 1,
            deleted: isDeleted,
            verified: isVerified,
          };
        }
      }

      await prisma.ameliaOutcomePattern.create({
        data: {
          organizationId: input.organizationId,
          cra: input.cra,
          flow: input.flow,
          creditorName: input.creditorName,
          totalDisputes: 1,
          deletions: isDeleted,
          verifiedOnly: isVerified,
          noResponse: isNoResponse,
          successRate: isDeleted * 100,
          sampleSize: 1,
          isReliable: false,
          avgDaysToResolve: input.daysToRespond || null,
          sentryCodeStats: JSON.stringify(codeStats),
        },
      });
    }

    // 2. Log to SentryActivityLog
    await prisma.sentryActivityLog.create({
      data: {
        organizationId: input.organizationId,
        clientId: input.clientId,
        activityType: "OUTCOME_RECORDED",
        summary: `${input.outcome} outcome recorded for ${input.creditorName} (${input.cra}, ${input.flow} R${input.round})`,
        details: JSON.stringify({
          disputeId: input.disputeId,
          accountItemId: input.accountItemId,
          outcome: input.outcome,
          eoscarCodes: input.eoscarCodesUsed,
          daysToRespond: input.daysToRespond,
        }),
        triggeredBy: "SENTRY_OUTCOME_ENGINE",
      },
    });

    log.info(
      {
        disputeId: input.disputeId,
        outcome: input.outcome,
        creditor: input.creditorName,
      },
      "Outcome recorded"
    );
  } catch (error) {
    log.error({ err: error, input }, "Failed to record outcome");
    throw error;
  }
}

// =============================================================================
// SCORE IMPACT CORRELATION
// =============================================================================

/**
 * Correlate an item removal with credit score changes.
 */
export async function correlateScoreImpact(
  input: ScoreImpactInput
): Promise<void> {
  try {
    await prisma.scoreImpactRecord.create({
      data: {
        clientId: input.clientId,
        accountItemId: input.accountItemId,
        organizationId: input.organizationId,
        outcome: input.outcome,
        cra: input.cra,
        scoreBefore: input.scoreBefore,
        scoreAfter: input.scoreAfter,
        scoreChange:
          input.scoreBefore !== undefined && input.scoreAfter !== undefined
            ? input.scoreAfter - input.scoreBefore
            : null,
        accountType: input.accountType,
        accountStatus: input.accountStatus,
        balance: input.balance,
        creditorName: input.creditorName,
        flow: input.flow,
        round: input.round,
      },
    });

    log.info(
      {
        clientId: input.clientId,
        outcome: input.outcome,
        scoreChange:
          input.scoreBefore && input.scoreAfter
            ? input.scoreAfter - input.scoreBefore
            : null,
      },
      "Score impact recorded"
    );
  } catch (error) {
    log.error({ err: error, input }, "Failed to record score impact");
    throw error;
  }
}

// =============================================================================
// PATTERN QUERIES
// =============================================================================

/**
 * Get outcome patterns for an organization, optionally filtered by CRA, flow, or creditor.
 */
export async function getOutcomePatterns(
  organizationId: string,
  cra?: string,
  flow?: string,
  creditor?: string
) {
  const where: Record<string, unknown> = { organizationId };
  if (cra) where.cra = cra;
  if (flow) where.flow = flow;
  if (creditor) where.creditorName = creditor;

  return prisma.ameliaOutcomePattern.findMany({
    where,
    orderBy: { totalDisputes: "desc" },
  });
}

/**
 * Build a furnisher profile from outcome patterns for use in success calculation.
 */
export async function buildFurnisherProfile(
  organizationId: string,
  creditorName: string
): Promise<{
  creditorName: string;
  totalDisputes: number;
  deletionRate: number;
  verificationRate: number;
  averageResponseDays: number;
  effectiveCodes: Array<{
    code: string;
    successRate: number;
    sampleSize: number;
    isReliable: boolean;
  }>;
} | null> {
  const patterns = await prisma.ameliaOutcomePattern.findMany({
    where: {
      organizationId,
      creditorName: {
        contains: creditorName,
        mode: "insensitive",
      },
    },
  });

  if (patterns.length === 0) return null;

  // Aggregate across all CRA/flow combinations for this creditor
  let totalDisputes = 0;
  let totalDeleted = 0;
  let totalVerified = 0;
  let totalDaysRespond = 0;
  let daysCount = 0;
  const codeAggregates: Record<string, { total: number; deleted: number }> = {};

  for (const pattern of patterns) {
    totalDisputes += pattern.totalDisputes;
    totalDeleted += pattern.deletions;
    totalVerified += pattern.verifiedOnly;
    if (pattern.avgDaysToResolve && pattern.avgDaysToResolve > 0) {
      totalDaysRespond += pattern.avgDaysToResolve * pattern.totalDisputes;
      daysCount += pattern.totalDisputes;
    }

    // Parse e-OSCAR code stats from sentryCodeStats
    const stats = JSON.parse(pattern.sentryCodeStats || "{}");
    for (const [code, data] of Object.entries(stats)) {
      const typedData = data as { total: number; deleted: number };
      if (!codeAggregates[code]) {
        codeAggregates[code] = { total: 0, deleted: 0 };
      }
      codeAggregates[code].total += typedData.total;
      codeAggregates[code].deleted += typedData.deleted;
    }
  }

  const effectiveCodes = Object.entries(codeAggregates).map(([code, data]) => ({
    code,
    successRate: data.total > 0 ? data.deleted / data.total : 0,
    sampleSize: data.total,
    isReliable: data.total >= 10,
  }));

  return {
    creditorName,
    totalDisputes,
    deletionRate: totalDisputes > 0 ? totalDeleted / totalDisputes : 0,
    verificationRate: totalDisputes > 0 ? totalVerified / totalDisputes : 0,
    averageResponseDays: daysCount > 0 ? totalDaysRespond / daysCount : 30,
    effectiveCodes: effectiveCodes.sort((a, b) => b.successRate - a.successRate),
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function buildPatternKey(input: OutcomeInput): string {
  return `${input.organizationId}:${input.cra}:${input.flow}:${input.creditorName}`;
}
