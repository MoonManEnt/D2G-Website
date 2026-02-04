/**
 * LLM Orchestration Layer
 *
 * Provides intelligent routing between Claude and OpenAI with:
 * - A/B testing to compare model performance
 * - Automatic failover
 * - Cost and latency tracking
 * - Quality metrics collection
 * - Streaming support for chat interfaces
 */

import { generateText, streamText, type ModelMessage } from "ai";
import { getModel, isProviderAvailable } from "@/lib/ai/providers";
import prisma from "@/lib/prisma";

// Types
export type LLMProvider = "CLAUDE" | "OPENAI";
export type TaskType =
  | "DISPUTE_STRATEGY"
  | "LETTER_GENERATION"
  | "CFPB_COMPLAINT"
  | "ISSUE_ANALYSIS"
  | "CHAT"
  | "RECOMMENDATION";

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMRequest {
  taskType: TaskType;
  prompt: string;
  systemPrompt?: string;
  organizationId: string;
  context?: {
    flow?: string;
    round?: number;
    cra?: string;
    disputeId?: string;
  };
}

export interface LLMStreamRequest extends LLMRequest {
  messages: ModelMessage[];
}

export interface LLMResponse {
  content: string;
  provider: LLMProvider;
  model: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costCents: number;
  requestId: string;
}

// Model configurations with pricing (per 1M tokens)
const MODEL_CONFIGS: Record<LLMProvider, Record<string, { inputPrice: number; outputPrice: number }>> = {
  CLAUDE: {
    "claude-sonnet-4-20250514": { inputPrice: 3.00, outputPrice: 15.00 },
    "claude-opus-4-20250514": { inputPrice: 15.00, outputPrice: 75.00 },
    "claude-3-5-haiku-20241022": { inputPrice: 0.80, outputPrice: 4.00 },
  },
  OPENAI: {
    "gpt-4-turbo": { inputPrice: 10.00, outputPrice: 30.00 },
    "gpt-4o": { inputPrice: 2.50, outputPrice: 10.00 },
    "gpt-4o-mini": { inputPrice: 0.15, outputPrice: 0.60 },
  },
};

// Default models per task type (can be overridden by learning)
const DEFAULT_MODELS: Record<TaskType, LLMConfig> = {
  DISPUTE_STRATEGY: { provider: "CLAUDE", model: "claude-sonnet-4-20250514", temperature: 0.3 },
  LETTER_GENERATION: { provider: "CLAUDE", model: "claude-sonnet-4-20250514", temperature: 0.4 },
  CFPB_COMPLAINT: { provider: "CLAUDE", model: "claude-sonnet-4-20250514", temperature: 0.3 },
  ISSUE_ANALYSIS: { provider: "OPENAI", model: "gpt-4o", temperature: 0.2 },
  CHAT: { provider: "CLAUDE", model: "claude-sonnet-4-20250514", temperature: 0.4 },
  RECOMMENDATION: { provider: "CLAUDE", model: "claude-3-5-haiku-20241022", temperature: 0.2 },
};

// Calculate cost in cents
function calculateCost(
  provider: LLMProvider,
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = MODEL_CONFIGS[provider]?.[model];
  if (!pricing) return 0;

  const inputCost = (promptTokens / 1_000_000) * pricing.inputPrice;
  const outputCost = (completionTokens / 1_000_000) * pricing.outputPrice;

  return Math.round((inputCost + outputCost) * 100); // Convert to cents
}

// Get the best provider for a task based on historical performance
async function getBestProvider(taskType: TaskType): Promise<LLMConfig> {
  // Check if A/B testing is enabled
  const abTestEnabled = process.env.AI_ENABLE_AB_TESTING === "true";

  if (abTestEnabled) {
    // 20% chance to use alternate provider for A/B testing
    if (Math.random() < 0.2) {
      const defaultConfig = DEFAULT_MODELS[taskType];
      const alternateProvider: LLMProvider = defaultConfig.provider === "CLAUDE" ? "OPENAI" : "CLAUDE";
      if (isProviderAvailable(alternateProvider)) {
        const alternateModel = alternateProvider === "CLAUDE"
          ? "claude-sonnet-4-20250514"
          : "gpt-4o";
        return { provider: alternateProvider, model: alternateModel, temperature: defaultConfig.temperature };
      }
    }
  }

  // Check for learned preferences (stats from last 30 days)
  try {
    const stats = await prisma.lLMProviderStats.findMany({
      where: {
        taskType,
        periodStart: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { periodStart: "desc" },
      take: 2,
    });

    if (stats.length >= 2) {
      const claudeStats = stats.find((s) => s.provider === "CLAUDE");
      const openaiStats = stats.find((s) => s.provider === "OPENAI");

      if (claudeStats && openaiStats) {
        const claudeScore = claudeStats.acceptanceRate * 100 - claudeStats.avgCostCents;
        const openaiScore = openaiStats.acceptanceRate * 100 - openaiStats.avgCostCents;

        if (openaiScore > claudeScore + 10 && isProviderAvailable("OPENAI")) {
          return { provider: "OPENAI", model: "gpt-4o", temperature: DEFAULT_MODELS[taskType].temperature };
        }
      }
    }
  } catch (error) {
    console.error("Error fetching provider stats:", error);
  }

  return DEFAULT_MODELS[taskType];
}

// Main orchestration function
export async function completeLLM(request: LLMRequest): Promise<LLMResponse> {
  const startTime = Date.now();
  const config = await getBestProvider(request.taskType);

  const systemPrompt = request.systemPrompt || getDefaultSystemPrompt(request.taskType);

  let content: string;
  let promptTokens: number;
  let completionTokens: number;
  let wasError = false;
  let errorMessage: string | undefined;
  let activeConfig = { ...config };

  try {
    const result = await generateText({
      model: getModel(activeConfig.provider, activeConfig.model),
      system: systemPrompt,
      prompt: request.prompt,
      maxOutputTokens: activeConfig.maxTokens || 4096,
      temperature: activeConfig.temperature ?? 0.3,
    });

    content = result.text;
    promptTokens = result.usage.inputTokens || 0;
    completionTokens = result.usage.outputTokens || 0;
  } catch (error) {
    wasError = true;
    errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Try fallback provider if enabled
    if (process.env.AI_FALLBACK_ENABLED !== "false") {
      const fallbackProvider: LLMProvider = activeConfig.provider === "CLAUDE" ? "OPENAI" : "CLAUDE";
      const fallbackModel = fallbackProvider === "CLAUDE" ? "claude-sonnet-4-20250514" : "gpt-4o";

      if (isProviderAvailable(fallbackProvider)) {
        console.warn(`Primary provider ${activeConfig.provider} failed, trying ${fallbackProvider}`);

        try {
          const result = await generateText({
            model: getModel(fallbackProvider, fallbackModel),
            system: systemPrompt,
            prompt: request.prompt,
            maxOutputTokens: activeConfig.maxTokens || 4096,
            temperature: activeConfig.temperature ?? 0.3,
          });

          content = result.text;
          promptTokens = result.usage.inputTokens || 0;
          completionTokens = result.usage.outputTokens || 0;
          activeConfig.provider = fallbackProvider;
          activeConfig.model = fallbackModel;
          wasError = false;
        } catch (fallbackError) {
          throw new Error(
            `Both providers failed. Primary: ${errorMessage}. Fallback: ${fallbackError instanceof Error ? fallbackError.message : "Unknown"}`
          );
        }
      } else {
        throw error;
      }
    } else {
      throw error;
    }
  }

  const latencyMs = Date.now() - startTime;
  const costCents = calculateCost(activeConfig.provider, activeConfig.model, promptTokens, completionTokens);

  // Log the request
  const logEntry = await prisma.lLMRequest.create({
    data: {
      taskType: request.taskType,
      provider: activeConfig.provider,
      model: activeConfig.model,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      latencyMs,
      costCents,
      flow: request.context?.flow,
      round: request.context?.round,
      cra: request.context?.cra,
      disputeId: request.context?.disputeId,
      wasError,
      errorMessage,
      organizationId: request.organizationId,
    },
  });

  return {
    content,
    provider: activeConfig.provider,
    model: activeConfig.model,
    latencyMs,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    costCents,
    requestId: logEntry.id,
  };
}

/**
 * Streaming LLM call for chat interfaces.
 * Returns a streamText result that can be converted to a Response via toDataStreamResponse().
 */
export async function streamLLM(request: LLMStreamRequest) {
  const config = await getBestProvider(request.taskType);
  const systemPrompt = request.systemPrompt || getDefaultSystemPrompt(request.taskType);

  const result = streamText({
    model: getModel(config.provider, config.model),
    system: systemPrompt,
    messages: request.messages,
    maxOutputTokens: config.maxTokens || 2048,
    temperature: config.temperature ?? 0.4,
    onFinish: async ({ text, usage }) => {
      const inputTokens = usage.inputTokens || 0;
      const outputTokens = usage.outputTokens || 0;
      const costCents = calculateCost(
        config.provider,
        config.model,
        inputTokens,
        outputTokens
      );

      try {
        await prisma.lLMRequest.create({
          data: {
            taskType: request.taskType,
            provider: config.provider,
            model: config.model,
            promptTokens: inputTokens,
            completionTokens: outputTokens,
            totalTokens: inputTokens + outputTokens,
            latencyMs: 0, // Streaming — no single latency value
            costCents,
            flow: request.context?.flow,
            round: request.context?.round,
            cra: request.context?.cra,
            disputeId: request.context?.disputeId,
            wasError: false,
            organizationId: request.organizationId,
          },
        });
      } catch (logError) {
        console.error("Failed to log streaming LLM request:", logError);
      }
    },
  });

  return result;
}

// Record user feedback on an LLM response
export async function recordLLMFeedback(
  requestId: string,
  feedback: {
    accepted?: boolean;
    edited?: boolean;
    editDistance?: number;
  }
): Promise<void> {
  await prisma.lLMRequest.update({
    where: { id: requestId },
    data: {
      userAccepted: feedback.accepted,
      userEdited: feedback.edited,
      editDistance: feedback.editDistance,
    },
  });
}

// Record dispute outcome for learning
export async function recordDisputeOutcome(
  disputeId: string,
  outcome: "RESOLVED" | "REJECTED" | "PENDING"
): Promise<void> {
  await prisma.lLMRequest.updateMany({
    where: { disputeId },
    data: { disputeOutcome: outcome },
  });
}

// Get LLM usage stats for dashboard
export async function getLLMStats(organizationId: string, days: number = 30): Promise<{
  totalRequests: number;
  totalCostCents: number;
  avgLatencyMs: number;
  acceptanceRate: number;
  byProvider: Record<string, { requests: number; cost: number; avgLatency: number }>;
  byTaskType: Record<string, { requests: number; cost: number }>;
}> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const requests = await prisma.lLMRequest.findMany({
    where: {
      organizationId,
      createdAt: { gte: since },
    },
  });

  const totalRequests = requests.length;
  const totalCostCents = requests.reduce((sum, r) => sum + r.costCents, 0);
  const avgLatencyMs = totalRequests > 0
    ? requests.reduce((sum, r) => sum + r.latencyMs, 0) / totalRequests
    : 0;

  const acceptedCount = requests.filter((r) => r.userAccepted === true).length;
  const feedbackCount = requests.filter((r) => r.userAccepted !== null).length;
  const acceptanceRate = feedbackCount > 0 ? acceptedCount / feedbackCount : 0;

  const byProvider: Record<string, { requests: number; cost: number; avgLatency: number }> = {};
  for (const r of requests) {
    if (!byProvider[r.provider]) {
      byProvider[r.provider] = { requests: 0, cost: 0, avgLatency: 0 };
    }
    byProvider[r.provider].requests++;
    byProvider[r.provider].cost += r.costCents;
    byProvider[r.provider].avgLatency += r.latencyMs;
  }
  for (const provider of Object.keys(byProvider)) {
    byProvider[provider].avgLatency /= byProvider[provider].requests;
  }

  const byTaskType: Record<string, { requests: number; cost: number }> = {};
  for (const r of requests) {
    if (!byTaskType[r.taskType]) {
      byTaskType[r.taskType] = { requests: 0, cost: 0 };
    }
    byTaskType[r.taskType].requests++;
    byTaskType[r.taskType].cost += r.costCents;
  }

  return {
    totalRequests,
    totalCostCents,
    avgLatencyMs,
    acceptanceRate,
    byProvider,
    byTaskType,
  };
}

// Default system prompts for each task type
function getDefaultSystemPrompt(taskType: TaskType): string {
  switch (taskType) {
    case "DISPUTE_STRATEGY":
      return `You are an expert credit repair strategist with deep knowledge of the Fair Credit Reporting Act (FCRA), Fair Debt Collection Practices Act (FDCPA), and credit bureau dispute procedures.

Your role is to analyze credit report data and recommend the optimal dispute strategy. Consider:
- Account types and their typical dispute success rates
- Appropriate dispute flow (Accuracy, Collection, Consent, or Combo)
- Round-based escalation strategy
- Legal citations that apply to each situation
- Priority ordering of accounts to dispute

Provide specific, actionable recommendations with legal justification.`;

    case "LETTER_GENERATION":
      return `You are an expert legal document writer specializing in credit dispute letters. You have extensive knowledge of:
- Fair Credit Reporting Act (FCRA) requirements
- Fair Debt Collection Practices Act (FDCPA)
- eOSCAR system formatting requirements
- Credit bureau response procedures

Generate professional, legally compliant dispute letters that:
- Cite specific legal statutes appropriately
- Make clear, specific demands
- Maintain a professional but firm tone
- Include all required consumer information
- Follow proper formatting for eOSCAR submission`;

    case "CFPB_COMPLAINT":
      return `You are an expert at drafting CFPB (Consumer Financial Protection Bureau) complaints. You understand:
- The CFPB complaint submission process
- Effective complaint narrative structure
- How to document FCRA and FDCPA violations
- What language and evidence is most effective

Generate complaint narratives that are:
- Clear and factual
- Properly document violations with dates and specifics
- Reference applicable laws and regulations
- Request specific remedies
- Formatted for easy copy/paste into CFPB.gov`;

    case "ISSUE_ANALYSIS":
      return `You are a credit report analyst expert at identifying reporting errors, FCRA violations, and disputable items. You can identify:
- Data inconsistencies across credit bureaus
- Re-aged accounts
- Duplicate reporting
- Balance discrepancies
- Date discrepancies
- Improper account statuses
- Collection account issues
- Permissible purpose violations

Analyze credit data and identify specific, actionable issues with supporting evidence.`;

    case "CHAT":
      return `You are Amelia, an AI credit repair specialist assistant in Dispute2Go.

You help credit repair specialists with:
- Analyzing client credit reports and identifying disputable items
- Recommending dispute strategies (which flow, which round, which CRA)
- Explaining FCRA/FDCPA legal concepts in plain language
- Suggesting next steps based on CRA responses
- Answering questions about dispute outcomes and patterns

Guidelines:
- Be concise and actionable
- Always cite specific FCRA sections when discussing legal rights
- When recommending strategies, explain WHY
- If you don't have enough context, ask clarifying questions
- Never provide legal advice — you provide dispute strategy recommendations`;

    case "RECOMMENDATION":
      return `You are Amelia, an AI credit repair analyst. Analyze client data and provide brief, actionable recommendations. Be concise — each recommendation should be 1-2 sentences.`;

    default:
      return "You are a helpful assistant specializing in credit repair and consumer rights.";
  }
}

// Convenience function for generating dispute letters
export async function generateDisputeLetter(
  params: {
    clientName: string;
    clientAddress: string;
    clientCity: string;
    clientState: string;
    clientZip: string;
    clientSSNLast4?: string;
    clientDOB?: string;
    cra: "EQUIFAX" | "EXPERIAN" | "TRANSUNION";
    accounts: Array<{
      creditorName: string;
      accountNumber?: string;
      accountType?: string;
      balance?: number;
      issues: string[];
    }>;
    flow: "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO" | "METRO2";
    round: number;
  },
  organizationId: string
): Promise<{
  letterContent: string;
  requestId: string;
}> {
  const craFullNames = {
    EQUIFAX: "Equifax Information Services LLC",
    EXPERIAN: "Experian",
    TRANSUNION: "TransUnion LLC",
  };

  const craAddresses = {
    EQUIFAX: "P.O. Box 740256, Atlanta, GA 30374-0256",
    EXPERIAN: "P.O. Box 4500, Allen, TX 75013",
    TRANSUNION: "P.O. Box 2000, Chester, PA 19016",
  };

  const prompt = `Generate a professional credit dispute letter with the following details:

CLIENT INFORMATION:
- Name: ${params.clientName}
- Address: ${params.clientAddress}, ${params.clientCity}, ${params.clientState} ${params.clientZip}
${params.clientSSNLast4 ? `- SSN (last 4): XXX-XX-${params.clientSSNLast4}` : ""}
${params.clientDOB ? `- Date of Birth: ${params.clientDOB}` : ""}

RECIPIENT:
- ${craFullNames[params.cra]}
- ${craAddresses[params.cra]}

DISPUTE TYPE: ${params.flow} (Round ${params.round})

ACCOUNTS TO DISPUTE:
${params.accounts.map((a, i) => `
${i + 1}. ${a.creditorName}
   ${a.accountNumber ? `Account #: ${a.accountNumber}` : ""}
   ${a.accountType ? `Type: ${a.accountType}` : ""}
   ${a.balance ? `Balance: $${a.balance}` : ""}
   Issues: ${a.issues.join(", ")}
`).join("\n")}

Generate a formal dispute letter that:
1. Opens with proper date and addressing
2. Clearly identifies the consumer
3. Specifically identifies each disputed account
4. States the dispute reason citing applicable FCRA sections
5. Requests investigation and verification
6. Demands removal if not verified within 30 days per FCRA 611
7. Requests method of verification documentation
8. Closes professionally with signature line

Use a professional but firm tone. Include relevant legal citations (15 USC 1681 et seq).`;

  const response = await completeLLM({
    taskType: "LETTER_GENERATION",
    prompt,
    organizationId,
    context: {
      flow: params.flow,
      round: params.round,
      cra: params.cra,
    },
  });

  return {
    letterContent: response.content,
    requestId: response.requestId,
  };
}

// Convenience function for CFPB complaint generation
export async function generateCFPBComplaint(
  params: {
    clientName: string;
    cra: "EQUIFAX" | "EXPERIAN" | "TRANSUNION";
    disputeHistory: Array<{
      date: string;
      action: string;
      response?: string;
    }>;
    issue: string;
    desiredResolution: string;
  },
  organizationId: string
): Promise<{
  complaintNarrative: string;
  requestId: string;
}> {
  const prompt = `Generate a CFPB complaint narrative for the following situation:

CONSUMER: ${params.clientName}
COMPANY: ${params.cra}

ISSUE: ${params.issue}

DISPUTE HISTORY:
${params.disputeHistory.map((h) => `- ${h.date}: ${h.action}${h.response ? ` (Response: ${h.response})` : ""}`).join("\n")}

DESIRED RESOLUTION: ${params.desiredResolution}

Generate a clear, factual CFPB complaint narrative that:
1. States the issue clearly in the first paragraph
2. Provides chronological timeline of events
3. Documents specific FCRA violations with dates
4. Explains harm caused to the consumer
5. States the desired resolution
6. Is formatted for easy copy/paste into CFPB.gov

Keep the tone professional and factual. Include specific dates and details.`;

  const response = await completeLLM({
    taskType: "CFPB_COMPLAINT",
    prompt,
    organizationId,
    context: {
      cra: params.cra,
    },
  });

  return {
    complaintNarrative: response.content,
    requestId: response.requestId,
  };
}

// Convenience function for dispute strategy
export async function getDisputeStrategy(
  accounts: Array<{
    creditorName: string;
    accountType?: string;
    balance?: number;
    issues: string[];
    cra: string;
  }>,
  organizationId: string,
  context?: { clientId?: string }
): Promise<{
  recommendations: Array<{
    accountIndex: number;
    recommendedFlow: string;
    priority: number;
    reasoning: string;
    suggestedRound: number;
  }>;
  overallStrategy: string;
  requestId: string;
}> {
  const prompt = `Analyze these credit report accounts and provide dispute strategy recommendations:

${JSON.stringify(accounts, null, 2)}

For each account, recommend:
1. Dispute flow (ACCURACY, COLLECTION, CONSENT, or COMBO)
2. Priority (1=highest, 3=lowest)
3. Brief reasoning citing applicable law
4. Suggested starting round

Also provide an overall strategy summary.

Respond in JSON format:
{
  "recommendations": [
    {
      "accountIndex": 0,
      "recommendedFlow": "ACCURACY",
      "priority": 1,
      "reasoning": "Account shows balance discrepancy - cite 15 USC 1681e(b)",
      "suggestedRound": 1
    }
  ],
  "overallStrategy": "Start with high-impact accuracy disputes..."
}`;

  const response = await completeLLM({
    taskType: "DISPUTE_STRATEGY",
    prompt,
    organizationId,
  });

  try {
    const parsed = JSON.parse(response.content);
    return {
      recommendations: parsed.recommendations,
      overallStrategy: parsed.overallStrategy,
      requestId: response.requestId,
    };
  } catch {
    return {
      recommendations: [],
      overallStrategy: response.content,
      requestId: response.requestId,
    };
  }
}
