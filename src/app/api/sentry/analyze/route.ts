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
import type { DisputeFlow } from "@/lib/sentry/types";
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
      // UI-shaped account analysis records
      const accountAnalyses: Array<{
        id: string;
        creditorName: string;
        accountNumber: string;
        cra: string;
        flow: string;
        round: number;
        recommendedCodes: string[];
        metro2Fields: string[];
        successProbability: number;
        ocrSafetyScore: number;
        ocrSafetyLabel: string;
        issues: Array<{ code: string; description: string; severity: string }>;
        explanation: string;
      }> = [];

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

        // Transform for UI consumption
        const successProbPercent = Math.round(successProb.probability * 100);
        const topCodeStrings = eoscarRecs.slice(0, 5).map((r) => r.code);
        const metro2FieldNames = metro2Targets.map((t) => t.field?.name || "Unknown");

        // Map issues for UI (DetectedIssue already has code, description, severity)
        const parsedIssues = issues.map((issue) => ({
          code: issue.code || "UNKNOWN",
          description: issue.description || "Issue detected",
          severity: issue.severity || "MEDIUM",
        }));

        accountAnalyses.push({
          id: acct.id,
          creditorName: acct.creditorName,
          accountNumber: acct.maskedAccountId || "N/A",
          cra: acct.cra,
          flow: recommendedFlow,
          round: (acct.currentRound || 0) + 1,
          recommendedCodes: topCodeStrings,
          metro2Fields: metro2FieldNames,
          successProbability: successProbPercent,
          ocrSafetyScore: 80, // Default until letter is generated
          ocrSafetyLabel: "Safe",
          issues: parsedIssues,
          explanation: `${acct.creditorName}: ${eoscarRecs.length} e-OSCAR codes recommended, ${metro2Targets.length} Metro 2 field targets identified. Success probability: ${successProbPercent}%.`,
        });

        // Collect recommendations
        for (const rec of successProb.recommendations) {
          if (!allRecommendations.includes(rec)) allRecommendations.push(rec);
        }
      }

      // Determine round for this bureau group
      const maxRound = Math.max(...craAccounts.map((a) => a.currentRound || 0));
      const nextRound = maxRound + 1;

      // Aggregate success probability (accounts now have flat number 0-100)
      const avgSuccess =
        accountAnalyses.reduce((sum, a) => sum + a.successProbability, 0) /
        accountAnalyses.length;

      // Determine flow for bureau group (majority vote)
      const flowCounts: Record<string, number> = {};
      for (const a of accountAnalyses) {
        flowCounts[a.flow] = (flowCounts[a.flow] || 0) + 1;
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

    // Determine overall readiness (avgSuccess is now 0-100)
    const avgGroupSuccess =
      bureauGroups.reduce((sum, g) => sum + g.aggregateSuccessProbability, 0) /
      bureauGroups.length;

    let overallReadiness: "READY" | "NEEDS_REVIEW" | "NOT_READY";
    if (avgGroupSuccess >= 30) overallReadiness = "READY";
    else if (avgGroupSuccess >= 15) overallReadiness = "NEEDS_REVIEW";
    else overallReadiness = "NOT_READY";

    // Build summary text for the UI
    const summaryText = `Analyzed ${accounts.length} account${accounts.length !== 1 ? "s" : ""} across ${bureauGroups.length} bureau${bureauGroups.length !== 1 ? "s" : ""}. Average success probability: ${Math.round(avgGroupSuccess)}%. ${allRecommendations.length > 0 ? allRecommendations[0] : ""}`;

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

    // Return in the shape the UI expects: { groups, readiness, summary }
    return NextResponse.json({
      groups: bureauGroups,
      readiness: overallReadiness,
      summary: summaryText,
    });
  } catch (error) {
    log.error({ err: error }, "Sentry analyze failed");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
