"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Upload,
  FileText,
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  ChevronRight,
  MoreHorizontal,
  Eye,
  Trash2,
  Download,
  Zap,
  X,
  Check,
  AlertCircle,
  BarChart2,
  Shield,
  CreditCard,
  Building2,
  GitCompare,
  Loader2,
  FileCheck,
  Activity,
  FileUp,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/lib/use-toast";
import { format, formatDistanceToNow } from "date-fns";

// =============================================================================
// TYPES
// =============================================================================

interface BureauData {
  score: number | null;
  accounts: number;
  negatives: number;
  inquiries: number;
}

interface ReportSummary {
  totalAccounts: number;
  openAccounts: number;
  closedAccounts: number;
  negativeItems: number;
  collections: number;
  latePayments: number;
  inquiries: number;
  publicRecords: number;
}

interface ScoreChange {
  transunion: number;
  equifax: number;
  experian: number;
}

interface ReportChanges {
  scoreChange: ScoreChange | null;
  itemsRemoved: number;
  itemsAdded: number;
  inquiriesDropped: number;
}

interface CreditReportData {
  id: string;
  filename: string;
  uploadDate: string;
  reportDate: string;
  status: string;
  bureaus: {
    transunion: BureauData;
    equifax: BureauData;
    experian: BureauData;
  };
  summary: ReportSummary;
  changes: ReportChanges | null;
}

interface CreditReportsPanelProps {
  clientId: string;
  clientName: string;
  onStartDisputes?: () => void;
  onCompareAll?: (reports: CreditReportData[]) => void;
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

const ScoreBadge = ({ score, size = "md" }: { score: number | null; size?: "sm" | "md" | "lg" }) => {
  if (score === null) {
    return <span className="text-zinc-500 text-sm">N/A</span>;
  }

  const getScoreColor = (s: number) => {
    if (s >= 750) return { bg: "bg-emerald-500/20", text: "text-emerald-400", ring: "ring-emerald-500/30" };
    if (s >= 700) return { bg: "bg-green-500/20", text: "text-green-400", ring: "ring-green-500/30" };
    if (s >= 650) return { bg: "bg-amber-500/20", text: "text-amber-400", ring: "ring-amber-500/30" };
    if (s >= 600) return { bg: "bg-orange-500/20", text: "text-orange-400", ring: "ring-orange-500/30" };
    return { bg: "bg-red-500/20", text: "text-red-400", ring: "ring-red-500/30" };
  };

  const colors = getScoreColor(score);
  const sizeClasses =
    size === "lg"
      ? "text-2xl font-bold px-4 py-2"
      : size === "sm"
      ? "text-sm font-semibold px-2 py-0.5"
      : "text-lg font-bold px-3 py-1";

  return (
    <span className={`${colors.bg} ${colors.text} ${sizeClasses} rounded-lg ring-1 ${colors.ring}`}>
      {score}
    </span>
  );
};

const BureauLogo = ({ bureau, size = 20 }: { bureau: string; size?: number }) => {
  const colors: Record<string, string> = {
    transunion: "text-blue-400",
    equifax: "text-red-400",
    experian: "text-indigo-400",
  };

  const initials: Record<string, string> = {
    transunion: "TU",
    equifax: "EQ",
    experian: "EX",
  };

  return (
    <div
      className={`flex items-center justify-center rounded-md bg-zinc-800 font-bold text-[10px] ${colors[bureau]}`}
      style={{ width: size, height: size }}
    >
      {initials[bureau]}
    </div>
  );
};

const ChangeIndicator = ({ value, suffix = "" }: { value: number | null | undefined; suffix?: string }) => {
  if (value === 0 || value === null || value === undefined) {
    return <span className="text-zinc-500 text-xs">—</span>;
  }

  const isPositive = value > 0;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
      {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {isPositive ? "+" : ""}
      {value}
      {suffix}
    </span>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { icon: typeof CheckCircle; bg: string; text: string; label: string; animate?: boolean }> = {
    parsed: { icon: CheckCircle, bg: "bg-emerald-500/20", text: "text-emerald-400", label: "Parsed" },
    parsing: { icon: Loader2, bg: "bg-blue-500/20", text: "text-blue-400", label: "Parsing...", animate: true },
    error: { icon: AlertCircle, bg: "bg-red-500/20", text: "text-red-400", label: "Error" },
    pending: { icon: Clock, bg: "bg-amber-500/20", text: "text-amber-400", label: "Pending" },
  };

  const c = config[status] || config.pending;
  const Icon = c.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${c.bg} ${c.text}`}>
      <Icon size={12} className={c.animate ? "animate-spin" : ""} />
      {c.label}
    </span>
  );
};

// =============================================================================
// UPLOAD ZONE COMPONENT
// =============================================================================

const UploadZone = ({
  onUpload,
  isUploading,
  uploadProgress,
}: {
  onUpload: (file: File) => void;
  isUploading: boolean;
  uploadProgress: number;
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        onUpload(files[0]);
      }
    },
    [onUpload]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      if (files.length > 0) {
        onUpload(files[0]);
      }
    },
    [onUpload]
  );

  if (isUploading) {
    return (
      <div className="border-2 border-dashed border-blue-500/50 rounded-2xl p-6 bg-blue-500/5">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-full bg-blue-500/20 flex items-center justify-center">
              <FileUp size={24} className="text-blue-400 animate-pulse" />
            </div>
            <svg className="absolute inset-0 w-14 h-14 -rotate-90">
              <circle
                cx="28"
                cy="28"
                r="24"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="3"
                strokeDasharray={150.8}
                strokeDashoffset={150.8 - (uploadProgress / 100) * 150.8}
                strokeLinecap="round"
                className="transition-all duration-300"
              />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-white font-medium text-sm">
              {uploadProgress < 100 ? "Uploading..." : "Processing..."}
            </p>
            <p className="text-xs text-zinc-400 mt-1">{uploadProgress}% complete</p>
          </div>
          <div className="w-48 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative border-2 border-dashed rounded-2xl p-6 transition-all cursor-pointer group ${
        isDragging ? "border-blue-500 bg-blue-500/10" : "border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/30"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => document.getElementById("credit-report-file-input")?.click()}
    >
      <input
        id="credit-report-file-input"
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="flex flex-col items-center gap-3">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
            isDragging ? "bg-blue-500/20 scale-110" : "bg-zinc-800 group-hover:bg-zinc-700"
          }`}
        >
          <Upload size={22} className={isDragging ? "text-blue-400" : "text-zinc-400 group-hover:text-white"} />
        </div>

        <div className="text-center">
          <p className="text-white font-medium text-sm">
            {isDragging ? "Drop your report here" : "Drop IdentityIQ report or click to browse"}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Supports PDF files from IdentityIQ</p>
        </div>

        <div className="flex items-center gap-2 mt-1">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800 rounded-lg text-[10px] text-zinc-400">
            <Shield size={10} />
            Encrypted upload
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800 rounded-lg text-[10px] text-zinc-400">
            <Zap size={10} />
            Auto-parsed in seconds
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// PARSING PROGRESS COMPONENT
// =============================================================================

const ParsingProgress = ({ filename, onCancel }: { filename: string; onCancel: () => void }) => {
  const [stage, setStage] = useState(0);
  const stages = [
    { label: "Reading PDF", icon: FileText },
    { label: "Extracting bureaus", icon: Building2 },
    { label: "Parsing accounts", icon: CreditCard },
    { label: "Analyzing changes", icon: GitCompare },
    { label: "Generating summary", icon: BarChart2 },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setStage((s) => Math.min(s + 1, stages.length - 1));
    }, 1500);
    return () => clearInterval(timer);
  }, [stages.length]);

  const updatedStages = stages.map((s, i) => ({
    ...s,
    status: i < stage ? "complete" : i === stage ? "active" : "pending",
  }));

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <FileCheck size={20} className="text-blue-400" />
          </div>
          <div>
            <p className="font-medium text-white text-sm">Parsing Report</p>
            <p className="text-xs text-zinc-500 truncate max-w-[180px]">{filename}</p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="space-y-2">
        {updatedStages.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                  s.status === "complete"
                    ? "bg-emerald-500/20"
                    : s.status === "active"
                    ? "bg-blue-500/20"
                    : "bg-zinc-800"
                }`}
              >
                {s.status === "complete" ? (
                  <Check size={14} className="text-emerald-400" />
                ) : s.status === "active" ? (
                  <Loader2 size={14} className="text-blue-400 animate-spin" />
                ) : (
                  <Icon size={14} className="text-zinc-500" />
                )}
              </div>
              <span
                className={`text-xs ${
                  s.status === "complete"
                    ? "text-emerald-400"
                    : s.status === "active"
                    ? "text-white"
                    : "text-zinc-500"
                }`}
              >
                {s.label}
              </span>
              {s.status === "active" && <span className="ml-auto text-[10px] text-blue-400">Processing...</span>}
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-zinc-800">
        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
          <Activity size={10} />
          <span>Estimated time remaining: ~15 seconds</span>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// REPORT CARD COMPONENT
// =============================================================================

const ReportCard = ({
  report,
  isLatest,
  onView,
  onCompare,
  onDelete,
  onStartDisputes,
}: {
  report: CreditReportData;
  isLatest: boolean;
  onView: () => void;
  onCompare: () => void;
  onDelete: () => void;
  onStartDisputes: () => void;
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, "MMM d, yyyy");
  };

  const avgScore =
    report.bureaus.transunion.score && report.bureaus.equifax.score && report.bureaus.experian.score
      ? Math.round(
          (report.bureaus.transunion.score + report.bureaus.equifax.score + report.bureaus.experian.score) / 3
        )
      : null;

  const avgChange =
    report.changes?.scoreChange
      ? Math.round(
          (report.changes.scoreChange.transunion +
            report.changes.scoreChange.equifax +
            report.changes.scoreChange.experian) /
            3
        )
      : null;

  return (
    <div
      className={`group relative bg-zinc-900/50 border rounded-xl overflow-hidden transition-all hover:border-zinc-700 ${
        isLatest ? "border-blue-500/50 ring-1 ring-blue-500/20" : "border-zinc-800"
      }`}
    >
      {isLatest && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500" />
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                isLatest ? "bg-blue-500/20" : "bg-zinc-800"
              }`}
            >
              <FileText size={16} className={isLatest ? "text-blue-400" : "text-zinc-400"} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-white text-sm">{formatDate(report.reportDate)}</p>
                {isLatest && (
                  <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[9px] font-medium rounded-full">
                    LATEST
                  </span>
                )}
              </div>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                Uploaded {formatDistanceToNow(new Date(report.uploadDate), { addSuffix: true })}
              </p>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <MoreHorizontal size={14} />
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 w-40 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl z-20 py-1 overflow-hidden">
                  <button
                    onClick={() => {
                      onView();
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white flex items-center gap-2"
                  >
                    <Eye size={12} /> View Details
                  </button>
                  <button
                    onClick={() => {
                      onCompare();
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white flex items-center gap-2"
                  >
                    <GitCompare size={12} /> Compare Reports
                  </button>
                  <button className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white flex items-center gap-2">
                    <Download size={12} /> Download PDF
                  </button>
                  <div className="border-t border-zinc-700 my-1" />
                  <button
                    onClick={() => {
                      onDelete();
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                  >
                    <Trash2 size={12} /> Delete Report
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Bureau Scores */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {(["transunion", "equifax", "experian"] as const).map((bureau) => (
            <div key={bureau} className="bg-zinc-800/50 rounded-lg p-2">
              <div className="flex items-center gap-1 mb-1.5">
                <BureauLogo bureau={bureau} size={14} />
                <span className="text-[9px] text-zinc-500 uppercase tracking-wider">{bureau.slice(0, 2)}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <ScoreBadge score={report.bureaus[bureau].score} size="sm" />
                {report.changes?.scoreChange && (
                  <ChangeIndicator value={report.changes.scoreChange[bureau]} />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          <div className="text-center p-1.5 bg-zinc-800/30 rounded-lg">
            <p className="text-sm font-bold text-white">{report.summary.totalAccounts}</p>
            <p className="text-[9px] text-zinc-500">Accounts</p>
          </div>
          <div className="text-center p-1.5 bg-zinc-800/30 rounded-lg">
            <p className="text-sm font-bold text-red-400">{report.summary.negativeItems}</p>
            <p className="text-[9px] text-zinc-500">Negatives</p>
          </div>
          <div className="text-center p-1.5 bg-zinc-800/30 rounded-lg">
            <p className="text-sm font-bold text-orange-400">{report.summary.collections}</p>
            <p className="text-[9px] text-zinc-500">Collections</p>
          </div>
          <div className="text-center p-1.5 bg-zinc-800/30 rounded-lg">
            <p className="text-sm font-bold text-amber-400">{report.summary.inquiries}</p>
            <p className="text-[9px] text-zinc-500">Inquiries</p>
          </div>
        </div>

        {/* Changes Summary (if not latest) */}
        {report.changes && avgChange !== null && avgChange !== 0 && (
          <div className="flex items-center gap-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg mb-3">
            <div className="w-6 h-6 rounded-md bg-emerald-500/20 flex items-center justify-center">
              <TrendingUp size={12} className="text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-emerald-400 font-medium">Avg +{avgChange} pts since this report</p>
              <p className="text-[10px] text-emerald-400/70">
                {report.changes.itemsRemoved} item{report.changes.itemsRemoved !== 1 ? "s" : ""} removed,{" "}
                {report.changes.inquiriesDropped} inquir{report.changes.inquiriesDropped !== 1 ? "ies" : "y"} dropped
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onView}
            className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <Eye size={14} />
            View Report
          </button>
          {!isLatest && (
            <button
              onClick={onCompare}
              className="py-2 px-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
            >
              <GitCompare size={14} />
              Compare
            </button>
          )}
          {isLatest && (
            <button
              onClick={onStartDisputes}
              className="py-2 px-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Zap size={14} />
              Start Disputes
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// QUICK STATS HEADER
// =============================================================================

const QuickStats = ({ reports }: { reports: CreditReportData[] }) => {
  if (reports.length === 0) return null;

  const latest = reports[0];
  const oldest = reports[reports.length - 1];

  const getAvgScore = (r: CreditReportData) => {
    const scores = [r.bureaus.transunion.score, r.bureaus.equifax.score, r.bureaus.experian.score].filter(
      (s): s is number => s !== null
    );
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  };

  const latestAvg = getAvgScore(latest);
  const oldestAvg = getAvgScore(oldest);

  const totalChange = latestAvg && oldestAvg ? latestAvg - oldestAvg : 0;

  const totalItemsRemoved = reports.reduce((sum, r) => sum + (r.changes?.itemsRemoved || 0), 0);

  return (
    <div className="grid grid-cols-4 gap-3 mb-4">
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3">
        <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] mb-1.5">
          <BarChart2 size={12} />
          Current Avg Score
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-white">{latestAvg || "—"}</span>
          {totalChange !== 0 && (
            <span className={`text-xs font-medium ${totalChange > 0 ? "text-emerald-400" : "text-red-400"}`}>
              {totalChange > 0 ? "+" : ""}
              {totalChange} all-time
            </span>
          )}
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3">
        <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] mb-1.5">
          <AlertTriangle size={12} />
          Negative Items
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-red-400">{latest.summary.negativeItems}</span>
          <span className="text-xs text-zinc-500">across all bureaus</span>
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3">
        <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] mb-1.5">
          <CheckCircle size={12} />
          Items Removed
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-emerald-400">{totalItemsRemoved}</span>
          <span className="text-xs text-zinc-500">since tracking began</span>
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3">
        <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] mb-1.5">
          <Calendar size={12} />
          Reports Uploaded
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-white">{reports.length}</span>
          <span className="text-xs text-zinc-500">
            spanning {reports.length > 1 ? `${reports.length} months` : "1 month"}
          </span>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// EMPTY STATE COMPONENT
// =============================================================================

const EmptyState = () => (
  <div className="text-center py-12">
    <div className="w-16 h-16 rounded-xl bg-zinc-800/50 flex items-center justify-center mx-auto mb-4">
      <FileText size={28} className="text-zinc-600" />
    </div>
    <h3 className="text-base font-medium text-white mb-1">No reports uploaded yet</h3>
    <p className="text-xs text-zinc-500 max-w-xs mx-auto mb-4">
      Upload your first IdentityIQ report to begin tracking credit changes and generating dispute letters.
    </p>
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px] text-blue-400 font-bold">
          1
        </div>
        <span>Download report from IdentityIQ</span>
      </div>
      <div className="w-px h-3 bg-zinc-800" />
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px] text-blue-400 font-bold">
          2
        </div>
        <span>Upload PDF above</span>
      </div>
      <div className="w-px h-3 bg-zinc-800" />
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px] text-blue-400 font-bold">
          3
        </div>
        <span>Auto-parsed into disputable items</span>
      </div>
    </div>
  </div>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function CreditReportsPanel({
  clientId,
  clientName,
  onStartDisputes,
  onCompareAll,
}: CreditReportsPanelProps) {
  const { toast } = useToast();
  const [reports, setReports] = useState<CreditReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const [parsingFile, setParsingFile] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "timeline">("grid");

  // Fetch reports for this client
  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}/reports`);
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      }
    } catch (error) {
      console.error("Failed to fetch reports:", error);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleUpload = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("clientId", clientId);

      // Simulate progress for UI feedback
      const progressInterval = setInterval(() => {
        setUploadProgress((p) => {
          if (p >= 90) {
            return p;
          }
          return p + 10;
        });
      }, 200);

      try {
        const res = await fetch("/api/reports/upload", {
          method: "POST",
          body: formData,
        });

        clearInterval(progressInterval);
        setUploadProgress(100);

        if (res.ok) {
          setIsUploading(false);
          setIsParsing(true);
          setParsingFile(file.name);

          // Poll for parsing completion
          const checkParsing = setInterval(async () => {
            const reportsRes = await fetch(`/api/clients/${clientId}/reports`);
            if (reportsRes.ok) {
              const data = await reportsRes.json();
              const latestReport = data[0];
              if (latestReport?.status === "parsed") {
                clearInterval(checkParsing);
                setIsParsing(false);
                setParsingFile(null);
                setReports(data);
                toast({
                  title: "Report Parsed",
                  description: "Credit report has been successfully parsed.",
                });
              }
            }
          }, 2000);

          // Timeout after 60 seconds
          setTimeout(() => {
            clearInterval(checkParsing);
            if (isParsing) {
              setIsParsing(false);
              fetchReports();
            }
          }, 60000);
        } else {
          throw new Error("Upload failed");
        }
      } catch (error) {
        clearInterval(progressInterval);
        setIsUploading(false);
        toast({
          title: "Upload Failed",
          description: "Failed to upload credit report",
          variant: "destructive",
        });
      }
    },
    [clientId, toast, fetchReports, isParsing]
  );

  const handleCancelParsing = useCallback(() => {
    setIsParsing(false);
    setParsingFile(null);
  }, []);

  const handleViewReport = useCallback((report: CreditReportData) => {
    // Navigate to report detail view
    window.location.href = `/clients/${clientId}?tab=reports&reportId=${report.id}`;
  }, [clientId]);

  const handleCompareReport = useCallback((report: CreditReportData) => {
    if (onCompareAll) {
      onCompareAll(reports);
    }
  }, [reports, onCompareAll]);

  const handleDeleteReport = useCallback(
    async (report: CreditReportData) => {
      if (!confirm("Are you sure you want to delete this report?")) return;

      try {
        const res = await fetch(`/api/reports/${report.id}`, {
          method: "DELETE",
        });

        if (res.ok) {
          toast({
            title: "Report Deleted",
            description: "Credit report has been deleted.",
          });
          fetchReports();
        } else {
          throw new Error("Delete failed");
        }
      } catch (error) {
        toast({
          title: "Delete Failed",
          description: "Failed to delete credit report",
          variant: "destructive",
        });
      }
    },
    [toast, fetchReports]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-blue-500/20">
              <FileText size={18} className="text-blue-400" />
            </div>
            <h2 className="text-lg font-bold text-white">Credit Reports</h2>
          </div>
          <p className="text-xs text-zinc-500">
            Upload and manage IdentityIQ credit reports • Track changes over time
          </p>
        </div>

        {reports.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                  viewMode === "grid" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-white"
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode("timeline")}
                className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                  viewMode === "timeline" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-white"
                }`}
              >
                Timeline
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <QuickStats reports={reports} />

      {/* Upload Zone */}
      {!isParsing && (
        <UploadZone onUpload={handleUpload} isUploading={isUploading} uploadProgress={uploadProgress} />
      )}

      {/* Parsing Progress */}
      {isParsing && parsingFile && (
        <ParsingProgress filename={parsingFile} onCancel={handleCancelParsing} />
      )}

      {/* Reports Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Calendar size={14} className="text-zinc-500" />
            Uploaded Reports
            <span className="text-xs text-zinc-500 font-normal">({reports.length})</span>
          </h3>

          {reports.length > 1 && (
            <button
              onClick={() => onCompareAll?.(reports)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
            >
              <GitCompare size={14} />
              Compare All
            </button>
          )}
        </div>

        {reports.length === 0 ? (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <EmptyState />
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 gap-3">
            {reports.map((report, index) => (
              <ReportCard
                key={report.id}
                report={report}
                isLatest={index === 0}
                onView={() => handleViewReport(report)}
                onCompare={() => handleCompareReport(report)}
                onDelete={() => handleDeleteReport(report)}
                onStartDisputes={() => onStartDisputes?.()}
              />
            ))}
          </div>
        ) : (
          // Timeline View
          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-px bg-zinc-800" />

            <div className="space-y-4">
              {reports.map((report, index) => {
                const avgScore =
                  report.bureaus.transunion.score &&
                  report.bureaus.equifax.score &&
                  report.bureaus.experian.score
                    ? Math.round(
                        (report.bureaus.transunion.score +
                          report.bureaus.equifax.score +
                          report.bureaus.experian.score) /
                          3
                      )
                    : null;

                return (
                  <div key={report.id} className="relative flex gap-3 pl-10">
                    {/* Timeline dot */}
                    <div
                      className={`absolute left-3 w-4 h-4 rounded-full border-2 ${
                        index === 0 ? "bg-blue-500 border-blue-400" : "bg-zinc-900 border-zinc-700"
                      }`}
                    >
                      {index === 0 && (
                        <div className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-50" />
                      )}
                    </div>

                    {/* Card */}
                    <div
                      className={`flex-1 bg-zinc-900/50 border rounded-xl p-3 ${
                        index === 0 ? "border-blue-500/50" : "border-zinc-800"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white text-sm">
                            {format(new Date(report.reportDate), "MMM d, yyyy")}
                          </span>
                          {index === 0 && (
                            <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[9px] font-medium rounded-full">
                              LATEST
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {avgScore && <ScoreBadge score={avgScore} size="sm" />}
                          {report.changes?.scoreChange && (
                            <ChangeIndicator
                              value={Math.round(
                                (report.changes.scoreChange.transunion +
                                  report.changes.scoreChange.equifax +
                                  report.changes.scoreChange.experian) /
                                  3
                              )}
                            />
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-zinc-500">
                          <span className="text-white font-medium">{report.summary.totalAccounts}</span> accounts
                        </span>
                        <span className="text-zinc-500">
                          <span className="text-red-400 font-medium">{report.summary.negativeItems}</span>{" "}
                          negatives
                        </span>
                        <span className="text-zinc-500">
                          <span className="text-orange-400 font-medium">{report.summary.collections}</span>{" "}
                          collections
                        </span>
                        <span className="text-zinc-500">
                          <span className="text-amber-400 font-medium">{report.summary.inquiries}</span> inquiries
                        </span>

                        <button
                          onClick={() => handleViewReport(report)}
                          className="ml-auto text-blue-400 hover:text-blue-300 flex items-center gap-0.5"
                        >
                          View <ChevronRight size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Help Section */}
      {reports.length > 0 && (
        <div className="p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Sparkles size={16} className="text-purple-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-white text-sm mb-1">Pro Tip: Monthly Uploads</h4>
              <p className="text-xs text-zinc-400 mb-2">
                Upload a new report every month to track progress and identify which disputes are working. Our
                diff engine will automatically highlight changes and calculate score improvements.
              </p>
              <button className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                Learn about dispute strategies <ExternalLink size={10} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
