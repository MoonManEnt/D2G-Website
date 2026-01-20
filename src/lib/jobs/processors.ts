/**
 * Job Processors
 *
 * Implementations for background job processing.
 */

import { Job } from "bullmq";
import prisma from "../prisma";
import { addDays, differenceInDays, format } from "date-fns";
import {
  sendEmail,
  deadlineReminderEmail,
  scoreChangeEmail,
} from "../email";
import { getCreditScores } from "../credit-monitoring";

// =============================================================================
// DEADLINE REMINDERS
// =============================================================================

export async function processDeadlineReminders(job: Job): Promise<void> {
  console.log("[JOB] Processing deadline reminders...");

  // Find all disputes that are SENT and approaching deadline
  const sentDisputes = await prisma.dispute.findMany({
    where: {
      status: "SENT",
      sentDate: { not: null },
    },
    include: {
      client: true,
    },
  });

  const now = new Date();
  const remindersSent: string[] = [];

  for (const dispute of sentDisputes) {
    if (!dispute.sentDate) continue;

    // Calculate deadline (30 days from sent date)
    const deadline = addDays(new Date(dispute.sentDate), 30);
    const daysRemaining = differenceInDays(deadline, now);

    // Send reminders at 14, 7, 3, and 1 days
    if ([14, 7, 3, 1].includes(daysRemaining)) {
      const client = dispute.client;

      if (client.email) {
        const template = deadlineReminderEmail(
          `${client.firstName} ${client.lastName}`,
          dispute.cra,
          daysRemaining,
          format(new Date(dispute.sentDate), "MMMM d, yyyy"),
          format(deadline, "MMMM d, yyyy"),
          dispute.id
        );

        await sendEmail({
          to: client.email,
          template,
          tags: [{ name: "category", value: "deadline-reminder" }],
        });

        remindersSent.push(`${dispute.id}:${daysRemaining}d`);
      }
    }
  }

  console.log(`[JOB] Sent ${remindersSent.length} deadline reminders`);
}

// =============================================================================
// CREDIT SCORE SYNC
// =============================================================================

export async function syncCreditScores(job: Job): Promise<void> {
  console.log("[JOB] Syncing credit scores...");

  // Find all clients with credit monitoring enabled
  const clients = await prisma.client.findMany({
    where: {
      creditMonitoringId: { not: null },
      creditMonitoringStatus: "ACTIVE",
      isActive: true,
    },
  });

  let synced = 0;
  let errors = 0;

  for (const client of clients) {
    try {
      const result = await getCreditScores(client.creditMonitoringId!);

      if (result.success && result.scores) {
        for (const score of result.scores) {
          // Check if we already have this score
          const existing = await prisma.creditScore.findFirst({
            where: {
              clientId: client.id,
              cra: score.bureau,
              scoreDate: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Within last 24 hours
              },
            },
          });

          if (!existing) {
            // Get previous score for comparison
            const previousScore = await prisma.creditScore.findFirst({
              where: {
                clientId: client.id,
                cra: score.bureau,
              },
              orderBy: { scoreDate: "desc" },
            });

            // Create new score record
            await prisma.creditScore.create({
              data: {
                clientId: client.id,
                cra: score.bureau,
                score: score.score,
                source: "CREDIT_MONITORING",
                scoreDate: score.date,
              },
            });

            // Send notification if significant change
            if (previousScore && client.email) {
              const change = score.score - previousScore.score;
              if (Math.abs(change) >= 10) {
                const template = scoreChangeEmail(
                  `${client.firstName} ${client.lastName}`,
                  score.bureau,
                  previousScore.score,
                  score.score,
                  change
                );

                await sendEmail({
                  to: client.email,
                  template,
                  tags: [{ name: "category", value: "score-change" }],
                });
              }
            }

            synced++;
          }
        }
      }
    } catch (error) {
      console.error(`[JOB] Error syncing scores for client ${client.id}:`, error);
      errors++;
    }
  }

  console.log(`[JOB] Credit score sync complete: ${synced} new scores, ${errors} errors`);
}

// =============================================================================
// DAILY REPORT
// =============================================================================

export async function generateDailyReport(job: Job): Promise<void> {
  console.log("[JOB] Generating daily report...");

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get all organizations
  const organizations = await prisma.organization.findMany({
    where: {
      subscriptionStatus: "ACTIVE",
    },
    include: {
      users: {
        where: { role: "OWNER" },
        take: 1,
      },
    },
  });

  for (const org of organizations) {
    const owner = org.users[0];
    if (!owner) continue;

    // Gather stats for the organization
    const [
      newClients,
      newDisputes,
      resolvedDisputes,
      reportsUploaded,
    ] = await Promise.all([
      prisma.client.count({
        where: {
          organizationId: org.id,
          createdAt: { gte: yesterday, lt: today },
        },
      }),
      prisma.dispute.count({
        where: {
          organizationId: org.id,
          createdAt: { gte: yesterday, lt: today },
        },
      }),
      prisma.dispute.count({
        where: {
          organizationId: org.id,
          resolvedAt: { gte: yesterday, lt: today },
        },
      }),
      prisma.creditReport.count({
        where: {
          organizationId: org.id,
          uploadedAt: { gte: yesterday, lt: today },
        },
      }),
    ]);

    // Only send if there's activity
    if (newClients > 0 || newDisputes > 0 || resolvedDisputes > 0 || reportsUploaded > 0) {
      // TODO: Send daily summary email to owner
      console.log(`[JOB] Daily stats for ${org.name}:`, {
        newClients,
        newDisputes,
        resolvedDisputes,
        reportsUploaded,
      });
    }
  }

  console.log("[JOB] Daily report generation complete");
}

// =============================================================================
// FILE CLEANUP
// =============================================================================

export async function cleanupOldFiles(job: Job): Promise<void> {
  console.log("[JOB] Cleaning up old files...");

  // Files older than 90 days that aren't associated with active resources
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);

  // Find orphaned files
  const orphanedFiles = await prisma.storedFile.findMany({
    where: {
      createdAt: { lt: cutoffDate },
      AND: [
        { originalReports: { none: {} } },
        { generatedDocuments: { none: {} } },
        { evidenceRendered: { none: {} } },
        { evidenceSources: { none: {} } },
        { clientDocuments: { none: {} } },
      ],
    },
  });

  console.log(`[JOB] Found ${orphanedFiles.length} orphaned files to clean up`);

  // TODO: Actually delete files from storage
  // For now, just log them

  console.log("[JOB] File cleanup complete");
}

// =============================================================================
// REGISTER ALL PROCESSORS
// =============================================================================

import { registerProcessor, JOB_TYPES } from "./index";

export function registerAllProcessors(): void {
  registerProcessor(JOB_TYPES.PROCESS_DEADLINE_REMINDERS, processDeadlineReminders, "scheduled");
  registerProcessor(JOB_TYPES.SYNC_CREDIT_SCORES, syncCreditScores, "scheduled");
  registerProcessor(JOB_TYPES.GENERATE_DAILY_REPORT, generateDailyReport, "scheduled");
  registerProcessor(JOB_TYPES.CLEANUP_OLD_FILES, cleanupOldFiles, "scheduled");

  console.log("[JOBS] All processors registered");
}
