import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  createCheckoutSession,
  getOrCreateCustomer,
  getPriceId,
} from "@/lib/stripe";
import { checkoutSchema } from "@/lib/api-validation-schemas";
import { createLogger } from "@/lib/logger";
import {
  FREE_TIER_FLAGS,
  STARTER_TIER_FLAGS,
  PROFESSIONAL_TIER_FLAGS,
  ENTERPRISE_TIER_FLAGS,
  FeatureFlags,
} from "@/types";
const log = createLogger("billing-checkout-api");

// Tier hierarchy (lower index = lower tier)
const TIER_ORDER = ["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"] as const;
type TierType = (typeof TIER_ORDER)[number];

// Get feature flags for a tier
function getTierLimits(tier: TierType): FeatureFlags {
  switch (tier) {
    case "FREE":
      return FREE_TIER_FLAGS;
    case "STARTER":
      return STARTER_TIER_FLAGS;
    case "PROFESSIONAL":
      return PROFESSIONAL_TIER_FLAGS;
    case "ENTERPRISE":
      return ENTERPRISE_TIER_FLAGS;
    default:
      return FREE_TIER_FLAGS;
  }
}

interface DowngradeBlocker {
  resource: string;
  current: number;
  limit: number;
}

// Validate if downgrade is possible
async function validateDowngrade(
  organizationId: string,
  targetTier: TierType
): Promise<{ canDowngrade: boolean; blockers: DowngradeBlocker[] }> {
  const targetLimits = getTierLimits(targetTier);
  const blockers: DowngradeBlocker[] = [];

  // Count active clients
  const clientCount = await prisma.client.count({
    where: {
      organizationId,
      archivedAt: null,
    },
  });

  // Check client count vs limit
  if (targetLimits.maxClients !== -1 && clientCount > targetLimits.maxClients) {
    blockers.push({
      resource: "Active clients",
      current: clientCount,
      limit: targetLimits.maxClients,
    });
  }

  // Count team members
  const teamMemberCount = await prisma.user.count({
    where: {
      organizationId,
      isActive: true,
    },
  });

  // Check team member count vs limit
  if (targetLimits.maxTeamSeats !== -1 && teamMemberCount > targetLimits.maxTeamSeats) {
    blockers.push({
      resource: "Team members",
      current: teamMemberCount,
      limit: targetLimits.maxTeamSeats,
    });
  }

  // Get storage usage
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { storageUsedBytes: true },
  });

  const storageUsedBytes = Number(organization?.storageUsedBytes || 0);
  if (targetLimits.storageQuotaBytes !== -1 && storageUsedBytes > targetLimits.storageQuotaBytes) {
    const currentStorageGB = parseFloat((storageUsedBytes / (1024 * 1024 * 1024)).toFixed(2));
    const limitStorageGB = parseFloat((targetLimits.storageQuotaBytes / (1024 * 1024 * 1024)).toFixed(2));
    blockers.push({
      resource: "Storage usage (GB)",
      current: currentStorageGB,
      limit: limitStorageGB,
    });
  }

  return {
    canDowngrade: blockers.length === 0,
    blockers,
  };
}

export const dynamic = "force-dynamic";

// POST /api/billing/checkout - Create a checkout session
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { plan, interval } = parsed.data;

    // Get price ID using the new helper
    const priceId = getPriceId(plan, interval);

    if (!priceId) {
      return NextResponse.json(
        { error: "Stripe price not configured for selected plan. Contact support." },
        { status: 500 }
      );
    }

    // Get organization
    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Check if this is a downgrade
    const currentTier = organization.subscriptionTier as TierType;
    const targetTier = plan as TierType;
    const currentIndex = TIER_ORDER.indexOf(currentTier);
    const targetIndex = TIER_ORDER.indexOf(targetTier);

    // If this is a downgrade, validate it
    if (targetIndex < currentIndex) {
      const { canDowngrade, blockers } = await validateDowngrade(
        organization.id,
        targetTier
      );

      if (!canDowngrade) {
        log.warn(
          { organizationId: organization.id, targetTier, blockers },
          "Downgrade blocked due to usage exceeding limits"
        );
        return NextResponse.json(
          {
            error: "Cannot downgrade: usage exceeds target tier limits",
            blockers,
          },
          { status: 400 }
        );
      }

      log.info(
        { organizationId: organization.id, currentTier, targetTier },
        "Downgrade validation passed"
      );
    }

    // Get or create Stripe customer
    let customerId = organization.stripeCustomerId;

    if (!customerId) {
      customerId = await getOrCreateCustomer(
        organization.id,
        session.user.email!,
        organization.name
      );

      if (!customerId) {
        return NextResponse.json(
          { error: "Failed to create Stripe customer" },
          { status: 500 }
        );
      }

      // Save customer ID
      await prisma.organization.update({
        where: { id: organization.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create checkout session
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
    const checkoutUrl = await createCheckoutSession(
      customerId,
      priceId,
      `${baseUrl}/billing?success=true`,
      `${baseUrl}/billing?canceled=true`,
      organization.id,
      plan
    );

    if (!checkoutUrl) {
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 }
      );
    }

    // Log the event
    await prisma.eventLog.create({
      data: {
        eventType: "CHECKOUT_INITIATED",
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetType: "Organization",
        targetId: organization.id,
        eventData: JSON.stringify({ plan, interval }),
        organizationId: organization.id,
      },
    });

    return NextResponse.json({ url: checkoutUrl });
  } catch (error) {
    log.error({ err: error }, "Error creating checkout session");
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
