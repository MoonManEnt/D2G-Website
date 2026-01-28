/**
 * Unified Dispute Creation API
 *
 * POST /api/disputes/unified - Create disputes using any of the three strategies
 *
 * This endpoint consolidates three dispute creation flows:
 * - simple: Template-based dispute creation (docx-generator)
 * - ai: AI-powered strategy and letter generation (ai-rules-engine + AMELIA)
 * - amelia: Full AMELIA doctrine with backdating, personal info disputes, etc.
 *
 * Key improvements over original APIs:
 * 1. Single source of truth: Letter content stored in Document, not Dispute.letterContent
 * 2. Consistent aiStrategy field populated for all paths
 * 3. Unified request/response format
 * 4. Shared validation and error handling
 *
 * Request body:
 * {
 *   type: "simple" | "ai" | "amelia",
 *   clientId: string,
 *   accountIds: string[],
 *   cra?: "TRANSUNION" | "EXPERIAN" | "EQUIFAX", // Required for simple/amelia
 *   flow?: "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO", // Required for simple
 *   options?: { // AI-specific options
 *     useAI?: boolean,
 *     maxAccountsPerBatch?: number,
 *     focusBureaus?: CRA[],
 *     previewOnly?: boolean
 *   }
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   type: "simple" | "ai" | "amelia",
 *   disputes: Array<{
 *     disputeId: string,
 *     cra: string,
 *     flow: string,
 *     round: number,
 *     itemCount: number,
 *     documentId: string,
 *     status: string
 *   }>,
 *   strategy?: { ... }, // AI strategy details
 *   metadata?: { ... }, // AMELIA metadata
 *   warnings?: string[],
 *   message?: string
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { captureError } from "@/lib/errors";
import {
  validateFullRequest,
  createUnifiedDispute,
  UnifiedDisputeRequest,
  DisputeCreationError,
} from "@/lib/dispute-creation";

export const dynamic = "force-dynamic";

/**
 * POST /api/disputes/unified - Create disputes using unified flow
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // Parse request body
    let body: Partial<UnifiedDisputeRequest>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" } as DisputeCreationError,
        { status: 400 }
      );
    }

    // Validate the full request (session, params, client, accounts)
    const validation = await validateFullRequest(session, body);

    if (!validation.valid) {
      return NextResponse.json(
        {
          error: validation.error,
          code: validation.code,
        } as DisputeCreationError,
        { status: validation.status }
      );
    }

    // Create the dispute(s) using the unified creation function
    const result = await createUnifiedDispute(
      body as UnifiedDisputeRequest,
      validation.context
    );

    return NextResponse.json(result);
  } catch (error) {
    captureError(error as Error, {
      action: "unified_dispute_creation",
    });

    console.error("Error creating unified dispute:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create dispute",
        code: "INTERNAL_ERROR",
      } as DisputeCreationError,
      { status: 500 }
    );
  }
}

/**
 * GET /api/disputes/unified - Get documentation for the unified API
 */
export async function GET() {
  return NextResponse.json({
    name: "Unified Dispute Creation API",
    version: "1.0.0",
    description:
      "Consolidates simple, AI, and AMELIA dispute creation into a single endpoint",
    endpoint: "/api/disputes/unified",
    methods: {
      POST: {
        description: "Create disputes using any of the three strategies",
        requestBody: {
          type: {
            type: "string",
            enum: ["simple", "ai", "amelia"],
            required: true,
            description: "The dispute creation strategy to use",
          },
          clientId: {
            type: "string",
            required: true,
            description: "The client ID to create disputes for",
          },
          accountIds: {
            type: "string[]",
            required: true,
            description: "Array of account IDs to include in disputes",
          },
          cra: {
            type: "string",
            enum: ["TRANSUNION", "EXPERIAN", "EQUIFAX"],
            required: "For simple and amelia types",
            description: "The credit reporting agency",
          },
          flow: {
            type: "string",
            enum: ["ACCURACY", "COLLECTION", "CONSENT", "COMBO"],
            required: "For simple type",
            description: "The dispute flow type",
          },
          options: {
            type: "object",
            required: false,
            description: "AI-specific options (only for ai type)",
            properties: {
              useAI: {
                type: "boolean",
                default: true,
                description: "Whether to use AI for strategy generation",
              },
              maxAccountsPerBatch: {
                type: "number",
                default: 5,
                description: "Maximum accounts per dispute batch",
              },
              focusBureaus: {
                type: "string[]",
                description: "Limit to specific bureaus",
              },
              previewOnly: {
                type: "boolean",
                default: false,
                description: "Return strategy without creating disputes",
              },
            },
          },
        },
        responses: {
          200: {
            description: "Dispute(s) created successfully",
            schema: {
              success: "boolean",
              type: "string",
              disputes: "Array of created dispute info",
              strategy: "AI strategy details (for ai type)",
              metadata: "AMELIA metadata (for amelia type)",
              warnings: "Array of warning messages",
            },
          },
          400: {
            description: "Invalid request parameters",
            schema: {
              error: "string",
              code: "string",
            },
          },
          401: {
            description: "Unauthorized",
          },
          404: {
            description: "Client not found",
          },
          500: {
            description: "Internal server error",
          },
        },
      },
    },
    strategyComparison: {
      simple: {
        description: "Template-based dispute letters using docx-generator",
        pros: ["Fast", "Predictable output", "No AI costs"],
        cons: ["Less personalized", "Fixed templates"],
        bestFor: "Standard disputes with clear issues",
      },
      ai: {
        description:
          "AI-powered strategy analysis and letter generation via ai-rules-engine",
        pros: [
          "Smart prioritization",
          "Cross-bureau coordination",
          "Personalized reasoning",
        ],
        cons: ["Higher latency", "AI costs"],
        bestFor: "Complex cases needing strategic analysis",
      },
      amelia: {
        description: "Full AMELIA doctrine with backdating and personal info disputes",
        pros: [
          "eOSCAR resistant",
          "30-day backdating",
          "Personal info disputes",
          "Unique stories",
        ],
        cons: ["More complex", "Specific to credit repair"],
        bestFor: "Maximum effectiveness with sophisticated tactics",
      },
    },
    migrationGuide: {
      fromSimple: "Change POST /api/disputes to POST /api/disputes/unified with type: 'simple'",
      fromAI: "Change POST /api/disputes/ai to POST /api/disputes/unified with type: 'ai'",
      fromAmelia:
        "AMELIA letter generation on existing disputes: use POST /api/disputes/[id]/amelia. For new disputes with AMELIA: use POST /api/disputes/unified with type: 'amelia'",
    },
  });
}
