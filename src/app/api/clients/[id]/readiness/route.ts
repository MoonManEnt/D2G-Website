/**
 * CREDIT READINESS API
 *
 * GET  /api/clients/[id]/readiness - Fetch all readiness analyses for a client
 * POST /api/clients/[id]/readiness - Run a new credit readiness analysis
 *
 * Uses the Amelia Credit Readiness Engine to evaluate a client's credit
 * profile against product-specific FICO models and generate approval
 * likelihood, score gap analysis, DTI calculations, and action plans.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { creditReadinessSchema } from "@/lib/api-validation-schemas";
import { analyzeApprovalLikelihood } from "@/lib/credit-readiness";
import type { CreditDataInput, ProductType } from "@/lib/credit-readiness/types";

export const dynamic = "force-dynamic";

// =============================================================================
// HELPERS
// =============================================================================

function parseJSON<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// =============================================================================
// GET /api/clients/[id]/readiness
// Fetch all readiness analyses for the client, ordered by createdAt desc
// =============================================================================

export const GET = withAuth(async (req, ctx) => {
  try {
    const clientId = ctx.params.id;

    // Verify client belongs to organization
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: ctx.organizationId,
        isActive: true,
        archivedAt: null,
      },
      select: { id: true },
    });

    if (!client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    // Fetch all readiness analyses for this client
    const analyses = await prisma.creditReadinessAnalysis.findMany({
      where: {
        clientId,
        organizationId: ctx.organizationId,
      },
      orderBy: { createdAt: "desc" },
    });

    // Parse JSON fields before returning
    const parsed = analyses.map((analysis) => ({
      ...analysis,
      actionPlan: parseJSON(analysis.actionPlan, []),
      findings: parseJSON(analysis.findings, []),
      recommendations: parseJSON(analysis.recommendations, []),
      scoreGapAnalysis: parseJSON(analysis.scoreGapAnalysis, {}),
      vendorRecommendations: parseJSON(analysis.vendorRecommendations, []),
    }));

    return NextResponse.json({
      success: true,
      analyses: parsed,
      count: parsed.length,
    });
  } catch (error) {
    console.error("Error fetching readiness analyses:", error);
    return NextResponse.json(
      { error: "Failed to fetch readiness analyses", code: "FETCH_ERROR" },
      { status: 500 }
    );
  }
});

// =============================================================================
// POST /api/clients/[id]/readiness
// Run a new credit readiness analysis
// =============================================================================

export const POST = withAuth(
  async (req, ctx) => {
    const startTime = Date.now();
    try {
      const clientId = ctx.params.id;
      const { productType, statedIncome, incomeType, reasonForApplying } = ctx.body;

      // ---------------------------------------------------------------
      // 1. Fetch client with all related data
      // ---------------------------------------------------------------
      const client = await prisma.client.findFirst({
        where: {
          id: clientId,
          organizationId: ctx.organizationId,
          isActive: true,
          archivedAt: null,
        },
        include: {
          creditScores: {
            orderBy: { scoreDate: "desc" },
            take: 10,
          },
          accounts: {
            select: {
              id: true,
              creditorName: true,
              accountType: true,
              accountStatus: true,
              balance: true,
              creditLimit: true,
              monthlyPayment: true,
              dateOpened: true,
              isDisputable: true,
              issueCount: true,
            },
          },
        },
      });

      if (!client) {
        return NextResponse.json(
          { error: "Client not found" },
          { status: 404 }
        );
      }

      // ---------------------------------------------------------------
      // 2. Fetch Credit DNA (separate query, no explicit relation)
      // ---------------------------------------------------------------
      const creditDNA = await prisma.creditDNA.findFirst({
        where: {
          clientId,
          organizationId: ctx.organizationId,
        },
        orderBy: { createdAt: "desc" },
      });

      // ---------------------------------------------------------------
      // 3. Determine effective income
      // ---------------------------------------------------------------
      const effectiveIncome = statedIncome || client.statedIncome || undefined;

      // ---------------------------------------------------------------
      // 4. Count hard inquiries from latest report
      // ---------------------------------------------------------------
      let inquiryCount = 0;
      try {
        const latestReport = await prisma.creditReport.findFirst({
          where: {
            clientId,
            organizationId: ctx.organizationId,
            parseStatus: "COMPLETED",
          },
          orderBy: { reportDate: "desc" },
          select: { hardInquiries: true },
        });
        if (latestReport?.hardInquiries) {
          const inquiries = parseJSON<Array<unknown>>(latestReport.hardInquiries, []);
          inquiryCount = inquiries.length;
        }
      } catch {
        // Inquiry count is optional; continue without it
      }

      // ---------------------------------------------------------------
      // 5. Build CreditDataInput
      // ---------------------------------------------------------------
      const creditData: CreditDataInput = {
        creditScores: client.creditScores.map((s) => ({
          cra: s.cra,
          score: s.score,
          scoreType: s.scoreType,
        })),
        accounts: client.accounts.map((a) => ({
          creditorName: a.creditorName,
          accountType: a.accountType,
          accountStatus: a.accountStatus,
          balance: a.balance,
          creditLimit: a.creditLimit,
          monthlyPayment: a.monthlyPayment,
          dateOpened: a.dateOpened,
          isDisputable: a.isDisputable,
          issueCount: a.issueCount,
        })),
        statedIncome: effectiveIncome ?? undefined,
        inquiryCount,
        dnaProfile: creditDNA
          ? {
              classification: creditDNA.classification,
              healthScore: creditDNA.healthScore,
              improvementPotential: creditDNA.improvementPotential,
              utilization: creditDNA.utilization,
              derogatoryProfile: creditDNA.derogatoryProfile,
            }
          : undefined,
      };

      // ---------------------------------------------------------------
      // 6. Run the analysis
      // ---------------------------------------------------------------
      const result = analyzeApprovalLikelihood(
        productType as ProductType,
        creditData
      );

      // ---------------------------------------------------------------
      // 7. Optionally evaluate vendor rules (if module exists)
      // ---------------------------------------------------------------
      let vendorRecommendations: Array<{
        vendorId: string;
        vendorName: string;
        ruleId: string;
        ruleName: string;
        title: string;
        body: string;
        cta: string | null;
        affiliateUrl: string | null;
      }> = [];

      try {
        // Fetch active vendor rules for the organization
        const vendors = await prisma.vendor.findMany({
          where: {
            organizationId: ctx.organizationId,
            isActive: true,
          },
          include: {
            rules: {
              where: { isActive: true },
              orderBy: { priority: "desc" },
            },
          },
        });

        // Evaluate rules against the analysis result
        for (const vendor of vendors) {
          for (const rule of vendor.rules) {
            const conditions = parseJSON<Array<{ field: string; operator: string; value: unknown }>>(
              rule.conditions,
              []
            );
            const matches = evaluateVendorConditions(conditions, result, creditData);
            if (matches) {
              vendorRecommendations.push({
                vendorId: vendor.id,
                vendorName: vendor.name,
                ruleId: rule.id,
                ruleName: rule.name,
                title: rule.recommendationTitle,
                body: rule.recommendationBody,
                cta: rule.recommendationCTA,
                affiliateUrl: rule.customAffiliateUrl || vendor.affiliateUrl,
              });
            }
          }
        }
      } catch (vendorError) {
        // Vendor rules evaluation is optional; don't break the analysis
        console.warn("Vendor rules evaluation skipped:", vendorError);
      }

      // ---------------------------------------------------------------
      // 8. Save the analysis to the database
      // ---------------------------------------------------------------
      const computeTimeMs = Date.now() - startTime;

      const savedAnalysis = await prisma.creditReadinessAnalysis.create({
        data: {
          clientId,
          organizationId: ctx.organizationId,
          productType: productType as string,
          statedIncome: effectiveIncome ?? null,
          reasonForApplying: reasonForApplying || null,
          relevantScoreModel: result.relevantScoreModel,
          relevantScore: result.relevantScore,
          triMergeMiddle: result.triMergeMiddle,
          approvalLikelihood: result.approvalLikelihood,
          approvalTier: result.approvalTier,
          approvalExplanation: result.explanation,
          estimatedDTI: result.dti?.estimatedDTI ?? null,
          maxRecommendedDTI: result.dti?.maxRecommendedDTI ?? null,
          actionPlan: JSON.stringify(result.actionPlan),
          findings: JSON.stringify(result.findings),
          recommendations: JSON.stringify({
            scoreGapFactors: result.scoreGap.factors,
            estimatedTimeToTarget: result.scoreGap.estimatedTimeToTarget,
            dtiDetails: result.dti?.details ?? null,
            cfpbTier: result.cfpbTier,
            confidenceLevel: result.confidenceLevel,
            readinessFactors: result.readinessFactors,
            hardDisqualifications: result.hardDisqualifications,
            ltv: result.ltv,
          }),
          scoreGapAnalysis: JSON.stringify(result.scoreGap),
          vendorRecommendations: JSON.stringify(vendorRecommendations),
          computeTimeMs,
          version: "2.0.0",
        },
      });

      // ---------------------------------------------------------------
      // 9. Update client income if provided
      // ---------------------------------------------------------------
      if (statedIncome && statedIncome > 0) {
        await prisma.client.update({
          where: { id: clientId },
          data: {
            statedIncome,
            statedIncomeType: incomeType || null,
            incomeUpdatedAt: new Date(),
          },
        });
      }

      // ---------------------------------------------------------------
      // 10. Log the event
      // ---------------------------------------------------------------
      await prisma.eventLog.create({
        data: {
          eventType: "CREDIT_READINESS_ANALYSIS",
          actorId: ctx.userId,
          actorEmail: ctx.session.user.email,
          targetType: "CreditReadinessAnalysis",
          targetId: savedAnalysis.id,
          eventData: JSON.stringify({
            clientId,
            clientName: `${client.firstName} ${client.lastName}`,
            productType,
            approvalLikelihood: result.approvalLikelihood,
            approvalTier: result.approvalTier,
            relevantScore: result.relevantScore,
            computeTimeMs,
          }),
          organizationId: ctx.organizationId,
        },
      });

      // ---------------------------------------------------------------
      // 11. Return the full analysis
      // ---------------------------------------------------------------
      return NextResponse.json(
        {
          success: true,
          analysis: {
            id: savedAnalysis.id,
            ...result,
            vendorRecommendations,
            computeTimeMs,
          },
        },
        { status: 201 }
      );
    } catch (error) {
      console.error("Error running readiness analysis:", error);
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Failed to run readiness analysis",
          code: "ANALYSIS_ERROR",
        },
        { status: 500 }
      );
    }
  },
  {
    schema: creditReadinessSchema,
  }
);

// =============================================================================
// VENDOR RULE EVALUATION (lightweight inline evaluator)
// =============================================================================

/**
 * Evaluate vendor rule conditions against the analysis result.
 * Returns true if ALL conditions match (AND logic).
 */
function evaluateVendorConditions(
  conditions: Array<{ field: string; operator: string; value: unknown; valueEnd?: number }>,
  result: ReturnType<typeof analyzeApprovalLikelihood>,
  creditData: CreditDataInput
): boolean {
  if (!conditions || conditions.length === 0) return false;

  for (const condition of conditions) {
    if (!evaluateSingleCondition(condition, result, creditData)) {
      return false;
    }
  }
  return true;
}

function evaluateSingleCondition(
  condition: { field: string; operator: string; value: unknown; valueEnd?: number },
  result: ReturnType<typeof analyzeApprovalLikelihood>,
  creditData: CreditDataInput
): boolean {
  const { field, operator, value } = condition;

  // Get the actual value to compare
  let actual: unknown;
  switch (field) {
    case "credit_score_avg": {
      const validScores = creditData.creditScores.map(s => s.score).filter(Boolean);
      actual = validScores.length > 0
        ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
        : 0;
      break;
    }
    case "credit_score_min":
      actual = creditData.creditScores.length > 0
        ? Math.min(...creditData.creditScores.map(s => s.score))
        : 0;
      break;
    case "credit_score_max":
      actual = creditData.creditScores.length > 0
        ? Math.max(...creditData.creditScores.map(s => s.score))
        : 0;
      break;
    case "has_collections":
      actual = creditData.accounts.some(a => {
        const type = (a.accountType || "").toLowerCase();
        const status = a.accountStatus.toLowerCase();
        return type.includes("collection") || status.includes("collection");
      });
      break;
    case "collection_count_min":
      actual = creditData.accounts.filter(a => {
        const type = (a.accountType || "").toLowerCase();
        const status = a.accountStatus.toLowerCase();
        return type.includes("collection") || status.includes("collection");
      }).length;
      break;
    case "has_charge_offs":
      actual = creditData.accounts.some(a => {
        const status = a.accountStatus.toLowerCase();
        return status.includes("charge") || status === "charged_off";
      });
      break;
    case "account_count_min":
    case "account_count_max":
      actual = creditData.accounts.length;
      break;
    case "has_income":
      actual = (creditData.statedIncome ?? 0) > 0;
      break;
    case "income_min":
    case "income_max":
      actual = creditData.statedIncome ?? 0;
      break;
    case "readiness_product_type":
      actual = result.productType;
      break;
    case "approval_likelihood_max":
      actual = result.approvalLikelihood;
      break;
    case "inquiry_count_min":
      actual = creditData.inquiryCount ?? 0;
      break;
    case "dna_classification":
      actual = creditData.dnaProfile?.classification ?? "";
      break;
    case "health_score_min":
    case "health_score_max":
      actual = creditData.dnaProfile?.healthScore ?? 0;
      break;
    case "improvement_potential_min":
      actual = creditData.dnaProfile?.improvementPotential ?? 0;
      break;
    default:
      return false; // Unknown field, skip
  }

  // Compare using the operator
  const numValue = typeof value === "number" ? value : Number(value);
  const numActual = typeof actual === "number" ? actual : Number(actual);

  switch (operator) {
    case "equals":
      return actual === value || String(actual) === String(value);
    case "not_equals":
      return actual !== value && String(actual) !== String(value);
    case "greater_than":
      return numActual > numValue;
    case "less_than":
      return numActual < numValue;
    case "in":
      if (Array.isArray(value)) {
        return value.includes(String(actual));
      }
      return String(value).split(",").map(s => s.trim()).includes(String(actual));
    case "not_in":
      if (Array.isArray(value)) {
        return !value.includes(String(actual));
      }
      return !String(value).split(",").map(s => s.trim()).includes(String(actual));
    case "between":
      return numActual >= numValue && numActual <= (condition.valueEnd ?? numValue);
    default:
      return false;
  }
}
