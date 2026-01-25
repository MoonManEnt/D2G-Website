"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp } from "lucide-react";
import { FLOW_INFO, type ParsedAccountWithIssues } from "./types";

interface AccountCardProps {
  account: ParsedAccountWithIssues;
  isSelected: boolean;
  onToggle: () => void;
  selectedCRA: string;
}

export function AccountCard({ account, isSelected, onToggle, selectedCRA }: AccountCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Ensure issues is always an array (may come as JSON string from API)
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
        "rounded-xl border transition-all cursor-pointer",
        isSelected
          ? "bg-purple-500/15 border-purple-500/30"
          : "bg-slate-700/30 border-slate-600/50 hover:border-slate-500/50"
      )}
    >
      {/* Header */}
      <div
        className="flex items-start gap-3 p-3.5"
        onClick={onToggle}
      >
        <div className="pt-0.5">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggle}
            className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-white truncate">
            {account.creditorName}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
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

      {/* Issues List */}
      {issues.length > 0 && (
        <div className="px-3.5 pb-2">
          <div className="space-y-1.5">
            {issues.slice(0, expanded ? undefined : 2).map((issue, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span
                  className={cn(
                    "w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0",
                    getSeverityColor(issue.severity)
                  )}
                >
                  {issue.severity[0]}
                </span>
                <span className="text-slate-400 leading-snug">{issue.description}</span>
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

      {/* Bureau Divergence */}
      <div className="flex gap-2 px-3.5 py-2.5 border-t border-slate-600/30">
        {Object.entries(account.bureauData).map(([cra, data]) => (
          <div
            key={cra}
            className={cn(
              "flex-1 px-2 py-1.5 rounded-md bg-slate-800/50 text-center transition-opacity",
              cra === selectedCRA ? "opacity-100" : "opacity-50"
            )}
          >
            <span className="block text-[10px] font-semibold text-slate-500">
              {cra.slice(0, 2)}
            </span>
            <span className="block text-xs font-semibold text-white">
              {data.balance !== null ? `$${data.balance.toLocaleString()}` : "—"}
            </span>
          </div>
        ))}
      </div>

      {/* Suggested Flow */}
      <div className="flex items-center gap-2 px-3.5 pb-3 text-xs">
        <span className="text-slate-500">Suggested:</span>
        {account.suggestedFlow && FLOW_INFO[account.suggestedFlow] && (
          <Badge
            className="text-[10px] px-2"
            style={{
              background: `${FLOW_INFO[account.suggestedFlow].color}20`,
              color: FLOW_INFO[account.suggestedFlow].color,
            }}
          >
            {account.suggestedFlow}
          </Badge>
        )}
        <span className="ml-auto text-slate-500">
          {account.confidenceScore}% confidence
        </span>
      </div>
    </div>
  );
}
