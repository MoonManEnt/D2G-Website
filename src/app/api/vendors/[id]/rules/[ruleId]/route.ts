/**
 * VENDOR RULE API - Single Rule Routes
 *
 * GET /api/vendors/[id]/rules/[ruleId] - Get a single rule
 * PATCH /api/vendors/[id]/rules/[ruleId] - Update a rule (ADMIN only)
 * DELETE /api/vendors/[id]/rules/[ruleId] - Delete a rule (ADMIN only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { updateVendorRuleSchema } from "@/lib/api-validation-schemas";
import { createLogger } from "@/lib/logger";
const log = createLogger("vendor-rule-detail-api");

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string; ruleId: string }>;
}

// =============================================================================
// GET /api/vendors/[id]/rules/[ruleId] - Get a single rule
// =============================================================================

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: vendorId, ruleId } = await params;

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

    const rule = await prisma.vendorRule.findFirst({
      where: {
        id: ruleId,
        vendorId,
      },
    });

    if (!rule) {
      return NextResponse.json(
        { error: "Rule not found" },
        { status: 404 }
      );
    }

    // Parse conditions JSON
    let conditions;
    try {
      conditions = JSON.parse(rule.conditions);
    } catch {
      conditions = [];
    }

    return NextResponse.json({
      success: true,
      rule: {
        ...rule,
        conditions,
      },
    });
  } catch (error) {
    log.error({ err: error }, "Error fetching vendor rule");
    return NextResponse.json(
      { error: "Failed to fetch vendor rule", code: "FETCH_ERROR" },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH /api/vendors/[id]/rules/[ruleId] - Update a rule (ADMIN only)
// =============================================================================

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: vendorId, ruleId } = await params;

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
    const parsed = updateVendorRuleSchema.safeParse(body);
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

    // Verify rule exists and belongs to vendor
    const existingRule = await prisma.vendorRule.findFirst({
      where: {
        id: ruleId,
        vendorId,
      },
    });

    if (!existingRule) {
      return NextResponse.json(
        { error: "Rule not found" },
        { status: 404 }
      );
    }

    // Build update data - serialize conditions to JSON if provided
    const updateData: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.conditions) {
      updateData.conditions = JSON.stringify(parsed.data.conditions);
    }

    const updatedRule = await prisma.vendorRule.update({
      where: { id: ruleId },
      data: updateData,
    });

    // Log the update
    await prisma.eventLog.create({
      data: {
        eventType: "VENDOR_RULE_UPDATED",
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetType: "VendorRule",
        targetId: ruleId,
        eventData: JSON.stringify({
          vendorId,
          vendorName: vendor.name,
          updatedFields: Object.keys(parsed.data),
        }),
        organizationId: session.user.organizationId,
      },
    });

    // Parse conditions for response
    let conditions;
    try {
      conditions = JSON.parse(updatedRule.conditions);
    } catch {
      conditions = [];
    }

    return NextResponse.json({
      success: true,
      rule: {
        ...updatedRule,
        conditions,
      },
    });
  } catch (error) {
    log.error({ err: error }, "Error updating vendor rule");
    return NextResponse.json(
      { error: "Failed to update vendor rule", code: "UPDATE_ERROR" },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/vendors/[id]/rules/[ruleId] - Delete a rule (ADMIN only)
// =============================================================================

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id: vendorId, ruleId } = await params;

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

    // Verify rule exists and belongs to vendor
    const existingRule = await prisma.vendorRule.findFirst({
      where: {
        id: ruleId,
        vendorId,
      },
    });

    if (!existingRule) {
      return NextResponse.json(
        { error: "Rule not found" },
        { status: 404 }
      );
    }

    await prisma.vendorRule.delete({
      where: { id: ruleId },
    });

    // Log the deletion
    await prisma.eventLog.create({
      data: {
        eventType: "VENDOR_RULE_DELETED",
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetType: "VendorRule",
        targetId: ruleId,
        eventData: JSON.stringify({
          vendorId,
          vendorName: vendor.name,
          ruleName: existingRule.name,
        }),
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Vendor rule deleted",
    });
  } catch (error) {
    log.error({ err: error }, "Error deleting vendor rule");
    return NextResponse.json(
      { error: "Failed to delete vendor rule", code: "DELETE_ERROR" },
      { status: 500 }
    );
  }
}
