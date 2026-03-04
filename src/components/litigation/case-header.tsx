"use client";

import { motion } from "framer-motion";
import { Gavel, Calendar, Building2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CaseStrengthGauge } from "@/components/litigation/case-strength-gauge";

// =============================================================================
// TYPES
// =============================================================================

interface CaseHeaderProps {
  case: {
    caseNumber: string;
    status: string;
    strengthScore: number;
    strengthLabel: string;
    totalViolations: number;
    estimatedDamagesMin: number;
    estimatedDamagesMax: number;
    courtType: string;
    courtName: string;
    openedAt: string;
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  OPEN: {
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-500/20",
    border: "border-blue-500/30",
  },
  IN_PROGRESS: {
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-500/20",
    border: "border-amber-500/30",
  },
  SETTLED: {
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-500/20",
    border: "border-emerald-500/30",
  },
  WON: {
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-500/20",
    border: "border-emerald-500/30",
  },
  LOST: {
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-500/20",
    border: "border-red-500/30",
  },
  DISMISSED: {
    color: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-100 dark:bg-slate-500/20",
    border: "border-slate-500/30",
  },
  CLOSED: {
    color: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-100 dark:bg-slate-500/20",
    border: "border-slate-500/30",
  },
};

// =============================================================================
// HELPERS
// =============================================================================

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

export function CaseHeader({ case: caseData }: CaseHeaderProps) {
  const statusCfg = STATUS_CONFIG[caseData.status] || STATUS_CONFIG.OPEN;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="bg-gradient-to-br from-card to-background border-border">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left: Case info */}
            <div className="flex-1 space-y-4">
              {/* Case number and status */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/15">
                    <Gavel className="w-5 h-5 text-primary" />
                  </div>
                  <h1 className="text-xl font-bold text-foreground">
                    Case {caseData.caseNumber}
                  </h1>
                </div>

                <Badge
                  className={`${statusCfg.bg} ${statusCfg.color} border-0 text-xs px-3 py-1`}
                >
                  {caseData.status.replace("_", " ")}
                </Badge>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Violations */}
                <div className="bg-background rounded-lg px-4 py-3 border border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Violations
                    </span>
                  </div>
                  <p className="text-lg font-bold text-foreground">
                    {caseData.totalViolations}
                  </p>
                </div>

                {/* Estimated Damages */}
                <div className="bg-background rounded-lg px-4 py-3 border border-emerald-500/15">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Est. Damages
                    </span>
                  </div>
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(caseData.estimatedDamagesMin)} -{" "}
                    {formatCurrency(caseData.estimatedDamagesMax)}
                  </p>
                </div>

                {/* Court Info */}
                <div className="bg-background rounded-lg px-4 py-3 border border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Court
                    </span>
                  </div>
                  <p className="text-xs font-medium text-foreground truncate">
                    {caseData.courtName || caseData.courtType}
                  </p>
                </div>
              </div>

              {/* Date info */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                <span>Opened {formatDate(caseData.openedAt)}</span>
              </div>
            </div>

            {/* Right: Strength gauge */}
            <div className="flex items-center justify-center lg:justify-end">
              <CaseStrengthGauge
                score={caseData.strengthScore}
                label={caseData.strengthLabel}
                size="sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default CaseHeader;
