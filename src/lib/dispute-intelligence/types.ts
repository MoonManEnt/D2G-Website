/**
 * Dispute Intelligence Engine - Type Definitions
 *
 * Comprehensive types for tracking dispute responses, calculating worthiness
 * scores, and determining adaptive strategies for round progression.
 */

// =============================================================================
// CRA RESPONSE TYPES
// =============================================================================

/**
 * Possible outcomes from a CRA dispute response
 */
export type DisputeOutcome =
  | "DELETED"           // Item removed from report (SUCCESS!)
  | "VERIFIED"          // CRA claims item is accurate (escalate)
  | "UPDATED"           // CRA made changes but didn't delete
  | "NO_RESPONSE"       // 30 days passed with no response (FCRA violation)
  | "STALL_LETTER"      // Frivolous claim or request for more info
  | "PENDING"           // Still waiting for response
  | "IN_DISPUTE"        // Currently being disputed
  | "NOT_DISPUTED";     // Item not yet disputed

/**
 * Types of stall tactics CRAs use
 */
export type StallTactic =
  | "FRIVOLOUS_CLAIM"       // "Your dispute is frivolous"
  | "ID_VERIFICATION"       // "Please send ID verification"
  | "MORE_INFO_NEEDED"      // "We need more information"
  | "ALREADY_VERIFIED"      // "This was already verified"
  | "NOT_ENOUGH_DETAIL"     // "Your dispute lacks sufficient detail"
  | "DUPLICATE_DISPUTE"     // "This appears to be a duplicate"
  | "STANDARD_FORM";        // Generic form letter with no action

/**
 * Types of updates that don't result in deletion
 */
export type UpdateType =
  | "BALANCE_UPDATED"       // Balance amount changed
  | "STATUS_UPDATED"        // Account status changed
  | "DATE_CORRECTED"        // Date information corrected
  | "CREDITOR_UPDATED"      // Creditor name/info updated
  | "PAYMENT_HISTORY"       // Payment history modified
  | "COMMENT_ADDED"         // Consumer statement added
  | "PARTIAL_CORRECTION";   // Some fields corrected, not all

// =============================================================================
// DISPUTE RESPONSE TRACKING
// =============================================================================

/**
 * Complete record of a CRA's response to a dispute
 */
export interface DisputeResponse {
  id: string;
  disputeId: string;
  disputeItemId: string;
  cra: "TRANSUNION" | "EXPERIAN" | "EQUIFAX";

  // Response details
  outcome: DisputeOutcome;
  responseDate: Date;
  responseMethod: "MAIL" | "ONLINE" | "PHONE" | "EMAIL";

  // For STALL_LETTER outcomes
  stallTactic?: StallTactic;
  stallDetails?: string;

  // For UPDATED outcomes
  updateType?: UpdateType;
  previousValue?: string;
  newValue?: string;

  // For VERIFIED outcomes
  verificationMethod?: string;  // "Electronic verification", "Direct contact", etc.
  furnisherResponse?: string;   // What the furnisher told the CRA

  // Documentation
  responseLetterFileId?: string;  // Uploaded response letter
  notes?: string;

  // Timing
  daysToRespond: number;  // Days from dispute sent to response received
  fcraDeadlineDate: Date; // 30-day deadline
  wasLate: boolean;       // Did they miss the 30-day deadline?

  // Metadata
  recordedBy: string;     // User ID who recorded this
  recordedAt: Date;
}

/**
 * Summary of responses for a complete dispute (may include multiple items)
 */
export interface DisputeResponseSummary {
  disputeId: string;
  totalItems: number;
  responseBreakdown: {
    deleted: number;
    verified: number;
    updated: number;
    noResponse: number;
    stallLetter: number;
    pending: number;
  };
  successRate: number;          // Percentage deleted
  avgDaysToRespond: number;
  fcraViolations: number;       // Items with no response past 30 days
  needsEscalation: number;      // Items that should go to next round
  recommendedNextAction: NextRoundAction;
}

// =============================================================================
// DISPUTE WORTHINESS SCORING
// =============================================================================

/**
 * Factors that influence dispute worthiness
 */
export interface WorthinessFactors {
  // Account characteristics
  accountAge: number;           // Months since account opened
  derogAge: number;             // Months since derogatory event
  balance: number;              // Current balance
  isCollection: boolean;
  isChargeOff: boolean;
  hasLatePayments: boolean;

  // Bureau factors
  bureauReporting: number;      // How many bureaus report this (1-3)
  hasDivergence: boolean;       // Different data across bureaus

  // Previous dispute history
  previousDisputes: number;     // Times this item was disputed
  previousOutcomes: DisputeOutcome[];
  wasEverDeleted: boolean;      // Deleted from any bureau

  // Documentation strength
  hasEvidence: boolean;         // Evidence uploaded
  evidenceStrength: "NONE" | "WEAK" | "MODERATE" | "STRONG";

  // Legal factors
  potentialViolations: string[];  // FCRA/FDCPA violations identified
  statuteOfLimitations: number;   // Months until SOL expires
  isTimeBared: boolean;           // Past SOL for legal action
}

/**
 * Complete worthiness assessment for a disputable item
 */
export interface DisputeWorthiness {
  accountItemId: string;
  creditorName: string;
  accountNumber: string;

  // Overall scores (0-100)
  worthinessScore: number;
  priorityScore: number;
  successLikelihood: number;

  // Score components
  factors: WorthinessFactors;

  // Timing recommendation
  timing: "IMMEDIATE" | "NEXT_ROUND" | "WAIT" | "STRATEGIC_HOLD";
  timingReason: string;

  // Strategy recommendation
  recommendedFlow: "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO";
  recommendedApproach: DisputeApproach;
  alternativeApproaches: DisputeApproach[];

  // Expected outcomes
  expectedOutcome: DisputeOutcome;
  confidenceLevel: "LOW" | "MEDIUM" | "HIGH";

  // Impact assessment
  estimatedScoreImpact: number;   // Points if deleted
  impactReason: string;
}

/**
 * Specific dispute approach strategies
 */
export type DisputeApproach =
  | "STANDARD_ACCURACY"       // Basic accuracy dispute
  | "METHOD_OF_VERIFICATION"  // Challenge how they verified
  | "DEBT_VALIDATION"         // Demand original documents
  | "METRO2_COMPLIANCE"       // Challenge data format compliance
  | "OBSOLETE_DATA"           // Data past 7-year reporting limit
  | "DUPLICATE_ACCOUNT"       // Same debt reported twice
  | "IDENTITY_THEFT"          // Dispute based on fraud
  | "PERMISSIBLE_PURPOSE"     // Challenge right to pull credit
  | "PAID_DELETION"           // Negotiate pay-for-delete
  | "GOODWILL"                // Request removal based on history
  | "RE_AGING_VIOLATION"      // Dispute illegal date changes
  | "FCRA_VIOLATION"          // Cite specific FCRA violations
  | "FDCPA_VIOLATION";        // Cite specific FDCPA violations

// =============================================================================
// ROUND PROGRESSION & ADAPTIVE STRATEGY
// =============================================================================

/**
 * What to do next based on CRA response
 */
export type NextRoundAction =
  | "CELEBRATE"           // All items deleted!
  | "ESCALATE_SAME_CRA"   // Continue with same CRA, next round
  | "TRY_DIFFERENT_CRA"   // This CRA is resistant, try another
  | "ESCALATE_CFPB"       // File CFPB complaint
  | "ESCALATE_FTC"        // File FTC complaint
  | "ESCALATE_AG"         // File state Attorney General complaint
  | "LEGAL_REVIEW"        // Refer for legal action
  | "STRATEGIC_PAUSE"     // Wait before next action
  | "CLOSE_DISPUTE";      // No further action needed/possible

/**
 * Context for generating the next round's letter
 */
export interface NextRoundContext {
  // Previous round info
  previousRound: number;
  previousFlow: "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO";
  previousLetterDate: Date;
  previousReferenceNumber?: string;

  // Response summary
  responseSummary: DisputeResponseSummary;

  // Per-item context
  itemContexts: ItemRoundContext[];

  // Aggregate strategy
  recommendedAction: NextRoundAction;
  recommendedFlow: "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO";
  shouldChangeBureau: boolean;
  targetBureau: "TRANSUNION" | "EXPERIAN" | "EQUIFAX";

  // Escalation triggers
  escalationReasons: string[];
  legalThreats: string[];       // Which legal threats to include
  regulatoryMentions: string[]; // Which agencies to mention

  // Tone guidance
  toneEscalation: "MAINTAIN" | "INCREASE" | "DECREASE";
  suggestedTone: "CONCERNED" | "FRUSTRATED" | "DEMANDING" | "FINAL_WARNING" | "LITIGATION_READY";
}

/**
 * Per-item context for next round
 */
export interface ItemRoundContext {
  accountItemId: string;
  creditorName: string;

  // What happened
  previousOutcome: DisputeOutcome;
  stallTactic?: StallTactic;
  updateDetails?: string;

  // What to do
  includeInNextRound: boolean;
  newApproach: DisputeApproach;
  approachReason: string;

  // What to say
  referPreviousDispute: boolean;
  citeViolations: string[];
  demandSpecifics: string[];

  // Evidence
  attachEvidence: boolean;
  evidenceDescription?: string;
}

// =============================================================================
// LETTER ADAPTATION RULES
// =============================================================================

/**
 * Rules for how AMELIA should adapt based on response
 */
export interface LetterAdaptationRules {
  outcome: DisputeOutcome;

  // Opening paragraph adaptations
  openingTone: string;
  referPreviousDispute: boolean;
  previousDisputeReference: string;

  // Body adaptations
  challengeVerification: boolean;
  verificationChallenge: string;
  citeNewStatutes: string[];
  escalationLanguage: string[];

  // Demand adaptations
  demandTone: "REQUEST" | "DEMAND" | "FINAL_DEMAND" | "LEGAL_NOTICE";
  specificDemands: string[];
  deadline: string;

  // Threat adaptations
  includeLegalThreats: boolean;
  threats: string[];
  regulatoryMentions: string[];

  // Evidence requirements
  requestDocumentation: boolean;
  documentationRequests: string[];
}

/**
 * Pre-defined adaptation rules for each outcome type
 */
export const ADAPTATION_RULES: Record<DisputeOutcome, LetterAdaptationRules> = {
  DELETED: {
    outcome: "DELETED",
    openingTone: "acknowledgment",
    referPreviousDispute: false,
    previousDisputeReference: "",
    challengeVerification: false,
    verificationChallenge: "",
    citeNewStatutes: [],
    escalationLanguage: [],
    demandTone: "REQUEST",
    specificDemands: [],
    deadline: "",
    includeLegalThreats: false,
    threats: [],
    regulatoryMentions: [],
    requestDocumentation: false,
    documentationRequests: [],
  },

  VERIFIED: {
    outcome: "VERIFIED",
    openingTone: "frustrated_challenge",
    referPreviousDispute: true,
    previousDisputeReference: "Despite my previous dispute dated {previousDate}, you claim to have verified this account. I challenge this verification and demand proof.",
    challengeVerification: true,
    verificationChallenge: "Under 15 U.S.C. § 1681i(a)(6), you are required to provide me with a description of the procedure used to determine the accuracy and completeness of the information. Your generic 'verified' response is insufficient.",
    citeNewStatutes: ["15 U.S.C. § 1681i(a)(6)", "15 U.S.C. § 1681i(a)(7)"],
    escalationLanguage: [
      "Your failure to conduct a reasonable investigation is a violation of the FCRA.",
      "I have reason to believe you used an automated eOSCAR system without meaningful review.",
    ],
    demandTone: "DEMAND",
    specificDemands: [
      "Provide the method of verification used",
      "Provide the name, address, and telephone number of each person contacted",
      "Provide the business records relied upon to verify this account",
    ],
    deadline: "within 15 days of receipt of this letter",
    includeLegalThreats: true,
    threats: [
      "If you fail to provide this information, I will have no choice but to file a complaint with the Consumer Financial Protection Bureau.",
    ],
    regulatoryMentions: ["CFPB", "FTC"],
    requestDocumentation: true,
    documentationRequests: [
      "Complete payment history",
      "Original signed contract or agreement",
      "Proof of the original creditor's assignment",
    ],
  },

  UPDATED: {
    outcome: "UPDATED",
    openingTone: "partial_acknowledgment",
    referPreviousDispute: true,
    previousDisputeReference: "While I acknowledge the update made to this account following my previous dispute, the fundamental inaccuracies remain.",
    challengeVerification: true,
    verificationChallenge: "The partial correction indicates you acknowledge errors existed. I demand complete accuracy, not partial fixes.",
    citeNewStatutes: ["15 U.S.C. § 1681e(b)", "15 U.S.C. § 1681i"],
    escalationLanguage: [
      "A partial correction is an admission that errors existed.",
      "The remaining inaccuracies continue to damage my credit standing.",
    ],
    demandTone: "DEMAND",
    specificDemands: [
      "Complete deletion of this inaccurate account",
      "Documentation of what was corrected and why",
    ],
    deadline: "within 30 days",
    includeLegalThreats: true,
    threats: [
      "Continued reporting of inaccurate information exposes you to liability under the FCRA.",
    ],
    regulatoryMentions: ["CFPB"],
    requestDocumentation: true,
    documentationRequests: [
      "Explanation of what changes were made",
      "Proof that remaining information is accurate",
    ],
  },

  NO_RESPONSE: {
    outcome: "NO_RESPONSE",
    openingTone: "formal_violation_notice",
    referPreviousDispute: true,
    previousDisputeReference: "On {previousDate}, I submitted a dispute regarding this account. The FCRA-mandated 30-day response period has expired without any response from your agency.",
    challengeVerification: false,
    verificationChallenge: "",
    citeNewStatutes: ["15 U.S.C. § 1681i(a)(1)", "15 U.S.C. § 1681n", "15 U.S.C. § 1681o"],
    escalationLanguage: [
      "Your failure to respond within 30 days is a clear violation of 15 U.S.C. § 1681i(a)(1).",
      "Under the FCRA, you are now required to delete this item immediately.",
      "Your willful noncompliance exposes you to statutory damages of $100 to $1,000 per violation.",
    ],
    demandTone: "LEGAL_NOTICE",
    specificDemands: [
      "Immediate deletion of this account from my credit report",
      "Written confirmation of deletion within 5 business days",
    ],
    deadline: "within 5 business days",
    includeLegalThreats: true,
    threats: [
      "I am prepared to pursue all legal remedies available under the FCRA.",
      "This includes actual damages, statutory damages, punitive damages, and attorney's fees.",
      "I am also filing complaints with the CFPB and FTC regarding this violation.",
    ],
    regulatoryMentions: ["CFPB", "FTC", "State Attorney General"],
    requestDocumentation: false,
    documentationRequests: [],
  },

  STALL_LETTER: {
    outcome: "STALL_LETTER",
    openingTone: "rejection_of_stall",
    referPreviousDispute: true,
    previousDisputeReference: "Your response to my dispute dated {previousDate} is a transparent attempt to circumvent your obligations under the FCRA.",
    challengeVerification: true,
    verificationChallenge: "Your claim that my dispute is 'frivolous' or requires additional information is without merit and appears designed to avoid your statutory duties.",
    citeNewStatutes: ["15 U.S.C. § 1681i(a)(1)", "15 U.S.C. § 1681i(a)(3)"],
    escalationLanguage: [
      "The FCRA requires you to conduct a reasonable investigation of my dispute - not to demand additional documentation.",
      "My original dispute contained sufficient detail to identify the disputed information and explain the basis of the dispute.",
      "Your attempt to shift the burden of proof onto me is improper.",
    ],
    demandTone: "FINAL_DEMAND",
    specificDemands: [
      "Conduct the investigation required by law",
      "Provide the results within 30 days of my original dispute",
      "Delete the disputed information if you cannot verify it",
    ],
    deadline: "immediately",
    includeLegalThreats: true,
    threats: [
      "Your stall tactics are well-documented violations of consumer rights.",
      "I will pursue CFPB and FTC complaints if you do not comply.",
    ],
    regulatoryMentions: ["CFPB", "FTC"],
    requestDocumentation: false,
    documentationRequests: [],
  },

  PENDING: {
    outcome: "PENDING",
    openingTone: "neutral",
    referPreviousDispute: false,
    previousDisputeReference: "",
    challengeVerification: false,
    verificationChallenge: "",
    citeNewStatutes: [],
    escalationLanguage: [],
    demandTone: "REQUEST",
    specificDemands: [],
    deadline: "",
    includeLegalThreats: false,
    threats: [],
    regulatoryMentions: [],
    requestDocumentation: false,
    documentationRequests: [],
  },

  IN_DISPUTE: {
    outcome: "IN_DISPUTE",
    openingTone: "neutral",
    referPreviousDispute: false,
    previousDisputeReference: "",
    challengeVerification: false,
    verificationChallenge: "",
    citeNewStatutes: [],
    escalationLanguage: [],
    demandTone: "REQUEST",
    specificDemands: [],
    deadline: "",
    includeLegalThreats: false,
    threats: [],
    regulatoryMentions: [],
    requestDocumentation: false,
    documentationRequests: [],
  },

  NOT_DISPUTED: {
    outcome: "NOT_DISPUTED",
    openingTone: "neutral",
    referPreviousDispute: false,
    previousDisputeReference: "",
    challengeVerification: false,
    verificationChallenge: "",
    citeNewStatutes: [],
    escalationLanguage: [],
    demandTone: "REQUEST",
    specificDemands: [],
    deadline: "",
    includeLegalThreats: false,
    threats: [],
    regulatoryMentions: [],
    requestDocumentation: false,
    documentationRequests: [],
  },
};

// =============================================================================
// DISPUTE INTELLIGENCE ANALYSIS
// =============================================================================

/**
 * Complete intelligence report for dispute strategy
 */
export interface DisputeIntelligenceReport {
  clientId: string;
  reportId: string;
  analyzedAt: Date;

  // Overall assessment
  totalDisputableItems: number;
  readyToDispute: number;
  inProgress: number;
  resolved: number;

  // Worthiness rankings
  worthinessRankings: DisputeWorthiness[];

  // Active disputes status
  activeDisputes: ActiveDisputeStatus[];

  // Round progression recommendations
  roundProgressions: RoundProgression[];

  // Strategic insights
  insights: string[];
  warnings: string[];
  opportunities: string[];

  // Next actions
  immediateActions: string[];
  scheduledActions: ScheduledAction[];
}

/**
 * Status of an active dispute
 */
export interface ActiveDisputeStatus {
  disputeId: string;
  cra: "TRANSUNION" | "EXPERIAN" | "EQUIFAX";
  flow: "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO";
  round: number;
  sentDate: Date;
  deadlineDate: Date;
  daysRemaining: number;
  status: "WAITING" | "OVERDUE" | "RESPONSE_RECEIVED";
  itemCount: number;
  responsesReceived: number;
}

/**
 * Recommendation for progressing to next round
 */
export interface RoundProgression {
  disputeId: string;
  currentRound: number;
  recommendedNextRound: number;
  recommendedFlow: "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO";
  shouldProgressNow: boolean;
  progressionReason: string;
  itemsToInclude: string[];       // AccountItem IDs
  itemsToExclude: string[];       // AccountItem IDs (deleted or strategic hold)
  nextRoundContext: NextRoundContext;
}

/**
 * A scheduled future action
 */
export interface ScheduledAction {
  actionType: "SEND_ROUND" | "FOLLOW_UP" | "CHECK_RESPONSE" | "FILE_COMPLAINT";
  scheduledFor: Date;
  description: string;
  disputeId?: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}
