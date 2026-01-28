/**
 * SENTRY DISPUTE API - Generate/Regenerate Letter
 *
 * POST /api/sentry/[id]/generate - Generate or regenerate letter for dispute
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { format } from "date-fns";
import {
  generateSentryLetter,
  type GenerationContext,
} from "@/lib/sentry/sentry-generator";
import type { SentryCRA, SentryFlowType } from "@/types/sentry";
import { sentryGenerateSchema } from "@/lib/api-validation-schemas";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// =============================================================================
// POST /api/sentry/[id]/generate - Generate or regenerate letter
// =============================================================================

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    const body = await request.json();
    const parsed = sentryGenerateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { eoscarCodeOverride, customLanguage, templateId } = parsed.data;

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the dispute with all related data
    const dispute = await prisma.sentryDispute.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        client: true,
        items: {
          include: {
            accountItem: true,
          },
        },
      },
    });

    if (!dispute) {
      return NextResponse.json(
        { error: "Sentry dispute not found" },
        { status: 404 }
      );
    }

    // Only allow generation for DRAFT disputes
    if (dispute.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Can only generate letters for DRAFT disputes" },
        { status: 400 }
      );
    }

    const client = dispute.client;

    // Build generation context
    const generationContext: GenerationContext = {
      clientName: `${client.firstName} ${client.lastName}`,
      clientAddress: client.addressLine1 || "",
      clientCityStateZip: `${client.city || ""}, ${client.state || ""} ${client.zipCode || ""}`,
      clientSSNLast4: client.ssnLast4 || "XXXX",
      clientDOB: client.dateOfBirth
        ? format(new Date(client.dateOfBirth), "MM/dd/yyyy")
        : "XX/XX/XXXX",
      cra: dispute.cra as SentryCRA,
      flow: dispute.flow as SentryFlowType,
      round: dispute.round as 1 | 2 | 3 | 4,
      accounts: dispute.items.map((item) => {
        const acc = item.accountItem;
        // Parse detected issues from JSON string if present
        let detectedIssues: { code: string; description: string; severity: string }[] = [];
        if (acc.detectedIssues) {
          try {
            detectedIssues = JSON.parse(acc.detectedIssues);
          } catch {
            // Ignore parsing errors
          }
        }

        // Build dispute reason from detected issues if not provided
        let disputeReason = item.disputeReason;
        if (!disputeReason && detectedIssues.length > 0) {
          // Use the first high-severity issue, or first issue if no high-severity
          const highSeverityIssue = detectedIssues.find(i => i.severity === "HIGH");
          const primaryIssue = highSeverityIssue || detectedIssues[0];
          if (primaryIssue) {
            disputeReason = primaryIssue.description;
          }
        }

        return {
          id: acc.id,
          creditorName: acc.creditorName,
          maskedAccountId: acc.maskedAccountId || undefined,
          accountType: acc.accountType || undefined,
          balance: acc.balance ? Number(acc.balance) : undefined,
          dateOpened: acc.dateOpened || undefined,
          accountStatus: acc.accountStatus || acc.paymentStatus || undefined,
          isCollection: acc.accountType?.toLowerCase().includes("collection"),
          disputeReason: disputeReason || undefined,
          detectedIssues: detectedIssues.map(i => ({
            code: i.code,
            description: i.description,
            severity: i.severity as "HIGH" | "MEDIUM" | "LOW",
          })),
          cra: acc.cra as SentryCRA,
        };
      }),
      templateId,
      eoscarCodeOverride,
      customLanguage,
    };

    // Get previous dispute info for R2+
    if (dispute.round > 1) {
      const previousDispute = await prisma.sentryDispute.findFirst({
        where: {
          clientId: dispute.clientId,
          cra: dispute.cra,
          round: dispute.round - 1,
          status: "SENT",
        },
        orderBy: { sentDate: "desc" },
      });

      if (previousDispute?.sentDate) {
        generationContext.previousDisputeDate = format(
          previousDispute.sentDate,
          "MMMM d, yyyy"
        );
      }
    }

    // Generate the letter
    const generationResult = generateSentryLetter(generationContext);

    // Update dispute with generated content
    await prisma.sentryDispute.update({
      where: { id: dispute.id },
      data: {
        letterContent: generationResult.letterContent,
        letterContentHash: generateContentHash(generationResult.letterContent),
        eoscarCodes: JSON.stringify(
          generationResult.eoscarRecommendations.map((r) => r.code)
        ),
        metro2Fields: JSON.stringify(
          generationResult.metro2Disputes.map((d) => d.field.code)
        ),
        ocrRiskScore: generationResult.ocrAnalysis.score,
        successProbability: generationResult.successPrediction.probability,
      },
    });

    // Update or create analysis record
    await prisma.sentryAnalysis.upsert({
      where: { sentryDisputeId: dispute.id },
      create: {
        sentryDisputeId: dispute.id,
        recommendedCodes: JSON.stringify(
          generationResult.eoscarRecommendations
        ),
        codeSelectionRationale: `Selected ${generationResult.selectedEOSCARCode} based on account characteristics`,
        validCitations: JSON.stringify(
          generationResult.citationValidation.validCitations
        ),
        invalidCitations: JSON.stringify(
          generationResult.citationValidation.invalidCitations
        ),
        citationWarnings: JSON.stringify(
          generationResult.citationValidation.warnings
        ),
        ocrScore: generationResult.ocrAnalysis.score,
        ocrFindings: JSON.stringify(generationResult.ocrAnalysis.findings),
        ocrFixSuggestions: JSON.stringify(
          generationResult.ocrAnalysis.findings
            .filter((f) => f.suggestion)
            .map((f) => ({
              phrase: f.phrase,
              suggestion: f.suggestion,
            }))
        ),
        identifiedFields: JSON.stringify(
          generationResult.metro2Disputes.map((d) => d.field)
        ),
        fieldDiscrepancies: JSON.stringify(generationResult.discrepancies),
        successProbability: generationResult.successPrediction.probability,
        successBreakdown: JSON.stringify(
          generationResult.successPrediction.breakdown
        ),
        improvementTips: JSON.stringify(
          generationResult.successPrediction.recommendations
        ),
      },
      update: {
        recommendedCodes: JSON.stringify(
          generationResult.eoscarRecommendations
        ),
        codeSelectionRationale: `Selected ${generationResult.selectedEOSCARCode} based on account characteristics`,
        validCitations: JSON.stringify(
          generationResult.citationValidation.validCitations
        ),
        invalidCitations: JSON.stringify(
          generationResult.citationValidation.invalidCitations
        ),
        citationWarnings: JSON.stringify(
          generationResult.citationValidation.warnings
        ),
        ocrScore: generationResult.ocrAnalysis.score,
        ocrFindings: JSON.stringify(generationResult.ocrAnalysis.findings),
        ocrFixSuggestions: JSON.stringify(
          generationResult.ocrAnalysis.findings
            .filter((f) => f.suggestion)
            .map((f) => ({
              phrase: f.phrase,
              suggestion: f.suggestion,
            }))
        ),
        identifiedFields: JSON.stringify(
          generationResult.metro2Disputes.map((d) => d.field)
        ),
        fieldDiscrepancies: JSON.stringify(generationResult.discrepancies),
        successProbability: generationResult.successPrediction.probability,
        successBreakdown: JSON.stringify(
          generationResult.successPrediction.breakdown
        ),
        improvementTips: JSON.stringify(
          generationResult.successPrediction.recommendations
        ),
      },
    });

    // Update items with e-OSCAR codes and Metro 2 fields
    for (const item of dispute.items) {
      const primaryCode = generationResult.selectedEOSCARCode;

      await prisma.sentryDisputeItem.update({
        where: { id: item.id },
        data: {
          eoscarCode: primaryCode,
          metro2Fields: JSON.stringify(
            generationResult.metro2Disputes.map((d) => d.field.code)
          ),
        },
      });
    }

    // Log the generation
    await prisma.eventLog.create({
      data: {
        eventType: "SENTRY_LETTER_GENERATED",
        actorId: session.user.id,
        targetType: "SentryDispute",
        targetId: dispute.id,
        eventData: JSON.stringify({
          templateUsed: generationResult.templateId,
          selectedEOSCARCode: generationResult.selectedEOSCARCode,
          ocrScore: generationResult.ocrAnalysis.score,
          ocrAutoFixApplied: generationResult.ocrAutoFixApplied,
          successProbability: generationResult.successPrediction.probability,
        }),
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json({
      success: true,
      letterContent: generationResult.letterContent,
      sentry: {
        templateUsed: generationResult.templateName,
        templateId: generationResult.templateId,
        selectedEOSCARCode: generationResult.selectedEOSCARCode,
        eoscarRecommendations: generationResult.eoscarRecommendations,
        ocrAnalysis: {
          score: generationResult.ocrAnalysis.score,
          risk: generationResult.ocrAnalysis.risk,
          findings: generationResult.ocrAnalysis.findings,
          autoFixApplied: generationResult.ocrAutoFixApplied,
        },
        citationValidation: {
          isValid: generationResult.citationValidation.isValid,
          validCitations: generationResult.citationValidation.validCitations,
          invalidCitations:
            generationResult.citationValidation.invalidCitations,
          warnings: generationResult.citationValidation.warnings,
        },
        metro2Targeting: {
          fieldsTargeted: generationResult.metro2Disputes.length,
          disputes: generationResult.metro2Disputes,
          discrepancies: generationResult.discrepancies,
        },
        successPrediction: {
          probability: generationResult.successPrediction.probability,
          confidence: generationResult.successPrediction.confidence,
          breakdown: generationResult.successPrediction.breakdown,
          recommendations: generationResult.successPrediction.recommendations,
          actionableRecommendations: generationResult.successPrediction.actionableRecommendations || [],
        },
        warnings: generationResult.warnings,
      },
      system: "SENTRY",
    });
  } catch (error) {
    console.error("Error generating Sentry letter:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate Sentry letter",
        code: "GENERATE_ERROR",
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function generateContentHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `sentry_${Math.abs(hash).toString(16)}`;
}
