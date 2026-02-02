"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  AlertCircle,
  Info,
  Scale,
  BookOpen,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface ViolationCardProps {
  violation: {
    id: string;
    ruleId: string;
    category: string;
    severity: string;
    statute: string;
    statuteShortName: string;
    title: string;
    description: string;
    evidence: Array<{
      type: string;
      description: string;
      bureauData?: Record<string, any>;
    }>;
    affectedAccounts: Array<{
      creditorName: string;
      cra: string;
      accountStatus: string;
      balance: number | null;
    }>;
    defendants: string[];
    caselaw: string[];
    estimatedDamagesMin: number;
    estimatedDamagesMax: number;
  };
}

const severityConfig: Record<
  string,
  { color: string; bg: string; border: string; icon: React.ElementType }
> = {
  CRITICAL: {
    color: "text-red-400",
    bg: "bg-red-500/20",
    border: "border-red-500/30",
    icon: AlertTriangle,
  },
  HIGH: {
    color: "text-orange-400",
    bg: "bg-orange-500/20",
    border: "border-orange-500/30",
    icon: AlertTriangle,
  },
  MEDIUM: {
    color: "text-yellow-400",
    bg: "bg-yellow-500/20",
    border: "border-yellow-500/30",
    icon: AlertCircle,
  },
  LOW: {
    color: "text-primary",
    bg: "bg-primary/20",
    border: "border-primary/30",
    icon: Info,
  },
};

const categoryConfig: Record<string, { color: string; bg: string }> = {
  FCRA: { color: "text-purple-400", bg: "bg-purple-500/20" },
  FDCPA: { color: "text-blue-400", bg: "bg-blue-500/20" },
  METRO2: { color: "text-slate-300", bg: "bg-slate-500/20" },
};

function formatCentsAsDollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function ViolationCard({ violation }: ViolationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const severity = severityConfig[violation.severity] || severityConfig.LOW;
  const category = categoryConfig[violation.category] || categoryConfig.FCRA;
  const SeverityIcon = severity.icon;

  return (
    <Card
      className={`bg-card border ${severity.border} hover:border-opacity-60 transition-all duration-200`}
    >
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded-t-lg"
        aria-expanded={isExpanded}
      >
        <div className="flex items-start gap-3">
          {/* Severity icon */}
          <div
            className={`mt-0.5 p-1.5 rounded-lg ${severity.bg} flex-shrink-0`}
          >
            <SeverityIcon className={`w-4 h-4 ${severity.color}`} />
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge className={`${severity.bg} ${severity.color} text-[10px] px-2 py-0 border-0`}>
                {violation.severity}
              </Badge>
              <Badge className={`${category.bg} ${category.color} text-[10px] px-2 py-0 border-0`}>
                {violation.category}
              </Badge>
              <span className="text-xs text-muted-foreground font-mono">
                {violation.ruleId}
              </span>
            </div>

            <h3 className="text-sm font-semibold text-foreground mb-1">
              {violation.title}
            </h3>

            <p className="text-xs text-muted-foreground line-clamp-2">
              {violation.description}
            </p>

            {/* Statute citation */}
            <div className="flex items-center gap-1.5 mt-2">
              <Scale className="w-3 h-3 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground font-mono">
                {violation.statute}
              </span>
              {violation.statuteShortName && (
                <span className="text-[11px] text-muted-foreground">
                  ({violation.statuteShortName})
                </span>
              )}
            </div>
          </div>

          {/* Damages + expand toggle */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Est. Damages</p>
              <p className="text-sm font-bold text-emerald-400">
                {formatCentsAsDollars(violation.estimatedDamagesMin)} -{" "}
                {formatCentsAsDollars(violation.estimatedDamagesMax)}
              </p>
            </div>
            <div className="text-muted-foreground">
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </div>
        </div>
      </button>

      {/* Expandable details */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <CardContent className="pt-0 px-4 pb-4">
              <div className="border-t border-border pt-4 space-y-4">
                {/* Evidence section */}
                {violation.evidence.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" />
                      Evidence ({violation.evidence.length})
                    </h4>
                    <div className="space-y-2">
                      {violation.evidence.map((ev, idx) => (
                        <div
                          key={idx}
                          className="bg-background rounded-lg p-3 border border-border"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0 border-0">
                              {ev.type}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {ev.description}
                          </p>
                          {ev.bureauData &&
                            Object.keys(ev.bureauData).length > 0 && (
                              <div className="mt-2 flex gap-2 flex-wrap">
                                {Object.entries(ev.bureauData).map(
                                  ([bureau, data]) => (
                                    <div
                                      key={bureau}
                                      className="bg-card px-2 py-1 rounded text-[10px]"
                                    >
                                      <span className="text-muted-foreground font-semibold">
                                        {bureau}:
                                      </span>{" "}
                                      <span className="text-muted-foreground">
                                        {typeof data === "object"
                                          ? JSON.stringify(data)
                                          : String(data)}
                                      </span>
                                    </div>
                                  )
                                )}
                              </div>
                            )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Affected accounts section */}
                {violation.affectedAccounts.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Affected Accounts ({violation.affectedAccounts.length})
                    </h4>
                    <div className="bg-background rounded-lg border border-border overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 px-3 text-muted-foreground font-medium">
                              Creditor
                            </th>
                            <th className="text-left py-2 px-3 text-muted-foreground font-medium">
                              Bureau
                            </th>
                            <th className="text-left py-2 px-3 text-muted-foreground font-medium">
                              Status
                            </th>
                            <th className="text-right py-2 px-3 text-muted-foreground font-medium">
                              Balance
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {violation.affectedAccounts.map((acct, idx) => (
                            <tr
                              key={idx}
                              className="border-b border-border last:border-0"
                            >
                              <td className="py-2 px-3 text-muted-foreground font-medium">
                                {acct.creditorName}
                              </td>
                              <td className="py-2 px-3">
                                <Badge className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0 border-0">
                                  {acct.cra}
                                </Badge>
                              </td>
                              <td className="py-2 px-3 text-muted-foreground">
                                {acct.accountStatus}
                              </td>
                              <td className="py-2 px-3 text-right text-muted-foreground font-mono">
                                {acct.balance !== null
                                  ? formatCentsAsDollars(acct.balance)
                                  : "--"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Defendants section */}
                {violation.defendants.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Defendants
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {violation.defendants.map((def, idx) => (
                        <Badge
                          key={idx}
                          className="bg-muted text-muted-foreground text-xs px-2.5 py-1 border border-input"
                        >
                          {def}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Case law section */}
                {violation.caselaw.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5" />
                      Case Law References ({violation.caselaw.length})
                    </h4>
                    <div className="space-y-1.5">
                      {violation.caselaw.map((cite, idx) => (
                        <div
                          key={idx}
                          className="bg-background rounded px-3 py-2 border border-border"
                        >
                          <p className="text-xs text-muted-foreground font-mono italic">
                            {cite}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Damages detail */}
                <div className="bg-emerald-500/10 rounded-lg p-3 border border-emerald-500/20">
                  <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
                    Estimated Damages Range
                  </h4>
                  <p className="text-lg font-bold text-emerald-400">
                    {formatCentsAsDollars(violation.estimatedDamagesMin)} -{" "}
                    {formatCentsAsDollars(violation.estimatedDamagesMax)}
                  </p>
                </div>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export default ViolationCard;
