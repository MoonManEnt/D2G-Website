/**
 * Credit DNA Engine - Type Definitions
 *
 * The Credit DNA Engine analyzes a client's credit profile and classifies
 * it into actionable categories that drive dispute strategy, sequencing,
 * and recommendations.
 */

// =============================================================================
// DNA CLASSIFICATION TYPES
// =============================================================================

/**
 * Primary DNA classifications based on credit profile characteristics
 */
export type DNAClassification =
  | "THIN_FILE_REBUILDER"    // Few accounts, limited history, needs building
  | "THICK_FILE_DEROG"       // Many accounts, heavy derogatory items
  | "CLEAN_THIN"             // Few accounts, all positive, needs seasoning
  | "COLLECTION_HEAVY"       // Dominated by collection accounts
  | "LATE_PAYMENT_PATTERN"   // History of late payments across accounts
  | "MIXED_FILE"             // Complex mix of positive and negative
  | "INQUIRY_DAMAGED"        // Recent hard inquiry damage
  | "CHARGE_OFF_HEAVY"       // Multiple charge-offs
  | "IDENTITY_ISSUES"        // Potential mixed file or identity problems
  | "HIGH_UTILIZATION"       // Good accounts but maxed out
  | "RECOVERING"             // Past damage, showing improvement
  | "NEAR_PRIME";            // Close to prime, needs minor cleanup

/**
 * Sub-classifications for more granular strategy
 */
export type DNASubClassification =
  | "AUTHORIZED_USER_DEPENDENT" // Score relies heavily on AU accounts
  | "SINGLE_DEROG_IMPACT"       // One item causing most damage
  | "SYSTEMIC_LATE_PAYMENTS"    // Pattern across multiple accounts
  | "RECENT_DAMAGE"             // Negative items are recent (< 2 years)
  | "AGED_DAMAGE"               // Negative items are old (> 5 years)
  | "BUREAU_DIVERGENT"          // Significant differences between bureaus
  | "STALE_DATA"                // Many accounts not recently reported
  | "RAPID_RESCORE_CANDIDATE"   // Could see fast improvement
  | "LONG_TERM_REBUILD";        // Needs sustained effort over time

// =============================================================================
// FILE THICKNESS METRICS
// =============================================================================

export interface FileThicknessMetrics {
  totalAccounts: number;
  openAccounts: number;
  closedAccounts: number;

  // Age metrics
  oldestAccountAge: number;        // In months
  averageAccountAge: number;       // In months
  newestAccountAge: number;        // In months

  // Classification
  thickness: "ULTRA_THIN" | "THIN" | "MODERATE" | "THICK" | "VERY_THICK";

  // Specific counts by type
  revolvingAccounts: number;
  installmentAccounts: number;
  mortgageAccounts: number;
  collectionAccounts: number;
  otherAccounts: number;
}

// =============================================================================
// DEROGATORY PROFILE
// =============================================================================

export interface DerogatoryProfile {
  // Counts
  totalDerogatoryItems: number;
  collectionCount: number;
  chargeOffCount: number;
  latePaymentAccounts: number;      // Accounts with any late payment
  publicRecordCount: number;        // Bankruptcies, judgments, liens

  // Late payment breakdown
  late30Count: number;
  late60Count: number;
  late90Count: number;
  late120PlusCount: number;

  // Monetary impact
  totalCollectionBalance: number;
  totalChargeOffBalance: number;
  totalPastDue: number;

  // Age analysis
  oldestDerogAge: number;           // Months since oldest derog
  newestDerogAge: number;           // Months since newest derog
  averageDerogAge: number;

  // Severity score (0-100, higher = worse)
  severityScore: number;

  // Classification
  severity: "NONE" | "LIGHT" | "MODERATE" | "HEAVY" | "SEVERE";
}

// =============================================================================
// UTILIZATION ANALYSIS
// =============================================================================

export interface UtilizationAnalysis {
  // Aggregate utilization
  totalCreditLimit: number;
  totalBalance: number;
  overallUtilization: number;       // Percentage (0-100+)

  // Individual account analysis
  accountsOver30Percent: number;
  accountsOver50Percent: number;
  accountsOver70Percent: number;
  accountsOver90Percent: number;
  accountsMaxedOut: number;         // 95%+ or over limit

  // Optimal accounts
  accountsUnder10Percent: number;
  accountsUnder30Percent: number;

  // Classification
  status: "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "CRITICAL";

  // Impact estimate
  estimatedScoreImpact: number;     // Estimated points lost to utilization
}

// =============================================================================
// BUREAU DIVERGENCE
// =============================================================================

export interface BureauDivergence {
  // Account presence divergence
  accountsOnAllThree: number;
  accountsOnTwoOnly: number;
  accountsOnOneOnly: number;

  // Bureau-specific counts
  transunionAccountCount: number;
  experianAccountCount: number;
  equifaxAccountCount: number;

  // Balance divergence (same account, different balances)
  accountsWithBalanceDivergence: number;
  maxBalanceDivergence: number;     // Largest $ difference

  // Status divergence (same account, different statuses)
  accountsWithStatusDivergence: number;

  // Overall divergence score (0-100, higher = more divergent)
  divergenceScore: number;

  // Classification
  divergence: "ALIGNED" | "MINOR" | "MODERATE" | "SIGNIFICANT" | "SEVERE";

  // Specific issues
  missingFromBureaus: Array<{
    accountName: string;
    presentOn: string[];
    missingFrom: string[];
  }>;
}

// =============================================================================
// INQUIRY ANALYSIS
// =============================================================================

export interface InquiryAnalysis {
  // Total counts
  totalHardInquiries: number;

  // Time-based breakdown
  inquiriesLast6Months: number;
  inquiriesLast12Months: number;
  inquiriesLast24Months: number;

  // Bureau breakdown
  transunionInquiries: number;
  experianInquiries: number;
  equifaxInquiries: number;

  // Impact assessment
  estimatedScoreImpact: number;

  // Classification
  status: "MINIMAL" | "LIGHT" | "MODERATE" | "HEAVY" | "EXCESSIVE";

  // Recommendations
  monthsUntilDropOff: number;       // When oldest inquiry falls off
  inquiriesDisputable: number;      // Potentially unauthorized
}

// =============================================================================
// POSITIVE FACTORS
// =============================================================================

export interface PositiveFactors {
  // Payment history
  onTimePaymentPercentage: number;  // 0-100
  perfectPaymentAccounts: number;   // Accounts with no late payments ever

  // Account age
  hasSeasonedAccounts: boolean;     // Any account > 5 years
  oldestPositiveAccount: number;    // Months

  // Credit mix
  hasMortgage: boolean;
  hasAutoLoan: boolean;
  hasStudentLoan: boolean;
  hasRevolvingCredit: boolean;
  creditMixScore: number;           // 0-100

  // Low utilization accounts
  wellManagedAccounts: number;      // Open, low util, no lates

  // Overall positive strength
  strengthScore: number;            // 0-100
  strength: "WEAK" | "FAIR" | "MODERATE" | "STRONG" | "EXCELLENT";
}

// =============================================================================
// DISPUTE READINESS
// =============================================================================

export interface DisputeReadiness {
  // Disputable items
  totalDisputableItems: number;
  highPriorityItems: number;        // Should dispute immediately
  mediumPriorityItems: number;      // Dispute in rounds 2-3
  lowPriorityItems: number;         // Optional disputes

  // Estimated outcomes
  estimatedRemovalRate: number;     // Based on item types (0-100)
  estimatedScoreImprovement: number; // Conservative estimate

  // Recommended approach
  recommendedFlow: "ACCURACY" | "COLLECTION" | "CONSENT" | "COMBO";
  recommendedFirstBureau: "TRANSUNION" | "EXPERIAN" | "EQUIFAX";
  estimatedRounds: number;          // Expected rounds to resolution

  // Risk assessment
  complexityScore: number;          // 0-100, higher = more complex
  complexity: "SIMPLE" | "MODERATE" | "COMPLEX" | "VERY_COMPLEX";
}

// =============================================================================
// COMPLETE DNA PROFILE
// =============================================================================

export interface CreditDNAProfile {
  // Identification
  id: string;
  clientId: string;
  reportId: string;
  analyzedAt: Date;

  // Primary classification
  classification: DNAClassification;
  subClassifications: DNASubClassification[];

  // Confidence in classification
  confidence: number;               // 0-100
  confidenceLevel: "LOW" | "MEDIUM" | "HIGH";

  // Component analyses
  fileThickness: FileThicknessMetrics;
  derogatoryProfile: DerogatoryProfile;
  utilization: UtilizationAnalysis;
  bureauDivergence: BureauDivergence;
  inquiryAnalysis: InquiryAnalysis;
  positiveFactors: PositiveFactors;
  disputeReadiness: DisputeReadiness;

  // Overall scores
  overallHealthScore: number;       // 0-100
  improvementPotential: number;     // 0-100
  urgencyScore: number;             // 0-100, higher = needs immediate action

  // Narrative summary
  summary: string;                  // Human-readable summary
  keyInsights: string[];            // Top 3-5 insights
  immediateActions: string[];       // Recommended next steps

  // Metadata
  version: string;                  // Engine version
  computeTimeMs: number;
}

// =============================================================================
// INPUT TYPES
// =============================================================================

export interface DNAAnalysisInput {
  clientId: string;
  reportId: string;
  accounts: AccountForAnalysis[];
  scores: ScoreForAnalysis[];
  hardInquiries: InquiryForAnalysis[];
  previousNames: string[];
  previousAddresses: string[];
}

export interface AccountForAnalysis {
  id: string;
  creditorName: string;
  accountNumber: string;
  cra: "TRANSUNION" | "EXPERIAN" | "EQUIFAX";
  accountType: string | null;
  accountStatus: string;
  balance: number | null;
  creditLimit: number | null;
  highBalance: number | null;
  pastDue: number | null;
  dateOpened: Date | null;
  dateReported: Date | null;
  paymentStatus: string | null;
  detectedIssues: AccountIssue[];
  fingerprint: string;
}

export interface AccountIssue {
  code: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface ScoreForAnalysis {
  cra: "TRANSUNION" | "EXPERIAN" | "EQUIFAX";
  score: number;
  scoreType: string;
  scoreDate: Date;
  factorsPositive: string[];
  factorsNegative: string[];
}

export interface InquiryForAnalysis {
  creditorName: string;
  inquiryDate: string;
  cra: "TRANSUNION" | "EXPERIAN" | "EQUIFAX";
}
