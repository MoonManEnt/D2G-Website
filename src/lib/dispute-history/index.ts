/**
 * Dispute Round History Service
 *
 * Tracks dispute rounds and provides context for AMELIA to generate
 * progressively more effective letters based on previous outcomes.
 */

import { prisma } from "@/lib/prisma";
import crypto from "crypto";

// =============================================================================
// TYPES
// =============================================================================

export interface NextRoundContext {
  previousOutcomes: Array<{
    round: number;
    deletedCount: number;
    verifiedCount: number;
    totalItems: number;
    successRate: number;
  }>;
  previousTactics: string[];
  recommendedTone: "CONCERNED" | "WORRIED" | "FED_UP" | "WARNING" | "PISSED";
  recommendedFlow: string | null;
  escalationLevel: number; // 1-5
  persistentItems: Array<{
    creditorName: string;
    rounds: number;
    lastOutcome: string;
  }>;
  cfpbRecommended: boolean;
  fcraViolations: number;
  uniqueAngles: string[];
}

export interface RoundHistoryEntry {
  id: string;
  disputeId: string;
  clientId: string;
  organizationId: string;
  round: number;
  flow: string;
  cra: string;
  letterSentDate: Date | null;
  letterContent: string | null;
  letterHash: string | null;
  responseReceivedDate: Date | null;
  overallOutcome: string | null;
  itemOutcomes: Record<string, string>;
  nextRoundContext: NextRoundContext | null;
  itemsDisputed: number;
  itemsDeleted: number;
  itemsVerified: number;
  itemsUpdated: number;
  itemsNoResponse: number;
  itemsStalled: number;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a hash of letter content to detect duplicates
 */
function hashLetterContent(content: string): string {
  return crypto.createHash("md5").update(content).digest("hex");
}

/**
 * Determine recommended tone based on round and previous outcomes
 */
function getRecommendedTone(
  round: number,
  successRate: number
): NextRoundContext["recommendedTone"] {
  // AMELIA doctrine: escalate tone with each round
  if (round <= 1) return "CONCERNED";
  if (round === 2) return "WORRIED";
  if (round === 3) return "FED_UP";
  if (round === 4) return "WARNING";
  return "PISSED";
}

/**
 * Calculate escalation level based on round history
 */
function calculateEscalationLevel(
  round: number,
  successRate: number,
  hasViolations: boolean
): number {
  let level = Math.min(round, 4);

  // Bump up if low success rate
  if (successRate < 30 && round > 2) level++;

  // Bump up if there are FCRA violations
  if (hasViolations) level++;

  return Math.min(level, 5);
}

/**
 * Generate unique angles for the next dispute letter
 */
function generateUniqueAngles(
  persistentItems: Array<{ creditorName: string; rounds: number; lastOutcome: string }>,
  hasViolations: boolean
): string[] {
  const angles: string[] = [];

  // Persistence angle
  const mostPersistent = persistentItems.filter((i) => i.rounds >= 3);
  if (mostPersistent.length > 0) {
    angles.push(
      `Reference ${mostPersistent.length} item(s) that have been disputed ${mostPersistent[0].rounds} times without proper investigation`
    );
  }

  // Verification angle
  const verified = persistentItems.filter((i) => i.lastOutcome === "VERIFIED");
  if (verified.length > 0) {
    angles.push(
      `Demand documented evidence of verification method used (not just confirmation of data)`
    );
  }

  // FCRA angle
  if (hasViolations) {
    angles.push(
      `Cite ongoing FCRA violations and intent to seek statutory damages`
    );
  }

  // Stall letter angle
  const stalled = persistentItems.filter((i) => i.lastOutcome === "STALL_LETTER");
  if (stalled.length > 0) {
    angles.push(
      `Address previous frivolous/stall response and demand substantive investigation`
    );
  }

  // Default angles
  if (angles.length === 0) {
    angles.push("Emphasize ongoing reporting damage to consumer");
    angles.push("Reference specific inaccuracies with documentation");
  }

  return angles;
}

// =============================================================================
// DISPUTE ROUND HISTORY SERVICE
// =============================================================================

export const DisputeRoundHistoryService = {
  /**
   * Create a history entry when a dispute letter is sent
   */
  async recordLetterSent(
    disputeId: string,
    letterContent: string
  ): Promise<RoundHistoryEntry> {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        items: true,
      },
    });

    if (!dispute) {
      throw new Error("Dispute not found");
    }

    const letterHash = hashLetterContent(letterContent);

    const history = await prisma.disputeRoundHistory.create({
      data: {
        disputeId: dispute.id,
        clientId: dispute.clientId,
        organizationId: dispute.organizationId,
        round: dispute.round,
        flow: dispute.flow,
        cra: dispute.cra,
        letterSentDate: new Date(),
        letterContent,
        letterHash,
        itemsDisputed: dispute.items.length,
      },
    });

    return this.parseHistory(history);
  },

  /**
   * Update history when response is received
   */
  async recordResponse(
    disputeId: string,
    itemOutcomes: Record<string, string>
  ): Promise<RoundHistoryEntry> {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { items: true },
    });

    if (!dispute) {
      throw new Error("Dispute not found");
    }

    // Find the existing history entry
    const existingHistory = await prisma.disputeRoundHistory.findFirst({
      where: {
        disputeId,
        round: dispute.round,
      },
    });

    // Count outcomes
    const outcomes = Object.values(itemOutcomes);
    const deletedCount = outcomes.filter((o) => o === "DELETED").length;
    const verifiedCount = outcomes.filter((o) => o === "VERIFIED").length;
    const updatedCount = outcomes.filter((o) => o === "UPDATED").length;
    const noResponseCount = outcomes.filter((o) => o === "NO_RESPONSE").length;
    const stalledCount = outcomes.filter((o) => o === "STALL_LETTER").length;

    // Determine overall outcome
    let overallOutcome = "MIXED";
    if (deletedCount === outcomes.length) overallOutcome = "ALL_DELETED";
    else if (verifiedCount === outcomes.length) overallOutcome = "ALL_VERIFIED";
    else if (deletedCount > verifiedCount) overallOutcome = "MOSTLY_DELETED";
    else if (verifiedCount > deletedCount) overallOutcome = "MOSTLY_VERIFIED";

    // Generate next round context
    const nextRoundContext = await this.generateNextRoundContext(
      dispute.clientId,
      dispute.cra
    );

    if (existingHistory) {
      const updatedHistory = await prisma.disputeRoundHistory.update({
        where: { id: existingHistory.id },
        data: {
          responseReceivedDate: new Date(),
          overallOutcome,
          itemOutcomes: JSON.stringify(itemOutcomes),
          itemsDeleted: deletedCount,
          itemsVerified: verifiedCount,
          itemsUpdated: updatedCount,
          itemsNoResponse: noResponseCount,
          itemsStalled: stalledCount,
          nextRoundContext: JSON.stringify(nextRoundContext),
        },
      });

      return this.parseHistory(updatedHistory);
    }

    // Create if doesn't exist
    const history = await prisma.disputeRoundHistory.create({
      data: {
        disputeId,
        clientId: dispute.clientId,
        organizationId: dispute.organizationId,
        round: dispute.round,
        flow: dispute.flow,
        cra: dispute.cra,
        responseReceivedDate: new Date(),
        overallOutcome,
        itemOutcomes: JSON.stringify(itemOutcomes),
        itemsDisputed: dispute.items.length,
        itemsDeleted: deletedCount,
        itemsVerified: verifiedCount,
        itemsUpdated: updatedCount,
        itemsNoResponse: noResponseCount,
        itemsStalled: stalledCount,
        nextRoundContext: JSON.stringify(nextRoundContext),
      },
    });

    return this.parseHistory(history);
  },

  /**
   * Generate context for AMELIA when creating the next round's letter
   */
  async generateNextRoundContext(
    clientId: string,
    cra: string
  ): Promise<NextRoundContext> {
    // Get all previous rounds for this client/CRA
    const history = await prisma.disputeRoundHistory.findMany({
      where: { clientId, cra },
      orderBy: { round: "asc" },
    });

    // Calculate previous outcomes
    const previousOutcomes = history.map((h) => ({
      round: h.round,
      deletedCount: h.itemsDeleted,
      verifiedCount: h.itemsVerified,
      totalItems: h.itemsDisputed,
      successRate:
        h.itemsDisputed > 0
          ? Math.round((h.itemsDeleted / h.itemsDisputed) * 100)
          : 0,
    }));

    // Calculate overall success rate
    const totalDisputed = history.reduce((sum, h) => sum + h.itemsDisputed, 0);
    const totalDeleted = history.reduce((sum, h) => sum + h.itemsDeleted, 0);
    const overallSuccessRate =
      totalDisputed > 0 ? Math.round((totalDeleted / totalDisputed) * 100) : 0;

    // Get previous tactics (flows used)
    const previousTactics = [...new Set(history.map((h) => h.flow))];

    // Check for FCRA violations (items with NO_RESPONSE)
    const fcraViolations = history.reduce((sum, h) => sum + h.itemsNoResponse, 0);

    // Identify persistent items (items that weren't deleted across multiple rounds)
    const persistentItems = await this.getPersistentItems(clientId, cra);

    // Determine recommended flow
    const lastRound = history[history.length - 1];
    const currentRound = lastRound ? lastRound.round + 1 : 1;

    let recommendedFlow = lastRound?.flow || "ACCURACY";
    // AMELIA doctrine: switch from COLLECTION to ACCURACY after round 5-7
    if (
      lastRound?.flow === "COLLECTION" &&
      currentRound >= 5 &&
      overallSuccessRate < 50
    ) {
      recommendedFlow = "ACCURACY";
    }

    return {
      previousOutcomes,
      previousTactics,
      recommendedTone: getRecommendedTone(currentRound, overallSuccessRate),
      recommendedFlow:
        currentRound === 1 ? null : recommendedFlow,
      escalationLevel: calculateEscalationLevel(
        currentRound,
        overallSuccessRate,
        fcraViolations > 0
      ),
      persistentItems,
      cfpbRecommended: fcraViolations > 0 || currentRound >= 4,
      fcraViolations,
      uniqueAngles: generateUniqueAngles(persistentItems, fcraViolations > 0),
    };
  },

  /**
   * Get items that persist across multiple rounds
   */
  async getPersistentItems(
    clientId: string,
    cra: string
  ): Promise<Array<{ creditorName: string; rounds: number; lastOutcome: string }>> {
    // Get all disputed items and their outcomes across rounds
    const items = await prisma.disputeItem.findMany({
      where: {
        dispute: {
          clientId,
          cra,
        },
      },
      include: {
        accountItem: {
          select: { creditorName: true },
        },
        dispute: {
          select: { round: true },
        },
      },
      orderBy: {
        dispute: { round: "desc" },
      },
    });

    // Group by creditor and count rounds
    const creditorMap = new Map<
      string,
      { rounds: number; lastOutcome: string }
    >();

    for (const item of items) {
      const creditor = item.accountItem.creditorName;
      const existing = creditorMap.get(creditor);

      if (!existing) {
        creditorMap.set(creditor, {
          rounds: 1,
          lastOutcome: item.outcome || "PENDING",
        });
      } else if (item.outcome !== "DELETED") {
        creditorMap.set(creditor, {
          rounds: existing.rounds + 1,
          lastOutcome: item.outcome || existing.lastOutcome,
        });
      }
    }

    return Array.from(creditorMap.entries())
      .filter(([, data]) => data.rounds >= 2 && data.lastOutcome !== "DELETED")
      .map(([creditorName, data]) => ({
        creditorName,
        rounds: data.rounds,
        lastOutcome: data.lastOutcome,
      }));
  },

  /**
   * Get full history for a client/CRA combination
   */
  async getHistory(
    clientId: string,
    cra: string
  ): Promise<RoundHistoryEntry[]> {
    const history = await prisma.disputeRoundHistory.findMany({
      where: { clientId, cra },
      orderBy: { round: "asc" },
    });

    return history.map((h) => this.parseHistory(h));
  },

  /**
   * Check for duplicate letters (eOSCAR resistance)
   */
  async isDuplicateLetter(
    clientId: string,
    cra: string,
    letterContent: string
  ): Promise<{ isDuplicate: boolean; matchedRound: number | null }> {
    const hash = hashLetterContent(letterContent);

    const match = await prisma.disputeRoundHistory.findFirst({
      where: {
        clientId,
        cra,
        letterHash: hash,
      },
    });

    return {
      isDuplicate: !!match,
      matchedRound: match?.round ?? null,
    };
  },

  /**
   * Parse a raw history record into typed format
   */
  parseHistory(raw: {
    id: string;
    disputeId: string;
    clientId: string;
    organizationId: string;
    round: number;
    flow: string;
    cra: string;
    letterSentDate: Date | null;
    letterContent: string | null;
    letterHash: string | null;
    responseReceivedDate: Date | null;
    overallOutcome: string | null;
    itemOutcomes: string;
    nextRoundContext: string;
    itemsDisputed: number;
    itemsDeleted: number;
    itemsVerified: number;
    itemsUpdated: number;
    itemsNoResponse: number;
    itemsStalled: number;
    createdAt: Date;
    updatedAt: Date;
  }): RoundHistoryEntry {
    let itemOutcomes: Record<string, string> = {};
    let nextRoundContext: NextRoundContext | null = null;

    try {
      itemOutcomes = JSON.parse(raw.itemOutcomes || "{}");
    } catch {
      // Use empty object
    }

    try {
      nextRoundContext = JSON.parse(raw.nextRoundContext || "null");
    } catch {
      // Use null
    }

    return {
      ...raw,
      itemOutcomes,
      nextRoundContext,
    };
  },
};

// Export convenience function for AMELIA integration
export async function getAmeliaContext(
  clientId: string,
  cra: string
): Promise<NextRoundContext> {
  return DisputeRoundHistoryService.generateNextRoundContext(clientId, cra);
}
