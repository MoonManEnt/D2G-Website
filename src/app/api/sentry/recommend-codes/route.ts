/**
 * SENTRY API - e-OSCAR Code Recommendations
 *
 * POST /api/sentry/recommend-codes - Get e-OSCAR code recommendations for accounts
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import prisma from "@/lib/prisma";
import {
  recommendCodesForAccount,
  getEOSCARCodeDatabase,
  getCodeDescription,
  validateCodeSelection,
  getCodesForFlow,
} from "@/lib/sentry/eoscar-engine";
import type { SentryFlowType, SentryCRA } from "@/types/sentry";
import { sentryRecommendCodesSchema } from "@/lib/api-validation-schemas";

// =============================================================================
// POST /api/sentry/recommend-codes - Get e-OSCAR recommendations
// =============================================================================

export const POST = withAuth(async (req, ctx) => {
  try {
    const body = await req.json();
    const parsed = sentryRecommendCodesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { accountIds, flow, includeAllCodes } = parsed.data;

    // Fetch accounts from database
    const accounts = await prisma.accountItem.findMany({
      where: {
        id: { in: accountIds },
        organizationId: ctx.organizationId,
      },
    });

    if (accounts.length === 0) {
      return NextResponse.json(
        { error: "No valid accounts found" },
        { status: 404 }
      );
    }

    // Get recommendations for each account
    const recommendations = accounts.map((account) => {
      const sentryAccount = {
        id: account.id,
        creditorName: account.creditorName,
        maskedAccountId: account.maskedAccountId || undefined,
        cra: account.cra as SentryCRA,
        accountType: account.accountType || undefined,
        balance: account.balance ? Number(account.balance) : undefined,
        dateOpened: account.dateOpened || undefined,
        dofd: undefined, // AccountItem doesn't have this field yet
        accountStatus: account.paymentStatus || undefined,
        isCollection: account.accountType?.toLowerCase().includes("collection"),
        detectedIssues: account.detectedIssues
          ? JSON.parse(account.detectedIssues)
          : undefined,
      };

      const codes = recommendCodesForAccount(sentryAccount, flow);

      return {
        accountId: account.id,
        creditorName: account.creditorName,
        accountType: account.accountType,
        recommendations: codes.map((rec) => ({
          code: rec.code.code,
          name: rec.name,
          confidence: rec.confidence,
          reasoning: rec.reasoning,
          description: getCodeDescription(rec.code.code),
        })),
        primaryRecommendation: codes.length > 0 ? codes[0].code.code : "105",
      };
    });

    // Get codes available for this flow
    const flowCodes = getCodesForFlow(flow);

    // Optionally include full code database
    const allCodes = includeAllCodes ? getEOSCARCodeDatabase() : undefined;

    // Generate summary
    const codeFrequency: Record<string, number> = {};
    for (const rec of recommendations) {
      if (rec.primaryRecommendation) {
        codeFrequency[rec.primaryRecommendation] =
          (codeFrequency[rec.primaryRecommendation] || 0) + 1;
      }
    }

    const mostCommonCode = Object.entries(codeFrequency).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0];

    return NextResponse.json({
      success: true,
      recommendations,
      summary: {
        accountsAnalyzed: accounts.length,
        primaryRecommendation: mostCommonCode || "105",
        codeDistribution: codeFrequency,
        flowCodesAvailable: flowCodes.length,
      },
      flowCodes: flowCodes.map((code) => ({
        code: code.code,
        name: code.name,
        description: code.shortDescription,
        priority: code.priority,
      })),
      ...(allCodes ? { allCodes } : {}),
      tips: [
        "Avoid code 112 (generic) - it has lowest priority and highest batch-verification rate",
        "Code 105 (Not mine) is effective for collections but requires supporting documentation",
        "Code 106 (Belongs to another) works well for mixed files or identity issues",
        "Use specific codes that match the actual issue for best results",
      ],
      system: "SENTRY",
    });
  } catch (error) {
    console.error("Error recommending codes:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to recommend e-OSCAR codes",
        code: "RECOMMEND_ERROR",
      },
      { status: 500 }
    );
  }
});

// =============================================================================
// GET /api/sentry/recommend-codes - Get code database
// =============================================================================

export const GET = withAuth(async (req, ctx) => {
  try {
    const { searchParams } = new URL(req.url);
    const flow = searchParams.get("flow") as SentryFlowType | null;

    const allCodes = getEOSCARCodeDatabase();
    const flowCodes = flow ? getCodesForFlow(flow) : allCodes;

    return NextResponse.json({
      success: true,
      codes: flowCodes.map((code) => ({
        code: code.code,
        name: code.name,
        description: code.shortDescription,
        priority: code.priority,
        triggerConditions: code.triggerConditions,
        requiredEvidence: code.requiredEvidence,
        avoidWhen: code.avoidWhen,
      })),
      totalCodes: allCodes.length,
      filteredBy: flow || "all",
      system: "SENTRY",
    });
  } catch (error) {
    console.error("Error fetching code database:", error);
    return NextResponse.json(
      { error: "Failed to fetch e-OSCAR code database", code: "FETCH_ERROR" },
      { status: 500 }
    );
  }
});
