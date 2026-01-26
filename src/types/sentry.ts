/**
 * SENTRY DISPUTE TYPES
 *
 * Completely isolated type definitions for the Sentry Dispute system.
 * These types are NOT shared with the existing dispute system.
 *
 * DO NOT import from ./index.ts or any other dispute types.
 */

// =============================================================================
// CORE ENUMS & LITERALS
// =============================================================================

export type SentryCRA = "TRANSUNION" | "EQUIFAX" | "EXPERIAN";

export type SentryFlowType = "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO";

export type SentryDisputeStatus = "DRAFT" | "SENT" | "RESPONDED" | "RESOLVED";

export type SentryRound = 1 | 2 | 3 | 4;

export type SentryOutcome =
  | "DELETED"
  | "VERIFIED"
  | "UPDATED"
  | "NO_RESPONSE"
  | "STALL_LETTER"
  | "PENDING";

// =============================================================================
// E-OSCAR CODE TYPES
// =============================================================================

export type EOSCARCodePriority = "HIGH" | "MEDIUM" | "LOW";

export interface EOSCARCode {
  code: string;
  name: string;
  priority: EOSCARCodePriority;
  description: string;
  shortDescription?: string;
  triggerConditions: string[];
  requiredEvidence: string[];
  avoidWith: string[]; // Conflicting codes
  avoidWhen?: string[]; // Conditions when to avoid
  historicalSuccessRate?: number;
}

export interface EOSCARRecommendation {
  code: EOSCARCode;
  score: number; // 0-1 relevance score
  confidence: number; // 0-1 confidence level
  name: string; // Code name for display
  reasoning: string;
  evidenceAvailable: string[];
  evidenceMissing: string[];
}

// =============================================================================
// LEGAL CITATION TYPES
// =============================================================================

export type CitationApplicability = "CRA" | "FURNISHER" | "COLLECTOR";

export interface LegalCitation {
  statute: string;
  name: string; // Display name
  shortName: string;
  shortDescription: string;
  fullText: string;
  exampleLanguage?: string;
  applicableTo: CitationApplicability[];
  useFor: string[];
  neverUseFor: string[];
  commonMisuse?: string;
  caseSupport: CaseLaw[];
}

export interface CaseLaw {
  name: string;
  citation: string;
  holding?: string;
  useFor?: string;
  relevance?: string;
}

export interface InvalidCitation {
  statute: string;
  name?: string; // Display name
  commonClaim: string;
  whyItFails: string;
  correctApproach: string;
  frequentlyUsedBy?: string[]; // Which templates commonly misuse this
}

export interface CitationValidationResult {
  isValid: boolean;
  validCitations: LegalCitation[];
  invalidCitations: {
    statute: string;
    location: string; // Line or position reference
    reason: string;
    suggestion: string;
  }[];
  warnings: {
    statute: string;
    warning: string;
    suggestion: string;
  }[];
}

// =============================================================================
// OCR FRIVOLOUS DETECTION TYPES
// =============================================================================

export type OCRSeverity = "HIGH" | "MEDIUM" | "LOW";

export interface OCRFrivolousPhrase {
  pattern: RegExp | string;
  severity: OCRSeverity;
  replacement: string;
  explanation: string;
}

export interface OCRFinding {
  phrase: string;
  severity: OCRSeverity;
  location: string; // Line number or position
  suggestion: string;
  explanation: string;
}

export interface OCRAnalysisResult {
  score: number; // 0-100 (higher = safer)
  risk: "LOW" | "MEDIUM" | "HIGH";
  findings: OCRFinding[];
  autoFixAvailable: boolean;
}

// =============================================================================
// METRO 2 FIELD TYPES
// =============================================================================

export interface Metro2Field {
  code: string;
  name: string;
  description: string;
  disputeLanguageTemplate: string;
  commonIssues: string[];
  verificationChallenge: string;
}

export interface Metro2FieldDispute {
  field: Metro2Field;
  reportedValue: string;
  correctValue?: string;
  reason?: string;
  generatedLanguage: string;
}

export interface Metro2Discrepancy {
  field: string;
  fieldName: string;
  values: {
    cra: SentryCRA;
    value: string;
  }[];
  isDiscrepancy: boolean;
}

// =============================================================================
// SUCCESS PROBABILITY TYPES
// =============================================================================

export interface SuccessFactor {
  name: string;
  weight: number; // 0-1
  score: number; // 0-1
  contribution: number; // weight * score
  explanation: string;
}

export interface SuccessPrediction {
  probability: number; // 0-1
  confidence: "HIGH" | "MEDIUM" | "LOW";
  breakdown: SuccessFactor[];
  recommendations: string[];
}

// =============================================================================
// SENTRY DISPUTE TYPES (Main Entities)
// =============================================================================

export interface SentryDisputeInput {
  clientId: string;
  cra: SentryCRA;
  flow: SentryFlowType;
  accountIds: string[];
  round?: number;
}

export interface SentryDisputeItemInput {
  accountItemId: string;
  eoscarCode?: string;
  metro2Fields?: string[];
  disputeReason?: string;
  customLanguage?: string;
}

export interface SentryDispute {
  id: string;
  clientId: string;
  organizationId: string;
  cra: SentryCRA;
  flow: SentryFlowType;
  round: number;
  status: SentryDisputeStatus;
  letterContent?: string;
  letterContentHash?: string;
  eoscarCodes?: string[];
  metro2Fields?: string[];
  citationValidation?: CitationValidationResult;
  ocrRiskScore?: number;
  successProbability?: number;
  createdAt: Date;
  updatedAt: Date;
  sentDate?: Date;
  deadlineDate?: Date;
  respondedAt?: Date;
  resolvedAt?: Date;
  items: SentryDisputeItem[];
  analysis?: SentryAnalysis;
}

export interface SentryDisputeItem {
  id: string;
  sentryDisputeId: string;
  accountItemId: string;
  eoscarCode?: string;
  metro2Fields?: string[];
  disputeReason?: string;
  customLanguage?: string;
  outcome?: SentryOutcome;
  responseDate?: Date;
  responseNotes?: string;
  createdAt: Date;
  updatedAt: Date;
  // Joined data
  accountItem?: SentryAccountItem;
}

export interface SentryAnalysis {
  id: string;
  sentryDisputeId: string;
  recommendedCodes: EOSCARRecommendation[];
  codeSelectionRationale?: string;
  validCitations?: LegalCitation[];
  invalidCitations?: InvalidCitation[];
  citationWarnings?: { statute: string; warning: string }[];
  ocrScore: number;
  ocrFindings?: OCRFinding[];
  ocrFixSuggestions?: { phrase: string; replacement: string }[];
  identifiedFields?: Metro2Field[];
  fieldDiscrepancies?: Metro2Discrepancy[];
  successProbability: number;
  successBreakdown: SuccessFactor[];
  improvementTips?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// ACCOUNT TYPES (Read-only from existing system)
// =============================================================================

export interface SentryAccountItem {
  id: string;
  creditorName: string;
  maskedAccountId?: string;
  cra: SentryCRA;
  accountType?: string;
  accountStatus?: string;
  balance?: number;
  pastDue?: number;
  dateOpened?: Date;
  dateOfFirstDelinquency?: Date;
  dofd?: Date; // Alias for dateOfFirstDelinquency
  highCredit?: number;
  paymentStatus?: string;
  isCollection?: boolean;
  disputeReason?: string;
  detectedIssues?: SentryDetectedIssue[];
  // Cross-bureau data for discrepancy detection
  crossBureauData?: {
    cra: SentryCRA;
    balance?: number;
    dateOpened?: string;
    dofd?: string;
    accountStatus?: string;
  }[];
}

export interface SentryDetectedIssue {
  code: string;
  description: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  suggestedEOSCARCode?: string;
  suggestedMetro2Field?: string;
}

// =============================================================================
// CLIENT TYPES (Read-only from existing system)
// =============================================================================

export interface SentryClient {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  ssnLast4?: string;
  dateOfBirth?: Date;
  email?: string;
  phone?: string;
}

// =============================================================================
// LETTER GENERATION TYPES
// =============================================================================

export interface SentryLetterRequest {
  clientId: string;
  cra: SentryCRA;
  flow: SentryFlowType;
  round: number;
  items: SentryLetterItem[];
  options?: SentryLetterOptions;
}

export interface SentryLetterItem {
  accountItemId: string;
  creditorName: string;
  maskedAccountId?: string;
  eoscarCode: string;
  metro2Fields?: Metro2FieldDispute[];
  customLanguage?: string;
}

export interface SentryLetterOptions {
  backdateDays?: number; // Default 30 for R1
  includeScreenshots?: boolean;
  toneLevel?: number; // 1-10, affects escalation language
}

export interface SentryGeneratedLetter {
  content: string;
  contentHash: string;
  flow: SentryFlowType;
  round: number;
  cra: SentryCRA;
  eoscarCodes: string[];
  citationValidation: CitationValidationResult;
  ocrAnalysis: OCRAnalysisResult;
  successPrediction: SuccessPrediction;
}

// =============================================================================
// TEMPLATE TYPES
// =============================================================================

export interface SentryTemplate {
  flow: SentryFlowType;
  round: number;
  headline: string;
  primaryStatute: string;
  supportingStatutes: string[];
  openingParagraph: string;
  bodyParagraphs: string[];
  accountListIntro?: string;
  demandSection: string;
  consumerStatement: string;
  includesScreenshots: boolean;
  caselaw?: CaseLaw[];
}

export interface SentryTemplateVariables {
  clientFirstName: string;
  clientLastName: string;
  clientMiddleName?: string;
  clientAddress: string;
  clientCity: string;
  clientState: string;
  clientZip: string;
  ssnLast4: string;
  dateOfBirth: string;
  bureauName: string;
  bureauAddress: string;
  currentDate: string;
  lastDisputeDate?: string;
  debtCollectorNames?: string[];
  creditorNames?: string[];
  disputeItemsAndExplanation: string;
}

// =============================================================================
// FURNISHER PROFILE TYPES
// =============================================================================

export interface FurnisherProfile {
  id: string;
  name: string;
  normalizedName: string;
  totalDisputes: number;
  verificationRate?: number;
  deletionRate?: number;
  avgResponseDays?: number;
  effectiveCodes?: {
    code: string;
    successRate: number;
  }[];
  lastUpdated: Date;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface SentryAPIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface SentryListResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// =============================================================================
// ANALYSIS REQUEST TYPES
// =============================================================================

export interface AnalyzeLetterRequest {
  letterContent: string;
  targetType: CitationApplicability;
}

export interface RecommendCodesRequest {
  accounts: SentryAccountItem[];
  flow?: SentryFlowType;
}

export interface ValidateCitationsRequest {
  letterContent: string;
  targetType: CitationApplicability;
}

export interface SuccessPredictionRequest {
  accountAge: number; // months
  furnisherName: string;
  hasMetro2Targeting: boolean;
  eoscarCode: string;
  hasBureauDiscrepancy: boolean;
  hasPaymentProof: boolean;
  hasPoliceReport: boolean;
  citationAccuracyScore: number; // 0-1
  ocrSafetyScore: number; // 0-100
}
