/**
 * Amelia Context Assembler
 *
 * Builds tiered context for AI interactions based on the purpose:
 * - Tier 1 (~2K tokens, always): Client info, active accounts/disputes, personal info
 * - Tier 2 (~3K tokens, if fits): Last 3 round outcomes, score changes, response patterns
 * - Tier 3 (~1K tokens, summarized): Aggregate stats, best flows, most resistant CRAs
 *
 * Token budgets by purpose:
 * - LETTER: 8K tokens
 * - CHAT: 12K tokens
 * - DASHBOARD: 4K tokens
 */

import prisma from "@/lib/prisma";

export type ContextPurpose = "LETTER" | "CHAT" | "DASHBOARD";

const TOKEN_BUDGETS: Record<ContextPurpose, number> = {
  LETTER: 8000,
  CHAT: 12000,
  DASHBOARD: 4000,
};

// Rough estimation: 1 token ≈ 4 characters
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface AssembledContext {
  tier1: string; // Always included
  tier2: string | null; // Included if budget allows
  tier3: string | null; // Included if budget allows
  totalEstimatedTokens: number;
  clientSummary: {
    name: string;
    stage: string;
    currentRound: number;
    activeDisputes: number;
    totalAccounts: number;
    successRate: number | null;
  };
}

/**
 * Assemble full client context for AI consumption.
 * Automatically respects token budgets based on purpose.
 */
export async function assembleClientContext(
  clientId: string,
  orgId: string,
  purpose: ContextPurpose
): Promise<AssembledContext> {
  const budget = TOKEN_BUDGETS[purpose];

  // Tier 1: Core client data (always loaded)
  const tier1 = await buildTier1(clientId, orgId);
  const tier1Tokens = estimateTokens(tier1.text);

  let tier2: string | null = null;
  let tier2Tokens = 0;

  // Tier 2: Recent outcomes and patterns (if budget allows)
  if (tier1Tokens + 500 < budget) {
    const tier2Result = await buildTier2(clientId, orgId);
    tier2Tokens = estimateTokens(tier2Result);
    if (tier1Tokens + tier2Tokens < budget) {
      tier2 = tier2Result;
    }
  }

  let tier3: string | null = null;
  let tier3Tokens = 0;

  // Tier 3: Aggregate org patterns (if budget still allows)
  if (tier1Tokens + tier2Tokens + 500 < budget) {
    const tier3Result = await buildTier3(orgId);
    tier3Tokens = estimateTokens(tier3Result);
    if (tier1Tokens + tier2Tokens + tier3Tokens <= budget) {
      tier3 = tier3Result;
    }
  }

  return {
    tier1: tier1.text,
    tier2,
    tier3,
    totalEstimatedTokens: tier1Tokens + tier2Tokens + tier3Tokens,
    clientSummary: tier1.summary,
  };
}

/**
 * Format assembled context into a single prompt-ready string.
 */
export function formatContextForPrompt(context: AssembledContext): string {
  const parts = [context.tier1];
  if (context.tier2) parts.push(context.tier2);
  if (context.tier3) parts.push(context.tier3);
  return parts.join("\n\n");
}

// =============================================================================
// TIER 1: Core Client Data (always included)
// =============================================================================

async function buildTier1(
  clientId: string,
  orgId: string
): Promise<{
  text: string;
  summary: AssembledContext["clientSummary"];
}> {
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId: orgId },
    include: {
      accounts: {
        take: 20,
        orderBy: { createdAt: "desc" },
      },
      disputes: {
        where: { status: { not: "CANCELLED" } },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          cra: true,
          flow: true,
          round: true,
          status: true,
          createdAt: true,
          letterContent: true,
        },
      },
      personalInfoDisputes: {
        where: { status: "ACTIVE" },
        take: 20,
      },
    },
  });

  if (!client) {
    return {
      text: "CLIENT NOT FOUND",
      summary: {
        name: "Unknown",
        stage: "UNKNOWN",
        currentRound: 0,
        activeDisputes: 0,
        totalAccounts: 0,
        successRate: null,
      },
    };
  }

  const activeDisputes = client.disputes.filter(
    (d) => d.status === "PENDING" || d.status === "SENT" || d.status === "IN_PROGRESS"
  );

  // Build account summary
  const accountLines = client.accounts.map((a) => {
    const issues = a.detectedIssues ? JSON.parse(a.detectedIssues) : [];
    const issueCount = Array.isArray(issues) ? issues.length : 0;
    return `- ${a.creditorName} (${a.maskedAccountId || "****"}) | ${a.accountType || "N/A"} | Balance: $${a.balance || 0} | Status: ${a.paymentStatus || "N/A"} | Issues: ${issueCount}`;
  });

  // Build dispute summary
  const disputeLines = client.disputes.slice(0, 5).map((d) => {
    return `- ${d.cra} R${d.round} (${d.flow}) — ${d.status} [${d.createdAt.toLocaleDateString()}]`;
  });

  // Build personal info disputes
  const piDisputes = client.personalInfoDisputes;
  const piSummary = piDisputes.length > 0
    ? `Active personal info disputes: ${piDisputes.length} items across ${[...new Set(piDisputes.map((p) => p.cra))].join(", ")}`
    : "No active personal info disputes";

  const text = `=== CLIENT CONTEXT ===
Name: ${client.firstName} ${client.lastName}
Stage: ${client.stage} | Priority: ${client.priority} | Round: ${client.currentRound}
Success Rate: ${client.successRate != null ? `${client.successRate.toFixed(1)}%` : "N/A"}
Total Disputes Sent: ${client.totalDisputesSent} | Items Deleted: ${client.totalItemsDeleted}
Last Activity: ${client.lastActivityAt ? client.lastActivityAt.toLocaleDateString() : "Never"}

ACCOUNTS (${client.accounts.length} active):
${accountLines.length > 0 ? accountLines.join("\n") : "No accounts on file"}

RECENT DISPUTES (${client.disputes.length} total):
${disputeLines.length > 0 ? disputeLines.join("\n") : "No disputes yet"}

${piSummary}`;

  return {
    text,
    summary: {
      name: `${client.firstName} ${client.lastName}`,
      stage: client.stage,
      currentRound: client.currentRound,
      activeDisputes: activeDisputes.length,
      totalAccounts: client.accounts.length,
      successRate: client.successRate,
    },
  };
}

// =============================================================================
// TIER 2: Recent Outcomes & Score Changes
// =============================================================================

async function buildTier2(clientId: string, orgId: string): Promise<string> {
  // Fetch recent dispute outcomes (completed disputes)
  const completedDisputes = await prisma.dispute.findMany({
    where: {
      clientId,
      organizationId: orgId,
      status: { in: ["RESOLVED", "COMPLETED", "VERIFIED", "REJECTED"] },
    },
    orderBy: { updatedAt: "desc" },
    take: 6,
    select: {
      cra: true,
      flow: true,
      round: true,
      status: true,
      updatedAt: true,
      items: {
        select: {
          accountItem: {
            select: {
              creditorName: true,
            },
          },
        },
      },
    },
  });

  // Fetch credit score history
  const scores = await prisma.creditScore.findMany({
    where: { clientId },
    orderBy: { scoreDate: "desc" },
    take: 6,
    select: {
      cra: true,
      score: true,
      scoreDate: true,
    },
  });

  // Build outcome section
  const outcomeLines = completedDisputes.map((d) => {
    const creditors = d.items
      .map((i) => i.accountItem?.creditorName)
      .filter(Boolean)
      .join(", ");
    return `- ${d.cra} R${d.round} (${d.flow}) → ${d.status} | ${creditors || "N/A"} [${d.updatedAt.toLocaleDateString()}]`;
  });

  // Build score section — group by CRA, show trend
  const scoresByCRA = new Map<string, { score: number; date: Date }[]>();
  for (const s of scores) {
    const cra = s.cra || "Unknown";
    if (!scoresByCRA.has(cra)) scoresByCRA.set(cra, []);
    scoresByCRA.get(cra)!.push({ score: s.score, date: s.scoreDate });
  }

  const scoreLines: string[] = [];
  for (const [bureau, entries] of scoresByCRA) {
    if (entries.length >= 2) {
      const latest = entries[0];
      const previous = entries[1];
      const diff = latest.score - previous.score;
      const arrow = diff > 0 ? "↑" : diff < 0 ? "↓" : "→";
      scoreLines.push(
        `- ${bureau}: ${latest.score} (${arrow}${Math.abs(diff)} from ${previous.score})`
      );
    } else if (entries.length === 1) {
      scoreLines.push(`- ${bureau}: ${entries[0].score}`);
    }
  }

  // Build CRA response patterns
  const craResponses = new Map<string, { verified: number; deleted: number; noResponse: number }>();
  for (const d of completedDisputes) {
    const cra = d.cra;
    if (!craResponses.has(cra)) craResponses.set(cra, { verified: 0, deleted: 0, noResponse: 0 });
    const stats = craResponses.get(cra)!;
    if (d.status === "RESOLVED" || d.status === "COMPLETED") stats.deleted++;
    else if (d.status === "VERIFIED") stats.verified++;
    else stats.noResponse++;
  }

  const responseLines: string[] = [];
  for (const [cra, stats] of craResponses) {
    responseLines.push(
      `- ${cra}: ${stats.deleted} deleted, ${stats.verified} verified-only, ${stats.noResponse} no response`
    );
  }

  return `=== RECENT OUTCOMES ===
${outcomeLines.length > 0 ? outcomeLines.join("\n") : "No completed disputes yet"}

CREDIT SCORES:
${scoreLines.length > 0 ? scoreLines.join("\n") : "No score data available"}

CRA RESPONSE PATTERNS:
${responseLines.length > 0 ? responseLines.join("\n") : "No response data yet"}`;
}

// =============================================================================
// TIER 3: Org-Wide Patterns (summarized)
// =============================================================================

async function buildTier3(orgId: string): Promise<string> {
  // Fetch learned outcome patterns for this org
  const patterns = await prisma.ameliaOutcomePattern.findMany({
    where: {
      organizationId: orgId,
      isReliable: true,
    },
    orderBy: { successRate: "desc" },
    take: 10,
  });

  if (patterns.length === 0) {
    return `=== ORG INTELLIGENCE ===
No outcome patterns computed yet. Patterns will be available after 10+ disputes are completed.`;
  }

  const patternLines = patterns.map((p) => {
    const creditorPart = p.creditorName ? ` vs ${p.creditorName}` : "";
    return `- ${p.flow}${creditorPart} on ${p.cra}: ${p.successRate.toFixed(0)}% success (n=${p.sampleSize})${p.avgDaysToResolve ? `, avg ${p.avgDaysToResolve.toFixed(0)} days` : ""}`;
  });

  // Compute best/worst CRA
  const craSummary = new Map<string, { total: number; successes: number }>();
  for (const p of patterns) {
    if (!craSummary.has(p.cra)) craSummary.set(p.cra, { total: 0, successes: 0 });
    const s = craSummary.get(p.cra)!;
    s.total += p.sampleSize;
    s.successes += p.deletions;
  }

  const craRanking = [...craSummary.entries()]
    .map(([cra, s]) => ({
      cra,
      rate: s.total > 0 ? (s.successes / s.total) * 100 : 0,
    }))
    .sort((a, b) => b.rate - a.rate);

  const rankingLines = craRanking.map(
    (r) => `- ${r.cra}: ${r.rate.toFixed(0)}% overall deletion rate`
  );

  return `=== ORG INTELLIGENCE ===
TOP PERFORMING STRATEGIES:
${patternLines.join("\n")}

CRA DELETION RANKING:
${rankingLines.join("\n")}`;
}
