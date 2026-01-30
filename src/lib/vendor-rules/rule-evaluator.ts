import type { RuleCondition, RuleConditionField, ClientEvaluationContext } from "./types";

/**
 * Resolve a rule condition field to the corresponding value from the evaluation context.
 */
function getFieldValue(field: RuleConditionField, context: ClientEvaluationContext): string | number | boolean {
  switch (field) {
    case "credit_score_min":
      return context.minScore;
    case "credit_score_max":
      return context.maxScore;
    case "credit_score_avg":
      return context.avgScore;
    case "has_collections":
      return context.collectionCount > 0;
    case "collection_count_min":
      return context.collectionCount;
    case "collection_balance_min":
      return context.collectionBalance;
    case "has_charge_offs":
      return context.chargeOffCount > 0;
    case "charge_off_count_min":
      return context.chargeOffCount;
    case "total_debt_min":
      return context.totalDebt;
    case "total_debt_max":
      return context.totalDebt;
    case "account_count_min":
      return context.accountCount;
    case "account_count_max":
      return context.accountCount;
    case "dispute_stage":
      return context.disputeStage;
    case "dna_classification":
      return context.dnaClassification ?? "";
    case "health_score_min":
      return context.healthScore ?? 0;
    case "health_score_max":
      return context.healthScore ?? 0;
    case "improvement_potential_min":
      return context.improvementPotential ?? 0;
    case "utilization_min":
      return context.utilization;
    case "utilization_max":
      return context.utilization;
    case "has_income":
      return context.hasIncome;
    case "income_min":
      return context.statedIncome ?? 0;
    case "income_max":
      return context.statedIncome ?? 0;
    case "readiness_product_type":
      return context.readinessProductType ?? "";
    case "approval_likelihood_max":
      return context.approvalLikelihood ?? 0;
    case "inquiry_count_min":
      return context.inquiryCount;
    default:
      return 0;
  }
}

/**
 * Evaluate a single rule condition against the client context.
 */
export function evaluateCondition(condition: RuleCondition, context: ClientEvaluationContext): boolean {
  const contextValue = getFieldValue(condition.field, context);

  switch (condition.operator) {
    case "equals":
      return contextValue === condition.value;

    case "not_equals":
      return contextValue !== condition.value;

    case "greater_than":
      return (contextValue as number) > (condition.value as number);

    case "less_than":
      return (contextValue as number) < (condition.value as number);

    case "in":
      return (condition.value as string[]).includes(String(contextValue));

    case "not_in":
      return !(condition.value as string[]).includes(String(contextValue));

    case "between":
      return (
        (contextValue as number) >= (condition.value as number) &&
        (contextValue as number) <= (condition.valueEnd as number)
      );

    default:
      return false;
  }
}

/**
 * Evaluate all conditions using AND logic.
 * All conditions must pass for the rule to match.
 */
export function evaluateAllConditions(conditions: RuleCondition[], context: ClientEvaluationContext): boolean {
  if (conditions.length === 0) {
    return false;
  }
  return conditions.every((condition) => evaluateCondition(condition, context));
}
