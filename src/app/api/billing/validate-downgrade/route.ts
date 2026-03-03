import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { z } from "zod";
import {
  FREE_TIER_FLAGS,
  STARTER_TIER_FLAGS,
  PROFESSIONAL_TIER_FLAGS,
  ENTERPRISE_TIER_FLAGS,
  FeatureFlags,
} from "@/types";

const log = createLogger("billing-validate-downgrade-api");

export const dynamic = "force-dynamic";

// Validation schema for the request
const validateDowngradeSchema = z.object({
  targetTier: z.enum(["FREE", "SOLO", "STARTER", "PROFESSIONAL", "ENTERPRISE"]),
});

// Tier hierarchy (lower index = lower tier)
const TIER_ORDER = ["FREE", "SOLO", "STARTER", "PROFESSIONAL", "ENTERPRISE"] as const;
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

// Features that are lost when downgrading
function getLostFeatures(currentTier: TierType, targetTier: TierType): string[] {
  const currentFlags = getTierLimits(currentTier);
  const targetFlags = getTierLimits(targetTier);
  const lostFeatures: string[] = [];

  // Check boolean features
  if (currentFlags.canUseCFPB && !targetFlags.canUseCFPB) {
    lostFeatures.push("CFPB complaint generator");
  }
  if (currentFlags.canUseLitigationScanner && !targetFlags.canUseLitigationScanner) {
    lostFeatures.push("Litigation Scanner");
  }
  if (currentFlags.canUseCreditDNA && !targetFlags.canUseCreditDNA) {
    lostFeatures.push("Credit DNA analysis");
  }
  if (currentFlags.canUseWhiteLabel && !targetFlags.canUseWhiteLabel) {
    lostFeatures.push("White-label customization");
  }
  if (currentFlags.canUseAPI && !targetFlags.canUseAPI) {
    lostFeatures.push("API access");
  }
  if (currentFlags.canUseBulkDisputes && !targetFlags.canUseBulkDisputes) {
    lostFeatures.push("Bulk dispute creation");
  }
  if (currentFlags.canUseAILetters && !targetFlags.canUseAILetters) {
    lostFeatures.push("AI-generated letters");
  }

  return lostFeatures;
}

export interface DowngradeBlocker {
  resource: string;
  current: number;
  limit: number;
}

export interface ValidateDowngradeResponse {
  canDowngrade: boolean;
  blockers: DowngradeBlocker[];
  warnings: string[];
  targetTier: string;
  currentTier: string;
}

// POST /api/billing/validate-downgrade - Validate if downgrade is possible
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = validateDowngradeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { targetTier } = parsed.data;

    // Get organization with current tier
    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        id: true,
        subscriptionTier: true,
        storageUsedBytes: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const currentTier = organization.subscriptionTier as TierType;
    const currentIndex = TIER_ORDER.indexOf(currentTier);
    const targetIndex = TIER_ORDER.indexOf(targetTier);

    // Check if this is actually a downgrade
    if (targetIndex >= currentIndex) {
      return NextResponse.json(
        { error: "Target tier is not a downgrade from current tier" },
        { status: 400 }
      );
    }

    const targetLimits = getTierLimits(targetTier);
    const blockers: DowngradeBlocker[] = [];
    const warnings: string[] = [];

    // Count active clients
    const clientCount = await prisma.client.count({
      where: {
        organizationId: organization.id,
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
        organizationId: organization.id,
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

    // Check storage usage vs limit
    const storageUsedBytes = Number(organization.storageUsedBytes || 0);
    if (targetLimits.storageQuotaBytes !== -1 && storageUsedBytes > targetLimits.storageQuotaBytes) {
      const currentStorageGB = (storageUsedBytes / (1024 * 1024 * 1024)).toFixed(2);
      const limitStorageGB = (targetLimits.storageQuotaBytes / (1024 * 1024 * 1024)).toFixed(2);
      blockers.push({
        resource: "Storage usage (GB)",
        current: parseFloat(currentStorageGB),
        limit: parseFloat(limitStorageGB),
      });
    }

    // Get lost features as warnings
    const lostFeatures = getLostFeatures(currentTier, targetTier);
    lostFeatures.forEach((feature) => {
      warnings.push(`You will lose access to: ${feature}`);
    });

    // Add warnings for reduced limits
    if (targetLimits.maxClients !== -1 && targetLimits.maxClients < (getTierLimits(currentTier).maxClients ?? Infinity)) {
      warnings.push(`Client limit will be reduced to ${targetLimits.maxClients}`);
    }
    if (targetLimits.maxTeamSeats !== -1 && targetLimits.maxTeamSeats < (getTierLimits(currentTier).maxTeamSeats ?? Infinity)) {
      warnings.push(`Team seats will be reduced to ${targetLimits.maxTeamSeats}`);
    }
    if (targetLimits.maxDisputesPerMonth !== -1 && targetLimits.maxDisputesPerMonth < (getTierLimits(currentTier).maxDisputesPerMonth ?? Infinity)) {
      warnings.push(`Monthly dispute limit will be reduced to ${targetLimits.maxDisputesPerMonth}`);
    }
    if (targetLimits.maxReportsPerMonth !== -1 && targetLimits.maxReportsPerMonth < (getTierLimits(currentTier).maxReportsPerMonth ?? Infinity)) {
      warnings.push(`Monthly report upload limit will be reduced to ${targetLimits.maxReportsPerMonth}`);
    }

    const response: ValidateDowngradeResponse = {
      canDowngrade: blockers.length === 0,
      blockers,
      warnings,
      targetTier,
      currentTier,
    };

    return NextResponse.json(response);
  } catch (error) {
    log.error({ err: error }, "Error validating downgrade");
    return NextResponse.json(
      { error: "Failed to validate downgrade" },
      { status: 500 }
    );
  }
}
