/**
 * Comprehensive Archive Types for Client Data Retention
 *
 * These types define the structure of archived client data snapshots
 * used for 90-day retention, compliance, and AMELIA re-engagement.
 */

// =============================================================================
// MAIN SNAPSHOT STRUCTURE
// =============================================================================

export interface ComprehensiveArchiveSnapshot {
  version: string;
  snapshotDate: string;
  archiveReason: string;

  clientProfile: ClientProfileSnapshot;
  creditDNA: CreditDNASnapshot | null;
  creditScores: CreditScoreSnapshot[];
  disputes: DisputeSnapshot[];
  disputeResponses: DisputeResponseSnapshot[];
  roundHistory: RoundHistorySnapshot[];
  communications: CommunicationSnapshot[];
  accounts: AccountSnapshot[];
  evidenceRefs: EvidenceRefSnapshot[];
  documents: DocumentSnapshot[];
  eventLogs: EventLogSnapshot[];

  ameliaContext: AmeliaReengagementContext;

  metadata: SnapshotMetadata;
}

export interface SnapshotMetadata {
  snapshotSizeBytes: number;
  recordCounts: {
    disputes: number;
    responses: number;
    communications: number;
    accounts: number;
    evidences: number;
    documents: number;
    eventLogs: number;
    creditScores: number;
  };
}

// =============================================================================
// CLIENT PROFILE SNAPSHOT
// =============================================================================

export interface ClientProfileSnapshot {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  ssnLast4: string | null;
  dateOfBirth: string | null;
  notes: string | null;
  priority: string;
  segment: string;
  stage: string;
  currentRound: number;
  successRate: number | null;
  totalDisputesSent: number;
  totalItemsDeleted: number;
  activeBureaus: string[];
  createdAt: string;
  lastActivityAt: string | null;
}

// =============================================================================
// CREDIT DNA SNAPSHOT
// =============================================================================

export interface CreditDNASnapshot {
  id: string;
  classification: string;
  subClassifications: string[];
  confidence: number;
  confidenceLevel: string;
  healthScore: number;
  improvementPotential: number;
  urgencyScore: number;
  fileThickness: Record<string, unknown>;
  derogatoryProfile: Record<string, unknown>;
  utilization: Record<string, unknown>;
  bureauDivergence: Record<string, unknown>;
  inquiryAnalysis: Record<string, unknown>;
  positiveFactors: Record<string, unknown>;
  disputeReadiness: Record<string, unknown>;
  summary: string;
  keyInsights: string[];
  immediateActions: string[];
  analyzedAt: string;
}

// =============================================================================
// CREDIT SCORE SNAPSHOT
// =============================================================================

export interface CreditScoreSnapshot {
  id: string;
  cra: string;
  scoreType: string;
  score: number;
  scoreDate: string;
  source: string;
  factorsPositive: string[] | null;
  factorsNegative: string[] | null;
  createdAt: string;
}

// =============================================================================
// DISPUTE SNAPSHOT
// =============================================================================

export interface DisputeSnapshot {
  id: string;
  cra: string;
  flow: string;
  round: number;
  status: string;
  letterContent: string | null;
  aiStrategy: Record<string, unknown> | null;
  sentDate: string | null;
  respondedAt: string | null;
  resolvedAt: string | null;
  responseOutcome: string | null;
  responseNotes: string | null;
  createdAt: string;
  items: DisputeItemSnapshot[];
}

export interface DisputeItemSnapshot {
  id: string;
  disputeReason: string | null;
  outcome: string | null;
  suggestedFlow: string | null;
  accountItem: AccountItemSummary;
}

export interface AccountItemSummary {
  id: string;
  creditorName: string;
  maskedAccountId: string | null;
  accountType: string | null;
  balance: number | null;
  cra: string;
}

// Note: Allow null for fields that may be null in the database

// =============================================================================
// DISPUTE RESPONSE SNAPSHOT
// =============================================================================

export interface DisputeResponseSnapshot {
  id: string;
  disputeItemId: string;
  disputeId: string;
  outcome: string;
  responseDate: string;
  responseMethod: string;
  stallTactic: string | null;
  stallDetails: string | null;
  updateType: string | null;
  previousValue: string | null;
  newValue: string | null;
  verificationMethod: string | null;
  furnisherResponse: string | null;
  notes: string | null;
  daysToRespond: number;
  fcraDeadlineDate: string | null;
  wasLate: boolean;
  createdAt: string;
}

// =============================================================================
// ROUND HISTORY SNAPSHOT
// =============================================================================

export interface RoundHistorySnapshot {
  id: string;
  disputeId: string;
  round: number;
  flow: string;
  cra: string;
  letterSentDate: string | null;
  letterContent: string | null;
  letterHash: string | null;
  responseReceivedDate: string | null;
  overallOutcome: string | null;
  itemOutcomes: Record<string, string>;
  nextRoundContext: Record<string, unknown>;
  itemsDisputed: number;
  itemsDeleted: number;
  itemsVerified: number;
  itemsUpdated: number;
  itemsNoResponse: number;
  itemsStalled: number;
  createdAt: string;
}

// =============================================================================
// COMMUNICATION SNAPSHOT
// =============================================================================

export interface CommunicationSnapshot {
  id: string;
  type: string;
  direction: string;
  subject: string | null;
  content: string;
  status: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  provider: string | null;
  disputeId: string | null;
  documentId: string | null;
  createdAt: string;
}

// =============================================================================
// ACCOUNT SNAPSHOT
// =============================================================================

export interface AccountSnapshot {
  id: string;
  creditorName: string;
  maskedAccountId: string | null;
  accountType: string | null;
  accountStatus: string | null;
  balance: number | null;
  pastDue: number | null;
  creditLimit: number | null;
  dateOpened: string | null;
  dateReported: string | null;
  paymentStatus: string | null;
  cra: string;
  isDisputable: boolean;
  issueCount: number;
  detectedIssues: DetectedIssue[];
  suggestedFlow: string | null;
  confidenceScore: number | null;
  confidenceLevel: string | null;
  evidenceIds: string[];
  createdAt: string;
}

export interface DetectedIssue {
  type: string;
  severity: string;
  description: string;
  recommendation?: string;
}

// =============================================================================
// EVIDENCE SNAPSHOT
// =============================================================================

export interface EvidenceRefSnapshot {
  id: string;
  evidenceType: string;
  title: string | null;
  description: string | null;
  sourcePageNum: number | null;
  sourceDocumentId: string | null;
  accountItemId: string | null;
  renderedFileId: string | null;
  renderedFilename: string | null;
  createdAt: string;
}

// =============================================================================
// DOCUMENT SNAPSHOT
// =============================================================================

export interface DocumentSnapshot {
  id: string;
  documentType: string;
  title: string | null;
  description: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

// =============================================================================
// EVENT LOG SNAPSHOT
// =============================================================================

export interface EventLogSnapshot {
  id: string;
  eventType: string;
  actorId: string | null;
  actorEmail: string | null;
  targetType: string | null;
  targetId: string | null;
  eventData: Record<string, unknown> | null;
  createdAt: string;
}

// =============================================================================
// AMELIA RE-ENGAGEMENT CONTEXT
// =============================================================================

export interface AmeliaReengagementContext {
  recommendedAction: "START_FRESH" | "CONTINUE_EXISTING" | "REVIEW_OUTCOMES";
  lastActiveFlow: string | null;
  lastActiveRound: number;
  unresolvedCRAs: string[];

  disputeStrategySummary: {
    totalDisputes: number;
    successRate: number;
    mostEffectiveFlow: string | null;
    mostResistantCRA: string | null;
    outstandingIssues: string[];
    lastDisputeDate: string | null;
    avgDaysToResponse: number | null;
  };

  creditProfileSummary: {
    classification: string | null;
    healthScore: number | null;
    improvementPotential: number | null;
    keyInsights: string[];
  };

  complianceAuditTrail: {
    totalFCRAViolations: number;
    pendingDeadlines: number;
    lateResponses: number;
    violationDetails: string[];
  };

  personalizedMessage: string;
}

// =============================================================================
// ARCHIVED CLIENT LIST ITEM (for list view)
// =============================================================================

export interface ArchivedClientListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  archiveReason: string;
  archivedAt: string;
  expiresAt: string;
  daysRemaining: number;
  snapshotSizeBytes: number;
  recordCounts: {
    disputes: number;
    accounts: number;
    communications: number;
  };
  ameliaRecommendation: string;
}

// =============================================================================
// PAGINATION
// =============================================================================

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// =============================================================================
// ARCHIVE STATS
// =============================================================================

export interface ArchiveStats {
  totalArchived: number;
  expiringIn7Days: number;
  expiringIn30Days: number;
  totalStorageBytes: number;
  oldestArchive: string | null;
  newestArchive: string | null;
}
