/**
 * Dispute2Go Diff Engine
 * 
 * Compares credit reports month-over-month to track changes.
 * 
 * Implements Recommendation #2:
 * - Fingerprint matching (creditor name + masked account ID hash)
 * - Tracks: accountStatus, balance, pastDue, creditLimit, disputeComment
 * - Handles deleted accounts
 */

import { 
  DiffSummary, 
  DiffChangeDetail, 
  DiffMatch,
  DIFF_TRACKED_FIELDS,
  CRA 
} from "@/types";
import { generateFingerprint } from "./utils";

// ============================================================================
// TYPES
// ============================================================================

interface AccountForDiff {
  id: string;
  creditorName: string;
  maskedAccountId: string;
  cra: CRA;
  fingerprint: string;
  accountStatus: string;
  balance: number | null;
  pastDue: number | null;
  creditLimit: number | null;
  disputeComment: string | null;
}

interface DiffConfig {
  // Whether to use fuzzy matching as fallback
  useFuzzyMatching: boolean;
  // Minimum similarity score for fuzzy match (0-1)
  fuzzyThreshold: number;
}

const DEFAULT_CONFIG: DiffConfig = {
  useFuzzyMatching: true,
  fuzzyThreshold: 0.8,
};

// ============================================================================
// MAIN DIFF FUNCTION
// ============================================================================

export function computeDiff(
  priorAccounts: AccountForDiff[],
  newAccounts: AccountForDiff[],
  config: DiffConfig = DEFAULT_CONFIG
): DiffSummary {
  const changes: DiffChangeDetail[] = [];
  const matchedPriorIds = new Set<string>();
  const matchedNewIds = new Set<string>();
  
  // Phase 1: Exact fingerprint matching
  const fingerprintMatches = matchByFingerprint(priorAccounts, newAccounts);
  
  for (const match of fingerprintMatches) {
    matchedPriorIds.add(match.oldAccountId);
    matchedNewIds.add(match.newAccountId);
    
    const priorAccount = priorAccounts.find(a => a.id === match.oldAccountId)!;
    const newAccount = newAccounts.find(a => a.id === match.newAccountId)!;
    
    const changedFields = detectChanges(priorAccount, newAccount);
    
    if (Object.keys(changedFields).length > 0) {
      changes.push({
        changeType: "MODIFIED",
        oldAccountId: match.oldAccountId,
        newAccountId: match.newAccountId,
        changedFields,
      });
    } else {
      changes.push({
        changeType: "UNCHANGED",
        oldAccountId: match.oldAccountId,
        newAccountId: match.newAccountId,
      });
    }
  }
  
  // Phase 2: Creditor + Account ID matching (for accounts with different fingerprints)
  const unmatchedPrior = priorAccounts.filter(a => !matchedPriorIds.has(a.id));
  const unmatchedNew = newAccounts.filter(a => !matchedNewIds.has(a.id));
  
  const creditorMatches = matchByCreditorAccount(unmatchedPrior, unmatchedNew);
  
  for (const match of creditorMatches) {
    matchedPriorIds.add(match.oldAccountId);
    matchedNewIds.add(match.newAccountId);
    
    const priorAccount = priorAccounts.find(a => a.id === match.oldAccountId)!;
    const newAccount = newAccounts.find(a => a.id === match.newAccountId)!;
    
    const changedFields = detectChanges(priorAccount, newAccount);
    
    changes.push({
      changeType: Object.keys(changedFields).length > 0 ? "MODIFIED" : "UNCHANGED",
      oldAccountId: match.oldAccountId,
      newAccountId: match.newAccountId,
      changedFields: Object.keys(changedFields).length > 0 ? changedFields : undefined,
    });
  }
  
  // Phase 3: Fuzzy matching (optional)
  if (config.useFuzzyMatching) {
    const stillUnmatchedPrior = priorAccounts.filter(a => !matchedPriorIds.has(a.id));
    const stillUnmatchedNew = newAccounts.filter(a => !matchedNewIds.has(a.id));
    
    const fuzzyMatches = matchByFuzzy(stillUnmatchedPrior, stillUnmatchedNew, config.fuzzyThreshold);
    
    for (const match of fuzzyMatches) {
      matchedPriorIds.add(match.oldAccountId);
      matchedNewIds.add(match.newAccountId);
      
      const priorAccount = priorAccounts.find(a => a.id === match.oldAccountId)!;
      const newAccount = newAccounts.find(a => a.id === match.newAccountId)!;
      
      const changedFields = detectChanges(priorAccount, newAccount);
      
      changes.push({
        changeType: Object.keys(changedFields).length > 0 ? "MODIFIED" : "UNCHANGED",
        oldAccountId: match.oldAccountId,
        newAccountId: match.newAccountId,
        changedFields: Object.keys(changedFields).length > 0 ? changedFields : undefined,
      });
    }
  }
  
  // Phase 4: Identify removed accounts (in prior but not matched)
  const removedAccounts = priorAccounts.filter(a => !matchedPriorIds.has(a.id));
  for (const account of removedAccounts) {
    changes.push({
      changeType: "REMOVED",
      oldAccountId: account.id,
    });
  }
  
  // Phase 5: Identify added accounts (in new but not matched)
  const addedAccounts = newAccounts.filter(a => !matchedNewIds.has(a.id));
  for (const account of addedAccounts) {
    changes.push({
      changeType: "ADDED",
      newAccountId: account.id,
    });
  }
  
  // Compute summary
  return {
    accountsAdded: changes.filter(c => c.changeType === "ADDED").length,
    accountsRemoved: changes.filter(c => c.changeType === "REMOVED").length,
    accountsChanged: changes.filter(c => c.changeType === "MODIFIED").length,
    accountsUnchanged: changes.filter(c => c.changeType === "UNCHANGED").length,
    changes,
  };
}

// ============================================================================
// MATCHING FUNCTIONS
// ============================================================================

function matchByFingerprint(
  priorAccounts: AccountForDiff[],
  newAccounts: AccountForDiff[]
): DiffMatch[] {
  const matches: DiffMatch[] = [];
  
  for (const priorAccount of priorAccounts) {
    // Find matching account in new report with same fingerprint and CRA
    const match = newAccounts.find(
      newAccount => 
        newAccount.fingerprint === priorAccount.fingerprint &&
        newAccount.cra === priorAccount.cra
    );
    
    if (match) {
      matches.push({
        oldAccountId: priorAccount.id,
        newAccountId: match.id,
        matchScore: 1.0,
        matchMethod: "FINGERPRINT",
      });
    }
  }
  
  return matches;
}

function matchByCreditorAccount(
  priorAccounts: AccountForDiff[],
  newAccounts: AccountForDiff[]
): DiffMatch[] {
  const matches: DiffMatch[] = [];
  const usedNewIds = new Set<string>();
  
  for (const priorAccount of priorAccounts) {
    // Find matching account by creditor name and masked account ID
    const match = newAccounts.find(
      newAccount => 
        !usedNewIds.has(newAccount.id) &&
        newAccount.cra === priorAccount.cra &&
        normalizeCreditorName(newAccount.creditorName) === normalizeCreditorName(priorAccount.creditorName) &&
        newAccount.maskedAccountId === priorAccount.maskedAccountId
    );
    
    if (match) {
      usedNewIds.add(match.id);
      matches.push({
        oldAccountId: priorAccount.id,
        newAccountId: match.id,
        matchScore: 0.95,
        matchMethod: "CREDITOR_ACCOUNT",
      });
    }
  }
  
  return matches;
}

function matchByFuzzy(
  priorAccounts: AccountForDiff[],
  newAccounts: AccountForDiff[],
  threshold: number
): DiffMatch[] {
  const matches: DiffMatch[] = [];
  const usedNewIds = new Set<string>();
  
  for (const priorAccount of priorAccounts) {
    let bestMatch: { account: AccountForDiff; score: number } | null = null;
    
    for (const newAccount of newAccounts) {
      if (usedNewIds.has(newAccount.id)) continue;
      if (newAccount.cra !== priorAccount.cra) continue;
      
      const score = calculateSimilarity(priorAccount, newAccount);
      
      if (score >= threshold && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { account: newAccount, score };
      }
    }
    
    if (bestMatch) {
      usedNewIds.add(bestMatch.account.id);
      matches.push({
        oldAccountId: priorAccount.id,
        newAccountId: bestMatch.account.id,
        matchScore: bestMatch.score,
        matchMethod: "FUZZY",
      });
    }
  }
  
  return matches;
}

// ============================================================================
// CHANGE DETECTION
// ============================================================================

function detectChanges(
  priorAccount: AccountForDiff,
  newAccount: AccountForDiff
): Record<string, { old: unknown; new: unknown }> {
  const changes: Record<string, { old: unknown; new: unknown }> = {};
  
  for (const field of DIFF_TRACKED_FIELDS) {
    const oldValue = priorAccount[field as keyof AccountForDiff];
    const newValue = newAccount[field as keyof AccountForDiff];
    
    if (!areEqual(oldValue, newValue)) {
      changes[field] = { old: oldValue, new: newValue };
    }
  }
  
  return changes;
}

function areEqual(a: unknown, b: unknown): boolean {
  // Handle null/undefined
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  
  // Handle numbers (with tolerance for floating point)
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) < 0.01;
  }
  
  // Handle strings (case-insensitive for status)
  if (typeof a === "string" && typeof b === "string") {
    return a.toLowerCase().trim() === b.toLowerCase().trim();
  }
  
  return a === b;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function normalizeCreditorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function calculateSimilarity(a: AccountForDiff, b: AccountForDiff): number {
  let score = 0;
  let maxScore = 0;
  
  // Creditor name similarity (40%)
  maxScore += 40;
  const nameA = normalizeCreditorName(a.creditorName);
  const nameB = normalizeCreditorName(b.creditorName);
  score += levenshteinSimilarity(nameA, nameB) * 40;
  
  // Account ID similarity (30%)
  maxScore += 30;
  const idA = a.maskedAccountId.replace(/[^0-9X*]/gi, "");
  const idB = b.maskedAccountId.replace(/[^0-9X*]/gi, "");
  score += levenshteinSimilarity(idA, idB) * 30;
  
  // Balance similarity (15%)
  maxScore += 15;
  if (a.balance != null && b.balance != null) {
    const balanceRatio = Math.min(a.balance, b.balance) / Math.max(a.balance, b.balance);
    score += balanceRatio * 15;
  } else if (a.balance == null && b.balance == null) {
    score += 15;
  }
  
  // Credit limit similarity (15%)
  maxScore += 15;
  if (a.creditLimit != null && b.creditLimit != null) {
    const limitRatio = Math.min(a.creditLimit, b.creditLimit) / Math.max(a.creditLimit, b.creditLimit);
    score += limitRatio * 15;
  } else if (a.creditLimit == null && b.creditLimit == null) {
    score += 15;
  }
  
  return score / maxScore;
}

function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  const distance = matrix[b.length][a.length];
  const maxLength = Math.max(a.length, b.length);
  
  return 1 - distance / maxLength;
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { AccountForDiff, DiffConfig };
