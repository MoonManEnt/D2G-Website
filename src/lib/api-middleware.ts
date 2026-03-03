import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import {
  SubscriptionTier,
  FREE_TIER_FLAGS,
  SOLO_TIER_FLAGS,
  STARTER_TIER_FLAGS,
  PROFESSIONAL_TIER_FLAGS,
  ENTERPRISE_TIER_FLAGS,
  FeatureFlags,
} from "@/types";
import { notifySubscriptionLimit, NotificationService } from "@/lib/notifications";
import { cacheGet, cacheSet } from "@/lib/redis";
import { createLogger } from "./logger";
const log = createLogger("api-middleware");

// =============================================================================
// TYPES
// =============================================================================

/**
 * Context passed to the API handler
 */
export type AuthContext<TBody = unknown> = {
    session: Session;
    userId: string;
    organizationId: string;
    subscriptionTier: SubscriptionTier;
    params: Record<string, string>;
    body: TBody;
};

/**
 * Usage limit types
 */
export type UsageLimitType = "disputes" | "letters" | "clients" | "reports";

/**
 * Options for the API wrapper
 */
interface ApiOptions<TBody> {
    schema?: z.ZodType<TBody, z.ZodTypeDef, unknown>;
    roles?: string[];
    /** Check subscription limit before allowing action */
    checkLimit?: UsageLimitType;
    /** Required feature for this endpoint */
    requiredFeature?: string;
    /** Minimum subscription tier required */
    minTier?: SubscriptionTier;
}

// =============================================================================
// SUBSCRIPTION LIMITS BY TIER
// =============================================================================

// Feature flags map by tier - SINGLE SOURCE OF TRUTH from types/index.ts
const TIER_FLAGS: Record<SubscriptionTier, FeatureFlags> = {
  [SubscriptionTier.FREE]: FREE_TIER_FLAGS,
  [SubscriptionTier.SOLO]: SOLO_TIER_FLAGS,
  [SubscriptionTier.STARTER]: STARTER_TIER_FLAGS,
  [SubscriptionTier.PROFESSIONAL]: PROFESSIONAL_TIER_FLAGS,
  [SubscriptionTier.ENTERPRISE]: ENTERPRISE_TIER_FLAGS,
};

// Rate limits per tier (only thing not in FeatureFlags)
const RATE_LIMITS: Record<SubscriptionTier, number> = {
  [SubscriptionTier.FREE]: 30,
  [SubscriptionTier.SOLO]: 45,
  [SubscriptionTier.STARTER]: 60,
  [SubscriptionTier.PROFESSIONAL]: 100,
  [SubscriptionTier.ENTERPRISE]: 300,
};

// Derive features array from flags
function getFeaturesList(flags: FeatureFlags): string[] {
  const features: string[] = [];
  if (flags.canUploadReports) features.push("upload_reports");
  if (flags.canGenerateLetters) features.push("manual_letters");
  if (flags.canUseAILetters) features.push("ai_letters");
  if (flags.canUseBulkDisputes) features.push("bulk_disputes");
  if (flags.canUseCFPB) features.push("cfpb");
  if (flags.canUseLitigationScanner) features.push("litigation_scanner");
  if (flags.canUseCreditDNA) features.push("credit_dna");
  if (flags.canUseWhiteLabel) features.push("white_label");
  if (flags.canUseEvidence) features.push("evidence");
  if (flags.canUseAPI) features.push("api");
  return features;
}

// Derived limits from FeatureFlags - ensures single source of truth
export const SUBSCRIPTION_LIMITS: Record<SubscriptionTier, {
  disputes: { monthly: number };
  letters: { monthly: number };
  clients: { total: number };
  reports: { monthly: number };
  teamSeats: { total: number };
  storage: { bytes: number };
  rateLimit: { perMinute: number };
  features: string[];
}> = Object.fromEntries(
  Object.values(SubscriptionTier).map((tier) => {
    const flags = TIER_FLAGS[tier];
    return [
      tier,
      {
        disputes: { monthly: flags.maxDisputesPerMonth },
        letters: { monthly: flags.maxLettersPerMonth },
        clients: { total: flags.maxClients },
        reports: { monthly: flags.maxReportsPerMonth },
        teamSeats: { total: flags.maxTeamSeats },
        storage: { bytes: flags.storageQuotaBytes },
        rateLimit: { perMinute: RATE_LIMITS[tier] },
        features: getFeaturesList(flags),
      },
    ];
  })
) as Record<SubscriptionTier, {
  disputes: { monthly: number };
  letters: { monthly: number };
  clients: { total: number };
  reports: { monthly: number };
  teamSeats: { total: number };
  storage: { bytes: number };
  rateLimit: { perMinute: number };
  features: string[];
}>;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get current month's usage for an organization
 */
async function getMonthlyUsage(
  organizationId: string,
  type: UsageLimitType
): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  switch (type) {
    case "disputes":
      return prisma.dispute.count({
        where: {
          organizationId,
          createdAt: { gte: startOfMonth },
        },
      });

    case "letters":
      return prisma.document.count({
        where: {
          organizationId,
          documentType: "DISPUTE_LETTER",
          createdAt: { gte: startOfMonth },
        },
      });

    case "clients":
      // Total clients, not monthly
      return prisma.client.count({
        where: {
          organizationId,
          isActive: true,
        },
      });

    case "reports":
      return prisma.creditReport.count({
        where: {
          organizationId,
          createdAt: { gte: startOfMonth },
        },
      });

    default:
      return 0;
  }
}

/**
 * Check if organization has access to a feature
 */
function hasFeatureAccess(tier: SubscriptionTier, feature: string): boolean {
  const tierLimits = SUBSCRIPTION_LIMITS[tier];
  if (!tierLimits) return false;
  // Enterprise wildcard: "*" grants access to all features
  if (tierLimits.features.includes("*")) return true;
  return tierLimits.features.includes(feature);
}

/**
 * Check if organization is within usage limits
 */
async function checkUsageLimit(
  organizationId: string,
  tier: SubscriptionTier,
  type: UsageLimitType
): Promise<{ allowed: boolean; current: number; limit: number; percentage: number }> {
  const tierLimits = SUBSCRIPTION_LIMITS[tier];
  const limit =
    type === "clients"
      ? tierLimits.clients.total
      : tierLimits[type].monthly;

  // -1 means unlimited
  if (limit === -1) {
    return { allowed: true, current: 0, limit: -1, percentage: 0 };
  }

  const current = await getMonthlyUsage(organizationId, type);
  const percentage = Math.round((current / limit) * 100);

  return {
    allowed: current < limit,
    current,
    limit,
    percentage,
  };
}

/**
 * Send usage limit notifications when thresholds are crossed
 * Uses caching to prevent duplicate notifications within 24 hours
 */
async function checkAndNotifyUsageThresholds(
  organizationId: string,
  userId: string,
  type: UsageLimitType,
  percentage: number
): Promise<void> {
  // Only notify at 80% and 100% thresholds
  if (percentage < 80) return;

  const threshold = percentage >= 100 ? 100 : 80;
  const cacheKey = `usage-notify:${organizationId}:${type}:${threshold}`;

  // Check if we've already notified for this threshold (within 24 hours)
  const alreadyNotified = await cacheGet(cacheKey);
  if (alreadyNotified) return;

  try {
    // Send notification
    await notifySubscriptionLimit(userId, type, percentage);

    // Also notify org admins if this is a limit reached (100%)
    if (percentage >= 100) {
      const admins = await prisma.user.findMany({
        where: {
          organizationId,
          role: { in: ["ADMIN", "OWNER"] },
          id: { not: userId }, // Don't double-notify the current user
          isActive: true,
        },
        select: { id: true },
      });

      await Promise.all(
        admins.map((admin) => notifySubscriptionLimit(admin.id, type, percentage))
      );
    }

    // Cache to prevent duplicate notifications for 24 hours
    await cacheSet(cacheKey, "1", 86400);

    log.info({ organizationId, type, percentage, threshold }, "[USAGE] Sent usage limit notification");
  } catch (error) {
    // Don't fail the request if notification fails
    log.error({ err: error, organizationId, type }, "[USAGE] Failed to send usage notification");
  }
}

/**
 * Check tier hierarchy
 */
function meetsMinTier(currentTier: SubscriptionTier, minTier: SubscriptionTier): boolean {
  const tierOrder: SubscriptionTier[] = [
    SubscriptionTier.FREE,
    SubscriptionTier.SOLO,
    SubscriptionTier.STARTER,
    SubscriptionTier.PROFESSIONAL,
    SubscriptionTier.ENTERPRISE,
  ];
  return tierOrder.indexOf(currentTier) >= tierOrder.indexOf(minTier);
}

// =============================================================================
// WITH AUTH MIDDLEWARE
// =============================================================================

/**
 * Higher-order function to wrap API routes with authentication, validation,
 * and subscription enforcement.
 *
 * @example
 * // Basic auth
 * export const GET = withAuth(async (req, ctx) => {
 *   return NextResponse.json({ data: ctx.organizationId });
 * });
 *
 * @example
 * // With subscription limit check
 * export const POST = withAuth(async (req, ctx) => {
 *   // Create dispute...
 * }, { checkLimit: "disputes" });
 *
 * @example
 * // With role and tier requirements
 * export const DELETE = withAuth(async (req, ctx) => {
 *   // Admin-only action...
 * }, { roles: ["ADMIN"], minTier: "PROFESSIONAL" });
 */
export function withAuth<TBody = unknown>(
    handler: (req: NextRequest, context: AuthContext<TBody>) => Promise<NextResponse>,
    options: ApiOptions<TBody> = {}
) {
    return async (req: NextRequest, context: { params: Promise<Record<string, string>> } | undefined) => {
        try {
            // 1. Authentication
            const session = await getServerSession(authOptions);

            if (!session?.user?.organizationId) {
                return NextResponse.json(
                    { error: "Unauthorized", code: "UNAUTHORIZED" },
                    { status: 401 }
                );
            }

            const subscriptionTier = session.user.subscriptionTier as SubscriptionTier;
            const { organizationId } = session.user;

            // 2. Check subscription status
            if (session.user.subscriptionStatus !== "ACTIVE") {
                return NextResponse.json(
                    {
                        error: "Subscription inactive",
                        code: "SUBSCRIPTION_INACTIVE",
                        message: "Your subscription is not active. Please update your billing.",
                    },
                    { status: 403 }
                );
            }

            // 3. Role Check
            if (options.roles && !options.roles.includes(session.user.role)) {
                return NextResponse.json(
                    {
                        error: "Forbidden: Insufficient permissions",
                        code: "ROLE_REQUIRED",
                        requiredRoles: options.roles,
                    },
                    { status: 403 }
                );
            }

            // 4. Minimum Tier Check
            if (options.minTier && !meetsMinTier(subscriptionTier, options.minTier)) {
                return NextResponse.json(
                    {
                        error: "Upgrade required",
                        code: "TIER_REQUIRED",
                        requiredTier: options.minTier,
                        currentTier: subscriptionTier,
                        message: `This feature requires ${options.minTier} tier or higher.`,
                    },
                    { status: 403 }
                );
            }

            // 5. Feature Access Check
            if (options.requiredFeature && !hasFeatureAccess(subscriptionTier, options.requiredFeature)) {
                return NextResponse.json(
                    {
                        error: "Feature not available",
                        code: "FEATURE_UNAVAILABLE",
                        feature: options.requiredFeature,
                        currentTier: subscriptionTier,
                        message: `The "${options.requiredFeature}" feature is not available on your plan.`,
                    },
                    { status: 403 }
                );
            }

            // 6. Usage Limit Check
            if (options.checkLimit) {
                const usage = await checkUsageLimit(organizationId, subscriptionTier, options.checkLimit);

                // Send notifications when approaching or hitting limits
                if (usage.percentage >= 80) {
                    // Fire and forget - don't block the request
                    checkAndNotifyUsageThresholds(
                        organizationId,
                        session.user.id,
                        options.checkLimit,
                        usage.percentage
                    ).catch(() => {}); // Swallow errors silently
                }

                if (!usage.allowed) {
                    return NextResponse.json(
                        {
                            error: "Limit reached",
                            code: "LIMIT_REACHED",
                            limitType: options.checkLimit,
                            current: usage.current,
                            limit: usage.limit,
                            currentTier: subscriptionTier,
                            upgradeUrl: "/settings/billing",
                            message: `You've reached your monthly ${options.checkLimit} limit (${usage.current}/${usage.limit}). Upgrade for more.`,
                        },
                        { status: 429 }
                    );
                }
            }

            // 7. Body Validation (for POST/PUT/PATCH)
            let body: TBody = {} as TBody;
            if (options.schema) {
                try {
                    const json = await req.json();
                    body = options.schema.parse(json);
                } catch (error) {
                    if (error instanceof z.ZodError) {
                        return NextResponse.json(
                            { error: "Validation Error", code: "VALIDATION_ERROR", details: error.errors },
                            { status: 400 }
                        );
                    }
                    return NextResponse.json(
                        { error: "Invalid JSON body", code: "INVALID_JSON" },
                        { status: 400 }
                    );
                }
            }

            // 8. Resolve params if they are a promise (Next.js 15+ behavior)
            const params = context?.params ? await context.params : {};

            // 9. Call Handler
            return await handler(req, {
                session,
                userId: session.user.id,
                organizationId,
                subscriptionTier,
                params,
                body,
            });

        } catch (error) {
            log.error({ err: error }, "API Error");
            return NextResponse.json(
                { error: "Internal Server Error", code: "INTERNAL_ERROR" },
                { status: 500 }
            );
        }
    };
}

// =============================================================================
// UTILITY: TRACK USAGE
// =============================================================================

/**
 * Track usage for analytics and limit enforcement.
 * Call this after successful operations.
 */
export async function trackUsage(
  organizationId: string,
  userId: string,
  action: "dispute_created" | "letter_generated" | "report_uploaded" | "client_created",
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.eventLog.create({
      data: {
        eventType: `USAGE_${action.toUpperCase()}`,
        actorId: userId,
        actorEmail: "",
        targetType: action.split("_")[0],
        organizationId,
        eventData: JSON.stringify({
          timestamp: new Date().toISOString(),
          ...metadata,
        }),
      },
    });
  } catch (error) {
    // Don't fail the main operation if tracking fails
    log.error({ err: error }, "Failed to track usage");
  }
}

/**
 * Get usage stats for an organization
 */
export async function getUsageStats(
  organizationId: string,
  tier: SubscriptionTier
): Promise<{
  disputes: { current: number; limit: number; percentage: number };
  letters: { current: number; limit: number; percentage: number };
  clients: { current: number; limit: number; percentage: number };
  reports: { current: number; limit: number; percentage: number };
}> {
  const [disputes, letters, clients, reports] = await Promise.all([
    checkUsageLimit(organizationId, tier, "disputes"),
    checkUsageLimit(organizationId, tier, "letters"),
    checkUsageLimit(organizationId, tier, "clients"),
    checkUsageLimit(organizationId, tier, "reports"),
  ]);

  const calcPercentage = (current: number, limit: number) =>
    limit === -1 ? 0 : Math.round((current / limit) * 100);

  return {
    disputes: { ...disputes, percentage: calcPercentage(disputes.current, disputes.limit) },
    letters: { ...letters, percentage: calcPercentage(letters.current, letters.limit) },
    clients: { ...clients, percentage: calcPercentage(clients.current, clients.limit) },
    reports: { ...reports, percentage: calcPercentage(reports.current, reports.limit) },
  };
}
