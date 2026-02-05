/**
 * LITIGATION SCAN API
 *
 * GET  /api/clients/[id]/litigation-scan - List all scans for client
 * POST /api/clients/[id]/litigation-scan - Run a new litigation scan
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { SubscriptionTier } from "@/types";
import { litigationScanSchema } from "@/lib/api-validation-schemas";
import { runLitigationScan } from "@/lib/litigation-scanner";
import type { LitigationScanInput, ScanAccount, ScanDispute } from "@/lib/litigation-scanner";
import { createLogger } from "@/lib/logger";
const log = createLogger("litigation-scan-api");

export const dynamic = "force-dynamic";

// =============================================================================
// HELPERS
// =============================================================================

function parseJSON<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// =============================================================================
// GET /api/clients/[id]/litigation-scan
// =============================================================================

export const GET = withAuth(async (req, ctx) => {
  try {
    const clientId = ctx.params.id;

    // Verify client belongs to organization
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: ctx.organizationId,
        isActive: true,
        archivedAt: null,
      },
      select: { id: true },
    });

    if (!client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    // Fetch all scans for this client
    const scans = await prisma.litigationScan.findMany({
      where: {
        clientId,
        organizationId: ctx.organizationId,
      },
      orderBy: { createdAt: "desc" },
    });

    // Parse JSON fields
    const parsed = scans.map((scan) => ({
      ...scan,
      violations: parseJSON(scan.violations, []),
      damageEstimate: parseJSON(scan.damageEstimate, {}),
      caseSummary: parseJSON(scan.caseSummary, {}),
      escalationPlan: parseJSON(scan.escalationPlan, {}),
    }));

    return NextResponse.json({
      success: true,
      scans: parsed,
      count: parsed.length,
    });
  } catch (error) {
    log.error({ err: error }, "Error fetching litigation scans");
    return NextResponse.json(
      { error: "Failed to fetch litigation scans", code: "FETCH_ERROR" },
      { status: 500 }
    );
  }
}, { minTier: SubscriptionTier.PROFESSIONAL });

// =============================================================================
// POST /api/clients/[id]/litigation-scan
// =============================================================================

export const POST = withAuth(
  async (req, ctx) => {
    const startTime = Date.now();
    try {
      const clientId = ctx.params.id;
      const { clientState } = ctx.body;

      // 1. Fetch client with accounts
      const client = await prisma.client.findFirst({
        where: {
          id: clientId,
          organizationId: ctx.organizationId,
          isActive: true,
          archivedAt: null,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          state: true,
          accounts: {
            select: {
              id: true,
              creditorName: true,
              maskedAccountId: true,
              fingerprint: true,
              cra: true,
              accountType: true,
              accountStatus: true,
              balance: true,
              pastDue: true,
              creditLimit: true,
              highBalance: true,
              monthlyPayment: true,
              dateOpened: true,
              dateReported: true,
              lastActivityDate: true,
              paymentStatus: true,
              detectedIssues: true,
              isDisputable: true,
              issueCount: true,
            },
          },
        },
      });

      if (!client) {
        return NextResponse.json(
          { error: "Client not found" },
          { status: 404 }
        );
      }

      // 2. Fetch latest completed credit report
      const latestReport = await prisma.creditReport.findFirst({
        where: {
          clientId,
          organizationId: ctx.organizationId,
          parseStatus: "COMPLETED",
        },
        orderBy: { reportDate: "desc" },
        select: {
          id: true,
          reportDate: true,
        },
      });

      if (!latestReport) {
        // Check if there ARE reports but none completed parsing
        const anyReport = await prisma.creditReport.findFirst({
          where: { clientId, organizationId: ctx.organizationId },
          orderBy: { createdAt: "desc" },
          select: { id: true, parseStatus: true, parseError: true },
        });
        const detail = anyReport
          ? `Latest report status: ${anyReport.parseStatus}${anyReport.parseError ? ` — ${anyReport.parseError}` : ""}. Try re-uploading or re-parsing.`
          : "Upload and parse a credit report first.";

        return NextResponse.json(
          { error: `No successfully parsed credit report found. ${detail}`, code: "NO_REPORT" },
          { status: 400 }
        );
      }

      // 3. Fetch dispute history
      const disputes = await prisma.dispute.findMany({
        where: {
          clientId,
          organizationId: ctx.organizationId,
        },
        select: {
          id: true,
          cra: true,
          status: true,
          sentDate: true,
          respondedAt: true,
          items: {
            select: {
              accountItemId: true,
              outcome: true,
            },
          },
        },
      });

      // 4. Build scan input
      log.info({ clientId, accountCount: client.accounts.length, reportId: latestReport.id, disputeCount: disputes.length }, "[LITIGATION] Scan for client");

      if (client.accounts.length === 0) {
        return NextResponse.json(
          {
            error: "No account data found for this client. The credit report may not have parsed any accounts. Try re-uploading the report.",
            code: "NO_ACCOUNTS",
            reportId: latestReport.id,
          },
          { status: 400 }
        );
      }

      const accounts: ScanAccount[] = client.accounts.map((a) => ({
        id: a.id,
        creditorName: a.creditorName,
        maskedAccountId: a.maskedAccountId,
        fingerprint: a.fingerprint,
        cra: a.cra,
        accountType: a.accountType,
        accountStatus: a.accountStatus,
        balance: a.balance,
        pastDue: a.pastDue,
        creditLimit: a.creditLimit,
        highBalance: a.highBalance,
        monthlyPayment: a.monthlyPayment,
        dateOpened: a.dateOpened,
        dateReported: a.dateReported,
        lastActivityDate: a.lastActivityDate,
        paymentStatus: a.paymentStatus,
        detectedIssues: a.detectedIssues,
        isDisputable: a.isDisputable,
        issueCount: a.issueCount,
      }));

      const scanDisputes: ScanDispute[] = disputes.map((d) => ({
        id: d.id,
        cra: d.cra,
        status: d.status,
        sentDate: d.sentDate,
        respondedAt: d.respondedAt,
        items: d.items.map((item) => ({
          accountItemId: item.accountItemId,
          outcome: item.outcome,
        })),
      }));

      const scanInput: LitigationScanInput = {
        clientId,
        organizationId: ctx.organizationId,
        reportId: latestReport.id,
        reportDate: latestReport.reportDate,
        clientState: clientState || client.state || undefined,
        accounts,
        disputes: scanDisputes,
      };

      // 5. Run the scan
      const result = runLitigationScan(scanInput);

      // 6. Save to database
      const computeTimeMs = Date.now() - startTime;

      const savedScan = await prisma.litigationScan.create({
        data: {
          clientId,
          organizationId: ctx.organizationId,
          reportId: latestReport.id,
          scanStatus: "COMPLETED",
          totalViolations: result.metadata.totalViolations,
          fcraViolations: result.metadata.fcraViolations,
          fdcpaViolations: result.metadata.fdcpaViolations,
          metro2Errors: result.metadata.metro2Errors,
          criticalCount: result.metadata.criticalCount,
          highCount: result.metadata.highCount,
          mediumCount: result.metadata.mediumCount,
          lowCount: result.metadata.lowCount,
          estimatedTotalMin: result.metadata.estimatedTotalMin,
          estimatedTotalMax: result.metadata.estimatedTotalMax,
          violations: JSON.stringify(result.violations),
          damageEstimate: JSON.stringify(result.damageEstimate),
          caseSummary: JSON.stringify(result.caseSummary),
          escalationPlan: JSON.stringify(result.escalationPlan),
          computeTimeMs,
          version: result.metadata.version,
        },
      });

      // 7. Log the event
      await prisma.eventLog.create({
        data: {
          eventType: "LITIGATION_SCAN",
          actorId: ctx.userId,
          actorEmail: ctx.session.user.email,
          targetType: "LitigationScan",
          targetId: savedScan.id,
          eventData: JSON.stringify({
            clientId,
            clientName: `${client.firstName} ${client.lastName}`,
            totalViolations: result.metadata.totalViolations,
            estimatedDamagesMin: result.metadata.estimatedTotalMin,
            estimatedDamagesMax: result.metadata.estimatedTotalMax,
            computeTimeMs,
          }),
          organizationId: ctx.organizationId,
        },
      });

      // 8. Return result
      return NextResponse.json(
        {
          success: true,
          scan: {
            id: savedScan.id,
            ...result,
            computeTimeMs,
          },
        },
        { status: 201 }
      );
    } catch (error) {
      log.error({ err: error }, "Error running litigation scan");
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Failed to run litigation scan",
          code: "SCAN_ERROR",
        },
        { status: 500 }
      );
    }
  },
  {
    schema: litigationScanSchema,
    minTier: SubscriptionTier.PROFESSIONAL,
  }
);
