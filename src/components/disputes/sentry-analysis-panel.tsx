"use client";

// ============================================================================
// DISPUTE2GO - Sentry Analysis Panel
// Displays Sentry's analysis of client accounts grouped by CRA
// ============================================================================

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useApiQuery, useMutation } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { useToast } from "@/lib/use-toast";
import {
  Shield,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";
import { SentryReviewCard } from "./sentry-review-card";

// ============================================================================
// Types
// ============================================================================

export interface SentryAccountAnalysis {
  id: string;
  creditorName: string;
  accountNumber: string;
  cra: string;
  flow: string;
  round: number;
  recommendedCodes: string[];
  metro2Fields: string[];
  successProbability: number;
  ocrSafetyScore: number;
  ocrSafetyLabel: string;
  issues: Array<{
    code: string;
    description: string;
    severity: "HIGH" | "MEDIUM" | "LOW";
  }>;
  explanation: string;
}

interface CRAGroup {
  cra: string;
  flow: string;
  round: number;
  accounts: SentryAccountAnalysis[];
  aggregateSuccessProbability: number;
}

interface AnalysisResponse {
  groups: CRAGroup[];
  readiness: "READY" | "NEEDS_REVIEW" | "NOT_READY";
  summary: string;
}

interface SentryAnalysisPanelProps {
  clientId: string;
  onPlanApproved: (disputes: any[]) => void;
}

// ============================================================================
// Component
// ============================================================================

export function SentryAnalysisPanel({
  clientId,
  onPlanApproved,
}: SentryAnalysisPanelProps) {
  const { toast } = useToast();
  const [includedAccounts, setIncludedAccounts] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Fetch analysis on mount
  const {
    data: analysis,
    loading,
    error,
    refetch,
  } = useApiQuery<AnalysisResponse>(
    async () => {
      const res = await fetch("/api/sentry/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Analysis failed" }));
        throw new Error(err.message || "Failed to analyze accounts");
      }
      return res.json();
    },
    [clientId]
  );

  // Initialize included accounts once analysis loads
  const initializeIncludes = useCallback(
    (groups: CRAGroup[]) => {
      const allIds = new Set<string>();
      groups.forEach((group) =>
        group.accounts.forEach((a) => allIds.add(a.id))
      );
      setIncludedAccounts(allIds);
      // Expand all groups by default
      setExpandedGroups(new Set(groups.map((g) => `${g.cra}-${g.flow}-${g.round}`)));
    },
    []
  );

  // Initialize on first data load
  if (analysis && includedAccounts.size === 0 && analysis.groups.length > 0) {
    initializeIncludes(analysis.groups);
  }

  // Execute approved plan
  const { mutate: executePlan, loading: executing } = useMutation<
    { disputes: any[] },
    { clientId: string; accountIds: string[] }
  >(
    async (variables) => {
      const res = await fetch("/api/sentry/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(variables),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Execution failed" }));
        throw new Error(err.message || "Failed to execute plan");
      }
      return res.json();
    },
    {
      onSuccess: (data) => {
        toast({
          title: "Plan Executed",
          description: `Successfully generated ${data.disputes.length} dispute(s).`,
        });
        onPlanApproved(data.disputes);
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to execute dispute plan. Please try again.",
          variant: "destructive",
        });
      },
    }
  );

  const handleToggleInclude = (accountId: string, include: boolean) => {
    setIncludedAccounts((prev) => {
      const next = new Set(prev);
      if (include) {
        next.add(accountId);
      } else {
        next.delete(accountId);
      }
      return next;
    });
  };

  const handleToggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const handleApproveAndGenerate = () => {
    if (includedAccounts.size === 0) {
      toast({
        title: "No Accounts Selected",
        description: "Please include at least one account in the plan.",
        variant: "destructive",
      });
      return;
    }
    executePlan({
      clientId,
      accountIds: Array.from(includedAccounts),
    });
  };

  const getReadinessBadge = (readiness: string) => {
    switch (readiness) {
      case "READY":
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
            <CheckCircle className="w-3 h-3 mr-1" />
            READY
          </Badge>
        );
      case "NEEDS_REVIEW":
        return (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
            <AlertTriangle className="w-3 h-3 mr-1" />
            NEEDS REVIEW
          </Badge>
        );
      default:
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <XCircle className="w-3 h-3 mr-1" />
            NOT READY
          </Badge>
        );
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <CardTitle className="text-sm text-foreground">
                Sentry Analyzing Accounts...
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-4">
              Evaluating credit report data, Metro 2 fields, and dispute history
              to build an optimized plan.
            </p>
            <Progress value={undefined} className="h-1.5" />
          </CardContent>
        </Card>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-8">
          <div className="text-center space-y-3">
            <XCircle className="w-8 h-8 text-red-400 mx-auto" />
            <p className="text-sm text-foreground font-medium">Analysis Failed</p>
            <p className="text-xs text-muted-foreground">{error.message}</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Retry Analysis
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) return null;

  const totalAccounts = analysis.groups.reduce(
    (sum, g) => sum + g.accounts.length,
    0
  );
  const includedCount = includedAccounts.size;

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Sentry Analysis
            </CardTitle>
            {getReadinessBadge(analysis.readiness)}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            {analysis.summary}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs">
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">{includedCount}</span>
                {" / "}{totalAccounts} accounts selected
              </span>
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">{analysis.groups.length}</span>
                {" "}CRA group{analysis.groups.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CRA Groups */}
      {analysis.groups.map((group) => {
        const groupKey = `${group.cra}-${group.flow}-${group.round}`;
        const isExpanded = expandedGroups.has(groupKey);
        const groupIncluded = group.accounts.filter((a) =>
          includedAccounts.has(a.id)
        ).length;

        return (
          <Card key={groupKey} className="bg-card border-border">
            <CardHeader className="pb-3">
              <button
                className="flex items-center justify-between w-full text-left"
                onClick={() => handleToggleGroup(groupKey)}
              >
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs font-semibold",
                      group.cra === "Experian"
                        ? "border-blue-500/40 text-blue-400"
                        : group.cra === "Equifax"
                        ? "border-red-500/40 text-red-400"
                        : "border-sky-500/40 text-sky-400"
                    )}
                  >
                    {group.cra}
                  </Badge>
                  <div>
                    <span className="text-sm font-medium text-foreground">
                      {group.flow} Flow
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      Round {group.round}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">
                      {groupIncluded}/{group.accounts.length} accounts
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            group.aggregateSuccessProbability >= 70
                              ? "bg-emerald-500"
                              : group.aggregateSuccessProbability >= 40
                              ? "bg-amber-500"
                              : "bg-red-500"
                          )}
                          style={{
                            width: `${group.aggregateSuccessProbability}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium text-foreground">
                        {group.aggregateSuccessProbability}%
                      </span>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </button>
            </CardHeader>

            {isExpanded && (
              <CardContent>
                <div className="space-y-3">
                  {group.accounts.map((account) => (
                    <SentryReviewCard
                      key={account.id}
                      analysis={account}
                      included={includedAccounts.has(account.id)}
                      onToggleInclude={handleToggleInclude}
                    />
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Approve & Generate Button */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border p-4 -mx-4 -mb-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            <Sparkles className="w-3 h-3 inline mr-1" />
            {includedCount} account{includedCount !== 1 ? "s" : ""} will be
            included in the dispute plan
          </div>
          <Button
            onClick={handleApproveAndGenerate}
            disabled={executing || includedCount === 0}
            className="gap-2"
          >
            {executing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            Approve & Generate
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SentryAnalysisPanel;
