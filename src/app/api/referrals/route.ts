/**
 * REFERRAL API - Track vendor referrals
 *
 * GET /api/referrals - List referrals for organization
 * POST /api/referrals - Create a referral tracking record
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { trackReferralSchema } from "@/lib/api-validation-schemas";

export const dynamic = "force-dynamic";

// =============================================================================
// GET /api/referrals - List referrals for organization
// =============================================================================

export const GET = withAuth(async (req, ctx) => {
  try {
    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get("vendorId");
    const clientId = searchParams.get("clientId");
    const status = searchParams.get("status");

    const referrals = await prisma.vendorReferral.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(vendorId && { vendorId }),
        ...(clientId && { clientId }),
        ...(status && { status }),
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            category: true,
            logoUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      referrals,
    });
  } catch (error) {
    console.error("Error fetching referrals:", error);
    return NextResponse.json(
      { error: "Failed to fetch referrals", code: "FETCH_ERROR" },
      { status: 500 }
    );
  }
});

// =============================================================================
// POST /api/referrals - Create a referral tracking record
// =============================================================================

export const POST = withAuth(
  async (req, ctx) => {
    try {
      // Verify vendor exists and belongs to organization
      const vendor = await prisma.vendor.findFirst({
        where: {
          id: ctx.body.vendorId,
          organizationId: ctx.organizationId,
        },
      });

      if (!vendor) {
        return NextResponse.json(
          { error: "Vendor not found" },
          { status: 404 }
        );
      }

      // Verify client exists and belongs to organization
      const client = await prisma.client.findFirst({
        where: {
          id: ctx.body.clientId,
          organizationId: ctx.organizationId,
        },
      });

      if (!client) {
        return NextResponse.json(
          { error: "Client not found" },
          { status: 404 }
        );
      }

      const referral = await prisma.vendorReferral.create({
        data: {
          vendorId: ctx.body.vendorId,
          clientId: ctx.body.clientId,
          organizationId: ctx.organizationId,
          triggerType: ctx.body.triggerType,
          triggerEntityId: ctx.body.triggerEntityId || null,
          ruleId: ctx.body.ruleId || null,
          status: "RECOMMENDED",
          affiliateUrl: ctx.body.affiliateUrl || vendor.affiliateUrl || null,
        },
        include: {
          vendor: {
            select: {
              id: true,
              name: true,
              category: true,
            },
          },
        },
      });

      // Log the event
      await prisma.eventLog.create({
        data: {
          eventType: "VENDOR_REFERRAL_CREATED",
          actorId: ctx.userId,
          actorEmail: ctx.session.user.email,
          targetType: "VendorReferral",
          targetId: referral.id,
          eventData: JSON.stringify({
            vendorId: vendor.id,
            vendorName: vendor.name,
            clientId: client.id,
            clientName: `${client.firstName} ${client.lastName}`,
            triggerType: ctx.body.triggerType,
          }),
          organizationId: ctx.organizationId,
        },
      });

      return NextResponse.json(
        { success: true, referral },
        { status: 201 }
      );
    } catch (error) {
      console.error("Error creating referral:", error);
      return NextResponse.json(
        { error: "Failed to create referral", code: "CREATE_ERROR" },
        { status: 500 }
      );
    }
  },
  {
    schema: trackReferralSchema,
  }
);
