"use client";

/**
 * SENTRY LEGAL CITATION CHECKER
 *
 * Displays legal citation validation results with fixes.
 */

import { useState } from "react";
import { type LegalCitationCheckerProps } from "./types";

export function LegalCitationChecker({
  validation,
  onFixCitation,
}: LegalCitationCheckerProps) {
  const [activeTab, setActiveTab] = useState<"valid" | "invalid" | "warnings">(
    validation.invalidCitations.length > 0 ? "invalid" : "valid"
  );

  const tabs = [
    { key: "valid" as const, label: "Valid", count: validation.validCitations.length },
    { key: "invalid" as const, label: "Invalid", count: validation.invalidCitations.length },
    { key: "warnings" as const, label: "Warnings", count: validation.warnings.length },
  ];

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">Legal Citation Validation</h3>
        <span className={`text-xs px-2 py-0.5 rounded ${
          validation.isValid
            ? "bg-emerald-500/20 text-emerald-400"
            : "bg-red-500/20 text-red-400"
        }`}>
          {validation.isValid ? "All Valid" : "Issues Found"}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === tab.key
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-muted-foreground"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                tab.key === "invalid" && tab.count > 0
                  ? "bg-red-500/20 text-red-400"
                  : tab.key === "warnings" && tab.count > 0
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-muted text-muted-foreground"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-2">
        {/* Valid citations */}
        {activeTab === "valid" && (
          validation.validCitations.length > 0 ? (
            validation.validCitations.map((citation, i) => (
              <div
                key={i}
                className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
              >
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-foreground">{citation.statute}</p>
                    <p className="text-xs text-muted-foreground">{citation.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{citation.description}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No citations detected</p>
          )
        )}

        {/* Invalid citations */}
        {activeTab === "invalid" && (
          validation.invalidCitations.length > 0 ? (
            validation.invalidCitations.map((citation, i) => (
              <div
                key={i}
                className="p-3 rounded-lg bg-red-500/10 border border-red-500/30"
              >
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{citation.statute}</p>
                    <p className="text-xs text-red-400 mt-1">{citation.reason}</p>
                    {citation.suggestion && (
                      <div className="mt-2 p-2 rounded bg-card flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          <span className="text-muted-foreground">Suggestion:</span> {citation.suggestion}
                        </p>
                        {onFixCitation && (
                          <button
                            onClick={() => onFixCitation(citation.statute)}
                            className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                          >
                            Fix
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-4">
              <svg className="w-8 h-8 text-emerald-400 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-emerald-400">No invalid citations</p>
            </div>
          )
        )}

        {/* Warnings */}
        {activeTab === "warnings" && (
          validation.warnings.length > 0 ? (
            validation.warnings.map((warning, i) => (
              <div
                key={i}
                className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20"
              >
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-foreground">{warning.statute}</p>
                    <p className="text-xs text-amber-400">{warning.warning}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No warnings</p>
          )
        )}
      </div>

      {/* Tips */}
      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">
          <strong className="text-muted-foreground">Common mistakes:</strong> FDCPA (1692) citations sent to CRAs, criminal statutes (1681q/r), and the "excluded information" theory (1681a(d)(2)).
        </p>
      </div>
    </div>
  );
}

export default LegalCitationChecker;
