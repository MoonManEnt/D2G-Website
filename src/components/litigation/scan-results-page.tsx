"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Scale,
  Shield,
  FileText,
  Clock,
  Zap,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { ViolationCard } from "./violation-card";
import { DamageSummary } from "./damage-summary";
import { CaseStrengthGauge } from "./case-strength-gauge";
import { CaseTimeline } from "./case-timeline";
import { ViolationFilter } from "./violation-filter";
import { DefendantList } from "./defendant-list";

interface ScanResultsPageProps {
  scan: {
    id: string;
    totalViolations: number;
    fcraViolations: number;
    fdcpaViolations: number;
    metro2Errors: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    violations: any[];
    damageEstimate: any;
    caseSummary: any;
    escalationPlan: any;
    computeTimeMs: number;
    createdAt: string;
  };
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ScanResultsPage({ scan }: ScanResultsPageProps) {
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [activeSeverities, setActiveSeverities] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Extract unique categories and severities from violations
  const categories = useMemo(() => {
    const cats = new Set<string>();
    scan.violations.forEach((v) => cats.add(v.category));
    return Array.from(cats);
  }, [scan.violations]);

  const severities = useMemo(() => {
    const sevs = new Set<string>();
    scan.violations.forEach((v) => sevs.add(v.severity));
    // Sort in logical order
    const order = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
    return Array.from(sevs).sort(
      (a, b) => order.indexOf(a) - order.indexOf(b)
    );
  }, [scan.violations]);

  // Filter violations based on active filters
  const filteredViolations = useMemo(() => {
    return scan.violations.filter((v) => {
      // Category filter
      if (activeCategories.length > 0 && !activeCategories.includes(v.category)) {
        return false;
      }

      // Severity filter
      if (activeSeverities.length > 0 && !activeSeverities.includes(v.severity)) {
        return false;
      }

      // Search filter (by creditor name in affected accounts)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesCreditor = v.affectedAccounts?.some(
          (acct: any) => acct.creditorName?.toLowerCase().includes(query)
        );
        const matchesTitle = v.title?.toLowerCase().includes(query);
        const matchesDefendant = v.defendants?.some(
          (d: string) => d.toLowerCase().includes(query)
        );
        if (!matchesCreditor && !matchesTitle && !matchesDefendant) {
          return false;
        }
      }

      return true;
    });
  }, [scan.violations, activeCategories, activeSeverities, searchQuery]);

  const handleCategoryToggle = (category: string) => {
    setActiveCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const handleSeverityToggle = (severity: string) => {
    setActiveSeverities((prev) =>
      prev.includes(severity)
        ? prev.filter((s) => s !== severity)
        : [...prev, severity]
    );
  };

  const handleClearAll = () => {
    setActiveCategories([]);
    setActiveSeverities([]);
    setSearchQuery("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between flex-wrap gap-3"
      >
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Litigation Scan Results
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {formatDate(scan.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-muted text-muted-foreground text-xs border-0 flex items-center gap-1">
            <Zap className="w-3 h-3" />
            {scan.computeTimeMs}ms
          </Badge>
          <Badge className="bg-muted text-muted-foreground text-xs border-0 font-mono">
            {scan.id.slice(0, 8)}
          </Badge>
        </div>
      </motion.div>

      {/* Top Row: Case Strength + Summary Stats */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid grid-cols-1 lg:grid-cols-12 gap-4"
      >
        {/* Case Strength Gauge */}
        <div className="lg:col-span-3">
          <Card className="bg-card border-border h-full">
            <CardContent className="p-6 flex items-center justify-center">
              {scan.caseSummary && (
                <CaseStrengthGauge
                  score={scan.caseSummary.caseStrengthScore ?? 0}
                  label={scan.caseSummary.caseStrengthLabel ?? "MODERATE"}
                  size="lg"
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Violation Stats */}
        <div className="lg:col-span-9 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* By Category */}
          <Card className="bg-card border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Scale className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-muted-foreground">FCRA</span>
              </div>
              <p className="text-2xl font-bold text-purple-400">
                {scan.fcraViolations}
              </p>
              <p className="text-[10px] text-muted-foreground">violations found</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">FDCPA</span>
              </div>
              <p className="text-2xl font-bold text-primary">
                {scan.fdcpaViolations}
              </p>
              <p className="text-[10px] text-muted-foreground">violations found</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Metro 2</span>
              </div>
              <p className="text-2xl font-bold text-muted-foreground">
                {scan.metro2Errors}
              </p>
              <p className="text-[10px] text-muted-foreground">errors detected</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-red-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-xs text-muted-foreground">Critical</span>
              </div>
              <p className="text-2xl font-bold text-red-400">
                {scan.criticalCount}
              </p>
              <p className="text-[10px] text-muted-foreground">critical issues</p>
            </CardContent>
          </Card>

          {/* Severity row */}
          <Card className="bg-card border-orange-500/15">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-orange-400" />
                <span className="text-xs text-muted-foreground">High</span>
              </div>
              <p className="text-2xl font-bold text-orange-400">
                {scan.highCount}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-yellow-500/15">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-muted-foreground">Medium</span>
              </div>
              <p className="text-2xl font-bold text-yellow-400">
                {scan.mediumCount}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-primary/15">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Low</span>
              </div>
              <p className="text-2xl font-bold text-primary">
                {scan.lowCount}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-emerald-500/15">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Scale className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-muted-foreground">Total</span>
              </div>
              <p className="text-2xl font-bold text-emerald-400">
                {scan.totalViolations}
              </p>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Tab Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Tabs defaultValue="violations" className="space-y-4">
          <TabsList className="bg-card border border-border">
            <TabsTrigger
              value="violations"
              className="data-[state=active]:bg-muted data-[state=active]:text-foreground"
            >
              <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
              Violations
            </TabsTrigger>
            <TabsTrigger
              value="damages"
              className="data-[state=active]:bg-muted data-[state=active]:text-foreground"
            >
              <Scale className="w-3.5 h-3.5 mr-1.5" />
              Damages
            </TabsTrigger>
            <TabsTrigger
              value="case-summary"
              className="data-[state=active]:bg-muted data-[state=active]:text-foreground"
            >
              <BookOpen className="w-3.5 h-3.5 mr-1.5" />
              Case Summary
            </TabsTrigger>
            <TabsTrigger
              value="escalation"
              className="data-[state=active]:bg-muted data-[state=active]:text-foreground"
            >
              <Zap className="w-3.5 h-3.5 mr-1.5" />
              Escalation
            </TabsTrigger>
          </TabsList>

          {/* Violations Tab */}
          <TabsContent value="violations" className="space-y-4">
            <ViolationFilter
              totalCount={scan.violations.length}
              filteredCount={filteredViolations.length}
              categories={categories}
              severities={severities}
              activeCategories={activeCategories}
              activeSeverities={activeSeverities}
              searchQuery={searchQuery}
              onCategoryToggle={handleCategoryToggle}
              onSeverityToggle={handleSeverityToggle}
              onSearchChange={setSearchQuery}
              onClearAll={handleClearAll}
            />

            {filteredViolations.length > 0 ? (
              <div className="space-y-3">
                {filteredViolations.map((violation) => (
                  <ViolationCard key={violation.id} violation={violation} />
                ))}
              </div>
            ) : (
              <Card className="bg-card border-border">
                <CardContent className="p-8 text-center">
                  <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No violations match the current filters.
                  </p>
                  <button
                    onClick={handleClearAll}
                    className="text-xs text-purple-400 hover:text-purple-300 mt-2 transition-colors"
                  >
                    Clear all filters
                  </button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Damages Tab */}
          <TabsContent value="damages" className="space-y-6">
            {scan.damageEstimate && (
              <>
                <DamageSummary damageEstimate={scan.damageEstimate} />
                {scan.damageEstimate.perDefendant && (
                  <DefendantList
                    defendants={scan.damageEstimate.perDefendant.map(
                      (def: any) => ({
                        name: def.name,
                        type: def.type,
                        violationCount: def.violationCount,
                        primaryStatutes: [],
                        estimatedLiabilityMin: def.estimatedMin,
                        estimatedLiabilityMax: def.estimatedMax,
                      })
                    )}
                  />
                )}
              </>
            )}
          </TabsContent>

          {/* Case Summary Tab */}
          <TabsContent value="case-summary" className="space-y-4">
            {scan.caseSummary && (
              <>
                {/* Key Findings */}
                {scan.caseSummary.keyFindings &&
                  scan.caseSummary.keyFindings.length > 0 && (
                    <Card className="bg-card border-border">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-purple-400" />
                          Key Findings
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          {scan.caseSummary.keyFindings.map(
                            (finding: string, idx: number) => (
                              <div
                                key={idx}
                                className="flex items-start gap-2.5 bg-background rounded-lg p-3 border border-border"
                              >
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                                <p className="text-sm text-muted-foreground">
                                  {finding}
                                </p>
                              </div>
                            )
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                {/* Causes of Action */}
                {scan.caseSummary.causesOfAction &&
                  scan.caseSummary.causesOfAction.length > 0 && (
                    <Card className="bg-card border-border">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                          <Scale className="w-4 h-4 text-primary" />
                          Causes of Action
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-3">
                          {scan.caseSummary.causesOfAction.map(
                            (cause: any, idx: number) => (
                              <div
                                key={idx}
                                className="bg-background rounded-lg p-4 border border-border"
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="text-sm font-semibold text-foreground">
                                    {cause.title || cause.statute || `Cause ${idx + 1}`}
                                  </h4>
                                  {cause.statute && (
                                    <Badge className="bg-primary/15 text-primary text-[10px] border-0 font-mono">
                                      {cause.statute}
                                    </Badge>
                                  )}
                                </div>
                                {cause.description && (
                                  <p className="text-xs text-muted-foreground mb-2">
                                    {cause.description}
                                  </p>
                                )}
                                {cause.elements && cause.elements.length > 0 && (
                                  <ul className="space-y-1 mt-2">
                                    {cause.elements.map(
                                      (element: string, eIdx: number) => (
                                        <li
                                          key={eIdx}
                                          className="text-xs text-muted-foreground flex items-start gap-2"
                                        >
                                          <span className="text-primary mt-0.5">
                                            *
                                          </span>
                                          {element}
                                        </li>
                                      )
                                    )}
                                  </ul>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                {/* Risk Factors */}
                {scan.caseSummary.riskFactors &&
                  scan.caseSummary.riskFactors.length > 0 && (
                    <Card className="bg-card border-amber-500/20">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          Risk Factors
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground">
                          Potential weaknesses or considerations that may affect
                          case outcome
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          {scan.caseSummary.riskFactors.map(
                            (risk: any, idx: number) => (
                              <div
                                key={idx}
                                className="flex items-start gap-2.5 bg-amber-500/5 rounded-lg p-3 border border-amber-500/15"
                              >
                                <XCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-sm text-muted-foreground">
                                    {typeof risk === "string"
                                      ? risk
                                      : risk.description || risk.title}
                                  </p>
                                  {typeof risk !== "string" && risk.mitigation && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Mitigation: {risk.mitigation}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                {/* Summary narrative */}
                {scan.caseSummary.narrative && (
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        Case Narrative
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                        {scan.caseSummary.narrative}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* Escalation Tab */}
          <TabsContent value="escalation">
            {scan.escalationPlan && (
              <Card className="bg-card border-border">
                <CardContent className="p-6">
                  <CaseTimeline escalationPlan={scan.escalationPlan} />
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}

export default ScanResultsPage;
