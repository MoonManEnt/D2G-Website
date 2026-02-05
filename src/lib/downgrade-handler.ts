import prisma from "@/lib/prisma";
import { SubscriptionTier } from "@/types";
import { SUBSCRIPTION_LIMITS } from "./api-middleware";

/**
 * Check if an organization is in overflow state for any resource
 */
export async function checkOverflowState(
  organizationId: string,
  tier: SubscriptionTier | string
): Promise<{
  isOverLimit: boolean;
  overflows: Array<{ resource: string; current: number; limit: number }>;
}> {
  const limits = SUBSCRIPTION_LIMITS[tier as SubscriptionTier] || SUBSCRIPTION_LIMITS[SubscriptionTier.FREE];
  const overflows: Array<{ resource: string; current: number; limit: number }> = [];

  // Check active clients
  if (limits.clients.total !== -1) {
    const clientCount = await prisma.client.count({
      where: { organizationId, isActive: true },
    });
    if (clientCount > limits.clients.total) {
      overflows.push({ resource: "clients", current: clientCount, limit: limits.clients.total });
    }
  }

  // Check team seats
  if (limits.teamSeats.total !== -1) {
    const seatCount = await prisma.user.count({
      where: { organizationId, isActive: true },
    });
    if (seatCount > limits.teamSeats.total) {
      overflows.push({ resource: "teamSeats", current: seatCount, limit: limits.teamSeats.total });
    }
  }

  return { isOverLimit: overflows.length > 0, overflows };
}

/**
 * Check if a creation action should be blocked due to limits
 */
export function shouldBlockCreation(
  current: number,
  limit: number
): boolean {
  if (limit === -1) return false; // Unlimited
  return current >= limit;
}
