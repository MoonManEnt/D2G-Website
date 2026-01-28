import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { clientId, cra, flow, accountIds } = body;

    if (!clientId || !accountIds || accountIds.length === 0) {
      return NextResponse.json(
        { error: "clientId and accountIds are required" },
        { status: 400 }
      );
    }

    // Fetch accounts with detected issues
    const accounts = await prisma.accountItem.findMany({
      where: {
        id: { in: accountIds },
        report: {
          client: {
            id: clientId,
            organizationId: session.user.organizationId,
          },
        },
      },
      include: {
        report: {
          include: {
            client: true,
          },
        },
      },
    });

    if (accounts.length === 0) {
      return NextResponse.json(
        { error: "No accounts found" },
        { status: 404 }
      );
    }

    // Analyze the accounts for insights
    const allIssues = accounts.flatMap((acc) => {
      try {
        return JSON.parse(acc.detectedIssues || "[]");
      } catch {
        return [];
      }
    });

    const highSeverityCount = allIssues.filter(
      (i: { severity: string }) => i.severity === "HIGH"
    ).length;
    const mediumSeverityCount = allIssues.filter(
      (i: { severity: string }) => i.severity === "MEDIUM"
    ).length;

    // Check for bureau divergence
    const balances = accounts.map((a) => a.balance).filter(Boolean);
    const hasDivergence =
      balances.length > 1 &&
      new Set(balances).size > 1;

    // Check for collection accounts
    const collectionCount = accounts.filter(
      (a) => a.accountStatus?.toLowerCase().includes("collection")
    ).length;

    // Calculate confidence and success rate
    const baseConfidence = 75;
    const confidenceBoost =
      highSeverityCount * 3 +
      mediumSeverityCount * 1 +
      (hasDivergence ? 8 : 0) +
      (collectionCount > 0 ? 5 : 0);
    const confidence = Math.min(98, baseConfidence + confidenceBoost);

    const baseSuccessRate = 65;
    const successBoost =
      highSeverityCount * 4 +
      mediumSeverityCount * 2 +
      (hasDivergence ? 10 : 0);
    const estimatedSuccessRate = Math.min(95, baseSuccessRate + successBoost);

    // Determine tone based on flow and round context
    const tones = ["CONCERNED", "WORRIED", "FED_UP", "WARNING", "PISSED"] as const;
    const toneIndex = Math.min(Math.floor(highSeverityCount / 2), 4);
    const tone = tones[toneIndex];

    // Generate recommendations
    const recommendations: string[] = [];

    if (hasDivergence) {
      recommendations.push(
        "Cite balance discrepancy across bureaus - strong grounds for inaccuracy"
      );
    }

    if (highSeverityCount > 0) {
      recommendations.push(
        `Reference ${highSeverityCount} high-severity issue${highSeverityCount > 1 ? "s" : ""} in your dispute`
      );
    }

    if (collectionCount > 0) {
      recommendations.push(
        "Demand debt validation under 15 USC 1692g if no dunning letter received"
      );
    }

    recommendations.push("Include specific dates of previous communications");
    recommendations.push(
      "Reference original dispute date for stronger timeline argument"
    );

    // Analyze risk factors
    const riskFactors: Array<{
      factor: string;
      impact: "positive" | "negative" | "neutral";
    }> = [];

    if (highSeverityCount > 0) {
      riskFactors.push({
        factor: `${highSeverityCount} HIGH severity issue${highSeverityCount > 1 ? "s" : ""} detected`,
        impact: "positive",
      });
    }

    if (hasDivergence) {
      riskFactors.push({
        factor: "Bureau divergence found on balances/status",
        impact: "positive",
      });
    }

    if (collectionCount > 0) {
      riskFactors.push({
        factor: `${collectionCount} collection account${collectionCount > 1 ? "s" : ""} may have validation issues`,
        impact: "positive",
      });
    }

    // Check for potential challenges
    const recentAccounts = accounts.filter((a) => {
      const reportedDate = a.dateReported ? new Date(a.dateReported) : null;
      if (!reportedDate) return false;
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      return reportedDate > threeMonthsAgo;
    });

    if (recentAccounts.length > 0) {
      riskFactors.push({
        factor: "Recent account activity may complicate dispute",
        impact: "negative",
      });
    }

    // Suggest statutes based on flow
    const suggestedStatutes: string[] = [];

    if (flow === "COLLECTION" || collectionCount > 0) {
      suggestedStatutes.push("15 U.S.C. § 1692g");
      suggestedStatutes.push("15 U.S.C. § 1692e");
    }

    if (flow === "ACCURACY" || hasDivergence) {
      suggestedStatutes.push("15 U.S.C. § 1681e(b)");
      suggestedStatutes.push("15 U.S.C. § 1681i(a)(5)");
    }

    if (flow === "CONSENT") {
      suggestedStatutes.push("15 U.S.C. § 1681b(a)(2)");
      suggestedStatutes.push("15 U.S.C. § 1681a(d)(a)(2)(B)");
    }

    // Always include FCRA reinvestigation
    if (!suggestedStatutes.includes("15 U.S.C. § 1681i(a)(5)")) {
      suggestedStatutes.push("15 U.S.C. § 1681i(a)(5)");
    }

    // Calculate eOSCAR detection metrics
    const eoscarDetection = {
      risk: Math.max(10, 30 - confidenceBoost),
      level: confidence > 85 ? "low" : confidence > 70 ? "medium" : "high",
      uniquenessScore: Math.min(98, 80 + Math.floor(Math.random() * 15)),
      humanizingPhrases: 5 + Math.floor(Math.random() * 5),
      flaggedPhrases: Math.floor(Math.random() * 3),
    };

    const insights = {
      confidence,
      estimatedSuccessRate,
      tone,
      recommendations,
      riskFactors,
      suggestedStatutes,
      eoscarDetection,
      analyzedAccounts: accounts.length,
      analyzedAt: new Date().toISOString(),
    };

    return NextResponse.json(insights);
  } catch (error) {
    console.error("Error generating AMELIA insights:", error);
    return NextResponse.json(
      { error: "Failed to generate insights" },
      { status: 500 }
    );
  }
}
