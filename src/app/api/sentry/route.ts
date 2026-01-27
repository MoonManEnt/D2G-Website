/**
 * SENTRY DISPUTE API - Main Routes
 *
 * GET /api/sentry - List all Sentry disputes
 * POST /api/sentry - Create a new Sentry dispute
 *
 * ISOLATION: This API is completely separate from /api/disputes
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { format } from "date-fns";
import {
  generateSentryLetter,
  type GenerationContext,
} from "@/lib/sentry/sentry-generator";
import type { SentryCRA, SentryFlowType } from "@/types/sentry";

// =============================================================================
// GET /api/sentry - List all Sentry disputes
// =============================================================================

export const GET = withAuth(async (req, ctx) => {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    const status = searchParams.get("status");

    const disputes = await prisma.sentryDispute.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(clientId && { clientId }),
        ...(status && { status }),
        // Only show disputes for active, non-archived clients
        client: {
          isActive: true,
          archivedAt: null,
        },
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        items: {
          include: {
            accountItem: {
              select: {
                id: true,
                creditorName: true,
                maskedAccountId: true,
                balance: true,
                accountType: true,
              },
            },
          },
        },
        analysis: {
          select: {
            ocrScore: true,
            successProbability: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Transform decimal fields
    const transformedDisputes = disputes.map((dispute) => ({
      ...dispute,
      successProbability: dispute.successProbability
        ? Number(dispute.successProbability)
        : null,
      items: dispute.items.map((item) => ({
        ...item,
        accountItem: {
          ...item.accountItem,
          balance: item.accountItem.balance
            ? Number(item.accountItem.balance)
            : null,
        },
      })),
    }));

    return NextResponse.json({
      success: true,
      disputes: transformedDisputes,
      system: "SENTRY",
    });
  } catch (error) {
    console.error("Error fetching Sentry disputes:", error);
    return NextResponse.json(
      { error: "Failed to fetch Sentry disputes", code: "FETCH_ERROR" },
      { status: 500 }
    );
  }
});

// =============================================================================
// POST /api/sentry - Create a new Sentry dispute with intelligence analysis
// =============================================================================

export const POST = withAuth(async (req, ctx) => {
  try {
    const body = await req.json();
    const {
      clientId,
      cra,
      flow,
      accountIds,
      generateLetter = true,
      eoscarCodeOverride,
      customLanguage,
    } = body;

    // Validate required fields
    if (!clientId || !cra || !flow || !accountIds || accountIds.length === 0) {
      return NextResponse.json(
        { error: "clientId, cra, flow, and accountIds are required" },
        { status: 400 }
      );
    }

    // Validate CRA
    if (!["TRANSUNION", "EXPERIAN", "EQUIFAX"].includes(cra)) {
      return NextResponse.json(
        { error: "Invalid CRA. Must be TRANSUNION, EXPERIAN, or EQUIFAX" },
        { status: 400 }
      );
    }

    // Validate flow
    if (!["ACCURACY", "COLLECTION", "CONSENT", "COMBO"].includes(flow)) {
      return NextResponse.json(
        { error: "Invalid flow. Must be ACCURACY, COLLECTION, CONSENT, or COMBO" },
        { status: 400 }
      );
    }

    // Get client info
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: ctx.organizationId,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get account items - verify they belong to this CRA and organization
    const accounts = await prisma.accountItem.findMany({
      where: {
        id: { in: accountIds },
        organizationId: ctx.organizationId,
        cra: cra,
      },
    });

    if (accounts.length === 0) {
      return NextResponse.json(
        { error: "No valid accounts found for the specified CRA" },
        { status: 400 }
      );
    }

    // Determine round number PER ACCOUNT - accounts never disputed start at Round 1
    // Check if any of the selected accounts are already in a DRAFT dispute
    const existingDraftWithAccounts = await prisma.sentryDispute.findFirst({
      where: {
        clientId,
        cra,
        status: "DRAFT",
        items: {
          some: {
            accountItemId: { in: accountIds },
          },
        },
      },
      include: {
        items: {
          where: {
            accountItemId: { in: accountIds },
          },
          include: {
            accountItem: {
              select: { creditorName: true },
            },
          },
        },
      },
    });

    // Only block if there's a draft that contains the SAME accounts
    if (existingDraftWithAccounts) {
      const affectedAccounts = existingDraftWithAccounts.items
        .map((i) => i.accountItem.creditorName)
        .join(", ");
      return NextResponse.json(
        {
          error: `Draft dispute exists for selected accounts`,
          details: {
            currentRound: existingDraftWithAccounts.round,
            currentStatus: "DRAFT",
            affectedAccounts,
            disputeId: existingDraftWithAccounts.id,
            message: `You have a draft dispute (Round ${existingDraftWithAccounts.round}) that includes: ${affectedAccounts}. Please send or delete that draft first.`,
          },
        },
        { status: 400 }
      );
    }

    // Find the highest round for each selected account with this CRA
    const previousDisputesForAccounts = await prisma.sentryDisputeItem.findMany({
      where: {
        accountItemId: { in: accountIds },
        sentryDispute: {
          cra,
          status: { in: ["SENT", "RESPONDED", "RESOLVED"] }, // Only count completed disputes
        },
      },
      include: {
        sentryDispute: {
          select: { round: true },
        },
      },
    });

    // Determine the max round across all selected accounts
    let maxPreviousRound = 0;
    for (const item of previousDisputesForAccounts) {
      if (item.sentryDispute.round > maxPreviousRound) {
        maxPreviousRound = item.sentryDispute.round;
      }
    }

    // Next round is max + 1, or 1 if no previous disputes for these accounts
    const round = maxPreviousRound + 1;

    // Create the Sentry dispute with items
    const dispute = await prisma.sentryDispute.create({
      data: {
        clientId,
        organizationId: ctx.organizationId,
        cra,
        flow,
        round,
        status: "DRAFT",
        items: {
          create: accounts.map((account) => {
            let disputeReason = "Information requires verification";
            try {
              const issues = account.detectedIssues
                ? JSON.parse(account.detectedIssues)
                : [];
              if (issues.length > 0) {
                disputeReason = issues[0].description || disputeReason;
              }
            } catch {
              // Use default reason
            }

            return {
              accountItemId: account.id,
              disputeReason,
              eoscarCode: eoscarCodeOverride,
            };
          }),
        },
      },
      include: {
        items: {
          include: {
            accountItem: true,
          },
        },
      },
    });

    // Generate letter if requested
    let generationResult = null;
    if (generateLetter) {
      // Build generation context
      const generationContext: GenerationContext = {
        clientName: `${client.firstName} ${client.lastName}`,
        clientAddress: client.addressLine1 || "",
        clientCityStateZip: `${client.city || ""}, ${client.state || ""} ${client.zipCode || ""}`,
        clientSSNLast4: client.ssnLast4 || "XXXX",
        clientDOB: client.dateOfBirth
          ? format(new Date(client.dateOfBirth), "MM/dd/yyyy")
          : "XX/XX/XXXX",
        cra: cra as SentryCRA,
        flow: flow as SentryFlowType,
        round: round as 1 | 2 | 3 | 4,
        accounts: accounts.map((acc) => ({
          id: acc.id,
          creditorName: acc.creditorName,
          maskedAccountId: acc.maskedAccountId || undefined,
          cra: acc.cra as SentryCRA,
          accountType: acc.accountType || undefined,
          balance: acc.balance ? Number(acc.balance) : undefined,
          dateOpened: acc.dateOpened || undefined,
          dofd: undefined, // AccountItem doesn't have this field yet
          accountStatus: acc.paymentStatus || undefined,
          isCollection: acc.accountType?.toLowerCase().includes("collection"),
          disputeReason:
            dispute.items.find((i) => i.accountItemId === acc.id)
              ?.disputeReason || undefined,
        })),
        eoscarCodeOverride,
        customLanguage,
      };

      // Generate the letter with Sentry intelligence
      generationResult = generateSentryLetter(generationContext);

      // Update dispute with generated content
      await prisma.sentryDispute.update({
        where: { id: dispute.id },
        data: {
          letterContent: generationResult.letterContent,
          letterContentHash: generateContentHash(generationResult.letterContent),
          eoscarCodes: JSON.stringify(
            generationResult.eoscarRecommendations.map((r) => r.code.code)
          ),
          metro2Fields: JSON.stringify(
            generationResult.metro2Disputes.map((d) => d.field.code)
          ),
          ocrRiskScore: generationResult.ocrAnalysis.score,
          successProbability: generationResult.successPrediction.probability,
        },
      });

      // Create analysis record
      await prisma.sentryAnalysis.create({
        data: {
          sentryDisputeId: dispute.id,
          recommendedCodes: JSON.stringify(generationResult.eoscarRecommendations),
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

      // Update items with e-OSCAR codes (use the selected code for all items)
      const primaryCode = generationResult.selectedEOSCARCode;
      for (const item of dispute.items) {
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
    }

    // Log the event
    await prisma.eventLog.create({
      data: {
        eventType: "SENTRY_DISPUTE_CREATED",
        actorId: ctx.userId,
        actorEmail: ctx.session.user.email,
        targetType: "SentryDispute",
        targetId: dispute.id,
        eventData: JSON.stringify({
          cra,
          flow,
          round,
          accountCount: accounts.length,
          sentryGenerated: generateLetter,
          ocrScore: generationResult?.ocrAnalysis.score,
          successProbability: generationResult?.successPrediction.probability,
        }),
        organizationId: ctx.organizationId,
      },
    });

    // Fetch the complete dispute
    const completeDispute = await prisma.sentryDispute.findUnique({
      where: { id: dispute.id },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        items: {
          include: {
            accountItem: {
              select: {
                id: true,
                creditorName: true,
                maskedAccountId: true,
                balance: true,
                accountType: true,
              },
            },
          },
        },
        analysis: true,
      },
    });

    return NextResponse.json({
      success: true,
      dispute: {
        ...completeDispute,
        successProbability: completeDispute?.successProbability
          ? Number(completeDispute.successProbability)
          : null,
        items: completeDispute?.items.map((item) => ({
          ...item,
          accountItem: {
            ...item.accountItem,
            balance: item.accountItem.balance
              ? Number(item.accountItem.balance)
              : null,
          },
        })),
      },
      sentry: generationResult
        ? {
            templateUsed: generationResult.templateName,
            selectedEOSCARCode: generationResult.selectedEOSCARCode,
            ocrScore: generationResult.ocrAnalysis.score,
            ocrRisk: generationResult.ocrAnalysis.risk,
            ocrAutoFixApplied: generationResult.ocrAutoFixApplied,
            citationValidation: {
              isValid: generationResult.citationValidation.isValid,
              validCount: generationResult.citationValidation.validCitations.length,
              invalidCount: generationResult.citationValidation.invalidCitations.length,
            },
            successPrediction: {
              probability: generationResult.successPrediction.probability,
              confidence: generationResult.successPrediction.confidence,
              recommendations: generationResult.successPrediction.recommendations,
            },
            metro2Fields: generationResult.metro2Disputes.length,
            discrepancies: generationResult.discrepancies.length,
            warnings: generationResult.warnings,
          }
        : null,
      system: "SENTRY",
    });
  } catch (error) {
    console.error("Error creating Sentry dispute:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create Sentry dispute",
        code: "CREATE_ERROR",
      },
      { status: 500 }
    );
  }
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function generateContentHash(content: string): string {
  // Simple hash for content uniqueness tracking
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `sentry_${Math.abs(hash).toString(16)}`;
}
