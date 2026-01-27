"use client";

/**
 * SENTRY LETTER BUILDER
 *
 * Interactive letter editor with real-time analysis.
 */

import { useState, useCallback, useEffect } from "react";
import { type SentryLetterBuilderProps } from "./types";

export function SentryLetterBuilder({
  disputeId,
  initialContent,
  onSave,
  onGenerate,
}: SentryLetterBuilderProps) {
  const [content, setContent] = useState(initialContent || "");
  const [isEditing, setIsEditing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Sync content when initialContent changes (e.g., after regeneration or applying recommendations)
  useEffect(() => {
    if (!isEditing && initialContent !== undefined) {
      setContent(initialContent);
      setHasChanges(false);
    }
  }, [initialContent, isEditing]);

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    setHasChanges(newContent !== initialContent);
  }, [initialContent]);

  const handleSave = () => {
    onSave(content);
    setHasChanges(false);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setContent(initialContent || "");
    setHasChanges(false);
    setIsEditing(false);
  };

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700/50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-slate-300">Letter Content</h3>
          {hasChanges && (
            <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
              Unsaved changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  hasChanges
                    ? "bg-blue-500 text-white hover:bg-blue-600"
                    : "bg-slate-700 text-slate-500 cursor-not-allowed"
                }`}
              >
                Save Changes
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-300 border border-slate-600 rounded-lg"
              >
                Edit
              </button>
              <button
                onClick={async () => {
                  setIsRegenerating(true);
                  try {
                    await onGenerate();
                  } finally {
                    setIsRegenerating(false);
                  }
                }}
                disabled={isRegenerating}
                className="px-3 py-1.5 text-xs bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isRegenerating ? (
                  <>
                    <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  "Regenerate"
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Toolbar (when editing) */}
      {isEditing && (
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/30 border-b border-slate-700/50">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="px-2 py-1 text-xs text-slate-400 hover:text-slate-300"
          >
            Insert Template
          </button>
          <span className="text-slate-600">|</span>
          <button
            onClick={() => {
              const newContent = content + "\n\n[Insert Account List Here]";
              handleContentChange(newContent);
            }}
            className="px-2 py-1 text-xs text-slate-400 hover:text-slate-300"
          >
            + Account List
          </button>
          <button
            onClick={() => {
              const newContent = content + "\n\n[Insert Metro 2 Fields Here]";
              handleContentChange(newContent);
            }}
            className="px-2 py-1 text-xs text-slate-400 hover:text-slate-300"
          >
            + Metro 2 Fields
          </button>
        </div>
      )}

      {/* Template dropdown */}
      {showTemplates && (
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700/50">
          <p className="text-xs text-slate-400 mb-2">Quick insert sections:</p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "FCRA Rights", text: "\n\nUnder the Fair Credit Reporting Act (15 USC 1681i), you are required to conduct a reasonable investigation within 30 days of receiving this dispute." },
              { label: "Verification Challenge", text: "\n\nPlease provide documentation showing how this information was verified, including the name and contact information of any furnisher contacted." },
              { label: "Deadline Warning", text: "\n\nIf this matter is not resolved within the 30-day period required by law, I reserve all rights available under FCRA Sections 1681n and 1681o." },
              { label: "MOV Request", text: "\n\nI request a description of the procedure used to determine the accuracy of the disputed information (15 USC 1681i(a)(6)(B)(iii))." },
            ].map((template) => (
              <button
                key={template.label}
                onClick={() => {
                  handleContentChange(content + template.text);
                  setShowTemplates(false);
                }}
                className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors"
              >
                {template.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Editor */}
      <div className="p-4">
        {isEditing ? (
          <textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            className="w-full h-[500px] bg-slate-900/50 border border-slate-700/50 rounded-lg p-4 font-mono text-sm text-slate-300 resize-none focus:outline-none focus:border-blue-500/50"
            placeholder="Enter your dispute letter content here..."
          />
        ) : content ? (
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4 max-h-[500px] overflow-y-auto">
            <pre className="font-mono text-sm text-slate-300 whitespace-pre-wrap">
              {content}
            </pre>
          </div>
        ) : (
          <div className="text-center py-16 bg-slate-900/30 rounded-lg border border-dashed border-slate-700">
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
            <p className="text-slate-400 mb-4">No letter content yet</p>
            <button
              onClick={onGenerate}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
            >
              Generate Letter
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      {content && (
        <div className="px-4 py-3 border-t border-slate-700/50 bg-slate-800/30 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span>{content.split(/\s+/).length} words</span>
            <span>{content.length} characters</span>
          </div>
          <span>Dispute ID: {disputeId.slice(0, 8)}...</span>
        </div>
      )}
    </div>
  );
}

export default SentryLetterBuilder;
