// ============================================================================
// DISPUTE2GO - Utility Formatters
// Common formatting and display utilities
// ============================================================================

import type { CRA, FlowType } from '@/types';

// ============================================================================
// Date Formatters
// ============================================================================

/**
 * Format a date for display (e.g., "Jan 15, 2024")
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a date with time (e.g., "Jan 15, 2024, 3:45 PM")
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Format a date in ISO format (e.g., "2024-01-15")
 */
export function formatISODate(date: string | Date | null | undefined): string {
  if (!date) return '';
  return new Date(date).toISOString().split('T')[0];
}

/**
 * Format relative time (e.g., "2 days ago", "in 3 days")
 */
export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return '';

  const now = new Date();
  const target = new Date(date);
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 0) return `in ${diffDays} days`;
  return `${Math.abs(diffDays)} days ago`;
}

/**
 * Calculate days until deadline
 */
export function daysUntilDeadline(sentDate: string | Date | null | undefined, days: number = 30): number {
  if (!sentDate) return -1;

  const sent = new Date(sentDate);
  const deadline = new Date(sent);
  deadline.setDate(deadline.getDate() + days);
  const now = new Date();
  const diff = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

/**
 * Calculate letter date (backdated for Round 1)
 */
export function calculateLetterDate(round: number): string {
  const date = new Date();
  if (round === 1) {
    date.setDate(date.getDate() - 30);
  }
  return date.toISOString().split('T')[0];
}

/**
 * Get deadline date from sent date
 */
export function getDeadlineDate(sentDate: string | Date | null | undefined, days: number = 30): Date | null {
  if (!sentDate) return null;

  const sent = new Date(sentDate);
  const deadline = new Date(sent);
  deadline.setDate(deadline.getDate() + days);
  return deadline;
}

// ============================================================================
// Currency Formatters
// ============================================================================

/**
 * Format currency (e.g., "$1,234")
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format currency with cents (e.g., "$1,234.56")
 */
export function formatCurrencyWithCents(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ============================================================================
// Number Formatters
// ============================================================================

/**
 * Format number with commas (e.g., "1,234,567")
 */
export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '0';
  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Format percentage (e.g., "85%")
 */
export function formatPercentage(value: number | null | undefined, decimals: number = 0): string {
  if (value === null || value === undefined) return '0%';
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format file size (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}

// ============================================================================
// CRA Configuration
// ============================================================================

export interface CRAConfig {
  bg: string;
  text: string;
  name: string;
  fullName: string;
  address: string;
  phone: string;
}

const CRA_CONFIGS: Record<CRA, CRAConfig> = {
  TRANSUNION: {
    bg: 'rgba(14, 165, 233, 0.15)',
    text: '#0ea5e9',
    name: 'TransUnion',
    fullName: 'TransUnion LLC',
    address: 'P.O. Box 2000, Chester, PA 19016-2000',
    phone: '1-800-916-8800',
  },
  EXPERIAN: {
    bg: 'rgba(59, 130, 246, 0.15)',
    text: '#3b82f6',
    name: 'Experian',
    fullName: 'Experian Information Solutions, Inc.',
    address: 'P.O. Box 4500, Allen, TX 75013',
    phone: '1-888-397-3742',
  },
  EQUIFAX: {
    bg: 'rgba(239, 68, 68, 0.15)',
    text: '#ef4444',
    name: 'Equifax',
    fullName: 'Equifax Information Services LLC',
    address: 'P.O. Box 740256, Atlanta, GA 30374-0256',
    phone: '1-800-685-1111',
  },
};

/**
 * Get CRA color configuration
 */
export function getCRAColor(cra: CRA | string): CRAConfig {
  const key = cra.toUpperCase() as CRA;
  return CRA_CONFIGS[key] || CRA_CONFIGS.TRANSUNION;
}

/**
 * Get CRA display name
 */
export function getCRADisplayName(cra: CRA | string): string {
  return getCRAColor(cra).name;
}

// ============================================================================
// Priority Configuration
// ============================================================================

export interface PriorityConfig {
  color: string;
  bg: string;
  label: string;
  icon: string;
}

const PRIORITY_CONFIGS: Record<string, PriorityConfig> = {
  URGENT: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', label: 'Urgent', icon: 'AlertTriangle' },
  HIGH: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', label: 'High', icon: 'ArrowUp' },
  STANDARD: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', label: 'Standard', icon: 'Minus' },
  LOW: { color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)', label: 'Low', icon: 'ArrowDown' },
};

/**
 * Get priority configuration
 */
export function getPriorityConfig(priority: string): PriorityConfig {
  return PRIORITY_CONFIGS[priority.toUpperCase()] || PRIORITY_CONFIGS.STANDARD;
}

// ============================================================================
// Stage Configuration
// ============================================================================

export interface StageConfig {
  color: string;
  label: string;
  progress: number;
  description?: string;
}

const STAGE_CONFIGS: Record<string, StageConfig> = {
  INTAKE: { color: '#94a3b8', label: 'Intake', progress: 10, description: 'New client onboarding' },
  ANALYSIS: { color: '#8b5cf6', label: 'Analysis', progress: 20, description: 'Credit report analysis' },
  ROUND_1: { color: '#3b82f6', label: 'Round 1', progress: 30, description: 'Initial dispute round' },
  ROUND_2: { color: '#0ea5e9', label: 'Round 2', progress: 45, description: 'Second dispute round' },
  ROUND_3: { color: '#f59e0b', label: 'Round 3', progress: 60, description: 'Third dispute round' },
  ROUND_4: { color: '#ef4444', label: 'Round 4', progress: 75, description: 'Fourth dispute round' },
  AWAITING_RESPONSE: { color: '#a855f7', label: 'Awaiting Response', progress: 50, description: 'Waiting for CRA response' },
  MAINTENANCE: { color: '#10b981', label: 'Maintenance', progress: 90, description: 'Ongoing maintenance' },
  COMPLETED: { color: '#10b981', label: 'Completed', progress: 100, description: 'Case completed' },
};

/**
 * Get stage configuration
 */
export function getStageConfig(stage: string): StageConfig {
  return STAGE_CONFIGS[stage.toUpperCase()] || STAGE_CONFIGS.INTAKE;
}

// ============================================================================
// Flow Configuration
// ============================================================================

export interface FlowConfig {
  color: string;
  label: string;
  maxRounds: number;
  description?: string;
}

const FLOW_CONFIGS: Record<FlowType, FlowConfig> = {
  ACCURACY: { color: '#3b82f6', label: 'Accuracy', maxRounds: 11, description: 'Dispute inaccurate information' },
  COLLECTION: { color: '#ef4444', label: 'Collection', maxRounds: 12, description: 'Challenge collection accounts' },
  CONSENT: { color: '#a855f7', label: 'Consent', maxRounds: 3, description: 'Challenge unauthorized inquiries' },
  COMBO: { color: '#f59e0b', label: 'Combo', maxRounds: 12, description: 'Combined dispute strategy' },
};

/**
 * Get flow configuration
 */
export function getFlowConfig(flow: FlowType | string): FlowConfig {
  const key = flow.toUpperCase() as FlowType;
  return FLOW_CONFIGS[key] || FLOW_CONFIGS.ACCURACY;
}

// ============================================================================
// Credit Score Utilities
// ============================================================================

export interface ScoreConfig {
  color: string;
  label: string;
  range: string;
}

/**
 * Get score color based on value
 */
export function getScoreColor(score: number | null | undefined): string {
  if (!score || score <= 0) return '#64748b'; // gray
  if (score >= 740) return '#10b981'; // Excellent - green
  if (score >= 670) return '#22c55e'; // Good - light green
  if (score >= 580) return '#f59e0b'; // Fair - amber
  return '#ef4444'; // Poor - red
}

/**
 * Get score configuration
 */
export function getScoreConfig(score: number | null | undefined): ScoreConfig {
  if (!score || score <= 0) {
    return { color: '#64748b', label: 'Unknown', range: 'N/A' };
  }
  if (score >= 740) {
    return { color: '#10b981', label: 'Excellent', range: '740-850' };
  }
  if (score >= 670) {
    return { color: '#22c55e', label: 'Good', range: '670-739' };
  }
  if (score >= 580) {
    return { color: '#f59e0b', label: 'Fair', range: '580-669' };
  }
  return { color: '#ef4444', label: 'Poor', range: '300-579' };
}

/**
 * Calculate average credit score from multiple scores
 */
export function calculateAverageScore(scores: {
  experian?: number;
  equifax?: number;
  transunion?: number;
} | null | undefined): number {
  if (!scores) return 0;

  const values = [scores.experian, scores.equifax, scores.transunion]
    .filter((v): v is number => typeof v === 'number' && v > 0);

  if (values.length === 0) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

// ============================================================================
// Status Formatters
// ============================================================================

export interface StatusConfig {
  color: string;
  bg: string;
  label: string;
}

const DISPUTE_STATUS_CONFIGS: Record<string, StatusConfig> = {
  DRAFT: { color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)', label: 'Draft' },
  PENDING_REVIEW: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', label: 'Pending Review' },
  APPROVED: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', label: 'Approved' },
  SENT: { color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)', label: 'Sent' },
  RESPONDED: { color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.15)', label: 'Responded' },
  RESOLVED: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', label: 'Resolved' },
  ESCALATED: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', label: 'Escalated' },
};

/**
 * Get dispute status configuration
 */
export function getDisputeStatusConfig(status: string): StatusConfig {
  return DISPUTE_STATUS_CONFIGS[status.toUpperCase()] || DISPUTE_STATUS_CONFIGS.DRAFT;
}

const RESPONSE_TYPE_CONFIGS: Record<string, StatusConfig> = {
  DELETED: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', label: 'Deleted' },
  VERIFIED: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', label: 'Verified' },
  UPDATED: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', label: 'Updated' },
  PENDING: { color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)', label: 'Pending' },
  NO_RESPONSE: { color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)', label: 'No Response' },
};

/**
 * Get response type configuration
 */
export function getResponseTypeConfig(responseType: string): StatusConfig {
  return RESPONSE_TYPE_CONFIGS[responseType.toUpperCase()] || RESPONSE_TYPE_CONFIGS.PENDING;
}

// ============================================================================
// String Formatters
// ============================================================================

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string | null | undefined, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format phone number (e.g., "(555) 123-4567")
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

/**
 * Format SSN last 4 (e.g., "XXX-XX-1234")
 */
export function formatSSN4(ssn4: string | null | undefined): string {
  if (!ssn4) return 'XXX-XX-XXXX';
  return `XXX-XX-${ssn4}`;
}

/**
 * Get initials from name
 */
export function getInitials(firstName: string | null | undefined, lastName: string | null | undefined): string {
  const first = firstName?.[0] || '';
  const last = lastName?.[0] || '';
  return `${first}${last}`.toUpperCase();
}

/**
 * Format full name
 */
export function formatFullName(firstName: string | null | undefined, lastName: string | null | undefined): string {
  return `${firstName || ''} ${lastName || ''}`.trim();
}

/**
 * Capitalize first letter
 */
export function capitalize(text: string | null | undefined): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Convert to title case
 */
export function toTitleCase(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ============================================================================
// Account Formatters
// ============================================================================

/**
 * Format account balance display
 */
export function formatAccountBalance(balance: number | null | undefined, pastDue: number | null | undefined): string {
  if (!balance && !pastDue) return '$0';

  const parts: string[] = [];
  if (balance) parts.push(`Balance: ${formatCurrency(balance)}`);
  if (pastDue && pastDue > 0) parts.push(`Past Due: ${formatCurrency(pastDue)}`);

  return parts.join(' | ') || '$0';
}

/**
 * Format masked account number
 */
export function formatMaskedAccount(accountId: string | null | undefined): string {
  if (!accountId) return '****';
  if (accountId.length <= 4) return accountId;
  return `****${accountId.slice(-4)}`;
}

// ============================================================================
// Export default
// ============================================================================

export default {
  formatDate,
  formatDateTime,
  formatISODate,
  formatRelativeTime,
  daysUntilDeadline,
  calculateLetterDate,
  getDeadlineDate,
  formatCurrency,
  formatCurrencyWithCents,
  formatNumber,
  formatPercentage,
  formatFileSize,
  getCRAColor,
  getCRADisplayName,
  getPriorityConfig,
  getStageConfig,
  getFlowConfig,
  getScoreColor,
  getScoreConfig,
  calculateAverageScore,
  getDisputeStatusConfig,
  getResponseTypeConfig,
  truncate,
  formatPhoneNumber,
  formatSSN4,
  getInitials,
  formatFullName,
  capitalize,
  toTitleCase,
  formatAccountBalance,
  formatMaskedAccount,
};
