"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  RefreshCw,
  Target,
  BarChart3,
  PieChart,
  Lightbulb,
  ListChecks,
  TrendingUp,
  Sparkles,
  Plus,
  ChevronDown,
  ChevronUp,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/use-toast";
import { ApprovalGauge } from "@/components/credit-readiness/approval-gauge";
import { DTIDisplay } from "@/components/credit-readiness/dti-display";
import { ScoreGapChart } from "@/components/credit-readiness/score-gap-chart";
import { ActionPlanList } from "@/components/credit-readiness/action-plan-list";
import { ProductSelector } from "@/components/credit-readiness/product-selector";

// =============================================================================
// CONSTANTS
// =============================================================================

const TIER_CONFIG: Record<string, { color: string; bg: string; text: string }> = {
  LIKELY: { color: "text-emerald-400", bg: "from-emerald-500/20 to-emerald-600/10", text: "Likely Approved" },
  POSSIBLE: { color: "text-amber-400", bg: "from-amber-500/20 to-amber-600/10", text: "Possible" },
  UNLIKELY: { color: "text-orange-400", bg: "from-orange-500/20 to-orange-600/10", text: "Unlikely" },
  NOT_READY: { color: "text-red-400", bg: "from-red-500/20 to-red-600/10", text: "Not Ready" },
};

const PRODUCT_LABELS: Record<string, string> = {
  MORTGAGE: "Mortgage",
  AUTO: "Auto Loan",
  CREDIT_CARD: "Credit Card",
  PERSONAL_LOAN: "Personal Loan",
  BUSINESS_LOC: "Business Line of Credit",
  GENERAL: "General Assessment",
};

const SEVERITY_COLORS: Record<string, { text: string; bg: string; dot: string }> = {
  POSITIVE: { text: "text-emerald-400", bg: "bg-emerald-500/20", dot: "bg-emerald-500" },
  NEGATIVE: { text: "text-red-400", bg: "bg-red-500/20", dot: "bg-red-500" },
  WARNING: { text: "text-amber-400", bg: "bg-amber-500/20", dot: "bg-amber-500" },
  CRITICAL: { text: "text-red-400", bg: "bg-red-500/20", dot: "bg-red-500" },
  INFO: { text: "text-blue-400", bg: "bg-blue-500/20", dot: "bg-blue-500" },
};

// =============================================================================
// HELPERS
// =============================================================================

function safeParseJSON(value: any, fallback: any = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

// =============================================================================
// INTERFACES
// =============================================================================

interface ParsedAnalysis {
  id: string;
  productType: string;
  statedIncome: number | null;
  reasonForApplying: string | null;
  relevantScoreModel: string;
  relevantScore: number | null;
  triMergeMiddle: number | null;
  approvalLikelihood: number;
  approvalTier: string;
  approvalExplanation: string;
  estimatedDTI: number | null;
  maxRecommendedDTI: number | null;
  actionPlan: any[];
  findings: any[];
  recommendations: any[];
  scoreGapAnalysis: any | null;
  vendorRecommendations: any[];
  computeTimeMs: number | null;
  version: string | null;
  createdAt: string;
}

function parseAnalysis(raw: any): ParsedAnalysis {
  return {
    id: raw.id,
    productType: raw.productType,
    statedIncome: raw.statedIncome,
    reasonForApplying: raw.reasonForApplying,
    relevantScoreModel: raw.relevantScoreModel || "",
    relevantScore: raw.relevantScore,
    triMergeMiddle: raw.triMergeMiddle,
    approvalLikelihood: raw.approvalLikelihood ?? 0,
    approvalTier: raw.approvalTier || "NOT_READY",
    approvalExplanation: raw.approvalExplanation || "",
    estimatedDTI: raw.estimatedDTI,
    maxRecommendedDTI: raw.maxRecommendedDTI,
    actionPlan: safeParseJSON(raw.actionPlan, []),
    findings: safeParseJSON(raw.findings, []),
    recommendations: safeParseJSON(raw.recommendations, []),
    scoreGapAnalysis: safeParseJSON(raw.scoreGapAnalysis, null),
    vendorRecommendations: safeParseJSON(raw.vendorRecommendations, []),
    computeTimeMs: raw.computeTimeMs,
    version: raw.version,
    createdAt: raw.createdAt,
  };
}

// =============================================================================
// PAGE COMPONENT
// =============================================================================

export default function CreditReadinessPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const clientId = params.id as string;

  const [analyses, setAnalyses] = useState<ParsedAnalysis[]>([]);
  const [clientName, setClientName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnalysisIndex, setSelectedAnalysisIndex] = useState(0);
  const [productSelectorOpen, setProductSelectorOpen] = useState(false);
  const [showPreviousAnalyses, setShowPreviousAnalyses] = useState(false);

  useEffect(() => {
    fetchAnalyses();
  }, [clientId]);

  const fetchAnalyses = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/readiness`);
      if (!res.ok) throw new Error("Failed to fetch readiness data");
      const data = await res.json();
      const parsed = (data.analyses || []).map(parseAnalysis);
      setAnalyses(parsed);
      if (data.clientName) setClientName(data.clientName);
      setSelectedAnalysisIndex(0);
    } catch (err: any) {
      setError(err.message || "Failed to load credit readiness data");
    } finally {
      setLoading(false);
    }
  };

  const handleAnalysisComplete = (data: any) => {
    // Re-fetch all analyses to get the updated list
    fetchAnalyses();
  };

  // ---------------------------------------------------------------------------
  // Loading State
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error State
  // ---------------------------------------------------------------------------
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  const currentAnalysis = analyses[selectedAnalysisIndex] || null;
  const tierConfig = currentAnalysis
    ? TIER_CONFIG[currentAnalysis.approvalTier] || TIER_CONFIG.NOT_READY
    : null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-6">
      {/* Ambient glow */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">
              Credit Readiness
            </h1>
            {clientName && (
              <p className="text-slate-400 text-sm">{clientName}</p>
            )}
          </div>
        </div>
        <Button
          onClick={() => setProductSelectorOpen(true)}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Plus className="w-4 h-4" />
          New Analysis
        </Button>
      </header>

      {/* Product Selector Dialog */}
      <ProductSelector
        open={productSelectorOpen}
        onOpenChange={setProductSelectorOpen}
        clientId={clientId}
        onAnalysisComplete={handleAnalysisComplete}
      />

      {/* Empty State */}
      {analyses.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-12 text-center"
        >
          <Target className="w-16 h-16 text-slate-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-200 mb-2">
            No Readiness Analysis Yet
          </h2>
          <p className="text-slate-400 max-w-md mx-auto mb-6">
            Run your first analysis to see approval likelihood across different credit products.
          </p>
          <Button
            onClick={() => setProductSelectorOpen(true)}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="w-4 h-4" />
            Start Analysis
          </Button>
        </motion.div>
      )}

      {/* Main Content */}
      {currentAnalysis && tierConfig && (
        <>
          {/* ================================================================= */}
          {/* Hero Card                                                         */}
          {/* ================================================================= */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative z-10 rounded-2xl p-6 mb-6 bg-gradient-to-br ${tierConfig.bg} border border-slate-700/50 backdrop-blur-xl`}
          >
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Left: Product badge + explanation */}
              <div className="flex-1 space-y-3">
                <span className="inline-block px-3 py-1 rounded-lg text-sm font-medium bg-slate-800/60 text-slate-300">
                  {PRODUCT_LABELS[currentAnalysis.productType] || currentAnalysis.productType}
                </span>
                <p className="text-slate-300 text-sm leading-relaxed">
                  {currentAnalysis.approvalExplanation}
                </p>
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span>
                    Model: <span className="text-slate-300">{currentAnalysis.relevantScoreModel}</span>
                  </span>
                  {currentAnalysis.relevantScore !== null && (
                    <span>
                      Score: <span className="text-slate-200 font-medium">{currentAnalysis.relevantScore}</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(currentAnalysis.createdAt)}
                  </span>
                  {currentAnalysis.computeTimeMs !== null && (
                    <span>{currentAnalysis.computeTimeMs}ms compute</span>
                  )}
                </div>
              </div>

              {/* Right: Gauge */}
              <ApprovalGauge
                likelihood={currentAnalysis.approvalLikelihood}
                tier={currentAnalysis.approvalTier}
                size="lg"
              />
            </div>
          </motion.div>

          {/* ================================================================= */}
          {/* 3-Column Grid                                                     */}
          {/* ================================================================= */}
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Column 1: Scoring Model */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6"
            >
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                Scoring Model
              </h3>
              <p className="text-sm text-slate-400 mb-3">
                {currentAnalysis.relevantScoreModel}
              </p>
              <div className="bg-slate-700/30 rounded-lg p-4 text-center mb-3">
                <span className="text-4xl font-bold text-slate-100">
                  {currentAnalysis.relevantScore ?? "N/A"}
                </span>
                <p className="text-xs text-slate-400 mt-1">Relevant Score</p>
              </div>
              {currentAnalysis.triMergeMiddle !== null && (
                <div className="bg-slate-700/30 rounded-lg p-3 text-center">
                  <span className="text-2xl font-bold text-slate-200">
                    {currentAnalysis.triMergeMiddle}
                  </span>
                  <p className="text-xs text-slate-400 mt-1">Tri-Merge Middle</p>
                </div>
              )}
              {currentAnalysis.relevantScore === null && (
                <p className="text-xs text-slate-500 italic mt-2">
                  Score was estimated based on available data
                </p>
              )}
            </motion.div>

            {/* Column 2: DTI Analysis */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6"
            >
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <PieChart className="w-5 h-5 text-blue-400" />
                Debt-to-Income
              </h3>
              {currentAnalysis.estimatedDTI !== null ? (
                <DTIDisplay
                  ratio={currentAnalysis.estimatedDTI}
                  status={
                    currentAnalysis.estimatedDTI <= 36
                      ? "GOOD"
                      : currentAnalysis.estimatedDTI <= 43
                        ? "BORDERLINE"
                        : currentAnalysis.estimatedDTI <= 50
                          ? "HIGH"
                          : "CRITICAL"
                  }
                  monthlyDebt={
                    currentAnalysis.statedIncome
                      ? Math.round(
                          (currentAnalysis.estimatedDTI / 100) *
                            (currentAnalysis.statedIncome / 12)
                        )
                      : 0
                  }
                  monthlyIncome={
                    currentAnalysis.statedIncome
                      ? Math.round(currentAnalysis.statedIncome / 12)
                      : 0
                  }
                  maxDTI={currentAnalysis.maxRecommendedDTI || 43}
                />
              ) : (
                <div className="text-center py-8">
                  <p className="text-slate-500 text-sm">
                    No DTI data available. Provide income for DTI analysis.
                  </p>
                </div>
              )}
            </motion.div>

            {/* Column 3: Key Findings */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6"
            >
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-400" />
                Key Findings
              </h3>
              {currentAnalysis.findings.length > 0 ? (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {currentAnalysis.findings.map((finding: any, i: number) => {
                    const severity =
                      SEVERITY_COLORS[finding.severity] || SEVERITY_COLORS.INFO;
                    return (
                      <div key={i} className="flex items-start gap-3">
                        <div
                          className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${severity.dot}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium text-slate-200">
                              {finding.title || finding.category}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-xs font-medium ${severity.bg} ${severity.text}`}
                            >
                              {finding.severity}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400">
                            {finding.detail || finding.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No findings available.</p>
              )}
            </motion.div>
          </div>

          {/* ================================================================= */}
          {/* Score Gap Analysis (Full Width)                                    */}
          {/* ================================================================= */}
          {currentAnalysis.scoreGapAnalysis && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="relative z-10 bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 mb-6"
            >
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                Score Gap Analysis
              </h3>
              <ScoreGapChart
                currentScore={currentAnalysis.scoreGapAnalysis.currentScore}
                targetScore={currentAnalysis.scoreGapAnalysis.targetScore}
                pointsNeeded={currentAnalysis.scoreGapAnalysis.gap}
                estimatedMonths={currentAnalysis.scoreGapAnalysis.estimatedTimeToTarget || "N/A"}
                factors={currentAnalysis.scoreGapAnalysis.factors || []}
              />
            </motion.div>
          )}

          {/* ================================================================= */}
          {/* Action Plan (Full Width)                                          */}
          {/* ================================================================= */}
          {currentAnalysis.actionPlan.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="relative z-10 bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 mb-6"
            >
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-blue-400" />
                Action Plan
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
                  {currentAnalysis.actionPlan.length} steps
                </span>
              </h3>
              <ActionPlanList steps={currentAnalysis.actionPlan} />
            </motion.div>
          )}

          {/* ================================================================= */}
          {/* Vendor Recommendations (Full Width, conditional)                  */}
          {/* ================================================================= */}
          {currentAnalysis.vendorRecommendations.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="relative z-10 bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 mb-6"
            >
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                Recommended Services
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentAnalysis.vendorRecommendations.map((vendor: any, i: number) => (
                  <div
                    key={i}
                    className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/30"
                  >
                    <p className="text-sm font-medium text-slate-200 mb-1">
                      {vendor.name || vendor.vendorName || "Service"}
                    </p>
                    <p className="text-xs text-slate-400 mb-2">
                      {vendor.description || vendor.reason || ""}
                    </p>
                    {vendor.category && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-400">
                        {vendor.category}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ================================================================= */}
          {/* Previous Analyses (Collapsible)                                   */}
          {/* ================================================================= */}
          {analyses.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="relative z-10 bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden mb-6"
            >
              <button
                onClick={() => setShowPreviousAnalyses(!showPreviousAnalyses)}
                className="w-full flex items-center justify-between p-6 hover:bg-slate-700/20 transition-colors"
              >
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-slate-400" />
                  Previous Analyses ({analyses.length})
                </h3>
                {showPreviousAnalyses ? (
                  <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </button>

              {showPreviousAnalyses && (
                <div className="px-6 pb-6 space-y-3">
                  {analyses.map((analysis, i) => {
                    const aTier = TIER_CONFIG[analysis.approvalTier] || TIER_CONFIG.NOT_READY;
                    const isSelected = i === selectedAnalysisIndex;
                    return (
                      <button
                        key={analysis.id}
                        onClick={() => setSelectedAnalysisIndex(i)}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all ${
                          isSelected
                            ? "bg-slate-700/50 border border-blue-500/50"
                            : "bg-slate-700/20 border border-transparent hover:bg-slate-700/30"
                        }`}
                      >
                        <ApprovalGauge
                          likelihood={analysis.approvalLikelihood}
                          tier={analysis.approvalTier}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-600/50 text-slate-300">
                              {PRODUCT_LABELS[analysis.productType] || analysis.productType}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${
                                aTier.color === "text-emerald-400"
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : aTier.color === "text-amber-400"
                                    ? "bg-amber-500/20 text-amber-400"
                                    : aTier.color === "text-orange-400"
                                      ? "bg-orange-500/20 text-orange-400"
                                      : "bg-red-500/20 text-red-400"
                              }`}
                            >
                              {aTier.text}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            {formatDate(analysis.createdAt)}
                          </p>
                        </div>
                        <span className="text-lg font-bold text-slate-300">
                          {analysis.approvalLikelihood}%
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
