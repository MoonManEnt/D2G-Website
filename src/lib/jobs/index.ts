/**
 * Background Job Processing System
 *
 * Uses BullMQ for reliable job queues with Redis backend.
 * Supports scheduled jobs, retries, and job prioritization.
 */

import { Queue, Worker, Job, QueueEvents, ConnectionOptions } from "bullmq";
import { isRedisAvailable } from "../redis";
import { createLogger } from "../logger";
const log = createLogger("jobs");

// Redis connection options for BullMQ
const getConnectionOptions = (): ConnectionOptions => {
  const url = process.env.REDIS_URL;
  if (url) {
    return { url };
  }
  return {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || "0"),
  };
};

// Job types
export const JOB_TYPES = {
  // Email jobs
  SEND_EMAIL: "send-email",
  SEND_BULK_EMAIL: "send-bulk-email",

  // Dispute jobs
  PROCESS_DEADLINE_REMINDERS: "process-deadline-reminders",
  CHECK_DISPUTE_RESPONSES: "check-dispute-responses",
  GENERATE_DISPUTE_LETTER: "generate-dispute-letter",

  // Credit monitoring
  SYNC_CREDIT_SCORES: "sync-credit-scores",
  CHECK_CREDIT_ALERTS: "check-credit-alerts",

  // Report processing
  PARSE_CREDIT_REPORT: "parse-credit-report",

  // Cleanup
  CLEANUP_OLD_FILES: "cleanup-old-files",
  CLEANUP_EXPIRED_SESSIONS: "cleanup-expired-sessions",

  // Analytics
  GENERATE_DAILY_REPORT: "generate-daily-report",
  CALCULATE_METRICS: "calculate-metrics",

  // Amelia AI
  COMPUTE_AMELIA_RECOMMENDATIONS: "compute-amelia-recommendations",
  COMPUTE_OUTCOME_PATTERNS: "compute-outcome-patterns",
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];

// Queue names
const QUEUE_NAMES = {
  DEFAULT: "default",
  EMAIL: "email",
  DISPUTES: "disputes",
  REPORTS: "reports",
  SCHEDULED: "scheduled",
} as const;

// Queue instances
const queues: Map<string, Queue> = new Map();
const workers: Map<string, Worker> = new Map();

// Connection options
const getConnection = (): ConnectionOptions => {
  return getConnectionOptions();
};

/**
 * Get or create a queue
 */
export function getQueue(name: string = QUEUE_NAMES.DEFAULT): Queue | null {
  if (!isRedisAvailable()) {
    log.warn("Job queues disabled: Redis not available");
    return null;
  }

  if (!queues.has(name)) {
    const queue = new Queue(name, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24 hours
          count: 1000,
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
      },
    });
    queues.set(name, queue);
  }

  return queues.get(name)!;
}

/**
 * Add a job to a queue
 */
export async function addJob<T>(
  jobType: JobType,
  data: T,
  options: {
    queue?: string;
    delay?: number;
    priority?: number;
    jobId?: string;
    repeat?: {
      pattern?: string; // Cron pattern
      every?: number; // Milliseconds
      limit?: number;
    };
  } = {}
): Promise<Job | null> {
  const queue = getQueue(options.queue);
  if (!queue) {
    // In development without Redis, just log the job
    log.info({ data: data }, "[JOB] Would add");
    return null;
  }

  return queue.add(jobType, data, {
    delay: options.delay,
    priority: options.priority,
    jobId: options.jobId,
    repeat: options.repeat,
  });
}

/**
 * Register a job processor
 */
export function registerProcessor(
  jobType: JobType,
  processor: (job: Job) => Promise<unknown>,
  queueName: string = QUEUE_NAMES.DEFAULT
): Worker | null {
  if (!isRedisAvailable()) {
    return null;
  }

  const workerKey = `${queueName}:${jobType}`;

  if (workers.has(workerKey)) {
    return workers.get(workerKey)!;
  }

  const worker = new Worker(
    queueName,
    async (job) => {
      if (job.name === jobType) {
        return processor(job);
      }
    },
    {
      connection: getConnection(),
      concurrency: 5,
    }
  );

  worker.on("completed", (job) => {
    log.info({ id: job.id, name: job.name }, "[JOB] Completed: ()");
  });

  worker.on("failed", (job, err) => {
    log.error({ err: err }, "[JOB] Failed: ()");
  });

  workers.set(workerKey, worker);
  return worker;
}

/**
 * Schedule recurring jobs
 */
export async function scheduleRecurringJobs(): Promise<void> {
  if (!isRedisAvailable()) {
    log.warn("Scheduled jobs disabled: Redis not available");
    return;
  }

  // Process deadline reminders every hour
  await addJob(
    JOB_TYPES.PROCESS_DEADLINE_REMINDERS,
    {},
    {
      queue: QUEUE_NAMES.SCHEDULED,
      repeat: { pattern: "0 * * * *" }, // Every hour
      jobId: "deadline-reminders",
    }
  );

  // Check dispute responses every 4 hours
  await addJob(
    JOB_TYPES.CHECK_DISPUTE_RESPONSES,
    {},
    {
      queue: QUEUE_NAMES.SCHEDULED,
      repeat: { pattern: "0 */4 * * *" }, // Every 4 hours
      jobId: "dispute-responses",
    }
  );

  // Sync credit scores daily at 6 AM
  await addJob(
    JOB_TYPES.SYNC_CREDIT_SCORES,
    {},
    {
      queue: QUEUE_NAMES.SCHEDULED,
      repeat: { pattern: "0 6 * * *" }, // 6 AM daily
      jobId: "credit-score-sync",
    }
  );

  // Generate daily report at midnight
  await addJob(
    JOB_TYPES.GENERATE_DAILY_REPORT,
    {},
    {
      queue: QUEUE_NAMES.SCHEDULED,
      repeat: { pattern: "0 0 * * *" }, // Midnight daily
      jobId: "daily-report",
    }
  );

  // Cleanup old files weekly
  await addJob(
    JOB_TYPES.CLEANUP_OLD_FILES,
    {},
    {
      queue: QUEUE_NAMES.SCHEDULED,
      repeat: { pattern: "0 3 * * 0" }, // 3 AM on Sundays
      jobId: "file-cleanup",
    }
  );

  // Compute Amelia recommendations daily at 5 AM
  await addJob(
    JOB_TYPES.COMPUTE_AMELIA_RECOMMENDATIONS,
    {},
    {
      queue: QUEUE_NAMES.SCHEDULED,
      repeat: { pattern: "0 5 * * *" }, // 5 AM daily
      jobId: "amelia-recommendations",
    }
  );

  // Compute outcome patterns daily at 5:30 AM
  await addJob(
    JOB_TYPES.COMPUTE_OUTCOME_PATTERNS,
    {},
    {
      queue: QUEUE_NAMES.SCHEDULED,
      repeat: { pattern: "30 5 * * *" }, // 5:30 AM daily
      jobId: "outcome-patterns",
    }
  );

  log.info("[JOBS] Recurring jobs scheduled");
}

/**
 * Get queue statistics
 */
export async function getQueueStats(queueName: string = QUEUE_NAMES.DEFAULT) {
  const queue = getQueue(queueName);
  if (!queue) return null;

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return {
    queue: queueName,
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed,
  };
}

/**
 * Close all queues and workers gracefully
 */
export async function closeAll(): Promise<void> {
  const closePromises: Promise<void>[] = [];

  for (const worker of workers.values()) {
    closePromises.push(worker.close());
  }

  for (const queue of queues.values()) {
    closePromises.push(queue.close());
  }

  await Promise.all(closePromises);

  queues.clear();
  workers.clear();

  log.info("[JOBS] All queues and workers closed");
}
