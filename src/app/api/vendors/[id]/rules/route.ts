/**
 * VENDOR RULES API - List & Create
 *
 * GET /api/vendors/[id]/rules - List rules for a vendor
 * POST /api/vendors/[id]/rules - Create a rule (ADMIN only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createVendorRuleSchema } from "@/lib/api-validation-schemas";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// =============================================================================
// GET /api/vendors/[id]/rules - List rules for a vendor
// =============================================================================

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: vendorId } = await params;

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify vendor belongs to organization
    const vendor = await prisma.vendor.findFirst({
      where: {
        id: vendorId,
        organizationId: session.user.organizationId,
      },
    });

    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor not found" },
        { status: 404 }
      );
    }

    const rules = await prisma.vendorRule.findMany({
      where: { vendorId },
      orderBy: { priority: "desc" },
    });

    // Parse conditions JSON for each rule
    const parsedRules = rules.map((rule) => ({
      ...rule,
      conditions: (() => {
        try {
          return JSON.parse(rule.conditions);
        } catch {
          return [];
        }
      })(),
    }));

    return NextResponse.json({
      success: true,
      rules: parsedRules,
    });
  } catch (error) {
    console.error("Error fetching vendor rules:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendor rules", code: "FETCH_ERROR" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST /api/vendors/[id]/rules - Create a rule (ADMIN only)
// =============================================================================

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: vendorId } = await params;

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role check
    if (!["ADMIN", "OWNER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Forbidden: Insufficient permissions", code: "ROLE_REQUIRED" },
        { status: 403 }
      );
    }

    // Validate body
    const body = await request.json();
    const parsed = createVendorRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Verify vendor belongs to organization
    const vendor = await prisma.vendor.findFirst({
      where: {
        id: vendorId,
        organizationId: session.user.organizationId,
      },
    });

    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor not found" },
        { status: 404 }
      );
    }

    const rule = await prisma.vendorRule.create({
      data: {
        vendorId,
        name: parsed.data.name,
        description: parsed.data.description || null,
        priority: parsed.data.priority ?? 0,
        isActive: parsed.data.isActive ?? true,
        conditions: JSON.stringify(parsed.data.conditions),
        recommendationTitle: parsed.data.recommendationTitle,
        recommendationBody: parsed.data.recommendationBody,
        recommendationCTA: parsed.data.recommendationCTA || null,
        customAffiliateUrl: parsed.data.customAffiliateUrl || null,
      },
    });

    // Log the event
    await prisma.eventLog.create({
      data: {
        eventType: "VENDOR_RULE_CREATED",
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetType: "VendorRule",
        targetId: rule.id,
        eventData: JSON.stringify({
          vendorId,
          vendorName: vendor.name,
          ruleName: rule.name,
          priority: rule.priority,
        }),
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json(
      {
        success: true,
        rule: {
          ...rule,
          conditions: parsed.data.conditions,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating vendor rule:", error);
    return NextResponse.json(
      { error: "Failed to create vendor rule", code: "CREATE_ERROR" },
      { status: 500 }
    );
  }
}
