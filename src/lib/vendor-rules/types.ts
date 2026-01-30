export type RuleConditionField =
  | "credit_score_min"
  | "credit_score_max"
  | "credit_score_avg"
  | "has_collections"
  | "collection_count_min"
  | "collection_balance_min"
  | "has_charge_offs"
  | "charge_off_count_min"
  | "total_debt_min"
  | "total_debt_max"
  | "account_count_min"
  | "account_count_max"
  | "dispute_stage"
  | "dna_classification"
  | "health_score_min"
  | "health_score_max"
  | "improvement_potential_min"
  | "utilization_min"
  | "utilization_max"
  | "has_income"
  | "income_min"
  | "income_max"
  | "readiness_product_type"
  | "approval_likelihood_max"
  | "inquiry_count_min";

export interface RuleCondition {
  field: RuleConditionField;
  operator: "equals" | "not_equals" | "greater_than" | "less_than" | "in" | "not_in" | "between";
  value: string | number | boolean | string[];
  valueEnd?: number;
}

export interface ClientEvaluationContext {
  creditScores: { cra: string; score: number; scoreType: string }[];
  avgScore: number;
  minScore: number;
  maxScore: number;
  accounts: { accountType: string | null; accountStatus: string; balance: number | null; creditLimit: number | null }[];
  collectionCount: number;
  collectionBalance: number;
  chargeOffCount: number;
  totalDebt: number;
  utilization: number;
  accountCount: number;
  disputeStage: string;
  dnaClassification?: string;
  healthScore?: number;
  improvementPotential?: number;
  statedIncome?: number;
  hasIncome: boolean;
  inquiryCount: number;
  readinessProductType?: string;
  approvalLikelihood?: number;
}

export interface VendorRecommendation {
  vendorId: string;
  vendorName: string;
  category: string;
  ruleId: string;
  ruleName: string;
  title: string;
  body: string;
  ctaText: string;
  affiliateUrl: string;
  priority: number;
}
