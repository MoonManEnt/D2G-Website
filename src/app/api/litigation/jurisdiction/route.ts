/**
 * JURISDICTION LOOKUP API
 *
 * GET /api/litigation/jurisdiction?state=XX&zipCode=12345
 */

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { SubscriptionTier } from "@/types";
import { resolveJurisdiction } from "@/lib/litigation-engine/jurisdiction-resolver";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, ctx) => {
  try {
    const url = new URL(req.url);
    const state = url.searchParams.get("state");
    const zipCode = url.searchParams.get("zipCode") || undefined;
    const county = url.searchParams.get("county") || undefined;
    const estimatedDamages = url.searchParams.get("estimatedDamages");

    if (!state) {
      return NextResponse.json(
        { error: "state parameter is required" },
        { status: 400 },
      );
    }

    const jurisdiction = resolveJurisdiction(
      state.toUpperCase(),
      zipCode,
      county,
      estimatedDamages ? parseInt(estimatedDamages, 10) : undefined,
    );

    return NextResponse.json({ success: true, jurisdiction });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to resolve jurisdiction" },
      { status: 500 },
    );
  }
}, { minTier: SubscriptionTier.PROFESSIONAL });
