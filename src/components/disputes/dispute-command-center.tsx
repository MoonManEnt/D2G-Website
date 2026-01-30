"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Lock,
  Clock,
  Mail,
} from "lucide-react";
import { useToast } from "@/lib/use-toast";
import { CRAProgressHeader, calculateCRAStatus } from "./cra-progress-header";
import { BulkActionBar } from "./bulk-action-bar";
import { detectFlowsPerCRA, type DisputeFlow } from "@/lib/flow-detector";
import { LetterEditorModal } from "./letter-editor-modal";
import { MailSendDialog } from "./mail-send-dialog";

interface AccountItem {
  id: string;
  creditorName: string;
  maskedAccountId?: string | null;
  accountType?: string | null;
  accountStatus?: string | null;
  balance?: number | null;
  cra: string;
  detectedIssues?: string | null;
  issueCount?: number;
}

interface Dispute {
  id: string;
  cra: string;
  round: number;
  status: string;
  flow: string;
  sentDate?: string;
  createdAt?: string;
  items?: Array<{ accountItemId?: string; accountId?: string }>;
}

interface DisputeCommandCenterProps {
  clientId: string;
  clientName?: string;
  accounts: AccountItem[];
  existingDisputes: Dispute[];
  onDisputeCreated?: () => void;
}

const CRA_COLORS = {
  TRANSUNION: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400" },
  EQUIFAX: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400" },
  EXPERIAN: { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-400" },
} as const;

export function DisputeCommandCenter({
  clientId,
  clientName,
  accounts,
  existingDisputes,
  onDisputeCreated,
}: DisputeCommandCenterProps) {
  const { toast } = useToast();

  // Selection state per CRA
  const [selections, setSelections] = useState<{
    TRANSUNION: string[];
    EQUIFAX: string[];
    EXPERIAN: string[];
  }>({
    TRANSUNION: [],
    EQUIFAX: [],
    EXPERIAN: [],
  });

  // UI state
  const [expandedCreditors, setExpandedCreditors] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [creatingCRA, setCreatingCRA] = useState<string | null>(null);

  // Letter modal state
  const [letterModalOpen, setLetterModalOpen] = useState(false);
  const [generatedLetter, setGeneratedLetter] = useState<{
    disputeId: string;
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

  // Mail dialog state
  const [mailDialogOpen, setMailDialogOpen] = useState(false);
  const [mailDisputeId, setMailDisputeId] = useState<string | null>(null);
  const [mailDisputeCRA, setMailDisputeCRA] = useState<string>("TRANSUNION");

  // Group accounts by normalized creditor name
  const accountGroups = useMemo(() => {
    const groups = new Map<string, AccountItem[]>();

    for (const account of accounts) {
      // Normalize creditor name for grouping
      const normalizedName = normalizeCreditorName(account.creditorName);
      const existing = groups.get(normalizedName) || [];
      groups.set(normalizedName, [...existing, account]);
    }

    // Convert to array and sort by creditor name
    return Array.from(groups.entries())
      .map(([name, accts]) => ({
        creditorName: name,
        displayName: accts[0].creditorName, // Use first account's original name
        accounts: accts,
        totalBalance: accts.reduce((sum, a) => sum + (a.balance || 0), 0),
        totalIssues: accts.reduce((sum, a) => sum + (a.issueCount || 0), 0),
        cras: [...new Set(accts.map((a) => a.cra))],
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [accounts]);

  // Calculate which accounts have active disputes (SENT status = locked)
  const lockedAccountIds = useMemo(() => {
    const locked = new Set<string>();
    for (const dispute of existingDisputes) {
      if (dispute.status === "SENT" && dispute.items) {
        for (const item of dispute.items) {
          const id = item.accountItemId || item.accountId;
          if (id) locked.add(id);
        }
      }
    }
    return locked;
  }, [existingDisputes]);

  // Calculate CRA status from disputes
  const craStatus = useMemo(
    () => calculateCRAStatus(existingDisputes),
    [existingDisputes]
  );

  // Detect optimal flows for selections
  const detectedFlows = useMemo(
    () => detectFlowsPerCRA(accounts, selections),
    [accounts, selections]
  );

  // Toggle account selection
  const toggleAccount = useCallback((accountId: string, cra: string) => {
    setSelections((prev) => {
      const key = cra as keyof typeof prev;
      const current = prev[key];
      const isSelected = current.includes(accountId);

      return {
        ...prev,
        [key]: isSelected
          ? current.filter((id) => id !== accountId)
          : [...current, accountId],
      };
    });
  }, []);

  // Select all available accounts for a CRA
  const selectAllForCRA = useCallback(
    (cra: string) => {
      const availableIds = accounts
        .filter((a) => a.cra === cra && !lockedAccountIds.has(a.id))
        .map((a) => a.id);

      setSelections((prev) => ({
        ...prev,
        [cra]: availableIds,
      }));
    },
    [accounts, lockedAccountIds]
  );

  // Clear all selections for a CRA
  const clearAllForCRA = useCallback((cra: string) => {
    setSelections((prev) => ({
      ...prev,
      [cra]: [],
    }));
  }, []);

  // Select all available accounts across all CRAs
  const selectAllAvailable = useCallback(() => {
    const newSelections = {
      TRANSUNION: [] as string[],
      EQUIFAX: [] as string[],
      EXPERIAN: [] as string[],
    };

    for (const account of accounts) {
      if (!lockedAccountIds.has(account.id)) {
        const cra = account.cra as keyof typeof newSelections;
        if (newSelections[cra]) {
          newSelections[cra].push(account.id);
        }
      }
    }

    setSelections(newSelections);
  }, [accounts, lockedAccountIds]);

  // Clear all selections
  const clearAllSelections = useCallback(() => {
    setSelections({
      TRANSUNION: [],
      EQUIFAX: [],
      EXPERIAN: [],
    });
  }, []);

  // Create dispute for a single CRA
  const createDisputeForCRA = useCallback(
    async (cra: "TRANSUNION" | "EQUIFAX" | "EXPERIAN") => {
      const accountIds = selections[cra];
      if (accountIds.length === 0) return;

      const flow = detectedFlows[cra] || "ACCURACY";

      setIsCreating(true);
      setCreatingCRA(cra);

      try {
        const res = await fetch("/api/disputes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId,
            cra,
            flow,
            accountIds,
          }),
        });

        if (res.ok) {
          const data = await res.json();

          // Set the generated letter for preview
          setGeneratedLetter({
            disputeId: data.dispute.id,
            content: data.dispute.letterContent,
            cra: data.dispute.cra,
            flow: data.dispute.flow,
            round: data.dispute.round,
            status: data.dispute.status,
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

          // Open the letter modal
          setLetterModalOpen(true);

          // Clear selections for this CRA
          clearAllForCRA(cra);

          toast({
            title: "AMELIA Letter Generated",
            description: `${cra} Round ${data.dispute.round} - ${data.amelia.tone} tone`,
          });

          onDisputeCreated?.();
        } else {
          const error = await res.json();
          toast({
            title: "Failed",
            description: error.error || "Failed to create dispute",
            variant: "destructive",
          });
        }
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to create dispute",
          variant: "destructive",
        });
      } finally {
        setIsCreating(false);
        setCreatingCRA(null);
      }
    },
    [clientId, selections, detectedFlows, clearAllForCRA, onDisputeCreated, toast]
  );

  // Create disputes for all CRAs with selections
  const createAllDisputes = useCallback(async () => {
    const activeCRAs = (["TRANSUNION", "EQUIFAX", "EXPERIAN"] as const).filter(
      (cra) => selections[cra].length > 0
    );

    if (activeCRAs.length === 0) return;

    setIsCreating(true);

    try {
      // Create disputes sequentially to avoid overwhelming the API
      for (const cra of activeCRAs) {
        setCreatingCRA(cra);
        await createDisputeForCRA(cra);
      }

      toast({
        title: "All Disputes Created",
        description: `Created ${activeCRAs.length} dispute${activeCRAs.length !== 1 ? "s" : ""}`,
      });
    } finally {
      setIsCreating(false);
      setCreatingCRA(null);
    }
  }, [selections, createDisputeForCRA, toast]);

  // Launch dispute
  const handleLaunchDispute = async () => {
    if (!generatedLetter?.disputeId) return;

    setLaunching(true);
    try {
      const res = await fetch(`/api/disputes/${generatedLetter.disputeId}/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sentDate: new Date().toISOString(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast({
          title: `Round ${generatedLetter.round} Launched!`,
          description: `${generatedLetter.cra} dispute is now being tracked. 30-day FCRA deadline: ${new Date(data.responseDeadline).toLocaleDateString()}`,
        });

        setLetterModalOpen(false);
        setGeneratedLetter(null);
        onDisputeCreated?.();
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

  // Download letter
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
      }
    } catch {
      toast({ title: "Error", description: "Download failed", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  // Open mail dialog for a dispute
  const openMailDialog = (disputeId: string, cra: string) => {
    setMailDisputeId(disputeId);
    setMailDisputeCRA(cra);
    setMailDialogOpen(true);
  };

  // Toggle creditor expansion
  const toggleCreditorExpanded = (creditorName: string) => {
    setExpandedCreditors((prev) => {
      const next = new Set(prev);
      if (next.has(creditorName)) {
        next.delete(creditorName);
      } else {
        next.add(creditorName);
      }
      return next;
    });
  };

  // Calculate totals
  const totalSelected = Object.values(selections).reduce((sum, arr) => sum + arr.length, 0);
  const totalAvailable = accounts.filter((a) => !lockedAccountIds.has(a.id)).length;

  return (
    <div className="space-y-6">
      {/* CRA Progress Header */}
      <CRAProgressHeader status={craStatus} />

      {/* Account Selection */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardContent className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Accounts to Dispute</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {totalSelected} of {totalAvailable} available selected
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-purple-400 border-purple-500/30 hover:bg-purple-500/10"
                onClick={selectAllAvailable}
                disabled={totalAvailable === 0}
              >
                <CheckSquare className="w-4 h-4 mr-1.5" />
                Select All
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-slate-400 border-slate-600 hover:bg-slate-700/50"
                onClick={clearAllSelections}
                disabled={totalSelected === 0}
              >
                <Square className="w-4 h-4 mr-1.5" />
                Clear All
              </Button>
            </div>
          </div>

          {/* Account Groups */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {accountGroups.map((group) => {
              const isExpanded = expandedCreditors.has(group.creditorName);
              const groupSelectedCount = group.accounts.filter(
                (a) => selections[a.cra as keyof typeof selections]?.includes(a.id)
              ).length;
              const groupAvailableCount = group.accounts.filter(
                (a) => !lockedAccountIds.has(a.id)
              ).length;
              const isFullySelected = groupSelectedCount === groupAvailableCount && groupAvailableCount > 0;
              const isPartiallySelected = groupSelectedCount > 0 && groupSelectedCount < groupAvailableCount;

              return (
                <div
                  key={group.creditorName}
                  className="border border-slate-700/50 rounded-lg overflow-hidden"
                >
                  {/* Group Header */}
                  <div
                    className="flex items-center justify-between p-3 bg-slate-800/50 cursor-pointer hover:bg-slate-700/30 transition-colors"
                    onClick={() => toggleCreditorExpanded(group.creditorName)}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isFullySelected}
                        // @ts-ignore - indeterminate is valid
                        indeterminate={isPartiallySelected}
                        onCheckedChange={(checked) => {
                          // Toggle all accounts in this group
                          for (const account of group.accounts) {
                            if (lockedAccountIds.has(account.id)) continue;

                            const cra = account.cra as keyof typeof selections;
                            if (checked) {
                              if (!selections[cra].includes(account.id)) {
                                toggleAccount(account.id, cra);
                              }
                            } else {
                              if (selections[cra].includes(account.id)) {
                                toggleAccount(account.id, cra);
                              }
                            }
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="data-[state=checked]:bg-purple-600"
                      />
                      <div>
                        <span className="font-medium text-white">{group.displayName}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-400">
                            ${group.totalBalance.toLocaleString()}
                          </span>
                          {group.totalIssues > 0 && (
                            <Badge className="text-[10px] bg-red-500/20 text-red-400">
                              {group.totalIssues} issues
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* CRA Badges */}
                      {group.cras.map((cra) => (
                        <Badge
                          key={cra}
                          className={cn(
                            "text-[10px]",
                            CRA_COLORS[cra as keyof typeof CRA_COLORS]?.bg,
                            CRA_COLORS[cra as keyof typeof CRA_COLORS]?.text
                          )}
                        >
                          {cra.slice(0, 2)}
                        </Badge>
                      ))}
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Account Rows */}
                  {isExpanded && (
                    <div className="border-t border-slate-700/50">
                      {group.accounts.map((account) => {
                        const cra = account.cra as keyof typeof selections;
                        const isSelected = selections[cra]?.includes(account.id);
                        const isLocked = lockedAccountIds.has(account.id);

                        return (
                          <div
                            key={account.id}
                            className={cn(
                              "flex items-center gap-3 px-4 py-2 border-b border-slate-700/30 last:border-b-0 transition-colors",
                              isLocked ? "opacity-50" : "hover:bg-slate-700/20",
                              isSelected && !isLocked && "bg-purple-500/10"
                            )}
                          >
                            {isLocked ? (
                              <Lock className="w-4 h-4 text-slate-500" />
                            ) : (
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleAccount(account.id, cra)}
                                className="data-[state=checked]:bg-purple-600"
                              />
                            )}

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-300 font-mono">
                                  {account.maskedAccountId || "N/A"}
                                </span>
                                <Badge
                                  className={cn(
                                    "text-[10px]",
                                    CRA_COLORS[cra]?.bg,
                                    CRA_COLORS[cra]?.text
                                  )}
                                >
                                  {cra.slice(0, 2)}
                                </Badge>
                              </div>
                              <span className="text-xs text-slate-500">
                                {account.accountType || "Unknown"}
                              </span>
                            </div>

                            <div className="text-right">
                              <span className={cn(
                                "text-sm font-medium",
                                (account.balance || 0) > 0 ? "text-red-400" : "text-emerald-400"
                              )}>
                                ${(account.balance || 0).toLocaleString()}
                              </span>
                              {isLocked && (
                                <div className="flex items-center gap-1 text-[10px] text-amber-500">
                                  <Clock className="w-3 h-3" />
                                  Pending
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {accountGroups.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-slate-400">No negative accounts found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bulk Action Bar */}
      <BulkActionBar
        selections={selections}
        detectedFlows={detectedFlows}
        onCreateDispute={createDisputeForCRA}
        onCreateAll={createAllDisputes}
        isCreating={isCreating}
        creatingCRA={creatingCRA}
      />

      {/* Sent Disputes - Mail Actions */}
      {existingDisputes.filter((d) => d.status === "SENT" || d.status === "RESPONDED").length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-400" />
              Active Disputes
            </h3>
            <div className="space-y-2">
              {existingDisputes
                .filter((d) => d.status === "SENT" || d.status === "RESPONDED")
                .map((dispute) => {
                  const craColor = CRA_COLORS[dispute.cra as keyof typeof CRA_COLORS];
                  return (
                    <div
                      key={dispute.id}
                      className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Badge
                          className={cn(
                            "text-[10px]",
                            craColor?.bg,
                            craColor?.text
                          )}
                        >
                          {dispute.cra}
                        </Badge>
                        <span className="text-sm text-slate-300">
                          Round {dispute.round}
                        </span>
                        <Badge className="text-[10px] bg-purple-500/20 text-purple-400">
                          {dispute.status}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openMailDialog(dispute.id, dispute.cra)}
                        className="gap-1.5 border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        Mail Letter
                      </Button>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Letter Editor Modal */}
      <LetterEditorModal
        open={letterModalOpen}
        onOpenChange={(open) => {
          setLetterModalOpen(open);
          if (!open) setGeneratedLetter(null);
        }}
        generatedLetter={generatedLetter}
        onLaunch={handleLaunchDispute}
        launching={launching}
        onDownload={handleDownloadLetter}
        downloading={downloading}
      />

      {/* Mail Send Dialog */}
      {mailDisputeId && (
        <MailSendDialog
          open={mailDialogOpen}
          onOpenChange={setMailDialogOpen}
          disputeId={mailDisputeId}
          disputeType="DISPUTE"
          clientName={clientName || "Client"}
          cra={mailDisputeCRA}
          onSuccess={() => {
            onDisputeCreated?.();
          }}
        />
      )}
    </div>
  );
}

// Helper function to normalize creditor names for grouping
function normalizeCreditorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}
