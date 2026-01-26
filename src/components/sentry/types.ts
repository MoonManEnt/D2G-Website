/**
 * SENTRY COMPONENT TYPES
 *
 * Component-level types for the Sentry Dispute UI.
 * These extend the core types from @/types/sentry.
 */

import type {
  SentryCRA,
  SentryFlowType,
  SentryRound,
  SentryDisputeStatus,
  EOSCARRecommendation,
  OCRFinding,
  Metro2FieldDispute,
  SuccessFactor,
  LegalCitation,
} from "@/types/sentry";

// =============================================================================
// ACCOUNT TYPES
// =============================================================================

export interface SentryAccountForUI {
  id: string;
  creditorName: string;
  maskedAccountId: string | null;
  accountType: string | null;
  balance: number | null;
  dateOpened: string | null;
  cra: string;
  paymentStatus: string | null;
  isCollection: boolean;
  detectedIssues: DetectedIssueUI[];
  isSelected?: boolean;
  eoscarCode?: string;
  metro2Fields?: string[];
}

export interface DetectedIssueUI {
  code: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  description: string;
}

// =============================================================================
// DISPUTE TYPES
// =============================================================================

export interface SentryDisputeForUI {
  id: string;
  clientId: string;
  client: {
    id: string;
    firstName: string;
    lastName: string;
  };
  cra: SentryCRA;
  flow: SentryFlowType;
  round: SentryRound;
  status: SentryDisputeStatus;
  letterContent: string | null;
  ocrRiskScore: number | null;
  successProbability: number | null;
  sentDate: string | null;
  deadlineDate: string | null;
  createdAt: string;
  items: SentryDisputeItemForUI[];
  analysis: SentryAnalysisForUI | null;
}

export interface SentryDisputeItemForUI {
  id: string;
  accountItemId: string;
  eoscarCode: string | null;
  metro2Fields: string[];
  disputeReason: string | null;
  accountItem: SentryAccountForUI;
}

// =============================================================================
// ANALYSIS TYPES
// =============================================================================

export interface SentryAnalysisForUI {
  ocrScore: number;
  ocrRisk: "LOW" | "MEDIUM" | "HIGH";
  ocrFindings: OCRFindingUI[];
  citationValidation: CitationValidationUI;
  eoscarRecommendations: EOSCARRecommendationUI[];
  metro2Targeting: Metro2TargetingUI;
  successPrediction: SuccessPredictionUI;
}

export interface OCRFindingUI {
  phrase: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  location: string;
  suggestion: string | null;
  explanation: string;
}

export interface CitationValidationUI {
  isValid: boolean;
  validCitations: {
    statute: string;
    name: string;
    description: string;
  }[];
  invalidCitations: {
    statute: string;
    reason: string;
    suggestion: string;
  }[];
  warnings: {
    statute: string;
    warning: string;
  }[];
}

export interface EOSCARRecommendationUI {
  code: string;
  name: string;
  confidence: number;
  reasoning: string;
  accountId?: string;
}

export interface Metro2TargetingUI {
  fieldsTargeted: number;
  disputes: {
    fieldCode: string;
    fieldName: string;
    reportedValue: string;
    language: string;
  }[];
  discrepancies: {
    field: string;
    language: string;
  }[];
}

export interface SuccessPredictionUI {
  probability: number;
  probabilityPercent: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  label: string;
  breakdown: SuccessFactorUI[];
  recommendations: string[];
}

export interface SuccessFactorUI {
  name: string;
  weight: number;
  score: number;
  contribution: number;
  explanation: string;
}

// =============================================================================
// COMPONENT PROPS
// =============================================================================

export interface SentryDisputePageProps {
  clientId: string;
}

export interface SentryLetterBuilderProps {
  disputeId: string;
  initialContent?: string;
  onSave: (content: string) => void;
  onGenerate: () => void;
}

export interface SentryAccountSelectorProps {
  accounts: SentryAccountForUI[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  cra: SentryCRA;
}

export interface SentryAnalysisPanelProps {
  analysis: SentryAnalysisForUI;
  onApplyFixes?: () => void;
}

export interface EOSCARCodeSelectorProps {
  recommendations: EOSCARRecommendationUI[];
  selectedCode: string;
  onCodeSelect: (code: string) => void;
}

export interface LegalCitationCheckerProps {
  validation: CitationValidationUI;
  onFixCitation?: (statute: string) => void;
}

export interface OCRRiskAnalyzerProps {
  score: number;
  risk: "LOW" | "MEDIUM" | "HIGH";
  findings: OCRFindingUI[];
  onApplyFix?: (phrase: string, replacement: string) => void;
}

export interface Metro2FieldSelectorProps {
  availableFields: Metro2FieldUI[];
  selectedFields: string[];
  onFieldSelect: (fieldCodes: string[]) => void;
}

export interface Metro2FieldUI {
  code: string;
  name: string;
  description: string;
  isRecommended?: boolean;
}

export interface SuccessProbabilityGaugeProps {
  probability: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  breakdown?: SuccessFactorUI[];
  recommendations?: string[];
}

export interface SentryLetterPreviewProps {
  content: string;
  ocrFindings?: OCRFindingUI[];
  invalidCitations?: CitationValidationUI["invalidCitations"];
  highlightIssues?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const SENTRY_CRA_COLORS = {
  TRANSUNION: {
    bg: "bg-sky-500/15",
    text: "text-sky-400",
    border: "border-sky-500/30",
    solid: "bg-sky-500",
  },
  EXPERIAN: {
    bg: "bg-blue-500/15",
    text: "text-blue-400",
    border: "border-blue-500/30",
    solid: "bg-blue-500",
  },
  EQUIFAX: {
    bg: "bg-red-500/15",
    text: "text-red-400",
    border: "border-red-500/30",
    solid: "bg-red-500",
  },
} as const;

export const SENTRY_FLOW_COLORS = {
  ACCURACY: {
    bg: "bg-blue-500/15",
    text: "text-blue-400",
    border: "border-blue-500/30",
  },
  COLLECTION: {
    bg: "bg-red-500/15",
    text: "text-red-400",
    border: "border-red-500/30",
  },
  CONSENT: {
    bg: "bg-purple-500/15",
    text: "text-purple-400",
    border: "border-purple-500/30",
  },
  COMBO: {
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    border: "border-amber-500/30",
  },
} as const;

export const SENTRY_STATUS_COLORS = {
  DRAFT: "bg-slate-500/20 text-slate-400",
  SENT: "bg-amber-500/20 text-amber-400",
  RESPONDED: "bg-purple-500/20 text-purple-400",
  RESOLVED: "bg-emerald-500/20 text-emerald-400",
} as const;

export const OCR_RISK_COLORS = {
  LOW: { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "Low Risk" },
  MEDIUM: { bg: "bg-amber-500/20", text: "text-amber-400", label: "Medium Risk" },
  HIGH: { bg: "bg-red-500/20", text: "text-red-400", label: "High Risk" },
} as const;

export const SUCCESS_PROBABILITY_COLORS = {
  high: { color: "text-emerald-400", bg: "bg-emerald-500" },
  medium: { color: "text-amber-400", bg: "bg-amber-500" },
  low: { color: "text-red-400", bg: "bg-red-500" },
} as const;

export function getProbabilityColor(probability: number) {
  if (probability >= 0.7) return SUCCESS_PROBABILITY_COLORS.high;
  if (probability >= 0.5) return SUCCESS_PROBABILITY_COLORS.medium;
  return SUCCESS_PROBABILITY_COLORS.low;
}
