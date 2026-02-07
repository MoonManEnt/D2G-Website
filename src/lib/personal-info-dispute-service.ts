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
export interface HardInquiry {
  creditorName: string;
  inquiryDate: string;
  cra: CRA;
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
 * Normalize name for comparison
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,]/g, "");
}

// Personal info discrepancy result
export interface PersonalInfoDiscrepancy {
  type: "ADDRESS" | "NAME";
  reportValue: string;
  clientValue: string;
  cra: string;
  reason: string;
}

/**
 * Compare credit report personal info against client's stored info.
 * Returns all addresses/names that DON'T match the client's actual data.
 *
 * This is used to auto-populate the "PERSONAL INFORMATION TO INVESTIGATE
 * AND CORRECT/REMOVE" section of dispute letters.
 */
export async function detectPersonalInfoDiscrepancies(
  clientId: string
): Promise<{
  discrepancies: PersonalInfoDiscrepancy[];
  unmatchedAddresses: Array<{ address: string; cra: string }>;
  unmatchedNames: Array<{ name: string; cra: string }>;
}> {
  const discrepancies: PersonalInfoDiscrepancy[] = [];
  const unmatchedAddresses: Array<{ address: string; cra: string }> = [];
  const unmatchedNames: Array<{ name: string; cra: string }> = [];

  // Get client's stored data
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      firstName: true,
      lastName: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      zipCode: true,
    },
  });

  if (!client) {
    return { discrepancies, unmatchedAddresses, unmatchedNames };
  }

  // Build client's full name and address
  const clientFullName = `${client.firstName} ${client.lastName}`.trim();
  const clientAddress = [
    client.addressLine1,
    client.addressLine2,
    client.city,
    client.state,
    client.zipCode,
  ]
    .filter(Boolean)
    .join(", ");

  const normalizedClientName = normalizeName(clientFullName);
  const normalizedClientAddress = normalizeAddress(clientAddress);

  // Get latest credit report with personal info
  const latestReport = await prisma.creditReport.findFirst({
    where: {
      clientId,
      parseStatus: "COMPLETED",
    },
    orderBy: { reportDate: "desc" },
    select: {
      personalInfoByBureau: true,
      previousNames: true,
      previousAddresses: true,
    },
  });

  if (!latestReport) {
    return { discrepancies, unmatchedAddresses, unmatchedNames };
  }

  // Parse personal info by bureau
  let personalInfoByBureau: Record<
    string,
    { name?: string; address?: string; previousAddresses?: string[] }
  > = {};

  try {
    if (latestReport.personalInfoByBureau) {
      personalInfoByBureau = JSON.parse(latestReport.personalInfoByBureau);
    }
  } catch {
    // Ignore parse errors
  }

  // Check each bureau's personal info
  const bureaus = ["TRANSUNION", "EXPERIAN", "EQUIFAX"];

  for (const cra of bureaus) {
    const bureauInfo = personalInfoByBureau[cra];
    if (!bureauInfo) continue;

    // Check current address
    if (bureauInfo.address) {
      const normalizedReportAddress = normalizeAddress(bureauInfo.address);

      // If report address doesn't match client's stored address
      if (
        normalizedReportAddress &&
        !normalizedReportAddress.includes(normalizeAddress(client.addressLine1 || "")) &&
        !normalizedClientAddress.includes(normalizedReportAddress.substring(0, 20))
      ) {
        discrepancies.push({
          type: "ADDRESS",
          reportValue: bureauInfo.address,
          clientValue: clientAddress,
          cra,
          reason: "Address on credit report does not match client's current address",
        });
        unmatchedAddresses.push({ address: bureauInfo.address, cra });
      }
    }

    // Check previous addresses
    if (bureauInfo.previousAddresses) {
      for (const addr of bureauInfo.previousAddresses) {
        const normalizedAddr = normalizeAddress(addr);
        // All previous addresses that aren't current should be disputed
        if (
          normalizedAddr &&
          !normalizedAddr.includes(normalizeAddress(client.addressLine1 || ""))
        ) {
          unmatchedAddresses.push({ address: addr, cra });
        }
      }
    }

    // Check name variations
    if (bureauInfo.name) {
      const normalizedReportName = normalizeName(bureauInfo.name);

      // If name doesn't match client's name
      if (
        normalizedReportName &&
        normalizedReportName !== normalizedClientName &&
        !normalizedReportName.includes(normalizedClientName) &&
        !normalizedClientName.includes(normalizedReportName)
      ) {
        discrepancies.push({
          type: "NAME",
          reportValue: bureauInfo.name,
          clientValue: clientFullName,
          cra,
          reason: "Name on credit report does not match client's legal name",
        });
        unmatchedNames.push({ name: bureauInfo.name, cra });
      }
    }
  }

  // Also check previous names from report JSON
  try {
    const previousNames: string[] = JSON.parse(latestReport.previousNames || "[]");
    for (const name of previousNames) {
      const normalizedName = normalizeName(name);
      if (normalizedName !== normalizedClientName) {
        // Only add if not already in list
        if (!unmatchedNames.some(n => normalizeName(n.name) === normalizedName)) {
          unmatchedNames.push({ name, cra: "ALL" }); // Applies to all bureaus
        }
      }
    }
  } catch {
    // Ignore parse errors
  }

  // Also check previous addresses from report JSON
  try {
    const previousAddresses: string[] = JSON.parse(latestReport.previousAddresses || "[]");
    for (const addr of previousAddresses) {
      const normalizedAddr = normalizeAddress(addr);
      if (!normalizedAddr.includes(normalizeAddress(client.addressLine1 || ""))) {
        // Only add if not already in list
        if (!unmatchedAddresses.some(a => normalizeAddress(a.address) === normalizedAddr)) {
          unmatchedAddresses.push({ address: addr, cra: "ALL" }); // Applies to all bureaus
        }
      }
    }
  } catch {
    // Ignore parse errors
  }

  return { discrepancies, unmatchedAddresses, unmatchedNames };
}

/**
 * Get personal info items to include in dispute letter.
 * This combines:
 * 1. Active disputes (previously disputed items still present)
 * 2. Auto-detected discrepancies (addresses/names that don't match client data)
 * 3. Hard inquiries
 */
export async function getPersonalInfoForDispute(
  clientId: string,
  cra: CRA
): Promise<{
  previousNames: string[];
  previousAddresses: string[];
  hardInquiries: HardInquiry[];
}> {
  // Get active disputes
  const activeDisputes = await getActiveDisputes(clientId, cra);

  // Get auto-detected discrepancies
  const { unmatchedAddresses, unmatchedNames } =
    await detectPersonalInfoDiscrepancies(clientId);

  // Get hard inquiries from latest report
  const latestReport = await prisma.creditReport.findFirst({
    where: {
      clientId,
      parseStatus: "COMPLETED",
    },
    orderBy: { reportDate: "desc" },
    select: { hardInquiries: true },
  });

  let hardInquiries: HardInquiry[] = [];
  try {
    const rawInquiries = JSON.parse(latestReport?.hardInquiries || "[]");
    hardInquiries = rawInquiries
      .filter((inq: { cra: string }) => inq.cra === cra || inq.cra === "ALL")
      .map((inq: { creditorName: string; inquiryDate: string; cra: string }) => ({
        creditorName: inq.creditorName,
        inquiryDate: inq.inquiryDate,
        cra: inq.cra as CRA,
      }));
  } catch {
    // Ignore parse errors
  }

  // Combine active disputes with auto-detected discrepancies
  const previousNames = new Set<string>();
  const previousAddresses = new Set<string>();

  // Add from active disputes
  for (const dispute of activeDisputes) {
    if (dispute.type === "PREVIOUS_NAME") {
      previousNames.add(dispute.value);
    } else if (dispute.type === "PREVIOUS_ADDRESS") {
      previousAddresses.add(dispute.value);
    }
  }

  // Add from auto-detected discrepancies
  for (const item of unmatchedNames) {
    if (item.cra === cra || item.cra === "ALL") {
      previousNames.add(item.name);
    }
  }

  for (const item of unmatchedAddresses) {
    if (item.cra === cra || item.cra === "ALL") {
      previousAddresses.add(item.address);
    }
  }

  return {
    previousNames: [...previousNames],
    previousAddresses: [...previousAddresses],
    hardInquiries,
  };
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
