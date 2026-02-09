"use client";

/**
 * ACTIONABLE RECOMMENDATIONS PANEL
 *
 * Displays AI-generated recommendations that users can apply with a single click.
 * Each recommendation modifies the dispute letter to improve success probability.
 */

import { useState } from "react";
import type { ActionableRecommendationUI } from "./types";

interface ActionableRecommendationsProps {
  recommendations: ActionableRecommendationUI[];
  onApply: (recommendation: ActionableRecommendationUI) => Promise<void>;
  onRevert?: (recommendationId: string) => Promise<void>;
  onReset?: () => Promise<void>;
  hasAppliedRecommendations?: boolean;
}

const PRIORITY_COLORS = {
  HIGH: {
    badge: "bg-red-500/20 text-red-400 border-red-500/30",
    card: "border-red-500/30 hover:border-red-500/50",
  },
  MEDIUM: {
    badge: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    card: "border-amber-500/30 hover:border-amber-500/50",
  },
  LOW: {
    badge: "bg-primary/20 text-primary border-primary/30",
    card: "border-primary/30 hover:border-blue-500/50",
  },
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  ENABLE_METRO2: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  CHANGE_EOSCAR_CODE: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
    </svg>
  ),
  APPLY_OCR_FIXES: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  ADD_DOCUMENTATION: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  ADD_LEGAL_CITATION: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
    </svg>
  ),
  REMOVE_HARD_INQUIRY: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
    </svg>
  ),
  CORRECT_NAME_SPELLING: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  REMOVE_PREVIOUS_ADDRESS: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

export function ActionableRecommendationsPanel({
  recommendations,
  onApply,
  onRevert,
  onReset,
  hasAppliedRecommendations = false,
}: ActionableRecommendationsProps) {
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const pendingRecommendations = recommendations.filter((r) => r.status === "PENDING");
  const appliedRecommendations = recommendations.filter((r) => r.status === "APPLIED");

  const handleApply = async (recommendation: ActionableRecommendationUI) => {
    setApplyingId(recommendation.id);
    try {
      await onApply(recommendation);
    } finally {
      setApplyingId(null);
    }
  };

  const handleRevert = async (recommendationId: string) => {
    if (onRevert) {
      setApplyingId(recommendationId);
      try {
        await onRevert(recommendationId);
      } finally {
        setApplyingId(null);
      }
    }
  };

  if (recommendations.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        <svg className="w-8 h-8 mx-auto mb-2 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p>Your dispute is well optimized!</p>
        <p className="text-xs text-muted-foreground mt-1">No additional recommendations at this time.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with reset button */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground">
          Amelia&apos;s Recommendations
        </h4>
        {hasAppliedRecommendations && onReset && (
          <button
            onClick={onReset}
            className="text-xs text-muted-foreground hover:text-red-400 transition-colors flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset All
          </button>
        )}
      </div>

      {/* Applied recommendations (collapsed view) */}
      {appliedRecommendations.length > 0 && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{appliedRecommendations.length} recommendation(s) applied</span>
          </div>
          <div className="mt-2 space-y-1">
            {appliedRecommendations.map((rec) => (
              <div key={rec.id} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{rec.title}</span>
                {onRevert && (
                  <button
                    onClick={() => handleRevert(rec.id)}
                    disabled={applyingId === rec.id}
                    className="text-muted-foreground hover:text-red-400 transition-colors"
                  >
                    {applyingId === rec.id ? (
                      <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      "Undo"
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending recommendations */}
      {pendingRecommendations.length > 0 && (
        <div className="space-y-3">
          {pendingRecommendations.map((rec) => (
            <RecommendationCard
              key={rec.id}
              recommendation={rec}
              isExpanded={expandedId === rec.id}
              isApplying={applyingId === rec.id}
              onToggleExpand={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
              onApply={() => handleApply(rec)}
            />
          ))}
        </div>
      )}

      {/* Potential gain summary */}
      {pendingRecommendations.length > 0 && (
        <div className="p-3 rounded-lg bg-card border border-border">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Potential improvement</span>
            <span className="text-emerald-400 font-medium">
              +{Math.round(pendingRecommendations.reduce((sum, r) => sum + r.potentialGainValue * 100, 0))}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Apply all recommendations to maximize success rate
          </p>
        </div>
      )}
    </div>
  );
}

interface RecommendationCardProps {
  recommendation: ActionableRecommendationUI;
  isExpanded: boolean;
  isApplying: boolean;
  onToggleExpand: () => void;
  onApply: () => void;
}

function RecommendationCard({
  recommendation,
  isExpanded,
  isApplying,
  onToggleExpand,
  onApply,
}: RecommendationCardProps) {
  const colors = PRIORITY_COLORS[recommendation.priority];
  const icon = TYPE_ICONS[recommendation.type] || TYPE_ICONS.ENABLE_METRO2;

  return (
    <div className={`rounded-lg border bg-card transition-colors ${colors.card}`}>
      {/* Header */}
      <div className="p-4">
        {/* Top row: Icon and gain badge */}
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2 rounded-lg flex-shrink-0 ${colors.badge.replace('text-', 'text-').replace('bg-', 'bg-').replace('/20', '/30')}`}>
            {icon}
          </div>
          <span className={`px-2.5 py-1 text-xs font-medium rounded-full border whitespace-nowrap ${colors.badge}`}>
            {recommendation.potentialGain}
          </span>
        </div>

        {/* Title */}
        <h5 className="text-sm font-medium text-foreground mb-2 leading-tight">
          {recommendation.title}
        </h5>

        {/* Description */}
        <p className="text-xs text-muted-foreground leading-relaxed mb-4">
          {recommendation.description}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <button
            onClick={onToggleExpand}
            className="text-xs text-muted-foreground hover:text-muted-foreground transition-colors flex items-center gap-1"
          >
            {isExpanded ? "Hide details" : "Show preview"}
            <svg
              className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <button
            onClick={onApply}
            disabled={isApplying}
            className="px-4 py-1.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isApplying ? (
              <>
                <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Apply
              </>
            )}
          </button>
        </div>
      </div>

      {/* Expanded preview */}
      {isExpanded && (recommendation.previewBefore || recommendation.previewAfter) && (
        <div className="border-t border-border p-3 space-y-2">
          {recommendation.previewBefore && (
            <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
              <div className="text-xs text-red-400 mb-1">Before</div>
              <p className="text-xs text-muted-foreground line-through opacity-75">
                {recommendation.previewBefore}
              </p>
            </div>
          )}
          {recommendation.previewAfter && (
            <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
              <div className="text-xs text-emerald-400 mb-1">After</div>
              <p className="text-xs text-muted-foreground">
                {recommendation.previewAfter}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ActionableRecommendationsPanel;
