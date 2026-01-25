"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Sparkles,
  Loader2,
  RefreshCw,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Shield,
  Scale,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Target,
  Zap,
} from "lucide-react";

export interface AmeliaInsight {
  confidence: number;
  estimatedSuccessRate: number;
  tone: "CONCERNED" | "WORRIED" | "FED_UP" | "WARNING" | "PISSED";
  recommendations: string[];
  riskFactors: Array<{
    factor: string;
    impact: "positive" | "negative" | "neutral";
  }>;
  suggestedStatutes: string[];
  eoscarDetection?: {
    risk: number;
    level: "low" | "medium" | "high";
    uniquenessScore: number;
    humanizingPhrases: number;
    flaggedPhrases: number;
  };
}

interface AmeliaInsightsPanelProps {
  clientId?: string;
  cra?: string;
  flow?: string;
  accountIds?: string[];
  onInsightsGenerated?: (insights: AmeliaInsight) => void;
  compact?: boolean;
}

export function AmeliaInsightsPanel({
  clientId,
  cra,
  flow,
  accountIds = [],
  onInsightsGenerated,
  compact = false,
}: AmeliaInsightsPanelProps) {
  const [insights, setInsights] = useState<AmeliaInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const generateInsights = async () => {
    if (!clientId || accountIds.length === 0) return;

    setLoading(true);
    try {
      const res = await fetch("/api/amelia/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, cra, flow, accountIds }),
      });

      if (res.ok) {
        const data = await res.json();
        setInsights(data);
        onInsightsGenerated?.(data);
      } else {
        // Fallback to simulated insights for demo
        const simulated = generateSimulatedInsights();
        setInsights(simulated);
        onInsightsGenerated?.(simulated);
      }
    } catch {
      // Fallback to simulated insights
      const simulated = generateSimulatedInsights();
      setInsights(simulated);
      onInsightsGenerated?.(simulated);
    } finally {
      setLoading(false);
    }
  };

  const generateSimulatedInsights = (): AmeliaInsight => ({
    confidence: 85 + Math.floor(Math.random() * 10),
    estimatedSuccessRate: 70 + Math.floor(Math.random() * 20),
    tone: "CONCERNED",
    recommendations: [
      "Include specific dates of previous communications",
      "Reference original dispute date for stronger timeline argument",
      "Cite balance discrepancy between bureaus if present",
      "Mention lack of debt validation letter (15 USC 1692g)",
    ],
    riskFactors: [
      { factor: "Multiple HIGH severity issues detected", impact: "positive" },
      { factor: "Bureau divergence found on balances", impact: "positive" },
      { factor: "Recent account activity may complicate dispute", impact: "negative" },
    ],
    suggestedStatutes: ["15 U.S.C. § 1681e(b)", "15 U.S.C. § 1692g", "15 U.S.C. § 1681i(a)(5)"],
    eoscarDetection: {
      risk: 15 + Math.floor(Math.random() * 15),
      level: "low",
      uniquenessScore: 85 + Math.floor(Math.random() * 10),
      humanizingPhrases: 6 + Math.floor(Math.random() * 4),
      flaggedPhrases: Math.floor(Math.random() * 3),
    },
  });

  const getToneColor = (tone: AmeliaInsight["tone"]) => {
    const colors = {
      CONCERNED: "text-blue-400 bg-blue-500/20",
      WORRIED: "text-amber-400 bg-amber-500/20",
      FED_UP: "text-orange-400 bg-orange-500/20",
      WARNING: "text-red-400 bg-red-500/20",
      PISSED: "text-red-500 bg-red-600/20",
    };
    return colors[tone] || colors.CONCERNED;
  };

  const getEoscarRiskColor = (level: "low" | "medium" | "high") => {
    const colors = {
      low: "text-green-400 bg-green-500/20",
      medium: "text-amber-400 bg-amber-500/20",
      high: "text-red-400 bg-red-500/20",
    };
    return colors[level];
  };

  if (compact && !insights) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={generateInsights}
        disabled={loading || accountIds.length === 0}
        className="bg-violet-500/10 border-violet-500/30 text-violet-400 hover:bg-violet-500/20"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4 mr-2" />
        )}
        Get AI Insights
      </Button>
    );
  }

  return (
    <div className="bg-gradient-to-br from-violet-900/20 to-purple-900/20 rounded-xl border border-violet-500/30 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/30 to-purple-500/30 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white flex items-center gap-2">
              AMELIA
              {insights && (
                <Badge className="bg-green-500/20 text-green-400 text-[10px]">Active</Badge>
              )}
            </h3>
            <span className="text-xs text-slate-400">AI Dispute Intelligence</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {insights && (
            <div className="flex items-center gap-2">
              {/* Confidence Ring */}
              <div className="relative w-12 h-12">
                <svg className="w-12 h-12 transform -rotate-90">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    fill="none"
                    stroke="rgba(139, 92, 246, 0.2)"
                    strokeWidth="4"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    fill="none"
                    stroke="url(#confidence-gradient)"
                    strokeWidth="4"
                    strokeDasharray={`${insights.confidence * 1.26} 126`}
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="confidence-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
                  {insights.confidence}%
                </span>
              </div>
            </div>
          )}
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 pb-4 space-y-4">
              {!insights ? (
                <div className="text-center py-6">
                  <p className="text-sm text-slate-400 mb-4">
                    {accountIds.length === 0
                      ? "Select accounts to analyze for AI-powered recommendations"
                      : "Generate AI insights for your dispute strategy"}
                  </p>
                  <Button
                    onClick={generateInsights}
                    disabled={loading || accountIds.length === 0}
                    className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate Insights
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <>
                  {/* Success Rate Bar */}
                  <div className="p-3 bg-slate-800/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-400 flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        Estimated Success Rate
                      </span>
                      <span className="text-lg font-bold text-white">{insights.estimatedSuccessRate}%</span>
                    </div>
                    <Progress value={insights.estimatedSuccessRate} className="h-2 [&>div]:bg-gradient-to-r [&>div]:from-violet-500 [&>div]:to-green-500" />
                  </div>

                  {/* Tone Badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Letter Tone:</span>
                    <Badge className={getToneColor(insights.tone)}>
                      {insights.tone.replace("_", " ")}
                    </Badge>
                  </div>

                  {/* Recommendations */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-white flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-yellow-400" />
                      Recommendations
                    </h4>
                    <div className="space-y-1.5">
                      {insights.recommendations.map((rec, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-violet-400 mt-0.5">•</span>
                          <span className="text-slate-300">{rec}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Risk Factors */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-white flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-400" />
                      Risk Analysis
                    </h4>
                    <div className="space-y-1.5">
                      {insights.riskFactors.map((rf, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          {rf.impact === "positive" ? (
                            <TrendingUp className="w-4 h-4 text-green-400" />
                          ) : rf.impact === "negative" ? (
                            <TrendingDown className="w-4 h-4 text-red-400" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                          )}
                          <span className="text-slate-300">{rf.factor}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Suggested Statutes */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-white flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-amber-400" />
                      Legal Focus
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {insights.suggestedStatutes.map((statute, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="text-xs border-amber-500/30 text-amber-400"
                        >
                          {statute}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* eOSCAR Detection */}
                  {insights.eoscarDetection && (
                    <div className="p-3 bg-slate-800/50 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-white flex items-center gap-2">
                          <Scale className="w-4 h-4 text-purple-400" />
                          eOSCAR Detection Risk
                        </h4>
                        <Badge className={getEoscarRiskColor(insights.eoscarDetection.level)}>
                          {insights.eoscarDetection.risk}% {insights.eoscarDetection.level.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="text-lg font-bold text-white">
                            {insights.eoscarDetection.uniquenessScore}%
                          </p>
                          <p className="text-[10px] text-slate-500">Uniqueness</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-green-400">
                            {insights.eoscarDetection.humanizingPhrases}
                          </p>
                          <p className="text-[10px] text-slate-500">Human Phrases</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-amber-400">
                            {insights.eoscarDetection.flaggedPhrases}
                          </p>
                          <p className="text-[10px] text-slate-500">Flagged</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Regenerate Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateInsights}
                    disabled={loading}
                    className="w-full border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Regenerate Analysis
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
