/**
 * PORTAL VENDOR RECOMMENDATIONS API
 *
 * GET /api/portal/recommendations - Get vendor recommendations for the authenticated portal client
 *
 * Uses JWT portal auth. Builds client evaluation context and runs vendor rules engine.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPortalToken, extractBearerToken } from "@/lib/jwt";
import { buildClientContext, evaluateVendorsForClient } from "@/lib/vendor-rules";
import { createLogger } from "@/lib/logger";
const log = createLogger("portal-recommendations-api");

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    const token = extractBearerToken(authHeader);

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyPortalToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const clientId = payload.sub;
    const organizationId = payload.organizationId;

    // Fetch client
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId,
        isActive: true,
        archivedAt: null,
      },
      select: {
        id: true,
        stage: true,
        statedIncome: true,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Fetch accounts
    const accounts = await prisma.accountItem.findMany({
      where: { clientId, organizationId },
      select: {
        accountType: true,
        accountStatus: true,
        balance: true,
        creditLimit: true,
      },
    });

    const transformedAccounts = accounts.map((a) => ({
      accountType: a.accountType,
      accountStatus: a.accountStatus,
      balance: a.balance != null ? Number(a.balance) : null,
      creditLimit: a.creditLimit != null ? Number(a.creditLimit) : null,
    }));

    // Fetch latest credit scores per CRA
    const creditScores = await prisma.creditScore.findMany({
      where: { clientId },
      orderBy: { scoreDate: "desc" },
      take: 10,
      select: { cra: true, score: true, scoreType: true },
    });

    const latestScoresByCRA = new Map<string, { cra: string; score: number; scoreType: string }>();
    for (const score of creditScores) {
      if (!latestScoresByCRA.has(score.cra)) {
        latestScoresByCRA.set(score.cra, score);
      }
    }
    const dedupedScores = Array.from(latestScoresByCRA.values());

    // Fetch Credit DNA
    const dna = await prisma.creditDNA.findFirst({
      where: { clientId, organizationId },
      orderBy: { createdAt: "desc" },
      select: {
        classification: true,
        healthScore: true,
        improvementPotential: true,
      },
    });

    // Count inquiries
    const latestReport = await prisma.creditReport.findFirst({
      where: { clientId, organizationId, parseStatus: "COMPLETED" },
      orderBy: { reportDate: "desc" },
      select: { hardInquiries: true },
    });

    let inquiryCount = 0;
    if (latestReport?.hardInquiries) {
      try {
        const inquiries = JSON.parse(latestReport.hardInquiries);
        inquiryCount = Array.isArray(inquiries) ? inquiries.length : 0;
      } catch {
        inquiryCount = 0;
      }
    }

    // Fetch latest readiness analysis
    const readiness = await prisma.creditReadinessAnalysis.findFirst({
      where: { clientId, organizationId },
      orderBy: { createdAt: "desc" },
      select: { productType: true, approvalLikelihood: true },
    });

    // Build evaluation context
    const context = buildClientContext({
      client: {
        stage: client.stage,
        statedIncome: client.statedIncome,
      },
      accounts: transformedAccounts,
      creditScores: dedupedScores,
      dna,
      inquiryCount,
      readinessProductType: readiness?.productType,
      approvalLikelihood: readiness?.approvalLikelihood,
    });

    // Fetch active vendors with rules for this organization
    const vendors = await prisma.vendor.findMany({
      where: { organizationId, isActive: true },
      select: {
        id: true,
        name: true,
        category: true,
        affiliateUrl: true,
        rules: {
          where: { isActive: true },
          orderBy: { priority: "desc" },
          select: {
            id: true,
            name: true,
            priority: true,
            isActive: true,
            conditions: true,
            recommendationTitle: true,
            recommendationBody: true,
            recommendationCTA: true,
            customAffiliateUrl: true,
          },
        },
      },
    });

    // Evaluate rules
    const recommendations = evaluateVendorsForClient(vendors, context);

    return NextResponse.json({
      recommendations,
      totalRecommendations: recommendations.length,
    });
  } catch (error) {
    log.error({ err: error }, "Portal recommendations error");
    return NextResponse.json(
      { error: "Failed to load recommendations" },
      { status: 500 }
    );
  }
}
