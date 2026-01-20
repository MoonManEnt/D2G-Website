"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertTriangle,
  ShieldAlert,
  Scale,
  Camera,
  FileText,
  Loader2,
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  Image as ImageIcon,
  Send
} from "lucide-react";
import { useToast } from "@/lib/use-toast";
import { useRouter } from "next/navigation";
import { EvidenceCaptureModal } from "@/components/evidence/capture-modal";

interface AccountIssue {
  code: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  description: string;
  suggestedFlow: string;
  fcraSection?: string;
}

interface NegativeAccount {
  id: string;
  creditorName: string;
  maskedAccountId: string;
  cra: string;
  accountType: string | null;
  accountStatus: string;
  balance: number | null;
  pastDue: number | null;
  creditLimit: number | null;
  paymentStatus: string | null;
  dateOpened: string | null;
  dateReported: string | null;
  confidenceScore: number;
  confidenceLevel: string;
  isDisputable: boolean;
  issueCount: number;
  detectedIssues: string | null;
  suggestedFlow: string | null;
  reportId: string;
  client: {
    id: string;
    firstName: string;
    lastName: string;
  };
  evidences: Array<{
    id: string;
    evidenceType: string;
    description: string;
    createdAt: string;
  }>;
}

export default function NegativeItemsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [accounts, setAccounts] = useState<NegativeAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<NegativeAccount | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");
  const [filterFlow, setFilterFlow] = useState<string>("ALL");
  const [captureModalOpen, setCaptureModalOpen] = useState(false);
  const [captureAccount, setCaptureAccount] = useState<NegativeAccount | null>(null);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [creatingDispute, setCreatingDispute] = useState(false);

  const fetchNegativeAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts/negative");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error("Failed to fetch negative accounts:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNegativeAccounts();
  }, [fetchNegativeAccounts]);

  const handleCaptureEvidence = (account: NegativeAccount) => {
    setCaptureAccount(account);
    setCaptureModalOpen(true);
  };

  const handleEvidenceCaptured = () => {
    toast({
      title: "Evidence Captured",
      description: "Screenshots have been saved as evidence.",
    });
    fetchNegativeAccounts();
  };

  const toggleAccountSelection = (accountId: string) => {
    setSelectedAccountIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(accountId)) {
        newSet.delete(accountId);
      } else {
        newSet.add(accountId);
      }
      return newSet;
    });
  };

  const selectAllFiltered = () => {
    const allFilteredIds = filteredAccounts.map((a) => a.id);
    setSelectedAccountIds(new Set(allFilteredIds));
  };

  const clearSelection = () => {
    setSelectedAccountIds(new Set());
  };

  const getSelectedAccountsByCRA = () => {
    const selectedAccounts = accounts.filter((a) => selectedAccountIds.has(a.id));
    const byCRA: Record<string, NegativeAccount[]> = {};
    selectedAccounts.forEach((account) => {
      if (!byCRA[account.cra]) {
        byCRA[account.cra] = [];
      }
      byCRA[account.cra].push(account);
    });
    return byCRA;
  };

  const handleCreateDispute = async () => {
    const accountsByCRA = getSelectedAccountsByCRA();
    const craKeys = Object.keys(accountsByCRA);

    if (craKeys.length === 0) {
      toast({
        title: "No Accounts Selected",
        description: "Please select accounts to create a dispute.",
        variant: "destructive",
      });
      return;
    }

    if (craKeys.length > 1) {
      toast({
        title: "Multiple CRAs Selected",
        description: "Please select accounts from only one credit bureau at a time. Each CRA requires a separate dispute.",
        variant: "destructive",
      });
      return;
    }

    const cra = craKeys[0];
    const selectedCRAAccounts = accountsByCRA[cra];
    const clientId = selectedCRAAccounts[0].client.id;

    // Verify all accounts belong to same client
    const allSameClient = selectedCRAAccounts.every((a) => a.client.id === clientId);
    if (!allSameClient) {
      toast({
        title: "Multiple Clients Selected",
        description: "Please select accounts from only one client at a time.",
        variant: "destructive",
      });
      return;
    }

    // Determine flow - use the most common suggested flow
    const flowCounts: Record<string, number> = {};
    selectedCRAAccounts.forEach((a) => {
      const flow = a.suggestedFlow || "ACCURACY";
      flowCounts[flow] = (flowCounts[flow] || 0) + 1;
    });
    const flow = Object.entries(flowCounts).sort((a, b) => b[1] - a[1])[0][0];

    setCreatingDispute(true);

    try {
      const res = await fetch("/api/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          cra,
          flow,
          accountIds: selectedCRAAccounts.map((a) => a.id),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast({
          title: "Dispute Created",
          description: `Created ${cra} dispute with ${selectedCRAAccounts.length} account(s).`,
        });
        setSelectedAccountIds(new Set());
        router.push(`/disputes?id=${data.dispute.id}`);
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.error || "Failed to create dispute",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setCreatingDispute(false);
    }
  };

  const parseIssues = (detectedIssues: string | null): AccountIssue[] => {
    if (!detectedIssues) return [];
    try {
      return JSON.parse(detectedIssues);
    } catch {
      return [];
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "HIGH":
        return <ShieldAlert className="w-4 h-4 text-brand-error" />;
      case "MEDIUM":
        return <AlertTriangle className="w-4 h-4 text-brand-warning" />;
      default:
        return <Scale className="w-4 h-4 text-brand-info" />;
    }
  };

  const getCRABadge = (cra: string) => {
    const colors: Record<string, string> = {
      TRANSUNION: "bg-sky-600/20 text-sky-400",
      EXPERIAN: "bg-blue-600/20 text-blue-400",
      EQUIFAX: "bg-red-600/20 text-red-400",
    };
    return <Badge className={colors[cra] || "bg-slate-500/20 text-slate-400"}>{cra}</Badge>;
  };

  const getFlowBadge = (flow: string | null) => {
    if (!flow) return null;
    const colors: Record<string, string> = {
      ACCURACY: "bg-brand-accent/20 text-brand-accent",
      COLLECTION: "bg-brand-warning/20 text-brand-warning",
      CONSENT: "bg-brand-info/20 text-brand-info",
    };
    return <Badge className={colors[flow] || "bg-slate-500/20 text-slate-400"}>{flow}</Badge>;
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Filter accounts
  const filteredAccounts = accounts.filter(account => {
    const issues = parseIssues(account.detectedIssues);
    const hasHighSeverity = issues.some(i => i.severity === "HIGH");
    const hasMediumSeverity = issues.some(i => i.severity === "MEDIUM");

    if (filterSeverity !== "ALL") {
      if (filterSeverity === "HIGH" && !hasHighSeverity) return false;
      if (filterSeverity === "MEDIUM" && !hasMediumSeverity) return false;
    }

    if (filterFlow !== "ALL" && account.suggestedFlow !== filterFlow) {
      return false;
    }

    return true;
  });

  // Summary stats
  const stats = {
    total: accounts.length,
    highSeverity: accounts.filter(a => parseIssues(a.detectedIssues).some(i => i.severity === "HIGH")).length,
    collections: accounts.filter(a => a.accountStatus === "COLLECTION").length,
    chargeOffs: accounts.filter(a => a.accountStatus === "CHARGED_OFF").length,
    withEvidence: accounts.filter(a => a.evidences && a.evidences.length > 0).length,
  };

  return (
    <div className="space-y-6 lg:ml-64 pt-16 lg:pt-0">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Negative Items</h1>
          <p className="text-slate-400 mt-1">Accounts negatively impacting credit - ready for dispute</p>
        </div>
        {selectedAccountIds.size > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">
              {selectedAccountIds.size} account{selectedAccountIds.size !== 1 ? "s" : ""} selected
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={clearSelection}
              className="border-slate-600 text-slate-300"
            >
              Clear
            </Button>
            <Button
              size="sm"
              onClick={handleCreateDispute}
              disabled={creatingDispute}
              className="bg-primary hover:bg-primary/90"
            >
              {creatingDispute ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Create Dispute
            </Button>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Negative</p>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-brand-error" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">High Severity</p>
                <p className="text-2xl font-bold text-brand-error">{stats.highSeverity}</p>
              </div>
              <ShieldAlert className="w-8 h-8 text-brand-error" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Collections</p>
                <p className="text-2xl font-bold text-brand-warning">{stats.collections}</p>
              </div>
              <FileText className="w-8 h-8 text-brand-warning" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Charge-Offs</p>
                <p className="text-2xl font-bold text-brand-warning">{stats.chargeOffs}</p>
              </div>
              <XCircle className="w-8 h-8 text-brand-warning" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Has Evidence</p>
                <p className="text-2xl font-bold text-brand-success">{stats.withEvidence}</p>
              </div>
              <ImageIcon className="w-8 h-8 text-brand-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">Filter:</span>
            </div>
            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger className="w-40 bg-slate-700/50 border-slate-600 text-white">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="ALL">All Severity</SelectItem>
                <SelectItem value="HIGH">High Only</SelectItem>
                <SelectItem value="MEDIUM">Medium Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterFlow} onValueChange={setFilterFlow}>
              <SelectTrigger className="w-40 bg-slate-700/50 border-slate-600 text-white">
                <SelectValue placeholder="Flow Type" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="ALL">All Flows</SelectItem>
                <SelectItem value="ACCURACY">Accuracy</SelectItem>
                <SelectItem value="COLLECTION">Collection</SelectItem>
                <SelectItem value="CONSENT">Consent</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-slate-500">
              Showing {filteredAccounts.length} of {accounts.length} items
            </span>
            {filteredAccounts.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAllFiltered}
                className="text-slate-400 hover:text-white"
              >
                Select All ({filteredAccounts.length})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Negative Accounts List */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-400" />
            Disputable Accounts
          </CardTitle>
          <CardDescription className="text-slate-400">
            These accounts contain potential FCRA violations or negative items
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 mx-auto text-brand-success" />
              <p className="text-slate-400 mt-4">No negative items found</p>
              <p className="text-sm text-slate-500">Upload a credit report to analyze for issues</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAccounts.map((account) => {
                const issues = parseIssues(account.detectedIssues);
                const hasEvidence = account.evidences && account.evidences.length > 0;
                const isSelected = selectedAccountIds.has(account.id);
                return (
                  <div
                    key={account.id}
                    className={`p-4 rounded-lg border ${
                      isSelected
                        ? "bg-primary/10 border-primary/50"
                        : "bg-red-900/10 border-red-500/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleAccountSelection(account.id)}
                          className="mt-1 border-slate-500"
                        />
                        <div className="flex-1 min-w-0">
                        {/* Header */}
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="text-xs text-slate-500">
                            {account.client.firstName} {account.client.lastName}
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="font-semibold text-white">{account.creditorName}</span>
                          {getCRABadge(account.cra)}
                          {getFlowBadge(account.suggestedFlow)}
                          <Badge className="bg-brand-error/20 text-brand-error">
                            {account.issueCount} Issue{account.issueCount !== 1 ? "s" : ""}
                          </Badge>
                          {hasEvidence && (
                            <Badge className="bg-brand-success/20 text-brand-success">
                              <ImageIcon className="w-3 h-3 mr-1" />
                              Evidence
                            </Badge>
                          )}
                        </div>

                        {/* Account Details */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm mb-3">
                          <div>
                            <span className="text-slate-500">Account:</span>
                            <span className="text-white ml-1">{account.maskedAccountId}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Balance:</span>
                            <span className="text-white ml-1">{formatCurrency(account.balance)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Status:</span>
                            <span className={`ml-1 ${account.accountStatus === "OPEN" ? "text-brand-success" : "text-brand-error"}`}>
                              {account.accountStatus}
                            </span>
                          </div>
                          {account.pastDue && account.pastDue > 0 && (
                            <div>
                              <span className="text-slate-500">Past Due:</span>
                              <span className="text-brand-error font-medium ml-1">{formatCurrency(account.pastDue)}</span>
                            </div>
                          )}
                        </div>

                        {/* Issues */}
                        <div className="space-y-1">
                          {issues.slice(0, 3).map((issue, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-2 text-xs"
                            >
                              {getSeverityIcon(issue.severity)}
                              <span className="text-slate-300">{issue.description}</span>
                              {issue.fcraSection && (
                                <span className="text-slate-500">({issue.fcraSection})</span>
                              )}
                            </div>
                          ))}
                          {issues.length > 3 && (
                            <span className="text-xs text-slate-500">+{issues.length - 3} more issues</span>
                          )}
                        </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-slate-600 text-slate-300 hover:bg-slate-700"
                          onClick={() => setSelectedAccount(account)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Details
                        </Button>
                        <Button
                          size="sm"
                          className="bg-red-600 hover:bg-red-700"
                          onClick={() => handleCaptureEvidence(account)}
                        >
                          <Camera className="w-4 h-4 mr-1" />
                          Capture
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Detail Dialog */}
      <Dialog open={!!selectedAccount} onOpenChange={(open) => !open && setSelectedAccount(null)}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {selectedAccount?.creditorName}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {selectedAccount?.client.firstName} {selectedAccount?.client.lastName} • {selectedAccount?.cra}
            </DialogDescription>
          </DialogHeader>

          {selectedAccount && (
            <div className="space-y-4 pt-4">
              {/* Account Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Account Number:</span>
                    <span className="text-white">{selectedAccount.maskedAccountId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Account Type:</span>
                    <span className="text-white">{selectedAccount.accountType || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Status:</span>
                    <span className={selectedAccount.accountStatus === "OPEN" ? "text-brand-success" : "text-brand-error"}>
                      {selectedAccount.accountStatus}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Payment Status:</span>
                    <span className={selectedAccount.paymentStatus?.toLowerCase().includes("late") ? "text-brand-error" : "text-white"}>
                      {selectedAccount.paymentStatus || "—"}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Balance:</span>
                    <span className="text-white">{formatCurrency(selectedAccount.balance)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Past Due:</span>
                    <span className={selectedAccount.pastDue && selectedAccount.pastDue > 0 ? "text-brand-error" : "text-white"}>
                      {formatCurrency(selectedAccount.pastDue)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Credit Limit:</span>
                    <span className="text-white">{formatCurrency(selectedAccount.creditLimit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Date Opened:</span>
                    <span className="text-white">
                      {selectedAccount.dateOpened ? new Date(selectedAccount.dateOpened).toLocaleDateString() : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* All Issues */}
              <div className="border-t border-slate-700 pt-4">
                <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                  <Scale className="w-4 h-4" />
                  All Identified Issues ({selectedAccount.issueCount})
                </h3>
                <div className="space-y-2">
                  {parseIssues(selectedAccount.detectedIssues).map((issue, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded border ${
                        issue.severity === "HIGH"
                          ? "bg-brand-error/10 border-brand-error/30"
                          : issue.severity === "MEDIUM"
                          ? "bg-brand-warning/10 border-brand-warning/30"
                          : "bg-brand-info/10 border-brand-info/30"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {getSeverityIcon(issue.severity)}
                        <div className="flex-1">
                          <p className="text-sm text-white">{issue.description}</p>
                          <div className="flex items-center gap-4 mt-1 text-xs">
                            {issue.fcraSection && (
                              <span className="text-slate-400">
                                Cite: <span className="text-slate-300">{issue.fcraSection}</span>
                              </span>
                            )}
                            <span className="text-slate-400">
                              Flow: <span className="text-slate-300">{issue.suggestedFlow}</span>
                            </span>
                          </div>
                        </div>
                        <Badge className={
                          issue.severity === "HIGH" ? "bg-brand-error/20 text-brand-error" :
                          issue.severity === "MEDIUM" ? "bg-brand-warning/20 text-brand-warning" :
                          "bg-brand-info/20 text-brand-info"
                        }>
                          {issue.severity}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Evidence Section */}
              {selectedAccount.evidences && selectedAccount.evidences.length > 0 && (
                <div className="border-t border-slate-700 pt-4">
                  <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    Captured Evidence ({selectedAccount.evidences.length})
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedAccount.evidences.map((evidence) => (
                      <div
                        key={evidence.id}
                        className="p-2 bg-slate-700/50 rounded border border-slate-600 text-xs"
                      >
                        <p className="text-white">{evidence.evidenceType}</p>
                        <p className="text-slate-400">{evidence.description}</p>
                        <p className="text-slate-500 mt-1">
                          {new Date(evidence.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                <Button variant="ghost" onClick={() => setSelectedAccount(null)}>
                  Close
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => {
                    setSelectedAccount(null);
                    handleCaptureEvidence(selectedAccount);
                  }}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Capture Evidence
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Visual Evidence Capture Modal */}
      {captureAccount && (
        <EvidenceCaptureModal
          open={captureModalOpen}
          onOpenChange={(open) => {
            setCaptureModalOpen(open);
            if (!open) setCaptureAccount(null);
          }}
          account={{
            id: captureAccount.id,
            creditorName: captureAccount.creditorName,
            maskedAccountId: captureAccount.maskedAccountId,
            cra: captureAccount.cra,
            detectedIssues: captureAccount.detectedIssues,
          }}
          reportId={captureAccount.reportId}
          pdfUrl={`/api/reports/${captureAccount.reportId}/pdf`}
          onEvidenceCaptured={handleEvidenceCaptured}
        />
      )}
    </div>
  );
}
