"use client";

import { useState } from "react";
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
} from "lucide-react";
import { useToast } from "@/lib/use-toast";
import { CRA_COLORS, type ParsedAccountWithIssues, type CFPBComplaint } from "./types";

interface CFPBViewProps {
  accounts: ParsedAccountWithIssues[];
  selectedCRA: string;
  onSelectCRA: (cra: string) => void;
  clientName?: string;
}

const CRAS = ["TRANSUNION", "EXPERIAN", "EQUIFAX"] as const;

export function CFPBView({ accounts, selectedCRA, onSelectCRA, clientName }: CFPBViewProps) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [complaint, setComplaint] = useState<CFPBComplaint | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const selectedAccountDetails = accounts.filter((a) => selectedAccounts.includes(a.id));

  const generateComplaint = async () => {
    if (selectedAccounts.length === 0) {
      toast({ title: "Select Accounts", description: "Please select at least one account to include in the complaint", variant: "destructive" });
      return;
    }

    setGenerating(true);
    try {
      // In production, this would call the CFPB API
      // For now, generate a structured complaint
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const companyName = selectedCRA === "TRANSUNION" ? "TransUnion" :
                         selectedCRA === "EXPERIAN" ? "Experian" : "Equifax Information Services LLC";

      const accountList = selectedAccountDetails.map((acc, i) =>
        `${i + 1}. ${acc.creditorName} - Account #${acc.maskedAccountId || "N/A"}\n   Issue: ${acc.detectedIssues?.[0]?.description || "Inaccurate information"}`
      ).join("\n\n");

      setComplaint({
        product: "Credit reporting or other personal consumer reports",
        subProduct: "Credit reporting",
        issue: "Problem with a credit reporting company's investigation into an existing problem",
        subIssue: "Their investigation did not fix an error on your report",
        companyName,
        narrative: `I am filing this complaint because ${companyName} has failed to properly investigate my dispute regarding inaccurate information on my credit report.

I submitted a formal dispute letter via certified mail regarding the following accounts that are reporting inaccurately:

${accountList}

Despite my detailed dispute with supporting documentation, ${companyName} has:
- Failed to conduct a reasonable investigation as required under 15 U.S.C. § 1681i(a)(1)
- Not provided the method of verification as required under 15 U.S.C. § 1681i(a)(6)
- Continued to report information they cannot verify

This inaccurate reporting has caused me significant harm including denial of credit applications and higher interest rates on approved credit.`,
        desiredResolution: `I request that the CFPB:
1. Require ${companyName} to conduct a proper investigation
2. Require ${companyName} to provide the method of verification
3. If they cannot verify, require deletion of the disputed items
4. Investigate ${companyName}'s compliance procedures`,
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
            <h2 className="text-lg font-bold text-white">CFPB Complaint Generator</h2>
            <p className="text-xs text-slate-400">Consumer Financial Protection Bureau</p>
          </div>
        </div>

        {/* Info Cards */}
        <Card className="bg-slate-800/60 border-slate-700/50 p-4 space-y-3">
          <div className="flex items-start gap-3 text-sm text-slate-300">
            <Clock className="w-5 h-5 text-blue-400 flex-shrink-0" />
            <div>
              <strong className="block text-white">15-Day Response</strong>
              <span className="text-slate-400">Companies must respond within 15 days</span>
            </div>
          </div>
          <div className="flex items-start gap-3 text-sm text-slate-300">
            <BarChart3 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <strong className="block text-white">97% Response Rate</strong>
              <span className="text-slate-400">Companies respond to almost all complaints</span>
            </div>
          </div>
          <div className="flex items-start gap-3 text-sm text-slate-300">
            <Search className="w-5 h-5 text-purple-400 flex-shrink-0" />
            <div>
              <strong className="block text-white">Public Database</strong>
              <span className="text-slate-400">Complaints are tracked and published</span>
            </div>
          </div>
        </Card>

        {/* CRA Selection */}
        <Card className="bg-slate-800/60 border-slate-700/50 p-4">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
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
                      : "bg-slate-700/30 border-slate-600/50 text-slate-400 hover:border-slate-500/50"
                  )}
                >
                  {cra}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Account Selection */}
        <Card className="bg-slate-800/60 border-slate-700/50 p-4">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Accounts to Include
          </h3>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {accounts.slice(0, 5).map((acc) => (
              <label
                key={acc.id}
                className={cn(
                  "flex items-start gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all",
                  selectedAccounts.includes(acc.id)
                    ? "bg-purple-500/15"
                    : "bg-slate-700/30 hover:bg-slate-700/50"
                )}
              >
                <Checkbox
                  checked={selectedAccounts.includes(acc.id)}
                  onCheckedChange={() => toggleAccount(acc.id)}
                  className="mt-0.5 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                />
                <div className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-white truncate">
                    {acc.creditorName}
                  </span>
                  <span className="block text-xs text-slate-500 truncate">
                    {acc.detectedIssues?.[0]?.description || "No issues detected"}
                  </span>
                </div>
              </label>
            ))}
            {accounts.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">
                No accounts available
              </p>
            )}
          </div>
        </Card>

        {/* Generate Button */}
        <Button
          className="w-full bg-gradient-to-r from-blue-700 to-blue-500 hover:from-blue-600 hover:to-blue-400 text-white py-3"
          onClick={generateComplaint}
          disabled={generating || selectedAccounts.length === 0}
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
      <Card className="bg-slate-800/60 border-slate-700/50 p-6 overflow-y-auto">
        {!complaint ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <span className="text-5xl opacity-50 mb-4">📋</span>
            <h3 className="text-lg font-semibold text-white mb-2">No Complaint Generated</h3>
            <p className="text-sm text-slate-500 max-w-xs">
              Select accounts and click generate to preview your CFPB complaint
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Preview Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Complaint Preview</h3>
              <Button
                size="sm"
                variant="ghost"
                className="text-slate-400 hover:text-white"
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

            {/* Fields */}
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wide">Product</label>
                <div className="mt-1 p-3 rounded-lg bg-slate-700/30 text-sm text-white">
                  {complaint.product}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wide">Sub-product</label>
                <div className="mt-1 p-3 rounded-lg bg-slate-700/30 text-sm text-white">
                  {complaint.subProduct}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wide">Issue</label>
                <div className="mt-1 p-3 rounded-lg bg-slate-700/30 text-sm text-white">
                  {complaint.issue}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wide">Sub-issue</label>
                <div className="mt-1 p-3 rounded-lg bg-slate-700/30 text-sm text-white">
                  {complaint.subIssue}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wide">Company</label>
                <div className="mt-1 p-3 rounded-lg bg-slate-700/30 text-sm text-white">
                  {complaint.companyName}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wide">What Happened (Narrative)</label>
                <div className="mt-1 p-3 rounded-lg bg-slate-700/30 text-sm text-white whitespace-pre-wrap max-h-[200px] overflow-y-auto leading-relaxed">
                  {complaint.narrative}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wide">Desired Resolution</label>
                <div className="mt-1 p-3 rounded-lg bg-slate-700/30 text-sm text-white whitespace-pre-wrap leading-relaxed">
                  {complaint.desiredResolution}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-slate-700">
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
                className="flex-1 border-slate-600 text-white hover:bg-slate-700"
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
