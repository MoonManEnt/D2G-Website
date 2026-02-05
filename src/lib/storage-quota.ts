import prisma from "@/lib/prisma";
import { SubscriptionTier } from "@/types";
import { SUBSCRIPTION_LIMITS } from "./api-middleware";
import { createLogger } from "./logger";

const log = createLogger("storage-quota");

/**
 * Update storage usage after file upload or deletion
 */
export async function trackStorageUsage(
  organizationId: string,
  fileSizeBytes: number,
  operation: "add" | "remove"
): Promise<void> {
  try {
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        storageUsedBytes: {
          increment: operation === "add" ? fileSizeBytes : -fileSizeBytes,
        },
      },
    });
  } catch (error) {
    log.error({ err: error, organizationId, fileSizeBytes, operation }, "Failed to track storage usage");
  }
}

/**
 * Check if an upload would exceed the storage quota
 */
export async function checkStorageQuota(
  organizationId: string,
  tier: SubscriptionTier | string,
  fileSizeBytes: number
): Promise<{ allowed: boolean; currentBytes: number; quotaBytes: number }> {
  const limits = SUBSCRIPTION_LIMITS[tier as SubscriptionTier] || SUBSCRIPTION_LIMITS[SubscriptionTier.FREE];
  const quotaBytes = limits.storage.bytes;

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { storageUsedBytes: true },
  });

  const currentBytes = Number(org?.storageUsedBytes || 0);

  return {
    allowed: (currentBytes + fileSizeBytes) <= quotaBytes,
    currentBytes,
    quotaBytes,
  };
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${sizes[i]}`;
}
