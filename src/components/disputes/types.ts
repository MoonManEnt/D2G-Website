// Types for enhanced disputes page

export interface ParsedAccountWithIssues {
  id: string;
  creditorName: string;
  maskedAccountId: string | null;
  cra: string;
  accountType: string | null;
  accountStatus: string;
  balance: number | null;
  pastDue: number | null;
  dateOpened: string | null;
  dateReported: string | null;
  paymentStatus: string | null;
  confidenceScore: number;
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW";
  isDisputable: boolean;
  suggestedFlow: string | null;
  detectedIssues: DetectedIssue[];
  bureauData: Record<string, BureauDataPoint>;
  // Enhanced tracking for smart workflow
  activeDispute?: ActiveDisputeInfo | null;
  applicableFlows?: string[]; // Only flows that make sense for this account's issues
  nextAvailableRound?: Record<string, number>; // Flow -> next available round
}

// Active dispute tracking (simplified workflow: DRAFT → SENT → RESPONDED → RESOLVED)
export interface ActiveDisputeInfo {
  disputeId: string;
  flow: string;
  round: number;
  status: "DRAFT" | "SENT" | "RESPONDED" | "RESOLVED";
  sentDate?: string;
  daysRemaining?: number; // Days until 30-day FCRA deadline
  responseDeadline?: string;
  isOverdue?: boolean;
}

export interface DetectedIssue {
  code: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  description: string;
}

export interface BureauDataPoint {
  balance: number | null;
  status: string;
}

export interface ClientWithProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  ssnLast4: string | null;
  dateOfBirth: string | null;
  stage: string;
  currentRound: number;
  priority: string;
  creditScores: {
    TU: number | null;
    EX: number | null;
    EQ: number | null;
  };
  previousNames?: string[];
  previousAddresses?: string[];
  hardInquiries?: HardInquiry[];
}

export interface HardInquiry {
  creditorName: string;
  inquiryDate: string;
  cra: string;
}

export interface AmeliaInsight {
  confidence: number;
  tone: string;
  recommendations: string[];
  riskFactors: RiskFactor[];
  suggestedStatutes: string[];
  estimatedSuccessRate: number;
}

export interface RiskFactor {
  factor: string;
  impact: "positive" | "negative";
}

export interface EOSCARScore {
  risk: number;
  level: "low" | "medium" | "high";
  humanizingPhrases: number;
  flaggedPhrases: number;
  uniquenessScore: number;
}

export interface DisputeHistoryItem {
  id: string;
  clientId?: string;
  client: {
    id?: string;
    firstName: string;
    lastName: string;
  };
  cra: string;
  flow: string;
  round: number;
  status: string;
  createdAt: string;
  sentDate?: string;  // When the letter was officially sent
  respondedAt?: string;
  letterContent?: string;
  itemCount: number;
  items?: Array<{
    id: string;
    disputeReason?: string;
    accountItem?: {
      id: string;
      creditorName: string;
      maskedAccountId?: string | null;
      balance?: number | null;
    };
  }>;
}

export interface CFPBComplaint {
  product: string;
  subProduct: string;
  issue: string;
  subIssue: string;
  companyName: string;
  narrative: string;
  desiredResolution: string;
}

// Flow configuration
export const FLOW_INFO: Record<string, { color: string; maxRounds: number; description: string }> = {
  ACCURACY: { color: "#3b82f6", maxRounds: 12, description: "Inaccurate information disputes" },
  COLLECTION: { color: "#ef4444", maxRounds: 10, description: "Debt validation challenges" },
  CONSENT: { color: "#a855f7", maxRounds: 4, description: "Unauthorized access disputes" },
  COMBO: { color: "#f59e0b", maxRounds: 12, description: "Multiple issue types combined" },
};

// CRA color configuration
export const CRA_COLORS: Record<string, { bg: string; text: string; border: string; tailwind: string }> = {
  TRANSUNION: { bg: "rgba(14, 165, 233, 0.15)", text: "#0ea5e9", border: "rgba(14, 165, 233, 0.3)", tailwind: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  EXPERIAN: { bg: "rgba(59, 130, 246, 0.15)", text: "#3b82f6", border: "rgba(59, 130, 246, 0.3)", tailwind: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  EQUIFAX: { bg: "rgba(239, 68, 68, 0.15)", text: "#ef4444", border: "rgba(239, 68, 68, 0.3)", tailwind: "bg-red-500/15 text-red-400 border-red-500/30" },
};

// Round strategies for UI
export const ROUND_STRATEGIES: Record<number, { name: string; tone: string; statute: string; approach: string }> = {
  1: { name: "Initial Dispute", tone: "professional", statute: "FCRA § 1681i", approach: "Request investigation and verification" },
  2: { name: "MOV Demand", tone: "assertive", statute: "§ 1681i(a)(6)", approach: "Challenge verification method" },
  3: { name: "Violation Notice", tone: "aggressive", statute: "§ 1681n/o", approach: "Document procedural violations" },
  4: { name: "Final Demand", tone: "litigation", statute: "§ 1681n Damages", approach: "Pre-litigation notice" },
};

// Status colors
export const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-500/20 text-slate-400",
  APPROVED: "bg-blue-500/20 text-blue-400",
  SENT: "bg-amber-500/20 text-amber-400",
  RESPONDED: "bg-purple-500/20 text-purple-400",
  RESOLVED: "bg-emerald-500/20 text-emerald-400",
  ESCALATED: "bg-red-500/20 text-red-400",
};
