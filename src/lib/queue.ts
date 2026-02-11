// Background job queue using Bull (Redis-based)
// For production, ensure Redis is configured via REDIS_URL

import type { Job, Queue as BullQueue, Worker as BullWorker } from "bullmq";
import { createLogger } from "./logger";
const log = createLogger("queue");

// Job types
export type JobType =
  | "parse-credit-report"
  | "generate-dispute-letter"
  | "send-email"
  | "send-sms"
  | "check-dispute-deadlines"
  | "sync-credit-scores"
  | "cleanup-old-files";

export interface JobData {
  "parse-credit-report": {
    reportId: string;
    organizationId: string;
    clientId: string;
    actorId: string;
    actorEmail: string;
    storagePath: string;
    fileBuffer?: string; // Base64 encoded buffer for in-memory processing
    useAIParsing?: boolean;
    fileType?: "PDF" | "PNG" | "JPG" | "JPEG" | "WEBP";
  };
  "generate-dispute-letter": {
    disputeId: string;
    organizationId: string;
  };
  "send-email": {
    to: string;
    template: string;
    data: Record<string, unknown>;
  };
  "send-sms": {
    to: string;
    message: string;
  };
  "check-dispute-deadlines": {
    organizationId?: string;
  };
  "sync-credit-scores": {
    clientId: string;
  };
  "cleanup-old-files": {
    olderThanDays: number;
  };
}

// Queue instances (lazy initialized)
let queues: Map<JobType, BullQueue> | null = null;
let workers: Map<JobType, BullWorker> | null = null;

// Check if Redis is configured
function isQueueEnabled(): boolean {
  return !!process.env.REDIS_URL;
}

// Enforce Redis in production
function enforceRedisInProduction(): void {
  if (process.env.NODE_ENV === "production" && !isQueueEnabled()) {
    const errorMsg = "CRITICAL: REDIS_URL not configured in production. Background job queue requires Redis for reliable processing. Set REDIS_URL environment variable.";
    log.error(errorMsg);
    throw new Error(errorMsg);
  }
}

// Get Redis connection options
function getRedisConnection() {
  const url = process.env.REDIS_URL || "redis://localhost:6379";

  // Parse Redis URL
  const parsed = new URL(url);

  return {
    host: parsed.hostname,
    port: parseInt(parsed.port) || 6379,
    password: parsed.password || undefined,
    username: parsed.username || undefined,
  };
}

/**
 * Initialize queue system
 * Call this on server startup
 */
export async function initializeQueues(): Promise<void> {
  // In production, Redis is required - fail fast if not configured
  enforceRedisInProduction();

  if (!isQueueEnabled()) {
    log.warn("Redis not configured. Background jobs will run synchronously (development only).");
    return;
  }

  try {
    const { Queue, Worker } = await import("bullmq");
    const connection = getRedisConnection();

    queues = new Map();
    workers = new Map();

    // Create queues for each job type
    const jobTypes: JobType[] = [
      "parse-credit-report",
      "generate-dispute-letter",
      "send-email",
      "send-sms",
      "check-dispute-deadlines",
      "sync-credit-scores",
      "cleanup-old-files",
    ];

    for (const type of jobTypes) {
      const queue = new Queue(type, { connection });
      queues.set(type, queue);

      // Create workers
      const worker = new Worker(
        type,
        async (job: Job) => {
          await processJob(type, job.data);
        },
        {
          connection,
          concurrency: type === "parse-credit-report" ? 2 : 5,
        }
      );

      worker.on("completed", (job: Job) => {
        log.info({ type, id: job.id }, "Job : completed");
      });

      worker.on("failed", (job: Job | undefined, error: Error) => {
        log.error({ err: error }, "Job : failed");
      });

      workers.set(type, worker);
    }

    log.info("Background job queues initialized");
  } catch (error) {
    log.error({ err: error }, "Failed to initialize queues");
  }
}

/**
 * Add a job to the queue
 */
export async function addJob<T extends JobType>(
  type: T,
  data: JobData[T],
  options?: {
    delay?: number; // Delay in ms
    priority?: number; // Lower = higher priority
    attempts?: number; // Retry attempts
    removeOnComplete?: boolean;
  }
): Promise<string | null> {
  // If queues not initialized, run synchronously
  if (!queues || !queues.has(type)) {
    log.info({ type }, "Running job synchronously");
    await processJob(type, data);
    return null;
  }

  const queue = queues.get(type)!;

  const job = await queue.add(type, data, {
    delay: options?.delay,
    priority: options?.priority,
    attempts: options?.attempts || 3,
    removeOnComplete: options?.removeOnComplete ?? true,
    removeOnFail: false,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  });

  return job.id || null;
}

/**
 * Process a job (called by worker or synchronously)
 */
async function processJob<T extends JobType>(
  type: T,
  data: JobData[T]
): Promise<void> {
  switch (type) {
    case "parse-credit-report":
      await handleParseCreditReport(data as JobData["parse-credit-report"]);
      break;

    case "generate-dispute-letter":
      await handleGenerateDisputeLetter(data as JobData["generate-dispute-letter"]);
      break;

    case "send-email":
      await handleSendEmail(data as JobData["send-email"]);
      break;

    case "send-sms":
      await handleSendSMS(data as JobData["send-sms"]);
      break;

    case "check-dispute-deadlines":
      await handleCheckDeadlines(data as JobData["check-dispute-deadlines"]);
      break;

    case "sync-credit-scores":
      await handleSyncCreditScores(data as JobData["sync-credit-scores"]);
      break;

    case "cleanup-old-files":
      await handleCleanupFiles(data as JobData["cleanup-old-files"]);
      break;

    default:
      log.warn({ type }, "Unknown job type");
  }
}

// ============================================
// Job Handlers
// ============================================

async function handleParseCreditReport(data: JobData["parse-credit-report"]) {
  const prisma = (await import("./prisma")).default;

  try {
    log.info({ reportId: data.reportId, useAI: data.useAIParsing }, "[QUEUE] Starting background parse job");

    // Get buffer from storage or from passed-in base64
    let pdfBuffer: Buffer | undefined;

    if (data.fileBuffer) {
      // Buffer was passed directly (for recently uploaded files)
      pdfBuffer = Buffer.from(data.fileBuffer, "base64");
    } else if (data.storagePath) {
      // Fetch from storage
      const { getFile } = await import("./storage");
      const file = await getFile(data.storagePath);
      if (file) {
        pdfBuffer = file.buffer;
      }
    }

    if (!pdfBuffer && data.storagePath) {
      // Try fetching from URL (for Vercel Blob or cloud storage)
      if (data.storagePath.startsWith("http")) {
        const response = await fetch(data.storagePath);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          pdfBuffer = Buffer.from(arrayBuffer);
        }
      }
    }

    if (!pdfBuffer) {
      throw new Error("Could not retrieve file buffer from storage");
    }

    // Use the unified parser (handles both legacy and AI parsing)
    let parseResult;

    if (data.useAIParsing || (data.fileType && data.fileType !== "PDF")) {
      // Use AI parser for images or when explicitly requested
      const { parseAndAnalyzeReportAI } = await import("./report-parser");
      parseResult = await parseAndAnalyzeReportAI({
        reportId: data.reportId,
        organizationId: data.organizationId,
        clientId: data.clientId,
        actorId: data.actorId,
        actorEmail: data.actorEmail,
        fileBuffer: pdfBuffer,
        fileType: data.fileType || "PDF",
      });
    } else {
      // Use standard PDF parser
      const { parseAndAnalyzeReport } = await import("./report-parser");
      parseResult = await parseAndAnalyzeReport({
        reportId: data.reportId,
        organizationId: data.organizationId,
        clientId: data.clientId,
        actorId: data.actorId,
        actorEmail: data.actorEmail,
        pdfBuffer,
      });
    }

    log.info({
      reportId: data.reportId,
      success: parseResult.success,
      accounts: parseResult.accountsParsed,
    }, "[QUEUE] Parse job completed");

    // Send SMS notification if client has phone
    if (parseResult.success) {
      const report = await prisma.creditReport.findUnique({
        where: { id: data.reportId },
        include: { client: { select: { phone: true } } },
      });

      if (report?.client?.phone) {
        const { sendReportUploadedSMS } = await import("./sms");
        await sendReportUploadedSMS(report.client.phone, parseResult.accountsParsed);
      }
    }
  } catch (error) {
    log.error({ err: error, reportId: data.reportId }, "[QUEUE] Parse job failed");

    // Mark as failed (parseAndAnalyzeReport already does this, but as a safety net)
    await prisma.creditReport.update({
      where: { id: data.reportId },
      data: {
        parseStatus: "FAILED",
        parseError: error instanceof Error ? error.message : "Unknown error",
      },
    });

    throw error; // Re-throw for retry logic
  }
}

async function handleGenerateDisputeLetter(data: JobData["generate-dispute-letter"]) {
  const prisma = (await import("./prisma")).default;
  const { generateDisputeLetter } = await import("./llm-orchestrator");

  try {
    // Get the dispute with related data
    const dispute = await prisma.dispute.findUnique({
      where: { id: data.disputeId },
      include: {
        client: true,
        items: {
          include: {
            accountItem: true,
          },
        },
      },
    });

    if (!dispute || !dispute.client) {
      throw new Error("Dispute or client not found");
    }

    // Prepare accounts data for LLM
    const accounts = dispute.items.map((item) => ({
      creditorName: item.accountItem?.creditorName || "Unknown",
      accountNumber: item.accountItem?.maskedAccountId,
      accountType: item.accountItem?.accountType || undefined,
      balance: item.accountItem?.balance ? Number(item.accountItem.balance) : undefined,
      issues: item.accountItem?.detectedIssues
        ? JSON.parse(item.accountItem.detectedIssues as string)
        : [item.disputeReason || "Inaccurate reporting"],
    }));

    // Validate required client fields
    const client = dispute.client;
    if (!client.addressLine1 || !client.city || !client.state || !client.zipCode) {
      throw new Error("Client address information is incomplete");
    }

    // Generate the letter using LLM
    const result = await generateDisputeLetter(
      {
        clientName: `${client.firstName} ${client.lastName}`,
        clientAddress: client.addressLine1,
        clientCity: client.city,
        clientState: client.state,
        clientZip: client.zipCode,
        clientSSNLast4: client.ssnLast4 || undefined,
        clientDOB: client.dateOfBirth?.toISOString().split("T")[0],
        cra: dispute.cra as "EQUIFAX" | "EXPERIAN" | "TRANSUNION",
        accounts,
        flow: dispute.flow as "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO" | "METRO2",
        round: dispute.round,
      },
      data.organizationId
    );

    // Update the dispute with the generated letter
    await prisma.dispute.update({
      where: { id: data.disputeId },
      data: {
        letterContent: result.letterContent,
        status: "DRAFT",
      },
    });

    // Log the event
    await prisma.eventLog.create({
      data: {
        eventType: "LETTER_GENERATED",
        targetType: "DISPUTE",
        targetId: data.disputeId,
        organizationId: data.organizationId,
        eventData: JSON.stringify({ llmRequestId: result.requestId }),
      },
    });

    log.info({ disputeId: data.disputeId }, "Letter generated for dispute");
  } catch (error) {
    log.error({ err: error }, "Error generating dispute letter");

    // Update dispute status to indicate error
    await prisma.dispute.update({
      where: { id: data.disputeId },
      data: {
        status: "DRAFT",
        letterContent: `[Error generating letter: ${error instanceof Error ? error.message : "Unknown error"}. Please generate manually.]`,
      },
    });

    throw error;
  }
}

async function handleSendEmail(data: JobData["send-email"]) {
  const { sendEmail } = await import("./email");

  try {
    // Use the generic sendEmail function with template data
    // The template field determines the email subject, and data contains the content
    const subjectMap: Record<string, string> = {
      "dispute-created": "Your dispute has been created",
      "dispute-sent": "Your dispute letter has been sent",
      "dispute-resolved": "Dispute resolution update",
      "deadline-reminder": "Dispute deadline reminder",
      "welcome": "Welcome to Dispute2Go",
      "payment-success": "Payment confirmed",
      "payment-failed": "Payment failed",
    };

    const subject = subjectMap[data.template] || data.data.subject as string || "Notification from Dispute2Go";

    // Build HTML content from template data
    const html = data.data.html as string || buildEmailHtml(data.template, data.data);
    const text = data.data.text as string || buildEmailText(data.template, data.data);

    await sendEmail({
      to: data.to,
      template: {
        subject,
        html,
        text,
      },
    });

    log.info({ template: data.template, to: data.to }, "Email sent: to");
  } catch (error) {
    log.error({ err: error }, "Failed to send email to");
    throw error;
  }
}

function buildEmailHtml(template: string, data: Record<string, unknown>): string {
  const clientName = data.clientName as string || "Valued Customer";
  const cra = data.cra as string || "";

  switch (template) {
    case "dispute-created":
      return `<h2>Dispute Created</h2><p>Hello ${clientName},</p><p>Your dispute with ${cra} has been created with ${data.accountCount || 0} account(s).</p>`;
    case "dispute-sent":
      return `<h2>Dispute Sent</h2><p>Hello ${clientName},</p><p>Your dispute letter to ${cra} has been sent.</p>`;
    case "dispute-resolved":
      return `<h2>Dispute Update</h2><p>Hello ${clientName},</p><p>Your dispute with ${cra} has been updated: ${data.status || "resolved"}</p>`;
    case "deadline-reminder":
      return `<h2>Deadline Reminder</h2><p>Hello ${clientName},</p><p>Your ${cra} dispute deadline is approaching in ${data.daysLeft || 0} days.</p>`;
    case "welcome":
      return `<h2>Welcome!</h2><p>Hello ${clientName},</p><p>Welcome to Dispute2Go. We're here to help you on your credit repair journey.</p>`;
    default:
      return `<p>${JSON.stringify(data)}</p>`;
  }
}

function buildEmailText(template: string, data: Record<string, unknown>): string {
  const clientName = data.clientName as string || "Valued Customer";
  const cra = data.cra as string || "";

  switch (template) {
    case "dispute-created":
      return `Hello ${clientName}, Your dispute with ${cra} has been created with ${data.accountCount || 0} account(s).`;
    case "dispute-sent":
      return `Hello ${clientName}, Your dispute letter to ${cra} has been sent.`;
    case "dispute-resolved":
      return `Hello ${clientName}, Your dispute with ${cra} has been updated: ${data.status || "resolved"}`;
    case "deadline-reminder":
      return `Hello ${clientName}, Your ${cra} dispute deadline is approaching in ${data.daysLeft || 0} days.`;
    case "welcome":
      return `Hello ${clientName}, Welcome to Dispute2Go. We're here to help you on your credit repair journey.`;
    default:
      return JSON.stringify(data);
  }
}

async function handleSendSMS(data: JobData["send-sms"]) {
  const { sendSMS } = await import("./sms");
  await sendSMS(data.to, data.message);
}

async function handleCheckDeadlines(data: JobData["check-dispute-deadlines"]) {
  const prisma = (await import("./prisma")).default;
  const { sendFollowUpReminderSMS } = await import("./sms");

  // Find disputes that are SENT and approaching or past deadline
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const disputes = await prisma.dispute.findMany({
    where: {
      status: "SENT",
      sentDate: { lte: new Date() },
      ...(data.organizationId ? { organizationId: data.organizationId } : {}),
    },
    include: {
      client: true,
    },
  });

  for (const dispute of disputes) {
    if (!dispute.sentDate || !dispute.client?.phone) continue;

    const daysSinceSent = Math.floor(
      (Date.now() - dispute.sentDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Send reminders at 20, 25, and 30+ days
    if ([20, 25, 30, 35, 40].includes(daysSinceSent)) {
      await sendFollowUpReminderSMS(dispute.client.phone, dispute.cra, daysSinceSent);
    }
  }
}

async function handleSyncCreditScores(data: JobData["sync-credit-scores"]) {
  const prisma = (await import("./prisma")).default;
  const { getCreditScores, isCreditMonitoringAvailable } = await import("./credit-monitoring");

  if (!isCreditMonitoringAvailable()) {
    log.info({ data: data.clientId }, "Credit monitoring not configured, skipping sync for client");
    return;
  }

  try {
    // Get client with credit monitoring info
    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
      select: {
        id: true,
        creditMonitoringId: true,
        creditMonitoringProvider: true,
        organizationId: true,
      },
    });

    if (!client || !client.creditMonitoringId) {
      log.info({ data: data.clientId }, "Client not enrolled in credit monitoring");
      return;
    }

    // Fetch scores from provider
    const result = await getCreditScores(
      client.creditMonitoringId,
      client.creditMonitoringProvider as "identityiq" | "array" | undefined
    );

    if (!result.success || !result.scores) {
      log.error({ err: result.error }, "Failed to fetch credit scores");
      return;
    }

    // Update/create credit scores in database
    for (const score of result.scores) {
      await prisma.creditScore.upsert({
        where: {
          id: `${client.id}-${score.bureau}-${score.date.toISOString().split("T")[0]}`,
        },
        update: {
          score: score.score,
          scoreDate: score.date,
        },
        create: {
          id: `${client.id}-${score.bureau}-${score.date.toISOString().split("T")[0]}`,
          clientId: client.id,
          cra: score.bureau,
          score: score.score,
          scoreDate: score.date,
          source: "API_SYNC",
        },
      });
    }

    // Update client's last sync timestamp
    await prisma.client.update({
      where: { id: client.id },
      data: {
        creditMonitoringStatus: "ACTIVE",
      },
    });

    // Log the sync event
    await prisma.eventLog.create({
      data: {
        eventType: "CREDIT_SCORES_SYNCED",
        targetType: "CLIENT",
        targetId: client.id,
        organizationId: client.organizationId,
        eventData: JSON.stringify({
          scoresCount: result.scores.length,
          bureaus: result.scores.map((s) => s.bureau),
        }),
      },
    });

    log.info({ clientId: data.clientId, length: result.scores.length }, "Credit scores synced for client : scores updated");
  } catch (error) {
    log.error({ err: error }, "Error syncing credit scores");
    throw error;
  }
}

async function handleCleanupFiles(data: JobData["cleanup-old-files"]) {
  const prisma = (await import("./prisma")).default;
  const { deleteFile } = await import("./storage");

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - data.olderThanDays);

  // Find old files marked for deletion
  const oldFiles = await prisma.storedFile.findMany({
    where: {
      createdAt: { lt: cutoffDate },
      // Add additional filters as needed
    },
    take: 100, // Process in batches
  });

  for (const file of oldFiles) {
    await deleteFile(file.storagePath);
    await prisma.storedFile.delete({ where: { id: file.id } });
  }

  log.info({ length: oldFiles.length }, "Cleaned up old files");
}

// ============================================
// Scheduled Jobs (Cron-like)
// ============================================

/**
 * Schedule recurring jobs
 * Call this once on server startup
 */
export async function scheduleRecurringJobs(): Promise<void> {
  if (!isQueueEnabled()) return;

  const { Queue } = await import("bullmq");
  const connection = getRedisConnection();

  // Check dispute deadlines daily at 9 AM
  const deadlineQueue = new Queue("check-dispute-deadlines", { connection });
  await deadlineQueue.add(
    "daily-check",
    {},
    {
      repeat: {
        pattern: "0 9 * * *", // 9 AM daily
      },
    }
  );

  // Cleanup old files weekly
  const cleanupQueue = new Queue("cleanup-old-files", { connection });
  await cleanupQueue.add(
    "weekly-cleanup",
    { olderThanDays: 90 },
    {
      repeat: {
        pattern: "0 2 * * 0", // 2 AM on Sundays
      },
    }
  );

  log.info("Recurring jobs scheduled");
}

/**
 * Graceful shutdown
 */
export async function shutdownQueues(): Promise<void> {
  if (workers) {
    for (const worker of workers.values()) {
      await worker.close();
    }
  }
  if (queues) {
    for (const queue of queues.values()) {
      await queue.close();
    }
  }
}
