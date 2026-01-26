"use client";

/**
 * SENTRY OCR RISK ANALYZER
 *
 * Displays OCR frivolous detection analysis with actionable fixes.
 */

import { useState } from "react";
import { type OCRRiskAnalyzerProps, OCR_RISK_COLORS } from "./types";

export function OCRRiskAnalyzer({
  score,
  risk,
  findings,
  onApplyFix,
}: OCRRiskAnalyzerProps) {
  const [expandedFinding, setExpandedFinding] = useState<number | null>(null);
  const riskColors = OCR_RISK_COLORS[risk];

  const highCount = findings.filter((f) => f.severity === "HIGH").length;
  const mediumCount = findings.filter((f) => f.severity === "MEDIUM").length;
  const lowCount = findings.filter((f) => f.severity === "LOW").length;

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-slate-300">OCR Safety Score</h3>
          <span className={`text-xs px-2 py-0.5 rounded ${riskColors.bg} ${riskColors.text}`}>
            {riskColors.label}
          </span>
        </div>
        <span className={`text-2xl font-bold ${riskColors.text}`}>{score}</span>
      </div>

      {/* Score bar */}
      <div className="relative h-3 bg-slate-700 rounded-full overflow-hidden mb-4">
        <div
          className={`h-full transition-all duration-500 rounded-full ${
            score >= 70 ? "bg-emerald-500" :
            score >= 40 ? "bg-amber-500" :
            "bg-red-500"
          }`}
          style={{ width: `${score}%` }}
        />
        {/* Threshold markers */}
        <div className="absolute top-0 left-[40%] h-full w-px bg-slate-600" />
        <div className="absolute top-0 left-[70%] h-full w-px bg-slate-600" />
      </div>

      {/* Summary */}
      <div className="flex gap-4 mb-4 text-xs">
        {highCount > 0 && (
          <span className="text-red-400">{highCount} high risk</span>
        )}
        {mediumCount > 0 && (
          <span className="text-amber-400">{mediumCount} medium risk</span>
        )}
        {lowCount > 0 && (
          <span className="text-slate-400">{lowCount} low risk</span>
        )}
        {findings.length === 0 && (
          <span className="text-emerald-400">No issues detected</span>
        )}
      </div>

      {/* Findings list */}
      {findings.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-slate-400">Detected Phrases</h4>
          {findings.map((finding, i) => (
            <div
              key={i}
              className={`p-3 rounded-lg border ${
                finding.severity === "HIGH"
                  ? "bg-red-500/10 border-red-500/30"
                  : finding.severity === "MEDIUM"
                  ? "bg-amber-500/10 border-amber-500/30"
                  : "bg-slate-700/50 border-slate-600/50"
              }`}
            >
              <div
                className="flex items-start justify-between cursor-pointer"
                onClick={() => setExpandedFinding(expandedFinding === i ? null : i)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      finding.severity === "HIGH"
                        ? "bg-red-500/20 text-red-400"
                        : finding.severity === "MEDIUM"
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-slate-500/20 text-slate-400"
                    }`}>
                      {finding.severity}
                    </span>
                    <span className="text-xs text-slate-500">{finding.location}</span>
                  </div>
                  <p className="text-sm text-slate-300 font-mono">"{finding.phrase}"</p>
                </div>
                <svg
                  className={`w-4 h-4 text-slate-500 transition-transform ${
                    expandedFinding === i ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {/* Expanded details */}
              {expandedFinding === i && (
                <div className="mt-3 pt-3 border-t border-slate-600/50">
                  <p className="text-xs text-slate-400 mb-2">{finding.explanation}</p>
                  {finding.suggestion && (
                    <div className="flex items-center justify-between bg-slate-800/50 rounded p-2">
                      <div>
                        <span className="text-xs text-slate-500">Suggested replacement:</span>
                        <p className="text-sm text-emerald-400 font-mono">"{finding.suggestion}"</p>
                      </div>
                      {onApplyFix && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onApplyFix(finding.phrase, finding.suggestion!);
                          }}
                          className="px-3 py-1 text-xs bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30 transition-colors"
                        >
                          Apply Fix
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tips */}
      <div className="mt-4 pt-4 border-t border-slate-700/50">
        <p className="text-xs text-slate-500">
          <strong className="text-slate-400">Tip:</strong> Letters with scores below 50 have high risk of being flagged as frivolous by bureau OCR systems.
          Aim for 70+ for best results.
        </p>
      </div>
    </div>
  );
}

export default OCRRiskAnalyzer;
