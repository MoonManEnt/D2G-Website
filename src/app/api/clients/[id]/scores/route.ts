import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

// Schema for adding a credit score
const createScoreSchema = z.object({
  cra: z.enum(["TRANSUNION", "EXPERIAN", "EQUIFAX"]),
  score: z.number().min(300).max(850),
  scoreDate: z.string().transform((s) => new Date(s)),
  scoreType: z.enum(["FICO8", "FICO9", "VANTAGE3", "VANTAGE4"]).default("VANTAGE3"),
  source: z.enum(["MANUAL", "REPORT_PARSE", "API_SYNC"]).default("MANUAL"),
  factorsPositive: z.array(z.string()).optional(),
  factorsNegative: z.array(z.string()).optional(),
});

// GET /api/clients/[id]/scores - Get credit score history for a client
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientId = params.id;

    // Verify client belongs to organization
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: session.user.organizationId,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get query params for filtering
    const { searchParams } = new URL(request.url);
    const cra = searchParams.get("cra");
    const limit = parseInt(searchParams.get("limit") || "100");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build query
    const where: Record<string, unknown> = { clientId };

    if (cra) {
      where.cra = cra;
    }

    if (startDate || endDate) {
      where.scoreDate = {};
      if (startDate) {
        (where.scoreDate as Record<string, Date>).gte = new Date(startDate);
      }
      if (endDate) {
        (where.scoreDate as Record<string, Date>).lte = new Date(endDate);
      }
    }

    // Get scores
    const scores = await prisma.creditScore.findMany({
      where,
      orderBy: { scoreDate: "desc" },
      take: limit,
    });

    // Calculate stats
    const stats = {
      latest: {} as Record<string, number>,
      change30Days: {} as Record<string, number>,
      change90Days: {} as Record<string, number>,
      highest: {} as Record<string, number>,
      lowest: {} as Record<string, number>,
    };

    // Get latest score per CRA
    for (const cra of ["TRANSUNION", "EXPERIAN", "EQUIFAX"]) {
      const latestForCRA = scores.find((s) => s.cra === cra);
      if (latestForCRA) {
        stats.latest[cra] = latestForCRA.score;

        // Calculate changes
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const scoreAt30Days = scores.find(
          (s) => s.cra === cra && new Date(s.scoreDate) <= thirtyDaysAgo
        );
        const scoreAt90Days = scores.find(
          (s) => s.cra === cra && new Date(s.scoreDate) <= ninetyDaysAgo
        );

        if (scoreAt30Days) {
          stats.change30Days[cra] = latestForCRA.score - scoreAt30Days.score;
        }
        if (scoreAt90Days) {
          stats.change90Days[cra] = latestForCRA.score - scoreAt90Days.score;
        }

        // Get highest and lowest for this CRA
        const craScores = scores.filter((s) => s.cra === cra);
        stats.highest[cra] = Math.max(...craScores.map((s) => s.score));
        stats.lowest[cra] = Math.min(...craScores.map((s) => s.score));
      }
    }

    // Group scores by date for charting
    const chartData = scores.reduce(
      (acc, score) => {
        const dateKey = new Date(score.scoreDate).toISOString().split("T")[0];
        if (!acc[dateKey]) {
          acc[dateKey] = { date: dateKey };
        }
        acc[dateKey][score.cra] = score.score;
        return acc;
      },
      {} as Record<string, Record<string, string | number>>
    );

    return NextResponse.json({
      scores,
      stats,
      chartData: Object.values(chartData).sort(
        (a, b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime()
      ),
    });
  } catch (error) {
    console.error("Failed to fetch credit scores:", error);
    return NextResponse.json(
      { error: "Failed to fetch credit scores" },
      { status: 500 }
    );
  }
}

// POST /api/clients/[id]/scores - Add a new credit score
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientId = params.id;

    // Verify client belongs to organization
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: session.user.organizationId,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const body = await request.json();
    const validation = createScoreSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { cra, score, scoreDate, scoreType, source, factorsPositive, factorsNegative } =
      validation.data;

    // Create the score
    const creditScore = await prisma.creditScore.create({
      data: {
        clientId,
        cra,
        score,
        scoreDate,
        scoreType,
        source,
        factorsPositive: factorsPositive ? JSON.stringify(factorsPositive) : null,
        factorsNegative: factorsNegative ? JSON.stringify(factorsNegative) : null,
      },
    });

    return NextResponse.json({ score: creditScore }, { status: 201 });
  } catch (error) {
    console.error("Failed to create credit score:", error);
    return NextResponse.json(
      { error: "Failed to create credit score" },
      { status: 500 }
    );
  }
}

// DELETE /api/clients/[id]/scores?scoreId=xxx - Delete a credit score
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientId = params.id;
    const { searchParams } = new URL(request.url);
    const scoreId = searchParams.get("scoreId");

    if (!scoreId) {
      return NextResponse.json({ error: "Score ID required" }, { status: 400 });
    }

    // Verify client and score belong to organization
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: session.user.organizationId,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const score = await prisma.creditScore.findFirst({
      where: {
        id: scoreId,
        clientId,
      },
    });

    if (!score) {
      return NextResponse.json({ error: "Score not found" }, { status: 404 });
    }

    await prisma.creditScore.delete({
      where: { id: scoreId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete credit score:", error);
    return NextResponse.json(
      { error: "Failed to delete credit score" },
      { status: 500 }
    );
  }
}
