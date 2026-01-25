import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

const CLASSIFICATION_DESCRIPTIONS: Record<string, string> = {
  PRIME: "Excellent credit profile with minor issues. Focus on optimization.",
  NEAR_PRIME: "Good credit with room for improvement. Strategic disputes can accelerate progress.",
  REBUILDER: "Client has significant negative history but shows potential for rapid improvement with strategic dispute approach.",
  SUBPRIME: "Significant negative items requiring aggressive dispute strategy.",
  THIN_FILE: "Limited credit history. Focus on building positive tradelines alongside disputes.",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: clientId } = await params;

    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: session.user.organizationId,
      },
      include: {
        creditScores: { orderBy: { scoreDate: "desc" }, take: 10 },
        accounts: {
          where: { isDisputable: true },
          select: {
            id: true, creditorName: true, cra: true,
            accountStatus: true, accountType: true, balance: true, detectedIssues: true,
          },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Query CreditDNA separately since there's no explicit relation
    const dna = await prisma.creditDNA.findFirst({
      where: {
        clientId,
        organizationId: session.user.organizationId,
      },
      orderBy: { createdAt: "desc" },
    });

    const latestScores = {
      TU: client.creditScores.find((s: { cra: string; score: number }) => s.cra === "TRANSUNION")?.score || null,
      EX: client.creditScores.find((s: { cra: string; score: number }) => s.cra === "EXPERIAN")?.score || null,
      EQ: client.creditScores.find((s: { cra: string; score: number }) => s.cra === "EQUIFAX")?.score || null,
    };

    const validScores = [latestScores.TU, latestScores.EX, latestScores.EQ].filter(Boolean) as number[];
    const avgScore = validScores.length > 0
      ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
      : 0;

    const accounts = client.accounts;
    const collections = accounts.filter((a: { accountType: string | null; accountStatus: string | null }) =>
      a.accountType?.toLowerCase().includes("collection") || a.accountStatus === "COLLECTION"
    );
    const chargeoffs = accounts.filter((a: { accountStatus: string | null }) => a.accountStatus?.toLowerCase().includes("charge"));
    const latePayments = accounts.filter((a: { detectedIssues: string | null }) => a.detectedIssues?.toLowerCase().includes("late"));

    const parseJSON = (str: string | undefined, fallback: unknown) => {
      if (!str) return fallback;
      try { return JSON.parse(str); } catch { return fallback; }
    };

    const bureauDivergence = parseJSON(dna?.bureauDivergence, {}) as Record<string, unknown>;
    const disputeReadiness = parseJSON(dna?.disputeReadiness, {}) as Record<string, unknown>;
    const keyInsights = parseJSON(dna?.keyInsights, []) as string[];

    const classification = dna?.classification || (avgScore >= 670 ? "NEAR_PRIME" : avgScore >= 580 ? "REBUILDER" : "SUBPRIME");
    const negCount = accounts.length;

    const response = {
      clientId: client.id,
      clientName: client.firstName + " " + client.lastName,
      generatedAt: dna?.createdAt?.toISOString() || new Date().toISOString(),
      classification,
      classificationDescription: CLASSIFICATION_DESCRIPTIONS[classification] || CLASSIFICATION_DESCRIPTIONS.REBUILDER,
      scores: {
        current: latestScores,
        average: avgScore,
        trend: avgScore > 600 ? "IMPROVING" : "NEEDS_ATTENTION",
        change30d: 0,
        change90d: 0,
        potential: Math.min(avgScore + 100, 750),
        potentialTimeline: "6-9 months",
      },
      metrics: {
        overallHealth: dna?.healthScore || 50,
        paymentHistory: 60,
        creditUtilization: 45,
        creditAge: 65,
        creditMix: 50,
        newCredit: 70,
      },
      improvement: {
        score: dna?.improvementPotential || 70,
        factors: [
          { factor: "Collection removals", impact: "+45-65 pts", probability: 75 },
          { factor: "Late payment disputes", impact: "+15-25 pts", probability: 60 },
          { factor: "Balance corrections", impact: "+5-10 pts", probability: 85 },
        ],
        totalPotential: "+" + Math.min(100, negCount * 15) + "-" + Math.min(150, negCount * 25) + " pts",
      },
      urgency: {
        score: dna?.urgencyScore || 60,
        level: dna?.urgencyScore && dna.urgencyScore > 70 ? "HIGH" : dna?.urgencyScore && dna.urgencyScore > 40 ? "MEDIUM" : "LOW",
        reasons: [
          collections.length > 0 ? collections.length + " collection accounts actively reporting" : null,
          negCount > 3 ? negCount + " negative items affecting score" : null,
          "Strategic dispute window optimal",
        ].filter(Boolean),
      },
      accountBreakdown: {
        total: negCount + 5,
        positive: 5,
        negative: negCount,
        neutral: 2,
        collections: collections.length,
        chargeoffs: chargeoffs.length,
        latePayments: latePayments.length,
      },
      bureauDivergence: {
        hasSignificantDivergence: ((bureauDivergence.divergenceScore as number) || 0) > 50 || negCount > 2,
        divergenceScore: (bureauDivergence.divergenceScore as number) || 60,
        accounts: accounts.slice(0, 3).map((a: { creditorName: string; cra: string; balance: number | null }) => ({
          name: a.creditorName,
          field: "balance",
          TU: a.cra === "TRANSUNION" ? a.balance : null,
          EX: a.cra === "EXPERIAN" ? a.balance : null,
          EQ: a.cra === "EQUIFAX" ? a.balance : null,
        })),
      },
      strategy: {
        recommendedFlow: collections.length > negCount / 2 ? "COLLECTION" : "ACCURACY",
        priorityAccounts: accounts.slice(0, 3).map((a: { creditorName: string }) => a.creditorName),
        approach: (disputeReadiness.approach as string) || "Focus on high-impact items first, then address remaining inaccuracies.",
        estimatedRounds: Math.min(4, Math.ceil(negCount / 3)) + "-" + Math.min(6, Math.ceil(negCount / 2)) + " rounds",
        cfpbRecommended: negCount > 5,
      },
      riskFactors: [
        ...keyInsights.slice(0, 2).map(insight => ({ type: "positive", factor: insight })),
        { type: "positive", factor: "Bureau divergence creates strong accuracy argument" },
        negCount > 5 ? { type: "negative", factor: "High number of negative items may require extended timeline" } : null,
      ].filter(Boolean),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching Credit DNA:", error);
    return NextResponse.json({ error: "Failed to fetch Credit DNA" }, { status: 500 });
  }
}

// POST - Generate a new Credit DNA profile
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: clientId } = await params;
    const organizationId = session.user.organizationId;

    // Fetch client with accounts, scores, and latest report
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId,
      },
      include: {
        creditScores: { orderBy: { scoreDate: "desc" }, take: 10 },
        accounts: {
          select: {
            id: true,
            creditorName: true,
            cra: true,
            accountStatus: true,
            accountType: true,
            balance: true,
            detectedIssues: true,
            isDisputable: true,
          },
        },
        reports: {
          where: { parseStatus: "COMPLETED" },
          orderBy: { reportDate: "desc" },
          take: 1,
          select: { id: true },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Need at least one parsed report
    if (client.reports.length === 0) {
      return NextResponse.json(
        { error: "No parsed credit report found. Upload a report first." },
        { status: 400 }
      );
    }

    const reportId = client.reports[0].id;

    // Calculate DNA metrics
    const latestScores = {
      TU: client.creditScores.find((s) => s.cra === "TRANSUNION")?.score || null,
      EX: client.creditScores.find((s) => s.cra === "EXPERIAN")?.score || null,
      EQ: client.creditScores.find((s) => s.cra === "EQUIFAX")?.score || null,
    };

    const validScores = [latestScores.TU, latestScores.EX, latestScores.EQ].filter(Boolean) as number[];
    const avgScore = validScores.length > 0
      ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
      : 0;

    const negativeAccounts = client.accounts.filter((a) => a.isDisputable);
    const collections = client.accounts.filter((a) =>
      a.accountType?.toLowerCase().includes("collection") || a.accountStatus === "COLLECTION"
    );
    const chargeoffs = client.accounts.filter((a) =>
      a.accountStatus?.toLowerCase().includes("charge")
    );

    // Determine classification
    let classification: string;
    if (avgScore >= 740) {
      classification = "PRIME";
    } else if (avgScore >= 670) {
      classification = "NEAR_PRIME";
    } else if (avgScore >= 580) {
      classification = "REBUILDER";
    } else if (client.accounts.length < 5) {
      classification = "THIN_FILE_REBUILDER";
    } else {
      classification = "THICK_FILE_DEROG";
    }

    // Calculate health and improvement scores
    const healthScore = Math.min(100, Math.max(0,
      50 +
      (avgScore > 670 ? 20 : avgScore > 580 ? 10 : 0) -
      (negativeAccounts.length * 5) -
      (collections.length * 10)
    ));

    const improvementPotential = Math.min(100,
      30 +
      (negativeAccounts.length * 10) +
      (collections.length * 15)
    );

    const urgencyScore = Math.min(100,
      20 +
      (negativeAccounts.length * 8) +
      (collections.length * 12) +
      (avgScore < 600 ? 20 : 0)
    );

    // Key insights
    const keyInsights: string[] = [];
    if (collections.length > 0) {
      keyInsights.push(`${collections.length} collection accounts are primary targets for removal`);
    }
    if (chargeoffs.length > 0) {
      keyInsights.push(`${chargeoffs.length} charge-offs require strategic dispute approach`);
    }
    if (avgScore > 0 && avgScore < 600) {
      keyInsights.push("Score is below average - significant improvement potential exists");
    }
    if (negativeAccounts.length > 5) {
      keyInsights.push("Multiple negative items suggest systematic reporting issues");
    }

    // Check if DNA already exists for this client
    const existingDNA = await prisma.creditDNA.findFirst({
      where: { clientId, organizationId },
    });

    let dna;
    if (existingDNA) {
      // Update existing
      dna = await prisma.creditDNA.update({
        where: { id: existingDNA.id },
        data: {
          reportId,
          classification,
          healthScore,
          improvementPotential,
          urgencyScore,
          keyInsights: JSON.stringify(keyInsights),
          bureauDivergence: JSON.stringify({
            divergenceScore: negativeAccounts.length > 2 ? 70 : 40,
            hasSignificantDivergence: negativeAccounts.length > 2,
          }),
          disputeReadiness: JSON.stringify({
            score: 80,
            approach: collections.length > negativeAccounts.length / 2
              ? "Collection-first approach recommended"
              : "Accuracy-based dispute strategy optimal",
          }),
          analyzedAt: new Date(),
        },
      });
    } else {
      // Create new
      dna = await prisma.creditDNA.create({
        data: {
          clientId,
          organizationId,
          reportId,
          classification,
          healthScore,
          improvementPotential,
          urgencyScore,
          keyInsights: JSON.stringify(keyInsights),
          bureauDivergence: JSON.stringify({
            divergenceScore: negativeAccounts.length > 2 ? 70 : 40,
            hasSignificantDivergence: negativeAccounts.length > 2,
          }),
          disputeReadiness: JSON.stringify({
            score: 80,
            approach: collections.length > negativeAccounts.length / 2
              ? "Collection-first approach recommended"
              : "Accuracy-based dispute strategy optimal",
          }),
        },
      });
    }

    // Return full DNA profile
    return NextResponse.json({
      success: true,
      dna: {
        classification,
        classificationDescription: CLASSIFICATION_DESCRIPTIONS[classification] || CLASSIFICATION_DESCRIPTIONS.REBUILDER,
        healthScore,
        improvementPotential,
        urgencyScore,
        keyInsights,
        generatedAt: dna.analyzedAt?.toISOString() || new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error generating Credit DNA:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate Credit DNA" },
      { status: 500 }
    );
  }
}
