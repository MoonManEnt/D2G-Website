"use client";

/**
 * SENTRY SUCCESS PROBABILITY GAUGE
 *
 * Visual gauge showing dispute success probability with factor breakdown.
 * Now includes actionable recommendations with Accept & Apply buttons.
 */

import { useState } from "react";
import {
  type SuccessProbabilityGaugeProps,
  type SuccessFactorUI,
  type ActionableRecommendationUI,
  getProbabilityColor,
} from "./types";
import { ActionableRecommendationsPanel } from "./actionable-recommendations";

export function SuccessProbabilityGauge({
  probability,
  confidence,
  breakdown,
  recommendations,
  actionableRecommendations,
  onApplyRecommendation,
  onRevertRecommendation,
  onResetRecommendations,
}: SuccessProbabilityGaugeProps) {
  const [showDetails, setShowDetails] = useState(false);
  const probabilityPercent = Math.round(probability * 100);
  const colorScheme = getProbabilityColor(probability);

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-muted-foreground">Success Probability</h3>
        <span className={`text-xs px-2 py-0.5 rounded ${
          confidence === "HIGH" ? "bg-emerald-500/20 text-emerald-400" :
          confidence === "MEDIUM" ? "bg-amber-500/20 text-amber-400" :
          "bg-muted text-muted-foreground"
        }`}>
          {confidence} confidence
        </span>
      </div>

      {/* Gauge */}
      <div className="relative mb-4">
        {/* Background track */}
        <div className="h-4 bg-muted rounded-full overflow-hidden">
          {/* Filled portion */}
          <div
            className={`h-full ${colorScheme.bg} transition-all duration-500 rounded-full`}
            style={{ width: `${probabilityPercent}%` }}
          />
        </div>

        {/* Percentage label */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-sm font-bold ${colorScheme.color}`}>
            {probabilityPercent}%
          </span>
        </div>
      </div>

      {/* Quick label */}
      <p className={`text-sm ${colorScheme.color} mb-3`}>
        {probability >= 0.7 ? "High likelihood of success" :
         probability >= 0.5 ? "Moderate likelihood of success" :
         probability >= 0.3 ? "Some chance of success" :
         "Lower likelihood - consider strengthening dispute"}
      </p>

      {/* Toggle details */}
      {(breakdown || recommendations) && (
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-muted-foreground hover:text-muted-foreground flex items-center gap-1"
        >
          {showDetails ? "Hide" : "Show"} details
          <svg
            className={`w-3 h-3 transition-transform ${showDetails ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {/* Details */}
      {showDetails && (
        <div className="mt-4 space-y-4">
          {/* Factor breakdown */}
          {breakdown && breakdown.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Factor Breakdown</h4>
              <div className="space-y-2">
                {breakdown.map((factor) => (
                  <FactorBar key={factor.name} factor={factor} />
                ))}
              </div>
            </div>
          )}

          {/* Actionable Recommendations */}
          {actionableRecommendations && actionableRecommendations.length > 0 && onApplyRecommendation && (
            <ActionableRecommendationsPanel
              recommendations={actionableRecommendations}
              onApply={onApplyRecommendation}
              onRevert={onRevertRecommendation}
              onReset={onResetRecommendations}
              hasAppliedRecommendations={actionableRecommendations.some(r => r.status === "APPLIED")}
            />
          )}

          {/* Text Recommendations (fallback when no actionable recommendations) */}
          {(!actionableRecommendations || actionableRecommendations.length === 0 || !onApplyRecommendation) &&
            recommendations && recommendations.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Recommendations</h4>
              <ul className="space-y-1">
                {recommendations.map((rec, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-amber-400 mt-0.5">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FactorBar({ factor }: { factor: SuccessFactorUI }) {
  const scorePercent = Math.round(factor.score * 100);
  const weightPercent = Math.round(factor.weight * 100);

  return (
    <div className="group">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{factor.name}</span>
        <span className="text-muted-foreground">{weightPercent}% weight</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            factor.score >= 0.7 ? "bg-emerald-500" :
            factor.score >= 0.5 ? "bg-amber-500" :
            "bg-red-500"
          }`}
          style={{ width: `${scorePercent}%` }}
        />
      </div>
      {/* Tooltip on hover */}
      <div className="hidden group-hover:block mt-1">
        <p className="text-xs text-muted-foreground">{factor.explanation}</p>
      </div>
    </div>
  );
}

export default SuccessProbabilityGauge;
