"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Sparkles,
  FileText,
  Building,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useToast } from "@/lib/use-toast";

// Sub-components
import { AmeliaInsightsPanel } from "./amelia-insights-panel";
import { LetterEditorModal } from "./letter-editor-modal";
import { BulkOperationsPanel } from "./bulk-operations-panel";
import { StrategyComparisonInline } from "./strategy-comparison";
import type { AmeliaInsight } from "./amelia-insights-panel";

// Types
import {
  type ParsedAccountWithIssues,
  type ClientWithProfile,
} from "./types";

// Bureau data
const BUREAUS = [
  { id: "TRANSUNION", name: "TransUnion", abbr: "TU", color: "cyan" },
  { id: "EXPERIAN", name: "Experian", abbr: "EX", color: "violet" },
  { id: "EQUIFAX", name: "Equifax", abbr: "EQ", color: "rose" },
] as const;

// Strategy flows - Human-friendly language (PDF Guide: simplified flow selection)
const FLOWS = [
  {
    id: "ACCURACY",
    label: "Something is wrong",
    desc: "Balance, dates, status, or other info is incorrect",
    color: "blue",
    maxRounds: 11,
    humanExamples: ["Wrong balance", "Wrong dates", "Account not mine", "Status incorrect"]
  },
  {
    id: "COLLECTION",
    label: "Debt collection dispute",
    desc: "Third-party collector, medical debt, or old debt",
    color: "red",
    maxRounds: 12,
    humanExamples: ["Collection account", "Medical bills", "Zombie debt", "Sold debt"]
  },
  {
    id: "CONSENT",
    label: "I didn't authorize this",
    desc: "Inquiry or account opened without permission",
    color: "purple",
    maxRounds: 10,
    humanExamples: ["Unauthorized inquiry", "Identity theft", "Fraud", "No permission given"]
  },
  {
    id: "COMBO",
    label: "Multiple issues",
    desc: "Both accuracy and collection problems on same account",
    color: "amber",
    maxRounds: 12,
    humanExamples: ["Wrong balance + collection", "Multiple error types", "Complex dispute"]
  },
] as const;

// Animated number component
function AnimatedNumber({ value, delay = 0 }: { value: number; delay?: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    let startTime: number;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / 800, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.floor(eased * value));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [started, value]);

  return <>{displayValue}</>;
}

// Reveal animation wrapper
function Reveal({ children, delay = 0, direction = "up", className = "" }: {
  children: React.ReactNode;
  delay?: number;
  direction?: "up" | "left" | "right";
  className?: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const transforms = {
    up: "translate-y-4",
    left: "translate-x-4",
    right: "-translate-x-4",
  };

  return (
    <div
      className={cn(
        "transition-all duration-500 ease-out",
        visible ? "opacity-100 translate-y-0 translate-x-0" : `opacity-0 ${transforms[direction]}`,
        className
      )}
    >
      {children}
    </div>
  );
}

// Severity badge component
function SeverityBadge({ level, large = false }: { level: string; large?: boolean }) {
  const colors = {
    H: "bg-red-500/10 text-red-400 border-red-500/20",
    M: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    L: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  };
  return (
    <span className={cn(
      "font-mono font-bold border rounded",
      large ? "text-[11px] px-2.5 py-1" : "text-[10px] px-1.5 py-0.5",
      colors[level as keyof typeof colors] || colors.L
    )}>
      {level}
    </span>
  );
}

// Flow badge component
function FlowBadge({ flow, large = false }: { flow: string; large?: boolean }) {
  const flowInfo = FLOWS.find(f => f.id === flow);
  const colors = {
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };
  return (
    <span className={cn(
      "font-mono font-bold border rounded",
      large ? "text-[11px] px-2.5 py-1" : "text-[10px] px-1.5 py-0.5",
      colors[flowInfo?.color as keyof typeof colors] || colors.blue
    )}>
      {flow}
    </span>
  );
}

interface DisputesSplitProps {
  initialClient?: ClientWithProfile | null;
}

export function DisputesSplit({ initialClient }: DisputesSplitProps) {
  const { toast } = useToast();
  const router = useRouter();

  // Client state
  const [client, setClient] = useState<ClientWithProfile | null>(initialClient || null);
  const [clients, setClients] = useState<ClientWithProfile[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>(initialClient?.id || "");

  // Create dispute state
  const [selectedCRA, setSelectedCRA] = useState("EXPERIAN");
  const [selectedFlow, setSelectedFlow] = useState("ACCURACY");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [parsedAccounts, setParsedAccounts] = useState<ParsedAccountWithIssues[]>([]);
  const [expandedAccount, setExpandedAccount] = useState<number | null>(null);

  // AI state
  const [ameliaInsights, setAmeliaInsights] = useState<AmeliaInsight | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Letter preview state
  const [letterModalOpen, setLetterModalOpen] = useState(false);
  const [generatedLetter, setGeneratedLetter] = useState<{
    disputeId?: string;
    isPreview?: boolean;
    clientId?: string;
    accountIds?: string[];
    contentHash?: string;
    content: string;
    cra: string;
    flow: string;
    round: number;
    status: string;
    ameliaMetadata: {
      letterDate: string;
      isBackdated: boolean;
      backdatedDays: number;
      tone: string;
      effectiveFlow: string;
      statute: string;
      personalInfoDisputed: {
        previousNames: number;
        previousAddresses: number;
        hardInquiries: number;
      };
    };
  } | null>(null);
  const [launching, setLaunching] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Fetch clients on mount
  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        setClients(Array.isArray(data) ? data : data.data || data.clients || []);
      })
      .finally(() => setLoading(false));
  }, []);

  // Helper to parse detectedIssues
  const parseDetectedIssues = (issues: unknown): Array<{ severity: string; description: string; code?: string }> => {
    if (Array.isArray(issues)) return issues;
    if (typeof issues === "string") {
      try {
        const parsed = JSON.parse(issues);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  // Fetch accounts when client and CRA change
  useEffect(() => {
    if (!selectedClientId) return;

    setAccountsLoading(true);

    Promise.all([
      fetch(`/api/accounts/negative?clientId=${selectedClientId}`).then((r) => r.ok ? r.json() : { accounts: [] }),
      fetch(`/api/disputes?clientId=${selectedClientId}&status=SENT`).then((r) => r.ok ? r.json() : [])
    ])
      .then(([accountsData, disputesData]) => {
        const activeDisputeMap = new Map<string, {
          disputeId: string;
          flow: string;
          round: number;
          status: string;
          sentDate?: string;
          responseDeadline?: string;
        }>();

        const disputesList = Array.isArray(disputesData) ? disputesData : [];
        for (const dispute of disputesList) {
          if (!dispute.items) continue;
          for (const item of dispute.items) {
            const key = `${item.accountId || item.accountItemId}_${dispute.cra}`;
            const sentDate = dispute.sentDate || dispute.createdAt;
            let responseDeadline = "";

            if (sentDate) {
              const sent = new Date(sentDate);
              const deadline = new Date(sent.getTime() + 30 * 24 * 60 * 60 * 1000);
              responseDeadline = deadline.toISOString();
            }

            activeDisputeMap.set(key, {
              disputeId: dispute.id,
              flow: dispute.flow,
              round: dispute.round,
              status: dispute.status || "SENT",
              sentDate,
              responseDeadline,
            });
          }
        }

        const accounts = (accountsData.accounts || [])
          .filter((a: ParsedAccountWithIssues) => a.cra === selectedCRA)
          .map((a: ParsedAccountWithIssues) => {
            const key = `${a.id}_${selectedCRA}`;
            const activeDispute = activeDisputeMap.get(key);

            let activeDisputeInfo = null;
            if (activeDispute) {
              const deadline = activeDispute.responseDeadline ? new Date(activeDispute.responseDeadline) : null;
              const daysRemaining = deadline ? Math.ceil((deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : 30;
              const isOverdue = daysRemaining < 0;

              activeDisputeInfo = {
                disputeId: activeDispute.disputeId,
                flow: activeDispute.flow,
                round: activeDispute.round,
                status: activeDispute.status as "DRAFT" | "SENT" | "RESPONDED" | "RESOLVED",
                sentDate: activeDispute.sentDate,
                daysRemaining: Math.abs(daysRemaining),
                responseDeadline: activeDispute.responseDeadline,
                isOverdue,
              };
            }

            const issues = parseDetectedIssues(a.detectedIssues);
            const applicableFlows = determineApplicableFlows(issues);

            return {
              ...a,
              detectedIssues: issues,
              activeDispute: activeDisputeInfo,
              applicableFlows,
            };
          });

        setParsedAccounts(accounts);
        setSelectedAccounts([]);
      })
      .finally(() => setAccountsLoading(false));
  }, [selectedClientId, selectedCRA]);

  // Helper function to determine applicable flows
  function determineApplicableFlows(issues: Array<{ code?: string; severity?: string; description?: string }>): string[] {
    const flows = new Set<string>();

    for (const issue of issues) {
      const code = (issue.code || "").toUpperCase();

      if (code.includes("COLLECTION") || code.includes("CHARGEOFF") || code.includes("CHARGE_OFF") || code.includes("DEROGATORY") || code.includes("DEBT")) {
        flows.add("COLLECTION");
      }

      if (code.includes("ACCURACY") || code.includes("INCONSISTENCY") || code.includes("BALANCE") || code.includes("DATE") || code.includes("STATUS") || code.includes("MISSING") || code.includes("LATE_PAYMENT") || code.includes("PAYMENT_HISTORY") || code.includes("OUTDATED") || code.includes("PAST_DUE")) {
        flows.add("ACCURACY");
      }

      if (code.includes("CONSENT") || code.includes("UNAUTHORIZED") || code.includes("INQUIRY") || code.includes("PERMISSIBLE")) {
        flows.add("CONSENT");
      }
    }

    if (flows.size === 0) {
      flows.add("ACCURACY");
    }

    if (flows.size >= 2) {
      flows.add("COMBO");
    }

    return Array.from(flows);
  }

  // Fetch client when selected
  useEffect(() => {
    if (!selectedClientId) return;

    fetch(`/api/clients/${selectedClientId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.client) setClient(data.client);
      });
  }, [selectedClientId]);

  // Generate AMELIA insights when accounts change
  const generateInsights = useCallback(async () => {
    if (!selectedClientId || selectedAccounts.length === 0) {
      setAmeliaInsights(null);
      return;
    }

    setInsightsLoading(true);
    setInsightsError(null);

    try {
      const res = await fetch("/api/amelia/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClientId,
          cra: selectedCRA,
          flow: selectedFlow,
          accountIds: selectedAccounts,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAmeliaInsights(data);
      } else {
        const errData = await res.json().catch(() => null);
        setInsightsError(errData?.error || "Failed to generate insights");
      }
    } catch {
      setInsightsError("Could not connect to the analysis service");
    } finally {
      setInsightsLoading(false);
    }
  }, [selectedClientId, selectedCRA, selectedFlow, selectedAccounts]);

  // Auto-generate insights when accounts are selected (debounced)
  useEffect(() => {
    if (selectedAccounts.length === 0) {
      setAmeliaInsights(null);
      return;
    }

    // Debounce the insights generation
    const timer = setTimeout(() => {
      generateInsights();
    }, 500);

    return () => clearTimeout(timer);
  }, [selectedAccounts, generateInsights]);

  // Toggle account selection
  const toggleAccount = (id: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Generate letter preview
  const handleCreateDispute = async () => {
    if (!selectedClientId || selectedAccounts.length === 0) {
      toast({ title: "Missing Information", description: "Select a client and at least one account", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/disputes/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClientId,
          cra: selectedCRA,
          flow: selectedFlow,
          accountIds: selectedAccounts,
        }),
      });

      if (res.ok) {
        const data = await res.json();

        setGeneratedLetter({
          isPreview: true,
          clientId: selectedClientId,
          accountIds: selectedAccounts,
          contentHash: data.preview.contentHash,
          content: data.preview.letterContent,
          cra: data.preview.cra,
          flow: data.preview.flow,
          round: data.preview.round,
          status: "PREVIEW",
          ameliaMetadata: {
            letterDate: data.amelia.letterDate,
            isBackdated: data.amelia.isBackdated,
            backdatedDays: data.amelia.backdatedDays,
            tone: data.amelia.tone,
            effectiveFlow: data.amelia.effectiveFlow,
            statute: data.amelia.statute,
            personalInfoDisputed: data.amelia.personalInfoDisputed,
          },
        });

        setLetterModalOpen(true);

        toast({
          title: "Letter Preview Ready",
          description: `${data.preview.cra} Round ${data.preview.round} - Review and click "Launch Round" to send`,
        });
      } else {
        const error = await res.json();
        toast({ title: "Failed", description: error.error || "Failed to generate letter", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to generate letter", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  // Launch dispute
  const handleLaunchDispute = async () => {
    if (!generatedLetter) return;

    setLaunching(true);
    try {
      let res: Response;

      if (generatedLetter.isPreview) {
        res = await fetch("/api/disputes/create-and-launch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: generatedLetter.clientId,
            cra: generatedLetter.cra,
            flow: generatedLetter.flow,
            accountIds: generatedLetter.accountIds,
            letterContent: generatedLetter.content,
            contentHash: generatedLetter.contentHash,
          }),
        });
      } else if (generatedLetter.disputeId) {
        res = await fetch(`/api/disputes/${generatedLetter.disputeId}/launch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sentDate: new Date().toISOString(),
          }),
        });
      } else {
        toast({ title: "Error", description: "Invalid letter state", variant: "destructive" });
        setLaunching(false);
        return;
      }

      if (res.ok) {
        const data = await res.json();
        toast({
          title: `Round ${generatedLetter.round} Launched!`,
          description: `${generatedLetter.cra} dispute is now being tracked.`,
        });

        setLetterModalOpen(false);
        setSelectedAccounts([]);
        setGeneratedLetter(null);
      } else {
        const error = await res.json();
        toast({ title: "Launch Failed", description: error.error || "Failed to launch dispute", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to launch dispute", variant: "destructive" });
    } finally {
      setLaunching(false);
    }
  };

  // Download letter
  const handleDownloadLetter = async () => {
    if (!generatedLetter?.disputeId) return;

    setDownloading(true);
    try {
      const res = await fetch(`/api/disputes/${generatedLetter.disputeId}/docx`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${generatedLetter.cra}_Round${generatedLetter.round}_Dispute.docx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast({ title: "Downloaded", description: "Letter saved as DOCX" });
      } else {
        toast({ title: "Download Failed", description: "Could not download letter", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Download failed", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  // Calculate stats
  const stats = {
    totalAccounts: parsedAccounts.length,
    highPriority: parsedAccounts.filter((a) => Array.isArray(a.detectedIssues) && a.detectedIssues.some((i) => ["HIGH", "H"].includes(i.severity))).length,
    collections: parsedAccounts.filter((a) => a.accountStatus === "Collection" || a.accountStatus === "COLLECTION").length,
    totalBalance: parsedAccounts.reduce((sum, a) => {
      const balance = typeof a.balance === 'number' ? a.balance :
                      typeof a.balance === 'string' ? parseFloat(a.balance) : 0;
      return sum + (isNaN(balance) ? 0 : balance);
    }, 0),
  };

  const selectedBureau = BUREAUS.find(b => b.id === selectedCRA);
  const selectedFlowInfo = FLOWS.find(f => f.id === selectedFlow);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Reveal delay={50}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Disputes</h1>
            <p className="text-muted-foreground mt-1">Create and manage credit report dispute letters</p>
          </div>

          {/* Client Selector Badge */}
          <div className="flex items-center gap-3">
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="bg-card border border-border rounded-xl px-4 py-2.5 text-foreground text-sm min-w-[200px] focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Select Client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </select>

            {client && (
              <div className="flex items-center gap-3 px-5 py-3 bg-card border border-border rounded-2xl shadow-sm">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 text-sm font-bold font-mono">
                  {client.firstName?.[0]}{client.lastName?.[0]}
                </div>
                <div>
                  <div className="text-base font-semibold">{client.firstName} {client.lastName}</div>
                  <div className="text-xs text-muted-foreground font-mono tracking-wider">ROUND {client.currentRound || 1}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Reveal>

      {/* Stats Row - Centered */}
      <Reveal delay={100}>
        <div className="flex justify-center gap-4">
          {[
            { icon: "📑", label: "NEGATIVE ACCOUNTS", value: stats.totalAccounts, color: "text-foreground" },
            { icon: "🔥", label: "HIGH PRIORITY", value: stats.highPriority, color: "text-red-400" },
            { icon: "📦", label: "COLLECTIONS", value: stats.collections, color: "text-amber-400" },
            { icon: "💰", label: "TOTAL BALANCE", value: `$${stats.totalBalance.toLocaleString()}`, color: "text-emerald-400", isString: true },
          ].map((stat, i) => (
            <Card key={i} className="bg-card border-border min-w-[200px]">
              <CardContent className="p-5 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-lg">{stat.icon}</span>
                  <span className="text-[10px] font-bold tracking-widest text-muted-foreground font-mono">{stat.label}</span>
                </div>
                <div className={cn("text-4xl font-bold leading-none", stat.color)}>
                  {stat.isString ? stat.value : <AnimatedNumber value={stat.value as number} delay={250 + i * 70} />}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Reveal>

      {/* Three-Column Layout */}
      <div className="grid grid-cols-[280px_1fr_400px] gap-5 items-start">
        {/* Left Sidebar - Config */}
        <Reveal delay={160} direction="left">
          <div className="sticky top-5 space-y-4">
            {/* Bureau Selector */}
            <Card className="bg-card border-border p-5">
              <div className="text-sm font-semibold text-muted-foreground mb-4 tracking-wide">Bureau</div>
              <div className="space-y-2">
                {BUREAUS.map((bureau) => {
                  const isActive = selectedCRA === bureau.id;
                  const colorClasses = {
                    cyan: { active: "bg-cyan-500/10 border-cyan-500/20", badge: "bg-cyan-500/15 text-cyan-400", dot: "bg-cyan-400" },
                    violet: { active: "bg-violet-500/10 border-violet-500/20", badge: "bg-violet-500/15 text-violet-400", dot: "bg-violet-400" },
                    rose: { active: "bg-rose-500/10 border-rose-500/20", badge: "bg-rose-500/15 text-rose-400", dot: "bg-rose-400" },
                  };
                  const colors = colorClasses[bureau.color];

                  return (
                    <button
                      key={bureau.id}
                      onClick={() => setSelectedCRA(bureau.id)}
                      className={cn(
                        "w-full p-3.5 rounded-xl flex items-center gap-3 transition-all text-left",
                        isActive ? colors.active : "hover:bg-muted/50",
                        isActive ? "border" : "border border-transparent"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold font-mono transition-all",
                        isActive ? colors.badge : "bg-muted text-muted-foreground"
                      )}>
                        {bureau.abbr}
                      </div>
                      <div className="flex-1">
                        <div className={cn("text-sm font-semibold", isActive && `text-${bureau.color}-400`)}>{bureau.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{parsedAccounts.length} accounts</div>
                      </div>
                      {isActive && (
                        <div className={cn("w-2 h-2 rounded-full shadow-lg", colors.dot)} style={{ boxShadow: `0 0 8px currentColor` }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Strategy Selector */}
            <Card className="bg-card border-border p-5">
              <div className="text-sm font-semibold text-muted-foreground mb-4 tracking-wide">Strategy</div>
              <div className="space-y-1">
                {FLOWS.map((flow) => {
                  const isActive = selectedFlow === flow.id;
                  const colorClasses = {
                    blue: { active: "bg-blue-500/10 border-blue-500/20", dot: "bg-blue-400", text: "text-blue-400" },
                    red: { active: "bg-red-500/10 border-red-500/20", dot: "bg-red-400", text: "text-red-400" },
                    purple: { active: "bg-purple-500/10 border-purple-500/20", dot: "bg-purple-400", text: "text-purple-400" },
                    amber: { active: "bg-amber-500/10 border-amber-500/20", dot: "bg-amber-400", text: "text-amber-400" },
                  };
                  const colors = colorClasses[flow.color];

                  return (
                    <button
                      key={flow.id}
                      onClick={() => setSelectedFlow(flow.id)}
                      className={cn(
                        "w-full p-3 rounded-xl flex items-center gap-3 transition-all text-left",
                        isActive ? colors.active : "hover:bg-muted/50",
                        isActive ? "border" : "border border-transparent"
                      )}
                    >
                      <div className={cn(
                        "w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all",
                        colors.dot,
                        isActive && "shadow-lg"
                      )} style={isActive ? { boxShadow: `0 0 10px currentColor` } : {}} />
                      <div className="flex-1 min-w-0">
                        <div className={cn("text-sm font-semibold", isActive && colors.text)}>{flow.label}</div>
                        <div className="text-xs text-muted-foreground truncate">{flow.desc}</div>
                        {/* Show human examples when flow is selected */}
                        {isActive && flow.humanExamples && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {flow.humanExamples.slice(0, 3).map((example) => (
                              <span key={example} className="text-[10px] px-1.5 py-0.5 bg-muted rounded-full text-muted-foreground">
                                {example}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-[10px] text-muted-foreground font-mono">up to {flow.maxRounds} rounds</span>
                        <div className="flex gap-0.5 mt-1 justify-end">
                          {Array.from({ length: Math.min(flow.maxRounds, 12) }).map((_, r) => (
                            <div key={r} className={cn(
                              "h-1 rounded-full transition-all",
                              r < 1 ? colors.dot : "bg-muted",
                              r < 1 ? "w-2" : "w-1"
                            )} />
                          ))}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Strategy Comparison - Shows when accounts are selected */}
              {selectedAccounts.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <StrategyComparisonInline
                    currentFlow={selectedFlow}
                    onSelectStrategy={(flow) => setSelectedFlow(flow)}
                  />
                </div>
              )}
            </Card>
          </div>
        </Reveal>

        {/* Middle - Account List */}
        <Reveal delay={200}>
          <Card className="bg-card border-border overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base">📂</span>
                  <span className="text-lg font-bold">{selectedBureau?.name.toUpperCase()} Accounts</span>
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">Showing accounts reported to this bureau only</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground font-mono">
                  {selectedAccounts.length} of {parsedAccounts.filter(a => !a.activeDispute).length} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const available = parsedAccounts.filter(a => !a.activeDispute);
                    setSelectedAccounts(available.map(a => a.id));
                  }}
                  disabled={parsedAccounts.filter(a => !a.activeDispute).length === 0}
                >
                  <CheckSquare className="w-4 h-4 mr-1.5" />
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedAccounts([])}
                  disabled={selectedAccounts.length === 0}
                >
                  <Square className="w-4 h-4 mr-1.5" />
                  Clear
                </Button>
              </div>
            </div>

            {/* Account List */}
            <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
              {accountsLoading ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">Loading accounts...</p>
                </div>
              ) : parsedAccounts.length === 0 ? (
                <div className="py-12 text-center">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">
                    {selectedClientId ? `No negative accounts on ${selectedCRA}` : "Select a client to view accounts"}
                  </p>
                </div>
              ) : (
                parsedAccounts.map((account, idx) => {
                  const isSelected = selectedAccounts.includes(account.id);
                  const isExpanded = expandedAccount === idx;
                  const issues = account.detectedIssues || [];
                  const highCount = issues.filter(i => ["HIGH", "H"].includes(i.severity)).length;

                  return (
                    <div
                      key={account.id}
                      className={cn(
                        "p-5 rounded-2xl border transition-all",
                        isSelected ? "bg-cyan-500/5 border-cyan-500/20" : "border-border hover:border-border/80",
                        account.activeDispute && "opacity-60"
                      )}
                    >
                      <div className="flex justify-between">
                        <div className="flex gap-3 flex-1">
                          {/* Checkbox */}
                          <button
                            onClick={() => !account.activeDispute && toggleAccount(account.id)}
                            disabled={!!account.activeDispute}
                            className={cn(
                              "w-6 h-6 rounded-md flex-shrink-0 mt-0.5 flex items-center justify-center transition-all",
                              isSelected ? "bg-cyan-500/20 border-2 border-cyan-400 text-cyan-400" : "border-2 border-border",
                              account.activeDispute && "cursor-not-allowed"
                            )}
                          >
                            {isSelected && "✓"}
                          </button>

                          {/* Account Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-lg font-bold">{account.creditorName}</span>
                              <span className="text-sm text-muted-foreground font-mono">
                                {account.maskedAccountId} · {account.accountType || "Unknown"}
                              </span>
                            </div>

                            {/* Issues */}
                            {issues.slice(0, isExpanded ? 99 : 2).map((issue, i) => (
                              <div key={i} className="flex gap-2 items-start mb-1.5">
                                <SeverityBadge level={issue.severity === "HIGH" ? "H" : issue.severity === "MEDIUM" ? "M" : issue.severity || "L"} />
                                <span className="text-sm text-muted-foreground leading-relaxed">{issue.description}</span>
                              </div>
                            ))}

                            {issues.length > 2 && (
                              <button
                                onClick={() => setExpandedAccount(isExpanded ? null : idx)}
                                className="text-sm text-cyan-400 hover:text-cyan-300 mt-1 flex items-center gap-1"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="w-4 h-4" />
                                    Show less
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="w-4 h-4" />
                                    +{issues.length - 2} more issues
                                  </>
                                )}
                              </button>
                            )}

                            {/* Footer with flows and bureaus */}
                            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-muted-foreground">Applicable:</span>
                                {(account.applicableFlows || ["ACCURACY"]).map(f => (
                                  <FlowBadge key={f} flow={f} />
                                ))}
                              </div>
                              <div className="flex gap-1.5">
                                {BUREAUS.map(b => {
                                  const isOnBureau = account.cra === b.id || (account.bureauData && account.bureauData[b.id as keyof typeof account.bureauData]);
                                  return (
                                    <div
                                      key={b.id}
                                      className={cn(
                                        "px-2.5 py-1 rounded-md text-[10px] font-bold font-mono border",
                                        isOnBureau
                                          ? b.color === "cyan" ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                                            : b.color === "violet" ? "bg-violet-500/10 text-violet-400 border-violet-500/20"
                                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                          : "bg-muted text-muted-foreground border-border"
                                      )}
                                    >
                                      {b.abbr}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right side - Balance & Severity */}
                        <div className="text-right flex-shrink-0 ml-5">
                          <div className="text-xl font-bold mb-2">
                            ${typeof account.balance === 'number' ? account.balance.toLocaleString() : account.balance || 0}
                          </div>
                          {highCount > 0 && (
                            <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 font-mono">
                              {highCount} HIGH
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Active Dispute Badge */}
                      {account.activeDispute && (
                        <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-amber-400 text-sm">⏳</span>
                              <span className="text-sm text-amber-400 font-medium">
                                Round {account.activeDispute.round} · {account.activeDispute.flow}
                              </span>
                            </div>
                            <span className="text-xs text-amber-400/70 font-mono">
                              {account.activeDispute.daysRemaining} days remaining
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </Reveal>

        {/* Right Sidebar - AMELIA */}
        <div className="sticky top-5">
          <Reveal delay={260} direction="right">
            <div className="space-y-4">
              {/* Warning Banner for Too Many Accounts */}
              {selectedAccounts.length > 5 && (
                <Card className="bg-amber-500/10 border-amber-500/20 p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">⚠️</span>
                    <div>
                      <p className="font-semibold text-amber-400 mb-1">Too Many Accounts Selected</p>
                      <p className="text-sm text-amber-400/80">
                        Disputing more than 5 accounts at once may trigger automated rejection.
                        Credit bureaus often flag bulk disputes as frivolous. Consider splitting
                        into multiple rounds for better success rates.
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Bulk Operations Panel - Shows when multiple accounts are selected */}
              {selectedClientId && selectedAccounts.length >= 3 && (
                <BulkOperationsPanel
                  clientId={selectedClientId}
                  selectedAccountIds={selectedAccounts}
                  onComplete={() => {
                    setSelectedAccounts([]);
                    // Refresh accounts list
                    setAccountsLoading(true);
                    fetch(`/api/accounts/negative?clientId=${selectedClientId}`)
                      .then((r) => r.ok ? r.json() : { accounts: [] })
                      .then((data) => {
                        const accounts = (data.accounts || [])
                          .filter((a: ParsedAccountWithIssues) => a.cra === selectedCRA)
                          .map((a: ParsedAccountWithIssues) => ({
                            ...a,
                            detectedIssues: parseDetectedIssues(a.detectedIssues),
                            applicableFlows: determineApplicableFlows(parseDetectedIssues(a.detectedIssues)),
                          }));
                        setParsedAccounts(accounts);
                      })
                      .finally(() => setAccountsLoading(false));
                  }}
                />
              )}

              {/* AMELIA Panel */}
              <Card className="bg-gradient-to-br from-purple-500/5 to-cyan-500/5 border-purple-500/10 overflow-hidden">
                <div className="p-5">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/15 flex items-center justify-center text-xl">
                        ✦
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold tracking-tight">AMELIA</span>
                          {ameliaInsights && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-mono">
                              Active
                            </span>
                          )}
                          {insightsLoading && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/15 text-purple-400 font-mono animate-pulse">
                              Analyzing
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">AI Dispute Intelligence</div>
                      </div>
                    </div>

                    {ameliaInsights && (
                      <svg width="44" height="44" viewBox="0 0 44 44" className="flex-shrink-0">
                        <circle cx="22" cy="22" r="18" fill="none" className="stroke-muted" strokeWidth="3" />
                        <circle
                          cx="22" cy="22" r="18" fill="none"
                          className={cn(
                            "strokeWidth-3 strokeLinecap-round",
                            ameliaInsights.confidence >= 70 ? "stroke-emerald-400" :
                            ameliaInsights.confidence >= 50 ? "stroke-amber-400" : "stroke-red-400"
                          )}
                          style={{
                            stroke: ameliaInsights.confidence >= 70 ? "#34d399" :
                                   ameliaInsights.confidence >= 50 ? "#fbbf24" : "#f87171",
                            strokeWidth: 3,
                            strokeLinecap: "round",
                            strokeDasharray: `${(ameliaInsights.confidence / 100) * 113.1} 113.1`,
                          }}
                          transform="rotate(-90 22 22)"
                        />
                        <text x="22" y="26" textAnchor="middle" className={cn(
                          "text-[11px] font-bold font-mono",
                          ameliaInsights.confidence >= 70 ? "fill-emerald-400" :
                          ameliaInsights.confidence >= 50 ? "fill-amber-400" : "fill-red-400"
                        )}>
                          {ameliaInsights.confidence}%
                        </text>
                      </svg>
                    )}
                  </div>

                  {selectedAccounts.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-muted-foreground mb-4">
                        Select accounts to analyze for AI-powered recommendations
                      </p>
                    </div>
                  ) : insightsLoading ? (
                    <div className="text-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-400 mb-3" />
                      <p className="text-sm text-muted-foreground">Analyzing {selectedAccounts.length} account(s)...</p>
                      <p className="text-xs text-muted-foreground mt-1">AMELIA is reviewing issues and calculating success probability</p>
                    </div>
                  ) : insightsError ? (
                    <div className="text-center py-6">
                      <p className="text-amber-400 mb-3">{insightsError}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={generateInsights}
                        className="border-purple-500/30 text-purple-400"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Retry Analysis
                      </Button>
                    </div>
                  ) : ameliaInsights ? (
                    <div className="space-y-5">
                      {/* Success Rate */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground flex items-center gap-2">
                            <span className="text-base">◎</span>
                            Estimated Success Rate
                          </span>
                          <span className="text-lg font-bold">{ameliaInsights.estimatedSuccessRate}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-1000"
                            style={{ width: `${ameliaInsights.estimatedSuccessRate}%` }}
                          />
                        </div>
                      </div>

                      {/* Letter Tone */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Letter Tone:</span>
                        <Badge className={cn(
                          "font-mono",
                          ameliaInsights.tone === "CONCERNED" && "bg-blue-500/10 text-blue-400 border border-blue-500/20",
                          ameliaInsights.tone === "WORRIED" && "bg-amber-500/10 text-amber-400 border border-amber-500/20",
                          ameliaInsights.tone === "FED_UP" && "bg-orange-500/10 text-orange-400 border border-orange-500/20",
                          ameliaInsights.tone === "WARNING" && "bg-red-500/10 text-red-400 border border-red-500/20",
                          ameliaInsights.tone === "PISSED" && "bg-red-600/10 text-red-500 border border-red-600/20"
                        )}>
                          {ameliaInsights.tone.replace("_", " ")}
                        </Badge>
                      </div>

                      {/* Quick Insights / Recommendations */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-base">💡</span>
                          <span className="font-semibold">Quick Insights</span>
                        </div>
                        <div className="space-y-2">
                          {ameliaInsights.recommendations.slice(0, 4).map((rec, i) => (
                            <div key={i} className="flex gap-2 items-start">
                              <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-2 flex-shrink-0" />
                              <span className="text-sm text-muted-foreground">{rec}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Risk Factors */}
                      {ameliaInsights.riskFactors && ameliaInsights.riskFactors.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-base">📊</span>
                            <span className="font-semibold">Risk Analysis</span>
                          </div>
                          <div className="space-y-2">
                            {ameliaInsights.riskFactors.slice(0, 3).map((rf, i) => (
                              <div key={i} className="flex gap-2 items-start">
                                <span className={cn(
                                  "text-sm mt-0.5",
                                  rf.impact === "positive" && "text-emerald-400",
                                  rf.impact === "negative" && "text-red-400",
                                  rf.impact === "neutral" && "text-amber-400"
                                )}>
                                  {rf.impact === "positive" ? "↑" : rf.impact === "negative" ? "↓" : "→"}
                                </span>
                                <span className="text-sm text-muted-foreground">{rf.factor}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Legal Focus */}
                      {ameliaInsights.suggestedStatutes && ameliaInsights.suggestedStatutes.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-base">📜</span>
                            <span className="font-semibold text-sm">Legal Focus</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {ameliaInsights.suggestedStatutes.map((statute, i) => (
                              <Badge key={i} variant="outline" className="text-xs border-amber-500/30 text-amber-400">
                                {statute}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* eOSCAR Risk */}
                      {ameliaInsights.eoscarDetection && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-base">🛡</span>
                              <span className="font-semibold">eOSCAR Risk</span>
                            </div>
                            <Badge className={cn(
                              "font-mono",
                              ameliaInsights.eoscarDetection.level === "low" && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                              ameliaInsights.eoscarDetection.level === "medium" && "bg-amber-500/10 text-amber-400 border border-amber-500/20",
                              ameliaInsights.eoscarDetection.level === "high" && "bg-red-500/10 text-red-400 border border-red-500/20"
                            )}>
                              {ameliaInsights.eoscarDetection.risk}% {ameliaInsights.eoscarDetection.level.toUpperCase()}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="p-3 rounded-lg bg-muted/30 text-center">
                              <div className="text-xl font-bold">{ameliaInsights.eoscarDetection.uniquenessScore}%</div>
                              <div className="text-[9px] text-muted-foreground font-mono mt-1">Uniqueness</div>
                            </div>
                            <div className="p-3 rounded-lg bg-muted/30 text-center">
                              <div className="text-xl font-bold text-emerald-400">{ameliaInsights.eoscarDetection.humanizingPhrases}</div>
                              <div className="text-[9px] text-muted-foreground font-mono mt-1">Human Phrases</div>
                            </div>
                            <div className="p-3 rounded-lg bg-muted/30 text-center">
                              <div className="text-xl font-bold text-amber-400">{ameliaInsights.eoscarDetection.flaggedPhrases}</div>
                              <div className="text-[9px] text-muted-foreground font-mono mt-1">Flagged</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Regenerate Analysis Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={generateInsights}
                        disabled={insightsLoading}
                        className="w-full border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                      >
                        {insightsLoading ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4 mr-2" />
                        )}
                        Refresh Analysis
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-muted-foreground mb-4">
                        Analyzing {selectedAccounts.length} account(s)...
                      </p>
                      <Button
                        onClick={generateInsights}
                        disabled={insightsLoading}
                        className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate Insights
                      </Button>
                    </div>
                  )}
                </div>

                {/* Generate Letter Button */}
                <div className="p-5 pt-0">
                  <Button
                    className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white shadow-lg shadow-purple-500/20"
                    disabled={selectedAccounts.length === 0 || creating}
                    onClick={handleCreateDispute}
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate Letter
                      </>
                    )}
                  </Button>
                  {selectedAccounts.length > 5 && (
                    <p className="text-xs text-amber-400/70 text-center mt-2">
                      Consider selecting fewer accounts for best results
                    </p>
                  )}
                </div>
              </Card>
            </div>
          </Reveal>
        </div>
      </div>

      {/* Letter Modal */}
      <LetterEditorModal
        open={letterModalOpen}
        onOpenChange={(open) => {
          setLetterModalOpen(open);
          if (!open) setGeneratedLetter(null);
        }}
        generatedLetter={generatedLetter}
        clientName={client ? `${client.firstName} ${client.lastName}` : undefined}
        onLaunch={handleLaunchDispute}
        launching={launching}
        onDownload={handleDownloadLetter}
        downloading={downloading}
      />
    </div>
  );
}
