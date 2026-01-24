"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  Save,
  ExternalLink,
  Copy,
  RefreshCw,
  History,
  FileText,
  User,
  Calendar,
  Clock,
  HelpCircle,
  CheckCircle,
  Sparkles,
} from "lucide-react";

// CFPB Product categories
const PRODUCTS = [
  { value: "credit_reporting", label: "Credit reporting or other personal cons" },
  { value: "debt_collection", label: "Debt collection" },
  { value: "credit_card", label: "Credit card or prepaid card" },
  { value: "mortgage", label: "Mortgage" },
];

// CFPB Companies
const COMPANIES = [
  { value: "transunion", label: "TransUnion" },
  { value: "experian", label: "Experian" },
  { value: "equifax", label: "Equifax" },
];

// Issues for credit reporting
const ISSUES = [
  { value: "improper_use", label: "Improper use of your report" },
  { value: "incorrect_info", label: "Incorrect information on your report" },
  { value: "problem_with_investigation", label: "Problem with investigation" },
  { value: "unable_to_get_report", label: "Unable to get your credit report" },
];

// Sub-issues
const SUB_ISSUES = [
  { value: "reporting_company_used", label: "Reporting company used your report in" },
  { value: "credit_inquiries", label: "Credit inquiries on your report" },
  { value: "personal_info_incorrect", label: "Personal information incorrect" },
];

// Narrative tones
const TONES = [
  { id: "assertive", label: "Assertive", description: "Direct and demanding" },
  { id: "formal", label: "Formal", description: "Professional and measured" },
  { id: "emotional", label: "Emotional", description: "Personal impact focus" },
  { id: "legal", label: "Legal-Heavy", description: "Statute-focused" },
];

interface DisputedAccount {
  creditorName: string;
  accountNumber: string;
  balance?: number;
  status?: string;
}

interface CFPBGeneratorProps {
  clientName: string;
  bureau: "TransUnion" | "Experian" | "Equifax";
  disputeDate: Date;
  disputedAccounts: DisputedAccount[];
  onBack?: () => void;
  onSaveDraft?: (narrative: string) => void;
}

export function CFPBGenerator({
  clientName,
  bureau,
  disputeDate,
  disputedAccounts,
  onBack,
  onSaveDraft,
}: CFPBGeneratorProps) {
  const [product, setProduct] = useState("credit_reporting");
  const [company, setCompany] = useState(bureau.toLowerCase());
  const [issue, setIssue] = useState("improper_use");
  const [subIssue, setSubIssue] = useState("reporting_company_used");
  const [selectedTone, setSelectedTone] = useState("assertive");
  const [activeTab, setActiveTab] = useState<"preview" | "edit" | "tips">("preview");
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Calculate days elapsed
  const daysElapsed = Math.floor((Date.now() - disputeDate.getTime()) / (1000 * 60 * 60 * 24));

  // Generate narrative based on tone
  const generateNarrative = (tone: string): string => {
    const account = disputedAccounts[0];
    const accountInfo = account ? `\n\n1. ${account.creditorName}\n   Account #: ${account.accountNumber}\n   Balance: $${account.balance?.toLocaleString() || "N/A"}\n   Status: ${account.status || "Collection"}` : "";

    const toneVariations: Record<string, string> = {
      assertive: `I've been trying to remain patient, but I'm getting worried. We've been going back and forth for over ${daysElapsed} days now.

I initially disputed the following accounts on ${disputeDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}:${accountInfo}

Issue: This account is reporting inaccurately and I have demanded verification.

Despite multiple requests, ${bureau} has failed to provide the method of verification used during their so-called "investigation." This is a clear violation of my rights under the Fair Credit Reporting Act.

I expect immediate action on this matter.`,

      formal: `This complaint concerns an ongoing dispute with ${bureau} regarding credit reporting accuracy.

On ${disputeDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}, I submitted a formal dispute regarding the following account:${accountInfo}

Despite the passage of ${daysElapsed} days and multiple written requests, the credit reporting agency has not provided adequate verification of the disputed information as required by 15 U.S.C. § 1681i(a)(6)(B)(iii).

I respectfully request the CFPB's assistance in resolving this matter.`,

      emotional: `I am writing out of desperation. This situation has caused me tremendous stress and anxiety.

For ${daysElapsed} days, I have been fighting to correct inaccurate information on my credit report:${accountInfo}

This error has prevented me from obtaining financing, affected my job prospects, and caused significant emotional distress to myself and my family.

I have tried everything within my power to resolve this directly with ${bureau}, but they continue to ignore my requests. I feel helpless and am turning to the CFPB as my last hope.`,

      legal: `FORMAL COMPLAINT - FCRA VIOLATIONS

Complainant hereby files this formal complaint against ${bureau} for violations of the Fair Credit Reporting Act, 15 U.S.C. § 1681 et seq.

FACTUAL BACKGROUND:
On ${disputeDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}, Complainant disputed the following account pursuant to 15 U.S.C. § 1681i(a)(1):${accountInfo}

LEGAL VIOLATIONS:
1. Failure to conduct reasonable investigation (15 U.S.C. § 1681i(a)(1)(A))
2. Failure to provide method of verification (15 U.S.C. § 1681i(a)(6)(B)(iii))
3. Continued reporting of disputed information (15 U.S.C. § 1681i(a)(5)(A))

RELIEF REQUESTED:
Immediate deletion of inaccurate information and statutory damages.`,
    };

    return toneVariations[tone] || toneVariations.assertive;
  };

  const [narrative, setNarrative] = useState(generateNarrative(selectedTone));

  const handleToneChange = (tone: string) => {
    setSelectedTone(tone);
    setNarrative(generateNarrative(tone));
  };

  const handleRegenerate = () => {
    setIsRegenerating(true);
    setTimeout(() => {
      setNarrative(generateNarrative(selectedTone));
      setIsRegenerating(false);
    }, 1500);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(narrative);
  };

  const handleCopyAllFields = () => {
    const allFields = `Product: ${PRODUCTS.find(p => p.value === product)?.label}
Company: ${COMPANIES.find(c => c.value === company)?.label}
Issue: ${ISSUES.find(i => i.value === issue)?.label}
Sub-Issue: ${SUB_ISSUES.find(s => s.value === subIssue)?.label}

Narrative:
${narrative}`;
    navigator.clipboard.writeText(allFields);
  };

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="font-semibold text-white">CFPB Complaint Generator</h1>
              <p className="text-sm text-slate-400">{clientName} • {bureau}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onSaveDraft?.(narrative)} className="border-slate-700 text-slate-300">
            <Save className="w-4 h-4 mr-2" />
            Save Draft
          </Button>
          <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => window.open("https://www.consumerfinance.gov/complaint/", "_blank")}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Open CFPB Portal
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left - Complaint Details */}
        <div className="w-80 border-r border-slate-800 p-6 overflow-y-auto">
          <h3 className="font-semibold text-white mb-6">Complaint Details</h3>

          {/* Product */}
          <div className="mb-4">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2 block">Product</label>
            <Select value={product} onValueChange={setProduct}>
              <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {PRODUCTS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Company */}
          <div className="mb-4">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2 block">Company</label>
            <Select value={company} onValueChange={setCompany}>
              <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {COMPANIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Issue */}
          <div className="mb-4">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2 block">Issue</label>
            <Select value={issue} onValueChange={setIssue}>
              <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {ISSUES.map((i) => (
                  <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sub-Issue */}
          <div className="mb-8">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2 block">Sub-Issue</label>
            <Select value={subIssue} onValueChange={setSubIssue}>
              <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {SUB_ISSUES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Narrative Tone */}
          <h3 className="font-semibold text-white mb-4">Narrative Tone</h3>
          <div className="grid grid-cols-2 gap-2">
            {TONES.map((tone) => (
              <button
                key={tone.id}
                onClick={() => handleToneChange(tone.id)}
                className={`p-3 rounded-xl text-left transition-all ${
                  selectedTone === tone.id
                    ? "bg-amber-500/20 border-2 border-amber-500/50"
                    : "bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800"
                }`}
              >
                <span className={`font-medium text-sm ${selectedTone === tone.id ? "text-amber-400" : "text-white"}`}>
                  {tone.label}
                </span>
                <p className="text-xs text-slate-500 mt-0.5">{tone.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Center - Narrative Preview */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Tabs */}
          <div className="flex items-center gap-1 mb-4 border-b border-slate-800">
            {(["preview", "edit", "tips"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? "text-white border-blue-500"
                    : "text-slate-400 border-transparent hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Content */}
          {activeTab === "preview" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-slate-800/30 rounded-xl p-6 border border-slate-700/50"
            >
              <p className="text-white whitespace-pre-line leading-relaxed">{narrative}</p>
            </motion.div>
          )}

          {activeTab === "edit" && (
            <Textarea
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              className="min-h-[400px] bg-slate-800/30 border-slate-700 text-white"
            />
          )}

          {activeTab === "tips" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
                <h4 className="font-medium text-blue-400 mb-2">Be Specific</h4>
                <p className="text-sm text-slate-300">Include exact dates, account numbers, and amounts in your complaint.</p>
              </div>
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <h4 className="font-medium text-amber-400 mb-2">Cite Violations</h4>
                <p className="text-sm text-slate-300">Reference specific FCRA sections when describing violations.</p>
              </div>
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <h4 className="font-medium text-emerald-400 mb-2">Desired Resolution</h4>
                <p className="text-sm text-slate-300">Clearly state what outcome you're seeking from the CFPB.</p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-slate-500">{narrative.length} characters</span>
            <Button variant="outline" size="sm" onClick={handleCopy} className="border-slate-700">
              <Copy className="w-4 h-4 mr-2" />
              Copy Narrative
            </Button>
          </div>
        </div>

        {/* Right - Client Info & Actions */}
        <div className="w-72 border-l border-slate-800 p-4 overflow-y-auto">
          {/* Client Information */}
          <div className="rounded-xl bg-slate-800/40 border border-slate-700/50 p-4 mb-4">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Client Information</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-slate-500" />
                <span className="text-white">{clientName}</span>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span className="text-white">Dispute: {disputeDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-slate-500" />
                <span className="text-white">{daysElapsed} days elapsed</span>
              </div>
            </div>
          </div>

          {/* Disputed Accounts */}
          <div className="rounded-xl bg-slate-800/40 border border-slate-700/50 p-4 mb-4">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Disputed Accounts</h4>
            <div className="space-y-3">
              {disputedAccounts.map((account, index) => (
                <div key={index} className="pb-3 border-b border-slate-700/50 last:border-0 last:pb-0">
                  <p className="font-medium text-white">{account.creditorName}</p>
                  <p className="text-xs text-slate-400">{account.accountNumber}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm text-white">${account.balance?.toLocaleString() || "N/A"}</span>
                    <Badge className="bg-red-500/20 text-red-400 text-xs">{account.status || "Collection"}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Quick Actions</h4>
          <div className="space-y-2 mb-4">
            <Button
              variant="outline"
              className="w-full justify-start border-slate-700 text-slate-300"
              onClick={handleRegenerate}
              disabled={isRegenerating}
            >
              {isRegenerating ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Regenerate Narrative
            </Button>
            <Button variant="outline" className="w-full justify-start border-slate-700 text-slate-300">
              <History className="w-4 h-4 mr-2" />
              View Dispute History
            </Button>
            <Button className="w-full justify-start bg-emerald-600 hover:bg-emerald-700" onClick={handleCopyAllFields}>
              <Copy className="w-4 h-4 mr-2" />
              Copy All Fields
            </Button>
          </div>

          {/* Help Box */}
          <div className="rounded-xl bg-blue-500/10 border border-blue-500/30 p-4">
            <div className="flex items-start gap-3">
              <HelpCircle className="w-5 h-5 text-blue-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-400">Need Help?</h4>
                <p className="text-xs text-blue-300/70 mt-1">
                  CFPB complaints typically receive a response within 15 days.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
