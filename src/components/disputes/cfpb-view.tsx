"use client";

import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  Copy,
  CheckCircle,
  ExternalLink,
  Clock,
  BarChart3,
  Search,
  FileText,
  Building2,
  AlertTriangle,
  Timer,
  Send,
  User,
  MapPin,
  Eye,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/lib/use-toast";
import { CRA_COLORS, type ParsedAccountWithIssues, type CFPBComplaint } from "./types";

// Dispute history for an account
interface AccountDisputeHistory {
  disputeId: string;
  cra: string;
  flow: string;
  round: number;
  status: string;
  sentDate?: string;
  disputeReason?: string;
  daysRemaining?: number;
  isOverdue?: boolean;
}

// Enhanced account with dispute history
interface AccountWithHistory extends ParsedAccountWithIssues {
  disputeHistory: AccountDisputeHistory[];
}

// Reusable field component with copy button
interface CopyableFieldProps {
  label: string;
  value: string;
  isLarge?: boolean;
  onCopy: (text: string, label: string) => void;
}

function CopyableField({ label, value, isLarge, onCopy }: CopyableFieldProps) {
  const [justCopied, setJustCopied] = useState(false);

  const handleCopy = () => {
    onCopy(value, label);
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 1500);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-muted-foreground uppercase tracking-wide">{label}</label>
        <button
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-all",
            justCopied
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-muted text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {justCopied ? (
            <>
              <CheckCircle className="w-3 h-3" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              Copy
            </>
          )}
        </button>
      </div>
      <div
        className={cn(
          "p-3 rounded-lg bg-muted text-sm text-foreground",
          isLarge && "whitespace-pre-wrap max-h-[200px] overflow-y-auto leading-relaxed"
        )}
      >
        {value}
      </div>
    </div>
  );
}

interface HardInquiry {
  id: string;
  creditorName: string;
  inquiryDate: string;
  bureau?: string;
}

interface PersonalInfo {
  previousNames?: string[];
  previousAddresses?: string[];
}

interface CFPBViewProps {
  accounts: ParsedAccountWithIssues[];
  selectedCRA: string;
  onSelectCRA: (cra: string) => void;
  clientName?: string;
  clientId?: string;
  hardInquiries?: HardInquiry[];
  personalInfo?: PersonalInfo;
}

const CRAS = ["TRANSUNION", "EXPERIAN", "EQUIFAX"] as const;

// Helper to calculate FCRA deadline days
const getFCRADaysRemaining = (sentDate?: string) => {
  if (!sentDate) return null;
  const sent = new Date(sentDate);
  const deadline = new Date(sent.getTime() + 30 * 24 * 60 * 60 * 1000);
  return Math.ceil((deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
};

export function CFPBView({
  accounts,
  selectedCRA,
  onSelectCRA,
  clientName,
  clientId,
  hardInquiries = [],
  personalInfo,
}: CFPBViewProps) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [complaint, setComplaint] = useState<CFPBComplaint | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedInquiries, setSelectedInquiries] = useState<string[]>([]);
  const [selectedPersonalItems, setSelectedPersonalItems] = useState<{
    names: string[];
    addresses: string[];
  }>({ names: [], addresses: [] });
  const [copied, setCopied] = useState(false);
  const [accountsWithHistory, setAccountsWithHistory] = useState<AccountWithHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeItemTab, setActiveItemTab] = useState<"accounts" | "inquiries" | "personal">("accounts");

  // Fetch dispute history for accounts
  useEffect(() => {
    if (!clientId || accounts.length === 0) {
      setAccountsWithHistory(accounts.map(a => ({ ...a, disputeHistory: [] })));
      return;
    }

    setLoadingHistory(true);
    fetch(`/api/disputes?clientId=${clientId}`)
      .then(r => r.ok ? r.json() : [])
      .then((disputes: Array<{
        id: string;
        cra: string;
        flow: string;
        round: number;
        status: string;
        sentDate?: string;
        items?: Array<{
          accountItemId: string;
          disputeReason?: string;
        }>;
      }>) => {
        // Build a map of accountId -> dispute history
        const historyMap = new Map<string, AccountDisputeHistory[]>();

        for (const dispute of disputes) {
          if (!dispute.items) continue;

          for (const item of dispute.items) {
            const accountId = item.accountItemId;
            if (!historyMap.has(accountId)) {
              historyMap.set(accountId, []);
            }

            const daysRemaining = getFCRADaysRemaining(dispute.sentDate);

            historyMap.get(accountId)!.push({
              disputeId: dispute.id,
              cra: dispute.cra,
              flow: dispute.flow,
              round: dispute.round,
              status: dispute.status,
              sentDate: dispute.sentDate,
              disputeReason: item.disputeReason,
              daysRemaining: daysRemaining ?? undefined,
              isOverdue: daysRemaining !== null && daysRemaining < 0,
            });
          }
        }

        // Merge history with accounts
        const enhanced = accounts.map(acc => ({
          ...acc,
          disputeHistory: historyMap.get(acc.id) || [],
        }));

        setAccountsWithHistory(enhanced);
      })
      .catch(() => {
        setAccountsWithHistory(accounts.map(a => ({ ...a, disputeHistory: [] })));
      })
      .finally(() => setLoadingHistory(false));
  }, [clientId, accounts]);

  const selectedAccountDetails = accountsWithHistory.filter((a) => selectedAccounts.includes(a.id));

  const generateComplaint = async () => {
    const hasAccounts = selectedAccounts.length > 0;
    const hasInquiries = selectedInquiries.length > 0;
    const hasPersonalItems = selectedPersonalItems.names.length > 0 || selectedPersonalItems.addresses.length > 0;

    if (!hasAccounts && !hasInquiries && !hasPersonalItems) {
      toast({ title: "Select Items", description: "Please select at least one item to include in the complaint", variant: "destructive" });
      return;
    }

    setGenerating(true);
    try {
      // Generate complaint with dispute history context
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const companyName = selectedCRA === "TRANSUNION" ? "TransUnion" :
                         selectedCRA === "EXPERIAN" ? "Experian" : "Equifax Information Services LLC";

      // Build detailed account list - NEVER include internal workflow info (Round, Flow, Status)
      // CFPB complaints should only contain consumer-relevant information
      const accountList = selectedAccountDetails.map((acc, i) => {
        // Find disputes for this CRA to check for FCRA violations
        const craDisputes = acc.disputeHistory.filter(d => d.cra === selectedCRA);
        const latestDispute = craDisputes.sort((a, b) => b.round - a.round)[0];

        let disputeContext = "";
        if (latestDispute) {
          // Only include dispute sent date if actually sent - NO internal status info
          if (latestDispute.sentDate) {
            const sentDate = new Date(latestDispute.sentDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
            disputeContext = `\n   Previously disputed: ${sentDate}`;
          }

          // Only mention FCRA violation if overdue - this is legally relevant
          if (latestDispute.isOverdue && latestDispute.daysRemaining !== undefined) {
            disputeContext += `\n   Bureau response: OVERDUE by ${Math.abs(latestDispute.daysRemaining)} days (FCRA 30-day violation)`;
          }
        }

        return `${i + 1}. ${acc.creditorName} - Account #${acc.maskedAccountId || "N/A"}
   Issue: ${acc.detectedIssues?.[0]?.description || "Inaccurate information"}${disputeContext}`;
      }).join("\n\n");

      // Check for FCRA violations (overdue responses)
      const overdueDisputes = selectedAccountDetails.flatMap(acc =>
        acc.disputeHistory.filter(d => d.cra === selectedCRA && d.isOverdue)
      );
      const hasOverdue = overdueDisputes.length > 0;

      // Find earliest dispute date for this CRA
      const allCRADisputes = selectedAccountDetails.flatMap(acc =>
        acc.disputeHistory.filter(d => d.cra === selectedCRA && d.sentDate)
      );
      const earliestDispute = allCRADisputes.sort((a, b) =>
        new Date(a.sentDate!).getTime() - new Date(b.sentDate!).getTime()
      )[0];

      const firstDisputeDate = earliestDispute?.sentDate
        ? new Date(earliestDispute.sentDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
        : "recently";

      // Build inquiry list if any selected
      const selectedInquiryDetails = hardInquiries.filter(inq => selectedInquiries.includes(inq.id));
      const inquiryList = selectedInquiryDetails.length > 0
        ? selectedInquiryDetails.map((inq, i) => {
            const inquiryDate = new Date(inq.inquiryDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
            return `${i + 1}. ${inq.creditorName} - Inquiry Date: ${inquiryDate}
   Issue: Unauthorized hard inquiry - I did not provide written consent for this credit pull`;
          }).join("\n\n")
        : "";

      // Build personal info list if any selected
      const personalInfoItems: string[] = [];
      if (selectedPersonalItems.names.length > 0) {
        personalInfoItems.push(...selectedPersonalItems.names.map((name, i) =>
          `${i + 1}. Previous Name: "${name}" - This name variation is inaccurate and should be removed`
        ));
      }
      if (selectedPersonalItems.addresses.length > 0) {
        const offset = selectedPersonalItems.names.length;
        personalInfoItems.push(...selectedPersonalItems.addresses.map((addr, i) =>
          `${offset + i + 1}. Previous Address: "${addr}" - This address is inaccurate and should be removed`
        ));
      }
      const personalInfoList = personalInfoItems.join("\n\n");

      // Generate contextual narrative
      let narrative = `I am filing this complaint because ${companyName} has failed to properly investigate my dispute regarding inaccurate information on my credit report.\n\n`;

      if (hasAccounts && accountList) {
        narrative += `I first submitted a formal dispute letter via certified mail on ${firstDisputeDate} regarding the following accounts that are reporting inaccurately:\n\n${accountList}\n\n`;
      }

      if (hasInquiries && inquiryList) {
        narrative += `UNAUTHORIZED HARD INQUIRIES:

The following hard inquiries appear on my credit report without my written consent as required under 15 U.S.C. § 1681b(c)(1) and the FCRA's permissible purpose requirements:

${inquiryList}

Under the Fair Credit Reporting Act, a creditor must have a permissible purpose AND written consent to pull my credit. I did not apply for credit with these companies and did not provide written authorization for these inquiries.

`;
      }

      if (hasPersonalItems && personalInfoList) {
        narrative += `INACCURATE PERSONAL INFORMATION:

The following personal information is being reported inaccurately on my credit file and needs to be corrected or removed:

${personalInfoList}

Under 15 U.S.C. § 1681e(b), ${companyName} is required to follow reasonable procedures to assure maximum possible accuracy of the information concerning the individual. This outdated/inaccurate personal information does not meet this standard.

`;
      }

      if (hasOverdue) {
        narrative += `CRITICAL: ${companyName} has VIOLATED the Fair Credit Reporting Act by failing to complete their investigation within the legally mandated 30-day period. This is a clear violation of 15 U.S.C. § 1681i(a)(1).

`;
      }

      narrative += `Despite my detailed dispute with supporting documentation, ${companyName} has:
- Failed to conduct a reasonable investigation as required by federal law
- Not provided proof of how they verified this information
- Continued to report information they cannot verify
${hasOverdue ? "- EXCEEDED the 30-day response deadline mandated by the FCRA" : ""}

This inaccurate reporting has caused me significant harm including denial of credit applications and higher interest rates on approved credit.`;

      setComplaint({
        product: "Credit reporting or other personal consumer reports",
        subProduct: "Credit reporting",
        issue: hasOverdue
          ? "Problem with a credit reporting company's investigation into an existing problem"
          : "Problem with a credit reporting company's investigation into an existing problem",
        subIssue: hasOverdue
          ? "Investigation took more than 30 days"
          : "Their investigation did not fix an error on your report",
        companyName,
        narrative,
        desiredResolution: `I request that the CFPB:
1. Require ${companyName} to conduct a proper investigation
2. Require ${companyName} to provide the method of verification
3. If they cannot verify, require deletion of the disputed items
4. Investigate ${companyName}'s compliance procedures${hasOverdue ? `
5. Document this FCRA timing violation in ${companyName}'s compliance record` : ""}`,
      });
    } catch {
      toast({ title: "Error", description: "Failed to generate complaint", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    if (!complaint) return;

    const text = `CFPB COMPLAINT

Product: ${complaint.product}
Sub-product: ${complaint.subProduct}
Issue: ${complaint.issue}
Sub-issue: ${complaint.subIssue}
Company: ${complaint.companyName}

WHAT HAPPENED:
${complaint.narrative}

DESIRED RESOLUTION:
${complaint.desiredResolution}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: "Copied!", description: "Complaint copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Error", description: "Failed to copy to clipboard", variant: "destructive" });
    }
  };

  const toggleAccount = (id: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleInquiry = (id: string) => {
    setSelectedInquiries((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const togglePersonalName = (name: string) => {
    setSelectedPersonalItems((prev) => ({
      ...prev,
      names: prev.names.includes(name)
        ? prev.names.filter((x) => x !== name)
        : [...prev.names, name],
    }));
  };

  const togglePersonalAddress = (address: string) => {
    setSelectedPersonalItems((prev) => ({
      ...prev,
      addresses: prev.addresses.includes(address)
        ? prev.addresses.filter((x) => x !== address)
        : [...prev.addresses, address],
    }));
  };

  // Handler for copying individual fields
  const handleFieldCopy = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied!", description: `${label} copied to clipboard` });
    } catch {
      toast({ title: "Error", description: "Failed to copy to clipboard", variant: "destructive" });
    }
  }, [toast]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6 min-h-[600px]">
      {/* Left Side - Configuration */}
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-700 to-blue-500 flex items-center justify-center text-2xl">
            🏛️
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">CFPB Complaint Generator</h2>
            <p className="text-xs text-muted-foreground">Consumer Financial Protection Bureau</p>
          </div>
        </div>

        {/* Info Cards */}
        <Card className="bg-card border-border p-4 space-y-3">
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <Clock className="w-5 h-5 text-primary flex-shrink-0" />
            <div>
              <strong className="block text-foreground">15-Day Response</strong>
              <span className="text-muted-foreground">Companies must respond within 15 days</span>
            </div>
          </div>
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <BarChart3 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <strong className="block text-foreground">97% Response Rate</strong>
              <span className="text-muted-foreground">Companies respond to almost all complaints</span>
            </div>
          </div>
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <Search className="w-5 h-5 text-purple-400 flex-shrink-0" />
            <div>
              <strong className="block text-foreground">Public Database</strong>
              <span className="text-muted-foreground">Complaints are tracked and published</span>
            </div>
          </div>
        </Card>

        {/* CRA Selection */}
        <Card className="bg-card border-border p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Target Bureau
          </h3>
          <div className="flex gap-2">
            {CRAS.map((cra) => {
              const isSelected = selectedCRA === cra;
              const colors = CRA_COLORS[cra];
              return (
                <button
                  key={cra}
                  onClick={() => onSelectCRA(cra)}
                  className={cn(
                    "flex-1 px-3 py-2.5 rounded-lg border text-xs font-semibold transition-all",
                    isSelected
                      ? colors.tailwind
                      : "bg-muted border-input text-muted-foreground hover:border-border"
                  )}
                >
                  {cra}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Item Selection with Tabs */}
        <Card className="bg-card border-border p-4">
          <Tabs value={activeItemTab} onValueChange={(v) => setActiveItemTab(v as typeof activeItemTab)}>
            <TabsList className="bg-muted w-full justify-start mb-3">
              <TabsTrigger value="accounts" className="text-xs flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Accounts
                {selectedAccounts.length > 0 && (
                  <Badge className="ml-1 text-[10px] h-4 px-1 bg-purple-500/30 text-purple-300">{selectedAccounts.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="inquiries" className="text-xs flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                Inquiries
                {selectedInquiries.length > 0 && (
                  <Badge className="ml-1 text-[10px] h-4 px-1 bg-purple-500/30 text-purple-300">{selectedInquiries.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="personal" className="text-xs flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                Personal Info
                {(selectedPersonalItems.names.length + selectedPersonalItems.addresses.length) > 0 && (
                  <Badge className="ml-1 text-[10px] h-4 px-1 bg-purple-500/30 text-purple-300">
                    {selectedPersonalItems.names.length + selectedPersonalItems.addresses.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Accounts Tab */}
            <TabsContent value="accounts" className="mt-0">
              {loadingHistory && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Loading dispute history...
                </div>
              )}
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {accountsWithHistory.map((acc) => {
              // Get disputes for selected CRA
              const craDisputes = acc.disputeHistory.filter(d => d.cra === selectedCRA);
              const hasDisputes = craDisputes.length > 0;
              const latestDispute = craDisputes.sort((a, b) => b.round - a.round)[0];
              const isOverdue = latestDispute?.isOverdue;
              const isInActiveDispute = latestDispute && (latestDispute.status === "SENT" || latestDispute.status === "DRAFT");

              return (
                <label
                  key={acc.id}
                  className={cn(
                    "block p-3 rounded-lg cursor-pointer transition-all",
                    selectedAccounts.includes(acc.id)
                      ? "bg-purple-500/15 ring-1 ring-purple-500/30"
                      : isInActiveDispute
                        ? "bg-amber-500/5 border-l-2 border-l-amber-500 hover:bg-amber-500/10"
                        : "bg-muted hover:bg-muted"
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <Checkbox
                      checked={selectedAccounts.includes(acc.id)}
                      onCheckedChange={() => toggleAccount(acc.id)}
                      className="mt-0.5 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-foreground truncate">
                        {acc.creditorName}
                      </span>
                      {isInActiveDispute && (
                        <Badge className="ml-2 text-[10px] px-1.5 bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          IN DISPUTE R{latestDispute.round}
                        </Badge>
                      )}
                      <span className="block text-xs text-muted-foreground truncate">
                        {acc.detectedIssues?.[0]?.description || "No issues detected"}
                      </span>

                      {/* Dispute History for this CRA */}
                      {hasDisputes && (
                        <div className="mt-2 pt-2 border-t border-input">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge
                              className={cn(
                                "text-[10px] px-1.5",
                                CRA_COLORS[selectedCRA]?.tailwind || "bg-muted text-muted-foreground"
                              )}
                            >
                              {selectedCRA.slice(0, 2)}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              R{latestDispute.round}
                            </span>
                            <Badge className="text-[10px] px-1.5 bg-muted text-muted-foreground">
                              {latestDispute.flow}
                            </Badge>
                            <Badge
                              className={cn(
                                "text-[10px] px-1.5",
                                latestDispute.status === "SENT" && "bg-primary/20 text-primary",
                                latestDispute.status === "DRAFT" && "bg-amber-500/20 text-amber-400",
                                latestDispute.status === "RESPONDED" && "bg-purple-500/20 text-purple-400",
                                latestDispute.status === "RESOLVED" && "bg-emerald-500/20 text-emerald-400"
                              )}
                            >
                              {latestDispute.status}
                            </Badge>
                          </div>

                          {/* FCRA Deadline Status */}
                          {latestDispute.status === "SENT" && latestDispute.daysRemaining !== undefined && (
                            <div className={cn(
                              "flex items-center gap-1.5 mt-1.5 text-[10px]",
                              isOverdue ? "text-red-400" : latestDispute.daysRemaining <= 7 ? "text-amber-400" : "text-emerald-400"
                            )}>
                              {isOverdue ? (
                                <>
                                  <AlertTriangle className="w-3 h-3" />
                                  <span className="font-medium">OVERDUE by {Math.abs(latestDispute.daysRemaining)}d - FCRA Violation!</span>
                                </>
                              ) : (
                                <>
                                  <Timer className="w-3 h-3" />
                                  <span>{latestDispute.daysRemaining}d remaining</span>
                                </>
                              )}
                            </div>
                          )}

                          {/* Sent Date */}
                          {latestDispute.sentDate && (
                            <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                              <Send className="w-2.5 h-2.5" />
                              <span>
                                Sent {new Date(latestDispute.sentDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* No disputes yet indicator */}
                      {!hasDisputes && acc.disputeHistory.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-input">
                          <span className="text-[10px] text-muted-foreground">
                            Not disputed with {selectedCRA} yet
                          </span>
                          {/* Show other CRAs this was disputed with */}
                          <div className="flex gap-1 mt-1">
                            {[...new Set(acc.disputeHistory.map(d => d.cra))].map(cra => (
                              <Badge
                                key={cra}
                                className={cn(
                                  "text-[9px] px-1",
                                  CRA_COLORS[cra]?.tailwind || "bg-muted text-muted-foreground"
                                )}
                              >
                                {cra.slice(0, 2)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </label>
              );
            })}
              {accountsWithHistory.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No accounts available
                </p>
              )}
              </div>
            </TabsContent>

            {/* Inquiries Tab */}
            <TabsContent value="inquiries" className="mt-0">
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {hardInquiries.length > 0 ? (
                  hardInquiries.map((inquiry) => (
                    <label
                      key={inquiry.id}
                      className={cn(
                        "block p-3 rounded-lg cursor-pointer transition-all",
                        selectedInquiries.includes(inquiry.id)
                          ? "bg-purple-500/15 ring-1 ring-purple-500/30"
                          : "bg-muted hover:bg-muted"
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <Checkbox
                          checked={selectedInquiries.includes(inquiry.id)}
                          onCheckedChange={() => toggleInquiry(inquiry.id)}
                          className="mt-0.5 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-foreground truncate">
                            {inquiry.creditorName}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            Inquiry Date: {new Date(inquiry.inquiryDate).toLocaleDateString()}
                          </span>
                          {inquiry.bureau && (
                            <Badge className="mt-1 text-[10px] px-1.5 bg-muted text-muted-foreground">
                              {inquiry.bureau}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hard inquiries found
                  </p>
                )}
              </div>
            </TabsContent>

            {/* Personal Info Tab */}
            <TabsContent value="personal" className="mt-0">
              <div className="space-y-4 max-h-[300px] overflow-y-auto">
                {/* Previous Names */}
                {personalInfo?.previousNames && personalInfo.previousNames.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      Previous Names
                    </h4>
                    <div className="space-y-2">
                      {personalInfo.previousNames.map((name, idx) => (
                        <label
                          key={`name-${idx}`}
                          className={cn(
                            "block p-3 rounded-lg cursor-pointer transition-all",
                            selectedPersonalItems.names.includes(name)
                              ? "bg-purple-500/15 ring-1 ring-purple-500/30"
                              : "bg-muted hover:bg-muted"
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <Checkbox
                              checked={selectedPersonalItems.names.includes(name)}
                              onCheckedChange={() => togglePersonalName(name)}
                              className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                            />
                            <span className="text-sm text-foreground">{name}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Previous Addresses */}
                {personalInfo?.previousAddresses && personalInfo.previousAddresses.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      Previous Addresses
                    </h4>
                    <div className="space-y-2">
                      {personalInfo.previousAddresses.map((address, idx) => (
                        <label
                          key={`addr-${idx}`}
                          className={cn(
                            "block p-3 rounded-lg cursor-pointer transition-all",
                            selectedPersonalItems.addresses.includes(address)
                              ? "bg-purple-500/15 ring-1 ring-purple-500/30"
                              : "bg-muted hover:bg-muted"
                          )}
                        >
                          <div className="flex items-start gap-2.5">
                            <Checkbox
                              checked={selectedPersonalItems.addresses.includes(address)}
                              onCheckedChange={() => togglePersonalAddress(address)}
                              className="mt-0.5 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                            />
                            <span className="text-sm text-foreground">{address}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {(!personalInfo?.previousNames?.length && !personalInfo?.previousAddresses?.length) && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No personal information to dispute
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </Card>

        {/* Generate Button */}
        <Button
          className="w-full bg-gradient-to-r from-blue-700 to-blue-500 hover:from-blue-600 hover:to-blue-400 text-white py-3"
          onClick={generateComplaint}
          disabled={generating || (selectedAccounts.length === 0 && selectedInquiries.length === 0 && selectedPersonalItems.names.length === 0 && selectedPersonalItems.addresses.length === 0)}
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating Complaint...
            </>
          ) : (
            <>
              📝 Generate CFPB Complaint
            </>
          )}
        </Button>
      </div>

      {/* Right Side - Preview */}
      <Card className="bg-card border-border p-6 overflow-y-auto">
        {!complaint ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <span className="text-5xl opacity-50 mb-4">📋</span>
            <h3 className="text-lg font-semibold text-foreground mb-2">No Complaint Generated</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Select accounts and click generate to preview your CFPB complaint
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Preview Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Complaint Preview</h3>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
                onClick={copyToClipboard}
              >
                {copied ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-1 text-emerald-400" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy All
                  </>
                )}
              </Button>
            </div>

            {/* Fields - Each with individual copy button */}
            <div className="space-y-4">
              <CopyableField
                label="Product"
                value={complaint.product}
                onCopy={handleFieldCopy}
              />

              <CopyableField
                label="Sub-product"
                value={complaint.subProduct}
                onCopy={handleFieldCopy}
              />

              <CopyableField
                label="Issue"
                value={complaint.issue}
                onCopy={handleFieldCopy}
              />

              <CopyableField
                label="Sub-issue"
                value={complaint.subIssue}
                onCopy={handleFieldCopy}
              />

              <CopyableField
                label="Company"
                value={complaint.companyName}
                onCopy={handleFieldCopy}
              />

              <CopyableField
                label="What Happened (Narrative)"
                value={complaint.narrative}
                isLarge
                onCopy={handleFieldCopy}
              />

              <CopyableField
                label="Desired Resolution"
                value={complaint.desiredResolution}
                isLarge
                onCopy={handleFieldCopy}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-border">
              <a
                href="https://www.consumerfinance.gov/complaint/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  File at CFPB.gov
                </Button>
              </a>
              <Button
                variant="outline"
                className="flex-1 border-input text-foreground hover:bg-muted"
              >
                💾 Save Draft
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
