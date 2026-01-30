import type { VendorRecommendation, ClientEvaluationContext, RuleCondition } from "./types";
import { evaluateAllConditions } from "./rule-evaluator";

interface VendorWithRules {
  id: string;
  name: string;
  category: string;
  affiliateUrl: string | null;
  rules: Array<{
    id: string;
    name: string;
    priority: number;
    isActive: boolean;
    conditions: string; // JSON string
    recommendationTitle: string;
    recommendationBody: string;
    recommendationCTA: string | null;
    customAffiliateUrl: string | null;
  }>;
}

/**
 * Evaluate all vendor rules against a client context and return matching recommendations.
 *
 * For each vendor:
 * 1. Filter to active rules, sorted by priority descending
 * 2. Parse the JSON conditions
 * 3. Evaluate all conditions against the client context
 * 4. Take only the first (highest priority) matched rule per vendor
 * 5. Return sorted results by priority descending
 */
export function evaluateVendorsForClient(
  vendors: VendorWithRules[],
  context: ClientEvaluationContext
): VendorRecommendation[] {
  const recommendations: VendorRecommendation[] = [];

  for (const vendor of vendors) {
    // Filter active rules and sort by priority descending (highest first)
    const activeRules = vendor.rules
      .filter((rule) => rule.isActive)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of activeRules) {
      // Parse conditions from JSON
      let conditions: RuleCondition[];
      try {
        conditions = JSON.parse(rule.conditions) as RuleCondition[];
      } catch {
        // Skip rules with invalid condition JSON
        continue;
      }

      // Evaluate all conditions (AND logic)
      if (evaluateAllConditions(conditions, context)) {
        // Use custom affiliate URL if set, otherwise fall back to vendor-level URL
        const affiliateUrl = rule.customAffiliateUrl || vendor.affiliateUrl || "";

        recommendations.push({
          vendorId: vendor.id,
          vendorName: vendor.name,
          category: vendor.category,
          ruleId: rule.id,
          ruleName: rule.name,
          title: rule.recommendationTitle,
          body: rule.recommendationBody,
          ctaText: rule.recommendationCTA || "Learn More",
          affiliateUrl,
          priority: rule.priority,
        });

        // Only take the first matched rule per vendor (highest priority)
        break;
      }
    }
  }

  // Sort final results by priority descending
  recommendations.sort((a, b) => b.priority - a.priority);

  return recommendations;
}
