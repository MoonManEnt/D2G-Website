import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { getDisputeReasonFromIssueCode } from "@/lib/dispute-templates";
import { format } from "date-fns";
import {
  generateLetter,
  type ClientPersonalInfo,
  type DisputeAccount,
  type HardInquiry,
  type ActivePersonalInfoDispute,
} from "@/lib/amelia/index";
import { CRA } from "@/types";
import {
  getActiveDisputes,
  getLastDisputeDate,
} from "@/lib/personal-info-dispute-service";

// =============================================================================
// POST /api/disputes/preview - Generate AMELIA letter preview WITHOUT creating dispute
// =============================================================================
// This endpoint generates a letter preview for review. The dispute is NOT created
// until the user explicitly clicks "Launch Round X".
//
// This prevents the issue where closing the modal leaves a DRAFT dispute that
// blocks future round creation.
// =============================================================================

export const POST = withAuth(async (req, ctx) => {
  try {
    const body = await req.json();
    const { clientId, cra, flow, accountIds } = body;

    // Validate required fields
    if (!clientId || !cra || !flow || !accountIds || accountIds.length === 0) {
      return NextResponse.json(
        { error: "clientId, cra, flow, and accountIds are required" },
        { status: 400 }
      );
    }

    // Validate CRA
    if (!["TRANSUNION", "EXPERIAN", "EQUIFAX"].includes(cra)) {
      return NextResponse.json(
        { error: "Invalid CRA. Must be TRANSUNION, EXPERIAN, or EQUIFAX" },
        { status: 400 }
      );
    }

    // Validate flow
    if (!["ACCURACY", "COLLECTION", "CONSENT", "COMBO"].includes(flow)) {
      return NextResponse.json(
        { error: "Invalid flow. Must be ACCURACY, COLLECTION, CONSENT, or COMBO" },
        { status: 400 }
      );
    }

    // Get client info
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: ctx.organizationId,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get account items - verify they belong to this organization
    // Note: We don't filter by CRA here because accounts may be multi-bureau
    // The frontend already filters accounts by CRA before selection
    const accounts = await prisma.accountItem.findMany({
      where: {
        id: { in: accountIds },
        organizationId: ctx.organizationId,
      },
    });

    if (accounts.length === 0) {
      return NextResponse.json(
        { error: "No valid accounts found" },
        { status: 400 }
      );
    }

    // Determine the next round number for this client/CRA combination
    // Only count SENT, RESPONDED, or RESOLVED disputes (not DRAFT)
    const lastDispute = await prisma.dispute.findFirst({
      where: {
        clientId,
        cra,
        status: { in: ["SENT", "RESPONDED", "RESOLVED"] },
      },
      orderBy: { round: "desc" },
    });

    const round = (lastDispute?.round || 0) + 1;

    // Fetch the most recent credit report for personal info
    const latestReport = await prisma.creditReport.findFirst({
      where: {
        clientId: client.id,
        parseStatus: "COMPLETED",
      },
      orderBy: { reportDate: "desc" },
    });

    // Parse personal info from report
    let previousNames: string[] = [];
    let previousAddresses: string[] = [];
    let hardInquiries: HardInquiry[] = [];

    if (latestReport) {
      try {
        previousNames = JSON.parse(latestReport.previousNames || "[]");
        previousAddresses = JSON.parse(latestReport.previousAddresses || "[]");
        const rawInquiries = JSON.parse(latestReport.hardInquiries || "[]");
        hardInquiries = rawInquiries.map((inq: { creditorName: string; inquiryDate: string; cra: string }) => ({
          creditorName: inq.creditorName,
          inquiryDate: inq.inquiryDate,
          cra: inq.cra as CRA,
        }));
      } catch {
        // If parsing fails, use empty arrays
      }
    }

    // Build client personal info for AMELIA
    const clientInfo: ClientPersonalInfo = {
      firstName: client.firstName,
      lastName: client.lastName,
      fullName: `${client.firstName} ${client.lastName}`,
      addressLine1: client.addressLine1 || "",
      addressLine2: client.addressLine2 || undefined,
      city: client.city || "",
      state: client.state || "",
      zipCode: client.zipCode || "",
      ssnLast4: client.ssnLast4 || "XXXX",
      dateOfBirth: client.dateOfBirth
        ? format(new Date(client.dateOfBirth), "MM/dd/yyyy")
        : "XX/XX/XXXX",
      phone: client.phone || undefined,
      previousNames,
      previousAddresses,
      hardInquiries,
    };

    // Build dispute accounts for AMELIA
    const disputeAccounts: DisputeAccount[] = accounts.map((acc) => {
      const issues = acc.detectedIssues ? JSON.parse(acc.detectedIssues) : [];

      return {
        creditorName: acc.creditorName || "Unknown Creditor",
        accountNumber: acc.maskedAccountId || "XXXXXXXX****",
        accountType: acc.accountType || undefined,
        balance: acc.balance ? parseFloat(acc.balance.toString()) : undefined,
        pastDue: acc.pastDue ? parseFloat(acc.pastDue.toString()) : undefined,
        dateOpened: acc.dateOpened
          ? format(new Date(acc.dateOpened), "MM/dd/yyyy")
          : undefined,
        dateReported: acc.dateReported
          ? format(new Date(acc.dateReported), "MM/dd/yyyy")
          : undefined,
        paymentStatus: acc.paymentStatus || undefined,
        issues: issues,
        inaccurateCategories: [],
      };
    });

    // Get used content hashes to ensure uniqueness
    const usedHashes = await prisma.ameliaContentHash.findMany({
      where: { clientId: client.id },
      select: { contentHash: true },
    });
    const usedHashSet = new Set(usedHashes.map((h) => h.contentHash));

    // For R2+, fetch last dispute date and active personal info disputes
    let lastDisputeDateStr: string | undefined;
    let activePersonalInfoDisputes: ActivePersonalInfoDispute[] | undefined;

    if (round >= 2) {
      const lastDisputeDate = await getLastDisputeDate(client.id, cra as CRA);
      if (lastDisputeDate) {
        lastDisputeDateStr = format(lastDisputeDate, "MMMM d, yyyy");
      }
      activePersonalInfoDisputes = await getActiveDisputes(client.id, cra as CRA);
    }

    // Generate the letter using AMELIA doctrine
    const generatedLetter = generateLetter({
      client: clientInfo,
      accounts: disputeAccounts,
      cra: cra as CRA,
      flow: flow as "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO",
      round,
      usedContentHashes: usedHashSet,
      lastDisputeDate: lastDisputeDateStr,
      activePersonalInfoDisputes,
    });

    // Build dispute reasons for each account (for display purposes)
    const accountsWithReasons = accounts.map((account) => {
      let disputeReason = "Information is inaccurate and requires verification";
      try {
        const issues = account.detectedIssues ? JSON.parse(account.detectedIssues) : [];
        if (issues.length > 0) {
          disputeReason = getDisputeReasonFromIssueCode(issues[0].code);
        }
      } catch {
        // Use default reason
      }

      return {
        id: account.id,
        creditorName: account.creditorName,
        maskedAccountId: account.maskedAccountId,
        balance: account.balance ? Number(account.balance) : null,
        accountType: account.accountType,
        disputeReason,
      };
    });

    // Return preview data (NO dispute created)
    return NextResponse.json({
      success: true,
      preview: {
        // This is a preview - no disputeId yet
        isPreview: true,
        clientId: client.id,
        cra,
        flow,
        round,
        letterContent: generatedLetter.content,
        contentHash: generatedLetter.contentHash,
        accounts: accountsWithReasons,
      },
      amelia: {
        tone: generatedLetter.tone,
        isBackdated: generatedLetter.isBackdated,
        backdatedDays: generatedLetter.backdatedDays,
        letterDate: generatedLetter.letterDate.toISOString(),
        effectiveFlow: generatedLetter.effectiveFlow,
        statute: generatedLetter.statute,
        personalInfoDisputed: {
          previousNames: generatedLetter.personalInfoDisputed.previousNames.length,
          previousAddresses: generatedLetter.personalInfoDisputed.previousAddresses.length,
          hardInquiries: generatedLetter.personalInfoDisputed.hardInquiries.length,
        },
      },
    });
  } catch (error) {
    console.error("Error generating preview:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate preview", code: "PREVIEW_ERROR" },
      { status: 500 }
    );
  }
});
