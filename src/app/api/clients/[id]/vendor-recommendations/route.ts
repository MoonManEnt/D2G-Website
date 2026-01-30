/**
 * CLIENT VENDOR RECOMMENDATIONS API
 *
 * GET /api/clients/[id]/vendor-recommendations - Evaluate vendor rules for a client
 *
 * Builds a client evaluation context from database data and runs it through
 * the Vendor Rules Engine to produce personalized vendor recommendations.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { buildClientContext, evaluateVendorsForClient } from "@/lib/vendor-rules";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// =============================================================================
// GET /api/clients/[id]/vendor-recommendations
// =============================================================================

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: clientId } = await params;

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;

    // 1. Fetch client with stage and income
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId,
        isActive: true,
        archivedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        stage: true,
        statedIncome: true,
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    // 2. Fetch accounts
    const accounts = await prisma.accountItem.findMany({
      where: {
        clientId,
        organizationId,
      },
      select: {
        accountType: true,
        accountStatus: true,
        balance: true,
        creditLimit: true,
      },
    });

    // Transform decimal fields to numbers
    const transformedAccounts = accounts.map((a) => ({
      accountType: a.accountType,
      accountStatus: a.accountStatus,
      balance: a.balance != null ? Number(a.balance) : null,
      creditLimit: a.creditLimit != null ? Number(a.creditLimit) : null,
    }));

    // 3. Fetch credit scores (latest per CRA)
    const creditScores = await prisma.creditScore.findMany({
      where: { clientId },
      orderBy: { scoreDate: "desc" },
      take: 10,
      select: {
        cra: true,
        score: true,
        scoreType: true,
      },
    });

    // Deduplicate to get latest score per CRA
    const latestScoresByCRA = new Map<string, { cra: string; score: number; scoreType: string }>();
    for (const score of creditScores) {
      if (!latestScoresByCRA.has(score.cra)) {
        latestScoresByCRA.set(score.cra, score);
      }
    }
    const dedupedScores = Array.from(latestScoresByCRA.values());

    // 4. Fetch Credit DNA (latest)
    const dna = await prisma.creditDNA.findFirst({
      where: {
        clientId,
        organizationId,
      },
      orderBy: { createdAt: "desc" },
      select: {
        classification: true,
        healthScore: true,
        improvementPotential: true,
      },
    });

    // 5. Count hard inquiries from latest report
    const latestReport = await prisma.creditReport.findFirst({
      where: {
        clientId,
        organizationId,
        parseStatus: "COMPLETED",
      },
      orderBy: { reportDate: "desc" },
      select: {
        hardInquiries: true,
      },
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

    // 6. Fetch latest readiness analysis (optional context)
    const readiness = await prisma.creditReadinessAnalysis.findFirst({
      where: {
        clientId,
        organizationId,
      },
      orderBy: { createdAt: "desc" },
      select: {
        productType: true,
        approvalLikelihood: true,
      },
    });

    // 7. Build the ClientEvaluationContext
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

    // 8. Fetch all active vendors with active rules for this organization
    const vendors = await prisma.vendor.findMany({
      where: {
        organizationId,
        isActive: true,
      },
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

    // 9. Evaluate vendor rules against the client context
    const recommendations = evaluateVendorsForClient(vendors, context);

    return NextResponse.json({
      success: true,
      clientId,
      clientName: `${client.firstName} ${client.lastName}`,
      context: {
        avgScore: context.avgScore,
        minScore: context.minScore,
        maxScore: context.maxScore,
        collectionCount: context.collectionCount,
        chargeOffCount: context.chargeOffCount,
        totalDebt: context.totalDebt,
        utilization: Math.round(context.utilization * 100) / 100,
        accountCount: context.accountCount,
        disputeStage: context.disputeStage,
        dnaClassification: context.dnaClassification,
        healthScore: context.healthScore,
        hasIncome: context.hasIncome,
        inquiryCount: context.inquiryCount,
      },
      recommendations,
      totalVendorsEvaluated: vendors.length,
      totalRecommendations: recommendations.length,
    });
  } catch (error) {
    console.error("Error evaluating vendor recommendations:", error);
    return NextResponse.json(
      { error: "Failed to evaluate vendor recommendations", code: "EVALUATION_ERROR" },
      { status: 500 }
    );
  }
}
