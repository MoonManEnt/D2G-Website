/**
 * Personal Info Dispute Service
 *
 * AMELIA DOCTRINE:
 * - Personal info disputes (names, addresses, hard inquiries) persist until removed
 * - When a new credit report is uploaded, compare against previous to detect removals
 * - Items marked as REMOVED stop appearing in future dispute letters
 *
 * This service handles:
 * 1. Creating PersonalInfoDispute records when items are first disputed
 * 2. Comparing month-over-month reports to detect removals
 * 3. Updating dispute status when items are confirmed removed
 * 4. Fetching active disputes for letter generation
 */

import prisma from "@/lib/prisma";
import type { CRA } from "@/types";

// Types for personal info items from credit reports
interface HardInquiry {
  creditorName: string;
  inquiryDate: string;
  cra: string;
}

interface PersonalInfoFromReport {
  previousNames: string[];
  previousAddresses: string[];
  hardInquiries: HardInquiry[];
}

// Active dispute for letter generation
export interface ActivePersonalInfoDispute {
  type: "PREVIOUS_NAME" | "PREVIOUS_ADDRESS" | "HARD_INQUIRY";
  value: string;
  cra: string;
  inquiryDate?: string;
  disputeCount: number;
  firstDisputedAt: Date;
}

/**
 * Create or update PersonalInfoDispute records when a dispute letter is generated
 * Called after generating a letter to track what was disputed
 */
export async function recordDisputedItems(
  clientId: string,
  organizationId: string,
  cra: CRA,
  items: {
    previousNames: string[];
    previousAddresses: string[];
    hardInquiries: HardInquiry[];
  }
): Promise<void> {
  const now = new Date();

  // Process previous names
  for (const name of items.previousNames) {
    await prisma.personalInfoDispute.upsert({
      where: {
        clientId_type_value_cra: {
          clientId,
          type: "PREVIOUS_NAME",
          value: name,
          cra,
        },
      },
      create: {
        clientId,
        organizationId,
        type: "PREVIOUS_NAME",
        value: name,
        cra,
        status: "ACTIVE",
        firstDisputedAt: now,
        lastDisputedAt: now,
        disputeCount: 1,
      },
      update: {
        lastDisputedAt: now,
        disputeCount: { increment: 1 },
        // If it was marked VERIFIED, keep disputing
        status: "ACTIVE",
      },
    });
  }

  // Process previous addresses
  for (const address of items.previousAddresses) {
    await prisma.personalInfoDispute.upsert({
      where: {
        clientId_type_value_cra: {
          clientId,
          type: "PREVIOUS_ADDRESS",
          value: address,
          cra,
        },
      },
      create: {
        clientId,
        organizationId,
        type: "PREVIOUS_ADDRESS",
        value: address,
        cra,
        status: "ACTIVE",
        firstDisputedAt: now,
        lastDisputedAt: now,
        disputeCount: 1,
      },
      update: {
        lastDisputedAt: now,
        disputeCount: { increment: 1 },
        status: "ACTIVE",
      },
    });
  }

  // Process hard inquiries
  for (const inquiry of items.hardInquiries) {
    if (inquiry.cra !== cra) continue; // Only process inquiries for this CRA

    await prisma.personalInfoDispute.upsert({
      where: {
        clientId_type_value_cra: {
          clientId,
          type: "HARD_INQUIRY",
          value: inquiry.creditorName,
          cra,
        },
      },
      create: {
        clientId,
        organizationId,
        type: "HARD_INQUIRY",
        value: inquiry.creditorName,
        cra,
        inquiryDate: inquiry.inquiryDate,
        status: "ACTIVE",
        firstDisputedAt: now,
        lastDisputedAt: now,
        disputeCount: 1,
      },
      update: {
        lastDisputedAt: now,
        disputeCount: { increment: 1 },
        status: "ACTIVE",
      },
    });
  }
}

/**
 * Get active disputes for a client/CRA that should be included in letters
 * Only returns items with status = "ACTIVE"
 */
export async function getActiveDisputes(
  clientId: string,
  cra: CRA
): Promise<ActivePersonalInfoDispute[]> {
  const disputes = await prisma.personalInfoDispute.findMany({
    where: {
      clientId,
      cra,
      status: "ACTIVE",
    },
    orderBy: { firstDisputedAt: "asc" },
  });

  return disputes.map((d) => ({
    type: d.type as "PREVIOUS_NAME" | "PREVIOUS_ADDRESS" | "HARD_INQUIRY",
    value: d.value,
    cra: d.cra,
    inquiryDate: d.inquiryDate || undefined,
    disputeCount: d.disputeCount,
    firstDisputedAt: d.firstDisputedAt,
  }));
}

/**
 * Compare a new credit report against active disputes to detect removals
 * Called when a new credit report is parsed
 */
export async function compareReportAndUpdateDisputes(
  clientId: string,
  organizationId: string,
  reportId: string,
  newReportData: PersonalInfoFromReport
): Promise<{
  removedNames: string[];
  removedAddresses: string[];
  removedInquiries: string[];
}> {
  const removed = {
    removedNames: [] as string[],
    removedAddresses: [] as string[],
    removedInquiries: [] as string[],
  };

  // Get all active disputes for this client
  const activeDisputes = await prisma.personalInfoDispute.findMany({
    where: {
      clientId,
      status: "ACTIVE",
    },
  });

  const now = new Date();

  for (const dispute of activeDisputes) {
    let stillPresent = false;

    if (dispute.type === "PREVIOUS_NAME") {
      // Check if name is still in the new report
      stillPresent = newReportData.previousNames.some(
        (name) => name.toLowerCase().trim() === dispute.value.toLowerCase().trim()
      );
      if (!stillPresent) {
        removed.removedNames.push(dispute.value);
      }
    } else if (dispute.type === "PREVIOUS_ADDRESS") {
      // Check if address is still in the new report
      stillPresent = newReportData.previousAddresses.some(
        (addr) => normalizeAddress(addr) === normalizeAddress(dispute.value)
      );
      if (!stillPresent) {
        removed.removedAddresses.push(dispute.value);
      }
    } else if (dispute.type === "HARD_INQUIRY") {
      // Check if inquiry is still in the new report for this CRA
      stillPresent = newReportData.hardInquiries.some(
        (inq) =>
          inq.cra === dispute.cra &&
          inq.creditorName.toLowerCase().trim() === dispute.value.toLowerCase().trim()
      );
      if (!stillPresent) {
        removed.removedInquiries.push(dispute.value);
      }
    }

    // If item is no longer present, mark as REMOVED
    if (!stillPresent) {
      await prisma.personalInfoDispute.update({
        where: { id: dispute.id },
        data: {
          status: "REMOVED",
          removedAt: now,
          removedInReportId: reportId,
        },
      });
    }
  }

  return removed;
}

/**
 * Normalize address for comparison (remove extra spaces, standardize abbreviations)
 */
function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\bstreet\b/g, "st")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\broad\b/g, "rd")
    .replace(/\bdrive\b/g, "dr")
    .replace(/\blane\b/g, "ln")
    .replace(/\bcourt\b/g, "ct")
    .replace(/\bboulevard\b/g, "blvd")
    .replace(/\bapartment\b/g, "apt")
    .replace(/\bsuite\b/g, "ste")
    .replace(/[.,#]/g, "");
}

/**
 * Get the date of the last dispute letter sent for a client/CRA
 */
export async function getLastDisputeDate(
  clientId: string,
  cra: CRA
): Promise<Date | null> {
  const lastDispute = await prisma.dispute.findFirst({
    where: {
      clientId,
      cra,
      status: { not: "DRAFT" }, // Only count sent letters
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  return lastDispute?.createdAt || null;
}

/**
 * Get dispute history summary for AMELIA context
 */
export async function getDisputeHistorySummary(
  clientId: string,
  cra: CRA
): Promise<{
  totalRounds: number;
  lastDisputeDate: Date | null;
  personalInfoStats: {
    activeNames: number;
    activeAddresses: number;
    activeInquiries: number;
    removedNames: number;
    removedAddresses: number;
    removedInquiries: number;
  };
}> {
  // Get dispute count for this CRA
  const disputeCount = await prisma.dispute.count({
    where: {
      clientId,
      cra,
    },
  });

  // Get last dispute date
  const lastDispute = await prisma.dispute.findFirst({
    where: {
      clientId,
      cra,
      status: { not: "DRAFT" },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  // Get personal info dispute stats
  const personalInfoStats = await prisma.personalInfoDispute.groupBy({
    by: ["type", "status"],
    where: {
      clientId,
      cra,
    },
    _count: true,
  });

  // Process stats
  const stats = {
    activeNames: 0,
    activeAddresses: 0,
    activeInquiries: 0,
    removedNames: 0,
    removedAddresses: 0,
    removedInquiries: 0,
  };

  for (const stat of personalInfoStats) {
    if (stat.type === "PREVIOUS_NAME") {
      if (stat.status === "ACTIVE") stats.activeNames = stat._count;
      if (stat.status === "REMOVED") stats.removedNames = stat._count;
    } else if (stat.type === "PREVIOUS_ADDRESS") {
      if (stat.status === "ACTIVE") stats.activeAddresses = stat._count;
      if (stat.status === "REMOVED") stats.removedAddresses = stat._count;
    } else if (stat.type === "HARD_INQUIRY") {
      if (stat.status === "ACTIVE") stats.activeInquiries = stat._count;
      if (stat.status === "REMOVED") stats.removedInquiries = stat._count;
    }
  }

  return {
    totalRounds: disputeCount,
    lastDisputeDate: lastDispute?.createdAt || null,
    personalInfoStats: stats,
  };
}
