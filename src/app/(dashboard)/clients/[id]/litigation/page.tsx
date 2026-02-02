"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Gavel,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Clock,
  Scale,
  Shield,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/lib/use-toast";

// =============================================================================
// TYPES
// =============================================================================

interface Violation {
  id: string;
  ruleId: string;
  category: "FCRA" | "FDCPA" | "METRO2";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  statute: string;
  statuteShortName: string;
  title: string;
  description: string;
  evidence: Array<{
    type: string;
    description: string;
    bureauData?: Record<string, string | number | null>;
  }>;
  affectedAccounts: Array<{
    accountId: string;
    creditorName: string;
    cra: string;
    fingerprint: string;
    accountType: string | null;
    accountStatus: string;
    balance: number | null;
  }>;
  defendants: string[];
  caselaw: string[];
  estimatedDamagesMin: number;
  estimatedDamagesMax: number;
}

interface DamageBreakdown {
  type: string;
  label: string;
  min: number;
  max: number;
  description: string;
}

interface DefendantDamage {
  name: string;
  type: "CRA" | "FURNISHER" | "COLLECTOR";
  violationCount: number;
  estimatedMin: number;
  estimatedMax: number;
}

interface CaseSummary {
  strengthScore: number;
  strengthLabel: "STRONG" | "MODERATE" | "WEAK";
  defendants: Array<{
    name: string;
    type: "CRA" | "FURNISHER" | "COLLECTOR";
    violationCount: number;
    primaryStatutes: string[];
    estimatedLiabilityMin: number;
    estimatedLiabilityMax: number;
  }>;
  causesOfAction: Array<{
    statute: string;
    shortName: string;
    description: string;
    violationCount: number;
    isWillful: boolean;
  }>;
  keyFindings: string[];
  riskFactors: string[];
}

interface EscalationStep {
  stage: string;
  title: string;
  description: string;
  isCompleted: boolean;
  isCurrent: boolean;
  isRecommended: boolean;
  actions: string[];
}

interface EscalationPlan {
  currentStage: string;
  recommendedNextStage: string;
  steps: EscalationStep[];
}

interface LitigationScan {
  id: string;
  clientId: string;
  reportId: string;
  scanStatus: string;
  totalViolations: number;
  fcraViolations: number;
  fdcpaViolations: number;
  metro2Errors: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  estimatedTotalMin: number;
  estimatedTotalMax: number;
  violations: Violation[];
  damageEstimate: {
    totalMin: number;
    totalMax: number;
    breakdown: DamageBreakdown[];
    perDefendant: DefendantDamage[];
  };
  caseSummary: CaseSummary;
  escalationPlan: EscalationPlan;
  computeTimeMs: number | null;
  version: string | null;
  createdAt: string;
}

// =============================================================================
// CONSTANTS & HELPERS
// =============================================================================

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  CRITICAL: { color: "text-red-400", bg: "bg-red-500/20", border: "border-red-500/30" },
  HIGH: { color: "text-orange-400", bg: "bg-orange-500/20", border: "border-orange-500/30" },
  MEDIUM: { color: "text-amber-400", bg: "bg-amber-500/20", border: "border-amber-500/30" },
  LOW: { color: "text-blue-400", bg: "bg-primary/20", border: "border-primary/30" },
};

const CATEGORY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  FCRA: { color: "text-purple-400", bg: "bg-purple-500/20", label: "FCRA" },
  FDCPA: { color: "text-sky-400", bg: "bg-sky-500/20", label: "FDCPA" },
  METRO2: { color: "text-teal-400", bg: "bg-teal-500/20", label: "Metro 2" },
};

const STRENGTH_CONFIG: Record<string, { color: string; bg: string }> = {
  STRONG: { color: "text-emerald-400", bg: "from-emerald-500/20 to-emerald-600/10" },
  MODERATE: { color: "text-amber-400", bg: "from-amber-500/20 to-amber-600/10" },
  WEAK: { color: "text-red-400", bg: "from-red-500/20 to-red-600/10" },
};

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

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

// =============================================================================
// VIOLATION CARD COMPONENT
// =============================================================================

function ViolationCard({ violation }: { violation: Violation }) {
  const [expanded, setExpanded] = useState(false);
  const severity = SEVERITY_CONFIG[violation.severity] || SEVERITY_CONFIG.LOW;
  const category = CATEGORY_CONFIG[violation.category] || CATEGORY_CONFIG.FCRA;

  return (
    <Card className={`bg-card border-border ${severity.border}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge className={`${severity.bg} ${severity.color} text-xs`}>
                {violation.severity}
              </Badge>
              <Badge className={`${category.bg} ${category.color} text-xs`}>
                {category.label}
              </Badge>
              <span className="text-xs text-muted-foreground font-mono">
                {violation.statuteShortName}
              </span>
            </div>
            <h4 className="text-sm font-semibold text-foreground">{violation.title}</h4>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-muted-foreground">Est. Damages</p>
            <p className="text-sm font-semibold text-foreground">
              {formatCurrency(violation.estimatedDamagesMin)} - {formatCurrency(violation.estimatedDamagesMax)}
            </p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-3">{violation.description}</p>

        {/* Affected Accounts Summary */}
        {violation.affectedAccounts.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {violation.affectedAccounts.map((acct) => (
              <span
                key={acct.accountId}
                className="px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground"
              >
                {acct.creditorName} ({acct.cra})
              </span>
            ))}
          </div>
        )}

        {/* Expand/Collapse for details */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
        >
          {expanded ? "Hide details" : "Show details"}
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 pt-3 border-t border-border space-y-3"
          >
            {/* Evidence */}
            {violation.evidence.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Evidence:</p>
                <ul className="space-y-1">
                  {violation.evidence.map((ev, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500 mt-1.5 flex-shrink-0" />
                      {ev.description}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Defendants */}
            {violation.defendants.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Defendants:</p>
                <div className="flex flex-wrap gap-1">
                  {violation.defendants.map((def, i) => (
                    <Badge key={i} variant="outline" className="text-xs text-muted-foreground border-input">
                      {def}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Case Law */}
            {violation.caselaw.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Relevant Case Law:</p>
                <ul className="space-y-0.5">
                  {violation.caselaw.map((c, i) => (
                    <li key={i} className="text-xs text-muted-foreground italic">
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Statute */}
            <div>
              <p className="text-xs text-muted-foreground">
                Full Citation: <span className="text-muted-foreground">{violation.statute}</span>
              </p>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// SCAN RESULTS DISPLAY (inline component)
// =============================================================================

function ScanResultsDisplay({ scan }: { scan: LitigationScan }) {
  const [activeSection, setActiveSection] = useState<"violations" | "damages" | "case" | "escalation">("violations");
  const strengthConfig = STRENGTH_CONFIG[scan.caseSummary?.strengthLabel] || STRENGTH_CONFIG.WEAK;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl bg-card border border-border p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-xs text-muted-foreground">Total Violations</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{scan.totalViolations}</p>
          <div className="flex gap-2 mt-1">
            {scan.criticalCount > 0 && (
              <span className="text-[10px] text-red-400">{scan.criticalCount} critical</span>
            )}
            {scan.highCount > 0 && (
              <span className="text-[10px] text-orange-400">{scan.highCount} high</span>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl bg-card border border-border p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Scale className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-muted-foreground">FCRA Violations</span>
          </div>
          <p className="text-2xl font-bold text-purple-400">{scan.fcraViolations}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl bg-card border border-border p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-sky-400" />
            <span className="text-xs text-muted-foreground">FDCPA Violations</span>
          </div>
          <p className="text-2xl font-bold text-sky-400">{scan.fdcpaViolations}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl bg-card border border-border p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Gavel className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-muted-foreground">Est. Damages</span>
          </div>
          <p className="text-lg font-bold text-emerald-400">
            {formatCurrency(scan.estimatedTotalMin)}
          </p>
          <p className="text-xs text-muted-foreground">
            to {formatCurrency(scan.estimatedTotalMax)}
          </p>
        </motion.div>
      </div>

      {/* Case Strength Banner */}
      {scan.caseSummary && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className={`rounded-xl p-5 bg-gradient-to-br ${strengthConfig.bg} border border-border`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Case Strength</p>
              <p className={`text-xl font-bold ${strengthConfig.color}`}>
                {scan.caseSummary.strengthLabel} ({scan.caseSummary.strengthScore}/100)
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-1">Causes of Action</p>
              <p className="text-lg font-semibold text-foreground">
                {scan.caseSummary.causesOfAction?.length || 0}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Section Tabs */}
      <div className="flex gap-1 bg-card rounded-lg p-1 border border-border">
        {[
          { key: "violations" as const, label: "Violations", count: scan.totalViolations },
          { key: "damages" as const, label: "Damage Estimate", count: null },
          { key: "case" as const, label: "Case Summary", count: null },
          { key: "escalation" as const, label: "Escalation Plan", count: null },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key)}
            className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all ${
              activeSection === tab.key
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {tab.label}
            {tab.count !== null && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-muted">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Violations Section */}
      {activeSection === "violations" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3"
        >
          {scan.violations.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="py-8 text-center">
                <Shield className="w-10 h-10 mx-auto text-emerald-500 mb-3" />
                <p className="text-muted-foreground font-medium">No violations detected</p>
                <p className="text-muted-foreground text-sm mt-1">
                  The scan did not find any FCRA, FDCPA, or Metro 2 violations.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Group by severity */}
              {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((sev) => {
                const filtered = scan.violations.filter((v) => v.severity === sev);
                if (filtered.length === 0) return null;
                return (
                  <div key={sev}>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      {sev} ({filtered.length})
                    </h4>
                    <div className="space-y-2">
                      {filtered.map((v) => (
                        <ViolationCard key={v.id} violation={v} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </motion.div>
      )}

      {/* Damages Section */}
      {activeSection === "damages" && scan.damageEstimate && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          {/* Total Estimate */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground text-lg">Total Estimated Damages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4">
                <p className="text-3xl font-bold text-emerald-400">
                  {formatCurrency(scan.damageEstimate.totalMin)} - {formatCurrency(scan.damageEstimate.totalMax)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Breakdown */}
          {scan.damageEstimate.breakdown && scan.damageEstimate.breakdown.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground text-lg">Damage Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {scan.damageEstimate.breakdown.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">
                          {formatCurrency(item.min)} - {formatCurrency(item.max)}
                        </p>
                        <Badge className="text-[10px] bg-muted text-muted-foreground">
                          {item.type}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Per Defendant */}
          {scan.damageEstimate.perDefendant && scan.damageEstimate.perDefendant.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground text-lg">Per Defendant</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {scan.damageEstimate.perDefendant.map((def, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{def.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge className="text-[10px] bg-muted text-muted-foreground">
                              {def.type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {def.violationCount} violations
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-foreground">
                        {formatCurrency(def.estimatedMin)} - {formatCurrency(def.estimatedMax)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

      {/* Case Summary Section */}
      {activeSection === "case" && scan.caseSummary && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          {/* Key Findings */}
          {scan.caseSummary.keyFindings && scan.caseSummary.keyFindings.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  Key Findings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {scan.caseSummary.keyFindings.map((finding, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">{finding}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Causes of Action */}
          {scan.caseSummary.causesOfAction && scan.caseSummary.causesOfAction.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground text-lg flex items-center gap-2">
                  <Scale className="w-5 h-5 text-purple-400" />
                  Causes of Action
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {scan.caseSummary.causesOfAction.map((cause, i) => (
                    <div key={i} className="p-3 rounded-lg bg-muted">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground">{cause.shortName}</span>
                        <span className="text-xs text-muted-foreground font-mono">{cause.statute}</span>
                        {cause.isWillful && (
                          <Badge className="text-[10px] bg-red-500/20 text-red-400">Willful</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{cause.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {cause.violationCount} violation{cause.violationCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Defendants */}
          {scan.caseSummary.defendants && scan.caseSummary.defendants.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground text-lg flex items-center gap-2">
                  <Gavel className="w-5 h-5 text-red-400" />
                  Potential Defendants
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {scan.caseSummary.defendants.map((def, i) => (
                    <div key={i} className="p-3 rounded-lg bg-muted">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{def.name}</span>
                          <Badge className="text-[10px] bg-muted text-muted-foreground">
                            {def.type}
                          </Badge>
                        </div>
                        <span className="text-sm font-semibold text-foreground">
                          {formatCurrency(def.estimatedLiabilityMin)} - {formatCurrency(def.estimatedLiabilityMax)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {def.primaryStatutes.map((s, j) => (
                          <span key={j} className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-400">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Risk Factors */}
          {scan.caseSummary.riskFactors && scan.caseSummary.riskFactors.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5 text-red-400" />
                  Risk Factors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {scan.caseSummary.riskFactors.map((risk, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">{risk}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

      {/* Escalation Plan Section */}
      {activeSection === "escalation" && scan.escalationPlan && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground text-lg flex items-center gap-2">
                <Scale className="w-5 h-5 text-primary" />
                Escalation Plan
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Current stage: {scan.escalationPlan.currentStage?.replace(/_/g, " ") || "N/A"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {scan.escalationPlan.steps && scan.escalationPlan.steps.length > 0 ? (
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-muted" />

                  <div className="space-y-4">
                    {scan.escalationPlan.steps.map((step, i) => (
                      <div key={i} className="relative pl-10">
                        {/* Dot */}
                        <div
                          className={`absolute left-2.5 w-3 h-3 rounded-full border-2 ${
                            step.isCompleted
                              ? "bg-emerald-500 border-emerald-400"
                              : step.isCurrent
                                ? "bg-blue-500 border-blue-400"
                                : step.isRecommended
                                  ? "bg-amber-500 border-amber-400"
                                  : "bg-muted border-input"
                          }`}
                        />

                        <div
                          className={`p-4 rounded-lg ${
                            step.isCurrent
                              ? "bg-primary/10 border border-primary/30"
                              : step.isRecommended
                                ? "bg-amber-500/10 border border-amber-500/30"
                                : "bg-muted"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-foreground">{step.title}</span>
                            {step.isCompleted && (
                              <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400">Completed</Badge>
                            )}
                            {step.isCurrent && (
                              <Badge className="text-[10px] bg-primary/20 text-primary">Current</Badge>
                            )}
                            {step.isRecommended && !step.isCurrent && (
                              <Badge className="text-[10px] bg-amber-500/20 text-amber-400">Recommended Next</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">{step.description}</p>
                          {step.actions.length > 0 && (
                            <ul className="space-y-1">
                              {step.actions.map((action, j) => (
                                <li key={j} className="text-xs text-muted-foreground flex items-center gap-1.5">
                                  <span className="w-1 h-1 rounded-full bg-slate-500" />
                                  {action}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No escalation steps available.</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Scan Metadata Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDate(scan.createdAt)}
          </span>
          {scan.computeTimeMs !== null && (
            <span>{scan.computeTimeMs}ms compute</span>
          )}
        </div>
        {scan.version && <span>v{scan.version}</span>}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function ClientLitigationPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const clientId = params.id as string;

  const [scans, setScans] = useState<LitigationScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedScanIndex, setSelectedScanIndex] = useState(0);
  const [showPreviousScans, setShowPreviousScans] = useState(false);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [stateCode, setStateCode] = useState("");
  const [deleteConfirmScanId, setDeleteConfirmScanId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------

  const fetchScans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/litigation-scan`);
      if (!res.ok) throw new Error("Failed to fetch litigation scans");
      const data = await res.json();
      setScans(data.scans || []);
      setSelectedScanIndex(0);
    } catch (err: any) {
      setError(err.message || "Failed to load litigation scan data");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchScans();
  }, [fetchScans]);

  // ---------------------------------------------------------------------------
  // Run New Scan
  // ---------------------------------------------------------------------------

  const handleRunScan = async () => {
    setScanning(true);
    setScanDialogOpen(false);
    try {
      const body: Record<string, string> = {};
      if (stateCode.trim()) {
        body.clientState = stateCode.trim().toUpperCase();
      }

      const res = await fetch(`/api/clients/${clientId}/litigation-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to run scan");
      }

      toast({
        title: "Scan Complete",
        description: "Litigation scan has finished successfully.",
      });

      setStateCode("");
      await fetchScans();
    } catch (err: any) {
      toast({
        title: "Scan Failed",
        description: err.message || "An error occurred while running the scan.",
        variant: "destructive",
      });
    } finally {
      setScanning(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Delete Scan
  // ---------------------------------------------------------------------------

  const handleDeleteScan = async (scanId: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/litigation-scan/${scanId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete scan");

      toast({
        title: "Scan Deleted",
        description: "The litigation scan has been removed.",
      });

      setDeleteConfirmScanId(null);
      await fetchScans();
    } catch (err: any) {
      toast({
        title: "Delete Failed",
        description: err.message || "Could not delete the scan.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Loading State
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error State
  // ---------------------------------------------------------------------------

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-red-400 mb-4">{error}</p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  const currentScan = scans[selectedScanIndex] || null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full min-h-0 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/clients/${clientId}`}
            className="p-2 hover:bg-card rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Gavel className="w-6 h-6 text-purple-400" />
              Litigation Scanner
            </h1>
            <p className="text-muted-foreground text-sm">
              FCRA/FDCPA violation detection and damage estimation
            </p>
          </div>
        </div>
        <Button
          onClick={() => setScanDialogOpen(true)}
          disabled={scanning}
          className="gap-2 bg-purple-600 hover:bg-purple-700 text-foreground"
        >
          {scanning ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {scanning ? "Scanning..." : "Run New Scan"}
        </Button>
      </div>

      {/* Scanning Overlay */}
      <AnimatePresence>
        {scanning && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-xl bg-purple-500/10 border border-purple-500/30 p-6 text-center"
          >
            <Loader2 className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-3" />
            <p className="text-purple-300 font-medium">Running Litigation Scan...</p>
            <p className="text-muted-foreground text-sm mt-1">
              Analyzing credit report data for FCRA, FDCPA, and Metro 2 violations.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {scans.length === 0 && !scanning && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-xl p-12 text-center"
        >
          <Gavel className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            No litigation scans yet
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            Run a litigation scan to automatically detect FCRA and FDCPA violations
            in this client&apos;s credit report data. The scanner identifies potential
            legal violations, estimates damages, and provides an escalation plan.
          </p>
          <Button
            onClick={() => setScanDialogOpen(true)}
            className="gap-2 bg-purple-600 hover:bg-purple-700 text-foreground"
          >
            <Gavel className="w-4 h-4" />
            Run First Scan
          </Button>
        </motion.div>
      )}

      {/* Current Scan Results */}
      {currentScan && !scanning && (
        <>
          <ScanResultsDisplay scan={currentScan} />

          {/* Previous Scans (Collapsible) */}
          {scans.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-card border border-border rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setShowPreviousScans(!showPreviousScans)}
                className="w-full flex items-center justify-between p-5 hover:bg-muted transition-colors"
              >
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  Scan History ({scans.length})
                </h3>
                {showPreviousScans ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </button>

              <AnimatePresence>
                {showPreviousScans && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-5 pb-5 space-y-2"
                  >
                    {scans.map((scan, i) => {
                      const isSelected = i === selectedScanIndex;
                      return (
                        <div
                          key={scan.id}
                          className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                            isSelected
                              ? "bg-muted border border-blue-500/50"
                              : "bg-muted border border-transparent hover:bg-muted"
                          }`}
                        >
                          <button
                            onClick={() => setSelectedScanIndex(i)}
                            className="flex-1 flex items-center gap-4 text-left"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-foreground">
                                  {formatDate(scan.createdAt)}
                                </span>
                                {i === 0 && (
                                  <Badge className="text-[10px] bg-primary/20 text-primary">
                                    Latest
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span>{scan.totalViolations} violations</span>
                                <span className="text-muted-foreground">|</span>
                                <span className="text-emerald-400">
                                  {formatCurrency(scan.estimatedTotalMin)} - {formatCurrency(scan.estimatedTotalMax)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {scan.criticalCount > 0 && (
                                <Badge className="text-[10px] bg-red-500/20 text-red-400">
                                  {scan.criticalCount} critical
                                </Badge>
                              )}
                              {scan.highCount > 0 && (
                                <Badge className="text-[10px] bg-orange-500/20 text-orange-400">
                                  {scan.highCount} high
                                </Badge>
                              )}
                            </div>
                          </button>

                          {/* Delete button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmScanId(scan.id);
                            }}
                            className="p-2 rounded-lg hover:bg-red-500/20 transition-colors flex-shrink-0"
                            title="Delete scan"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </>
      )}

      {/* Run Scan Dialog */}
      <Dialog open={scanDialogOpen} onOpenChange={setScanDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Gavel className="w-5 h-5 text-purple-400" />
              Run Litigation Scan
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Scan the client&apos;s credit report data for FCRA, FDCPA, and Metro 2 violations.
              Optionally provide a state code for statute of limitations analysis.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-foreground">State Code (Optional)</Label>
              <Input
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value.toUpperCase())}
                placeholder="e.g., TX, CA, NY"
                maxLength={2}
                className="bg-muted border-input text-foreground uppercase"
              />
              <p className="text-xs text-muted-foreground">
                2-letter state code for statute of limitations lookup. If not provided,
                the client&apos;s address state will be used.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setScanDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRunScan}
              className="gap-2 bg-purple-600 hover:bg-purple-700 text-foreground"
            >
              <Gavel className="w-4 h-4" />
              Start Scan
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirmScanId}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmScanId(null);
        }}
      >
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-400" />
              Delete Scan
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to delete this litigation scan? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteConfirmScanId(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmScanId && handleDeleteScan(deleteConfirmScanId)}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Scan
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
