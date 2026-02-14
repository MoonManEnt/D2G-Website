"use client";

// ============================================================================
// DISPUTE2GO - useFeatureAccess Hook
// Check feature access based on subscription tier
// ============================================================================

import { useSession } from "next-auth/react";
import { useMemo, useCallback } from "react";
import { SubscriptionTier, SubscriptionStatus } from "@/types";
import {
  Feature,
  tierHasFeature,
  tierMeetsRequirement,
  TIER_HIERARCHY,
  getTierDisplayName,
  getUpgradeTierForFeature,
  FEATURE_DISPLAY_NAMES,
  FEATURE_DESCRIPTIONS,
} from "@/lib/tier-features";

// ============================================================================
// TYPES
// ============================================================================

export interface FeatureAccessResult {
  /**
   * Check if the user has access to a specific feature
   */
  hasAccess: (feature: Feature) => boolean;

  /**
   * Check if the user's tier meets or exceeds a required tier
   */
  hasMinimumTier: (requiredTier: SubscriptionTier) => boolean;

  /**
   * The user's current subscription tier
   */
  currentTier: SubscriptionTier;

  /**
   * Whether the user can upgrade to a higher tier
   */
  canUpgrade: boolean;

  /**
   * Whether the subscription is currently active
   */
  isActive: boolean;

  /**
   * Whether the session is still loading
   */
  isLoading: boolean;

  /**
   * Get the tier required to access a feature
   */
  getRequiredTierForFeature: (feature: Feature) => SubscriptionTier | null;

  /**
   * Get a human-readable name for the current tier
   */
  tierDisplayName: string;

  /**
   * Get the display name for a feature
   */
  getFeatureDisplayName: (feature: Feature) => string;

  /**
   * Get the description for a feature
   */
  getFeatureDescription: (feature: Feature) => string;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Hook to check feature access based on the user's subscription tier
 *
 * @example
 * ```tsx
 * const { hasAccess, currentTier, canUpgrade } = useFeatureAccess();
 *
 * if (hasAccess("litigationScanner")) {
 *   // Show litigation scanner
 * }
 * ```
 */
export function useFeatureAccess(): FeatureAccessResult {
  const { data: session, status } = useSession();
  const isLoading = status === "loading";

  // Extract tier and status from session, defaulting to FREE and inactive
  const currentTier = useMemo(() => {
    if (!session?.user?.subscriptionTier) {
      return SubscriptionTier.FREE;
    }
    return session.user.subscriptionTier as SubscriptionTier;
  }, [session?.user?.subscriptionTier]);

  const subscriptionStatus = useMemo(() => {
    if (!session?.user?.subscriptionStatus) {
      return SubscriptionStatus.CANCELED;
    }
    return session.user.subscriptionStatus as SubscriptionStatus;
  }, [session?.user?.subscriptionStatus]);

  // Check if subscription is active (ACTIVE or TRIALING)
  const isActive = useMemo(() => {
    return (
      subscriptionStatus === SubscriptionStatus.ACTIVE ||
      subscriptionStatus === SubscriptionStatus.TRIALING
    );
  }, [subscriptionStatus]);

  // Determine effective tier (FREE if not active)
  const effectiveTier = useMemo(() => {
    return isActive ? currentTier : SubscriptionTier.FREE;
  }, [isActive, currentTier]);

  // Check if user can upgrade
  const canUpgrade = useMemo(() => {
    const tierIndex = TIER_HIERARCHY.indexOf(effectiveTier);
    // Can upgrade if not at the highest tier (ENTERPRISE)
    return tierIndex < TIER_HIERARCHY.length - 1;
  }, [effectiveTier]);

  // Get display name for current tier
  const tierDisplayName = useMemo(() => {
    return getTierDisplayName(effectiveTier);
  }, [effectiveTier]);

  // Check if user has access to a feature
  const hasAccess = useCallback(
    (feature: Feature): boolean => {
      if (isLoading) {
        // While loading, deny access to prevent flash of content
        return false;
      }
      return tierHasFeature(effectiveTier, feature);
    },
    [effectiveTier, isLoading]
  );

  // Check if user has minimum tier
  const hasMinimumTier = useCallback(
    (requiredTier: SubscriptionTier): boolean => {
      if (isLoading) {
        return false;
      }
      return tierMeetsRequirement(effectiveTier, requiredTier);
    },
    [effectiveTier, isLoading]
  );

  // Get required tier for a feature
  const getRequiredTierForFeature = useCallback(
    (feature: Feature): SubscriptionTier | null => {
      return getUpgradeTierForFeature(effectiveTier, feature);
    },
    [effectiveTier]
  );

  // Get feature display name
  const getFeatureDisplayName = useCallback((feature: Feature): string => {
    return FEATURE_DISPLAY_NAMES[feature] || feature;
  }, []);

  // Get feature description
  const getFeatureDescription = useCallback((feature: Feature): string => {
    return FEATURE_DESCRIPTIONS[feature] || "";
  }, []);

  return {
    hasAccess,
    hasMinimumTier,
    currentTier: effectiveTier,
    canUpgrade,
    isActive,
    isLoading,
    getRequiredTierForFeature,
    tierDisplayName,
    getFeatureDisplayName,
    getFeatureDescription,
  };
}

export default useFeatureAccess;
