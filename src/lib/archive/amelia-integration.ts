/**
 * AMELIA Integration for Archive System
 *
 * Generates comprehensive re-engagement context from archived client data
 * to enable AMELIA to provide intelligent recommendations when clients return.
 */

import {
  AmeliaReengagementContext,
  DisputeSnapshot,
  DisputeResponseSnapshot,
  CreditDNASnapshot,
  AccountSnapshot,
} from "./types";

/**
 * Generate AMELIA re-engagement context from archived data.
 */
export function generateAmeliaContext(
  disputes: DisputeSnapshot[],
  responses: DisputeResponseSnapshot[],
  creditDNA: CreditDNASnapshot | null,
  accounts: AccountSnapshot[]
): AmeliaReengagementContext {
  // Determine recommended action
  const recommendedAction = determineRecommendedAction(disputes, responses);

  // Get last active dispute info
  const lastDispute = disputes.find((d) => d.status !== "DRAFT");
  const lastActiveFlow = lastDispute?.flow || null;
  const lastActiveRound = lastDispute?.round || 0;

  // Find unresolved CRAs (bureaus with pending/verified items)
  const unresolvedCRAs = getUnresolvedCRAs(disputes, responses, accounts);

  // Generate dispute strategy summary
  const disputeStrategySummary = generateDisputeStrategySummary(disputes, responses);

  // Generate credit profile summary
  const creditProfileSummary = generateCreditProfileSummary(creditDNA, accounts);

  // Generate compliance audit trail
  const complianceAuditTrail = generateComplianceAuditTrail(disputes, responses);

  // Generate personalized message
  const personalizedMessage = generatePersonalizedMessage(
    recommendedAction,
    disputeStrategySummary,
    creditProfileSummary
  );

  return {
    recommendedAction,
    lastActiveFlow,
    lastActiveRound,
    unresolvedCRAs,
    disputeStrategySummary,
    creditProfileSummary,
    complianceAuditTrail,
    personalizedMessage,
  };
}

/**
 * Determine the recommended action for re-engagement.
 */
function determineRecommendedAction(
  disputes: DisputeSnapshot[],
  responses: DisputeResponseSnapshot[]
): "START_FRESH" | "CONTINUE_EXISTING" | "REVIEW_OUTCOMES" {
  if (disputes.length === 0) {
    return "START_FRESH";
  }

  // Check for active disputes (SENT, PENDING, RESPONDED but not resolved)
  const activeDisputes = disputes.filter(
    (d) => d.status === "SENT" || d.status === "PENDING" || d.status === "RESPONDED"
  );

  if (activeDisputes.length > 0) {
    return "CONTINUE_EXISTING";
  }

  // Check if there are completed disputes that need review
  const completedDisputes = disputes.filter(
    (d) => d.status === "RESOLVED" || d.status === "CLOSED"
  );

  if (completedDisputes.length > 0) {
    // Check if any items were verified (not deleted) - might need next round
    const verifiedItems = responses.filter(
      (r) => r.outcome === "VERIFIED" || r.outcome === "UPDATED"
    );

    if (verifiedItems.length > 0) {
      return "REVIEW_OUTCOMES";
    }
  }

  return "START_FRESH";
}

/**
 * Get list of CRAs with unresolved items.
 */
function getUnresolvedCRAs(
  disputes: DisputeSnapshot[],
  responses: DisputeResponseSnapshot[],
  accounts: AccountSnapshot[]
): string[] {
  const unresolvedCRAs = new Set<string>();

  // Check accounts with disputable issues
  accounts.forEach((account) => {
    if (account.isDisputable && account.issueCount > 0) {
      unresolvedCRAs.add(account.cra);
    }
  });

  // Check responses that weren't deletions
  const responsesByItemId = new Map<string, DisputeResponseSnapshot>();
  responses.forEach((r) => {
    const existing = responsesByItemId.get(r.disputeItemId);
    if (!existing || new Date(r.responseDate) > new Date(existing.responseDate)) {
      responsesByItemId.set(r.disputeItemId, r);
    }
  });

  // Find disputes where items weren't deleted
  disputes.forEach((dispute) => {
    dispute.items.forEach((item) => {
      const response = responsesByItemId.get(item.id);
      if (response && response.outcome !== "DELETED") {
        unresolvedCRAs.add(dispute.cra);
      }
    });
  });

  return Array.from(unresolvedCRAs);
}

/**
 * Generate dispute strategy summary.
 */
function generateDisputeStrategySummary(
  disputes: DisputeSnapshot[],
  responses: DisputeResponseSnapshot[]
): AmeliaReengagementContext["disputeStrategySummary"] {
  const totalDisputes = disputes.length;

  if (totalDisputes === 0) {
    return {
      totalDisputes: 0,
      successRate: 0,
      mostEffectiveFlow: null,
      mostResistantCRA: null,
      outstandingIssues: [],
      lastDisputeDate: null,
      avgDaysToResponse: null,
    };
  }

  // Calculate success rate (items deleted / items disputed)
  const totalItems = disputes.reduce((sum, d) => sum + d.items.length, 0);
  const deletedItems = responses.filter((r) => r.outcome === "DELETED").length;
  const successRate = totalItems > 0 ? Math.round((deletedItems / totalItems) * 100) : 0;

  // Find most effective flow
  const flowStats = new Map<string, { disputes: number; deleted: number }>();
  disputes.forEach((d) => {
    const stats = flowStats.get(d.flow) || { disputes: 0, deleted: 0 };
    stats.disputes++;
    flowStats.set(d.flow, stats);
  });

  responses.forEach((r) => {
    const dispute = disputes.find((d) =>
      d.items.some((item) => item.id === r.disputeItemId)
    );
    if (dispute && r.outcome === "DELETED") {
      const stats = flowStats.get(dispute.flow);
      if (stats) {
        stats.deleted++;
      }
    }
  });

  let mostEffectiveFlow: string | null = null;
  let bestRate = 0;
  flowStats.forEach((stats, flow) => {
    const rate = stats.disputes > 0 ? stats.deleted / stats.disputes : 0;
    if (rate > bestRate) {
      bestRate = rate;
      mostEffectiveFlow = flow;
    }
  });

  // Find most resistant CRA
  const craStats = new Map<string, { items: number; verified: number }>();
  disputes.forEach((d) => {
    const stats = craStats.get(d.cra) || { items: 0, verified: 0 };
    stats.items += d.items.length;
    craStats.set(d.cra, stats);
  });

  responses.forEach((r) => {
    const dispute = disputes.find((d) =>
      d.items.some((item) => item.id === r.disputeItemId)
    );
    if (dispute && (r.outcome === "VERIFIED" || r.outcome === "UPDATED")) {
      const stats = craStats.get(dispute.cra);
      if (stats) {
        stats.verified++;
      }
    }
  });

  let mostResistantCRA: string | null = null;
  let worstRate = 0;
  craStats.forEach((stats, cra) => {
    const rate = stats.items > 0 ? stats.verified / stats.items : 0;
    if (rate > worstRate) {
      worstRate = rate;
      mostResistantCRA = cra;
    }
  });

  // Collect outstanding issues
  const outstandingIssues: string[] = [];
  const verifiedResponses = responses.filter(
    (r) => r.outcome === "VERIFIED" || r.outcome === "NO_RESPONSE"
  );
  verifiedResponses.slice(0, 5).forEach((r) => {
    const dispute = disputes.find((d) =>
      d.items.some((item) => item.id === r.disputeItemId)
    );
    const item = dispute?.items.find((i) => i.id === r.disputeItemId);
    if (item) {
      outstandingIssues.push(
        `${item.accountItem.creditorName} (${dispute?.cra}): ${r.outcome}`
      );
    }
  });

  // Last dispute date
  const sortedDisputes = [...disputes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const lastDisputeDate = sortedDisputes[0]?.createdAt || null;

  // Average days to response
  const responsesWithDays = responses.filter((r) => r.daysToRespond > 0);
  const avgDaysToResponse =
    responsesWithDays.length > 0
      ? Math.round(
          responsesWithDays.reduce((sum, r) => sum + r.daysToRespond, 0) /
            responsesWithDays.length
        )
      : null;

  return {
    totalDisputes,
    successRate,
    mostEffectiveFlow,
    mostResistantCRA,
    outstandingIssues,
    lastDisputeDate,
    avgDaysToResponse,
  };
}

/**
 * Generate credit profile summary.
 */
function generateCreditProfileSummary(
  creditDNA: CreditDNASnapshot | null,
  accounts: AccountSnapshot[]
): AmeliaReengagementContext["creditProfileSummary"] {
  if (!creditDNA) {
    // Generate basic summary from accounts
    const disputableAccounts = accounts.filter((a) => a.isDisputable);
    const totalIssues = accounts.reduce((sum, a) => sum + a.issueCount, 0);

    return {
      classification: null,
      healthScore: null,
      improvementPotential: null,
      keyInsights: [
        `${accounts.length} total accounts on file`,
        `${disputableAccounts.length} accounts flagged for potential disputes`,
        `${totalIssues} total issues detected`,
      ],
    };
  }

  return {
    classification: creditDNA.classification,
    healthScore: creditDNA.healthScore,
    improvementPotential: creditDNA.improvementPotential,
    keyInsights: creditDNA.keyInsights.slice(0, 5),
  };
}

/**
 * Generate compliance audit trail.
 */
function generateComplianceAuditTrail(
  disputes: DisputeSnapshot[],
  responses: DisputeResponseSnapshot[]
): AmeliaReengagementContext["complianceAuditTrail"] {
  // Count FCRA violations (late responses, no responses)
  const lateResponses = responses.filter((r) => r.wasLate).length;
  const noResponses = responses.filter((r) => r.outcome === "NO_RESPONSE").length;
  const totalFCRAViolations = lateResponses + noResponses;

  // Count pending deadlines (disputes sent but not responded within 30 days)
  const now = new Date();
  let pendingDeadlines = 0;
  disputes.forEach((d) => {
    if (d.sentDate && !d.respondedAt) {
      const sentDate = new Date(d.sentDate);
      const daysSinceSent = Math.floor(
        (now.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceSent > 30) {
        pendingDeadlines++;
      }
    }
  });

  // Generate violation details
  const violationDetails: string[] = [];

  if (lateResponses > 0) {
    violationDetails.push(
      `${lateResponses} late response(s) - potential FCRA 15 USC § 1681i(a)(1) violation`
    );
  }

  if (noResponses > 0) {
    violationDetails.push(
      `${noResponses} non-response(s) - items should be deleted under FCRA`
    );
  }

  // Find specific late responses
  const specificLate = responses
    .filter((r) => r.wasLate)
    .slice(0, 3)
    .map((r) => {
      const dispute = disputes.find((d) =>
        d.items.some((item) => item.id === r.disputeItemId)
      );
      return `${dispute?.cra || "Unknown"}: ${r.daysToRespond} days (${r.responseDate.split("T")[0]})`;
    });

  if (specificLate.length > 0) {
    violationDetails.push(`Late responses: ${specificLate.join(", ")}`);
  }

  return {
    totalFCRAViolations,
    pendingDeadlines,
    lateResponses,
    violationDetails,
  };
}

/**
 * Generate personalized welcome back message.
 */
function generatePersonalizedMessage(
  recommendedAction: "START_FRESH" | "CONTINUE_EXISTING" | "REVIEW_OUTCOMES",
  disputeSummary: AmeliaReengagementContext["disputeStrategySummary"],
  creditSummary: AmeliaReengagementContext["creditProfileSummary"]
): string {
  switch (recommendedAction) {
    case "START_FRESH":
      if (creditSummary.classification) {
        return `Welcome back! Based on your credit profile (${creditSummary.classification}), I recommend we start with a fresh analysis to identify the best dispute strategy for your current situation.`;
      }
      return "Welcome back! Let's start fresh with a new credit analysis to identify the best opportunities for improving your credit.";

    case "CONTINUE_EXISTING":
      return `Welcome back! You have active disputes in progress. Your success rate so far is ${disputeSummary.successRate}%. Let's review the responses and continue your dispute journey${disputeSummary.mostEffectiveFlow ? ` using the ${disputeSummary.mostEffectiveFlow} strategy that's been working well` : ""}.`;

    case "REVIEW_OUTCOMES":
      const outstandingCount = disputeSummary.outstandingIssues.length;
      return `Welcome back! You completed ${disputeSummary.totalDisputes} dispute(s) with a ${disputeSummary.successRate}% success rate. ${outstandingCount > 0 ? `There are ${outstandingCount} item(s) that weren't deleted - let's review and plan the next round.` : "Let's review the outcomes and plan your next steps."}`;

    default:
      return "Welcome back! Let's review your credit situation and determine the best path forward.";
  }
}

/**
 * Export individual functions for testing.
 */
export {
  determineRecommendedAction,
  getUnresolvedCRAs,
  generateDisputeStrategySummary,
  generateCreditProfileSummary,
  generateComplianceAuditTrail,
  generatePersonalizedMessage,
};
