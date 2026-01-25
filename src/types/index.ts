// ============================================================================
// Dispute2Go Type Definitions
// Authoritative types per Master Spec + All Recommendations
// ============================================================================

// ============================================================================
// ENUMS (Mirror Prisma enums for client-side use)
// ============================================================================

export enum UserRole {
  ADMIN = "ADMIN",
  SPECIALIST = "SPECIALIST",
}

export enum SubscriptionTier {
  FREE = "FREE",
  STARTER = "STARTER",
  PROFESSIONAL = "PROFESSIONAL",
  ENTERPRISE = "ENTERPRISE",
}

export enum SubscriptionStatus {
  ACTIVE = "ACTIVE",
  PAST_DUE = "PAST_DUE",
  CANCELED = "CANCELED",
  TRIALING = "TRIALING",
}

export enum ConfidenceLevel {
  HIGH = "HIGH",     // >= 70
  MEDIUM = "MEDIUM", // 45-69
  LOW = "LOW",       // < 45
}

export enum FlowType {
  ACCURACY = "ACCURACY",
  COLLECTION = "COLLECTION",
  CONSENT = "CONSENT",
  COMBO = "COMBO",
}

export enum AccountStatus {
  OPEN = "OPEN",
  CLOSED = "CLOSED",
  PAID = "PAID",
  CHARGED_OFF = "CHARGED_OFF",
  COLLECTION = "COLLECTION",
  UNKNOWN = "UNKNOWN",
}

export enum DisputeStatus {
  DRAFT = "DRAFT",
  PENDING_REVIEW = "PENDING_REVIEW",
  APPROVED = "APPROVED",
  SENT = "SENT",
  RESPONDED = "RESPONDED",
  RESOLVED = "RESOLVED",
  ESCALATED = "ESCALATED",
}

export enum DocumentType {
  CRA_LETTER = "CRA_LETTER",
  CFPB_DRAFT = "CFPB_DRAFT",
}

export enum CRA {
  EXPERIAN = "EXPERIAN",
  EQUIFAX = "EQUIFAX",
  TRANSUNION = "TRANSUNION",
}

export enum EvidenceType {
  CROP = "CROP",
  ANNOTATION = "ANNOTATION",
  EXTERNAL = "EXTERNAL",
}

export enum ApprovalStatus {
  DRAFT = "DRAFT",
  PENDING_REVIEW = "PENDING_REVIEW",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export enum EventType {
  USER_LOGIN = "USER_LOGIN",
  USER_LOGOUT = "USER_LOGOUT",
  USER_CREATED = "USER_CREATED",
  USER_UPDATED = "USER_UPDATED",
  USER_DELETED = "USER_DELETED",
  CLIENT_CREATED = "CLIENT_CREATED",
  CLIENT_UPDATED = "CLIENT_UPDATED",
  CLIENT_DELETED = "CLIENT_DELETED",
  REPORT_UPLOADED = "REPORT_UPLOADED",
  REPORT_PARSED = "REPORT_PARSED",
  REPORT_PARSE_FAILED = "REPORT_PARSE_FAILED",
  ACCOUNT_CREATED = "ACCOUNT_CREATED",
  ACCOUNT_UPDATED = "ACCOUNT_UPDATED",
  ACCOUNT_CONFIRMED = "ACCOUNT_CONFIRMED",
  ACCOUNT_FLOW_ASSIGNED = "ACCOUNT_FLOW_ASSIGNED",
  DISPUTE_CREATED = "DISPUTE_CREATED",
  DISPUTE_APPROVED = "DISPUTE_APPROVED",
  DISPUTE_SENT = "DISPUTE_SENT",
  DISPUTE_RESPONDED = "DISPUTE_RESPONDED",
  DOCUMENT_GENERATED = "DOCUMENT_GENERATED",
  DOCUMENT_APPROVED = "DOCUMENT_APPROVED",
  EVIDENCE_CREATED = "EVIDENCE_CREATED",
  EVIDENCE_ATTACHED = "EVIDENCE_ATTACHED",
  DIFF_COMPUTED = "DIFF_COMPUTED",
  ROUND_ADVANCED = "ROUND_ADVANCED",
  SUBSCRIPTION_CHANGED = "SUBSCRIPTION_CHANGED",
}

// ============================================================================
// FLOW & ROUND DOCTRINE
// ============================================================================

export interface RoundDefinition {
  round: number;
  statuteCode: string;
  shortTitle: string;
  description: string;
  isLitigationMarker?: boolean;
}

export const ACCURACY_FLOW_ROUNDS: RoundDefinition[] = [
  { round: 1, statuteCode: "FACTUAL", shortTitle: "Factual Dispute", description: "No statute citation - factual inaccuracy only" },
  { round: 2, statuteCode: "1681e(b)", shortTitle: "Accuracy of Reports", description: "CRA must follow reasonable procedures to assure maximum possible accuracy" },
  { round: 3, statuteCode: "1681i(a)(5)", shortTitle: "Reinvestigation Results", description: "CRA must provide written results of reinvestigation within 5 days" },
  { round: 4, statuteCode: "1681i(a)(1)(A)", shortTitle: "Reinvestigation Requirement", description: "CRA must conduct reasonable reinvestigation" },
  { round: 5, statuteCode: "1681i(a)(7)", shortTitle: "Description of Process", description: "CRA must provide description of reinvestigation procedure" },
  { round: 6, statuteCode: "1681i(a)(6)(B)(iii)", shortTitle: "Method of Verification", description: "CRA must provide method of verification upon request" },
  { round: 7, statuteCode: "1681i(c)", shortTitle: "Information Provider Notice", description: "CRA must notify information provider of dispute" },
  { round: 8, statuteCode: "1681s-2(b)", shortTitle: "Furnisher Duties", description: "Information provider must investigate disputed information" },
  { round: 9, statuteCode: "1681(b)", shortTitle: "Permissible Purposes", description: "Information may only be furnished for permissible purposes" },
  { round: 10, statuteCode: "1681c(e)", shortTitle: "Information Update", description: "CRA must update or delete information found to be inaccurate" },
  { round: 11, statuteCode: "1681e(b)-DISCHARGED", shortTitle: "Discharged Debt Accuracy", description: "Special accuracy requirements for discharged debts" },
  { round: 12, statuteCode: "LITIGATION", shortTitle: "Litigation Marker", description: "Account marked for potential litigation", isLitigationMarker: true },
];

export const COLLECTION_FLOW_ROUNDS: RoundDefinition[] = [
  { round: 1, statuteCode: "1692g", shortTitle: "Validation Notice", description: "Debt collector must provide validation notice" },
  { round: 2, statuteCode: "1692g(b)", shortTitle: "Validation Request", description: "Collection must cease until debt is validated" },
  { round: 3, statuteCode: "1692j", shortTitle: "Unfair Practices", description: "Prohibition on unfair practices in debt collection" },
  { round: 4, statuteCode: "1681a(m)", shortTitle: "Medical Information", description: "Restrictions on medical debt reporting" },
  { round: 5, statuteCode: "1681(b)", shortTitle: "Permissible Purposes", description: "Collection reporting requires permissible purpose" },
  { round: 6, statuteCode: "1692e(10)", shortTitle: "False Representation", description: "Prohibition on deceptive means to collect debt" },
  { round: 7, statuteCode: "1681q", shortTitle: "False Information", description: "Prohibition on obtaining credit report under false pretenses" },
  { round: 8, statuteCode: "1692c(c)", shortTitle: "Cease Communication", description: "Consumer request to cease communication" },
  { round: 9, statuteCode: "1681b(a)(3)(A)", shortTitle: "Collection Purpose", description: "Report obtained must be for collection of account" },
  { round: 10, statuteCode: "LITIGATION", shortTitle: "Litigation Marker", description: "Account marked for potential litigation", isLitigationMarker: true },
];

export const CONSENT_FLOW_ROUNDS: RoundDefinition[] = [
  { round: 1, statuteCode: "1681b(a)(2)", shortTitle: "Written Consent", description: "Consumer must provide written consent for report" },
  { round: 2, statuteCode: "1681(a)(4)", shortTitle: "Consumer Privacy", description: "Right to privacy in credit information" },
  { round: 3, statuteCode: "1681a(d)(2)(B)", shortTitle: "Consumer Report Definition", description: "Definition and scope of consumer report" },
  { round: 4, statuteCode: "SWITCH_BACK", shortTitle: "Flow Switch", description: "Return to Accuracy or Collection flow" },
];

export const FLOW_DEFINITIONS = {
  [FlowType.ACCURACY]: ACCURACY_FLOW_ROUNDS,
  [FlowType.COLLECTION]: COLLECTION_FLOW_ROUNDS,
  [FlowType.CONSENT]: CONSENT_FLOW_ROUNDS,
  [FlowType.COMBO]: [], // Combo uses both Accuracy and Collection
};

// ============================================================================
// PARSING ENGINE TYPES
// ============================================================================

// Payment history entry for a single month
export interface PaymentHistoryEntry {
  month: string; // e.g., "Dec", "Nov"
  year: string; // e.g., "25", "24"
  status: string; // "OK", "30", "60", "90", "120", "CO", "" (empty/missing)
  isLate: boolean;
  daysLate?: number; // 30, 60, 90, 120
  isChargeoff: boolean;
  isMissing: boolean; // No data for this month
}

// Two-year payment history for an account
export interface PaymentHistory {
  entries: PaymentHistoryEntry[];
  hasLatePayments: boolean;
  hasChargeoffs: boolean;
  hasMissingMonths: boolean;
  totalLateCount: number;
  totalChargeoffCount: number;
  totalMissingCount: number;
  lateMonths: string[]; // e.g., ["Oct 24", "Nov 24"]
  chargeoffMonths: string[];
  missingMonths: string[];
}

export interface ParsedAccountItem {
  creditorName: string;
  maskedAccountId: string;
  fingerprint?: string;
  cra: CRA;

  // Basic account info
  accountType?: string; // Revolving, Installment, Mortgage, Open Account
  accountTypeDetail?: string; // Credit Card, Charge account, Auto Loan, etc.
  bureauCode?: string; // Individual, Authorized User, Joint
  accountStatus: AccountStatus;

  // Financial fields
  balance?: number;
  pastDue?: number;
  creditLimit?: number;
  highBalance?: number; // High Credit
  monthlyPayment?: number;
  numberOfMonths?: number; // No. of Months (terms)

  // Date fields
  dateOpened?: string;
  dateReported?: string; // Last Reported
  lastActivityDate?: string; // Date Last Active
  dateOfLastPayment?: string; // Date of Last Payment

  // Status fields
  paymentStatus?: string; // Current, Late 30 Days, Collection/Chargeoff
  comments?: string; // Comments field

  // Payment history
  paymentHistory?: PaymentHistory;

  // Legacy fields
  disputeComment?: string;
  confidenceScore: number;
  rawExtractedData?: Record<string, unknown>;
}

export interface ParseResult {
  success: boolean;
  pageCount: number;
  accounts: ParsedAccountItem[];
  errors: ParseError[];
  warnings: ParseWarning[];
}

export interface ParseError {
  code: string;
  message: string;
  page?: number;
  details?: Record<string, unknown>;
}

export interface ParseWarning {
  code: string;
  message: string;
  page?: number;
  accountIndex?: number;
}

// Error codes for Recommendation #1 (Fallback for non-text PDFs)
export const PARSE_ERROR_CODES = {
  NO_TEXT_LAYER: "NO_TEXT_LAYER",
  INVALID_PDF: "INVALID_PDF",
  UNSUPPORTED_FORMAT: "UNSUPPORTED_FORMAT",
  EXTRACTION_FAILED: "EXTRACTION_FAILED",
  PAGE_RENDER_FAILED: "PAGE_RENDER_FAILED",
} as const;

// ============================================================================
// CONFIDENCE SCORING
// ============================================================================

export function computeConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 70) return ConfidenceLevel.HIGH;
  if (score >= 45) return ConfidenceLevel.MEDIUM;
  return ConfidenceLevel.LOW;
}

export interface ConfidenceBreakdown {
  creditorName: number;      // 0-25 points
  accountId: number;         // 0-20 points
  accountStatus: number;     // 0-15 points
  balance: number;           // 0-15 points
  dates: number;             // 0-15 points
  structureMatch: number;    // 0-10 points
  total: number;
  level: ConfidenceLevel;
}

// ============================================================================
// DIFF ENGINE TYPES (Recommendation #2)
// ============================================================================

export interface DiffMatch {
  oldAccountId: string;
  newAccountId: string;
  matchScore: number;
  matchMethod: "FINGERPRINT" | "CREDITOR_ACCOUNT" | "FUZZY";
}

export interface DiffChangeDetail {
  changeType: "ADDED" | "REMOVED" | "MODIFIED" | "UNCHANGED";
  oldAccountId?: string;
  newAccountId?: string;
  changedFields?: Record<string, { old: unknown; new: unknown }>;
}

export interface DiffSummary {
  accountsAdded: number;
  accountsRemoved: number;
  accountsChanged: number;
  accountsUnchanged: number;
  changes: DiffChangeDetail[];
}

// Fields tracked for changes
export const DIFF_TRACKED_FIELDS = [
  "accountStatus",
  "balance",
  "pastDue",
  "creditLimit",
  "disputeComment",
] as const;

// ============================================================================
// DOCUMENT GENERATION TYPES
// ============================================================================

export interface LetterSection {
  type: "HEADER" | "HEADLINE" | "DAMAGES" | "FACTS" | "ITEMS" | "STATEMENT" | "EVIDENCE" | "FOOTER";
  content: string;
}

export interface GeneratedLetter {
  documentType: DocumentType;
  cra: CRA;
  flow: FlowType;
  round: number;
  sections: LetterSection[];
  statutesCited: string[];
  fullContent: string;
}

export interface CFPBDraftStructure {
  intro: string;
  when: string;
  how: string;
  why: string;
  what: string;
}

// ============================================================================
// EVIDENCE SYSTEM TYPES
// ============================================================================

export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Annotation {
  id: string;
  type: "BOX" | "CIRCLE" | "ARROW" | "TEXT";
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  points?: number[];
  text?: string;
  color: string;
  strokeWidth: number;
}

// ============================================================================
// APPROVAL WORKFLOW TYPES (Recommendation #4)
// ============================================================================

export interface ApprovalTransition {
  from: ApprovalStatus;
  to: ApprovalStatus;
  allowedRoles: UserRole[];
}

export const APPROVAL_TRANSITIONS: ApprovalTransition[] = [
  { from: ApprovalStatus.DRAFT, to: ApprovalStatus.PENDING_REVIEW, allowedRoles: [UserRole.SPECIALIST, UserRole.ADMIN] },
  { from: ApprovalStatus.PENDING_REVIEW, to: ApprovalStatus.APPROVED, allowedRoles: [UserRole.SPECIALIST, UserRole.ADMIN] },
  { from: ApprovalStatus.PENDING_REVIEW, to: ApprovalStatus.REJECTED, allowedRoles: [UserRole.SPECIALIST, UserRole.ADMIN] },
  { from: ApprovalStatus.PENDING_REVIEW, to: ApprovalStatus.DRAFT, allowedRoles: [UserRole.SPECIALIST, UserRole.ADMIN] },
  { from: ApprovalStatus.REJECTED, to: ApprovalStatus.DRAFT, allowedRoles: [UserRole.SPECIALIST, UserRole.ADMIN] },
];

// ============================================================================
// NEEDS REVIEW QUEUE TYPES (Recommendation #6)
// ============================================================================

export interface NeedsReviewItem {
  accountId: string;
  creditorName: string;
  maskedAccountId: string;
  cra: CRA;
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  issues: ReviewIssue[];
}

export interface ReviewIssue {
  field: string;
  issue: string;
  suggestion?: string;
}

export interface BulkReviewAction {
  action: "CONFIRM" | "OVERRIDE" | "SKIP";
  accountIds: string[];
  overrideData?: Partial<ParsedAccountItem>;
}

// ============================================================================
// FILE HANDLING TYPES (Recommendation #8)
// ============================================================================

export const FILE_LIMITS = {
  maxFileSizeMB: 50,
  maxPages: 100,
  allowedMimeTypes: ["application/pdf"],
  allowedExtensions: [".pdf"],
} as const;

export interface FileValidationResult {
  valid: boolean;
  errors: string[];
}

// ============================================================================
// NOTIFICATION TYPES (Recommendation #10)
// ============================================================================

export interface NotificationPayload {
  userId: string;
  title: string;
  message: string;
  type: "INFO" | "WARNING" | "SUCCESS" | "ERROR";
  linkUrl?: string;
  linkText?: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================================
// FEATURE FLAGS (For subscription gating)
// ============================================================================

export interface FeatureFlags {
  canUploadReports: boolean;
  canGenerateLetters: boolean;
  canGenerateCFPB: boolean;
  canUseEvidence: boolean;
  canViewDiff: boolean;
  canExportDocuments: boolean;
  maxClients: number;
  maxReportsPerMonth: number;
}

export const FREE_TIER_FLAGS: FeatureFlags = {
  canUploadReports: false,
  canGenerateLetters: false,
  canGenerateCFPB: false,
  canUseEvidence: false,
  canViewDiff: false,
  canExportDocuments: false,
  maxClients: 1,
  maxReportsPerMonth: 0,
};

export const PRO_TIER_FLAGS: FeatureFlags = {
  canUploadReports: true,
  canGenerateLetters: true,
  canGenerateCFPB: true,
  canUseEvidence: true,
  canViewDiff: true,
  canExportDocuments: true,
  maxClients: 50,
  maxReportsPerMonth: 100,
};

export const ENTERPRISE_TIER_FLAGS: FeatureFlags = {
  canUploadReports: true,
  canGenerateLetters: true,
  canGenerateCFPB: true,
  canUseEvidence: true,
  canViewDiff: true,
  canExportDocuments: true,
  maxClients: -1, // Unlimited
  maxReportsPerMonth: -1, // Unlimited
};

// ============================================================================
// KEYBOARD SHORTCUTS (Recommendation #11)
// ============================================================================

export const KEYBOARD_SHORTCUTS = {
  evidence: {
    selectBox: "b",
    selectCircle: "c",
    selectArrow: "a",
    selectText: "t",
    delete: "Delete",
    undo: "ctrl+z",
    redo: "ctrl+shift+z",
    save: "ctrl+s",
  },
  navigation: {
    dashboard: "g d",
    clients: "g c",
    ledger: "g l",
    reports: "g r",
    disputes: "g i",
    evidence: "g e",
    settings: "g s",
  },
  actions: {
    newClient: "n c",
    uploadReport: "n r",
    generateLetter: "n l",
    search: "/",
  },
} as const;

// ============================================================================
// BRANDING / WHITE LABEL TYPES
// ============================================================================

export * from "./branding";
