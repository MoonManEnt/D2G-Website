import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { SubscriptionTier } from "@/types";
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

export const SUBSCRIPTION_LIMITS: Record<SubscriptionTier, {
  disputes: { monthly: number };
  letters: { monthly: number };
  clients: { total: number };
  reports: { monthly: number };
  teamSeats: { total: number };
  storage: { bytes: number };
  rateLimit: { perMinute: number };
  features: string[];
}> = {
  [SubscriptionTier.FREE]: {
    disputes: { monthly: 15 },
    letters: { monthly: 15 },
    clients: { total: 5 },
    reports: { monthly: 10 },
    teamSeats: { total: 1 },
    storage: { bytes: 524288000 },
    rateLimit: { perMinute: 30 },
    features: ["basic_disputes", "manual_letters", "basic_evidence"],
  },
  [SubscriptionTier.STARTER]: {
    disputes: { monthly: 100 },
    letters: { monthly: 100 },
    clients: { total: 50 },
    reports: { monthly: 50 },
    teamSeats: { total: 5 },
    storage: { bytes: 5368709120 },
    rateLimit: { perMinute: 60 },
    features: ["basic_disputes", "manual_letters", "ai_letters", "bulk_disputes", "credit_dna", "full_evidence"],
  },
  [SubscriptionTier.PROFESSIONAL]: {
    disputes: { monthly: 400 },
    letters: { monthly: 400 },
    clients: { total: 250 },
    reports: { monthly: 200 },
    teamSeats: { total: 15 },
    storage: { bytes: 26843545600 },
    rateLimit: { perMinute: 100 },
    features: ["basic_disputes", "manual_letters", "ai_letters", "bulk_disputes", "cfpb", "litigation_scanner", "credit_dna", "white_label", "full_evidence"],
  },
  [SubscriptionTier.ENTERPRISE]: {
    disputes: { monthly: -1 },
    letters: { monthly: -1 },
    clients: { total: -1 },
    reports: { monthly: -1 },
    teamSeats: { total: -1 },
    storage: { bytes: 107374182400 },
    rateLimit: { perMinute: 300 },
    features: ["*"],
  },
};

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
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const tierLimits = SUBSCRIPTION_LIMITS[tier];
  const limit =
    type === "clients"
      ? tierLimits.clients.total
      : tierLimits[type].monthly;

  // -1 means unlimited
  if (limit === -1) {
    return { allowed: true, current: 0, limit: -1 };
  }

  const current = await getMonthlyUsage(organizationId, type);
  return {
    allowed: current < limit,
    current,
    limit,
  };
}

/**
 * Check tier hierarchy
 */
function meetsMinTier(currentTier: SubscriptionTier, minTier: SubscriptionTier): boolean {
  const tierOrder: SubscriptionTier[] = [
    SubscriptionTier.FREE,
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

                if (!usage.allowed) {
                    return NextResponse.json(
                        {
                            error: "Limit reached",
                            code: "LIMIT_REACHED",
                            limitType: options.checkLimit,
                            current: usage.current,
                            limit: usage.limit,
                            currentTier: subscriptionTier,
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
