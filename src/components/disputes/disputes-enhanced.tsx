"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Plus,
  Scale,
  Sparkles,
  History,
  FileText,
  Building,
  Eye,
  BarChart3,
  CheckSquare,
  Square,
  MessageSquareText,
} from "lucide-react";
import { useToast } from "@/lib/use-toast";

// Sub-components
import { CRASelector } from "./cra-selector";
import { FlowSelector } from "./flow-selector";
import { AccountCard } from "./account-card";
import { SmartAccountCard } from "./smart-account-card";
import { RoundFlowView } from "./round-flow-view";
import { CFPBView } from "./cfpb-view";
import { AmeliaInsightsPanel } from "./amelia-insights-panel";
import { LetterEditorModal } from "./letter-editor-modal";
import type { AmeliaInsight } from "./amelia-insights-panel";

// Types
import {
  CRA_COLORS,
  STATUS_COLORS,
  FLOW_INFO,
  type ParsedAccountWithIssues,
  type ClientWithProfile,
  type EOSCARScore,
  type DisputeHistoryItem,
} from "./types";

interface DisputesEnhancedProps {
  initialClient?: ClientWithProfile | null;
}

export function DisputesEnhanced({ initialClient }: DisputesEnhancedProps) {
  const { toast } = useToast();
  const router = useRouter();

  // Tab state
  const [activeTab, setActiveTab] = useState("create");

  // Client state
  const [client, setClient] = useState<ClientWithProfile | null>(initialClient || null);
  const [clients, setClients] = useState<ClientWithProfile[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>(initialClient?.id || "");

  // Create dispute state
  const [selectedCRA, setSelectedCRA] = useState("TRANSUNION");
  const [selectedFlow, setSelectedFlow] = useState("ACCURACY");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [parsedAccounts, setParsedAccounts] = useState<ParsedAccountWithIssues[]>([]);

  // AI state
  const [ameliaInsights, setAmeliaInsights] = useState<AmeliaInsight | null>(null);
  const [eoscarScore, setEoscarScore] = useState<EOSCARScore | null>(null);

  // History state
  const [disputes, setDisputes] = useState<DisputeHistoryItem[]>([]);

  // Responses state
  const [pendingResponses, setPendingResponses] = useState<Array<{
    id: string;
    clientId: string;
    clientName: string;
    cra: string;
    round: number;
    flow: string;
    sentDate: string;
    daysRemaining: number;
    daysElapsed: number;
    status: string;
    itemCount: number;
  }>>([]);
  const [responsesLoading, setResponsesLoading] = useState(false);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Letter preview state
  const [letterModalOpen, setLetterModalOpen] = useState(false);
  const [generatedLetter, setGeneratedLetter] = useState<{
    disputeId?: string; // Optional - not present in preview mode
    isPreview?: boolean; // True when letter is just a preview (not saved yet)
    clientId?: string; // For creating dispute on launch
    accountIds?: string[]; // For creating dispute on launch
    contentHash?: string; // For storing content hash on launch
    content: string;
    cra: string;
    flow: string;
    round: number;
    status: string;
    // AMELIA metadata (always present with new simplified workflow)
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
  const [downloading, setDownloading] = useState(false);
  const [launching, setLaunching] = useState(false);

  // Fetch clients on mount
  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        // Handle paginated { data, pagination } and legacy array responses
        setClients(Array.isArray(data) ? data : data.data || data.clients || []);
      })
      .finally(() => setLoading(false));
  }, []);

  // Fetch disputes history - only show properly created disputes (with items)
  useEffect(() => {
    fetch("/api/disputes")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        // Handle paginated { data, pagination } and legacy array responses
        const rawData = Array.isArray(data) ? data : data.data || [];
        const mapped = rawData
          .filter((d: { _count?: { items: number } }) => (d._count?.items || 0) > 0) // Only show disputes with items
          .map((d: {
            id: string;
            client: { id: string; firstName: string; lastName: string };
            cra: string;
            flow: string;
            round: number;
            status: string;
            createdAt: string;
            sentDate?: string;
            respondedAt?: string;
            letterContent?: string;
            items?: Array<{
              id: string;
              disputeReason?: string;
              accountItem?: {
                id: string;
                creditorName: string;
                maskedAccountId?: string | null;
                balance?: number | null;
              };
            }>;
            _count?: { items: number };
          }) => ({
            id: d.id,
            clientId: d.client?.id,
            client: d.client,
            cra: d.cra,
            flow: d.flow,
            round: d.round,
            status: d.status || "DRAFT",
            createdAt: d.createdAt,
            sentDate: d.sentDate,
            respondedAt: d.respondedAt,
            letterContent: d.letterContent,
            itemCount: d._count?.items || 0,
            items: d.items,
          }));
        setDisputes(mapped);
      });
  }, []);

  // Fetch pending responses when responses tab is active
  useEffect(() => {
    if (activeTab !== "responses") return;

    setResponsesLoading(true);
    fetch("/api/disputes/responses/pending")
      .then((r) => r.ok ? r.json() : { pending: [] })
      .then((data) => {
        setPendingResponses(data.pending || []);
      })
      .finally(() => setResponsesLoading(false));
  }, [activeTab]);

  // Helper to parse detectedIssues (may be JSON string or array)
  const parseDetectedIssues = (issues: unknown): Array<{ severity: string; description: string }> => {
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
  // Also fetch SENT disputes to determine which accounts are locked
  // (accounts are only locked when dispute status = SENT, not DRAFT)
  useEffect(() => {
    if (!selectedClientId) return;

    setAccountsLoading(true);

    // Fetch both accounts and SENT disputes in parallel
    Promise.all([
      fetch(`/api/accounts/negative?clientId=${selectedClientId}`).then((r) => r.ok ? r.json() : { accounts: [] }),
      fetch(`/api/disputes?clientId=${selectedClientId}&status=SENT`).then((r) => r.ok ? r.json() : [])
    ])
      .then(([accountsData, disputesData]) => {
        // Build a map of active disputes by account fingerprint + CRA
        const activeDisputeMap = new Map<string, {
          disputeId: string;
          flow: string;
          round: number;
          status: string;
          sentDate?: string;
          responseDeadline?: string;
        }>();

        // Process disputes to find which accounts have active disputes
        const disputesList = Array.isArray(disputesData) ? disputesData : [];
        for (const dispute of disputesList) {
          if (!dispute.items) continue;
          for (const item of dispute.items) {
            // Key by account ID + CRA to track per-bureau disputes
            const key = `${item.accountId || item.accountItemId}_${dispute.cra}`;
            const sentDate = dispute.sentDate || dispute.createdAt;
            let daysRemaining = 30;
            let responseDeadline = "";

            if (sentDate) {
              const sent = new Date(sentDate);
              const deadline = new Date(sent.getTime() + 30 * 24 * 60 * 60 * 1000);
              responseDeadline = deadline.toISOString();
              daysRemaining = Math.ceil((deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
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

        // Filter accounts to ONLY show those on the selected CRA
        const accounts = (accountsData.accounts || [])
          .filter((a: ParsedAccountWithIssues) => a.cra === selectedCRA)
          .map((a: ParsedAccountWithIssues) => {
            const key = `${a.id}_${selectedCRA}`;
            const activeDispute = activeDisputeMap.get(key);

            // Calculate days remaining and overdue status
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

            // Determine applicable flows based on issues
            const issues = parseDetectedIssues(a.detectedIssues);
            const applicableFlows = determineApplicableFlows(issues);

            // Calculate next available round per flow
            const nextAvailableRound: Record<string, number> = {};
            for (const flow of applicableFlows) {
              // Find highest round used for this account+cra+flow
              const maxRound = disputesList
                .filter((d: { cra: string; flow: string; items?: { accountId?: string; accountItemId?: string }[] }) =>
                  d.cra === selectedCRA &&
                  d.flow === flow &&
                  d.items?.some((item: { accountId?: string; accountItemId?: string }) =>
                    item.accountId === a.id || item.accountItemId === a.id
                  )
                )
                .reduce((max: number, d: { round: number }) => Math.max(max, d.round || 0), 0);
              nextAvailableRound[flow] = maxRound + 1;
            }

            return {
              ...a,
              detectedIssues: issues,
              bureauData: a.bureauData || {
                TRANSUNION: { balance: a.balance, status: a.accountStatus },
                EXPERIAN: { balance: a.balance, status: a.accountStatus },
                EQUIFAX: { balance: a.balance, status: a.accountStatus },
              },
              activeDispute: activeDisputeInfo,
              applicableFlows,
              nextAvailableRound,
            };
          });

        setParsedAccounts(accounts);

        // Don't auto-select - let users choose their accounts
        // Clear selection when CRA changes to avoid selecting accounts from different bureau
        setSelectedAccounts([]);
      })
      .finally(() => setAccountsLoading(false));
  }, [selectedClientId, selectedCRA]);

  // Helper function to determine applicable flows based on issue codes
  function determineApplicableFlows(issues: Array<{ code?: string; severity?: string; description?: string }>): string[] {
    const flows = new Set<string>();

    for (const issue of issues) {
      const code = (issue.code || "").toUpperCase();

      // Collection-related issues -> COLLECTION flow
      if (code.includes("COLLECTION") ||
          code.includes("CHARGEOFF") ||
          code.includes("CHARGE_OFF") ||
          code.includes("DEROGATORY") ||
          code.includes("DEBT")) {
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
          code.includes("OUTDATED") ||
          code.includes("PAST_DUE")) {
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
  }

  // Fetch client DNA when client changes
  useEffect(() => {
    if (!selectedClientId) return;

    fetch(`/api/clients/${selectedClientId}/dna`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.hasDNA && data.dna?.disputeReadiness?.recommendedFlow) {
          setSelectedFlow(data.dna.disputeReadiness.recommendedFlow);
        }
      });

    // Also fetch full client profile
    fetch(`/api/clients/${selectedClientId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.client) setClient(data.client);
      });
  }, [selectedClientId]);

  // Toggle account selection
  const toggleAccount = (id: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Select all accounts
  const selectAllAccounts = () => {
    setSelectedAccounts(parsedAccounts.map((a) => a.id));
  };

  // Generate letter preview - does NOT create dispute until Launch
  // This prevents the issue where closing the modal leaves a DRAFT dispute blocking future rounds
  const handleCreateDispute = async () => {
    if (!selectedClientId || selectedAccounts.length === 0) {
      toast({ title: "Missing Information", description: "Select a client and at least one account", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      // Use preview API - generates letter WITHOUT creating dispute
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

        // Set the AMELIA-generated letter for preview/editing
        // Note: isPreview=true means dispute is NOT created yet
        setGeneratedLetter({
          isPreview: true,
          clientId: selectedClientId,
          accountIds: selectedAccounts,
          contentHash: data.preview.contentHash,
          content: data.preview.letterContent,
          cra: data.preview.cra,
          flow: data.preview.flow,
          round: data.preview.round,
          status: "PREVIEW", // Not saved yet
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

        // Open the letter preview modal
        setLetterModalOpen(true);

        toast({
          title: "Letter Preview Ready",
          description: `${data.preview.cra} Round ${data.preview.round} - Review and click "Launch Round" to send`,
        });

        // Don't refresh disputes list - nothing created yet
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

  // Helper to refresh disputes list
  const refreshDisputesList = () => {
    fetch("/api/disputes")
      .then((r) => r.ok ? r.json() : [])
      .then((disputeData) => {
        const mapped = (Array.isArray(disputeData) ? disputeData : [])
          .filter((d: { _count?: { items: number } }) => (d._count?.items || 0) > 0)
          .map((d: {
            id: string;
            client: { id: string; firstName: string; lastName: string };
            cra: string;
            flow: string;
            round: number;
            status: string;
            createdAt: string;
            sentDate?: string;
            respondedAt?: string;
            letterContent?: string;
            items?: Array<{
              id: string;
              disputeReason?: string;
              accountItem?: {
                id: string;
                creditorName: string;
                maskedAccountId?: string | null;
                balance?: number | null;
              };
            }>;
            _count?: { items: number };
          }) => ({
            id: d.id,
            clientId: d.client?.id,
            client: d.client,
            cra: d.cra,
            flow: d.flow,
            round: d.round,
            status: d.status || "DRAFT",
            createdAt: d.createdAt,
            sentDate: d.sentDate,
            respondedAt: d.respondedAt,
            letterContent: d.letterContent,
            itemCount: d._count?.items || 0,
            items: d.items,
          }));
        setDisputes(mapped);
      });
  };

  // Download letter as DOCX
  const handleDownloadLetter = async () => {
    if (!generatedLetter) return;

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

  // Launch dispute - creates dispute AND marks as SENT in one atomic operation
  // This is when accounts become "locked" (can't be added to new disputes)
  const handleLaunchDispute = async () => {
    if (!generatedLetter) return;

    setLaunching(true);
    try {
      let res: Response;

      if (generatedLetter.isPreview) {
        // Preview mode: Create and launch in one atomic operation
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
        // Existing dispute: Just launch it
        res = await fetch(`/api/disputes/${generatedLetter.disputeId}/launch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sentDate: new Date().toISOString(),
          }),
        });
      } else {
        toast({
          title: "Error",
          description: "Invalid letter state",
          variant: "destructive",
        });
        setLaunching(false);
        return;
      }

      if (res.ok) {
        const data = await res.json();
        toast({
          title: `Round ${generatedLetter.round} Launched!`,
          description: `${generatedLetter.cra} dispute is now being tracked. 30-day FCRA deadline: ${new Date(data.responseDeadline || data.dispute?.deadlineDate).toLocaleDateString()}`,
        });

        // Close modal and reset selection
        setLetterModalOpen(false);
        setSelectedAccounts([]);
        setGeneratedLetter(null);

        // Refresh disputes list
        refreshDisputesList();

        // Refresh accounts to show locked state (only SENT disputes lock accounts)
        if (selectedClientId) {
          setAccountsLoading(true);
          fetch(`/api/accounts/negative?clientId=${selectedClientId}`)
            .then((r) => r.ok ? r.json() : { accounts: [] })
            .then((accountsData) => {
              // Accounts in SENT disputes are now locked
              const accounts = accountsData.accounts || [];
              setParsedAccounts(
                accounts.map((a: ParsedAccountWithIssues) => ({
                  ...a,
                  detectedIssues: parseDetectedIssues(a.detectedIssues),
                }))
              );
            })
            .finally(() => setAccountsLoading(false));
        }
      } else {
        const error = await res.json();
        toast({
          title: "Launch Failed",
          description: error.error || "Failed to launch dispute",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to launch dispute",
        variant: "destructive",
      });
    } finally {
      setLaunching(false);
    }
  };

  // Calculate stats
  const stats = {
    totalAccounts: parsedAccounts.length,
    highPriority: parsedAccounts.filter((a) => Array.isArray(a.detectedIssues) && a.detectedIssues.some((i) => i.severity === "HIGH")).length,
    collections: parsedAccounts.filter((a) => a.accountStatus === "Collection" || a.accountStatus === "COLLECTION").length,
    totalBalance: parsedAccounts.reduce((sum, a) => sum + (a.balance || 0), 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Disputes</h1>
          <p className="text-slate-400 mt-1">
            Create and manage credit report dispute letters
          </p>
        </div>

        {/* Client Selector */}
        {clients.length > 0 && (
          <div className="flex items-center gap-3">
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm min-w-[200px]"
            >
              <option value="">Select Client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </select>
            {client && client.firstName && (
              <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-xl min-w-[180px]">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/30 to-purple-600/20 flex items-center justify-center text-purple-400 text-sm font-bold border border-purple-500/30">
                  {client.firstName?.[0] || ""}{client.lastName?.[0] || ""}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-white block truncate">
                    {client.firstName} {client.lastName}
                  </span>
                  <span className="text-xs text-slate-400 uppercase tracking-wide">
                    Round {client.currentRound || 1}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📊</span>
              <div>
                <p className="text-2xl font-bold text-white">{stats.totalAccounts}</p>
                <p className="text-xs text-slate-400 uppercase tracking-wider">Negative Accounts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔥</span>
              <div>
                <p className="text-2xl font-bold text-red-400">{stats.highPriority}</p>
                <p className="text-xs text-slate-400 uppercase tracking-wider">High Priority</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📋</span>
              <div>
                <p className="text-2xl font-bold text-amber-400">{stats.collections}</p>
                <p className="text-xs text-slate-400 uppercase tracking-wider">Collections</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💰</span>
              <div>
                <p className="text-2xl font-bold text-emerald-400">${stats.totalBalance.toLocaleString()}</p>
                <p className="text-xs text-slate-400 uppercase tracking-wider">Total Balance</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-800/50 border border-slate-700/50 p-1 w-full justify-start">
          <TabsTrigger value="create" className="gap-2 data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">
            <Sparkles className="w-4 h-4" />
            Create Dispute
          </TabsTrigger>
          <TabsTrigger value="cfpb" className="gap-2 data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">
            <Building className="w-4 h-4" />
            CFPB Complaints
          </TabsTrigger>
          <TabsTrigger value="rounds" className="gap-2 data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">
            <BarChart3 className="w-4 h-4" />
            Round Flow
          </TabsTrigger>
          <TabsTrigger value="responses" className="gap-2 data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">
            <MessageSquareText className="w-4 h-4" />
            Responses
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">
            <History className="w-4 h-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Create Dispute Tab */}
        <TabsContent value="create" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
            {/* Left Panel */}
            <div className="space-y-5">
              {/* CRA Selector */}
              <Card className="bg-slate-800/60 border-slate-700/50 p-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-4">
                  <Building className="w-4 h-4" />
                  Select Bureau
                </h3>
                <CRASelector
                  selectedCRA={selectedCRA}
                  onSelectCRA={setSelectedCRA}
                  scores={client?.creditScores}
                />
              </Card>

              {/* Flow Selector */}
              <Card className="bg-slate-800/60 border-slate-700/50 p-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-4">
                  🔀 Dispute Flow
                </h3>
                <FlowSelector
                  selectedFlow={selectedFlow}
                  onSelectFlow={setSelectedFlow}
                />
              </Card>

              {/* Parsed Accounts - Smart Workflow */}
              <Card className="bg-slate-800/60 border-slate-700/50 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                      📋 {selectedCRA} Accounts
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Showing accounts reported to this bureau only
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Selection count */}
                    {parsedAccounts.length > 0 && (
                      <span className="text-xs text-slate-400">
                        {selectedAccounts.length} of {parsedAccounts.filter(a => !a.activeDispute).length} selected
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-purple-400 border-purple-500/30 hover:text-purple-300 hover:bg-purple-500/10 hover:border-purple-500/50"
                      onClick={() => {
                        // Only select accounts without active disputes
                        const available = parsedAccounts.filter(a => !a.activeDispute);
                        setSelectedAccounts(available.map(a => a.id));
                      }}
                      disabled={parsedAccounts.filter(a => !a.activeDispute).length === 0}
                    >
                      <CheckSquare className="w-4 h-4 mr-1.5" />
                      Select All
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-slate-400 border-slate-600 hover:text-white hover:bg-slate-700/50"
                      onClick={() => setSelectedAccounts([])}
                      disabled={selectedAccounts.length === 0}
                    >
                      <Square className="w-4 h-4 mr-1.5" />
                      Clear All
                    </Button>
                  </div>
                </div>

                {accountsLoading ? (
                  <div className="py-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                    <p className="text-sm text-slate-400 mt-2">Loading {selectedCRA} accounts...</p>
                  </div>
                ) : parsedAccounts.length === 0 ? (
                  <div className="py-8 text-center">
                    <Scale className="w-10 h-10 mx-auto text-slate-600" />
                    <p className="text-sm text-slate-400 mt-2">
                      {selectedClientId
                        ? `No negative accounts found on ${selectedCRA} report`
                        : "Select a client to view accounts"}
                    </p>
                    {selectedClientId && (
                      <p className="text-xs text-slate-500 mt-1">
                        Try selecting a different bureau
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {/* Available accounts first (no active disputes) */}
                    {parsedAccounts
                      .filter(a => !a.activeDispute)
                      .map((account) => (
                        <SmartAccountCard
                          key={account.id}
                          account={account}
                          isSelected={selectedAccounts.includes(account.id)}
                          onToggle={() => toggleAccount(account.id)}
                          selectedCRA={selectedCRA}
                          selectedFlow={selectedFlow}
                          onSelectFlow={setSelectedFlow}
                        />
                      ))}

                    {/* Separator if there are both available and pending accounts */}
                    {parsedAccounts.some(a => !a.activeDispute) &&
                     parsedAccounts.some(a => a.activeDispute) && (
                      <div className="flex items-center gap-3 py-2">
                        <div className="flex-1 border-t border-slate-600/50" />
                        <span className="text-xs text-amber-500/70 font-medium uppercase tracking-wider">
                          Awaiting Response
                        </span>
                        <div className="flex-1 border-t border-slate-600/50" />
                      </div>
                    )}

                    {/* Pending accounts (have active disputes) */}
                    {parsedAccounts
                      .filter(a => a.activeDispute)
                      .map((account) => (
                        <SmartAccountCard
                          key={account.id}
                          account={account}
                          isSelected={false}
                          onToggle={() => {}} // Disabled for locked accounts
                          selectedCRA={selectedCRA}
                          selectedFlow={selectedFlow}
                          onSelectFlow={setSelectedFlow}
                          onViewDispute={(disputeId) => {
                            // Navigate to dispute detail or open modal
                            setActiveTab("history");
                          }}
                        />
                      ))}
                  </div>
                )}
              </Card>

              {/* Personal Info Disputes (R1 Only) */}
              {client && (client.previousNames?.length || client.previousAddresses?.length || client.hardInquiries?.length) && (
                <Card className="bg-slate-800/60 border-slate-700/50 p-5">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-1">
                    👤 Personal Info Disputes
                    <Badge className="ml-auto bg-amber-500/20 text-amber-400 text-[10px]">
                      R1 Only
                    </Badge>
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Round 1 includes disputes for incorrect personal information found on the report.
                  </p>

                  {client.previousNames && client.previousNames.length > 0 && (
                    <div className="mb-3">
                      <span className="block text-xs text-slate-500 font-medium mb-2">
                        Previous Names to Remove:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {client.previousNames.map((name, i) => (
                          <Badge key={i} className="bg-red-500/10 text-red-400 border border-red-500/20">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {client.previousAddresses && client.previousAddresses.length > 0 && (
                    <div className="mb-3">
                      <span className="block text-xs text-slate-500 font-medium mb-2">
                        Old Addresses to Remove:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {client.previousAddresses.map((addr, i) => (
                          <Badge key={i} className="bg-red-500/10 text-red-400 border border-red-500/20 text-xs max-w-full">
                            {addr}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {client.hardInquiries && client.hardInquiries.filter((i) => i.cra === selectedCRA).length > 0 && (
                    <div>
                      <span className="block text-xs text-slate-500 font-medium mb-2">
                        Unauthorized Inquiries:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {client.hardInquiries.filter((i) => i.cra === selectedCRA).map((inq, i) => (
                          <Badge key={i} className="bg-red-500/10 text-red-400 border border-red-500/20">
                            {inq.creditorName} ({inq.inquiryDate})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              )}
            </div>

            {/* Right Panel - AMELIA AI */}
            <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
              {/* AMELIA Insights */}
              <AmeliaInsightsPanel
                clientId={selectedClientId}
                cra={selectedCRA}
                flow={selectedFlow}
                accountIds={selectedAccounts}
                onInsightsGenerated={(insights) => {
                  setAmeliaInsights(insights);
                  if (insights.eoscarDetection) {
                    setEoscarScore(insights.eoscarDetection);
                  }
                }}
              />

              {/* eOSCAR Detection Score */}
              {eoscarScore && (
                <Card className="bg-slate-800/60 border-slate-700/50 p-5">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-4">
                    🛡️ eOSCAR Detection Risk
                  </h3>
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={cn(
                        "w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold text-white",
                        eoscarScore.level === "low" && "bg-emerald-500",
                        eoscarScore.level === "medium" && "bg-amber-500",
                        eoscarScore.level === "high" && "bg-red-500"
                      )}
                    >
                      {eoscarScore.risk}%
                    </div>
                    <span
                      className={cn(
                        "text-xs font-bold tracking-wider uppercase",
                        eoscarScore.level === "low" && "text-emerald-400",
                        eoscarScore.level === "medium" && "text-amber-400",
                        eoscarScore.level === "high" && "text-red-400"
                      )}
                    >
                      {eoscarScore.level} RISK
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-2.5 bg-slate-700/30 rounded-lg text-center">
                      <span className="block text-lg font-bold text-white">{eoscarScore.uniquenessScore}%</span>
                      <span className="text-[10px] text-slate-500 uppercase">Uniqueness</span>
                    </div>
                    <div className="p-2.5 bg-slate-700/30 rounded-lg text-center">
                      <span className="block text-lg font-bold text-white">{eoscarScore.humanizingPhrases}</span>
                      <span className="text-[10px] text-slate-500 uppercase">Human Phrases</span>
                    </div>
                    <div className="p-2.5 bg-slate-700/30 rounded-lg text-center">
                      <span className="block text-lg font-bold text-white">{eoscarScore.flaggedPhrases}</span>
                      <span className="text-[10px] text-slate-500 uppercase">Flagged</span>
                    </div>
                  </div>
                </Card>
              )}

              {/* Action Button - Single step creates dispute & generates letter for review */}
              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400"
                  disabled={selectedAccounts.length === 0 || creating}
                  onClick={handleCreateDispute}
                >
                  {creating ? (
                    <>
                      <Sparkles className="w-4 h-4 mr-2 animate-pulse" />
                      AMELIA Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Letter
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-slate-500 text-center mt-2">
                Creates draft dispute with AMELIA-generated letter for review
              </p>
            </div>
          </div>
        </TabsContent>

        {/* Round Flow Tab */}
        <TabsContent value="rounds" className="mt-6">
          {client ? (
            <RoundFlowView
              client={client}
              currentRound={client.currentRound || 1}
              currentFlow={selectedFlow}
              disputes={disputes.filter(d => d.clientId === selectedClientId || d.client?.id === selectedClientId)}
              onViewLetter={(disputeId) => {
                // Find the dispute and open letter modal
                const dispute = disputes.find(d => d.id === disputeId);
                if (dispute) {
                  // Fetch full dispute with letter content
                  fetch(`/api/disputes/${disputeId}`)
                    .then(r => r.ok ? r.json() : null)
                    .then(data => {
                      if (data?.letterContent) {
                        setGeneratedLetter({
                          disputeId: data.id,
                          content: data.letterContent,
                          cra: data.cra,
                          flow: data.flow,
                          round: data.round,
                          status: data.status,
                          ameliaMetadata: data.aiStrategy ? JSON.parse(data.aiStrategy) : {
                            letterDate: data.createdAt,
                            isBackdated: false,
                            backdatedDays: 0,
                            tone: "CONCERNED",
                            effectiveFlow: data.flow,
                            statute: "§ 1681i",
                            personalInfoDisputed: { previousNames: 0, previousAddresses: 0, hardInquiries: 0 },
                          },
                        });
                        setLetterModalOpen(true);
                      } else {
                        toast({ title: "No Letter", description: "No letter content found for this dispute", variant: "destructive" });
                      }
                    });
                }
              }}
              onTrackResponse={(disputeId) => {
                // Navigate to the Response Tracker page with the dispute ID
                router.push(`/responses?disputeId=${disputeId}`);
              }}
              onRefresh={refreshDisputesList}
            />
          ) : (
            <Card className="bg-slate-800/60 border-slate-700/50 p-12 text-center">
              <Scale className="w-12 h-12 mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400">Select a client to view their dispute round flow</p>
            </Card>
          )}
        </TabsContent>

        {/* CFPB Tab */}
        <TabsContent value="cfpb" className="mt-6">
          <CFPBView
            accounts={parsedAccounts}
            selectedCRA={selectedCRA}
            onSelectCRA={setSelectedCRA}
            clientName={client ? `${client.firstName} ${client.lastName}` : undefined}
            clientId={selectedClientId || undefined}
          />
        </TabsContent>

        {/* Responses Tab */}
        <TabsContent value="responses" className="mt-6">
          <Card className="bg-slate-800/60 border-slate-700/50 p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-white">Response Tracker</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Track pending responses and FCRA deadlines
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/responses")}
                className="text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10"
              >
                Full View →
              </Button>
            </div>

            {responsesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              </div>
            ) : pendingResponses.length === 0 ? (
              <div className="py-12 text-center">
                <MessageSquareText className="w-12 h-12 mx-auto text-slate-600 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No Pending Responses</h3>
                <p className="text-slate-400 max-w-md mx-auto">
                  Disputes that have been sent will appear here with their 30-day FCRA deadline tracking.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingResponses.map((response) => {
                  const isUrgent = response.daysRemaining <= 5;
                  const isWarning = response.daysRemaining <= 10 && response.daysRemaining > 5;

                  return (
                    <div
                      key={response.id}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-lg border transition-colors cursor-pointer hover:bg-slate-700/30",
                        isUrgent ? "border-red-500/30 bg-red-500/5" :
                        isWarning ? "border-amber-500/30 bg-amber-500/5" :
                        "border-slate-700/50 bg-slate-800/30"
                      )}
                      onClick={() => router.push(`/clients/${response.clientId}?tab=disputes`)}
                    >
                      {/* Days Badge */}
                      <div className={cn(
                        "w-14 h-14 rounded-lg flex flex-col items-center justify-center",
                        isUrgent ? "bg-red-500/20" :
                        isWarning ? "bg-amber-500/20" :
                        "bg-emerald-500/20"
                      )}>
                        <span className={cn(
                          "text-xl font-bold",
                          isUrgent ? "text-red-400" :
                          isWarning ? "text-amber-400" :
                          "text-emerald-400"
                        )}>
                          {response.daysRemaining}d
                        </span>
                      </div>

                      {/* Client & Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{response.clientName}</span>
                          <Badge className={cn(
                            "text-[10px]",
                            response.cra === "TRANSUNION" ? "bg-blue-500/20 text-blue-400" :
                            response.cra === "EQUIFAX" ? "bg-red-500/20 text-red-400" :
                            "bg-purple-500/20 text-purple-400"
                          )}>
                            {response.cra.slice(0, 2)}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-400 mt-0.5">
                          R{response.round} • {response.flow} • {response.itemCount} items • Sent {new Date(response.sentDate).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Status */}
                      <div className="text-right">
                        <span className={cn(
                          "text-xs font-medium",
                          isUrgent ? "text-red-400" :
                          isWarning ? "text-amber-400" :
                          "text-emerald-400"
                        )}>
                          {isUrgent ? "Urgent" : isWarning ? "Soon" : "On Track"}
                        </span>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {response.daysElapsed} days elapsed
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-6">
          <Card className="bg-slate-800/60 border-slate-700/50 p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-white">Dispute History</h2>
                <p className="text-sm text-slate-400 mt-1">
                  {selectedClientId ? "Showing disputes for selected client" : "Showing all active dispute campaigns"}
                </p>
              </div>
              <div className="flex gap-2">
                <select className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white">
                  <option value="">All Statuses</option>
                  <option value="DRAFT">Draft</option>
                  <option value="SENT">Sent</option>
                  <option value="RESPONDED">Responded</option>
                  <option value="APPROVED">Approved</option>
                </select>
                <select className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white">
                  <option value="">All Bureaus</option>
                  <option value="TRANSUNION">TransUnion</option>
                  <option value="EXPERIAN">Experian</option>
                  <option value="EQUIFAX">Equifax</option>
                </select>
              </div>
            </div>

            {(() => {
              // Filter disputes - show only for selected client if one is selected
              const filteredDisputes = selectedClientId
                ? disputes.filter((d) => d.clientId === selectedClientId || d.client?.id === selectedClientId)
                : disputes;

              if (filteredDisputes.length === 0) {
                return (
                  <div className="py-12 text-center">
                    <History className="w-12 h-12 mx-auto text-slate-600 mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">No Dispute Campaigns</h3>
                    <p className="text-slate-400 max-w-md mx-auto">
                      {selectedClientId
                        ? "No disputes have been created for this client yet. Start by selecting accounts and creating a dispute."
                        : "Create your first dispute campaign by selecting a client and choosing accounts to dispute."}
                    </p>
                    <Button
                      className="mt-4"
                      onClick={() => setActiveTab("create")}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Dispute
                    </Button>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {filteredDisputes.map((dispute) => (
                    <div
                      key={dispute.id}
                      className="flex items-center gap-4 p-4 bg-slate-700/30 rounded-xl border border-slate-600/50 hover:border-slate-500/50 transition-all"
                    >
                      <div className="w-10 h-10 rounded-lg bg-slate-600/30 flex items-center justify-center">
                        <Scale className="w-5 h-5 text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white">
                          {dispute.client?.firstName || "Unknown"} {dispute.client?.lastName || "Client"}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          <Badge className={CRA_COLORS[dispute.cra]?.tailwind || "bg-slate-500/20 text-slate-400"}>
                            {dispute.cra}
                          </Badge>
                          <span className="text-xs text-slate-400 font-medium">Round {dispute.round}</span>
                          <span className="text-xs text-slate-500">{dispute.flow}</span>
                          <span className="text-xs text-slate-400 font-medium">{dispute.itemCount} items</span>
                          <span className="text-xs text-slate-500">
                            {new Date(dispute.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={STATUS_COLORS[dispute.status] || "bg-slate-500/20 text-slate-400"}>
                          {dispute.status}
                        </Badge>
                        <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white">
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Letter Editor Modal - Full featured editor with AMELIA AI */}
      <LetterEditorModal
        open={letterModalOpen}
        onOpenChange={(open) => {
          setLetterModalOpen(open);
          if (!open) {
            // Reset state when modal closes
            setAmeliaInsights(null);
          }
        }}
        generatedLetter={generatedLetter}
        onLaunch={handleLaunchDispute}
        launching={launching}
        onDownload={handleDownloadLetter}
        downloading={downloading}
      />
    </div>
  );
}
