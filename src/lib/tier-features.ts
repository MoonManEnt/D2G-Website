// ============================================================================
// DISPUTE2GO - Tier Feature Constants
// Feature gating based on subscription tier
// ============================================================================

import { SubscriptionTier } from "@/types";

// ============================================================================
// FEATURE DEFINITIONS
// ============================================================================

/**
 * All features that can be gated by subscription tier
 */
export type Feature =
  | "bulkDisputes"
  | "creditDna"
  | "litigationScanner"
  | "cfpbComplaints"
  | "whiteLabelBranding"
  | "apiAccess"
  | "customIntegrations"
  | "sentryMode";

/**
 * Tier hierarchy for comparison
 * Higher index = higher tier
 */
export const TIER_HIERARCHY: SubscriptionTier[] = [
  SubscriptionTier.FREE,
  SubscriptionTier.SOLO,
  SubscriptionTier.STARTER,
  SubscriptionTier.PROFESSIONAL,
  SubscriptionTier.ENTERPRISE,
];

/**
 * Map of features to their minimum required tier
 */
export const FEATURE_REQUIRED_TIER: Record<Feature, SubscriptionTier> = {
  // SOLO+ features
  creditDna: SubscriptionTier.SOLO,

  // STARTER+ features
  bulkDisputes: SubscriptionTier.STARTER,

  // PROFESSIONAL+ features
  litigationScanner: SubscriptionTier.PROFESSIONAL,
  cfpbComplaints: SubscriptionTier.PROFESSIONAL,
  whiteLabelBranding: SubscriptionTier.PROFESSIONAL,
  sentryMode: SubscriptionTier.PROFESSIONAL,

  // ENTERPRISE only features
  apiAccess: SubscriptionTier.ENTERPRISE,
  customIntegrations: SubscriptionTier.ENTERPRISE,
};

/**
 * Map of each tier to its available features
 */
export const TIER_FEATURES: Record<SubscriptionTier, Feature[]> = {
  [SubscriptionTier.FREE]: [],
  [SubscriptionTier.SOLO]: ["creditDna"],
  [SubscriptionTier.STARTER]: ["bulkDisputes", "creditDna"],
  [SubscriptionTier.PROFESSIONAL]: [
    "bulkDisputes",
    "creditDna",
    "litigationScanner",
    "cfpbComplaints",
    "whiteLabelBranding",
    "sentryMode",
  ],
  [SubscriptionTier.ENTERPRISE]: [
    "bulkDisputes",
    "creditDna",
    "litigationScanner",
    "cfpbComplaints",
    "whiteLabelBranding",
    "sentryMode",
    "apiAccess",
    "customIntegrations",
  ],
};

/**
 * Human-readable feature names for display
 */
export const FEATURE_DISPLAY_NAMES: Record<Feature, string> = {
  bulkDisputes: "Bulk Disputes",
  creditDna: "Credit DNA Analysis",
  litigationScanner: "Litigation Scanner",
  cfpbComplaints: "CFPB Complaints",
  whiteLabelBranding: "White-Label Branding",
  apiAccess: "API Access",
  customIntegrations: "Custom Integrations",
  sentryMode: "Sentry Mode",
};

/**
 * Feature descriptions for upgrade prompts
 */
export const FEATURE_DESCRIPTIONS: Record<Feature, string> = {
  bulkDisputes: "Create and send multiple disputes at once to save time",
  creditDna: "AI-powered analysis of credit profile patterns and recommendations",
  litigationScanner: "Identify potential FCRA violations for litigation",
  cfpbComplaints: "Generate professional CFPB complaint drafts",
  whiteLabelBranding: "Customize letters and documents with your branding",
  apiAccess: "Integrate Dispute2Go with your existing systems",
  customIntegrations: "Build custom workflows and connections",
  sentryMode: "AI-powered autonomous dispute workflow with intelligence and outcome tracking",
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the index of a tier in the hierarchy
 */
function getTierIndex(tier: SubscriptionTier): number {
  return TIER_HIERARCHY.indexOf(tier);
}

/**
 * Check if a tier meets or exceeds the required tier
 */
export function tierMeetsRequirement(
  currentTier: SubscriptionTier,
  requiredTier: SubscriptionTier
): boolean {
  const currentIndex = getTierIndex(currentTier);
  const requiredIndex = getTierIndex(requiredTier);
  return currentIndex >= requiredIndex;
}

/**
 * Get all features available for a given tier
 */
export function getTierFeatures(tier: SubscriptionTier): Feature[] {
  return TIER_FEATURES[tier] || [];
}

/**
 * Get the minimum tier required to access a feature
 */
export function featureRequiresTier(feature: Feature): SubscriptionTier {
  return FEATURE_REQUIRED_TIER[feature];
}

/**
 * Check if a tier has access to a specific feature
 */
export function tierHasFeature(
  tier: SubscriptionTier,
  feature: Feature
): boolean {
  const requiredTier = featureRequiresTier(feature);
  return tierMeetsRequirement(tier, requiredTier);
}

/**
 * Get the next tier that includes a feature the current tier doesn't have
 */
export function getUpgradeTierForFeature(
  currentTier: SubscriptionTier,
  feature: Feature
): SubscriptionTier | null {
  const requiredTier = featureRequiresTier(feature);
  if (tierMeetsRequirement(currentTier, requiredTier)) {
    return null; // Already has access
  }
  return requiredTier;
}

/**
 * Get features that would be unlocked by upgrading to a specific tier
 */
export function getUnlockedFeatures(
  currentTier: SubscriptionTier,
  targetTier: SubscriptionTier
): Feature[] {
  const currentFeatures = new Set(getTierFeatures(currentTier));
  const targetFeatures = getTierFeatures(targetTier);
  return targetFeatures.filter((feature) => !currentFeatures.has(feature));
}

/**
 * Get the display name for a tier
 */
export function getTierDisplayName(tier: SubscriptionTier): string {
  const names: Record<SubscriptionTier, string> = {
    [SubscriptionTier.FREE]: "Free",
    [SubscriptionTier.SOLO]: "Solo",
    [SubscriptionTier.STARTER]: "Starter",
    [SubscriptionTier.PROFESSIONAL]: "Professional",
    [SubscriptionTier.ENTERPRISE]: "Enterprise",
  };
  return names[tier] || tier;
}
