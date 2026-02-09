/**
 * Unified Dispute Creation Types
 *
 * Shared types for all dispute creation flows:
 * - human_first: Human-first story-driven letters (RECOMMENDED)
 * - simple: Template-based dispute creation
 * - ai: AI-powered strategy and letter generation
 * - amelia: AMELIA doctrine letter generation
 */

// Use string literal types to avoid enum compatibility issues
// These match the values stored in the database and used across the codebase
export type CRA = "TRANSUNION" | "EXPERIAN" | "EQUIFAX";
export type DisputeFlow = "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO";

/**
 * Dispute creation type determines which letter generation strategy to use
 *
 * - "human_first": Story-first, simple language, legal at the end (RECOMMENDED)
 * - "amelia": Full AMELIA doctrine with backdating
 * - "ai": AI rules engine with strategy
 * - "simple": Basic template-based
 */
export type DisputeCreationType = "simple" | "ai" | "amelia" | "human_first";

/**
 * Base request for all dispute creation types
 */
export interface BaseDisputeRequest {
  clientId: string;
  accountIds: string[];
  cra?: CRA; // Required for simple, optional for AI (auto-determined)
  flow?: DisputeFlow; // Required for simple, optional for AI (auto-determined)
}

/**
 * Simple template-based dispute creation request
 */
export interface SimpleDisputeRequest extends BaseDisputeRequest {
  type: "simple";
  cra: CRA; // Required
  flow: DisputeFlow; // Required
}

/**
 * AI-powered dispute creation request
 */
export interface AIDisputeRequest extends BaseDisputeRequest {
  type: "ai";
  options?: {
    useAI?: boolean;
    maxAccountsPerBatch?: number;
    focusBureaus?: CRA[];
    previewOnly?: boolean;
  };
}

/**
 * AMELIA doctrine dispute creation request
 *
 * Note: AMELIA typically operates on existing disputes,
 * but can also create new ones with full doctrine applied
 */
export interface AmeliaDisputeRequest extends BaseDisputeRequest {
  type: "amelia";
  cra: CRA; // Required
  flow?: DisputeFlow; // Optional, AMELIA can auto-determine
  regenerate?: boolean;
}

/**
 * Human-First dispute creation request (RECOMMENDED)
 *
 * Creates letters that:
 * - Lead with personal story/impact
 * - Use simple, 8th-grade language
 * - Put legal stuff at the end as a footer
 * - Sound like a real person wrote them
 */
export interface HumanFirstDisputeRequest extends BaseDisputeRequest {
  type: "human_first";
  cra: CRA; // Required
  flow?: DisputeFlow; // Optional, auto-determined from accounts
}

/**
 * Union type for all dispute creation requests
 */
export type UnifiedDisputeRequest =
  | SimpleDisputeRequest
  | AIDisputeRequest
  | AmeliaDisputeRequest
  | HumanFirstDisputeRequest;

/**
 * Client data needed for dispute letter generation
 */
export interface DisputeClientData {
  id: string;
  firstName: string;
  lastName: string;
  addressLine1: string | null;
  addressLine2?: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  ssnLast4: string | null;
  dateOfBirth: Date | null;
  phone?: string | null;
}

/**
 * Account data with detected issues for dispute
 */
export interface DisputeAccountData {
  id: string;
  creditorName: string;
  maskedAccountId: string | null;
  cra: string;
  accountType: string | null;
  accountStatus: string | null;
  balance: number | null;
  pastDue: number | null;
  creditLimit: number | null;
  dateOpened: Date | null;
  dateReported: Date | null;
  paymentStatus: string | null;
  confidenceScore: number | null;
  detectedIssues: string | null; // JSON string
  isDisputable: boolean | null;
}

/**
 * Parsed detected issue structure
 */
export interface DetectedIssue {
  code: string;
  description: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  suggestedFlow?: DisputeFlow;
  fcraSection?: string;
}

/**
 * Account formatted for letter generation
 */
export interface AccountForLetter {
  creditorName: string;
  accountNumber: string;
  accountType?: string;
  balance?: string;
  reason: string;
  issues: Array<{
    code: string;
    description: string;
  }>;
}

/**
 * AI strategy metadata stored in Dispute.aiStrategy
 */
export interface AIStrategyMetadata {
  type: DisputeCreationType;
  generatedAt: string;
  version: string;

  // Simple-specific
  flow?: DisputeFlow;
  round?: number;

  // AI-specific
  recommendations?: Array<{
    accountId: string;
    priority: number;
    reasoning: string;
    successRate: number;
  }>;
  crossBureauPlan?: unknown;
  timeline?: unknown;
  overallStrategy?: string;

  // AMELIA-specific
  tone?: string;
  isBackdated?: boolean;
  backdatedDays?: number;
  letterDate?: string;
  effectiveFlow?: string;
  statute?: string;
  includesScreenshots?: boolean;
  personalInfoDisputed?: {
    previousNames: string[];
    previousAddresses: string[];
    hardInquiries: string[];
  };
  ameliaVersion?: string;

  // Human-First / Full AI specific
  storyUsed?: string;
  letterStyle?: "HUMAN_FIRST" | "PROFESSIONAL" | "FULL_AI";
}

/**
 * Created dispute response item
 */
export interface CreatedDisputeInfo {
  disputeId: string;
  cra: string;
  flow: string;
  round: number;
  itemCount: number;
  documentId: string;
  status: string;
}

/**
 * Unified dispute creation response
 */
export interface UnifiedDisputeResponse {
  success: boolean;
  type: DisputeCreationType;
  disputes: CreatedDisputeInfo[];
  strategy?: {
    overallStrategy?: string;
    timeline?: unknown;
    crossBureauPlan?: unknown;
    recommendations?: Array<{
      creditorName: string;
      priority: number;
      estimatedSuccessRate: string;
    }>;
  };
  metadata?: {
    letterDate?: string;
    isBackdated?: boolean;
    backdatedDays?: number;
    tone?: string;
    ameliaVersion?: string;
    // Human-First / Full AI specific
    letterStyle?: "HUMAN_FIRST" | "PROFESSIONAL" | "FULL_AI";
    storyUsed?: string;
  };
  warnings?: string[];
  message?: string;
}

/**
 * Error response structure
 */
export interface DisputeCreationError {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}
