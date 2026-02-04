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
  INFO: { text: "text-primary", bg: "bg-primary/20", dot: "bg-blue-500" },
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

  const fetchAnalyses = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/readiness`, {
        cache: "no-store",
      });
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
    // Immediately insert the new analysis from POST response so UI updates instantly
    if (data?.analysis) {
      const newAnalysis = parseAnalysis({
        id: data.analysis.id,
        productType: data.analysis.productType,
        statedIncome: data.analysis.statedIncome ?? null,
        reasonForApplying: data.analysis.reasonForApplying ?? null,
        relevantScoreModel: data.analysis.relevantScoreModel,
        relevantScore: data.analysis.relevantScore,
        triMergeMiddle: data.analysis.triMergeMiddle,
        approvalLikelihood: data.analysis.approvalLikelihood,
        approvalTier: data.analysis.approvalTier,
        approvalExplanation: data.analysis.explanation,
        estimatedDTI: data.analysis.dti?.estimatedDTI ?? null,
        maxRecommendedDTI: data.analysis.dti?.maxRecommendedDTI ?? null,
        actionPlan: data.analysis.actionPlan,
        findings: data.analysis.findings,
        recommendations: data.analysis.recommendations ?? [],
        scoreGapAnalysis: data.analysis.scoreGap,
        vendorRecommendations: data.analysis.vendorRecommendations ?? [],
        computeTimeMs: data.analysis.computeTimeMs,
        version: "2.0.0",
        createdAt: new Date().toISOString(),
      });
      setAnalyses((prev) => [newAnalysis, ...prev]);
      setSelectedAnalysisIndex(0);
    }
    // Also re-fetch in background to get canonical DB data
    fetchAnalyses(false);
  };

  // ---------------------------------------------------------------------------
  // Loading State
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error State
  // ---------------------------------------------------------------------------
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-background flex items-center justify-center">
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background text-foreground p-6">
      {/* Ambient glow */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg bg-card hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              Credit Readiness
            </h1>
            {clientName && (
              <p className="text-muted-foreground text-sm">{clientName}</p>
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
          className="relative z-10 bg-card backdrop-blur-xl border border-border rounded-2xl p-12 text-center"
        >
          <Target className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            No Readiness Analysis Yet
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
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
            className={`relative z-10 rounded-2xl p-6 mb-6 bg-gradient-to-br ${tierConfig.bg} border border-border backdrop-blur-xl`}
          >
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Left: Product badge + explanation */}
              <div className="flex-1 space-y-3">
                <span className="inline-block px-3 py-1 rounded-lg text-sm font-medium bg-card text-muted-foreground">
                  {PRODUCT_LABELS[currentAnalysis.productType] || currentAnalysis.productType}
                </span>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {currentAnalysis.approvalExplanation}
                </p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>
                    Model: <span className="text-muted-foreground">{currentAnalysis.relevantScoreModel}</span>
                  </span>
                  {currentAnalysis.relevantScore !== null && (
                    <span>
                      Score: <span className="text-foreground font-medium">{currentAnalysis.relevantScore}</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
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
              className="bg-card backdrop-blur-xl border border-border rounded-2xl p-6"
            >
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                Scoring Model
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                {currentAnalysis.relevantScoreModel}
              </p>
              <div className="bg-muted rounded-lg p-4 text-center mb-3">
                <span className="text-4xl font-bold text-foreground">
                  {currentAnalysis.relevantScore ?? "N/A"}
                </span>
                <p className="text-xs text-muted-foreground mt-1">Relevant Score</p>
              </div>
              {currentAnalysis.triMergeMiddle !== null && (
                <div className="bg-muted rounded-lg p-3 text-center">
                  <span className="text-2xl font-bold text-foreground">
                    {currentAnalysis.triMergeMiddle}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">Tri-Merge Middle</p>
                </div>
              )}
              {currentAnalysis.relevantScore === null && (
                <p className="text-xs text-muted-foreground italic mt-2">
                  Score was estimated based on available data
                </p>
              )}
            </motion.div>

            {/* Column 2: DTI Analysis */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-card backdrop-blur-xl border border-border rounded-2xl p-6"
            >
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <PieChart className="w-5 h-5 text-primary" />
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
                  <p className="text-muted-foreground text-sm">
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
              className="bg-card backdrop-blur-xl border border-border rounded-2xl p-6"
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
                            <span className="text-sm font-medium text-foreground">
                              {finding.title || finding.category}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-xs font-medium ${severity.bg} ${severity.text}`}
                            >
                              {finding.severity}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {finding.detail || finding.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No findings available.</p>
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
              className="relative z-10 bg-card backdrop-blur-xl border border-border rounded-2xl p-6 mb-6"
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
              className="relative z-10 bg-card backdrop-blur-xl border border-border rounded-2xl p-6 mb-6"
            >
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-primary" />
                Action Plan
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary">
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
              className="relative z-10 bg-card backdrop-blur-xl border border-border rounded-2xl p-6 mb-6"
            >
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                Recommended Services
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentAnalysis.vendorRecommendations.map((vendor: any, i: number) => (
                  <div
                    key={i}
                    className="bg-muted rounded-xl p-4 border border-input"
                  >
                    <p className="text-sm font-medium text-foreground mb-1">
                      {vendor.name || vendor.vendorName || "Service"}
                    </p>
                    <p className="text-xs text-muted-foreground mb-2">
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
              className="relative z-10 bg-card backdrop-blur-xl border border-border rounded-2xl overflow-hidden mb-6"
            >
              <button
                onClick={() => setShowPreviousAnalyses(!showPreviousAnalyses)}
                className="w-full flex items-center justify-between p-6 hover:bg-muted transition-colors"
              >
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  Previous Analyses ({analyses.length})
                </h3>
                {showPreviousAnalyses ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
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
                            ? "bg-muted border border-blue-500/50"
                            : "bg-muted border border-transparent hover:bg-muted"
                        }`}
                      >
                        <ApprovalGauge
                          likelihood={analysis.approvalLikelihood}
                          tier={analysis.approvalTier}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
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
                          <p className="text-xs text-muted-foreground">
                            {formatDate(analysis.createdAt)}
                          </p>
                        </div>
                        <span className="text-lg font-bold text-muted-foreground">
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
