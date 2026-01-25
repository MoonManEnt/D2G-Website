"use client";

import { useState, useEffect, useCallback } from "react";
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
  AlertTriangle,
  CheckCircle,
  Download,
} from "lucide-react";
import { useToast } from "@/lib/use-toast";

// Sub-components
import { CRASelector } from "./cra-selector";
import { FlowSelector } from "./flow-selector";
import { AccountCard } from "./account-card";
import { RoundFlowView } from "./round-flow-view";
import { CFPBView } from "./cfpb-view";
import { AmeliaInsightsPanel } from "./amelia-insights-panel";
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

  // Loading states
  const [loading, setLoading] = useState(true);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Fetch clients on mount
  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        setClients(Array.isArray(data) ? data : data.clients || []);
      })
      .finally(() => setLoading(false));
  }, []);

  // Fetch disputes history - only show properly created disputes (with items)
  useEffect(() => {
    fetch("/api/disputes")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        const mapped = (Array.isArray(data) ? data : [])
          .filter((d: { _count?: { items: number } }) => (d._count?.items || 0) > 0) // Only show disputes with items
          .map((d: {
            id: string;
            client: { id: string; firstName: string; lastName: string };
            cra: string;
            flow: string;
            round: number;
            disputeStatus: string;
            createdAt: string;
            _count?: { items: number };
          }) => ({
            id: d.id,
            clientId: d.client?.id,
            client: d.client,
            cra: d.cra,
            flow: d.flow,
            round: d.round,
            status: d.disputeStatus || "DRAFT",
            createdAt: d.createdAt,
            itemCount: d._count?.items || 0,
          }));
        setDisputes(mapped);
      });
  }, []);

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
  useEffect(() => {
    if (!selectedClientId) return;

    setAccountsLoading(true);
    fetch(`/api/accounts/negative?clientId=${selectedClientId}`)
      .then((r) => r.ok ? r.json() : { accounts: [] })
      .then((data) => {
        const accounts = (data.accounts || [])
          .filter((a: ParsedAccountWithIssues) => a.cra === selectedCRA || !a.cra)
          .map((a: ParsedAccountWithIssues) => ({
            ...a,
            detectedIssues: parseDetectedIssues(a.detectedIssues),
            bureauData: a.bureauData || {
              TRANSUNION: { balance: a.balance, status: a.accountStatus },
              EXPERIAN: { balance: a.balance, status: a.accountStatus },
              EQUIFAX: { balance: a.balance, status: a.accountStatus },
            },
          }));
        setParsedAccounts(accounts);
        // Auto-select all accounts
        setSelectedAccounts(accounts.map((a: ParsedAccountWithIssues) => a.id));
      })
      .finally(() => setAccountsLoading(false));
  }, [selectedClientId, selectedCRA]);

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

  // Create dispute
  const handleCreateDispute = async () => {
    if (!selectedClientId || selectedAccounts.length === 0) {
      toast({ title: "Missing Information", description: "Select a client and at least one account", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/disputes", {
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
        toast({ title: "Dispute Created", description: `${data.dispute.cra} dispute letter generated` });
        // Reset selection
        setSelectedAccounts([]);
        setAmeliaInsights(null);
        // Refresh disputes list
        fetch("/api/disputes")
          .then((r) => r.ok ? r.json() : [])
          .then((data) => setDisputes(Array.isArray(data) ? data : []));
        // Switch to history tab
        setActiveTab("history");
      } else {
        const error = await res.json();
        toast({ title: "Failed", description: error.error || "Failed to create dispute", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to create dispute", variant: "destructive" });
    } finally {
      setCreating(false);
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
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-700/50 rounded-lg">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 text-sm font-bold">
                  {client.firstName?.[0] || ""}{client.lastName?.[0] || ""}
                </div>
                <div>
                  <span className="text-sm font-medium text-white block">
                    {client.firstName} {client.lastName}
                  </span>
                  <span className="text-xs text-slate-400">{client.stage?.replace("_", " ")}</span>
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
        <TabsList className="bg-slate-800/40 border-slate-700 p-1.5 w-fit">
          <TabsTrigger value="create" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
            <Sparkles className="w-4 h-4 mr-2" />
            Create Dispute
          </TabsTrigger>
          <TabsTrigger value="rounds" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
            <BarChart3 className="w-4 h-4 mr-2" />
            Round Flow
          </TabsTrigger>
          <TabsTrigger value="cfpb" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
            <Building className="w-4 h-4 mr-2" />
            CFPB Complaints
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
            <History className="w-4 h-4 mr-2" />
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

              {/* Parsed Accounts */}
              <Card className="bg-slate-800/60 border-slate-700/50 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                    📋 Parsed Accounts
                  </h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                    onClick={selectAllAccounts}
                  >
                    Select All ({parsedAccounts.length})
                  </Button>
                </div>

                {accountsLoading ? (
                  <div className="py-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                    <p className="text-sm text-slate-400 mt-2">Loading accounts...</p>
                  </div>
                ) : parsedAccounts.length === 0 ? (
                  <div className="py-8 text-center">
                    <Scale className="w-10 h-10 mx-auto text-slate-600" />
                    <p className="text-sm text-slate-400 mt-2">
                      {selectedClientId ? "No negative accounts found for this CRA" : "Select a client to view accounts"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    {parsedAccounts.map((account) => (
                      <AccountCard
                        key={account.id}
                        account={account}
                        isSelected={selectedAccounts.includes(account.id)}
                        onToggle={() => toggleAccount(account.id)}
                        selectedCRA={selectedCRA}
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
            <div className="space-y-5">
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

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-slate-600 text-white hover:bg-slate-700"
                  disabled={selectedAccounts.length === 0}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Preview Letter
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400"
                  disabled={selectedAccounts.length === 0 || creating}
                  onClick={handleCreateDispute}
                >
                  {creating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Create Dispute
                </Button>
              </div>
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
          />
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
    </div>
  );
}
