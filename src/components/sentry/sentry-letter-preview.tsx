"use client";

/**
 * SENTRY LETTER PREVIEW
 *
 * Preview letter content with highlighted issues.
 */

import { useMemo } from "react";
import { type SentryLetterPreviewProps } from "./types";

export function SentryLetterPreview({
  content,
  ocrFindings,
  invalidCitations,
  highlightIssues = true,
}: SentryLetterPreviewProps) {
  // Build highlighted content
  const highlightedContent = useMemo(() => {
    if (!highlightIssues || (!ocrFindings?.length && !invalidCitations?.length)) {
      return content;
    }

    let result = content;

    // Highlight OCR findings
    if (ocrFindings) {
      for (const finding of ocrFindings) {
        const escapedPhrase = finding.phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const className =
          finding.severity === "HIGH"
            ? "bg-red-500/30 text-red-200 px-1 rounded"
            : finding.severity === "MEDIUM"
            ? "bg-amber-500/30 text-amber-200 px-1 rounded"
            : "bg-slate-500/30 text-slate-200 px-1 rounded";

        result = result.replace(
          new RegExp(escapedPhrase, "gi"),
          `<span class="${className}" title="${finding.explanation}">${finding.phrase}</span>`
        );
      }
    }

    // Highlight invalid citations
    if (invalidCitations) {
      for (const citation of invalidCitations) {
        const escapedStatute = citation.statute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        result = result.replace(
          new RegExp(escapedStatute, "gi"),
          `<span class="bg-red-500/30 text-red-200 px-1 rounded border-b-2 border-red-500" title="${citation.reason}">${citation.statute}</span>`
        );
      }
    }

    return result;
  }, [content, ocrFindings, invalidCitations, highlightIssues]);

  // Count issues by type
  const issueCount = (ocrFindings?.length || 0) + (invalidCitations?.length || 0);
  const highCount = ocrFindings?.filter((f) => f.severity === "HIGH").length || 0;

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700/50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
        <h3 className="text-sm font-medium text-slate-300">Letter Preview</h3>
        {highlightIssues && issueCount > 0 && (
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded ${
              highCount > 0
                ? "bg-red-500/20 text-red-400"
                : "bg-amber-500/20 text-amber-400"
            }`}>
              {issueCount} issue{issueCount !== 1 ? "s" : ""} highlighted
            </span>
          </div>
        )}
      </div>

      {/* Legend */}
      {highlightIssues && issueCount > 0 && (
        <div className="flex items-center gap-4 px-4 py-2 bg-slate-800/30 border-b border-slate-700/50 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-500/30"></span>
            <span className="text-slate-400">High risk</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-amber-500/30"></span>
            <span className="text-slate-400">Medium risk</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-slate-500/30"></span>
            <span className="text-slate-400">Low risk</span>
          </span>
        </div>
      )}

      {/* Content */}
      <div className="p-4 max-h-[600px] overflow-y-auto">
        {content ? (
          <div
            className="font-mono text-sm text-slate-300 whitespace-pre-wrap leading-relaxed"
            dangerouslySetInnerHTML={{ __html: highlightedContent }}
          />
        ) : (
          <div className="text-center py-12">
            <svg
              className="w-12 h-12 text-slate-600 mx-auto mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-sm text-slate-500">No letter content</p>
            <p className="text-xs text-slate-600 mt-1">Generate a letter to preview</p>
          </div>
        )}
      </div>

      {/* Footer with stats */}
      {content && (
        <div className="px-4 py-3 border-t border-slate-700/50 bg-slate-800/30 flex items-center justify-between text-xs text-slate-500">
          <span>{content.split(/\s+/).length} words</span>
          <span>{content.length} characters</span>
          <span>{content.split("\n").length} lines</span>
        </div>
      )}
    </div>
  );
}

export default SentryLetterPreview;
