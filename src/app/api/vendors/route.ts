/**
 * VENDOR API - Main Routes
 *
 * GET /api/vendors - List all vendors for the organization
 * POST /api/vendors - Create a new vendor (ADMIN only)
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { createVendorSchema } from "@/lib/api-validation-schemas";

export const dynamic = "force-dynamic";

// =============================================================================
// GET /api/vendors - List all vendors for the organization
// =============================================================================

export const GET = withAuth(async (req, ctx) => {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const isActive = searchParams.get("isActive");

    const vendors = await prisma.vendor.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(category && { category }),
        ...(isActive !== null && isActive !== undefined && isActive !== ""
          ? { isActive: isActive === "true" }
          : {}),
      },
      include: {
        rules: {
          orderBy: { priority: "desc" },
        },
        _count: {
          select: {
            referrals: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      vendors,
    });
  } catch (error) {
    console.error("Error fetching vendors:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendors", code: "FETCH_ERROR" },
      { status: 500 }
    );
  }
});

// =============================================================================
// POST /api/vendors - Create a new vendor (ADMIN only)
// =============================================================================

export const POST = withAuth(
  async (req, ctx) => {
    try {
      const vendor = await prisma.vendor.create({
        data: {
          organizationId: ctx.organizationId,
          name: ctx.body.name,
          description: ctx.body.description || null,
          category: ctx.body.category,
          logoUrl: ctx.body.logoUrl || null,
          websiteUrl: ctx.body.websiteUrl || null,
          affiliateUrl: ctx.body.affiliateUrl || null,
          affiliateCode: ctx.body.affiliateCode || null,
          contactName: ctx.body.contactName || null,
          contactEmail: ctx.body.contactEmail || null,
          isActive: ctx.body.isActive ?? true,
          commissionType: ctx.body.commissionType || null,
          commissionValue: ctx.body.commissionValue ?? null,
        },
        include: {
          rules: true,
          _count: {
            select: { referrals: true },
          },
        },
      });

      // Log the event
      await prisma.eventLog.create({
        data: {
          eventType: "VENDOR_CREATED",
          actorId: ctx.userId,
          actorEmail: ctx.session.user.email,
          targetType: "Vendor",
          targetId: vendor.id,
          eventData: JSON.stringify({
            name: vendor.name,
            category: vendor.category,
          }),
          organizationId: ctx.organizationId,
        },
      });

      return NextResponse.json({ success: true, vendor }, { status: 201 });
    } catch (error) {
      console.error("Error creating vendor:", error);
      return NextResponse.json(
        { error: "Failed to create vendor", code: "CREATE_ERROR" },
        { status: 500 }
      );
    }
  },
  {
    schema: createVendorSchema,
    roles: ["ADMIN", "OWNER"],
  }
);
