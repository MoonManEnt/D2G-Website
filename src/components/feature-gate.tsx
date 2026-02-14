"use client";

// ============================================================================
// DISPUTE2GO - FeatureGate Component
// Conditionally render content based on subscription tier
// ============================================================================

import { ReactNode } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { SubscriptionTier, SubscriptionStatus } from "@/types";
import {
  tierMeetsRequirement,
  getTierDisplayName,
  TIER_HIERARCHY,
} from "@/lib/tier-features";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles, Zap } from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

export interface FeatureGateProps {
  /**
   * The minimum subscription tier required to access this feature
   */
  requiredTier: "STARTER" | "PROFESSIONAL" | "ENTERPRISE";

  /**
   * The content to render when the user has access
   */
  children: ReactNode;

  /**
   * Optional custom locked state component
   */
  lockedComponent?: ReactNode;

  /**
   * Optional feature name to display in the locked state
   */
  featureName?: string;

  /**
   * Optional feature description for the locked state
   */
  featureDescription?: string;

  /**
   * Whether to render nothing instead of the locked state (useful for hiding features entirely)
   */
  hideWhenLocked?: boolean;

  /**
   * Optional class name for the wrapper
   */
  className?: string;

  /**
   * Render as inline element instead of block
   */
  inline?: boolean;
}

// ============================================================================
// DEFAULT LOCKED STATE COMPONENT
// ============================================================================

interface LockedStateProps {
  requiredTier: SubscriptionTier;
  currentTier: SubscriptionTier;
  featureName?: string;
  featureDescription?: string;
  inline?: boolean;
}

function DefaultLockedState({
  requiredTier,
  currentTier,
  featureName,
  featureDescription,
  inline,
}: LockedStateProps) {
  const requiredTierName = getTierDisplayName(requiredTier);
  const currentTierName = getTierDisplayName(currentTier);

  // Determine the upgrade path
  const currentIndex = TIER_HIERARCHY.indexOf(currentTier);
  const requiredIndex = TIER_HIERARCHY.indexOf(requiredTier);
  const tierDifference = requiredIndex - currentIndex;

  // Choose icon based on tier
  const TierIcon = requiredTier === SubscriptionTier.ENTERPRISE ? Sparkles : Zap;

  if (inline) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 border border-border text-muted-foreground text-sm">
        <Lock className="w-3 h-3" />
        <span className="font-medium">{requiredTierName}+</span>
      </span>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Lock className="w-4 h-4 text-primary" />
          </div>
          {featureName || "Feature Locked"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {featureDescription ||
            `This feature requires the ${requiredTierName} plan or higher.`}
        </p>

        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border">
          <span className="text-xs text-muted-foreground">Current plan:</span>
          <span className="text-xs font-semibold">{currentTierName}</span>
          <span className="text-xs text-muted-foreground mx-1">|</span>
          <span className="text-xs text-muted-foreground">Required:</span>
          <span className="text-xs font-semibold text-primary">
            {requiredTierName}
          </span>
        </div>

        <div className="flex gap-3">
          <Link href="/settings/billing" className="flex-1">
            <Button className="w-full gap-2" variant="default">
              <TierIcon className="w-4 h-4" />
              {tierDifference > 1 ? "View Plans" : `Upgrade to ${requiredTierName}`}
            </Button>
          </Link>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Upgrade your plan to unlock this and other premium features.
        </p>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// FEATURE GATE COMPONENT
// ============================================================================

/**
 * FeatureGate - Conditionally render content based on subscription tier
 *
 * @example
 * ```tsx
 * <FeatureGate requiredTier="PROFESSIONAL">
 *   <LitigationScanner />
 * </FeatureGate>
 * ```
 *
 * @example With custom locked state
 * ```tsx
 * <FeatureGate
 *   requiredTier="ENTERPRISE"
 *   featureName="API Access"
 *   featureDescription="Integrate Dispute2Go with your existing systems via our REST API."
 * >
 *   <APISettings />
 * </FeatureGate>
 * ```
 *
 * @example Hide when locked
 * ```tsx
 * <FeatureGate requiredTier="PROFESSIONAL" hideWhenLocked>
 *   <PremiumButton />
 * </FeatureGate>
 * ```
 */
export function FeatureGate({
  requiredTier,
  children,
  lockedComponent,
  featureName,
  featureDescription,
  hideWhenLocked = false,
  className,
  inline = false,
}: FeatureGateProps) {
  const { data: session, status } = useSession();

  // Convert string tier to enum
  const requiredTierEnum = SubscriptionTier[requiredTier];

  // Handle loading state
  if (status === "loading") {
    if (hideWhenLocked || inline) {
      return null;
    }
    return (
      <div className={className}>
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 animate-pulse">
          <CardContent className="py-8">
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 rounded-full bg-muted animate-pulse" />
              <div className="h-4 w-32 bg-muted rounded animate-pulse" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get current tier from session, defaulting to FREE
  const currentTier = session?.user?.subscriptionTier
    ? (session.user.subscriptionTier as SubscriptionTier)
    : SubscriptionTier.FREE;

  // Check subscription status - treat non-active as FREE
  const subscriptionStatus = session?.user?.subscriptionStatus
    ? (session.user.subscriptionStatus as SubscriptionStatus)
    : SubscriptionStatus.CANCELED;

  const isActive =
    subscriptionStatus === SubscriptionStatus.ACTIVE ||
    subscriptionStatus === SubscriptionStatus.TRIALING;

  // Effective tier is FREE if subscription is not active
  const effectiveTier = isActive ? currentTier : SubscriptionTier.FREE;

  // Check if user has access
  const hasAccess = tierMeetsRequirement(effectiveTier, requiredTierEnum);

  // Render children if user has access
  if (hasAccess) {
    return <>{children}</>;
  }

  // Hide completely if requested
  if (hideWhenLocked) {
    return null;
  }

  // Render custom locked component if provided
  if (lockedComponent) {
    return <div className={className}>{lockedComponent}</div>;
  }

  // Render default locked state
  return (
    <div className={className}>
      <DefaultLockedState
        requiredTier={requiredTierEnum}
        currentTier={effectiveTier}
        featureName={featureName}
        featureDescription={featureDescription}
        inline={inline}
      />
    </div>
  );
}

export default FeatureGate;
