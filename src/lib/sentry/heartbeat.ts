/**
 * Sentry Heartbeat
 *
 * Triggered when a new credit report is uploaded for a Sentry-enabled client.
 * Runs the full feedback loop: diff → outcome recording → score correlation →
 * goal milestone detection → auto-escalation → notifications.
 */

import prisma from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { recordOutcome, correlateScoreImpact } from "./outcome-engine";
import { handleAutoEscalation } from "./auto-escalation";
import { detectMilestone } from "./goal-projections";
import type { HeartbeatResult } from "./types";

const log = createLogger("sentry-heartbeat");

export async function triggerSentryHeartbeat({
  clientId,
  reportId,
  organizationId,
  userId,
}: {
  clientId: string;
  reportId: string;
  organizationId: string;
  userId: string;
}): Promise<HeartbeatResult> {
  const result: HeartbeatResult = {
    processed: false,
    outcomesRecorded: 0,
    scoresUpdated: 0,
    milestonesDetected: [],
    autoEscalations: 0,
    notificationsSent: 0,
  };

  try {
    // Step 1: Check if client has Sentry Mode enabled
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { sentryModeEnabled: true, firstName: true, lastName: true },
    });

    if (!client?.sentryModeEnabled) {
      log.info({ clientId }, "Sentry Mode not enabled — skipping heartbeat");
      return result;
    }

    // Step 2: Find diff results between this report and prior
    const diffResults = await prisma.diffResult.findMany({
      where: { newReportId: reportId },
      include: {
        changes: {
          include: {
            oldAccount: true,
            newAccount: true,
          },
        },
      },
    });

    // Step 3: Find active disputes for this client
    const activeDisputes = await prisma.dispute.findMany({
      where: {
        clientId,
        status: { in: ["SENT", "RESPONDED"] },
      },
      include: {
        items: {
          include: {
            accountItem: true,
            responses: true,
          },
        },
      },
    });

    // Step 4: Map diff results to outcomes
    for (const diff of diffResults) {
      for (const change of diff.changes) {
        if (!change.oldAccount) continue;

        // Find if this account was in an active dispute
        const matchingDispute = activeDisputes.find((d) =>
          d.items.some((item) => item.accountItemId === change.oldAccountId)
        );

        if (!matchingDispute) continue;

        const matchingItem = matchingDispute.items.find(
          (item) => item.accountItemId === change.oldAccountId
        );
        if (!matchingItem) continue;

        // Skip if already has a response recorded
        if (matchingItem.responses.length > 0) continue;

        // Determine outcome from diff
        let outcome: "DELETED" | "VERIFIED" | "UPDATED" | undefined;

        if (change.changeType === "REMOVED") {
          outcome = "DELETED";
        } else if (change.changeType === "MODIFIED") {
          outcome = "UPDATED";
        } else if (change.changeType === "UNCHANGED") {
          // If dispute was sent 30+ days ago and account unchanged, it's VERIFIED
          const sentDate = matchingDispute.sentDate;
          if (sentDate) {
            const daysSinceSent = Math.floor(
              (Date.now() - sentDate.getTime()) / (1000 * 60 * 60 * 24)
            );
            if (daysSinceSent >= 30) {
              outcome = "VERIFIED";
            }
          }
        }

        if (!outcome) continue;

        // Get Sentry analysis for e-OSCAR codes
        const sentryAnalysis = await prisma.sentryAnalysis.findUnique({
          where: { disputeId: matchingDispute.id },
        });

        const eoscarCodes = sentryAnalysis
          ? JSON.parse(sentryAnalysis.eoscarCodes)
          : [];

        // Record outcome
        await recordOutcome({
          disputeId: matchingDispute.id,
          disputeItemId: matchingItem.id,
          accountItemId: change.oldAccountId!,
          clientId,
          organizationId,
          creditorName: change.oldAccount.creditorName,
          cra: matchingDispute.cra,
          flow: matchingDispute.flow,
          round: matchingDispute.round,
          outcome,
          eoscarCodesUsed: eoscarCodes,
          successProbabilityAtGeneration: sentryAnalysis?.successProbability,
        });

        result.outcomesRecorded++;
      }
    }

    // Step 5: Extract and save credit scores from parsed report
    const report = await prisma.creditReport.findUnique({
      where: { id: reportId },
      select: { creditScoresExtracted: true },
    });

    if (report?.creditScoresExtracted) {
      const scores = JSON.parse(report.creditScoresExtracted);
      const previousScores: Record<string, number> = {};

      for (const [cra, scoreData] of Object.entries(scores)) {
        const data = scoreData as { score?: number; model?: string };
        if (!data.score) continue;

        // Get previous score for comparison
        const prevScore = await prisma.creditScore.findFirst({
          where: { clientId, cra },
          orderBy: { scoreDate: "desc" },
        });
        if (prevScore) previousScores[cra] = prevScore.score;

        // Save new score
        await prisma.creditScore.create({
          data: {
            clientId,
            cra,
            score: data.score,
            scoreDate: new Date(),
            source: "REPORT_PARSE",
          },
        });
        result.scoresUpdated++;

        // Correlate score impact for recently resolved items
        if (prevScore && data.score !== prevScore.score) {
          const recentOutcomes = await prisma.disputeItem.findMany({
            where: {
              dispute: { clientId, cra, status: { in: ["RESPONDED", "RESOLVED"] } },
              outcome: "DELETED",
            },
            include: { accountItem: true, dispute: true },
            orderBy: { createdAt: "desc" },
            take: 5,
          });

          for (const item of recentOutcomes) {
            await correlateScoreImpact({
              clientId,
              accountItemId: item.accountItemId,
              organizationId,
              outcome: "DELETED",
              cra,
              scoreBefore: prevScore.score,
              scoreAfter: data.score,
              accountType: item.accountItem.accountType || undefined,
              accountStatus: item.accountItem.accountStatus,
              balance: item.accountItem.balance || undefined,
              creditorName: item.accountItem.creditorName,
              flow: item.dispute.flow,
              round: item.dispute.round,
            });
          }
        }

        // Step 6: Check goal milestones
        if (prevScore) {
          const goals = await prisma.clientGoal.findMany({
            where: { clientId, status: "ACTIVE" },
          });

          for (const goal of goals) {
            if (goal.scoreCRA && goal.scoreCRA !== cra) continue;

            const milestone = detectMilestone(
              clientId,
              data.score,
              prevScore.score,
              goal.id
            );

            if (milestone) {
              result.milestonesDetected.push(milestone.name);

              // Update goal milestones
              const currentMilestones = JSON.parse(goal.milestones);
              currentMilestones.push({
                ...milestone,
                achievedAt: new Date().toISOString(),
              });

              await prisma.clientGoal.update({
                where: { id: goal.id },
                data: {
                  currentScore: data.score,
                  milestones: JSON.stringify(currentMilestones),
                  ...(data.score >= goal.targetScore
                    ? { status: "ACHIEVED", achievedAt: new Date() }
                    : {}),
                },
              });
            }
          }
        }
      }
    }

    // Step 7: Auto-escalate verified items
    for (const dispute of activeDisputes) {
      const verifiedItemIds = dispute.items
        .filter((item) => item.outcome === "VERIFIED")
        .map((item) => item.id);

      if (verifiedItemIds.length > 0) {
        const escalation = await handleAutoEscalation({
          disputeId: dispute.id,
          clientId,
          organizationId,
          verifiedItemIds,
        });

        if (escalation.escalated) {
          result.autoEscalations += escalation.draftsCreated;
        }
        if (escalation.notificationSent) {
          result.notificationsSent++;
        }
      }
    }

    // Step 8: Log everything
    await prisma.sentryActivityLog.create({
      data: {
        organizationId,
        clientId,
        activityType: "HEARTBEAT",
        summary: `Heartbeat: ${result.outcomesRecorded} outcomes, ${result.scoresUpdated} scores, ${result.milestonesDetected.length} milestones, ${result.autoEscalations} escalations`,
        details: JSON.stringify(result),
        triggeredBy: userId,
      },
    });

    result.processed = true;
    log.info({ clientId, result }, "Heartbeat complete");

    return result;
  } catch (error) {
    log.error({ err: error, clientId, reportId }, "Heartbeat failed");
    return result;
  }
}
