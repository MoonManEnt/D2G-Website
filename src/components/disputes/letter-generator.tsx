"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Copy,
  Printer,
  Download,
  FileText,
  Shield,
  AlertTriangle,
  Scale,
  Gavel,
  CheckCircle,
  Sparkles,
  RefreshCw,
  Clock,
  ChevronRight,
  Undo2,
  Zap,
  Bot,
} from "lucide-react";

// Letter types with their round numbers
const LETTER_TYPES = [
  { id: "initial", label: "Initial Dispute", description: "Basic factual dispute", round: "R1" },
  { id: "mov", label: "Method of Verification", description: "Demand verification proof", round: "R2" },
  { id: "violation", label: "Violation Notice", description: "FCRA violation claim", round: "R3" },
  { id: "final", label: "Final Demand", description: "Intent to litigate", round: "R4" },
];

// Legal citations
const LEGAL_CITATIONS = [
  { code: "15 U.S.C. § 1681i(a)(6)", label: "Verification Requirements" },
  { code: "15 U.S.C. § 1681s-2(a)(1)", label: "Furnisher Accuracy" },
];

interface AmeliaSuggestion {
  id: string;
  text: string;
  applied: boolean;
  impact: "high" | "medium" | "low";
}

interface LetterVersion {
  id: string;
  version: string;
  timestamp: string;
  isCurrent: boolean;
}

interface DisputedAccount {
  creditorName: string;
  accountNumber: string;
  balance?: number;
  status?: string;
}

interface LetterGeneratorProps {
  clientName: string;
  bureau: "TransUnion" | "Experian" | "Equifax";
  round: number;
  disputedAccounts: DisputedAccount[];
  initialLetterContent?: string;
  onSave?: (content: string) => void;
  onGenerate?: (letterType: string) => void;
}

export function LetterGenerator({
  clientName,
  bureau,
  round,
  disputedAccounts,
  initialLetterContent,
  onSave,
  onGenerate,
}: LetterGeneratorProps) {
  const [selectedType, setSelectedType] = useState(LETTER_TYPES[Math.min(round - 1, 3)].id);
  const [letterContent, setLetterContent] = useState(initialLetterContent || "");
  const [eoscarRisk, setEoscarRisk] = useState(87);
  const [ameliaConfidence, setAmeliaConfidence] = useState(94);
  const [suggestions, setSuggestions] = useState<AmeliaSuggestion[]>([
    { id: "1", text: "Add specific dates from prior communication", applied: false, impact: "high" },
    { id: "2", text: "Include emotional impact statement", applied: true, impact: "medium" },
    { id: "3", text: "Reference the 30-day timeline requirement", applied: false, impact: "high" },
  ]);
  const [versions, setVersions] = useState<LetterVersion[]>([
    { id: "v12", version: "v1.2", timestamp: "Now", isCurrent: true },
    { id: "v11", version: "v1.1", timestamp: "5m ago", isCurrent: false },
    { id: "v10", version: "v1.0", timestamp: "20 ago", isCurrent: false },
  ]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Bureau addresses
  const bureauAddresses: Record<string, { name: string; address: string }> = {
    TransUnion: { name: "TransUnion Consumer Relations", address: "P.O. Box 2000\nChester, PA 19016" },
    Experian: { name: "Experian Consumer Relations", address: "P.O. Box 4500\nAllen, TX 75013" },
    Equifax: { name: "Equifax Information Services", address: "P.O. Box 740256\nAtlanta, GA 30374" },
  };

  const selectedLetterType = LETTER_TYPES.find((t) => t.id === selectedType);
  const bureauInfo = bureauAddresses[bureau];
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // Generate sample letter content
  useEffect(() => {
    if (!letterContent && disputedAccounts.length > 0) {
      const account = disputedAccounts[0];
      const sampleContent = generateLetterContent(selectedType, account, bureauInfo, clientName);
      setLetterContent(sampleContent);
    }
  }, [selectedType, disputedAccounts, bureauInfo, clientName, letterContent]);

  const handleApplySuggestion = (suggestionId: string) => {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === suggestionId ? { ...s, applied: true } : s))
    );
    // Increment confidence
    setAmeliaConfidence((prev) => Math.min(prev + 2, 99));
    // Decrease EOSCAR risk
    setEoscarRisk((prev) => Math.max(prev - 3, 50));
  };

  const handleApplyAll = () => {
    setSuggestions((prev) => prev.map((s) => ({ ...s, applied: true })));
    setAmeliaConfidence(98);
    setEoscarRisk(72);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(letterContent);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    // In production, this would generate a DOCX
    const blob = new Blob([letterContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dispute-letter-${bureau.toLowerCase()}-round${round}.txt`;
    a.click();
  };

  const handleRegenerate = async () => {
    setIsGenerating(true);
    // Simulate regeneration
    setTimeout(() => {
      setIsGenerating(false);
      setVersions((prev) => [
        { id: `v${Date.now()}`, version: `v${parseFloat(prev[0].version.slice(1)) + 0.1}`, timestamp: "Now", isCurrent: true },
        ...prev.map((v) => ({ ...v, isCurrent: false })),
      ]);
    }, 2000);
  };

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30">
            Claude-content
          </Badge>
          <h1 className="text-lg font-semibold text-white">Generate Dispute Letter</h1>
          <span className="text-sm text-slate-400">
            {clientName} • {bureau} • Round {round}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy} className="border-slate-700 text-slate-300">
            <Copy className="w-4 h-4 mr-2" />
            Copy
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="border-slate-700 text-slate-300">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button size="sm" onClick={handleDownload} className="bg-blue-600 hover:bg-blue-700">
            <Download className="w-4 h-4 mr-2" />
            Download DOCX
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Letter Type Selector */}
        <div className="w-64 border-r border-slate-800 p-4 overflow-y-auto">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Letter Type</h3>
          <div className="space-y-2">
            {LETTER_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={`w-full text-left p-3 rounded-xl transition-all ${
                  selectedType === type.id
                    ? "bg-blue-500/20 border border-blue-500/50"
                    : "bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-medium ${selectedType === type.id ? "text-blue-400" : "text-white"}`}>
                    {type.label}
                  </span>
                  <Badge variant="outline" className={`text-xs ${selectedType === type.id ? "border-blue-500/50 text-blue-400" : "border-slate-600 text-slate-400"}`}>
                    {type.round}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-1">{type.description}</p>
              </button>
            ))}
          </div>

          {/* Legal Citations */}
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mt-8 mb-4">Legal Citations</h3>
          <div className="space-y-2">
            {LEGAL_CITATIONS.map((cite) => (
              <button
                key={cite.code}
                className="w-full text-left p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 transition-all group"
              >
                <span className="text-sm text-blue-400 group-hover:underline">{cite.code}</span>
              </button>
            ))}
          </div>

          {/* EOSCAR Risk Meter */}
          <div className="mt-8 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">EOSCAR Risk</span>
              <span className={`text-lg font-bold ${eoscarRisk > 80 ? "text-emerald-400" : eoscarRisk > 60 ? "text-amber-400" : "text-red-400"}`}>
                {eoscarRisk}%
              </span>
            </div>
            <Progress value={eoscarRisk} className="h-2" />
            <p className="text-xs text-slate-500 mt-2">Low detection risk</p>
          </div>
        </div>

        {/* Center - Letter Preview */}
        <div className="flex-1 p-6 overflow-y-auto bg-slate-950/50">
          <div className="max-w-2xl mx-auto">
            {/* Letter Document */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white text-slate-900 rounded-lg shadow-2xl p-8 min-h-[800px]"
            >
              {/* Date */}
              <p className="text-right text-sm text-slate-600 mb-8">{today}</p>

              {/* Bureau Address */}
              <div className="mb-6">
                <p className="font-medium">{bureauInfo.name}</p>
                <p className="text-sm text-slate-600 whitespace-pre-line">{bureauInfo.address}</p>
              </div>

              {/* Subject */}
              <p className="mb-6">
                <span className="font-medium">Re: </span>
                Request for {selectedLetterType?.label}
              </p>

              {/* Salutation */}
              <p className="mb-6">To Whom It May Concern:</p>

              {/* Body */}
              <div className="space-y-4 text-sm leading-relaxed">
                <p>
                  I am writing to formally request the{" "}
                  <span className="bg-blue-100 text-blue-800 px-1 rounded font-medium">method of verification</span>{" "}
                  used during your investigation of my dispute. Pursuant to{" "}
                  <span className="bg-blue-100 text-blue-800 px-1 rounded font-medium">15 U.S.C. § 1681i(a)(6)(B)(iii)</span>,
                  you are required to provide this information upon request.
                </p>

                {/* Disputed Account Box */}
                {disputedAccounts.length > 0 && (
                  <div className="border border-slate-300 rounded-lg p-4 my-6 bg-slate-50">
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Disputed Account</p>
                    <p className="font-semibold">{disputedAccounts[0].creditorName}</p>
                    <p className="text-sm text-slate-600">Account #: {disputedAccounts[0].accountNumber}</p>
                  </div>
                )}

                <p>
                  This information is{" "}
                  <span className="bg-blue-100 text-blue-800 px-1 rounded font-medium">inaccurate and requires verification</span>.
                  I demand the following within 15 days:
                </p>

                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Name, address, and telephone number of persons contacted</li>
                  <li>Summary of verification method used</li>
                  <li>Copies of all documents relied upon</li>
                </ul>

                {/* Emotional Impact Statement */}
                <div className="bg-amber-50 border-l-4 border-amber-400 p-3 my-6">
                  <p className="text-amber-800 italic">
                    This situation has caused me significant financial hardship and emotional distress.
                  </p>
                </div>
              </div>

              {/* Signature */}
              <div className="mt-12">
                <p>Sincerely,</p>
                <p className="mt-6 font-medium">{clientName}</p>
              </div>

              {/* Footer Legend */}
              <div className="mt-12 pt-4 border-t border-slate-200 flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-blue-100" /> Key Terms
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-amber-100" /> Legal Citations
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-emerald-100" /> Dispute Basis
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-violet-100" /> AI Added
                </span>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Right Panel - AMELIA Assistant */}
        <div className="w-80 border-l border-slate-800 p-4 overflow-y-auto">
          {/* AMELIA Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-white" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-white">Amelia</h3>
              <p className="text-xs text-slate-400">AI Writing Assistant</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-2xl font-bold text-emerald-400">{ameliaConfidence}%</p>
              <p className="text-xs text-slate-400">Confidence</p>
            </div>
          </div>

          {/* Suggestions */}
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Suggestions</h4>
          <div className="space-y-2 mb-4">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className={`p-3 rounded-xl border transition-all ${
                  suggestion.applied
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : "bg-slate-800/50 border-slate-700/50"
                }`}
              >
                <div className="flex items-start gap-3">
                  {suggestion.applied ? (
                    <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5" />
                  ) : suggestion.impact === "high" ? (
                    <Zap className="w-5 h-5 text-amber-400 mt-0.5" />
                  ) : (
                    <Sparkles className="w-5 h-5 text-blue-400 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={`text-sm ${suggestion.applied ? "text-emerald-300" : "text-white"}`}>
                      {suggestion.text}
                    </p>
                  </div>
                  {!suggestion.applied && (
                    <Button
                      size="sm"
                      onClick={() => handleApplySuggestion(suggestion.id)}
                      className="bg-blue-600 hover:bg-blue-700 text-xs h-7"
                    >
                      Apply
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Apply All Button */}
          {suggestions.some((s) => !s.applied) && (
            <Button onClick={handleApplyAll} className="w-full bg-emerald-600 hover:bg-emerald-700 mb-6">
              <Sparkles className="w-4 h-4 mr-2" />
              Apply All
            </Button>
          )}

          {/* Version History */}
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Version History</h4>
          <div className="space-y-2 mb-4">
            {versions.slice(0, 3).map((version) => (
              <button
                key={version.id}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                  version.isCurrent
                    ? "bg-blue-500/20 border border-blue-500/50"
                    : "bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${version.isCurrent ? "text-blue-400" : "text-white"}`}>
                    {version.version}
                  </span>
                  {version.isCurrent && (
                    <Badge className="bg-blue-500/20 text-blue-400 text-[10px]">current</Badge>
                  )}
                </div>
                <span className="text-xs text-slate-500">{version.timestamp}</span>
              </button>
            ))}
          </div>

          {/* Undo Button */}
          <button className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 transition-all text-slate-400 hover:text-white">
            <Undo2 className="w-4 h-4" />
            <span className="text-sm">Undo Last Change</span>
          </button>

          {/* Regenerate Button */}
          <Button
            onClick={handleRegenerate}
            disabled={isGenerating}
            variant="outline"
            className="w-full mt-4 border-slate-700"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate Letter
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Helper function to generate letter content
function generateLetterContent(
  letterType: string,
  account: DisputedAccount,
  bureauInfo: { name: string; address: string },
  clientName: string
): string {
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return `${today}

${bureauInfo.name}
${bureauInfo.address}

Re: Request for Method of Verification

To Whom It May Concern:

I am writing to formally request the method of verification used during your investigation of my dispute. Pursuant to 15 U.S.C. § 1681i(a)(6)(B)(iii), you are required to provide this information upon request.

DISPUTED ACCOUNT
${account.creditorName}
Account #: ${account.accountNumber}

This information is inaccurate and requires verification. I demand the following within 15 days:

• Name, address, and telephone number of persons contacted
• Summary of verification method used
• Copies of all documents relied upon

This situation has caused me significant financial hardship and emotional distress.

Sincerely,

${clientName}`;
}
