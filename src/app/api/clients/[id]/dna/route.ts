/**
 * Credit DNA Analysis API
 *
 * GET /api/clients/[id]/dna - Get the latest DNA analysis for a client
 * POST /api/clients/[id]/dna - Generate/refresh DNA analysis for a client
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  analyzeCreditDNA,
  type AccountForAnalysis,
  type InquiryForAnalysis,
  type ScoreForAnalysis,
} from "@/lib/credit-dna";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/clients/[id]/dna - Get latest DNA analysis
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: clientId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify client belongs to user's organization
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: session.user.organizationId,
      },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get the most recent DNA analysis
    const dna = await prisma.creditDNA.findFirst({
      where: { clientId },
      orderBy: { analyzedAt: "desc" },
    });

    if (!dna) {
      return NextResponse.json({
        hasDNA: false,
        message: "No DNA analysis found. Use POST to generate one.",
      });
    }

    // Parse JSON fields
    return NextResponse.json({
      hasDNA: true,
      dna: {
        id: dna.id,
        clientId: dna.clientId,
        reportId: dna.reportId,
        classification: dna.classification,
        subClassifications: JSON.parse(dna.subClassifications),
        confidence: dna.confidence,
        confidenceLevel: dna.confidenceLevel,
        healthScore: dna.healthScore,
        improvementPotential: dna.improvementPotential,
        urgencyScore: dna.urgencyScore,
        fileThickness: JSON.parse(dna.fileThickness),
        derogatoryProfile: JSON.parse(dna.derogatoryProfile),
        utilization: JSON.parse(dna.utilization),
        bureauDivergence: JSON.parse(dna.bureauDivergence),
        inquiryAnalysis: JSON.parse(dna.inquiryAnalysis),
        positiveFactors: JSON.parse(dna.positiveFactors),
        disputeReadiness: JSON.parse(dna.disputeReadiness),
        summary: dna.summary,
        keyInsights: JSON.parse(dna.keyInsights),
        immediateActions: JSON.parse(dna.immediateActions),
        version: dna.version,
        computeTimeMs: dna.computeTimeMs,
        analyzedAt: dna.analyzedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching Credit DNA:", error);
    return NextResponse.json(
      { error: "Failed to fetch Credit DNA" },
      { status: 500 }
    );
  }
}

// POST /api/clients/[id]/dna - Generate/refresh DNA analysis
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: clientId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { reportId, forceRefresh = false } = body;

    // Verify client belongs to user's organization
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: session.user.organizationId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        organizationId: true,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get the most recent report (or specified report)
    const report = await prisma.creditReport.findFirst({
      where: {
        clientId,
        ...(reportId ? { id: reportId } : {}),
        parseStatus: "COMPLETED",
      },
      orderBy: { reportDate: "desc" },
      include: {
        accounts: true,
      },
    });

    if (!report) {
      return NextResponse.json(
        { error: "No parsed credit report found for this client" },
        { status: 404 }
      );
    }

    // Check if we already have a recent DNA for this report
    if (!forceRefresh) {
      const existingDNA = await prisma.creditDNA.findFirst({
        where: {
          clientId,
          reportId: report.id,
        },
        orderBy: { analyzedAt: "desc" },
      });

      if (existingDNA) {
        // Return existing analysis
        return NextResponse.json({
          isExisting: true,
          message: "Using existing DNA analysis. Set forceRefresh=true to regenerate.",
          dna: {
            id: existingDNA.id,
            classification: existingDNA.classification,
            subClassifications: JSON.parse(existingDNA.subClassifications),
            confidence: existingDNA.confidence,
            confidenceLevel: existingDNA.confidenceLevel,
            healthScore: existingDNA.healthScore,
            improvementPotential: existingDNA.improvementPotential,
            urgencyScore: existingDNA.urgencyScore,
            summary: existingDNA.summary,
            keyInsights: JSON.parse(existingDNA.keyInsights),
            immediateActions: JSON.parse(existingDNA.immediateActions),
            analyzedAt: existingDNA.analyzedAt,
          },
        });
      }
    }

    // Transform accounts for DNA analysis
    const accounts: AccountForAnalysis[] = report.accounts.map((acc) => ({
      id: acc.id,
      creditorName: acc.creditorName,
      accountNumber: acc.maskedAccountId,
      cra: acc.cra as "TRANSUNION" | "EXPERIAN" | "EQUIFAX",
      accountType: acc.accountType,
      accountStatus: acc.accountStatus,
      balance: acc.balance,
      creditLimit: acc.creditLimit,
      highBalance: acc.highBalance,
      pastDue: acc.pastDue,
      dateOpened: acc.dateOpened,
      dateReported: acc.dateReported,
      paymentStatus: acc.paymentStatus,
      detectedIssues: acc.detectedIssues ? JSON.parse(acc.detectedIssues) : [],
      fingerprint: acc.fingerprint,
    }));

    // Get credit scores for this client
    const scores = await prisma.creditScore.findMany({
      where: { clientId },
      orderBy: { scoreDate: "desc" },
      take: 3, // One per bureau
    });

    const scoresForAnalysis: ScoreForAnalysis[] = scores.map((score) => ({
      cra: score.cra as "TRANSUNION" | "EXPERIAN" | "EQUIFAX",
      score: score.score,
      scoreType: score.scoreType,
      scoreDate: score.scoreDate,
      factorsPositive: score.factorsPositive ? JSON.parse(score.factorsPositive) : [],
      factorsNegative: score.factorsNegative ? JSON.parse(score.factorsNegative) : [],
    }));

    // Parse hard inquiries from report
    let hardInquiries: InquiryForAnalysis[] = [];
    try {
      const rawInquiries = JSON.parse(report.hardInquiries || "[]");
      hardInquiries = rawInquiries.map((inq: { creditorName: string; inquiryDate: string; cra: string }) => ({
        creditorName: inq.creditorName,
        inquiryDate: inq.inquiryDate,
        cra: inq.cra as "TRANSUNION" | "EXPERIAN" | "EQUIFAX",
      }));
    } catch {
      // If parsing fails, continue with empty array
    }

    // Parse previous names and addresses
    let previousNames: string[] = [];
    let previousAddresses: string[] = [];
    try {
      previousNames = JSON.parse(report.previousNames || "[]");
      previousAddresses = JSON.parse(report.previousAddresses || "[]");
    } catch {
      // If parsing fails, continue with empty arrays
    }

    // Run the DNA analysis
    const dnaProfile = analyzeCreditDNA({
      clientId,
      reportId: report.id,
      accounts,
      scores: scoresForAnalysis,
      hardInquiries,
      previousNames,
      previousAddresses,
    });

    // Store the DNA analysis
    const savedDNA = await prisma.creditDNA.create({
      data: {
        clientId,
        reportId: report.id,
        organizationId: client.organizationId,
        classification: dnaProfile.classification,
        subClassifications: JSON.stringify(dnaProfile.subClassifications),
        confidence: dnaProfile.confidence,
        confidenceLevel: dnaProfile.confidenceLevel,
        healthScore: dnaProfile.overallHealthScore,
        improvementPotential: dnaProfile.improvementPotential,
        urgencyScore: dnaProfile.urgencyScore,
        fileThickness: JSON.stringify(dnaProfile.fileThickness),
        derogatoryProfile: JSON.stringify(dnaProfile.derogatoryProfile),
        utilization: JSON.stringify(dnaProfile.utilization),
        bureauDivergence: JSON.stringify(dnaProfile.bureauDivergence),
        inquiryAnalysis: JSON.stringify(dnaProfile.inquiryAnalysis),
        positiveFactors: JSON.stringify(dnaProfile.positiveFactors),
        disputeReadiness: JSON.stringify(dnaProfile.disputeReadiness),
        summary: dnaProfile.summary,
        keyInsights: JSON.stringify(dnaProfile.keyInsights),
        immediateActions: JSON.stringify(dnaProfile.immediateActions),
        version: dnaProfile.version,
        computeTimeMs: dnaProfile.computeTimeMs,
        analyzedAt: dnaProfile.analyzedAt,
      },
    });

    // Log the event
    await prisma.eventLog.create({
      data: {
        eventType: "DNA_ANALYSIS_GENERATED",
        actorId: session.user.id,
        actorEmail: session.user.email || undefined,
        targetType: "CLIENT",
        targetId: clientId,
        eventData: JSON.stringify({
          dnaId: savedDNA.id,
          reportId: report.id,
          classification: dnaProfile.classification,
          healthScore: dnaProfile.overallHealthScore,
          computeTimeMs: dnaProfile.computeTimeMs,
        }),
        organizationId: client.organizationId,
      },
    });

    return NextResponse.json({
      success: true,
      isExisting: false,
      dna: {
        id: savedDNA.id,
        clientId: savedDNA.clientId,
        reportId: savedDNA.reportId,
        classification: dnaProfile.classification,
        subClassifications: dnaProfile.subClassifications,
        confidence: dnaProfile.confidence,
        confidenceLevel: dnaProfile.confidenceLevel,
        healthScore: dnaProfile.overallHealthScore,
        improvementPotential: dnaProfile.improvementPotential,
        urgencyScore: dnaProfile.urgencyScore,
        fileThickness: dnaProfile.fileThickness,
        derogatoryProfile: dnaProfile.derogatoryProfile,
        utilization: dnaProfile.utilization,
        bureauDivergence: dnaProfile.bureauDivergence,
        inquiryAnalysis: dnaProfile.inquiryAnalysis,
        positiveFactors: dnaProfile.positiveFactors,
        disputeReadiness: dnaProfile.disputeReadiness,
        summary: dnaProfile.summary,
        keyInsights: dnaProfile.keyInsights,
        immediateActions: dnaProfile.immediateActions,
        version: dnaProfile.version,
        computeTimeMs: dnaProfile.computeTimeMs,
        analyzedAt: dnaProfile.analyzedAt,
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
