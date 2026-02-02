"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Lock,
  Timer,
  Eye
} from "lucide-react";
import { FLOW_INFO, type ParsedAccountWithIssues, type ActiveDisputeInfo } from "./types";

interface SmartAccountCardProps {
  account: ParsedAccountWithIssues;
  isSelected: boolean;
  onToggle: () => void;
  selectedCRA: string;
  selectedFlow: string;
  onSelectFlow: (flow: string) => void;
  onViewDispute?: (disputeId: string) => void;
}

export function SmartAccountCard({
  account,
  isSelected,
  onToggle,
  selectedCRA,
  selectedFlow,
  onSelectFlow,
  onViewDispute
}: SmartAccountCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showFlows, setShowFlows] = useState(false);

  // Parse issues safely
  const parseIssues = () => {
    if (Array.isArray(account.detectedIssues)) return account.detectedIssues;
    if (typeof account.detectedIssues === "string") {
      try {
        const parsed = JSON.parse(account.detectedIssues);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const issues = parseIssues();
  const highSeverityCount = issues.filter((i) => i.severity === "HIGH").length;

  // Determine applicable flows based on issues
  const getApplicableFlows = (): string[] => {
    if (account.applicableFlows && account.applicableFlows.length > 0) {
      return account.applicableFlows;
    }

    // Auto-determine flows based on issue codes
    const flows = new Set<string>();

    for (const issue of issues) {
      const code = issue.code?.toUpperCase() || "";

      // Collection-related issues -> COLLECTION flow
      if (code.includes("COLLECTION") ||
          code.includes("CHARGEOFF") ||
          code.includes("CHARGE_OFF") ||
          code.includes("DEBT_VALIDATION")) {
        flows.add("COLLECTION");
      }

      // Accuracy-related issues -> ACCURACY flow
      if (code.includes("ACCURACY") ||
          code.includes("INCONSISTENCY") ||
          code.includes("BALANCE") ||
          code.includes("DATE") ||
          code.includes("STATUS") ||
          code.includes("MISSING") ||
          code.includes("LATE_PAYMENT") ||
          code.includes("PAYMENT_HISTORY") ||
          code.includes("OUTDATED")) {
        flows.add("ACCURACY");
      }

      // Consent-related issues -> CONSENT flow
      if (code.includes("CONSENT") ||
          code.includes("UNAUTHORIZED") ||
          code.includes("INQUIRY") ||
          code.includes("PERMISSIBLE")) {
        flows.add("CONSENT");
      }
    }

    // Default to ACCURACY if no specific flow determined
    if (flows.size === 0) {
      flows.add("ACCURACY");
    }

    // Add COMBO if multiple flows apply
    if (flows.size >= 2) {
      flows.add("COMBO");
    }

    return Array.from(flows);
  };

  const applicableFlows = getApplicableFlows();
  const hasActiveDispute = !!account.activeDispute;
  const activeDispute = account.activeDispute;

  // Check if account is locked (only SENT disputes lock accounts)
  // DRAFT disputes allow editing/starting over, RESPONDED/RESOLVED are completed
  const isLocked = hasActiveDispute && activeDispute?.status === "SENT";

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "HIGH": return "bg-red-500";
      case "MEDIUM": return "bg-amber-500";
      default: return "bg-blue-500";
    }
  };

  // Render active dispute banner
  const renderActiveDisputeBanner = () => {
    if (!activeDispute) return null;

    const isOverdue = activeDispute.isOverdue;
    const daysRemaining = activeDispute.daysRemaining || 0;

    return (
      <div className={cn(
        "mx-3 mb-3 p-3 rounded-lg border",
        isOverdue
          ? "bg-red-500/10 border-red-500/30"
          : "bg-amber-500/10 border-amber-500/30"
      )}>
        <div className="flex items-center gap-2 mb-2">
          {isOverdue ? (
            <AlertTriangle className="w-4 h-4 text-red-400" />
          ) : (
            <Clock className="w-4 h-4 text-amber-400" />
          )}
          <span className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            isOverdue ? "text-red-400" : "text-amber-400"
          )}>
            {isOverdue ? "FCRA Deadline Exceeded" : "Pending Response"}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge
                className="text-[10px]"
                style={{
                  background: `${FLOW_INFO[activeDispute.flow]?.color || "#6b7280"}20`,
                  color: FLOW_INFO[activeDispute.flow]?.color || "#6b7280",
                }}
              >
                {activeDispute.flow} R{activeDispute.round}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Sent {activeDispute.sentDate ? new Date(activeDispute.sentDate).toLocaleDateString() : "N/A"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Timer className="w-3 h-3 text-muted-foreground" />
              <span className={cn(
                "text-xs font-medium",
                isOverdue ? "text-red-400" : daysRemaining <= 7 ? "text-amber-400" : "text-muted-foreground"
              )}>
                {isOverdue
                  ? `${Math.abs(daysRemaining)} days overdue`
                  : `${daysRemaining} days remaining`}
              </span>
            </div>
          </div>

          {onViewDispute && (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => onViewDispute(activeDispute.disputeId)}
            >
              <Eye className="w-3 h-3 mr-1" />
              View
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        "rounded-xl border transition-all",
        isLocked
          ? "bg-card border-input opacity-75"
          : isSelected
            ? "bg-purple-500/15 border-purple-500/30"
            : "bg-muted border-input hover:border-border"
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-start gap-3 p-3.5",
          isLocked ? "cursor-not-allowed" : "cursor-pointer"
        )}
        onClick={isLocked ? undefined : onToggle}
      >
        <div className="pt-0.5">
          {isLocked ? (
            <Lock className="w-4 h-4 text-muted-foreground" />
          ) : (
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggle}
              className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-foreground truncate">
            {account.creditorName}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <span className="font-mono">{account.maskedAccountId || "N/A"}</span>
            <span className="opacity-70">{account.accountType || "Unknown"}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span
            className={cn(
              "text-base font-bold",
              account.balance && account.balance > 0 ? "text-red-400" : "text-emerald-400"
            )}
          >
            ${account.balance?.toLocaleString() || "0"}
          </span>
          {highSeverityCount > 0 && (
            <Badge className="bg-red-500/20 text-red-400 text-[10px] px-1.5 py-0">
              {highSeverityCount} HIGH
            </Badge>
          )}
        </div>
      </div>

      {/* Active Dispute Banner */}
      {renderActiveDisputeBanner()}

      {/* Issues List */}
      {issues.length > 0 && !isLocked && (
        <div className="px-3.5 pb-2">
          <div className="space-y-1.5">
            {issues.slice(0, expanded ? undefined : 2).map((issue, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span
                  className={cn(
                    "w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold text-foreground flex-shrink-0",
                    getSeverityColor(issue.severity)
                  )}
                >
                  {issue.severity[0]}
                </span>
                <span className="text-muted-foreground leading-snug">{issue.description}</span>
              </div>
            ))}
            {issues.length > 2 && (
              <button
                className="text-purple-400 text-xs hover:text-purple-300 transition flex items-center gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(!expanded);
                }}
              >
                {expanded ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    +{issues.length - 2} more issues
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Applicable Flows Section - Only for non-locked accounts */}
      {!isLocked && (
        <div className="px-3.5 py-2.5 border-t border-input">
          <button
            className="w-full flex items-center justify-between text-xs"
            onClick={(e) => {
              e.stopPropagation();
              setShowFlows(!showFlows);
            }}
          >
            <span className="text-muted-foreground font-medium">Applicable Flows</span>
            <div className="flex items-center gap-2">
              {applicableFlows.map((flow) => (
                <Badge
                  key={flow}
                  className={cn(
                    "text-[10px] px-1.5 cursor-pointer transition-all",
                    selectedFlow === flow && "ring-1 ring-white/30"
                  )}
                  style={{
                    background: `${FLOW_INFO[flow]?.color || "#6b7280"}20`,
                    color: FLOW_INFO[flow]?.color || "#6b7280",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectFlow(flow);
                  }}
                >
                  {flow}
                </Badge>
              ))}
              {showFlows ? (
                <ChevronUp className="w-3 h-3 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              )}
            </div>
          </button>

          {/* Expanded flow details */}
          {showFlows && (
            <div className="mt-3 space-y-2">
              {applicableFlows.map((flow) => {
                const info = FLOW_INFO[flow];
                const nextRound = account.nextAvailableRound?.[flow] || 1;
                const isSelectedFlow = selectedFlow === flow;

                return (
                  <button
                    key={flow}
                    className={cn(
                      "w-full flex items-center gap-3 p-2 rounded-lg border transition-all text-left",
                      isSelectedFlow
                        ? "border-opacity-50"
                        : "bg-muted border-input hover:border-border"
                    )}
                    style={isSelectedFlow ? {
                      background: `${info?.color}15`,
                      borderColor: `${info?.color}40`,
                    } : undefined}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectFlow(flow);
                    }}
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: info?.color }}
                    />
                    <div className="flex-1">
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          isSelectedFlow ? "" : "text-muted-foreground"
                        )}
                        style={isSelectedFlow ? { color: info?.color } : undefined}
                      >
                        {flow}
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-2">
                        {info?.description}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {isSelectedFlow && (
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                      )}
                      <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                        R{nextRound}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Bureau Divergence - Compact for locked items */}
      <div className={cn(
        "flex gap-2 px-3.5 py-2.5 border-t border-input",
        isLocked && "opacity-50"
      )}>
        {Object.entries(account.bureauData || {}).map(([cra, data]) => (
          <div
            key={cra}
            className={cn(
              "flex-1 px-2 py-1.5 rounded-md bg-card text-center transition-opacity",
              cra === selectedCRA ? "opacity-100" : "opacity-50"
            )}
          >
            <span className="block text-[10px] font-semibold text-muted-foreground">
              {cra.slice(0, 2)}
            </span>
            <span className="block text-xs font-semibold text-foreground">
              {data?.balance !== null && data?.balance !== undefined
                ? `$${data.balance.toLocaleString()}`
                : "—"}
            </span>
          </div>
        ))}
      </div>

      {/* Confidence Score Footer */}
      {!isLocked && (
        <div className="flex items-center justify-between px-3.5 pb-3 text-xs">
          <span className="text-muted-foreground">
            {account.confidenceScore}% match confidence
          </span>
          {account.suggestedFlow && (
            <span className="text-muted-foreground">
              Suggested: <span style={{ color: FLOW_INFO[account.suggestedFlow]?.color }}>
                {account.suggestedFlow}
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
