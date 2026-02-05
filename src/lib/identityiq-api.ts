/**
 * IdentityIQ API Integration
 *
 * Provides automated credit report fetching from IdentityIQ.
 * Supports both manual pull and webhook-based auto-push.
 *
 * IdentityIQ Partner API Documentation:
 * - Reports can be fetched via partner API with member credentials
 * - Webhooks can notify when new reports are available
 * - Reports are returned in PDF or structured JSON format
 */

import prisma from "./prisma";
import { parseIdentityIQReport, analyzeAccountsForIssues } from "./parser";
import { analyzeReportAndGenerateStrategy, type ParsedAccount, type DisputeStrategy } from "./ai-rules-engine";
import { createLogger } from "./logger";
const log = createLogger("identityiq");

// =============================================================================
// CONFIGURATION
// =============================================================================

const IDENTITYIQ_API_BASE = process.env.IDENTITYIQ_API_BASE || "https://api.identityiq.com/v1";
const IDENTITYIQ_API_KEY = process.env.IDENTITYIQ_API_KEY;
const IDENTITYIQ_PARTNER_ID = process.env.IDENTITYIQ_PARTNER_ID;
const IDENTITYIQ_WEBHOOK_SECRET = process.env.IDENTITYIQ_WEBHOOK_SECRET;

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface IdentityIQMember {
  memberId: string;
  email: string;
  firstName: string;
  lastName: string;
  enrollmentStatus: "active" | "pending" | "cancelled";
  enrollmentDate: string;
  lastReportDate?: string;
}

export interface IdentityIQReport {
  reportId: string;
  memberId: string;
  generatedAt: string;
  bureaus: ("TransUnion" | "Experian" | "Equifax")[];
  reportType: "3B" | "1B";
  format: "pdf" | "json" | "html";
  downloadUrl?: string;
  content?: string; // Base64 encoded PDF or JSON string
}

export interface IdentityIQScore {
  bureau: "TransUnion" | "Experian" | "Equifax";
  score: number;
  scoreModel: string;
  scoreDate: string;
  factors?: string[];
}

export interface IdentityIQAlert {
  alertId: string;
  type: string;
  bureau: string;
  title: string;
  description: string;
  createdAt: string;
  isRead: boolean;
}

export interface WebhookPayload {
  event: "report.ready" | "score.updated" | "alert.created" | "member.enrolled";
  timestamp: string;
  memberId: string;
  data: Record<string, unknown>;
  signature: string;
}

export interface ImportResult {
  success: boolean;
  reportId?: string;
  accountsFound?: number;
  disputableAccounts?: number;
  strategy?: DisputeStrategy;
  error?: string;
}

// =============================================================================
// API CLIENT
// =============================================================================

/**
 * Check if IdentityIQ API is configured
 */
export function isIdentityIQConfigured(): boolean {
  return !!(IDENTITYIQ_API_KEY && IDENTITYIQ_PARTNER_ID);
}

/**
 * Make authenticated request to IdentityIQ API
 */
async function identityIQRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (!isIdentityIQConfigured()) {
    throw new Error("IdentityIQ API not configured. Set IDENTITYIQ_API_KEY and IDENTITYIQ_PARTNER_ID.");
  }

  const response = await fetch(`${IDENTITYIQ_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": IDENTITYIQ_API_KEY!,
      "X-Partner-ID": IDENTITYIQ_PARTNER_ID!,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`IdentityIQ API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

// =============================================================================
// MEMBER MANAGEMENT
// =============================================================================

/**
 * Get member details by email or member ID
 */
export async function getMember(identifier: string): Promise<IdentityIQMember | null> {
  try {
    const isEmail = identifier.includes("@");
    const endpoint = isEmail
      ? `/members/by-email/${encodeURIComponent(identifier)}`
      : `/members/${identifier}`;

    return await identityIQRequest<IdentityIQMember>(endpoint);
  } catch (error) {
    log.error({ err: error }, "Error fetching IdentityIQ member");
    return null;
  }
}

/**
 * Link a client to their IdentityIQ account
 */
export async function linkClientToIdentityIQ(
  clientId: string,
  identityIQMemberId: string
): Promise<boolean> {
  try {
    // Verify the member exists
    const member = await getMember(identityIQMemberId);
    if (!member) {
      throw new Error("IdentityIQ member not found");
    }

    // Update client record
    await prisma.client.update({
      where: { id: clientId },
      data: {
        creditMonitoringId: identityIQMemberId,
        creditMonitoringProvider: "identityiq",
        creditMonitoringStatus: member.enrollmentStatus === "active" ? "ACTIVE" : "PENDING",
      },
    });

    return true;
  } catch (error) {
    log.error({ err: error }, "Error linking client to IdentityIQ");
    return false;
  }
}

// =============================================================================
// REPORT FETCHING
// =============================================================================

/**
 * Get list of available reports for a member
 */
export async function getAvailableReports(
  memberId: string,
  options?: { limit?: number; since?: Date }
): Promise<IdentityIQReport[]> {
  const params = new URLSearchParams();
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.since) params.set("since", options.since.toISOString());

  return identityIQRequest<IdentityIQReport[]>(
    `/members/${memberId}/reports?${params}`
  );
}

/**
 * Get a specific report by ID
 */
export async function getReport(
  memberId: string,
  reportId: string,
  format: "pdf" | "json" = "pdf"
): Promise<IdentityIQReport> {
  return identityIQRequest<IdentityIQReport>(
    `/members/${memberId}/reports/${reportId}?format=${format}`
  );
}

/**
 * Request a fresh credit report pull
 */
export async function requestNewReport(
  memberId: string,
  bureaus: ("TransUnion" | "Experian" | "Equifax")[] = ["TransUnion", "Experian", "Equifax"]
): Promise<{ requestId: string; estimatedReadyTime: string }> {
  return identityIQRequest<{ requestId: string; estimatedReadyTime: string }>(
    `/members/${memberId}/reports/request`,
    {
      method: "POST",
      body: JSON.stringify({ bureaus }),
    }
  );
}

/**
 * Get current credit scores
 */
export async function getCreditScores(memberId: string): Promise<IdentityIQScore[]> {
  return identityIQRequest<IdentityIQScore[]>(`/members/${memberId}/scores`);
}

/**
 * Get recent alerts
 */
export async function getAlerts(
  memberId: string,
  options?: { unreadOnly?: boolean; limit?: number }
): Promise<IdentityIQAlert[]> {
  const params = new URLSearchParams();
  if (options?.unreadOnly) params.set("unread", "true");
  if (options?.limit) params.set("limit", String(options.limit));

  return identityIQRequest<IdentityIQAlert[]>(
    `/members/${memberId}/alerts?${params}`
  );
}

// =============================================================================
// AUTO-IMPORT WORKFLOW
// =============================================================================

/**
 * Import and process a credit report from IdentityIQ
 * This is the main entry point for auto-importing reports
 */
export async function importReportFromIdentityIQ(
  clientId: string,
  reportId?: string
): Promise<ImportResult> {
  try {
    // Get client with IdentityIQ linkage
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        organization: true,
        disputes: {
          where: { status: { in: ["SENT", "PENDING_REVIEW", "APPROVED"] } },
        },
      },
    });

    if (!client) {
      return { success: false, error: "Client not found" };
    }

    if (!client.creditMonitoringId || client.creditMonitoringProvider !== "identityiq") {
      return { success: false, error: "Client not linked to IdentityIQ" };
    }

    const memberId = client.creditMonitoringId;

    // Get the report (latest if no specific ID provided)
    let report: IdentityIQReport;
    if (reportId) {
      report = await getReport(memberId, reportId, "pdf");
    } else {
      const reports = await getAvailableReports(memberId, { limit: 1 });
      if (reports.length === 0) {
        return { success: false, error: "No reports available for this member" };
      }
      report = await getReport(memberId, reports[0].reportId, "pdf");
    }

    // Download and decode the report content
    let reportContent: string;
    if (report.content) {
      // Base64 encoded content
      reportContent = Buffer.from(report.content, "base64").toString("utf-8");
    } else if (report.downloadUrl) {
      // Need to fetch from URL
      const downloadResponse = await fetch(report.downloadUrl);
      if (!downloadResponse.ok) {
        return { success: false, error: "Failed to download report" };
      }
      const buffer = await downloadResponse.arrayBuffer();
      reportContent = Buffer.from(buffer).toString("utf-8");
    } else {
      return { success: false, error: "No report content available" };
    }

    // Parse the report
    const parseResult = await parseIdentityIQReport(reportContent);
    if (!parseResult.success) {
      return {
        success: false,
        error: `Failed to parse report: ${parseResult.errors?.join(", ")}`,
      };
    }

    // Analyze accounts for issues
    const accountsWithIssues = analyzeAccountsForIssues(parseResult.accounts || []);

    // Find a user to attribute the upload to (first admin or user in org)
    const uploadUser = await prisma.user.findFirst({
      where: { organizationId: client.organizationId },
      orderBy: { createdAt: "asc" },
    });

    if (!uploadUser) {
      return { success: false, error: "No user found in organization to attribute import" };
    }

    // Create a placeholder StoredFile for the API-imported report
    const storedFile = await prisma.storedFile.create({
      data: {
        filename: `identityiq-report-${report.reportId}.pdf`,
        mimeType: report.format === "pdf" ? "application/pdf" : "text/html",
        sizeBytes: reportContent.length,
        storagePath: `api-imports/identityiq/${client.id}/${report.reportId}`,
        storageType: "API_IMPORT",
        checksum: report.reportId,
        organizationId: client.organizationId,
      },
    });

    // Store the report in database
    const storedReport = await prisma.creditReport.create({
      data: {
        clientId: client.id,
        organizationId: client.organizationId,
        uploadedById: uploadUser.id,
        originalFileId: storedFile.id,
        sourceType: "IDENTITYIQ_API",
        parseStatus: "COMPLETED",
        reportDate: new Date(report.generatedAt),
        pageCount: 0,
        renderedPageIds: JSON.stringify([]),
      },
    });

    // Store parsed accounts
    for (const account of accountsWithIssues) {
      await prisma.accountItem.create({
        data: {
          reportId: storedReport.id,
          clientId: client.id,
          organizationId: client.organizationId,
          cra: account.cra || "UNKNOWN",
          maskedAccountId: account.maskedAccountId || "UNKNOWN",
          fingerprint: account.fingerprint || `${storedReport.id}-${account.maskedAccountId}`,
          creditorName: account.creditorName || "Unknown Creditor",
          accountType: account.accountType,
          accountStatus: account.accountStatus,
          dateOpened: account.dateOpened ? new Date(account.dateOpened) : null,
          balance: account.balance,
          creditLimit: account.creditLimit,
          paymentStatus: account.paymentStatus,
          confidenceScore: account.confidenceScore,
          issueCount: account.issues?.length || 0,
          detectedIssues: account.issues ? JSON.stringify(account.issues) : null,
          isDisputable: account.isDisputable,
          suggestedFlow: account.suggestedFlow,
        },
      });
    }

    // Update credit scores
    try {
      const scores = await getCreditScores(memberId);
      for (const score of scores) {
        const craNormalized = score.bureau.toUpperCase() as "TRANSUNION" | "EXPERIAN" | "EQUIFAX";
        await prisma.creditScore.upsert({
          where: {
            id: `${client.id}-${craNormalized}-${score.scoreDate}`,
          },
          update: {
            score: score.score,
            scoreDate: new Date(score.scoreDate),
          },
          create: {
            id: `${client.id}-${craNormalized}-${score.scoreDate}`,
            clientId: client.id,
            cra: craNormalized,
            score: score.score,
            scoreDate: new Date(score.scoreDate),
            source: "IDENTITYIQ_API",
          },
        });
      }
    } catch (scoreError) {
      log.warn({ err: scoreError }, "Failed to update credit scores");
      // Continue - scores are not critical
    }

    // Generate dispute strategy
    const disputableAccounts = accountsWithIssues.filter(a => a.isDisputable);

    // Map to ParsedAccount format for strategy generation
    const parsedAccounts: ParsedAccount[] = accountsWithIssues.map(a => ({
      id: a.fingerprint || `temp-${a.maskedAccountId}`,
      creditorName: a.creditorName || "Unknown",
      maskedAccountId: a.maskedAccountId,
      cra: (a.cra || "UNKNOWN") as "TRANSUNION" | "EXPERIAN" | "EQUIFAX",
      accountType: a.accountType,
      accountStatus: a.accountStatus as "OPEN" | "CLOSED" | "PAID" | "CHARGED_OFF" | "COLLECTION" | "DEROGATORY" | undefined,
      balance: a.balance,
      pastDue: a.pastDue,
      creditLimit: a.creditLimit,
      dateOpened: a.dateOpened,
      dateReported: a.dateReported,
      paymentStatus: a.paymentStatus,
      confidenceScore: a.confidenceScore || 0,
      detectedIssues: (a.issues || []).map(issue => ({
        code: typeof issue === "string" ? issue : issue.code || "UNKNOWN",
        description: typeof issue === "string" ? issue : issue.description || "",
        severity: (typeof issue === "object" && issue.severity) || "MEDIUM" as const,
        suggestedFlow: (typeof issue === "object" && issue.suggestedFlow) || "ACCURACY" as const,
        legalCitation: typeof issue === "object" ? issue.fcraSection : undefined,
      })),
      isDisputable: a.isDisputable || false,
    }));

    // Map existing disputes
    const existingDisputes = client.disputes.map(d => ({
      id: d.id,
      accountId: d.id, // Would need to map properly
      cra: d.cra as "TRANSUNION" | "EXPERIAN" | "EQUIFAX",
      flow: d.flow as "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO",
      round: d.round,
      status: d.status as "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "SENT" | "RESPONDED" | "RESOLVED" | "ESCALATED",
      sentDate: d.sentDate || undefined,
      responseOutcome: d.responseOutcome as "ITEMS_DELETED" | "ITEMS_UPDATED" | "VERIFIED" | "NO_RESPONSE" | "PARTIAL" | undefined,
      deadlineDate: d.deadlineDate || undefined,
    }));

    const strategy = await analyzeReportAndGenerateStrategy(
      parsedAccounts,
      existingDisputes,
      client.organizationId,
      { useAI: true, maxAccountsPerBatch: 5 }
    );

    // Log the import event
    await prisma.eventLog.create({
      data: {
        eventType: "REPORT_IMPORTED",
        targetType: "CREDIT_REPORT",
        targetId: storedReport.id,
        organizationId: client.organizationId,
        eventData: JSON.stringify({
          source: "IDENTITYIQ_API",
          reportId: report.reportId,
          accountsFound: accountsWithIssues.length,
          disputableAccounts: disputableAccounts.length,
        }),
      },
    });

    return {
      success: true,
      reportId: storedReport.id,
      accountsFound: accountsWithIssues.length,
      disputableAccounts: disputableAccounts.length,
      strategy,
    };
  } catch (error) {
    log.error({ err: error }, "Error importing report from IdentityIQ");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// WEBHOOK HANDLING
// =============================================================================

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  if (!IDENTITYIQ_WEBHOOK_SECRET) {
    log.warn("Webhook secret not configured");
    return false;
  }

  // HMAC-SHA256 verification (implementation depends on IdentityIQ's actual format)
  const crypto = require("crypto");
  const expectedSignature = crypto
    .createHmac("sha256", IDENTITYIQ_WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");

  return signature === expectedSignature;
}

/**
 * Process incoming webhook from IdentityIQ
 */
export async function processWebhook(payload: WebhookPayload): Promise<{
  success: boolean;
  action?: string;
  error?: string;
}> {
  try {
    switch (payload.event) {
      case "report.ready": {
        // New report is available - find the client and import
        const client = await prisma.client.findFirst({
          where: {
            creditMonitoringId: payload.memberId,
            creditMonitoringProvider: "identityiq",
          },
        });

        if (!client) {
          return {
            success: false,
            error: `No client found for member ${payload.memberId}`,
          };
        }

        const reportId = payload.data.reportId as string;
        const result = await importReportFromIdentityIQ(client.id, reportId);

        if (result.success) {
          // Notify all users in the organization
          const users = await prisma.user.findMany({
            where: { organizationId: client.organizationId, isActive: true },
            select: { id: true },
          });

          for (const user of users) {
            await prisma.notification.create({
              data: {
                userId: user.id,
                type: "REPORT_READY",
                title: "New Credit Report Available",
                message: `A new credit report for ${client.firstName} ${client.lastName} has been imported. ${result.disputableAccounts} disputable account(s) found.`,
                linkUrl: `/clients/${client.id}`,
                linkText: "View Client",
              },
            });
          }
        }

        return {
          success: result.success,
          action: "report_imported",
          error: result.error,
        };
      }

      case "score.updated": {
        // Credit score changed - update and potentially alert
        const client = await prisma.client.findFirst({
          where: {
            creditMonitoringId: payload.memberId,
            creditMonitoringProvider: "identityiq",
          },
        });

        if (!client) {
          return {
            success: false,
            error: `No client found for member ${payload.memberId}`,
          };
        }

        const scoreData = payload.data as {
          bureau: string;
          oldScore: number;
          newScore: number;
          scoreDate: string;
        };

        // Update score in database
        const craNormalized = scoreData.bureau.toUpperCase() as "TRANSUNION" | "EXPERIAN" | "EQUIFAX";
        await prisma.creditScore.create({
          data: {
            id: `${client.id}-${craNormalized}-${scoreData.scoreDate}`,
            clientId: client.id,
            cra: craNormalized,
            score: scoreData.newScore,
            scoreDate: new Date(scoreData.scoreDate),
            source: "IDENTITYIQ_WEBHOOK",
          },
        });

        // Calculate change
        const change = scoreData.newScore - scoreData.oldScore;
        if (Math.abs(change) >= 10) {
          // Significant change - notify all users in org
          const users = await prisma.user.findMany({
            where: { organizationId: client.organizationId, isActive: true },
            select: { id: true },
          });

          for (const user of users) {
            await prisma.notification.create({
              data: {
                userId: user.id,
                type: "SCORE_CHANGE",
                title: `Credit Score ${change > 0 ? "Increased" : "Decreased"}`,
                message: `${client.firstName} ${client.lastName}'s ${scoreData.bureau} score changed by ${change > 0 ? "+" : ""}${change} points (now ${scoreData.newScore}).`,
                linkUrl: `/clients/${client.id}`,
                linkText: "View Client",
              },
            });
          }
        }

        return { success: true, action: "score_updated" };
      }

      case "alert.created": {
        // New alert from credit monitoring
        const client = await prisma.client.findFirst({
          where: {
            creditMonitoringId: payload.memberId,
            creditMonitoringProvider: "identityiq",
          },
        });

        if (!client) {
          return {
            success: false,
            error: `No client found for member ${payload.memberId}`,
          };
        }

        const alertData = payload.data as unknown as IdentityIQAlert;

        // Create notification for all users in org
        const users = await prisma.user.findMany({
          where: { organizationId: client.organizationId, isActive: true },
          select: { id: true },
        });

        for (const user of users) {
          await prisma.notification.create({
            data: {
              userId: user.id,
              type: "CREDIT_ALERT",
              title: `Credit Alert: ${alertData.title}`,
              message: alertData.description,
              linkUrl: `/clients/${client.id}`,
              linkText: "View Client",
            },
          });
        }

        return { success: true, action: "alert_created" };
      }

      case "member.enrolled": {
        // New member enrolled - could be used for onboarding
        log.info({ memberId: payload.memberId }, "New IdentityIQ member enrolled");
        return { success: true, action: "member_enrolled" };
      }

      default:
        return {
          success: false,
          error: `Unknown webhook event: ${payload.event}`,
        };
    }
  } catch (error) {
    log.error({ err: error }, "Error processing webhook");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// SCHEDULED SYNC
// =============================================================================

/**
 * Sync all linked clients with IdentityIQ
 * Run this periodically (e.g., daily) to catch any missed updates
 */
export async function syncAllClients(organizationId?: string): Promise<{
  synced: number;
  errors: number;
  details: Array<{ clientId: string; success: boolean; error?: string }>;
}> {
  const results: Array<{ clientId: string; success: boolean; error?: string }> = [];

  // Get all clients linked to IdentityIQ
  const clients = await prisma.client.findMany({
    where: {
      creditMonitoringProvider: "identityiq",
      creditMonitoringStatus: "ACTIVE",
      ...(organizationId ? { organizationId } : {}),
    },
    select: {
      id: true,
      creditMonitoringId: true,
    },
  });

  for (const client of clients) {
    if (!client.creditMonitoringId) continue;

    try {
      // Check for new reports
      const reports = await getAvailableReports(client.creditMonitoringId, {
        limit: 1,
        since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      });

      if (reports.length > 0) {
        // Check if we already have a report from this date/source
        const reportDate = new Date(reports[0].generatedAt);
        const existingReport = await prisma.creditReport.findFirst({
          where: {
            clientId: client.id,
            sourceType: "IDENTITYIQ_API",
            reportDate: {
              gte: new Date(reportDate.getTime() - 60000), // Within 1 minute
              lte: new Date(reportDate.getTime() + 60000),
            },
          },
        });

        if (!existingReport) {
          // Import the new report
          const result = await importReportFromIdentityIQ(client.id, reports[0].reportId);
          results.push({
            clientId: client.id,
            success: result.success,
            error: result.error,
          });
        } else {
          results.push({ clientId: client.id, success: true });
        }
      } else {
        results.push({ clientId: client.id, success: true });
      }
    } catch (error) {
      results.push({
        clientId: client.id,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return {
    synced: results.filter(r => r.success).length,
    errors: results.filter(r => !r.success).length,
    details: results,
  };
}

// All exports are declared inline with their definitions above
