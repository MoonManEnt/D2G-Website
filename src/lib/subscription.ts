import { SubscriptionTier, SubscriptionStatus, FeatureFlags, FREE_TIER_FLAGS, SOLO_TIER_FLAGS, STARTER_TIER_FLAGS, PROFESSIONAL_TIER_FLAGS, ENTERPRISE_TIER_FLAGS } from "@/types";

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
      return PROFESSIONAL_TIER_FLAGS;
    case SubscriptionTier.STARTER:
      return STARTER_TIER_FLAGS;
    case SubscriptionTier.SOLO:
      return SOLO_TIER_FLAGS;
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
  feature: "maxClients" | "maxReportsPerMonth" | "maxDisputesPerMonth" | "maxLettersPerMonth" | "maxTeamSeats" | "storageQuotaBytes",
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
  feature: "maxClients" | "maxReportsPerMonth" | "maxDisputesPerMonth" | "maxLettersPerMonth" | "maxTeamSeats" | "storageQuotaBytes",
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
  canUploadReports: "Upgrade your plan to upload and parse credit reports",
  canGenerateLetters: "Upgrade your plan to generate CRA dispute letters",
  canGenerateCFPB: "Upgrade to Professional to generate CFPB complaint drafts",
  canUseEvidence: "Upgrade your plan to use evidence tools",
  canViewDiff: "Upgrade your plan to view month-over-month report comparisons",
  canExportDocuments: "Upgrade your plan to export documents",
  canUseLitigationScanner: "Upgrade to Professional to use the litigation scanner",
  canUseCreditDNA: "Upgrade to Starter to use Credit DNA analysis",
  canUseWhiteLabel: "Upgrade to Professional to use white-label branding",
  canUseAPI: "Upgrade to Enterprise for API access",
  canUseBulkDisputes: "Upgrade to Starter to send bulk disputes",
  canUseCFPB: "Upgrade to Professional to file CFPB complaints",
  canUseAILetters: "Upgrade to Starter to use AI-generated letters",
  canUseSentryMode: "Upgrade to Professional to use Sentry Mode intelligence",
  maxClients: "You've reached the maximum number of clients for your plan",
  maxReportsPerMonth: "You've reached the maximum number of reports for this month",
  maxDisputesPerMonth: "You've reached the maximum number of disputes for this month",
  maxLettersPerMonth: "You've reached the maximum number of letters for this month",
  maxTeamSeats: "You've reached the maximum number of team seats for your plan",
  storageQuotaBytes: "You've reached your storage quota. Upgrade for more space",
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
  [SubscriptionTier.SOLO]: {
    name: "Solo",
    description: "AI-powered dispute tools for solo specialists",
    price: "$79/month",
  },
  [SubscriptionTier.STARTER]: {
    name: "Starter",
    description: "Essential dispute tools for growing businesses",
    price: "$129/month",
  },
  [SubscriptionTier.PROFESSIONAL]: {
    name: "Professional",
    description: "Full access to all dispute tools",
    price: "$199/month",
  },
  [SubscriptionTier.ENTERPRISE]: {
    name: "Enterprise",
    description: "Unlimited access with premium support",
    price: "Custom pricing",
  },
};
