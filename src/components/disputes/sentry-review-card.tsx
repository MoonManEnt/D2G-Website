"use client";

// ============================================================================
// DISPUTE2GO - Sentry Review Card
// Individual account card within the Sentry analysis panel
// ============================================================================

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ChevronDown,
  ChevronUp,
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";
import type { SentryAccountAnalysis } from "./sentry-analysis-panel";

// ============================================================================
// Types
// ============================================================================

interface SentryReviewCardProps {
  analysis: SentryAccountAnalysis;
  onToggleInclude: (id: string, include: boolean) => void;
  included: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function SentryReviewCard({
  analysis,
  onToggleInclude,
  included,
}: SentryReviewCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getSuccessColor = (probability: number) => {
    if (probability >= 70) return "bg-emerald-500";
    if (probability >= 40) return "bg-amber-500";
    return "bg-red-500";
  };

  const getSuccessLabel = (probability: number) => {
    if (probability >= 70) return "text-emerald-400";
    if (probability >= 40) return "text-amber-400";
    return "text-red-400";
  };

  const getOCRBadge = () => {
    if (analysis.ocrSafetyScore >= 90) {
      return (
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
          <ShieldCheck className="w-3 h-3 mr-0.5" />
          OCR Safe
        </Badge>
      );
    }
    if (analysis.ocrSafetyScore >= 70) {
      return (
        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
          <Shield className="w-3 h-3 mr-0.5" />
          OCR Caution
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">
        <ShieldAlert className="w-3 h-3 mr-0.5" />
        OCR Risk
      </Badge>
    );
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "HIGH":
        return "bg-red-500";
      case "MEDIUM":
        return "bg-amber-500";
      default:
        return "bg-blue-500";
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border transition-all",
        included
          ? "bg-primary/5 border-primary/30"
          : "bg-muted border-input opacity-60"
      )}
    >
      {/* Main Row */}
      <div className="flex items-start gap-3 p-3.5">
        {/* Checkbox */}
        <div className="pt-0.5">
          <Checkbox
            checked={included}
            onCheckedChange={(checked) =>
              onToggleInclude(analysis.id, checked === true)
            }
            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
        </div>

        {/* Account Info */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-foreground truncate">
            {analysis.creditorName}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <span className="font-mono">{analysis.accountNumber}</span>
          </div>

          {/* Recommended e-OSCAR Codes */}
          <div className="flex flex-wrap gap-1 mt-2">
            {analysis.recommendedCodes.map((code) => (
              <Badge
                key={code}
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-primary/30 text-primary"
              >
                {code}
              </Badge>
            ))}
          </div>

          {/* Metro 2 Field Chips */}
          {analysis.metro2Fields.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {analysis.metro2Fields.map((field) => (
                <Badge
                  key={field}
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0"
                >
                  {field}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Right side: Success probability + OCR badge */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {/* OCR Safety Badge */}
          {getOCRBadge()}

          {/* Success Probability */}
          <div className="flex items-center gap-2 w-28">
            <Progress
              value={analysis.successProbability}
              className="h-1.5 flex-1"
              indicatorClassName={getSuccessColor(analysis.successProbability)}
            />
            <span
              className={cn(
                "text-xs font-semibold",
                getSuccessLabel(analysis.successProbability)
              )}
            >
              {analysis.successProbability}%
            </span>
          </div>
        </div>
      </div>

      {/* Expandable Details */}
      <div className="px-3.5 pb-2">
        <button
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              Hide details
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              Show details
            </>
          )}
        </button>

        {expanded && (
          <div className="mt-3 space-y-3 pb-2">
            {/* Explanation */}
            <div className="text-xs text-muted-foreground leading-relaxed p-2 bg-muted rounded-lg border border-input">
              {analysis.explanation}
            </div>

            {/* Issues */}
            {analysis.issues.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Detected Issues
                </p>
                {analysis.issues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span
                      className={cn(
                        "w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold text-foreground flex-shrink-0",
                        getSeverityColor(issue.severity)
                      )}
                    >
                      {issue.severity[0]}
                    </span>
                    <div className="flex-1">
                      <span className="text-muted-foreground">
                        {issue.description}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1 py-0 ml-1.5 border-input"
                      >
                        {issue.code}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* OCR Score Detail */}
            <div className="flex items-center justify-between p-2 bg-muted rounded-lg border border-input">
              <div className="flex items-center gap-2 text-xs">
                <Shield className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">OCR Safety Score</span>
              </div>
              <div className="flex items-center gap-2">
                <Progress
                  value={analysis.ocrSafetyScore}
                  className="h-1 w-16"
                  indicatorClassName={
                    analysis.ocrSafetyScore >= 90
                      ? "bg-emerald-500"
                      : analysis.ocrSafetyScore >= 70
                      ? "bg-amber-500"
                      : "bg-red-500"
                  }
                />
                <span className="text-xs font-medium text-foreground">
                  {analysis.ocrSafetyScore}%
                </span>
              </div>
            </div>

            {/* Warnings */}
            {analysis.ocrSafetyScore < 70 && (
              <div className="flex items-start gap-2 p-2 bg-red-500/10 rounded-lg border border-red-500/30">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-400">
                  Low OCR safety score. The letter content may contain elements
                  that could be flagged by automated scanning systems. Consider
                  reviewing before sending.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SentryReviewCard;
