import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  analyzeReportAndGenerateStrategy,
  generateDisputeLetterContent,
  selectDisputeFlow,
  ESCALATION_RULES,
  type ParsedAccount,
  type ExistingDispute,
  type CRA,
  type DisputeFlow,
} from "@/lib/ai-rules-engine";
import { captureError } from "@/lib/errors";
import { disputeAiSchema } from "@/lib/api-validation-schemas";
import { createLogger } from "@/lib/logger";
const log = createLogger("disputes-ai-api");

export const dynamic = "force-dynamic";

/**
 * POST /api/disputes/ai - AI-powered dispute creation
 *
 * Uses the AI Rules Engine to:
 * 1. Analyze accounts and detect issues
 * 2. Prioritize accounts by impact and success probability
 * 3. Select optimal dispute flow for each account
 * 4. Generate round-specific dispute letters
 * 5. Create coordinated cross-bureau strategy
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = disputeAiSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { clientId, accountIds, options } = parsed.data;

    // Get client info
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: session.user.organizationId,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Validate client has required address info
    if (!client.addressLine1 || !client.city || !client.state || !client.zipCode) {
      return NextResponse.json(
        { error: "Client address information is incomplete. Please update client profile." },
        { status: 400 }
      );
    }

    // Get account items
    const accounts = await prisma.accountItem.findMany({
      where: {
        id: { in: accountIds },
        organizationId: session.user.organizationId,
        clientId,
      },
    });

    if (accounts.length === 0) {
      return NextResponse.json(
        { error: "No valid accounts found" },
        { status: 400 }
      );
    }

    // Get existing disputes for these accounts
    const existingDisputes = await prisma.dispute.findMany({
      where: {
        clientId,
        items: {
          some: {
            accountItemId: { in: accountIds },
          },
        },
      },
      include: {
        items: {
          select: {
            accountItemId: true,
          },
        },
      },
    });

    // Convert to AI engine format
    const parsedAccounts: ParsedAccount[] = accounts.map((acc) => {
      let detectedIssues: ParsedAccount["detectedIssues"] = [];
      try {
        const issues = acc.detectedIssues ? JSON.parse(acc.detectedIssues) : [];
        detectedIssues = issues.map((i: { code: string; description: string; severity: string; suggestedFlow: string; fcraSection?: string }) => ({
          code: i.code,
          description: i.description,
          severity: (i.severity || "MEDIUM") as "HIGH" | "MEDIUM" | "LOW",
          suggestedFlow: (i.suggestedFlow || "ACCURACY") as DisputeFlow,
          legalCitation: i.fcraSection,
        }));
      } catch {
        // Empty issues
      }

      return {
        id: acc.id,
        creditorName: acc.creditorName,
        maskedAccountId: acc.maskedAccountId || undefined,
        cra: acc.cra as CRA,
        accountType: acc.accountType || undefined,
        accountStatus: mapAccountStatus(acc.accountStatus),
        balance: acc.balance ? Number(acc.balance) : undefined,
        pastDue: acc.pastDue ? Number(acc.pastDue) : undefined,
        creditLimit: acc.creditLimit ? Number(acc.creditLimit) : undefined,
        dateOpened: acc.dateOpened?.toISOString(),
        dateReported: acc.dateReported?.toISOString(),
        paymentStatus: acc.paymentStatus || undefined,
        confidenceScore: acc.confidenceScore || 50,
        detectedIssues,
        isDisputable: acc.isDisputable || detectedIssues.length > 0,
      };
    });

    const existingDisputeData: ExistingDispute[] = existingDisputes.map((d) => ({
      id: d.id,
      accountId: d.items[0]?.accountItemId || "",
      cra: d.cra as CRA,
      flow: d.flow as DisputeFlow,
      round: d.round,
      status: d.status as ExistingDispute["status"],
      sentDate: d.sentDate || undefined,
      responseOutcome: d.responseOutcome as ExistingDispute["responseOutcome"] | undefined,
      deadlineDate: d.deadlineDate || undefined,
    }));

    // Analyze and generate strategy using AI Rules Engine
    const strategy = await analyzeReportAndGenerateStrategy(
      parsedAccounts,
      existingDisputeData,
      session.user.organizationId,
      {
        useAI: options?.useAI !== false,
        maxAccountsPerBatch: options?.maxAccountsPerBatch || 5,
        focusBureaus: options?.focusBureaus,
      }
    );

    if (strategy.recommendations.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No disputable items found or all items already have disputes in progress",
        warnings: strategy.warnings,
      });
    }

    // If only analyzing (preview mode), return strategy without creating disputes
    if (options?.previewOnly) {
      return NextResponse.json({
        success: true,
        preview: true,
        strategy,
      });
    }

    // Create disputes based on recommendations
    const createdDisputes = [];

    // Group recommendations by CRA for batch processing
    const byCRA = strategy.recommendations.reduce((acc, rec) => {
      if (!acc[rec.cra]) acc[rec.cra] = [];
      acc[rec.cra].push(rec);
      return acc;
    }, {} as Record<CRA, typeof strategy.recommendations>);

    for (const [cra, recommendations] of Object.entries(byCRA) as [CRA, typeof strategy.recommendations][]) {
      // Get flow (use most common recommended flow for this CRA batch)
      const flowCounts = recommendations.reduce((acc, r) => {
        acc[r.recommendedFlow] = (acc[r.recommendedFlow] || 0) + 1;
        return acc;
      }, {} as Record<DisputeFlow, number>);
      const flow = Object.entries(flowCounts).sort((a, b) => b[1] - a[1])[0][0] as DisputeFlow;

      // Determine round
      const lastDispute = await prisma.dispute.findFirst({
        where: { clientId, cra },
        orderBy: { round: "desc" },
      });
      const round = recommendations[0].suggestedRound || (lastDispute?.round || 0) + 1;

      // Create dispute
      const dispute = await prisma.dispute.create({
        data: {
          clientId,
          organizationId: session.user.organizationId,
          cra,
          flow,
          round,
          status: "DRAFT",
          aiStrategy: JSON.stringify({
            recommendations: recommendations.map(r => ({
              accountId: r.accountId,
              priority: r.priority,
              reasoning: r.reasoning,
              successRate: r.estimatedSuccessRate,
            })),
            crossBureauPlan: strategy.crossBureauPlan,
            timeline: strategy.timeline,
          }),
          items: {
            create: recommendations.map((rec) => ({
              accountItemId: rec.accountId,
              disputeReason: rec.reasoning,
              suggestedFlow: rec.recommendedFlow,
              priorityScore: rec.impactScore,
            })),
          },
        },
        include: {
          items: {
            include: {
              accountItem: true,
            },
          },
        },
      });

      // Generate letter using AI Rules Engine
      const letterParams = {
        client: {
          firstName: client.firstName,
          lastName: client.lastName,
          address: client.addressLine1!,
          city: client.city!,
          state: client.state!,
          zip: client.zipCode!,
          ssn4: client.ssnLast4 || undefined,
          dob: client.dateOfBirth?.toLocaleDateString("en-US") || undefined,
        },
        accounts: dispute.items.map((item) => ({
          creditorName: item.accountItem.creditorName,
          accountNumber: item.accountItem.maskedAccountId || undefined,
          balance: item.accountItem.balance ? Number(item.accountItem.balance) : undefined,
          issues: item.disputeReason ? [item.disputeReason] : ["Requires verification"],
        })),
        cra: cra as CRA,
        flow: flow as DisputeFlow,
        round,
        previousHistory: lastDispute
          ? {
              previousRounds: [lastDispute.round],
              previousResponses: lastDispute.responseOutcome ? [lastDispute.responseOutcome] : [],
            }
          : undefined,
      };

      const letterResult = await generateDisputeLetterContent(
        letterParams,
        session.user.organizationId
      );

      // Create document
      const document = await prisma.document.create({
        data: {
          documentType: "DISPUTE_LETTER",
          title: `${cra} AI-Generated Dispute Letter - Round ${round}`,
          content: letterResult.content,
          statutesCited: JSON.stringify(letterResult.citations.map(c => `15 U.S.C. §${c}`)),
          approvalStatus: "DRAFT",
          disputeId: dispute.id,
          organizationId: session.user.organizationId,
          createdById: session.user.id,
          aiGenerated: true,
          aiMetadata: JSON.stringify({
            tone: letterResult.tone,
            requestId: letterResult.requestId,
            round,
            flow,
          }),
        },
      });

      createdDisputes.push({
        disputeId: dispute.id,
        cra,
        flow,
        round,
        itemCount: dispute.items.length,
        documentId: document.id,
        recommendations: recommendations.map((r) => ({
          creditorName: r.creditorName,
          priority: r.priority,
          estimatedSuccessRate: Math.round(r.estimatedSuccessRate * 100) + "%",
        })),
      });
    }

    // Log event
    await prisma.eventLog.create({
      data: {
        eventType: "AI_DISPUTE_CREATED",
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetType: "Dispute",
        targetId: createdDisputes.map((d) => d.disputeId).join(","),
        eventData: JSON.stringify({
          disputeCount: createdDisputes.length,
          totalAccounts: strategy.recommendations.length,
          strategy: strategy.overallStrategy,
        }),
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json({
      success: true,
      disputes: createdDisputes,
      strategy: {
        overallStrategy: strategy.overallStrategy,
        timeline: strategy.timeline,
        crossBureauPlan: strategy.crossBureauPlan,
      },
      warnings: strategy.warnings,
    });
  } catch (error) {
    captureError(error as Error, {
      action: "ai_dispute_creation",
    });

    log.error({ err: error }, "Error creating AI dispute");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create dispute" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/disputes/ai - Get AI strategy for accounts
 *
 * Preview mode that analyzes accounts without creating disputes
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const accountIds = searchParams.get("accountIds")?.split(",");

    if (!clientId) {
      return NextResponse.json(
        { error: "clientId is required" },
        { status: 400 }
      );
    }

    // Get all accounts for client if not specified
    const whereClause: Record<string, unknown> = {
      clientId,
      organizationId: session.user.organizationId,
    };

    if (accountIds && accountIds.length > 0) {
      whereClause.id = { in: accountIds };
    }

    const accounts = await prisma.accountItem.findMany({
      where: whereClause,
    });

    if (accounts.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No accounts found for this client",
      });
    }

    // Get existing disputes
    const existingDisputes = await prisma.dispute.findMany({
      where: {
        clientId,
        organizationId: session.user.organizationId,
      },
      include: {
        items: {
          select: {
            accountItemId: true,
          },
        },
      },
    });

    // Convert to AI engine format
    const parsedAccounts: ParsedAccount[] = accounts.map((acc) => {
      let detectedIssues: ParsedAccount["detectedIssues"] = [];
      try {
        const issues = acc.detectedIssues ? JSON.parse(acc.detectedIssues) : [];
        detectedIssues = issues.map((i: { code: string; description: string; severity: string; suggestedFlow: string; fcraSection?: string }) => ({
          code: i.code,
          description: i.description,
          severity: (i.severity || "MEDIUM") as "HIGH" | "MEDIUM" | "LOW",
          suggestedFlow: (i.suggestedFlow || "ACCURACY") as DisputeFlow,
          legalCitation: i.fcraSection,
        }));
      } catch {
        // Empty issues
      }

      return {
        id: acc.id,
        creditorName: acc.creditorName,
        maskedAccountId: acc.maskedAccountId || undefined,
        cra: acc.cra as CRA,
        accountType: acc.accountType || undefined,
        accountStatus: mapAccountStatus(acc.accountStatus),
        balance: acc.balance ? Number(acc.balance) : undefined,
        pastDue: acc.pastDue ? Number(acc.pastDue) : undefined,
        creditLimit: acc.creditLimit ? Number(acc.creditLimit) : undefined,
        dateOpened: acc.dateOpened?.toISOString(),
        dateReported: acc.dateReported?.toISOString(),
        paymentStatus: acc.paymentStatus || undefined,
        confidenceScore: acc.confidenceScore || 50,
        detectedIssues,
        isDisputable: acc.isDisputable || detectedIssues.length > 0,
      };
    });

    const existingDisputeData: ExistingDispute[] = existingDisputes.map((d) => ({
      id: d.id,
      accountId: d.items[0]?.accountItemId || "",
      cra: d.cra as CRA,
      flow: d.flow as DisputeFlow,
      round: d.round,
      status: d.status as ExistingDispute["status"],
      sentDate: d.sentDate || undefined,
      responseOutcome: d.responseOutcome as ExistingDispute["responseOutcome"] | undefined,
      deadlineDate: d.deadlineDate || undefined,
    }));

    // Generate strategy (preview only, no disputes created)
    const strategy = await analyzeReportAndGenerateStrategy(
      parsedAccounts,
      existingDisputeData,
      session.user.organizationId,
      { useAI: true }
    );

    return NextResponse.json({
      success: true,
      clientId,
      totalAccounts: accounts.length,
      disputableAccounts: parsedAccounts.filter((a) => a.isDisputable).length,
      strategy,
    });
  } catch (error) {
    captureError(error as Error, {
      action: "ai_strategy_preview",
    });

    log.error({ err: error }, "Error getting AI strategy");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get strategy" },
      { status: 500 }
    );
  }
}

/**
 * Map database account status to AI engine format
 */
function mapAccountStatus(status: string | null): ParsedAccount["accountStatus"] {
  if (!status) return undefined;
  const mapping: Record<string, ParsedAccount["accountStatus"]> = {
    OPEN: "OPEN",
    CLOSED: "CLOSED",
    PAID: "PAID",
    PAID_CLOSED: "PAID",
    CHARGE_OFF: "CHARGED_OFF",
    CHARGED_OFF: "CHARGED_OFF",
    COLLECTION: "COLLECTION",
    IN_COLLECTION: "COLLECTION",
    DEROGATORY: "DEROGATORY",
  };
  return mapping[status.toUpperCase()] || undefined;
}
