/**
 * Account Recommendations API
 * GET /api/clients/[id]/recommendations - Get ranked account recommendations
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { recommendAccounts } from "@/lib/ai/account-recommender";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: clientId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const recommendations = await recommendAccounts(
      clientId,
      session.user.organizationId
    );

    return NextResponse.json({
      clientId,
      recommendations,
      totalAccounts: recommendations.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error generating account recommendations:", error);
    return NextResponse.json(
      { error: "Failed to generate recommendations" },
      { status: 500 }
    );
  }
}
