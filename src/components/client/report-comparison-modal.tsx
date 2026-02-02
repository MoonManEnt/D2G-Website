"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  X,
  TrendingUp,
  TrendingDown,
  GitCompare,
  Calendar,
  CheckCircle,
  AlertTriangle,
  BarChart2,
  ArrowRight,
  Minus,
  Target,
  Shield,
} from "lucide-react";
import { format } from "date-fns";

// Safe date formatting helper
const safeFormat = (dateStr: string | null | undefined, formatStr: string) => {
  if (!dateStr) return "Unknown";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Unknown";
    return format(date, formatStr);
  } catch {
    return "Unknown";
  }
};

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

interface ReportComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  reports: CreditReportData[];
  clientName: string;
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

const ScoreProgressBar = ({
  score,
  maxScore = 850,
  color,
}: {
  score: number | null;
  maxScore?: number;
  color: string;
}) => {
  if (score === null) return <div className="h-2 bg-zinc-800 rounded-full" />;

  const percentage = (score / maxScore) * 100;
  return (
    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

const ChangeArrow = ({ value }: { value: number }) => {
  if (value === 0) return <Minus size={14} className="text-zinc-500" />;
  if (value > 0) return <TrendingUp size={14} className="text-emerald-400" />;
  return <TrendingDown size={14} className="text-red-400" />;
};

// =============================================================================
// SCORE CHART COMPONENT (Simple SVG Chart)
// =============================================================================

const ScoreChart = ({ reports }: { reports: CreditReportData[] }) => {
  const sortedReports = [...reports].reverse(); // Oldest first for chart
  const chartWidth = 500;
  const chartHeight = 220;
  const padding = { top: 45, right: 20, bottom: 35, left: 50 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  // Get score ranges - safely handle empty arrays and null values
  const allScores = sortedReports.flatMap((r) =>
    [r.bureaus?.transunion?.score, r.bureaus?.equifax?.score, r.bureaus?.experian?.score].filter(
      (s): s is number => s !== null && s !== undefined && !isNaN(s)
    )
  );

  // If no valid scores, use reasonable defaults for display
  const hasValidScores = allScores.length > 0;
  const dataMin = hasValidScores ? Math.min(...allScores) : 600;
  const dataMax = hasValidScores ? Math.max(...allScores) : 650;

  // Add padding to the range (10% on each side, min 50 points)
  const rangePadding = Math.max(50, (dataMax - dataMin) * 0.1);
  const minScore = Math.max(300, Math.floor((dataMin - rangePadding) / 10) * 10);
  const maxScore = Math.min(850, Math.ceil((dataMax + rangePadding) / 10) * 10);
  const scoreRange = maxScore - minScore || 100;

  const getY = (score: number | null | undefined) => {
    if (score === null || score === undefined || isNaN(score)) return innerHeight;
    // Clamp the result to valid chart bounds
    const normalized = (score - minScore) / scoreRange;
    const y = innerHeight - Math.max(0, Math.min(1, normalized)) * innerHeight;
    return Math.max(0, Math.min(innerHeight, y));
  };

  const getX = (index: number) => {
    const divisor = Math.max(sortedReports.length - 1, 1);
    return (index / divisor) * innerWidth;
  };

  const bureaus = [
    { key: "transunion" as const, color: "#3b82f6", label: "TransUnion" },
    { key: "equifax" as const, color: "#ef4444", label: "Equifax" },
    { key: "experian" as const, color: "#8b5cf6", label: "Experian" },
  ];

  // If no valid data, show a placeholder message
  if (!hasValidScores) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <BarChart2 size={16} className="text-primary" />
          Score Progression Over Time
        </h3>
        <div className="flex items-center justify-center h-[200px] text-zinc-500 text-sm">
          No score data available for chart
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <BarChart2 size={16} className="text-primary" />
        Score Progression Over Time
      </h3>

      {/* Chart container with overflow control */}
      <div className="relative w-full overflow-hidden" style={{ minHeight: '200px' }}>
        <svg
        width="100%"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ maxWidth: '100%', height: 'auto' }}
      >
        <g transform={`translate(${padding.left}, ${padding.top})`}>
          {/* Grid lines - show fewer lines for cleaner look */}
          {[0, 0.5, 1].map((tick, i) => {
            const y = innerHeight * (1 - tick);
            const score = Math.round(minScore + scoreRange * tick);
            return (
              <g key={i}>
                <line x1={0} y1={y} x2={innerWidth} y2={y} stroke="#27272a" strokeWidth={1} />
                <text x={-8} y={y + 4} textAnchor="end" fill="#71717a" fontSize={10}>
                  {score}
                </text>
              </g>
            );
          })}

          {/* X-axis labels */}
          {sortedReports.map((report, i) => (
            <text
              key={report.id}
              x={getX(i)}
              y={innerHeight + 20}
              textAnchor="middle"
              fill="#71717a"
              fontSize={10}
            >
              {safeFormat(report.reportDate, "MMM")}
            </text>
          ))}

          {/* Lines for each bureau */}
          {bureaus.map((bureau, bureauIndex) => {
            const validPoints = sortedReports
              .map((r, i) => {
                const score = r.bureaus?.[bureau.key]?.score;
                if (score === null || score === undefined || isNaN(score)) return null;
                return { x: getX(i), y: getY(score), score, index: i };
              })
              .filter((p): p is { x: number; y: number; score: number; index: number } => p !== null);

            // Only render if we have at least one valid point
            if (validPoints.length === 0) return null;

            const pointsStr = validPoints.map(p => `${p.x},${p.y}`).join(" ");

            return (
              <g key={bureau.key}>
                {validPoints.length > 1 && (
                  <polyline
                    points={pointsStr}
                    fill="none"
                    stroke={bureau.color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                {validPoints.map((p, idx) => (
                  <g key={`${bureau.key}-${p.index}`}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={5}
                      fill={bureau.color}
                      stroke="#18181b"
                      strokeWidth={2}
                    />
                    {/* Show score label on hover area - offset by bureau to prevent overlap */}
                    <text
                      x={p.x}
                      y={p.y - 10 - (bureauIndex * 12)}
                      textAnchor="middle"
                      fill={bureau.color}
                      fontSize={9}
                      fontWeight="bold"
                    >
                      {p.score}
                    </text>
                  </g>
                ))}
              </g>
            );
          })}
        </g>
      </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4">
        {bureaus.map((bureau) => (
          <div key={bureau.key} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: bureau.color }} />
            <span className="text-xs text-zinc-400">{bureau.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// =============================================================================
// COMPARISON TABLE COMPONENT
// =============================================================================

const ComparisonTable = ({ reports }: { reports: CreditReportData[] }) => {
  const oldest = reports[reports.length - 1];
  const latest = reports[0];

  const getChange = (latest: number | null, oldest: number | null) => {
    if (latest === null || oldest === null) return null;
    return latest - oldest;
  };

  const bureaus = [
    { key: "transunion" as const, label: "TransUnion", color: "text-primary" },
    { key: "equifax" as const, label: "Equifax", color: "text-red-400" },
    { key: "experian" as const, label: "Experian", color: "text-indigo-400" },
  ];

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-zinc-800">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <GitCompare size={16} className="text-primary" />
          First vs Latest Report
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Metric</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500">
                {safeFormat(oldest.reportDate, "MMM d, yyyy")}
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500">
                <ArrowRight size={12} className="inline" />
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500">
                {safeFormat(latest.reportDate, "MMM d, yyyy")}
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500">Change</th>
            </tr>
          </thead>
          <tbody>
            {bureaus.map((bureau) => {
              const oldScore = oldest.bureaus?.[bureau.key]?.score ?? null;
              const newScore = latest.bureaus?.[bureau.key]?.score ?? null;
              const change = getChange(newScore, oldScore);
              return (
                <tr key={bureau.key} className="border-b border-zinc-800/50">
                  <td className={`px-4 py-3 text-sm font-medium ${bureau.color}`}>{bureau.label} Score</td>
                  <td className="px-4 py-3 text-center text-sm text-foreground">{oldScore ?? "—"}</td>
                  <td className="px-4 py-3 text-center">
                    {change !== null && <ChangeArrow value={change} />}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-foreground font-semibold">{newScore ?? "—"}</td>
                  <td className="px-4 py-3 text-center">
                    {change !== null && (
                      <span
                        className={`text-sm font-medium ${
                          change > 0 ? "text-emerald-400" : change < 0 ? "text-red-400" : "text-zinc-500"
                        }`}
                      >
                        {change > 0 ? "+" : ""}
                        {change}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            <tr className="border-b border-zinc-800/50 bg-zinc-800/20">
              <td className="px-4 py-3 text-sm font-medium text-foreground">Negative Items</td>
              <td className="px-4 py-3 text-center text-sm text-red-400">{oldest.summary?.negativeItems ?? 0}</td>
              <td className="px-4 py-3 text-center">
                <ChangeArrow value={(oldest.summary?.negativeItems ?? 0) - (latest.summary?.negativeItems ?? 0)} />
              </td>
              <td className="px-4 py-3 text-center text-sm text-red-400 font-semibold">
                {latest.summary?.negativeItems ?? 0}
              </td>
              <td className="px-4 py-3 text-center">
                <span
                  className={`text-sm font-medium ${
                    (oldest.summary?.negativeItems ?? 0) - (latest.summary?.negativeItems ?? 0) > 0
                      ? "text-emerald-400"
                      : (oldest.summary?.negativeItems ?? 0) - (latest.summary?.negativeItems ?? 0) < 0
                      ? "text-red-400"
                      : "text-zinc-500"
                  }`}
                >
                  {(oldest.summary?.negativeItems ?? 0) - (latest.summary?.negativeItems ?? 0) > 0 ? "-" : "+"}
                  {Math.abs((oldest.summary?.negativeItems ?? 0) - (latest.summary?.negativeItems ?? 0))}
                </span>
              </td>
            </tr>
            <tr className="border-b border-zinc-800/50">
              <td className="px-4 py-3 text-sm font-medium text-foreground">Collections</td>
              <td className="px-4 py-3 text-center text-sm text-orange-400">{oldest.summary?.collections ?? 0}</td>
              <td className="px-4 py-3 text-center">
                <ChangeArrow value={(oldest.summary?.collections ?? 0) - (latest.summary?.collections ?? 0)} />
              </td>
              <td className="px-4 py-3 text-center text-sm text-orange-400 font-semibold">
                {latest.summary?.collections ?? 0}
              </td>
              <td className="px-4 py-3 text-center">
                <span
                  className={`text-sm font-medium ${
                    (oldest.summary?.collections ?? 0) - (latest.summary?.collections ?? 0) > 0
                      ? "text-emerald-400"
                      : (oldest.summary?.collections ?? 0) - (latest.summary?.collections ?? 0) < 0
                      ? "text-red-400"
                      : "text-zinc-500"
                  }`}
                >
                  {(oldest.summary?.collections ?? 0) - (latest.summary?.collections ?? 0) > 0 ? "-" : "+"}
                  {Math.abs((oldest.summary?.collections ?? 0) - (latest.summary?.collections ?? 0))}
                </span>
              </td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-sm font-medium text-foreground">Inquiries</td>
              <td className="px-4 py-3 text-center text-sm text-amber-400">{oldest.summary?.inquiries ?? 0}</td>
              <td className="px-4 py-3 text-center">
                <ChangeArrow value={(oldest.summary?.inquiries ?? 0) - (latest.summary?.inquiries ?? 0)} />
              </td>
              <td className="px-4 py-3 text-center text-sm text-amber-400 font-semibold">
                {latest.summary?.inquiries ?? 0}
              </td>
              <td className="px-4 py-3 text-center">
                <span
                  className={`text-sm font-medium ${
                    (oldest.summary?.inquiries ?? 0) - (latest.summary?.inquiries ?? 0) > 0
                      ? "text-emerald-400"
                      : (oldest.summary?.inquiries ?? 0) - (latest.summary?.inquiries ?? 0) < 0
                      ? "text-red-400"
                      : "text-zinc-500"
                  }`}
                >
                  {(oldest.summary?.inquiries ?? 0) - (latest.summary?.inquiries ?? 0) > 0 ? "-" : "+"}
                  {Math.abs((oldest.summary?.inquiries ?? 0) - (latest.summary?.inquiries ?? 0))}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

// =============================================================================
// INSIGHTS PANEL
// =============================================================================

const InsightsPanel = ({ reports }: { reports: CreditReportData[] }) => {
  const insights = useMemo(() => {
    if (reports.length < 2) return [];

    const latest = reports[0];
    const oldest = reports[reports.length - 1];
    const result: Array<{ type: "positive" | "negative" | "neutral"; text: string }> = [];

    // Calculate total score improvements
    const bureaus = ["transunion", "equifax", "experian"] as const;
    let totalImprovement = 0;
    let improvedBureaus = 0;
    let bestBureau = { name: "", improvement: 0 };
    let worstBureau = { name: "", improvement: Infinity };

    bureaus.forEach((bureau) => {
      const oldScore = oldest.bureaus?.[bureau]?.score ?? null;
      const newScore = latest.bureaus?.[bureau]?.score ?? null;
      if (oldScore !== null && newScore !== null) {
        const improvement = newScore - oldScore;
        totalImprovement += improvement;
        if (improvement > 0) improvedBureaus++;
        if (improvement > bestBureau.improvement) {
          bestBureau = { name: bureau, improvement };
        }
        if (improvement < worstBureau.improvement) {
          worstBureau = { name: bureau, improvement };
        }
      }
    });

    const avgImprovement = Math.round(totalImprovement / 3);

    if (avgImprovement > 0) {
      result.push({
        type: "positive",
        text: `Average score improved by ${avgImprovement} points across all bureaus`,
      });
    } else if (avgImprovement < 0) {
      result.push({
        type: "negative",
        text: `Average score decreased by ${Math.abs(avgImprovement)} points - review recent activity`,
      });
    }

    if (bestBureau.improvement > 0) {
      const bureauName = bestBureau.name.charAt(0).toUpperCase() + bestBureau.name.slice(1);
      result.push({
        type: "positive",
        text: `Best performing bureau: ${bureauName} (+${bestBureau.improvement} pts)`,
      });
    }

    if (worstBureau.improvement < 0) {
      const bureauName = worstBureau.name.charAt(0).toUpperCase() + worstBureau.name.slice(1);
      result.push({
        type: "negative",
        text: `Most resistant bureau: ${bureauName} (${worstBureau.improvement} pts) - focus disputes here`,
      });
    }

    // Items removed
    const itemsRemoved = reports.reduce((sum, r) => sum + (r.changes?.itemsRemoved || 0), 0);
    if (itemsRemoved > 0) {
      result.push({
        type: "positive",
        text: `${itemsRemoved} negative item${itemsRemoved !== 1 ? "s" : ""} successfully removed`,
      });
    }

    // Inquiries dropped
    const inquiriesDropped = reports.reduce((sum, r) => sum + (r.changes?.inquiriesDropped || 0), 0);
    if (inquiriesDropped > 0) {
      result.push({
        type: "positive",
        text: `${inquiriesDropped} inquir${inquiriesDropped !== 1 ? "ies" : "y"} removed from reports`,
      });
    }

    // Remaining negatives
    const negativeItems = latest.summary?.negativeItems ?? 0;
    if (negativeItems > 0) {
      result.push({
        type: "neutral",
        text: `${negativeItems} negative item${negativeItems !== 1 ? "s" : ""} remaining to dispute`,
      });
    }

    return result;
  }, [reports]);

  if (insights.length === 0) return null;

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <Target size={16} className="text-purple-400" />
        Key Insights
      </h3>

      <div className="space-y-3">
        {insights.map((insight, i) => (
          <div key={i} className="flex items-start gap-3">
            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                insight.type === "positive"
                  ? "bg-emerald-500/20"
                  : insight.type === "negative"
                  ? "bg-red-500/20"
                  : "bg-zinc-800"
              }`}
            >
              {insight.type === "positive" ? (
                <CheckCircle size={14} className="text-emerald-400" />
              ) : insight.type === "negative" ? (
                <AlertTriangle size={14} className="text-red-400" />
              ) : (
                <Shield size={14} className="text-zinc-400" />
              )}
            </div>
            <p className="text-sm text-zinc-300">{insight.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ReportComparisonModal({
  isOpen,
  onClose,
  reports,
  clientName,
}: ReportComparisonModalProps) {
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, transition: { duration: 0.15 } },
  };

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring" as const, duration: 0.4, bounce: 0.2 } },
    exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.15 } },
  };

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (reports.length < 1) return null;

    const latest = reports[0];
    const oldest = reports[reports.length - 1];

    const getAvgScore = (r: CreditReportData) => {
      const scores = [
        r.bureaus?.transunion?.score,
        r.bureaus?.equifax?.score,
        r.bureaus?.experian?.score,
      ].filter((s): s is number => s !== null && s !== undefined && !isNaN(s));
      return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    };

    const latestAvg = getAvgScore(latest);
    const oldestAvg = getAvgScore(oldest);
    const totalChange = latestAvg && oldestAvg ? latestAvg - oldestAvg : 0;

    const totalItemsRemoved = reports.reduce((sum, r) => sum + (r.changes?.itemsRemoved || 0), 0);
    const totalInquiriesDropped = reports.reduce((sum, r) => sum + (r.changes?.inquiriesDropped || 0), 0);

    return {
      totalChange,
      totalItemsRemoved,
      totalInquiriesDropped,
      monthsTracking: reports.length,
      latestAvg,
    };
  }, [reports]);

  if (reports.length < 2) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal - using flexbox centering instead of transform for better nested modal support */}
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={onClose}
          >
            <div
              className="w-full max-w-4xl max-h-[90vh] rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl shadow-black/50 overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/20">
                    <GitCompare size={20} className="text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">Report Comparison</h2>
                    <p className="text-xs text-zinc-500">{clientName} • {reports.length} reports analyzed</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  <X size={20} className="text-zinc-400" />
                </button>
              </div>

              {/* Summary Stats */}
              {summaryStats && (
                <div className="p-5 border-b border-zinc-800 bg-zinc-800/30">
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground">{summaryStats.latestAvg || "—"}</p>
                      <p className="text-xs text-zinc-500">Current Avg Score</p>
                      {summaryStats.totalChange !== 0 && (
                        <p
                          className={`text-xs font-medium mt-1 ${
                            summaryStats.totalChange > 0 ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {summaryStats.totalChange > 0 ? "+" : ""}
                          {summaryStats.totalChange} all-time
                        </p>
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-emerald-400">{summaryStats.totalItemsRemoved}</p>
                      <p className="text-xs text-zinc-500">Items Removed</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary">{summaryStats.totalInquiriesDropped}</p>
                      <p className="text-xs text-zinc-500">Inquiries Dropped</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-400">{summaryStats.monthsTracking}</p>
                      <p className="text-xs text-zinc-500">Reports Tracked</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Score Chart */}
                <ScoreChart reports={reports} />

                {/* Comparison Table */}
                <ComparisonTable reports={reports} />

                {/* Insights */}
                <InsightsPanel reports={reports} />
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-zinc-800 flex justify-end gap-3">
                <Button variant="ghost" onClick={onClose}>
                  Close
                </Button>
                <Button className="bg-primary hover:bg-primary/90">
                  <TrendingUp size={16} className="mr-2" />
                  Generate Progress Report
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
