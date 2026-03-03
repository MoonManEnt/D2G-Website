"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Gavel,
  AlertTriangle,
  DollarSign,
  Users,
  Loader2,
  ChevronRight,
  Scale,
  Shield,
  TrendingUp,
  Search,
  RefreshCw,
  FileText,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/use-toast";

// =============================================================================
// TYPES
// =============================================================================

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  _count?: {
    reports: number;
    disputes: number;
  };
}

interface ClientWithScanSummary extends Client {
  scanSummary: {
    totalScans: number;
    latestScanDate: string | null;
    totalViolations: number;
    criticalCount: number;
    highCount: number;
    estimatedDamagesMin: number;
    estimatedDamagesMax: number;
  } | null;
  scanLoading: boolean;
}

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

function formatDate(dateStr: string) {
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
// ANIMATION VARIANTS
// =============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

// =============================================================================
// STAT CARD COMPONENT
// =============================================================================

function StatCard({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: typeof Users;
  value: string | number;
  label: string;
  color: string;
}) {
  const colorClasses: Record<string, { bg: string; text: string; icon: string }> = {
    purple: { bg: "bg-purple-500/10", text: "text-purple-400", icon: "text-purple-400" },
    red: { bg: "bg-red-500/10", text: "text-red-400", icon: "text-red-400" },
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", icon: "text-emerald-400" },
    blue: { bg: "bg-primary/10", text: "text-primary", icon: "text-primary" },
    amber: { bg: "bg-amber-500/10", text: "text-amber-400", icon: "text-amber-400" },
  };

  const colors = colorClasses[color] || colorClasses.purple;

  return (
    <div className={`rounded-xl ${colors.bg} border border-border p-4`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colors.bg}`}>
          <Icon className={`w-5 h-5 ${colors.icon}`} />
        </div>
        <div>
          <p className={`text-2xl font-bold ${colors.text}`}>{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

interface LitigationCaseOverview {
  id: string;
  caseNumber: string;
  status: string;
  currentStage: string;
  strengthLabel: string;
  totalViolations: number;
  estimatedDamagesMin: number;
  estimatedDamagesMax: number;
  courtType: string | null;
  openedAt: string;
  clientId: string;
  defendants: Array<{ id: string; name: string; type: string }>;
  _count: { actions: number; documents: number; deadlines: number };
}

export default function LitigationOverviewPage() {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"scanner" | "cases">("scanner");
  const [activeCases, setActiveCases] = useState<(LitigationCaseOverview & { clientName: string })[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [clients, setClients] = useState<ClientWithScanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingScanData, setLoadingScanData] = useState(false);
  const [aggregateStats, setAggregateStats] = useState({
    totalScans: 0,
    totalViolations: 0,
    highestDamagesMax: 0,
    clientsScanned: 0,
  });

  // ---------------------------------------------------------------------------
  // Fetch Clients
  // ---------------------------------------------------------------------------

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Failed to fetch clients");
      const data = await res.json();
      const clientList: Client[] = Array.isArray(data) ? data : data.data || [];

      const clientsWithScan: ClientWithScanSummary[] = clientList.map((c) => ({
        ...c,
        scanSummary: null,
        scanLoading: false,
      }));

      setClients(clientsWithScan);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to load clients",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Load Scan Data for All Clients
  // ---------------------------------------------------------------------------

  const loadAllScanData = async () => {
    setLoadingScanData(true);

    let totalScans = 0;
    let totalViolations = 0;
    let highestDamagesMax = 0;
    let clientsScanned = 0;

    const updated = [...clients];

    for (let i = 0; i < updated.length; i++) {
      const client = updated[i];
      try {
        const res = await fetch(`/api/clients/${client.id}/litigation-scan`);
        if (res.ok) {
          const data = await res.json();
          const scans = data.scans || [];

          if (scans.length > 0) {
            clientsScanned++;
            const latestScan = scans[0];
            const clientTotalViolations = scans.reduce(
              (sum: number, s: { totalViolations: number }) => sum + (s.totalViolations || 0),
              0
            );
            const clientCritical = scans.reduce(
              (sum: number, s: { criticalCount: number }) => sum + (s.criticalCount || 0),
              0
            );
            const clientHigh = scans.reduce(
              (sum: number, s: { highCount: number }) => sum + (s.highCount || 0),
              0
            );

            totalScans += scans.length;
            totalViolations += clientTotalViolations;

            if (latestScan.estimatedTotalMax > highestDamagesMax) {
              highestDamagesMax = latestScan.estimatedTotalMax;
            }

            updated[i] = {
              ...client,
              scanSummary: {
                totalScans: scans.length,
                latestScanDate: latestScan.createdAt,
                totalViolations: clientTotalViolations,
                criticalCount: clientCritical,
                highCount: clientHigh,
                estimatedDamagesMin: latestScan.estimatedTotalMin || 0,
                estimatedDamagesMax: latestScan.estimatedTotalMax || 0,
              },
              scanLoading: false,
            };
          }
        }
      } catch {
        // Skip clients with fetch errors
      }
    }

    setClients(updated);
    setAggregateStats({
      totalScans,
      totalViolations,
      highestDamagesMax,
      clientsScanned,
    });
    setLoadingScanData(false);

    toast({
      title: "Scan Data Loaded",
      description: `Loaded data for ${clientsScanned} client${clientsScanned !== 1 ? "s" : ""} with scan history.`,
    });
  };

  // ---------------------------------------------------------------------------
  // Load Active Litigation Cases
  // ---------------------------------------------------------------------------

  const loadActiveCases = async () => {
    setCasesLoading(true);
    try {
      // Fetch all clients first, then get cases for each
      const clientsRes = await fetch("/api/clients");
      if (!clientsRes.ok) throw new Error("Failed to fetch clients");
      const clientsData = await clientsRes.json();
      const clientList: Client[] = Array.isArray(clientsData) ? clientsData : clientsData.data || [];

      const allCases: (LitigationCaseOverview & { clientName: string })[] = [];

      for (const client of clientList) {
        try {
          const res = await fetch(`/api/clients/${client.id}/litigation-cases`);
          if (res.ok) {
            const data = await res.json();
            const cases: LitigationCaseOverview[] = data.cases || [];
            for (const c of cases) {
              allCases.push({
                ...c,
                clientName: `${client.firstName} ${client.lastName}`,
              });
            }
          }
        } catch {
          // Skip clients with fetch errors
        }
      }

      // Sort by most recent first
      allCases.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
      setActiveCases(allCases);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to load cases",
        variant: "destructive",
      });
    } finally {
      setCasesLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Filtered Clients
  // ---------------------------------------------------------------------------

  const filteredClients = clients.filter((client) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const fullName = `${client.firstName} ${client.lastName}`.toLowerCase();
    const email = (client.email || "").toLowerCase();
    return fullName.includes(q) || email.includes(q);
  });

  // Sort: clients with scans first, then by latest scan date
  const sortedClients = [...filteredClients].sort((a, b) => {
    if (a.scanSummary && !b.scanSummary) return -1;
    if (!a.scanSummary && b.scanSummary) return 1;
    if (a.scanSummary && b.scanSummary) {
      const dateA = a.scanSummary.latestScanDate
        ? new Date(a.scanSummary.latestScanDate).getTime()
        : 0;
      const dateB = b.scanSummary.latestScanDate
        ? new Date(b.scanSummary.latestScanDate).getTime()
        : 0;
      return dateB - dateA;
    }
    return 0;
  });

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
  // Render
  // ---------------------------------------------------------------------------

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Gavel className="w-6 h-6 text-purple-400" />
            Litigation Center
          </h1>
          <p className="text-muted-foreground mt-1">
            FCRA/FDCPA violation detection and litigation workflow management
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setActiveTab("scanner")}
            variant={activeTab === "scanner" ? "default" : "outline"}
            className={activeTab === "scanner" ? "bg-purple-600 hover:bg-purple-700" : ""}
            size="sm"
          >
            <Scale className="w-4 h-4 mr-1" />
            Scanner
          </Button>
          <Button
            onClick={() => {
              setActiveTab("cases");
              if (activeCases.length === 0 && !casesLoading) {
                loadActiveCases();
              }
            }}
            variant={activeTab === "cases" ? "default" : "outline"}
            className={activeTab === "cases" ? "bg-purple-600 hover:bg-purple-700" : ""}
            size="sm"
          >
            <Gavel className="w-4 h-4 mr-1" />
            Active Cases
          </Button>
        </div>
      </motion.div>

      {/* ===== SCANNER TAB ===== */}
      {activeTab === "scanner" && (
        <>
          {/* Stats Cards */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Scale}
              value={aggregateStats.totalScans}
              label="Total Scans"
              color="purple"
            />
            <StatCard
              icon={AlertTriangle}
              value={aggregateStats.totalViolations}
              label="Total Violations Found"
              color="red"
            />
            <StatCard
              icon={DollarSign}
              value={
                aggregateStats.highestDamagesMax > 0
                  ? formatCurrency(aggregateStats.highestDamagesMax)
                  : "$0"
              }
              label="Highest Est. Damages"
              color="emerald"
            />
            <StatCard
              icon={Users}
              value={aggregateStats.clientsScanned}
              label="Clients Scanned"
              color="blue"
            />
          </motion.div>

          {/* Info Banner + Load Button */}
          {aggregateStats.totalScans === 0 && (
            <motion.div variants={itemVariants}>
              <Card className="bg-purple-500/5 border-purple-500/20">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-purple-500/20">
                      <TrendingUp className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground mb-1">
                        Load scan data to see aggregate statistics
                      </p>
                      <p className="text-xs text-muted-foreground mb-3">
                        Click below to fetch litigation scan results for all clients. You can also
                        view individual client scans by clicking on a client below.
                      </p>
                      <Button
                        onClick={loadAllScanData}
                        disabled={loadingScanData}
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        {loadingScanData ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Load All Scan Data
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Search */}
          <motion.div variants={itemVariants}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search clients by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-card border-border text-foreground"
              />
            </div>
          </motion.div>

          {/* Client List */}
          {sortedClients.length === 0 ? (
            <motion.div
              variants={itemVariants}
              className="rounded-2xl bg-card border border-border py-12 text-center"
            >
              <Users className="w-12 h-12 mx-auto text-muted-foreground" />
              <h3 className="text-lg font-medium text-foreground mt-4">
                {searchQuery ? "No clients match your search" : "No clients found"}
              </h3>
              <p className="text-muted-foreground mt-2">
                {searchQuery
                  ? "Try adjusting your search terms."
                  : "Add clients from the Clients page to get started."}
              </p>
            </motion.div>
          ) : (
            <motion.div
              variants={itemVariants}
              className="rounded-2xl bg-card border border-border overflow-hidden"
            >
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-card border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <div className="col-span-3">Client</div>
                <div className="col-span-2">Scan Status</div>
                <div className="col-span-2">Violations</div>
                <div className="col-span-2">Est. Damages</div>
                <div className="col-span-2">Last Scanned</div>
                <div className="col-span-1 text-right">Action</div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-border">
                {sortedClients.map((client, index) => (
                  <motion.div
                    key={client.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-muted transition-colors items-center group"
                  >
                    {/* Client Name */}
                    <div className="col-span-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center border border-input">
                        <span className="text-sm font-medium text-foreground">
                          {client.firstName.charAt(0)}{client.lastName.charAt(0)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {client.firstName} {client.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {client.email || "No email"}
                        </p>
                      </div>
                    </div>

                    {/* Scan Status */}
                    <div className="col-span-2">
                      {client.scanSummary ? (
                        <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">
                          {client.scanSummary.totalScans} scan{client.scanSummary.totalScans !== 1 ? "s" : ""}
                        </Badge>
                      ) : (
                        <Badge className="bg-muted text-muted-foreground text-xs">
                          Not Scanned
                        </Badge>
                      )}
                    </div>

                    {/* Violations */}
                    <div className="col-span-2">
                      {client.scanSummary ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-foreground font-medium">
                            {client.scanSummary.totalViolations}
                          </span>
                          {client.scanSummary.criticalCount > 0 && (
                            <Badge className="text-[10px] bg-red-500/20 text-red-400">
                              {client.scanSummary.criticalCount} crit
                            </Badge>
                          )}
                          {client.scanSummary.highCount > 0 && (
                            <Badge className="text-[10px] bg-orange-500/20 text-orange-400">
                              {client.scanSummary.highCount} high
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">--</span>
                      )}
                    </div>

                    {/* Estimated Damages */}
                    <div className="col-span-2">
                      {client.scanSummary && client.scanSummary.estimatedDamagesMax > 0 ? (
                        <div>
                          <p className="text-sm font-medium text-emerald-400">
                            {formatCurrency(client.scanSummary.estimatedDamagesMin)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            to {formatCurrency(client.scanSummary.estimatedDamagesMax)}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">--</span>
                      )}
                    </div>

                    {/* Last Scanned */}
                    <div className="col-span-2">
                      {client.scanSummary?.latestScanDate ? (
                        <span className="text-sm text-muted-foreground">
                          {formatDate(client.scanSummary.latestScanDate)}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Never</span>
                      )}
                    </div>

                    {/* Action */}
                    <div className="col-span-1 flex justify-end">
                      <Link
                        href={`/clients/${client.id}/litigation`}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-purple-400 hover:bg-purple-500/10 transition-colors"
                      >
                        View
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* ===== ACTIVE CASES TAB ===== */}
      {activeTab === "cases" && (
        <>
          {casesLoading ? (
            <motion.div variants={itemVariants} className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400 mr-2" />
              <span className="text-muted-foreground">Loading litigation cases...</span>
            </motion.div>
          ) : activeCases.length === 0 ? (
            <motion.div variants={itemVariants} className="rounded-2xl bg-card border border-border py-12 text-center">
              <Gavel className="w-12 h-12 mx-auto text-muted-foreground" />
              <h3 className="text-lg font-medium text-foreground mt-4">No active litigation cases</h3>
              <p className="text-muted-foreground mt-2">
                Open a case from a client&apos;s litigation scan to get started.
              </p>
              <Button
                onClick={() => setActiveTab("scanner")}
                variant="outline"
                size="sm"
                className="mt-4"
              >
                <Scale className="w-4 h-4 mr-1" />
                Go to Scanner
              </Button>
            </motion.div>
          ) : (
            <>
              {/* Cases Stats */}
              <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  icon={Gavel}
                  value={activeCases.length}
                  label="Total Cases"
                  color="purple"
                />
                <StatCard
                  icon={AlertTriangle}
                  value={activeCases.filter(c => c.status === "IN_PROGRESS").length}
                  label="In Progress"
                  color="amber"
                />
                <StatCard
                  icon={DollarSign}
                  value={formatCurrency(
                    activeCases.reduce((sum, c) => sum + c.estimatedDamagesMax, 0)
                  )}
                  label="Total Est. Damages"
                  color="emerald"
                />
                <StatCard
                  icon={FileText}
                  value={activeCases.reduce((sum, c) => sum + c._count.documents, 0)}
                  label="Documents Generated"
                  color="blue"
                />
              </motion.div>

              {/* Cases Table */}
              <motion.div
                variants={itemVariants}
                className="rounded-2xl bg-card border border-border overflow-hidden"
              >
                <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-card border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <div className="col-span-2">Case #</div>
                  <div className="col-span-2">Client</div>
                  <div className="col-span-2">Status / Stage</div>
                  <div className="col-span-1">Strength</div>
                  <div className="col-span-2">Est. Damages</div>
                  <div className="col-span-2">Defendants</div>
                  <div className="col-span-1 text-right">Action</div>
                </div>

                <div className="divide-y divide-border">
                  {activeCases.map((caseItem, index) => {
                    const statusColors: Record<string, string> = {
                      OPEN: "bg-blue-500/20 text-blue-400",
                      IN_PROGRESS: "bg-amber-500/20 text-amber-400",
                      SETTLED: "bg-emerald-500/20 text-emerald-400",
                      WON: "bg-emerald-500/20 text-emerald-400",
                      LOST: "bg-red-500/20 text-red-400",
                      DISMISSED: "bg-slate-500/20 text-slate-400",
                      CLOSED: "bg-slate-500/20 text-slate-400",
                    };

                    const strengthColors: Record<string, string> = {
                      STRONG: "text-emerald-400",
                      MODERATE: "text-amber-400",
                      WEAK: "text-red-400",
                    };

                    return (
                      <motion.div
                        key={caseItem.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-muted transition-colors items-center"
                      >
                        <div className="col-span-2">
                          <p className="text-sm font-mono font-medium text-foreground">{caseItem.caseNumber}</p>
                          <p className="text-[10px] text-muted-foreground">{formatDate(caseItem.openedAt)}</p>
                        </div>

                        <div className="col-span-2">
                          <p className="text-sm font-medium text-foreground truncate">{caseItem.clientName}</p>
                        </div>

                        <div className="col-span-2">
                          <Badge className={`text-xs ${statusColors[caseItem.status] || "bg-muted text-muted-foreground"}`}>
                            {caseItem.status}
                          </Badge>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {caseItem.currentStage.replace(/_/g, " ")}
                          </p>
                        </div>

                        <div className="col-span-1">
                          <span className={`text-sm font-medium ${strengthColors[caseItem.strengthLabel] || "text-muted-foreground"}`}>
                            {caseItem.strengthLabel}
                          </span>
                        </div>

                        <div className="col-span-2">
                          <p className="text-sm font-medium text-emerald-400">
                            {formatCurrency(caseItem.estimatedDamagesMin)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            to {formatCurrency(caseItem.estimatedDamagesMax)}
                          </p>
                        </div>

                        <div className="col-span-2">
                          <div className="flex flex-wrap gap-1">
                            {caseItem.defendants.slice(0, 2).map((d) => (
                              <Badge key={d.id} className="text-[10px] bg-muted text-muted-foreground">
                                {d.name}
                              </Badge>
                            ))}
                            {caseItem.defendants.length > 2 && (
                              <Badge className="text-[10px] bg-muted text-muted-foreground">
                                +{caseItem.defendants.length - 2}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="col-span-1 flex justify-end">
                          <Link
                            href={`/clients/${caseItem.clientId}/litigation/case/${caseItem.id}`}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-purple-400 hover:bg-purple-500/10 transition-colors"
                          >
                            Open
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            </>
          )}
        </>
      )}
    </motion.div>
  );
}
