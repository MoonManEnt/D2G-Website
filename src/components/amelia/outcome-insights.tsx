"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  RefreshCw,
  Filter,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

interface OutcomePattern {
  id: string;
  cra: string;
  flow: string;
  creditorName: string | null;
  accountType: string | null;
  totalDisputes: number;
  deletions: number;
  verifiedOnly: number;
  noResponse: number;
  successRate: number;
  avgDaysToResolve: number | null;
  sampleSize: number;
  isReliable: boolean;
}

interface PatternSummary {
  totalPatterns: number;
  avgSuccessRate: number;
  bestPerforming: {
    flow: string;
    cra: string;
    creditor: string | null;
    successRate: number;
    sampleSize: number;
  } | null;
  worstPerforming: {
    flow: string;
    cra: string;
    creditor: string | null;
    successRate: number;
    sampleSize: number;
  } | null;
}

interface OutcomeInsightsProps {
  className?: string;
}

export function OutcomeInsights({ className = "" }: OutcomeInsightsProps) {
  const [patterns, setPatterns] = useState<OutcomePattern[]>([]);
  const [summary, setSummary] = useState<PatternSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterCRA, setFilterCRA] = useState<string>("");
  const [filterFlow, setFilterFlow] = useState<string>("");

  const fetchPatterns = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterCRA) params.set("cra", filterCRA);
      if (filterFlow) params.set("flow", filterFlow);

      const res = await fetch(`/api/amelia/patterns?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPatterns(data.patterns || []);
        setSummary(data.summary || null);
      }
    } catch (error) {
      console.error("Failed to fetch patterns:", error);
    } finally {
      setLoading(false);
    }
  }, [filterCRA, filterFlow]);

  useEffect(() => {
    fetchPatterns();
  }, [fetchPatterns]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/amelia/patterns", { method: "POST" });
      await fetchPatterns();
    } catch (error) {
      console.error("Failed to refresh patterns:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const getSuccessColor = (rate: number) => {
    if (rate >= 70) return "text-green-400";
    if (rate >= 40) return "text-yellow-400";
    return "text-red-400";
  };

  const getSuccessBarColor = (rate: number) => {
    if (rate >= 70) return "bg-green-500";
    if (rate >= 40) return "bg-yellow-500";
    return "bg-red-500";
  };

  if (loading) {
    return (
      <div className={`bg-card border border-border rounded-xl p-6 ${className}`}>
        <div className="h-6 w-48 bg-muted rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-muted/50 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-card border border-border rounded-xl p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">
            Outcome Insights
          </h3>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
          title="Recompute patterns"
        >
          <RefreshCw
            className={`h-4 w-4 text-muted-foreground ${refreshing ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Avg Success Rate</p>
            <p
              className={`text-xl font-bold ${getSuccessColor(summary.avgSuccessRate)}`}
            >
              {summary.avgSuccessRate}%
            </p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Patterns Tracked</p>
            <p className="text-xl font-bold text-foreground">
              {summary.totalPatterns}
            </p>
          </div>
          {summary.bestPerforming && (
            <div className="bg-green-500/5 border border-green-500/10 rounded-lg p-3 col-span-2">
              <div className="flex items-center gap-1 mb-1">
                <TrendingUp className="h-3 w-3 text-green-400" />
                <p className="text-xs text-green-400 font-medium">
                  Best Strategy
                </p>
              </div>
              <p className="text-sm text-foreground">
                {summary.bestPerforming.flow}
                {summary.bestPerforming.creditor
                  ? ` vs ${summary.bestPerforming.creditor}`
                  : ""}{" "}
                on {summary.bestPerforming.cra} —{" "}
                <span className="font-bold text-green-400">
                  {summary.bestPerforming.successRate.toFixed(0)}%
                </span>{" "}
                (n={summary.bestPerforming.sampleSize})
              </p>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <select
          value={filterCRA}
          onChange={(e) => setFilterCRA(e.target.value)}
          className="text-xs bg-muted border border-border rounded px-2 py-1 text-foreground"
        >
          <option value="">All CRAs</option>
          <option value="TRANSUNION">TransUnion</option>
          <option value="EXPERIAN">Experian</option>
          <option value="EQUIFAX">Equifax</option>
        </select>
        <select
          value={filterFlow}
          onChange={(e) => setFilterFlow(e.target.value)}
          className="text-xs bg-muted border border-border rounded px-2 py-1 text-foreground"
        >
          <option value="">All Flows</option>
          <option value="ACCURACY">Accuracy</option>
          <option value="COLLECTION">Collection</option>
          <option value="CONSENT">Consent</option>
          <option value="COMBO">Combo</option>
        </select>
      </div>

      {/* Pattern Bars */}
      {patterns.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No outcome patterns yet.</p>
          <p className="text-xs mt-1">
            Patterns will appear after 10+ disputes are completed.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {patterns.slice(0, 10).map((pattern, index) => (
            <motion.div
              key={pattern.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
              className="flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-foreground truncate">
                    {pattern.flow}
                    {pattern.creditorName
                      ? ` vs ${pattern.creditorName}`
                      : ""}{" "}
                    <span className="text-muted-foreground">
                      ({pattern.cra})
                    </span>
                  </p>
                  <span
                    className={`text-xs font-mono font-bold ${getSuccessColor(pattern.successRate)}`}
                  >
                    {pattern.successRate.toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${getSuccessBarColor(pattern.successRate)}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pattern.successRate}%` }}
                    transition={{ delay: index * 0.05, duration: 0.5 }}
                  />
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    n={pattern.sampleSize}
                  </span>
                  <span className="text-[10px] text-green-400/70">
                    {pattern.deletions} deleted
                  </span>
                  <span className="text-[10px] text-yellow-400/70">
                    {pattern.verifiedOnly} verified
                  </span>
                  {pattern.avgDaysToResolve && (
                    <span className="text-[10px] text-muted-foreground">
                      ~{pattern.avgDaysToResolve.toFixed(0)}d avg
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
