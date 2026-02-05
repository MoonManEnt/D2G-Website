/**
 * VENDOR API - Single Vendor Routes
 *
 * GET /api/vendors/[id] - Get a single vendor
 * PATCH /api/vendors/[id] - Update a vendor (ADMIN only)
 * DELETE /api/vendors/[id] - Delete a vendor (ADMIN only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { updateVendorSchema } from "@/lib/api-validation-schemas";
import { createLogger } from "@/lib/logger";
const log = createLogger("vendor-detail-api");

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// =============================================================================
// GET /api/vendors/[id] - Get a single vendor with rules
// =============================================================================

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const vendor = await prisma.vendor.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        rules: {
          orderBy: { priority: "desc" },
        },
        _count: {
          select: { referrals: true },
        },
      },
    });

    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, vendor });
  } catch (error) {
    log.error({ err: error }, "Error fetching vendor");
    return NextResponse.json(
      { error: "Failed to fetch vendor", code: "FETCH_ERROR" },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH /api/vendors/[id] - Update a vendor (ADMIN only)
// =============================================================================

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

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
    const parsed = updateVendorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Verify vendor exists and belongs to organization
    const existingVendor = await prisma.vendor.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingVendor) {
      return NextResponse.json(
        { error: "Vendor not found" },
        { status: 404 }
      );
    }

    const updatedVendor = await prisma.vendor.update({
      where: { id },
      data: parsed.data,
      include: {
        rules: {
          orderBy: { priority: "desc" },
        },
        _count: {
          select: { referrals: true },
        },
      },
    });

    // Log the update
    await prisma.eventLog.create({
      data: {
        eventType: "VENDOR_UPDATED",
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetType: "Vendor",
        targetId: id,
        eventData: JSON.stringify({
          updatedFields: Object.keys(parsed.data),
        }),
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json({ success: true, vendor: updatedVendor });
  } catch (error) {
    log.error({ err: error }, "Error updating vendor");
    return NextResponse.json(
      { error: "Failed to update vendor", code: "UPDATE_ERROR" },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/vendors/[id] - Delete a vendor (ADMIN only)
// =============================================================================

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

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

    // Verify vendor exists and belongs to organization
    const existingVendor = await prisma.vendor.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingVendor) {
      return NextResponse.json(
        { error: "Vendor not found" },
        { status: 404 }
      );
    }

    // Delete vendor (cascades to rules and referrals)
    await prisma.vendor.delete({
      where: { id },
    });

    // Log the deletion
    await prisma.eventLog.create({
      data: {
        eventType: "VENDOR_DELETED",
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetType: "Vendor",
        targetId: id,
        eventData: JSON.stringify({
          name: existingVendor.name,
          category: existingVendor.category,
        }),
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Vendor deleted",
    });
  } catch (error) {
    log.error({ err: error }, "Error deleting vendor");
    return NextResponse.json(
      { error: "Failed to delete vendor", code: "DELETE_ERROR" },
      { status: 500 }
    );
  }
}
