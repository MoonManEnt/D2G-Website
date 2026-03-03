/**
 * Unified Dispute Creation
 *
 * Main creation logic that:
 * 1. Creates Dispute records with proper aiStrategy metadata
 * 2. Stores letter content in Document (single source of truth)
 * 3. Logs events consistently
 * 4. Returns unified response format
 */

import prisma from "@/lib/prisma";
import {
  CRA,
  UnifiedDisputeRequest,
  DisputeCreationType,
  DisputeClientData,
  DisputeAccountData,
  AIStrategyMetadata,
  CreatedDisputeInfo,
  UnifiedDisputeResponse,
  DisputeFlow,
} from "./types";
import { getNextRound } from "./validation";
import {
  generateLetter,
  getDisputeReasonForAccount,
  parseDetectedIssues,
  GeneratedLetterResult,
} from "./letter-strategies";
import {
  analyzeReportAndGenerateStrategy,
  type ParsedAccount,
  type ExistingDispute,
  type CRA as RulesEngineCRA,
  type DisputeFlow as RulesEngineFlow,
} from "@/lib/ai-rules-engine";

/**
 * Context for dispute creation
 */
export interface CreateDisputeContext {
  client: DisputeClientData;
  accounts: DisputeAccountData[];
  organizationId: string;
  userId: string;
  userEmail: string;
}

/**
 * Create a single dispute with its document
 */
async function createSingleDispute(
  type: DisputeCreationType,
  context: CreateDisputeContext,
  cra: CRA,
  flow: DisputeFlow,
  round: number,
  accountsForDispute: DisputeAccountData[],
  aiStrategyOverride?: Partial<AIStrategyMetadata>,
  disputeItemOverrides?: Array<{
    accountId: string;
    disputeReason?: string;
    suggestedFlow?: string;
    priorityScore?: number;
  }>
): Promise<CreatedDisputeInfo> {
  const { client, organizationId, userId, userEmail } = context;

  // Create the dispute first (we need the ID for letter generation)
  const dispute = await prisma.dispute.create({
    data: {
      clientId: client.id,
      organizationId,
      cra,
      flow,
      round,
      status: "DRAFT",
      // Note: We don't set letterContent here - Document is the source of truth
      items: {
        create: accountsForDispute.map((account) => {
          const override = disputeItemOverrides?.find(
            (o) => o.accountId === account.id
          );
          return {
            accountItemId: account.id,
            disputeReason:
              override?.disputeReason || getDisputeReasonForAccount(account),
            suggestedFlow: override?.suggestedFlow || undefined,
            priorityScore: override?.priorityScore || undefined,
          };
        }),
      },
    },
    include: {
      items: true,
    },
  });

  // Generate letter using the appropriate strategy
  let letterResult: GeneratedLetterResult;
  try {
    letterResult = await generateLetter(
      type,
      client,
      accountsForDispute,
      cra,
      flow,
      round,
      organizationId,
      dispute.id
    );
  } catch (error) {
    // If letter generation fails, delete the dispute and rethrow
    await prisma.dispute.delete({ where: { id: dispute.id } });
    throw error;
  }

  // Build complete AI strategy metadata
  const completeAiStrategy: AIStrategyMetadata = {
    ...letterResult.aiMetadata,
    ...aiStrategyOverride,
    type,
    generatedAt: new Date().toISOString(),
  };

  // Update dispute with AI strategy (but NOT letterContent)
  await prisma.dispute.update({
    where: { id: dispute.id },
    data: {
      aiStrategy: JSON.stringify(completeAiStrategy),
    },
  });

  // Create the Document - this is the SINGLE SOURCE OF TRUTH for letter content
  const document = await prisma.document.create({
    data: {
      documentType: "DISPUTE_LETTER",
      title: letterResult.title,
      content: letterResult.content,
      statutesCited: JSON.stringify(letterResult.statutesCited),
      approvalStatus: "DRAFT",
      disputeId: dispute.id,
      organizationId,
      createdById: userId,
      aiGenerated: letterResult.aiGenerated,
      aiMetadata: JSON.stringify(letterResult.aiMetadata),
    },
  });

  // Log the event
  await prisma.eventLog.create({
    data: {
      eventType:
        type === "ai"
          ? "AI_DISPUTE_CREATED"
          : type === "amelia"
          ? "DOCUMENT_GENERATED"
          : "DISPUTE_CREATED",
      actorId: userId,
      actorEmail: userEmail,
      targetType: "Dispute",
      targetId: dispute.id,
      eventData: JSON.stringify({
        type,
        cra,
        flow,
        round,
        accountCount: accountsForDispute.length,
        documentId: document.id,
        aiGenerated: letterResult.aiGenerated,
      }),
      organizationId,
    },
  });

  return {
    disputeId: dispute.id,
    cra,
    flow,
    round,
    itemCount: dispute.items.length,
    documentId: document.id,
    status: "DRAFT",
  };
}

// =============================================================================
// SIMPLE DISPUTE CREATION
// =============================================================================

async function createSimpleDispute(
  request: UnifiedDisputeRequest & { type: "simple" },
  context: CreateDisputeContext
): Promise<UnifiedDisputeResponse> {
  const { accounts } = context;
  const cra = request.cra!;
  const flow = request.flow!;

  // Get next round
  const round = await getNextRound(context.client.id, cra);

  // Create the dispute
  const disputeInfo = await createSingleDispute(
    "simple",
    context,
    cra,
    flow,
    round,
    accounts
  );

  return {
    success: true,
    type: "simple",
    disputes: [disputeInfo],
  };
}

// =============================================================================
// AI DISPUTE CREATION
// =============================================================================

async function createAIDispute(
  request: UnifiedDisputeRequest & { type: "ai" },
  context: CreateDisputeContext
): Promise<UnifiedDisputeResponse> {
  const { client, accounts, organizationId } = context;
  const options = request.options || {};

  // Get existing disputes for these accounts
  const existingDisputes = await prisma.dispute.findMany({
    where: {
      clientId: client.id,
      items: {
        some: {
          accountItemId: { in: request.accountIds },
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

  // Convert accounts to AI engine format
  const parsedAccounts: ParsedAccount[] = accounts.map((acc) => {
    const detectedIssues = parseDetectedIssues(acc.detectedIssues);

    return {
      id: acc.id,
      creditorName: acc.creditorName,
      maskedAccountId: acc.maskedAccountId || undefined,
      cra: acc.cra as RulesEngineCRA,
      accountType: acc.accountType || undefined,
      accountStatus: mapAccountStatus(acc.accountStatus),
      balance: acc.balance ? Number(acc.balance) : undefined,
      pastDue: acc.pastDue ? Number(acc.pastDue) : undefined,
      creditLimit: acc.creditLimit ? Number(acc.creditLimit) : undefined,
      dateOpened: acc.dateOpened?.toISOString(),
      dateReported: acc.dateReported?.toISOString(),
      paymentStatus: acc.paymentStatus || undefined,
      confidenceScore: acc.confidenceScore || 50,
      detectedIssues: detectedIssues.map((i) => ({
        code: i.code,
        description: i.description,
        severity: (i.severity || "MEDIUM") as "HIGH" | "MEDIUM" | "LOW",
        suggestedFlow: (i.suggestedFlow || "ACCURACY") as RulesEngineFlow,
        legalCitation: i.fcraSection,
      })),
      isDisputable: acc.isDisputable || detectedIssues.length > 0,
    };
  });

  const existingDisputeData: ExistingDispute[] = existingDisputes.map((d) => ({
    id: d.id,
    accountId: d.items[0]?.accountItemId || "",
    cra: d.cra as RulesEngineCRA,
    flow: d.flow as RulesEngineFlow,
    round: d.round,
    status: d.status as ExistingDispute["status"],
    sentDate: d.sentDate || undefined,
    responseOutcome: d.responseOutcome as
      | ExistingDispute["responseOutcome"]
      | undefined,
    deadlineDate: d.deadlineDate || undefined,
  }));

  // Analyze and generate strategy
  const strategy = await analyzeReportAndGenerateStrategy(
    parsedAccounts,
    existingDisputeData,
    organizationId,
    {
      useAI: options.useAI !== false,
      maxAccountsPerBatch: options.maxAccountsPerBatch || 5,
      focusBureaus: options.focusBureaus,
    }
  );

  // If no recommendations, return early
  if (strategy.recommendations.length === 0) {
    return {
      success: true,
      type: "ai",
      disputes: [],
      message:
        "No disputable items found or all items already have disputes in progress",
      warnings: strategy.warnings,
    };
  }

  // If preview only, return strategy without creating disputes
  if (options.previewOnly) {
    return {
      success: true,
      type: "ai",
      disputes: [],
      strategy: {
        overallStrategy: strategy.overallStrategy,
        timeline: strategy.timeline,
        crossBureauPlan: strategy.crossBureauPlan,
        recommendations: strategy.recommendations.map((r) => ({
          creditorName: r.creditorName,
          priority: r.priority,
          estimatedSuccessRate: Math.round(r.estimatedSuccessRate * 100) + "%",
        })),
      },
      message: "Preview mode - no disputes created",
      warnings: strategy.warnings,
    };
  }

  // Group recommendations by CRA
  const byCRA = strategy.recommendations.reduce((acc, rec) => {
    if (!acc[rec.cra]) acc[rec.cra] = [];
    acc[rec.cra].push(rec);
    return acc;
  }, {} as Record<RulesEngineCRA, typeof strategy.recommendations>);

  // Create disputes for each CRA batch
  const createdDisputes: CreatedDisputeInfo[] = [];

  for (const [cra, recommendations] of Object.entries(byCRA) as [
    RulesEngineCRA,
    typeof strategy.recommendations
  ][]) {
    // Get most common flow for this CRA batch
    const flowCounts = recommendations.reduce((acc, r) => {
      acc[r.recommendedFlow] = (acc[r.recommendedFlow] || 0) + 1;
      return acc;
    }, {} as Record<RulesEngineFlow, number>);
    const flow = Object.entries(flowCounts).sort((a, b) => b[1] - a[1])[0][0] as DisputeFlow;

    // Determine round
    const lastDispute = await prisma.dispute.findFirst({
      where: { clientId: client.id, cra },
      orderBy: { round: "desc" },
    });
    const round =
      recommendations[0].suggestedRound || (lastDispute?.round || 0) + 1;

    // Get accounts for this CRA
    const craAccountIds = recommendations.map((r) => r.accountId);
    const craAccounts = accounts.filter((a) => craAccountIds.includes(a.id));

    // Build AI strategy override with recommendations
    const aiStrategyOverride: Partial<AIStrategyMetadata> = {
      recommendations: recommendations.map((r) => ({
        accountId: r.accountId,
        priority: r.priority,
        reasoning: r.reasoning,
        successRate: r.estimatedSuccessRate,
      })),
      crossBureauPlan: strategy.crossBureauPlan,
      timeline: strategy.timeline,
      overallStrategy: strategy.overallStrategy,
    };

    // Build dispute item overrides
    const disputeItemOverrides = recommendations.map((rec) => ({
      accountId: rec.accountId,
      disputeReason: rec.reasoning,
      suggestedFlow: rec.recommendedFlow,
      priorityScore: rec.impactScore,
    }));

    // Create the dispute
    const disputeInfo = await createSingleDispute(
      "ai",
      context,
      cra as CRA,
      flow,
      round,
      craAccounts,
      aiStrategyOverride,
      disputeItemOverrides
    );

    createdDisputes.push(disputeInfo);
  }

  return {
    success: true,
    type: "ai",
    disputes: createdDisputes,
    strategy: {
      overallStrategy: strategy.overallStrategy,
      timeline: strategy.timeline,
      crossBureauPlan: strategy.crossBureauPlan,
      recommendations: strategy.recommendations.map((r) => ({
        creditorName: r.creditorName,
        priority: r.priority,
        estimatedSuccessRate: Math.round(r.estimatedSuccessRate * 100) + "%",
      })),
    },
    warnings: strategy.warnings,
  };
}

/**
 * Map database account status to AI engine format
 */
function mapAccountStatus(
  status: string | null
): ParsedAccount["accountStatus"] {
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

// =============================================================================
// AMELIA DISPUTE CREATION
// =============================================================================

async function createAmeliaDispute(
  request: UnifiedDisputeRequest & { type: "amelia" },
  context: CreateDisputeContext
): Promise<UnifiedDisputeResponse> {
  const { accounts } = context;
  const cra = request.cra!;

  // Determine flow from accounts if not specified
  const flow: DisputeFlow =
    request.flow || determineFlowFromAccounts(accounts);

  // Get next round
  const round = await getNextRound(context.client.id, cra);

  // Create the dispute
  const disputeInfo = await createSingleDispute(
    "amelia",
    context,
    cra,
    flow,
    round,
    accounts
  );

  // Fetch the document to get AMELIA metadata
  const document = await prisma.document.findUnique({
    where: { id: disputeInfo.documentId },
    select: { aiMetadata: true },
  });

  let ameliaMetadata: AIStrategyMetadata | null = null;
  if (document?.aiMetadata) {
    try {
      ameliaMetadata = JSON.parse(document.aiMetadata);
    } catch {
      // Ignore parse errors
    }
  }

  return {
    success: true,
    type: "amelia",
    disputes: [disputeInfo],
    metadata: ameliaMetadata
      ? {
          letterDate: ameliaMetadata.letterDate,
          isBackdated: ameliaMetadata.isBackdated,
          backdatedDays: ameliaMetadata.backdatedDays,
          tone: ameliaMetadata.tone,
          ameliaVersion: ameliaMetadata.ameliaVersion,
        }
      : undefined,
  };
}

/**
 * Determine flow from account data
 */
function determineFlowFromAccounts(
  accounts: DisputeAccountData[]
): DisputeFlow {
  const hasCollection = accounts.some(
    (a) =>
      a.accountStatus?.toUpperCase() === "COLLECTION" ||
      a.accountType?.toLowerCase().includes("collection")
  );

  if (hasCollection) {
    return "COLLECTION";
  }

  return "ACCURACY";
}

// =============================================================================
// HUMAN-FIRST DISPUTE CREATION (Recommended)
// =============================================================================

async function createHumanFirstDispute(
  request: UnifiedDisputeRequest & { type: "human_first" },
  context: CreateDisputeContext
): Promise<UnifiedDisputeResponse> {
  const { accounts, organizationId } = context;
  const cra = request.cra!;

  // Determine flow from accounts if not specified
  const flow: DisputeFlow =
    request.flow || determineFlowFromAccounts(accounts);

  // Get next round
  const round = await getNextRound(context.client.id, cra);

  // Get last dispute date for follow-up reference
  const lastDispute = await prisma.dispute.findFirst({
    where: {
      clientId: context.client.id,
      cra,
      status: { in: ["SENT", "RESPONDED"] },
    },
    orderBy: { sentDate: "desc" },
    select: { sentDate: true },
  });

  const lastDisputeDate = lastDispute?.sentDate
    ? lastDispute.sentDate.toISOString().split("T")[0]
    : undefined;

  // Create the dispute
  const disputeInfo = await createSingleDispute(
    "human_first",
    context,
    cra,
    flow,
    round,
    accounts,
    undefined,
    undefined
  );

  // Fetch the document to get human-first metadata
  const document = await prisma.document.findUnique({
    where: { id: disputeInfo.documentId },
    select: { aiMetadata: true },
  });

  let humanFirstMetadata: AIStrategyMetadata | null = null;
  if (document?.aiMetadata) {
    try {
      humanFirstMetadata = JSON.parse(document.aiMetadata);
    } catch {
      // Ignore parse errors
    }
  }

  return {
    success: true,
    type: "human_first",
    disputes: [disputeInfo],
    metadata: humanFirstMetadata
      ? {
          letterDate: humanFirstMetadata.letterDate,
          isBackdated: humanFirstMetadata.isBackdated,
          backdatedDays: humanFirstMetadata.backdatedDays,
          tone: humanFirstMetadata.tone,
          letterStyle: "HUMAN_FIRST",
          storyUsed: humanFirstMetadata.storyUsed,
        }
      : undefined,
  };
}

// =============================================================================
// SENTRY DISPUTE CREATION
// =============================================================================

async function createSentryDispute(
  request: UnifiedDisputeRequest & { type: "sentry" },
  context: CreateDisputeContext
): Promise<UnifiedDisputeResponse> {
  const { accounts } = context;
  const cra = request.cra!;

  // Determine flow from accounts if not specified
  const flow: DisputeFlow =
    request.flow || determineFlowFromAccounts(accounts);

  // Get next round
  const round = await getNextRound(context.client.id, cra);

  // Create the dispute
  const disputeInfo = await createSingleDispute(
    "sentry",
    context,
    cra,
    flow,
    round,
    accounts
  );

  return {
    success: true,
    type: "sentry",
    disputes: [disputeInfo],
  };
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

/**
 * Create unified dispute based on type
 *
 * Supported types:
 * - "human_first" (RECOMMENDED): Story-first, simple language, legal footer at end
 * - "amelia": Full AMELIA doctrine with backdating and personal info disputes
 * - "ai": AI rules engine with strategy analysis
 * - "simple": Basic template-based generation
 */
export async function createUnifiedDispute(
  request: UnifiedDisputeRequest,
  context: CreateDisputeContext
): Promise<UnifiedDisputeResponse> {
  switch (request.type) {
    case "simple":
      return createSimpleDispute(request as UnifiedDisputeRequest & { type: "simple" }, context);

    case "ai":
      return createAIDispute(request as UnifiedDisputeRequest & { type: "ai" }, context);

    case "amelia":
      return createAmeliaDispute(request as UnifiedDisputeRequest & { type: "amelia" }, context);

    case "human_first":
      return createHumanFirstDispute(request as UnifiedDisputeRequest & { type: "human_first" }, context);

    case "sentry":
      return createSentryDispute(request as UnifiedDisputeRequest & { type: "sentry" }, context);

    default:
      throw new Error(`Unknown dispute creation type: ${(request as { type: string }).type}`);
  }
}
