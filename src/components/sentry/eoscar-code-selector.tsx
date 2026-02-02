"use client";

/**
 * SENTRY e-OSCAR CODE SELECTOR
 *
 * Interactive selector for e-OSCAR dispute codes with recommendations.
 */

import { useState } from "react";
import { type EOSCARCodeSelectorProps, type EOSCARRecommendationUI } from "./types";

// Code descriptions for display
const CODE_INFO: Record<string, { name: string; description: string; avoid?: string }> = {
  "103": {
    name: "Disputes this inquiry",
    description: "Challenge unauthorized credit inquiries",
  },
  "105": {
    name: "Not mine / Unknown",
    description: "Account does not belong to consumer - strongest for collections",
    avoid: "Requires supporting documentation for credibility",
  },
  "106": {
    name: "Belongs to another",
    description: "Account belongs to someone else - good for mixed files",
  },
  "107": {
    name: "Duplicate account",
    description: "Same account reported multiple times",
  },
  "109": {
    name: "Not liable / Authorized user",
    description: "Consumer is not legally responsible for this debt",
  },
  "110": {
    name: "Included in bankruptcy",
    description: "Account was included in bankruptcy discharge",
  },
  "111": {
    name: "Settled / Paid as agreed",
    description: "Balance dispute - account was settled or paid",
  },
  "112": {
    name: "Other (Generic)",
    description: "Generic dispute - LOWEST PRIORITY, often batch-verified",
    avoid: "Avoid if possible - has lowest success rate",
  },
};

export function EOSCARCodeSelector({
  recommendations,
  selectedCode,
  onCodeSelect,
}: EOSCARCodeSelectorProps) {
  const [showAllCodes, setShowAllCodes] = useState(false);

  // Sort recommendations by confidence
  const sortedRecs = [...recommendations].sort((a, b) => b.confidence - a.confidence);
  const topRecommendation = sortedRecs[0];

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">e-OSCAR Code Selection</h3>
        {selectedCode && (
          <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary">
            Selected: {selectedCode}
          </span>
        )}
      </div>

      {/* Top recommendation */}
      {topRecommendation && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-emerald-400 font-medium">Recommended</span>
            <span className="text-xs text-emerald-400">
              {Math.round(topRecommendation.confidence * 100)}% match
            </span>
          </div>
          <button
            onClick={() => onCodeSelect(topRecommendation.code)}
            className={`w-full text-left p-2 rounded transition-colors ${
              selectedCode === topRecommendation.code
                ? "bg-emerald-500/20 border border-emerald-500/50"
                : "hover:bg-muted"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                {topRecommendation.code} - {topRecommendation.name}
              </span>
              {selectedCode === topRecommendation.code && (
                <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{topRecommendation.reasoning}</p>
          </button>
        </div>
      )}

      {/* Other recommendations */}
      {sortedRecs.length > 1 && (
        <div className="space-y-2 mb-4">
          <h4 className="text-xs font-medium text-muted-foreground">Other Options</h4>
          {sortedRecs.slice(1).map((rec) => (
            <button
              key={rec.code}
              onClick={() => onCodeSelect(rec.code)}
              className={`w-full text-left p-2 rounded transition-colors ${
                selectedCode === rec.code
                  ? "bg-primary/20 border border-blue-500/50"
                  : "bg-muted hover:bg-muted"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {rec.code} - {rec.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {Math.round(rec.confidence * 100)}%
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Show all codes toggle */}
      <button
        onClick={() => setShowAllCodes(!showAllCodes)}
        className="text-xs text-muted-foreground hover:text-muted-foreground flex items-center gap-1"
      >
        {showAllCodes ? "Hide" : "Show"} all codes
        <svg
          className={`w-3 h-3 transition-transform ${showAllCodes ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* All codes list */}
      {showAllCodes && (
        <div className="mt-4 space-y-2 pt-4 border-t border-border">
          {Object.entries(CODE_INFO).map(([code, info]) => (
            <button
              key={code}
              onClick={() => onCodeSelect(code)}
              className={`w-full text-left p-3 rounded-lg transition-colors ${
                selectedCode === code
                  ? "bg-primary/20 border border-blue-500/50"
                  : "bg-muted hover:bg-muted"
              } ${code === "112" ? "opacity-60" : ""}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-foreground">
                  {code} - {info.name}
                </span>
                {selectedCode === code && (
                  <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{info.description}</p>
              {info.avoid && (
                <p className="text-xs text-amber-400 mt-1">⚠️ {info.avoid}</p>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Tip */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="relative px-4 py-3 rounded-lg bg-gradient-to-r from-amber-500/5 via-amber-500/10 to-amber-500/5 border border-amber-500/20 text-center">
          {/* Glow effect */}
          <div className="absolute inset-0 rounded-lg bg-amber-500/5 blur-sm animate-pulse" />
          <p className="relative text-xs text-amber-300/90">
            <strong className="text-amber-400">Tip:</strong> Avoid code 112 (Generic) - it has the lowest verification priority and highest batch-verification rate.
          </p>
        </div>
      </div>
    </div>
  );
}

export default EOSCARCodeSelector;
