/**
 * Account Lock Service
 *
 * Manages account locking during active disputes to prevent:
 * 1. Same account in multiple concurrent disputes
 * 2. Race conditions when creating disputes
 *
 * Accounts are locked when a dispute is SENT and unlocked when RESOLVED or deleted.
 */

import prisma from "@/lib/prisma";

export type LockSystem = "DISPUTE";

export interface AccountLockInfo {
  accountId: string;
  creditorName: string;
  isLocked: boolean;
  lockedBy?: {
    disputeId: string;
    disputeCode?: string;
    system: LockSystem;
    status: string;
    cra: string;
    round: number;
    sentDate?: Date;
    responseDeadline?: Date;
  };
}

export interface LockResult {
  success: boolean;
  lockedAccounts: string[];
  failedAccounts: Array<{
    accountId: string;
    creditorName: string;
    reason: string;
    lockedBy: {
      disputeId: string;
      disputeCode?: string;
      system: LockSystem;
      status: string;
      cra: string;
      round: number;
    };
  }>;
}

/**
 * Check if accounts are available for dispute (not locked)
 *
 * Returns which accounts are available and which are locked with details.
 */
export async function checkAccountAvailability(
  accountIds: string[],
  cra: string,
  organizationId: string
): Promise<{
  available: string[];
  locked: AccountLockInfo[];
}> {
  // Fetch accounts with their lock status
  const accounts = await prisma.accountItem.findMany({
    where: {
      id: { in: accountIds },
      organizationId,
      cra,
    },
    select: {
      id: true,
      creditorName: true,
      isLockedInDispute: true,
      lockedByDisputeId: true,
      lockedBySystem: true,
      lockedAt: true,
    },
  });

  const available: string[] = [];
  const locked: AccountLockInfo[] = [];

  for (const account of accounts) {
    if (!account.isLockedInDispute) {
      available.push(account.id);
      continue;
    }

    // Fetch lock details from the appropriate system
    let lockDetails: AccountLockInfo["lockedBy"] | undefined;

    if (account.lockedByDisputeId) {
      const dispute = await prisma.dispute.findUnique({
        where: { id: account.lockedByDisputeId },
        select: {
          id: true,
          disputeCode: true,
          status: true,
          cra: true,
          round: true,
          sentDate: true,
          deadlineDate: true,
        },
      });

      if (dispute) {
        lockDetails = {
          disputeId: dispute.id,
          disputeCode: dispute.disputeCode || undefined,
          system: "DISPUTE",
          status: dispute.status,
          cra: dispute.cra,
          round: dispute.round,
          sentDate: dispute.sentDate || undefined,
          responseDeadline: dispute.deadlineDate || undefined,
        };
      }
    }

    locked.push({
      accountId: account.id,
      creditorName: account.creditorName,
      isLocked: true,
      lockedBy: lockDetails,
    });
  }

  return { available, locked };
}

/**
 * Lock accounts atomically when launching a dispute
 *
 * Uses database transaction with row-level checking to prevent race conditions.
 * Returns success/failure with details about which accounts couldn't be locked.
 */
export async function lockAccountsForDispute(
  accountIds: string[],
  disputeId: string,
  system: LockSystem,
  cra: string,
  organizationId: string
): Promise<LockResult> {
  return prisma.$transaction(async (tx) => {
    // First, check current lock status
    const accounts = await tx.accountItem.findMany({
      where: {
        id: { in: accountIds },
        organizationId,
        cra,
      },
      select: {
        id: true,
        creditorName: true,
        isLockedInDispute: true,
        lockedByDisputeId: true,
        lockedBySystem: true,
      },
    });

    const lockedAccounts: string[] = [];
    const failedAccounts: LockResult["failedAccounts"] = [];

    for (const account of accounts) {
      // Check if already locked by a DIFFERENT dispute
      if (account.isLockedInDispute && account.lockedByDisputeId !== disputeId) {
        // Account is locked by another dispute - collect details
        let lockInfo = {
          disputeId: account.lockedByDisputeId || "unknown",
          system: (account.lockedBySystem as LockSystem) || "DISPUTE",
          status: "UNKNOWN",
          cra,
          round: 0,
          disputeCode: undefined as string | undefined,
        };

        // Get more details about the locking dispute
        if (account.lockedByDisputeId) {
          const d = await tx.dispute.findUnique({
            where: { id: account.lockedByDisputeId },
            select: { status: true, round: true, disputeCode: true },
          });
          if (d) {
            lockInfo = {
              ...lockInfo,
              status: d.status,
              round: d.round,
              disputeCode: d.disputeCode || undefined,
            };
          }
        }

        failedAccounts.push({
          accountId: account.id,
          creditorName: account.creditorName,
          reason: `Account "${account.creditorName}" is already in an active dispute`,
          lockedBy: lockInfo,
        });
      } else {
        // Lock the account
        await tx.accountItem.update({
          where: { id: account.id },
          data: {
            isLockedInDispute: true,
            lockedByDisputeId: disputeId,
            lockedBySystem: system,
            lockedAt: new Date(),
          },
        });
        lockedAccounts.push(account.id);
      }
    }

    return {
      success: failedAccounts.length === 0,
      lockedAccounts,
      failedAccounts,
    };
  });
}

/**
 * Unlock accounts when dispute is resolved or deleted
 *
 * Only unlocks accounts that were locked by this specific dispute.
 */
export async function unlockAccountsForDispute(
  disputeId: string,
  system: LockSystem
): Promise<number> {
  const result = await prisma.accountItem.updateMany({
    where: {
      lockedByDisputeId: disputeId,
      lockedBySystem: system,
    },
    data: {
      isLockedInDispute: false,
      lockedByDisputeId: null,
      lockedBySystem: null,
      lockedAt: null,
    },
  });

  return result.count;
}

/**
 * Build user-friendly error message for locked accounts
 */
export function buildLockErrorMessage(
  failedAccounts: LockResult["failedAccounts"]
): string {
  if (failedAccounts.length === 0) return "";

  const details = failedAccounts.map((f) => {
    const ref = f.lockedBy.disputeCode || f.lockedBy.disputeId.slice(0, 8);
    return `• ${f.creditorName}: Locked by dispute ${ref} (Round ${f.lockedBy.round}, Status: ${f.lockedBy.status})`;
  });

  return `The following accounts cannot be added to this dispute:\n${details.join("\n")}`;
}

/**
 * Check for conflicts (accounts already in another dispute)
 */
export async function checkConflicts(
  accountIds: string[],
  cra: string,
  organizationId: string
): Promise<AccountLockInfo[]> {
  const { locked } = await checkAccountAvailability(accountIds, cra, organizationId);
  return locked;
}

/**
 * Force unlock an account (admin use only)
 *
 * Should only be used in exceptional circumstances.
 */
export async function forceUnlockAccount(
  accountId: string,
  organizationId: string
): Promise<boolean> {
  const result = await prisma.accountItem.updateMany({
    where: {
      id: accountId,
      organizationId,
      isLockedInDispute: true,
    },
    data: {
      isLockedInDispute: false,
      lockedByDisputeId: null,
      lockedBySystem: null,
      lockedAt: null,
    },
  });

  return result.count > 0;
}
