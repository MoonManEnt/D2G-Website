"use client";

import { useState, useEffect } from "react";
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
  AlertTriangle,
  Bot,
  Lightbulb,
} from "lucide-react";

// CFPB Product categories
const PRODUCTS = [
  { value: "credit_reporting", label: "Credit reporting or other personal consumer reports" },
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
  { value: "reporting_company_used", label: "Reporting company used your report improperly" },
  { value: "credit_inquiries", label: "Credit inquiries on your report" },
  { value: "personal_info_incorrect", label: "Personal information incorrect" },
  { value: "investigation_took_too_long", label: "Investigation took more than 30 days" },
  { value: "not_notified_of_results", label: "Was not notified of investigation results" },
];

// Narrative tones - NO LEGAL-HEAVY option per requirements (human tonality only)
const TONES = [
  { id: "concerned", label: "Concerned", description: "Worried consumer seeking help", color: "blue" },
  { id: "frustrated", label: "Frustrated", description: "Patient has run out, need resolution", color: "orange" },
  { id: "desperate", label: "Desperate", description: "Personal impact, last resort", color: "purple" },
  { id: "factual", label: "Factual", description: "Just the facts, timeline focused", color: "slate" },
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
  disputeFlow?: string; // The dispute flow used (ACCURACY, COLLECTION, etc.)
  disputeRound?: number; // Current round number
  onBack?: () => void;
  onSaveDraft?: (narrative: string) => void;
}

export function CFPBGenerator({
  clientName,
  bureau,
  disputeDate,
  disputedAccounts,
  disputeFlow = "ACCURACY",
  disputeRound = 1,
  onBack,
  onSaveDraft,
}: CFPBGeneratorProps) {
  const [product, setProduct] = useState("credit_reporting");
  const [company, setCompany] = useState(bureau.toLowerCase());
  const [issue, setIssue] = useState("incorrect_info");
  const [subIssue, setSubIssue] = useState("investigation_took_too_long");
  const [selectedTone, setSelectedTone] = useState("concerned");
  const [activeTab, setActiveTab] = useState<"preview" | "edit" | "tips">("preview");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Calculate days elapsed
  const daysElapsed = Math.floor((Date.now() - disputeDate.getTime()) / (1000 * 60 * 60 * 24));

  // Format account list for narrative (human readable, no legal format)
  const formatAccountsHuman = () => {
    return disputedAccounts.map((account, index) =>
      `- ${account.creditorName} (ending in ${account.accountNumber?.slice(-4) || "****"}) showing a balance of $${account.balance?.toLocaleString() || "unknown"}`
    ).join("\n");
  };

  // Generate HUMAN-ONLY narrative based on tone - NO LEGAL CITATIONS
  // This narrative should support the corresponding dispute letter sent to the CRA
  const generateNarrative = (tone: string): string => {
    const accountList = formatAccountsHuman();
    const formattedDate = disputeDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    });

    const toneVariations: Record<string, string> = {
      concerned: `I am writing because I am genuinely concerned about inaccurate information appearing on my credit report from ${bureau}.

On ${formattedDate}, I sent a written dispute to ${bureau} about the following accounts that I believe are being reported incorrectly:

${accountList}

It has now been ${daysElapsed} days since I mailed my dispute. I followed all the proper steps - I sent my letter via certified mail, included copies of my identification, and clearly explained why I believe this information is wrong.

I am worried because I have not received a proper response that addresses my specific concerns. The response I did receive seemed generic and did not explain how they verified the information or what steps they took to investigate.

This situation is affecting my ability to:
- Get approved for credit I need
- Obtain fair interest rates
- Move forward with important financial goals

I am turning to the CFPB because I feel like I have done everything I can on my own. I am not trying to avoid legitimate debts - I just want my credit report to be accurate. That's all I'm asking for.

Please help me get this resolved. Thank you for your time and assistance.`,

      frustrated: `I need to file this complaint because I am at the end of my rope with ${bureau}.

For ${daysElapsed} days now, I have been trying to get them to properly investigate accounts on my credit report that I know are wrong:

${accountList}

I first disputed these items on ${formattedDate}. Since then, I have:
- Sent multiple written disputes
- Provided supporting documentation
- Followed up repeatedly
- Done everything I was supposed to do

And what have I gotten in return? Form letters. Generic responses. No real investigation. No one seems to actually look at what I'm telling them.

I'm not asking for special treatment. I'm asking for them to do their job. When someone tells a credit bureau that information is wrong, they're supposed to actually check. They're supposed to contact the company reporting it. They're supposed to verify.

Instead, it feels like they just rubber-stamp everything as "verified" without actually doing anything.

This isn't fair. My credit score is suffering. I'm being denied for things I should qualify for. And no matter what I do, I can't seem to get a real person to actually look at my case.

I need the CFPB to step in because clearly ${bureau} isn't going to fix this on their own.`,

      desperate: `I am writing this complaint as a last resort. I don't know where else to turn.

The stress this situation has caused me and my family is overwhelming. For ${daysElapsed} days, I have been fighting to correct errors on my ${bureau} credit report:

${accountList}

Since I first disputed these accounts on ${formattedDate}, my life has been significantly impacted:

- I was denied an apartment because of my credit report
- I couldn't get the car loan I needed to get to work
- I've had to explain my credit situation to employers
- The constant worry has affected my sleep and my health

I have done everything right. I sent my disputes properly. I provided documentation. I was patient. I followed up. I gave them every chance to fix this.

But nothing has changed. The same wrong information is still there, still hurting me, still affecting every financial decision I try to make.

I feel completely powerless. It's my credit report - it's supposed to be about ME - but I have no control over it. Companies can report whatever they want, and even when it's wrong, I can't seem to get it fixed.

Please, I am begging for help. I just want accurate information on my credit report. That's all. Please help me.`,

      factual: `This complaint concerns my credit report from ${bureau}.

Timeline of events:

${formattedDate}: I submitted a written dispute via certified mail regarding the following accounts:

${accountList}

Current status: ${daysElapsed} days have passed since my initial dispute.

What I disputed:
I believe the above accounts contain inaccurate information. In my dispute letter, I specifically identified what information I believe is wrong and requested that ${bureau} investigate and correct or remove the inaccurate items.

What happened:
After submitting my dispute, I received a response from ${bureau}. However, the response did not adequately address my specific concerns. The investigation results did not explain:
- How the information was verified
- Who was contacted during the investigation
- What documentation was reviewed

Current impact:
The continued reporting of this information is negatively affecting my credit score and my ability to obtain credit on fair terms.

What I am requesting:
I am asking the CFPB to review my complaint and help ensure that ${bureau} conducts a proper investigation of the disputed items. I want accurate information on my credit report - nothing more, nothing less.

Supporting documents available upon request.`,
    };

    return toneVariations[tone] || toneVariations.concerned;
  };

  const [narrative, setNarrative] = useState(generateNarrative(selectedTone));

  // Update narrative when tone changes
  useEffect(() => {
    setNarrative(generateNarrative(selectedTone));
  }, [selectedTone, disputedAccounts, daysElapsed]);

  const handleToneChange = (tone: string) => {
    setSelectedTone(tone);
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    // Simulate AI regeneration with slight variation
    await new Promise(resolve => setTimeout(resolve, 1500));
    const newNarrative = generateNarrative(selectedTone);
    // Add slight variation to show it's "regenerated"
    setNarrative(newNarrative);
    setIsRegenerating(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(narrative);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyAllFields = () => {
    const allFields = `CFPB COMPLAINT SUBMISSION

Product: ${PRODUCTS.find(p => p.value === product)?.label}
Company: ${COMPANIES.find(c => c.value === company)?.label}
Issue: ${ISSUES.find(i => i.value === issue)?.label}
Sub-Issue: ${SUB_ISSUES.find(s => s.value === subIssue)?.label}

---NARRATIVE---

${narrative}`;
    navigator.clipboard.writeText(allFields);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getToneColor = (toneId: string) => {
    const tone = TONES.find(t => t.id === toneId);
    const colors: Record<string, string> = {
      blue: "bg-primary/20 border-blue-500/50 text-primary",
      orange: "bg-orange-500/20 border-orange-500/50 text-orange-400",
      purple: "bg-purple-500/20 border-purple-500/50 text-purple-400",
      slate: "bg-muted border-border text-muted-foreground",
    };
    return colors[tone?.color || "blue"];
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-card text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground">CFPB Complaint Generator</h1>
              <p className="text-sm text-muted-foreground">{clientName} • {bureau} • Round {disputeRound}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onSaveDraft?.(narrative)} className="border-border text-muted-foreground">
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
        <div className="w-80 border-r border-border p-6 overflow-y-auto">
          <h3 className="font-semibold text-foreground mb-6">Complaint Details</h3>

          {/* Product */}
          <div className="mb-4">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">Product</label>
            <Select value={product} onValueChange={setProduct}>
              <SelectTrigger className="bg-card border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {PRODUCTS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Company */}
          <div className="mb-4">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">Company</label>
            <Select value={company} onValueChange={setCompany}>
              <SelectTrigger className="bg-card border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {COMPANIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Issue */}
          <div className="mb-4">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">Issue</label>
            <Select value={issue} onValueChange={setIssue}>
              <SelectTrigger className="bg-card border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {ISSUES.map((i) => (
                  <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sub-Issue */}
          <div className="mb-8">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">Sub-Issue</label>
            <Select value={subIssue} onValueChange={setSubIssue}>
              <SelectTrigger className="bg-card border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {SUB_ISSUES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Narrative Tone */}
          <h3 className="font-semibold text-foreground mb-4">Narrative Tone</h3>
          <div className="grid grid-cols-2 gap-2 mb-6">
            {TONES.map((tone) => (
              <button
                key={tone.id}
                onClick={() => handleToneChange(tone.id)}
                className={`p-3 rounded-xl text-left transition-all border-2 ${
                  selectedTone === tone.id
                    ? getToneColor(tone.id)
                    : "bg-card border-border hover:bg-card hover:border-input"
                }`}
              >
                <span className={`font-medium text-sm ${selectedTone === tone.id ? "" : "text-foreground"}`}>
                  {tone.label}
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">{tone.description}</p>
              </button>
            ))}
          </div>

          {/* Important Notice - NO LEGAL CITATIONS */}
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-400 text-sm">Important</h4>
                <p className="text-xs text-amber-300/70 mt-1">
                  CFPB complaints should use human language only. Legal citations belong in your dispute letters to the bureaus, not in CFPB complaints.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Center - Narrative Preview */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Tabs */}
          <div className="flex items-center gap-1 mb-4 border-b border-border">
            {(["preview", "edit", "tips"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? "text-foreground border-amber-500"
                    : "text-muted-foreground border-transparent hover:text-foreground"
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
              className="bg-white rounded-xl p-6 shadow-lg"
            >
              <p className="text-slate-800 whitespace-pre-line leading-relaxed text-sm">{narrative}</p>
            </motion.div>
          )}

          {activeTab === "edit" && (
            <Textarea
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              className="min-h-[400px] bg-card border-border text-foreground"
              placeholder="Edit your CFPB complaint narrative..."
            />
          )}

          {activeTab === "tips" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-emerald-400">Be Specific About Dates</h4>
                    <p className="text-sm text-muted-foreground mt-1">Include exactly when you sent your dispute and how many days have passed. The CFPB tracks response times.</p>
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/30">
                <div className="flex items-start gap-3">
                  <Lightbulb className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-medium text-primary">Describe Personal Impact</h4>
                    <p className="text-sm text-muted-foreground mt-1">Explain how the inaccurate information has affected you - denied credit, higher rates, stress. Make it real.</p>
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-purple-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-purple-400">Sound Human, Not Legal</h4>
                    <p className="text-sm text-muted-foreground mt-1">Write like you're explaining the problem to a friend. Avoid legal jargon and statute citations - those go in your dispute letters.</p>
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-400">State What You Want</h4>
                    <p className="text-sm text-muted-foreground mt-1">Be clear about your desired outcome: accurate reporting, removal of incorrect items, proper investigation.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-muted-foreground">{narrative.length} characters</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className={`border-border ${copied ? "bg-emerald-600 border-emerald-600 text-white" : ""}`}
            >
              {copied ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Narrative
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Right - Client Info & Actions */}
        <div className="w-72 border-l border-border p-4 overflow-y-auto">
          {/* Client Information */}
          <div className="rounded-xl bg-card border border-border p-4 mb-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Client Information</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">{clientName}</span>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground text-sm">
                  Dispute: {disputeDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className={`text-sm ${daysElapsed > 30 ? "text-red-400 font-medium" : "text-muted-foreground"}`}>
                  {daysElapsed} days elapsed {daysElapsed > 30 && "(OVERDUE)"}
                </span>
              </div>
            </div>
          </div>

          {/* Dispute Context */}
          <div className="rounded-xl bg-card border border-border p-4 mb-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Dispute Context</h4>
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-purple-500/20 text-purple-400">{disputeFlow}</Badge>
              <Badge className="bg-primary/20 text-primary">Round {disputeRound}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              This CFPB complaint supports your {disputeFlow.toLowerCase()} dispute letter sent to {bureau}.
            </p>
          </div>

          {/* Disputed Accounts */}
          <div className="rounded-xl bg-card border border-border p-4 mb-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Disputed Accounts</h4>
            <div className="space-y-3">
              {disputedAccounts.map((account, index) => (
                <div key={index} className="pb-3 border-b border-border last:border-0 last:pb-0">
                  <p className="font-medium text-foreground text-sm">{account.creditorName}</p>
                  <p className="text-xs text-muted-foreground">{account.accountNumber}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm text-foreground">${account.balance?.toLocaleString() || "N/A"}</span>
                    <Badge className="bg-red-500/20 text-red-400 text-xs">{account.status || "Disputed"}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Quick Actions</h4>
          <div className="space-y-2 mb-4">
            <Button
              variant="outline"
              className="w-full justify-start border-border text-muted-foreground"
              onClick={handleRegenerate}
              disabled={isRegenerating}
            >
              {isRegenerating ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              {isRegenerating ? "Regenerating..." : "Regenerate Narrative"}
            </Button>
            <Button variant="outline" className="w-full justify-start border-border text-muted-foreground">
              <History className="w-4 h-4 mr-2" />
              View Dispute History
            </Button>
            <Button
              className={`w-full justify-start ${copied ? "bg-emerald-600 hover:bg-emerald-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
              onClick={handleCopyAllFields}
            >
              <Copy className="w-4 h-4 mr-2" />
              {copied ? "Copied!" : "Copy All Fields"}
            </Button>
          </div>

          {/* Help Box */}
          <div className="rounded-xl bg-primary/10 border border-primary/30 p-4">
            <div className="flex items-start gap-3">
              <HelpCircle className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium text-primary text-sm">About CFPB Complaints</h4>
                <p className="text-xs text-blue-300/70 mt-1">
                  Companies typically respond within 15 days. The CFPB shares complaints with the company and tracks their response.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
