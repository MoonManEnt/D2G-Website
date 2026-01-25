import { SubscriptionTier, SubscriptionStatus, FeatureFlags, FREE_TIER_FLAGS, PRO_TIER_FLAGS, ENTERPRISE_TIER_FLAGS } from "@/types";

/**
 * Get feature flags based on subscription tier and status
 */
export function getFeatureFlags(tier: SubscriptionTier, status: SubscriptionStatus): FeatureFlags {
  // If subscription is not active, treat as free
  if (status !== SubscriptionStatus.ACTIVE && status !== SubscriptionStatus.TRIALING) {
    return FREE_TIER_FLAGS;
  }

  switch (tier) {
    case SubscriptionTier.ENTERPRISE:
      return ENTERPRISE_TIER_FLAGS;
    case SubscriptionTier.PROFESSIONAL:
      return PRO_TIER_FLAGS;
    case SubscriptionTier.STARTER:
      return { ...FREE_TIER_FLAGS, canUploadReports: true, maxClients: 15, maxReportsPerMonth: 25 };
    case SubscriptionTier.FREE:
    default:
      return FREE_TIER_FLAGS;
  }
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(
  feature: keyof FeatureFlags,
  tier: SubscriptionTier,
  status: SubscriptionStatus
): boolean {
  const flags = getFeatureFlags(tier, status);
  const value = flags[feature];
  
  if (typeof value === "boolean") {
    return value;
  }
  
  // For numeric limits, check if not zero
  return value !== 0;
}

/**
 * Get the numeric limit for a feature
 */
export function getFeatureLimit(
  feature: "maxClients" | "maxReportsPerMonth",
  tier: SubscriptionTier,
  status: SubscriptionStatus
): number {
  const flags = getFeatureFlags(tier, status);
  return flags[feature];
}

/**
 * Check if user has reached a limit
 */
export function hasReachedLimit(
  feature: "maxClients" | "maxReportsPerMonth",
  currentCount: number,
  tier: SubscriptionTier,
  status: SubscriptionStatus
): boolean {
  const limit = getFeatureLimit(feature, tier, status);
  
  // -1 means unlimited
  if (limit === -1) {
    return false;
  }
  
  return currentCount >= limit;
}

/**
 * Feature gate messages for UI
 */
export const FEATURE_GATE_MESSAGES: Record<keyof FeatureFlags, string> = {
  canUploadReports: "Upgrade to Pro to upload and parse credit reports",
  canGenerateLetters: "Upgrade to Pro to generate CRA dispute letters",
  canGenerateCFPB: "Upgrade to Pro to generate CFPB complaint drafts",
  canUseEvidence: "Upgrade to Pro to use evidence tools",
  canViewDiff: "Upgrade to Pro to view month-over-month report comparisons",
  canExportDocuments: "Upgrade to Pro to export documents",
  maxClients: "You've reached the maximum number of clients for your plan",
  maxReportsPerMonth: "You've reached the maximum number of reports for this month",
};

/**
 * Subscription tier display info
 */
export const TIER_INFO: Record<SubscriptionTier, { name: string; description: string; price: string }> = {
  [SubscriptionTier.FREE]: {
    name: "Free",
    description: "View the platform and explore features",
    price: "$0/month",
  },
  [SubscriptionTier.STARTER]: {
    name: "Starter",
    description: "Essential dispute tools for individuals",
    price: "$49/month",
  },
  [SubscriptionTier.PROFESSIONAL]: {
    name: "Professional",
    description: "Full access to all dispute tools",
    price: "$99/month",
  },
  [SubscriptionTier.ENTERPRISE]: {
    name: "Enterprise",
    description: "Unlimited access with premium support",
    price: "$299/month",
  },
};
