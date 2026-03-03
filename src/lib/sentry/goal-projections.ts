/**
 * Goal Projections
 *
 * Calculates estimated time to reach credit score goals based on
 * historical score impact data and remaining disputable items.
 */

import prisma from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { SCORE_MILESTONES, type GoalProjection, type GoalMilestone } from "./types";

const log = createLogger("sentry-goal-projections");

/**
 * Calculate goal projection for a specific client goal.
 */
export async function calculateGoalProjection(
  clientId: string,
  goalId: string,
  organizationId: string
): Promise<GoalProjection | null> {
  try {
    const goal = await prisma.clientGoal.findUnique({
      where: { id: goalId },
    });

    if (!goal || goal.clientId !== clientId) return null;

    // Get score history for trend analysis
    const scoreHistory = await prisma.creditScore.findMany({
      where: {
        clientId,
        ...(goal.scoreCRA ? { cra: goal.scoreCRA } : {}),
      },
      orderBy: { scoreDate: "desc" },
      take: 12, // Last 12 data points
    });

    const currentScore = scoreHistory[0]?.score || goal.currentScore || 0;

    // Calculate average monthly gain from score impact records
    const scoreImpacts = await prisma.scoreImpactRecord.findMany({
      where: {
        clientId,
        organizationId,
        scoreChange: { not: null },
        outcome: "DELETED",
      },
      orderBy: { measuredAt: "desc" },
      take: 20,
    });

    let averagePointsPerDeletion = 0;
    if (scoreImpacts.length > 0) {
      const totalGain = scoreImpacts.reduce(
        (sum, impact) => sum + (impact.scoreChange || 0),
        0
      );
      averagePointsPerDeletion = totalGain / scoreImpacts.length;
    } else {
      // Fallback estimates based on account type
      averagePointsPerDeletion = 15; // Conservative default
    }

    // Count remaining disputable items
    const remainingItems = await prisma.accountItem.count({
      where: {
        clientId,
        isDisputable: true,
        isLockedInDispute: false,
      },
    });

    // Get average dispute success rate from outcome patterns
    const outcomePatterns = await prisma.ameliaOutcomePattern.findMany({
      where: { organizationId },
    });

    let avgSuccessRate = 0.35; // Default 35%
    if (outcomePatterns.length > 0) {
      const totalDisputes = outcomePatterns.reduce((s, p) => s + p.totalDisputes, 0);
      const totalDeletions = outcomePatterns.reduce((s, p) => s + p.deletions, 0);
      if (totalDisputes > 0) {
        avgSuccessRate = totalDeletions / totalDisputes;
      }
    }

    // Project points from remaining disputes
    const expectedDeletions = Math.round(remainingItems * avgSuccessRate);
    const projectedPointsFromDisputes = Math.round(
      expectedDeletions * averagePointsPerDeletion
    );

    // Calculate score difference needed
    const scoreNeeded = Math.max(0, goal.targetScore - currentScore);

    // Calculate months to goal
    // Each dispute round takes ~30-45 days, assume ~5 items per round
    const itemsPerRound = 5;
    const daysPerRound = 35;
    const roundsNeeded = Math.ceil(remainingItems / itemsPerRound);
    const estimatedDays = roundsNeeded * daysPerRound;
    const estimatedMonths = Math.max(1, Math.ceil(estimatedDays / 30));

    // If projected points aren't enough, adjust estimate
    let adjustedMonths = estimatedMonths;
    if (projectedPointsFromDisputes < scoreNeeded && projectedPointsFromDisputes > 0) {
      adjustedMonths = Math.ceil(
        estimatedMonths * (scoreNeeded / projectedPointsFromDisputes)
      );
    }

    // Calculate average monthly gain from score history
    let averageMonthlyGain = 0;
    if (scoreHistory.length >= 2) {
      const oldest = scoreHistory[scoreHistory.length - 1];
      const newest = scoreHistory[0];
      const monthsDiff = Math.max(
        1,
        (newest.scoreDate.getTime() - oldest.scoreDate.getTime()) /
          (1000 * 60 * 60 * 24 * 30)
      );
      averageMonthlyGain = (newest.score - oldest.score) / monthsDiff;
    }

    // Determine confidence
    let confidence: "LOW" | "MEDIUM" | "HIGH";
    if (scoreImpacts.length >= 10 && scoreHistory.length >= 4) {
      confidence = "HIGH";
    } else if (scoreImpacts.length >= 3 || scoreHistory.length >= 2) {
      confidence = "MEDIUM";
    } else {
      confidence = "LOW";
    }

    // Find next milestone
    const nextMilestone = SCORE_MILESTONES.find((m) => m.score > currentScore);

    const estimatedDate = new Date();
    estimatedDate.setMonth(estimatedDate.getMonth() + adjustedMonths);

    return {
      goalId,
      currentScore,
      targetScore: goal.targetScore,
      estimatedMonthsToGoal: adjustedMonths,
      estimatedDate,
      averageMonthlyGain: Math.round(averageMonthlyGain * 10) / 10,
      remainingDisputableItems: remainingItems,
      projectedPointsFromDisputes,
      confidence,
      nextMilestone,
    };
  } catch (error) {
    log.error({ err: error, clientId, goalId }, "Goal projection failed");
    return null;
  }
}

/**
 * Detect if a score change crosses a milestone threshold.
 */
export function detectMilestone(
  clientId: string,
  newScore: number,
  previousScore: number,
  goalId: string
): GoalMilestone | null {
  for (const milestone of SCORE_MILESTONES) {
    if (previousScore < milestone.score && newScore >= milestone.score) {
      return {
        score: milestone.score,
        name: milestone.name,
        description: milestone.description,
        achievedAt: new Date(),
      };
    }
  }
  return null;
}
