/**
 * Sentry Analyze API
 *
 * POST /api/sentry/analyze
 * Runs full Sentry analysis on a client's disputable accounts.
 * Returns a SentryDisputePlan with recommendations grouped by CRA.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { tierHasFeature } from "@/lib/tier-features";
import { SubscriptionTier } from "@/types";
import {
  recommendEOSCARCodes,
  detectTargetableFields,
  calculateSuccessProbability,
  buildFurnisherProfile,
} from "@/lib/sentry";
import { parseDetectedIssues } from "@/lib/dispute-creation/letter-strategies";
import type {
  SentryDisputePlan,
  SentryAccountAnalysis,
  DisputeFlow,
} from "@/lib/sentry/types";
import type { DisputeAccountData } from "@/lib/dispute-creation/types";
import { createLogger } from "@/lib/logger";

const log = createLogger("sentry-analyze-api");

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Tier gate: PROFESSIONAL+
    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { subscriptionTier: true },
    });

    if (!org || !tierHasFeature(org.subscriptionTier as SubscriptionTier, "sentryMode")) {
      return NextResponse.json(
        { error: "Sentry Mode requires Professional tier or higher" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { clientId, accountIds } = body as { clientId: string; accountIds?: string[] };

    if (!clientId) {
      return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }

    // Verify client belongs to org
    const client = await prisma.client.findFirst({
      where: { id: clientId, organizationId: session.user.organizationId },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Fetch disputable accounts
    const accountWhere: Record<string, unknown> = {
      clientId,
      isDisputable: true,
      isLockedInDispute: false,
    };
    if (accountIds?.length) {
      accountWhere.id = { in: accountIds };
    }

    const accounts = await prisma.accountItem.findMany({
      where: accountWhere,
      orderBy: { cra: "asc" },
    });

    if (accounts.length === 0) {
      return NextResponse.json({
        error: "No disputable accounts found",
        plan: null,
      }, { status: 200 });
    }

    // Group accounts by CRA
    const byBureau: Record<string, typeof accounts> = {};
    for (const acct of accounts) {
      if (!byBureau[acct.cra]) byBureau[acct.cra] = [];
      byBureau[acct.cra].push(acct);
    }

    // Analyze each bureau group
    const bureauGroups = [];
    const allRecommendations: string[] = [];

    for (const [cra, craAccounts] of Object.entries(byBureau)) {
      const accountAnalyses: SentryAccountAnalysis[] = [];

      for (const acct of craAccounts) {
        const accountData: DisputeAccountData = {
          id: acct.id,
          creditorName: acct.creditorName,
          maskedAccountId: acct.maskedAccountId,
          cra: acct.cra,
          accountType: acct.accountType,
          accountStatus: acct.accountStatus,
          balance: acct.balance,
          pastDue: acct.pastDue,
          creditLimit: acct.creditLimit,
          dateOpened: acct.dateOpened,
          dateReported: acct.dateReported,
          paymentStatus: acct.paymentStatus,
          confidenceScore: acct.confidenceScore,
          detectedIssues: acct.detectedIssues,
          isDisputable: acct.isDisputable,
        };

        const issues = parseDetectedIssues(acct.detectedIssues);
        const furnisher = await buildFurnisherProfile(
          session.user.organizationId,
          acct.creditorName
        );

        // e-OSCAR recommendations
        const eoscarRecs = recommendEOSCARCodes(accountData, issues, furnisher || undefined);

        // Metro 2 targets (cross-bureau)
        const crossBureau = accounts
          .filter((a) => a.creditorName === acct.creditorName && a.cra !== acct.cra)
          .map((a) => ({
            id: a.id,
            creditorName: a.creditorName,
            maskedAccountId: a.maskedAccountId,
            cra: a.cra,
            accountType: a.accountType,
            accountStatus: a.accountStatus,
            balance: a.balance,
            pastDue: a.pastDue,
            creditLimit: a.creditLimit,
            dateOpened: a.dateOpened,
            dateReported: a.dateReported,
            paymentStatus: a.paymentStatus,
            confidenceScore: a.confidenceScore,
            detectedIssues: a.detectedIssues,
            isDisputable: a.isDisputable,
          }));

        const metro2Targets = detectTargetableFields(accountData, crossBureau);

        // Determine recommended flow
        const isCollection =
          acct.accountStatus?.toUpperCase() === "COLLECTION" ||
          acct.accountType?.toLowerCase().includes("collection");
        const recommendedFlow: DisputeFlow = isCollection ? "COLLECTION" : "ACCURACY";

        // Success probability
        const topCodes = eoscarRecs.slice(0, 3).map((r) => r.code);
        const successProb = await calculateSuccessProbability({
          accountId: acct.id,
          creditorName: acct.creditorName,
          accountAge: acct.numberOfMonths || undefined,
          accountType: acct.accountType || undefined,
          accountStatus: acct.accountStatus,
          balance: acct.balance || undefined,
          flow: recommendedFlow,
          round: (acct.currentRound || 0) + 1,
          eoscarCodes: topCodes,
          hasDocumentation: false,
          citationAccuracy: 1,
          ocrSafetyScore: 80,
          organizationId: session.user.organizationId,
          furnisherProfile: furnisher || undefined,
        });

        accountAnalyses.push({
          accountId: acct.id,
          creditorName: acct.creditorName,
          maskedAccountId: acct.maskedAccountId,
          cra: acct.cra,
          recommendedFlow,
          eoscarRecommendations: eoscarRecs,
          metro2Targets,
          successProbability: successProb,
        });

        // Collect recommendations
        for (const rec of successProb.recommendations) {
          if (!allRecommendations.includes(rec)) allRecommendations.push(rec);
        }
      }

      // Determine round for this bureau group
      const maxRound = Math.max(...craAccounts.map((a) => a.currentRound || 0));
      const nextRound = maxRound + 1;

      // Aggregate success probability
      const avgSuccess =
        accountAnalyses.reduce((sum, a) => sum + a.successProbability.probability, 0) /
        accountAnalyses.length;

      // Determine flow for bureau group (majority vote)
      const flowCounts: Record<string, number> = {};
      for (const a of accountAnalyses) {
        flowCounts[a.recommendedFlow] = (flowCounts[a.recommendedFlow] || 0) + 1;
      }
      const groupFlow = Object.entries(flowCounts).sort((a, b) => b[1] - a[1])[0][0] as DisputeFlow;

      bureauGroups.push({
        cra,
        flow: groupFlow,
        round: nextRound,
        accounts: accountAnalyses,
        aggregateSuccessProbability: Math.round(avgSuccess * 100) / 100,
      });
    }

    // Determine overall readiness
    const avgGroupSuccess =
      bureauGroups.reduce((sum, g) => sum + g.aggregateSuccessProbability, 0) /
      bureauGroups.length;

    let overallReadiness: "READY" | "NEEDS_REVIEW" | "NOT_READY";
    if (avgGroupSuccess >= 0.3) overallReadiness = "READY";
    else if (avgGroupSuccess >= 0.15) overallReadiness = "NEEDS_REVIEW";
    else overallReadiness = "NOT_READY";

    const plan: SentryDisputePlan = {
      clientId,
      analyzedAt: new Date().toISOString(),
      bureauGroups,
      overallReadiness,
      totalAccounts: accounts.length,
      recommendations: allRecommendations,
    };

    // Log activity
    await prisma.sentryActivityLog.create({
      data: {
        organizationId: session.user.organizationId,
        clientId,
        activityType: "ANALYSIS_COMPLETE",
        summary: `Sentry analyzed ${accounts.length} accounts across ${bureauGroups.length} bureaus. Readiness: ${overallReadiness}`,
        details: JSON.stringify({ totalAccounts: accounts.length, bureauGroups: bureauGroups.length, overallReadiness }),
        triggeredBy: session.user.id,
      },
    });

    return NextResponse.json({ success: true, plan });
  } catch (error) {
    log.error({ err: error }, "Sentry analyze failed");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
