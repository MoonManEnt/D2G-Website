"use client";

/**
 * SENTRY REPORT SELECTOR
 *
 * Component for selecting an existing credit report or uploading a new one.
 * Integrates with the existing report upload/parsing infrastructure.
 */

import { useState, useCallback, useRef } from "react";
import { format } from "date-fns";

// Safe date formatting helper
const safeFormatDate = (dateStr: string | null | undefined, formatStr: string = "MMM d, yyyy"): string => {
  if (!dateStr) return "Unknown";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Unknown";
    return format(date, formatStr);
  } catch {
    return "Unknown";
  }
};

interface CreditReport {
  id: string;
  reportDate: string;
  uploadedAt: string;
  parseStatus: string;
  pageCount: number;
  sourceType: string;
  scores?: {
    transunion?: number;
    equifax?: number;
    experian?: number;
  };
  accountCount?: number;
  bureauBreakdown?: {
    transunion: number;
    equifax: number;
    experian: number;
  };
}

interface SentryReportSelectorProps {
  clientId: string;
  reports: CreditReport[];
  selectedReportId: string | null;
  onReportSelect: (reportId: string) => void;
  onReportUploaded: (report: CreditReport) => void;
  onRefreshReports: () => void;
}

type UploadStep = "idle" | "uploading" | "parsing" | "complete" | "error";

const PARSING_STAGES = [
  "Reading PDF...",
  "Extracting bureaus...",
  "Parsing accounts...",
  "Analyzing issues...",
  "Generating summary...",
];

export function SentryReportSelector({
  clientId,
  reports,
  selectedReportId,
  onReportSelect,
  onReportUploaded,
  onRefreshReports,
}: SentryReportSelectorProps) {
  const [uploadStep, setUploadStep] = useState<UploadStep>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [parsingStage, setParsingStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file upload
  const handleUpload = useCallback(
    async (file: File) => {
      if (!file.type.includes("pdf")) {
        setError("Please upload a PDF file");
        return;
      }

      try {
        setError(null);
        setUploadStep("uploading");
        setUploadProgress(0);

        // Create form data
        const formData = new FormData();
        formData.append("file", file);
        formData.append("clientId", clientId);

        // Simulate upload progress
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => Math.min(prev + 10, 90));
        }, 200);

        // Upload the file
        const response = await fetch("/api/reports/upload", {
          method: "POST",
          body: formData,
        });

        clearInterval(progressInterval);
        setUploadProgress(100);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Upload failed");
        }

        const data = await response.json();

        // Start parsing animation
        setUploadStep("parsing");
        setParsingStage(0);

        // Animate through parsing stages
        for (let i = 0; i < PARSING_STAGES.length; i++) {
          setParsingStage(i);
          await new Promise((resolve) => setTimeout(resolve, 800));
        }

        setUploadStep("complete");

        // Create report object from response
        const newReport: CreditReport = {
          id: data.id,
          reportDate: new Date().toISOString(),
          uploadedAt: new Date().toISOString(),
          parseStatus: data.status || "COMPLETED",
          pageCount: data.pageCount || 0,
          sourceType: "IDENTITYIQ",
          accountCount: data.accountsParsed || 0,
        };

        onReportUploaded(newReport);
        onReportSelect(newReport.id);

        // Reset after delay
        setTimeout(() => {
          setUploadStep("idle");
          onRefreshReports();
        }, 2000);
      } catch (err) {
        setUploadStep("error");
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    },
    [clientId, onReportUploaded, onReportSelect, onRefreshReports]
  );

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  // Handle file input change
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => uploadStep === "idle" && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          dragOver
            ? "border-blue-500 bg-blue-500/10"
            : uploadStep === "error"
            ? "border-red-500/50 bg-red-500/5"
            : uploadStep === "complete"
            ? "border-emerald-500/50 bg-emerald-500/5"
            : "border-slate-600 hover:border-slate-500 bg-slate-800/30"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Idle state */}
        {uploadStep === "idle" && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700/50 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <p className="text-slate-200 font-medium mb-1">
              Upload Credit Report
            </p>
            <p className="text-sm text-slate-400 mb-4">
              Drag and drop a PDF or click to browse
            </p>
            <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Encrypted upload
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                    clipRule="evenodd"
                  />
                </svg>
                Auto-parsed with Sentry
              </span>
            </div>
          </>
        )}

        {/* Uploading state */}
        {uploadStep === "uploading" && (
          <div className="py-4">
            <div className="w-16 h-16 mx-auto mb-4 relative">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#334155"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${uploadProgress * 2.83} 283`}
                  transform="rotate(-90 50 50)"
                  className="transition-all duration-300"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-medium text-slate-200">
                {uploadProgress}%
              </span>
            </div>
            <p className="text-slate-200 font-medium">Uploading...</p>
          </div>
        )}

        {/* Parsing state */}
        {uploadStep === "parsing" && (
          <div className="py-4">
            <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
            </div>
            <p className="text-slate-200 font-medium mb-2">
              {PARSING_STAGES[parsingStage]}
            </p>
            <div className="flex justify-center gap-1">
              {PARSING_STAGES.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i <= parsingStage ? "bg-blue-500" : "bg-slate-600"
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Complete state */}
        {uploadStep === "complete" && (
          <div className="py-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-emerald-400 font-medium">
              Report uploaded and parsed!
            </p>
          </div>
        )}

        {/* Error state */}
        {uploadStep === "error" && (
          <div className="py-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <p className="text-red-400 font-medium mb-2">Upload failed</p>
            <p className="text-sm text-slate-400">{error}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setUploadStep("idle");
                setError(null);
              }}
              className="mt-4 px-4 py-2 bg-slate-700 text-slate-200 rounded-lg text-sm hover:bg-slate-600"
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* Existing Reports */}
      {reports.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-300">
              Existing Reports ({reports.length})
            </h3>
            <button
              onClick={onRefreshReports}
              className="text-xs text-slate-400 hover:text-slate-300"
            >
              Refresh
            </button>
          </div>

          <div className="space-y-2">
            {reports.map((report) => {
              const isSelected = selectedReportId === report.id;
              const hasScores =
                report.scores?.transunion ||
                report.scores?.equifax ||
                report.scores?.experian;

              return (
                <button
                  key={report.id}
                  onClick={() => onReportSelect(report.id)}
                  className={`w-full p-4 rounded-lg border text-left transition-all ${
                    isSelected
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-slate-700/50 bg-slate-800/30 hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-slate-200">
                          {safeFormatDate(report.uploadedAt)}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs rounded ${
                            report.parseStatus === "COMPLETED"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : report.parseStatus === "FAILED"
                              ? "bg-red-500/20 text-red-400"
                              : "bg-amber-500/20 text-amber-400"
                          }`}
                        >
                          {report.parseStatus}
                        </span>
                      </div>

                      {/* Scores row */}
                      {hasScores && (
                        <div className="flex items-center gap-3 text-xs mt-2">
                          {report.scores?.transunion && (
                            <span className="text-blue-400">
                              TU: {report.scores.transunion}
                            </span>
                          )}
                          {report.scores?.equifax && (
                            <span className="text-red-400">
                              EQ: {report.scores.equifax}
                            </span>
                          )}
                          {report.scores?.experian && (
                            <span className="text-purple-400">
                              EX: {report.scores.experian}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Account counts */}
                      {report.bureauBreakdown && (
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-2">
                          <span>TU: {report.bureauBreakdown.transunion}</span>
                          <span>EQ: {report.bureauBreakdown.equifax}</span>
                          <span>EX: {report.bureauBreakdown.experian}</span>
                        </div>
                      )}

                      {report.accountCount !== undefined && !report.bureauBreakdown && (
                        <p className="text-xs text-slate-400 mt-1">
                          {report.accountCount} accounts parsed
                        </p>
                      )}
                    </div>

                    {/* Selection indicator */}
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        isSelected
                          ? "border-blue-500 bg-blue-500"
                          : "border-slate-500"
                      }`}
                    >
                      {isSelected && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {reports.length === 0 && uploadStep === "idle" && (
        <div className="text-center py-6">
          <p className="text-slate-400 text-sm">
            No credit reports found for this client.
          </p>
          <p className="text-slate-500 text-xs mt-1">
            Upload a report above to get started with Sentry disputes.
          </p>
        </div>
      )}
    </div>
  );
}

export default SentryReportSelector;
