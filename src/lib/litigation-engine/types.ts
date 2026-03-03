/**
 * Litigation Workflow Engine — Extended Type System
 *
 * Builds on src/lib/litigation-scanner/types.ts to add workflow,
 * document generation, jurisdiction, and case management types.
 */

// ============================================================================
// Enums / Literal Types
// ============================================================================

/** Ordered litigation stages — each case progresses through these */
export type LitigationStage =
  | "DEMAND_LETTER"
  | "CFPB_COMPLAINT"
  | "AG_COMPLAINT"
  | "FTC_COMPLAINT"
  | "INTENT_TO_SUE"
  | "SMALL_CLAIMS"
  | "FEDERAL_COMPLAINT"
  | "DISCOVERY"
  | "SETTLEMENT";

/** All stages in progression order */
export const LITIGATION_STAGES: LitigationStage[] = [
  "DEMAND_LETTER",
  "CFPB_COMPLAINT",
  "AG_COMPLAINT",
  "FTC_COMPLAINT",
  "INTENT_TO_SUE",
  "SMALL_CLAIMS",
  "FEDERAL_COMPLAINT",
  "DISCOVERY",
  "SETTLEMENT",
];

/** Human-readable stage labels */
export const STAGE_LABELS: Record<LitigationStage, string> = {
  DEMAND_LETTER: "Demand Letter",
  CFPB_COMPLAINT: "CFPB Complaint",
  AG_COMPLAINT: "State AG Complaint",
  FTC_COMPLAINT: "FTC Complaint",
  INTENT_TO_SUE: "Intent to Sue",
  SMALL_CLAIMS: "Small Claims Filing",
  FEDERAL_COMPLAINT: "Federal Complaint",
  DISCOVERY: "Discovery",
  SETTLEMENT: "Settlement",
};

/** Document types that can be generated */
export type LitigationDocumentType =
  | "DEMAND_LETTER"
  | "CFPB_COMPLAINT"
  | "AG_COMPLAINT"
  | "FTC_COMPLAINT"
  | "INTENT_TO_SUE"
  | "SMALL_CLAIMS_COMPLAINT"
  | "FEDERAL_COMPLAINT"
  | "SUMMONS"
  | "INTERROGATORIES"
  | "REQUEST_FOR_PRODUCTION"
  | "REQUEST_FOR_ADMISSION"
  | "SETTLEMENT_DEMAND";

/** Human-readable document type labels */
export const DOCUMENT_TYPE_LABELS: Record<LitigationDocumentType, string> = {
  DEMAND_LETTER: "Demand Letter",
  CFPB_COMPLAINT: "CFPB Complaint",
  AG_COMPLAINT: "State Attorney General Complaint",
  FTC_COMPLAINT: "FTC Complaint",
  INTENT_TO_SUE: "Intent to Sue Notice",
  SMALL_CLAIMS_COMPLAINT: "Small Claims Court Complaint",
  FEDERAL_COMPLAINT: "Federal Court Complaint",
  SUMMONS: "Summons",
  INTERROGATORIES: "Interrogatories",
  REQUEST_FOR_PRODUCTION: "Request for Production of Documents",
  REQUEST_FOR_ADMISSION: "Request for Admission",
  SETTLEMENT_DEMAND: "Settlement Demand Letter",
};

/** Action types that can be taken in a case */
export type LitigationActionType =
  | "DEMAND_LETTER"
  | "CFPB_COMPLAINT"
  | "AG_COMPLAINT"
  | "FTC_COMPLAINT"
  | "INTENT_TO_SUE"
  | "SMALL_CLAIMS_FILING"
  | "FEDERAL_COMPLAINT"
  | "SUMMONS"
  | "DISCOVERY_REQUEST"
  | "SETTLEMENT_DEMAND";

export type CaseStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "SETTLED"
  | "WON"
  | "LOST"
  | "DISMISSED"
  | "CLOSED";

export type ActionStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "DRAFT_READY"
  | "REVIEW"
  | "APPROVED"
  | "SENT"
  | "FILED"
  | "COMPLETED"
  | "SKIPPED";

export type DocumentApprovalStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "SENT"
  | "FILED";

export type DeadlineType =
  | "FILING"
  | "RESPONSE"
  | "DISCOVERY"
  | "HEARING"
  | "SOL_EXPIRY"
  | "CUSTOM";

export type DeadlineStatus =
  | "UPCOMING"
  | "DUE_SOON"
  | "OVERDUE"
  | "COMPLETED"
  | "WAIVED";

export type CourtType = "FEDERAL" | "STATE" | "SMALL_CLAIMS";

export type DefendantType = "CRA" | "FURNISHER" | "COLLECTOR";

export type DeliveryMethod = "MAIL" | "EMAIL" | "EFILING" | "MANUAL";

export type TargetEntityType = "CRA" | "FURNISHER" | "COLLECTOR" | "AGENCY" | "COURT";

// ============================================================================
// Jurisdiction Types
// ============================================================================

export interface FederalDistrict {
  name: string;
  shortName: string;
  divisions?: string[];
  courtAddress: string;
  filingFee: number; // cents
}

export interface SmallClaimsInfo {
  limit: number; // cents — max claimable amount
  filingFeeMin: number; // cents
  filingFeeMax: number; // cents
  notes?: string;
}

export interface StateAGInfo {
  name: string;
  divisionName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  phone?: string;
  url?: string;
}

export interface ServiceRequirements {
  personalService: boolean;
  substitutedService: boolean;
  certifiedMailAccepted: boolean;
  responseDeadlineDays: number;
  notes?: string;
}

export interface JurisdictionInfo {
  state: string;
  county?: string;
  zipCode?: string;
  federalDistrict: FederalDistrict;
  smallClaims: SmallClaimsInfo;
  stateAG: StateAGInfo;
  serviceRequirements: ServiceRequirements;
  recommendedCourtType: CourtType;
  filingFeeEstimate: number; // cents
}

// ============================================================================
// Action Plan Types
// ============================================================================

export interface ActionPlanStep {
  stage: LitigationStage;
  actionType: LitigationActionType;
  targetDefendantName?: string;
  targetDefendantType?: DefendantType;
  targetEntityName?: string;
  targetEntityType?: TargetEntityType;
  description: string;
  documentType?: LitigationDocumentType;
  deliveryMethod?: DeliveryMethod;
  sortOrder: number;
}

// ============================================================================
// Document Generation Types
// ============================================================================

export interface DocumentGenerationContext {
  caseId: string;
  documentType: LitigationDocumentType;
  targetDefendantId?: string;

  // Case data
  caseNumber: string;
  filingState: string;
  courtType?: string;
  courtName?: string;
  courtDistrict?: string;

  // Client data
  clientName: string;
  clientAddress: string;
  clientCity: string;
  clientState: string;
  clientZipCode: string;
  clientSSNLast4?: string;
  clientDOB?: string;

  // Defendant data
  defendantName?: string;
  defendantType?: string;
  defendantAddress?: string;

  // Violation data
  violations: Array<{
    ruleId: string;
    title: string;
    description: string;
    statute: string;
    severity: string;
    category: string;
    estimatedDamagesMin: number;
    estimatedDamagesMax: number;
    affectedAccounts: Array<{
      creditorName: string;
      cra?: string;
      balance?: number;
    }>;
  }>;

  // Case summary data
  strengthScore: number;
  strengthLabel: string;
  totalViolations: number;
  estimatedDamagesMin: number;
  estimatedDamagesMax: number;

  // State-specific
  stateSOL?: {
    writtenContractYears: number;
    oralContractYears: number;
  };
}

export interface GeneratedDocumentResult {
  content: string;
  title: string;
  statutesCited: string[];
  defendants: string[];
  aiRequestId?: string;
  aiMetadata?: Record<string, unknown>;
}

// ============================================================================
// Document Template Types
// ============================================================================

export interface DocumentSection {
  id: string;
  label: string;
  required: boolean;
  description: string;
  promptGuidance: string;
}

export interface DocumentTemplate {
  documentType: LitigationDocumentType;
  title: string;
  sections: DocumentSection[];
  disclaimer: string;
}

// ============================================================================
// Event Types for EventLog
// ============================================================================

export const LITIGATION_EVENT_TYPES = {
  CASE_CREATED: "LITIGATION_CASE_CREATED",
  DOCUMENT_GENERATED: "LITIGATION_DOCUMENT_GENERATED",
  DOCUMENT_APPROVED: "LITIGATION_DOCUMENT_APPROVED",
  DOCUMENT_SENT: "LITIGATION_DOCUMENT_SENT",
  ACTION_COMPLETED: "LITIGATION_ACTION_COMPLETED",
  CASE_STATUS_CHANGED: "LITIGATION_CASE_STATUS_CHANGED",
} as const;
