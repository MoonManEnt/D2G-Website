/**
 * SENTRY API - Legal Citation Validation
 *
 * POST /api/sentry/validate-citations - Validate legal citations in text
 * GET /api/sentry/validate-citations - Get citation database
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import {
  validateCitations,
  getLegalCitationDatabase,
  getInvalidCitationDatabase,
  getCaseLawDatabase,
  getRecommendedCitations,
  suggestCitationFix,
} from "@/lib/sentry/legal-validator";
import type { CitationApplicability } from "@/types/sentry";
import { sentryValidateCitationsSchema } from "@/lib/api-validation-schemas";

// =============================================================================
// POST /api/sentry/validate-citations - Validate citations in text
// =============================================================================

export const POST = withAuth(async (req, ctx) => {
  try {
    const body = await req.json();
    const parsed = sentryValidateCitationsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { text, targetType, useCase } = parsed.data;

    // Validate citations
    const validationResult = validateCitations(text, targetType);

    // Get recommended citations for the use case
    const recommended = useCase
      ? getRecommendedCitations(useCase, targetType)
      : getRecommendedCitations("accuracy", targetType);

    // Generate fix suggestions for invalid citations
    const fixes = validationResult.invalidCitations.map((invalid) => ({
      original: invalid.statute,
      reason: invalid.reason,
      suggestion: invalid.suggestion,
      fix: suggestCitationFix(invalid.statute, targetType),
    }));

    // Calculate citation score
    const totalCitations =
      validationResult.validCitations.length +
      validationResult.invalidCitations.length;
    const citationScore =
      totalCitations > 0
        ? Math.round(
            (validationResult.validCitations.length / totalCitations) * 100
          )
        : 100;

    return NextResponse.json({
      success: true,
      validation: {
        isValid: validationResult.isValid,
        score: citationScore,
        summary: validationResult.isValid
          ? "All citations are valid for this recipient type"
          : `${validationResult.invalidCitations.length} problematic citation(s) found`,

        // Valid citations found
        validCitations: validationResult.validCitations.map((c) => ({
          statute: c.statute,
          name: c.name,
          description: c.shortDescription,
          applicableTo: c.applicableTo,
          useFor: c.useFor.slice(0, 5),
          caseSupport: c.caseSupport?.slice(0, 2).map((cs) => ({
            name: cs.name,
            citation: cs.citation,
          })),
        })),

        // Invalid citations found
        invalidCitations: validationResult.invalidCitations.map((c) => ({
          statute: c.statute,
          location: c.location,
          reason: c.reason,
          suggestion: c.suggestion,
        })),

        // Warnings
        warnings: validationResult.warnings,

        // Fix suggestions
        fixes,
      },

      // Recommended citations
      recommended: recommended.slice(0, 8).map((c) => ({
        statute: c.statute,
        name: c.name,
        description: c.shortDescription,
        useFor: c.useFor.slice(0, 3),
        example: c.exampleLanguage,
      })),

      // Educational content
      tips: [
        "FDCPA (15 USC 1692) only applies to debt collectors, NOT credit bureaus",
        "Criminal statutes (15 USC 1681q/r) cannot be cited by consumers",
        "15 USC 1681a(d)(2) 'excluded information' is a common misapplication",
        "Always cite 15 USC 1681i for reinvestigation requests to CRAs",
        "For willful violations, cite 15 USC 1681n; for negligent, cite 15 USC 1681o",
      ],

      system: "SENTRY",
    });
  } catch (error) {
    console.error("Error validating citations:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to validate citations",
        code: "VALIDATE_ERROR",
      },
      { status: 500 }
    );
  }
});

// =============================================================================
// GET /api/sentry/validate-citations - Get citation database
// =============================================================================

export const GET = withAuth(async (req, ctx) => {
  try {
    const { searchParams } = new URL(req.url);
    const targetType = searchParams.get("targetType") as CitationApplicability | null;
    const includeInvalid = searchParams.get("includeInvalid") === "true";
    const includeCaseLaw = searchParams.get("includeCaseLaw") === "true";

    const validCitations = getLegalCitationDatabase();
    const invalidCitations = includeInvalid ? getInvalidCitationDatabase() : [];
    const caseLaw = includeCaseLaw ? getCaseLawDatabase() : [];

    // Filter by target type if specified
    const filteredValid = targetType
      ? validCitations.filter((c) => c.applicableTo.includes(targetType))
      : validCitations;

    return NextResponse.json({
      success: true,
      database: {
        validCitations: filteredValid.map((c) => ({
          statute: c.statute,
          name: c.name,
          shortDescription: c.shortDescription,
          fullText: c.fullText,
          applicableTo: c.applicableTo,
          useFor: c.useFor,
          neverUseFor: c.neverUseFor,
          commonMisuse: c.commonMisuse,
          exampleLanguage: c.exampleLanguage,
          caseSupport: c.caseSupport?.map((cs) => cs.name),
        })),

        ...(includeInvalid
          ? {
              invalidCitations: invalidCitations.map((c) => ({
                statute: c.statute,
                name: c.name,
                whyItFails: c.whyItFails,
                correctApproach: c.correctApproach,
                frequentlyUsedBy: c.frequentlyUsedBy,
              })),
            }
          : {}),

        ...(includeCaseLaw
          ? {
              caseLaw: caseLaw.map((c) => ({
                name: c.name,
                citation: c.citation,
                holding: c.holding,
                relevance: c.relevance,
              })),
            }
          : {}),
      },
      counts: {
        validCitations: filteredValid.length,
        totalValidCitations: validCitations.length,
        invalidCitations: invalidCitations.length,
        caseLaw: caseLaw.length,
      },
      filteredBy: targetType || "all",
      system: "SENTRY",
    });
  } catch (error) {
    console.error("Error fetching citation database:", error);
    return NextResponse.json(
      { error: "Failed to fetch citation database", code: "FETCH_ERROR" },
      { status: 500 }
    );
  }
});
