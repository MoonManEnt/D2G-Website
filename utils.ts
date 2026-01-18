import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { CRA, ConfidenceLevel, FlowType, DisputeStatus, ApprovalStatus } from "@/types";

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency values
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

/**
 * Format date with time
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  return formatDate(d);
}

/**
 * Generate account fingerprint for matching across reports
 */
export function generateFingerprint(creditorName: string, maskedAccountId: string): string {
  const normalized = `${creditorName.toLowerCase().trim()}:${maskedAccountId.replace(/\s/g, "")}`;
  // Simple hash for fingerprinting
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get CRA display info
 */
export const CRA_INFO: Record<CRA, { name: string; color: string; bgColor: string }> = {
  [CRA.EXPERIAN]: { name: "Experian", color: "text-cra-experian", bgColor: "bg-blue-900" },
  [CRA.EQUIFAX]: { name: "Equifax", color: "text-cra-equifax", bgColor: "bg-red-900" },
  [CRA.TRANSUNION]: { name: "TransUnion", color: "text-cra-transunion", bgColor: "bg-sky-800" },
};

/**
 * Get confidence level display info
 */
export const CONFIDENCE_INFO: Record<ConfidenceLevel, { label: string; color: string; bgColor: string }> = {
  [ConfidenceLevel.HIGH]: { label: "High", color: "text-confidence-high", bgColor: "bg-green-100" },
  [ConfidenceLevel.MEDIUM]: { label: "Medium", color: "text-confidence-medium", bgColor: "bg-yellow-100" },
  [ConfidenceLevel.LOW]: { label: "Low", color: "text-confidence-low", bgColor: "bg-red-100" },
};

/**
 * Get flow type display info
 */
export const FLOW_INFO: Record<FlowType, { name: string; description: string; maxRounds: number }> = {
  [FlowType.ACCURACY]: { name: "Accuracy", description: "For factual inaccuracies on credit reports", maxRounds: 12 },
  [FlowType.COLLECTION]: { name: "Collection", description: "For collection accounts and debt validation", maxRounds: 10 },
  [FlowType.CONSENT]: { name: "Consent", description: "For permissible purpose and consent issues", maxRounds: 4 },
  [FlowType.COMBO]: { name: "Combo", description: "Combined accuracy and collection approach", maxRounds: 12 },
};

/**
 * Get dispute status display info
 */
export const DISPUTE_STATUS_INFO: Record<DisputeStatus, { label: string; color: string; bgColor: string }> = {
  [DisputeStatus.DRAFT]: { label: "Draft", color: "text-gray-600", bgColor: "bg-gray-100" },
  [DisputeStatus.PENDING_REVIEW]: { label: "Pending Review", color: "text-yellow-700", bgColor: "bg-yellow-100" },
  [DisputeStatus.APPROVED]: { label: "Approved", color: "text-blue-700", bgColor: "bg-blue-100" },
  [DisputeStatus.SENT]: { label: "Sent", color: "text-purple-700", bgColor: "bg-purple-100" },
  [DisputeStatus.RESPONDED]: { label: "Responded", color: "text-indigo-700", bgColor: "bg-indigo-100" },
  [DisputeStatus.RESOLVED]: { label: "Resolved", color: "text-green-700", bgColor: "bg-green-100" },
  [DisputeStatus.ESCALATED]: { label: "Escalated", color: "text-red-700", bgColor: "bg-red-100" },
};

/**
 * Get approval status display info
 */
export const APPROVAL_STATUS_INFO: Record<ApprovalStatus, { label: string; color: string; bgColor: string }> = {
  [ApprovalStatus.DRAFT]: { label: "Draft", color: "text-gray-600", bgColor: "bg-gray-100" },
  [ApprovalStatus.PENDING_REVIEW]: { label: "Pending Review", color: "text-yellow-700", bgColor: "bg-yellow-100" },
  [ApprovalStatus.APPROVED]: { label: "Approved", color: "text-green-700", bgColor: "bg-green-100" },
  [ApprovalStatus.REJECTED]: { label: "Rejected", color: "text-red-700", bgColor: "bg-red-100" },
};

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Generate initials from name
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Slugify a string
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Generate a random string
 */
export function generateRandomString(length: number = 16): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if an object is empty
 */
export function isEmpty(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).length === 0;
}

/**
 * Group array by key
 */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const groupKey = String(item[key]);
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {} as Record<string, T[]>);
}
