/**
 * Dispute ID Generator Service
 *
 * Generates unique, human-readable dispute codes in the format:
 * - Disputes: D2GO-YYYYMMDD-XXX (e.g., D2GO-20250128-001)
 * - Sentry:   STY-YYYYMMDD-XXX  (e.g., STY-20250128-042)
 *
 * Uses database-level atomic sequence to prevent duplicates
 * even under high concurrency.
 */

import prisma from "@/lib/prisma";
import { format } from "date-fns";

export type DisputeSystem = "DISPUTE" | "SENTRY";

interface DisputeCodeResult {
  code: string;
  sequence: number;
  dateKey: string;
}

interface ParsedDisputeCode {
  system: DisputeSystem;
  date: Date;
  sequence: number;
}

/**
 * Generate a new unique dispute code atomically
 *
 * Uses database transaction with upsert for race-condition-safe
 * sequence increment. Retries up to 3 times on conflict.
 */
export async function generateDisputeCode(
  system: DisputeSystem
): Promise<DisputeCodeResult> {
  const prefix = system === "DISPUTE" ? "D2GO" : "STY";
  const dateKey = format(new Date(), "yyyyMMdd");

  // Use transaction with retry for race condition handling
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Upsert the sequence counter atomically
        const sequence = await tx.disputeSequence.upsert({
          where: {
            dateKey_system: { dateKey, system },
          },
          create: {
            dateKey,
            system,
            lastSequence: 1,
          },
          update: {
            lastSequence: { increment: 1 },
          },
        });

        return sequence.lastSequence;
      });

      // Format: PREFIX-YYYYMMDD-XXX (3-digit zero-padded)
      const code = `${prefix}-${dateKey}-${String(result).padStart(3, "0")}`;

      return {
        code,
        sequence: result,
        dateKey,
      };
    } catch (error) {
      lastError = error as Error;
      // Wait briefly before retry (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }

  throw lastError || new Error("Failed to generate dispute code");
}

/**
 * Parse a dispute code to extract components
 *
 * @example
 * parseDisputeCode("D2GO-20250128-001")
 * // { system: "DISPUTE", date: Date(2025-01-28), sequence: 1 }
 */
export function parseDisputeCode(code: string): ParsedDisputeCode | null {
  const match = code.match(/^(D2GO|STY)-(\d{8})-(\d{3})$/);
  if (!match) return null;

  const [, prefix, dateStr, seqStr] = match;
  const year = parseInt(dateStr.slice(0, 4));
  const month = parseInt(dateStr.slice(4, 6)) - 1; // JS months are 0-indexed
  const day = parseInt(dateStr.slice(6, 8));

  return {
    system: prefix === "D2GO" ? "DISPUTE" : "SENTRY",
    date: new Date(year, month, day),
    sequence: parseInt(seqStr),
  };
}

/**
 * Validate a dispute code format
 */
export function isValidDisputeCode(code: string): boolean {
  return /^(D2GO|STY)-\d{8}-\d{3}$/.test(code);
}

/**
 * Find dispute by code (searches both systems)
 *
 * Returns the dispute along with which system it belongs to.
 * Useful for universal lookup from any input.
 */
export async function findDisputeByCode(
  code: string,
  organizationId: string
): Promise<{
  system: DisputeSystem;
  dispute: {
    id: string;
    disputeCode: string | null;
    clientId: string;
    cra: string;
    round: number;
    status: string;
    client: { id: string; firstName: string; lastName: string };
    items: Array<{
      id: string;
      accountItemId: string;
      accountItem: {
        id: string;
        creditorName: string;
        maskedAccountId: string;
      };
    }>;
  };
} | null> {
  const parsed = parseDisputeCode(code);
  if (!parsed) return null;

  if (parsed.system === "DISPUTE") {
    const dispute = await prisma.dispute.findFirst({
      where: { disputeCode: code, organizationId },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        items: {
          include: {
            accountItem: {
              select: { id: true, creditorName: true, maskedAccountId: true },
            },
          },
        },
      },
    });
    if (!dispute) return null;
    return {
      system: "DISPUTE",
      dispute: {
        id: dispute.id,
        disputeCode: dispute.disputeCode,
        clientId: dispute.clientId,
        cra: dispute.cra,
        round: dispute.round,
        status: dispute.status,
        client: dispute.client,
        items: dispute.items.map((item) => ({
          id: item.id,
          accountItemId: item.accountItemId,
          accountItem: item.accountItem,
        })),
      },
    };
  } else {
    const dispute = await prisma.sentryDispute.findFirst({
      where: { disputeCode: code, organizationId },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        items: {
          include: {
            accountItem: {
              select: { id: true, creditorName: true, maskedAccountId: true },
            },
          },
        },
      },
    });
    if (!dispute) return null;
    return {
      system: "SENTRY",
      dispute: {
        id: dispute.id,
        disputeCode: dispute.disputeCode,
        clientId: dispute.clientId,
        cra: dispute.cra,
        round: dispute.round,
        status: dispute.status,
        client: dispute.client,
        items: dispute.items.map((item) => ({
          id: item.id,
          accountItemId: item.accountItemId,
          accountItem: item.accountItem,
        })),
      },
    };
  }
}

/**
 * Get the prefix for a dispute system
 */
export function getDisputeCodePrefix(system: DisputeSystem): string {
  return system === "DISPUTE" ? "D2GO" : "STY";
}

/**
 * Format a dispute code for display (with system label)
 */
export function formatDisputeCodeForDisplay(code: string): string {
  const parsed = parseDisputeCode(code);
  if (!parsed) return code;

  const systemLabel = parsed.system === "DISPUTE" ? "Dispute" : "Sentry";
  return `${systemLabel} ${code}`;
}
