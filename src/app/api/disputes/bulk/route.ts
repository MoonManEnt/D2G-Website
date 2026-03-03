import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import { SUBSCRIPTION_LIMITS } from "@/lib/api-middleware";
import { SubscriptionTier } from "@/types";
const log = createLogger("disputes-bulk-api");

export const dynamic = "force-dynamic";

// Schema for bulk dispute creation
const bulkDisputeSchema = z.object({
  clientId: z.string().uuid(),
  accountIds: z.array(z.string().uuid()).min(1, "At least one account required"),
  // If not specified, will auto-detect from accounts
  flow: z.enum(["ACCURACY", "COLLECTION", "CONSENT", "COMBO"]).optional(),
  // Group by CRA (create separate disputes per CRA)
  groupByCRA: z.boolean().default(true),
});

// POST /api/disputes/bulk - Create disputes for multiple accounts at once
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Minimum tier check: bulk disputes require STARTER or higher
    const tierOrder = ["FREE", "SOLO", "STARTER", "PROFESSIONAL", "ENTERPRISE"];
    const currentTier = (session.user.subscriptionTier as string) || "FREE";
    if (tierOrder.indexOf(currentTier) < tierOrder.indexOf("STARTER")) {
      return NextResponse.json(
        {
          error: "Upgrade required",
          code: "TIER_REQUIRED",
          requiredTier: "STARTER",
          currentTier,
          message: "Bulk dispute creation requires STARTER tier or higher.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = bulkDisputeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { clientId, accountIds, flow, groupByCRA } = validation.data;

    // Verify client belongs to organization
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: session.user.organizationId,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get all accounts
    const accounts = await prisma.accountItem.findMany({
      where: {
        id: { in: accountIds },
        clientId,
      },
    });

    if (accounts.length === 0) {
      return NextResponse.json(
        { error: "No valid accounts found" },
        { status: 400 }
      );
    }

    // Check which accounts are already in active disputes
    const existingDisputeItems = await prisma.disputeItem.findMany({
      where: {
        accountItemId: { in: accountIds },
        dispute: {
          status: { in: ["DRAFT", "APPROVED", "SENT"] },
        },
      },
      select: {
        accountItemId: true,
        dispute: {
          select: { id: true, cra: true, status: true },
        },
      },
    });

    const accountsInDispute = new Set(existingDisputeItems.map((d) => d.accountItemId));
    const availableAccounts = accounts.filter((a) => !accountsInDispute.has(a.id));

    if (availableAccounts.length === 0) {
      return NextResponse.json(
        {
          error: "All selected accounts are already in active disputes",
          existingDisputes: existingDisputeItems,
        },
        { status: 400 }
      );
    }

    // Group accounts by CRA if requested
    const accountsByCRA: Record<string, typeof availableAccounts> = {};

    if (groupByCRA) {
      for (const account of availableAccounts) {
        if (!accountsByCRA[account.cra]) {
          accountsByCRA[account.cra] = [];
        }
        accountsByCRA[account.cra].push(account);
      }
    } else {
      // All accounts in one group (will need to be same CRA)
      const cras = [...new Set(availableAccounts.map((a) => a.cra))];
      if (cras.length > 1) {
        return NextResponse.json(
          {
            error:
              "Cannot create single dispute for accounts from multiple CRAs. Enable groupByCRA or select accounts from one CRA.",
            cras,
          },
          { status: 400 }
        );
      }
      accountsByCRA[cras[0]] = availableAccounts;
    }

    // Determine flow for each group
    const determineFlow = (accounts: typeof availableAccounts): string => {
      if (flow) return flow;

      // Count suggested flows
      const flowCounts: Record<string, number> = {};
      for (const account of accounts) {
        const suggestedFlow = account.suggestedFlow || "ACCURACY";
        flowCounts[suggestedFlow] = (flowCounts[suggestedFlow] || 0) + 1;
      }

      // Return most common flow
      const sorted = Object.entries(flowCounts).sort((a, b) => b[1] - a[1]);
      return sorted[0][0];
    };

    // Create disputes
    const createdDisputes = [];
    const errors = [];

    for (const [cra, craAccounts] of Object.entries(accountsByCRA)) {
      try {
        const disputeFlow = determineFlow(craAccounts);

        // Check for existing dispute in this CRA with same flow to add to
        const existingDraft = await prisma.dispute.findFirst({
          where: {
            clientId,
            cra,
            flow: disputeFlow,
            status: "DRAFT",
            organizationId: session.user.organizationId,
          },
        });

        let dispute;

        if (existingDraft) {
          // Add to existing draft
          dispute = existingDraft;

          // Get existing dispute items to avoid duplicates
          const existingItems = await prisma.disputeItem.findMany({
            where: { disputeId: existingDraft.id },
            select: { accountItemId: true },
          });
          const existingAccountIds = new Set(existingItems.map(item => item.accountItemId));

          // Filter out accounts that already have dispute items
          const newAccounts = craAccounts.filter(account => !existingAccountIds.has(account.id));

          // Create dispute items for new accounts only
          if (newAccounts.length > 0) {
            await prisma.disputeItem.createMany({
              data: newAccounts.map((account) => ({
                disputeId: existingDraft.id,
                accountItemId: account.id,
                disputeReason: getDisputeReason(account),
              })),
            });
          }
        } else {
          // Create new dispute with items
          dispute = await prisma.dispute.create({
            data: {
              clientId,
              organizationId: session.user.organizationId,
              cra,
              flow: disputeFlow,
              round: 1,
              status: "DRAFT",
              items: {
                create: craAccounts.map((account) => ({
                  accountItemId: account.id,
                  disputeReason: getDisputeReason(account),
                })),
              },
            },
            include: {
              items: true,
            },
          });
        }

        createdDisputes.push({
          disputeId: dispute.id,
          cra,
          flow: disputeFlow,
          accountCount: craAccounts.length,
          isExisting: !!existingDraft,
        });
      } catch (error) {
        errors.push({
          cra,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Log event
    await prisma.eventLog.create({
      data: {
        eventType: "BULK_DISPUTE_CREATED",
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetType: "CLIENT",
        targetId: clientId,
        eventData: JSON.stringify({
          totalAccounts: accountIds.length,
          availableAccounts: availableAccounts.length,
          disputesCreated: createdDisputes.length,
          skippedAccounts: accountsInDispute.size,
        }),
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json({
      success: true,
      summary: {
        totalAccountsRequested: accountIds.length,
        accountsProcessed: availableAccounts.length,
        accountsSkipped: accountsInDispute.size,
        disputesCreated: createdDisputes.length,
      },
      disputes: createdDisputes,
      skippedAccounts: existingDisputeItems.map((item) => ({
        accountId: item.accountItemId,
        existingDisputeId: item.dispute.id,
        status: item.dispute.status,
      })),
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    log.error({ err: error }, "Failed to create bulk disputes");
    return NextResponse.json(
      { error: "Failed to create disputes" },
      { status: 500 }
    );
  }
}

// Helper to generate dispute reason from account issues
function getDisputeReason(account: {
  detectedIssues: string | null;
  suggestedFlow: string | null;
}): string {
  if (!account.detectedIssues) {
    return "Inaccurate information reported";
  }

  try {
    const issues = JSON.parse(account.detectedIssues);
    if (Array.isArray(issues) && issues.length > 0) {
      // Get the highest severity issue
      const highSeverity = issues.find((i: { severity: string }) => i.severity === "HIGH");
      if (highSeverity?.description) {
        return highSeverity.description;
      }
      return issues[0]?.description || "Inaccurate information reported";
    }
  } catch {
    // Ignore parse errors
  }

  return "Inaccurate information reported";
}

// GET /api/disputes/bulk/preview - Preview what disputes would be created
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Minimum tier check: bulk disputes require STARTER or higher
    const bulkTierOrder = ["FREE", "SOLO", "STARTER", "PROFESSIONAL", "ENTERPRISE"];
    const bulkCurrentTier = (session.user.subscriptionTier as string) || "FREE";
    if (bulkTierOrder.indexOf(bulkCurrentTier) < bulkTierOrder.indexOf("STARTER")) {
      return NextResponse.json(
        {
          error: "Upgrade required",
          code: "TIER_REQUIRED",
          requiredTier: "STARTER",
          currentTier: bulkCurrentTier,
          message: "Bulk dispute preview requires STARTER tier or higher.",
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const accountIdsParam = searchParams.get("accountIds");

    if (!clientId || !accountIdsParam) {
      return NextResponse.json(
        { error: "clientId and accountIds required" },
        { status: 400 }
      );
    }

    const accountIds = accountIdsParam.split(",");

    // Get accounts
    const accounts = await prisma.accountItem.findMany({
      where: {
        id: { in: accountIds },
        clientId,
        client: {
          organizationId: session.user.organizationId,
        },
      },
      select: {
        id: true,
        creditorName: true,
        cra: true,
        suggestedFlow: true,
        detectedIssues: true,
        issueCount: true,
      },
    });

    // Check for existing disputes
    const existingDisputeItems = await prisma.disputeItem.findMany({
      where: {
        accountItemId: { in: accountIds },
        dispute: {
          status: { in: ["DRAFT", "APPROVED", "SENT"] },
        },
      },
      select: {
        accountItemId: true,
        dispute: {
          select: { id: true, cra: true, status: true, flow: true },
        },
      },
    });

    const accountsInDispute = new Set(existingDisputeItems.map((d) => d.accountItemId));

    // Group by CRA for preview
    const preview: Record<
      string,
      {
        cra: string;
        accounts: typeof accounts;
        suggestedFlow: string;
        accountsInDispute: string[];
      }
    > = {};

    for (const account of accounts) {
      if (!preview[account.cra]) {
        preview[account.cra] = {
          cra: account.cra,
          accounts: [],
          suggestedFlow: account.suggestedFlow || "ACCURACY",
          accountsInDispute: [],
        };
      }

      if (accountsInDispute.has(account.id)) {
        preview[account.cra].accountsInDispute.push(account.id);
      } else {
        preview[account.cra].accounts.push(account);
      }
    }

    return NextResponse.json({
      preview: Object.values(preview),
      totalAccounts: accounts.length,
      availableAccounts: accounts.length - accountsInDispute.size,
      accountsAlreadyInDispute: accountsInDispute.size,
    });
  } catch (error) {
    log.error({ err: error }, "Failed to preview bulk disputes");
    return NextResponse.json(
      { error: "Failed to generate preview" },
      { status: 500 }
    );
  }
}
