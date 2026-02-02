"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/lib/use-toast";
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
  Loader2,
  Edit3,
  Eye,
  Save,
  X,
} from "lucide-react";

// Letter types with their round numbers
const LETTER_TYPES = [
  { id: "initial", label: "Initial Dispute", description: "Basic factual dispute", round: "R1", roundNum: 1 },
  { id: "mov", label: "Method of Verification", description: "Demand verification proof", round: "R2", roundNum: 2 },
  { id: "violation", label: "Violation Notice", description: "FCRA violation claim", round: "R3", roundNum: 3 },
  { id: "final", label: "Final Demand", description: "Intent to litigate", round: "R4", roundNum: 4 },
];

// Legal citations
const LEGAL_CITATIONS = [
  { code: "15 U.S.C. § 1681i(a)(6)", label: "Verification Requirements" },
  { code: "15 U.S.C. § 1681s-2(a)(1)", label: "Furnisher Accuracy" },
  { code: "15 U.S.C. § 1681i(a)(1)", label: "Reinvestigation Requirement" },
  { code: "15 U.S.C. § 1681e(b)", label: "Maximum Accuracy" },
];

interface AmeliaSuggestion {
  id: string;
  text: string;
  category: string;
  impact: "high" | "medium" | "low";
  originalText?: string;
  replacementText?: string;
  insertionPoint?: string;
  insertionText?: string;
  reasoning: string;
  applied?: boolean;
}

interface LetterVersion {
  id: string;
  version: string;
  timestamp: string;
  isCurrent: boolean;
  content?: string;
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
  disputeId?: string; // Actual dispute ID for API calls
  initialLetterContent?: string;
  onSave?: (content: string) => void;
  onGenerate?: (letterType: string) => void;
  onBack?: () => void;
}

export function LetterGenerator({
  clientName,
  bureau,
  round,
  disputedAccounts,
  disputeId,
  initialLetterContent,
  onSave,
  onGenerate,
  onBack,
}: LetterGeneratorProps) {
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState(LETTER_TYPES[Math.min(round - 1, 3)].id);
  const [letterContent, setLetterContent] = useState(initialLetterContent || "");
  const [editedContent, setEditedContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [eoscarRisk, setEoscarRisk] = useState(75);
  const [ameliaConfidence, setAmeliaConfidence] = useState(85);
  const [suggestions, setSuggestions] = useState<AmeliaSuggestion[]>([]);
  const [versions, setVersions] = useState<LetterVersion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isApplyingSuggestion, setIsApplyingSuggestion] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Bureau addresses
  const bureauAddresses: Record<string, { name: string; address: string }> = {
    TransUnion: { name: "TransUnion Consumer Relations", address: "P.O. Box 2000\nChester, PA 19016" },
    Experian: { name: "Experian Consumer Relations", address: "P.O. Box 4500\nAllen, TX 75013" },
    Equifax: { name: "Equifax Information Services", address: "P.O. Box 740256\nAtlanta, GA 30374" },
  };

  const selectedLetterType = LETTER_TYPES.find((t) => t.id === selectedType);
  const bureauInfo = bureauAddresses[bureau];
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // Fetch letter content and suggestions from API
  const fetchLetterData = useCallback(async () => {
    if (!disputeId) return;

    try {
      // Fetch letter content
      const letterRes = await fetch(`/api/disputes/${disputeId}/amelia`);
      if (letterRes.ok) {
        const data = await letterRes.json();
        if (data.hasLetter && data.letterContent) {
          setLetterContent(data.letterContent);
        } else if (!letterContent) {
          // Generate new letter if none exists
          handleGenerateLetter();
        }
      }
    } catch (error) {
      console.error("Failed to fetch letter data:", error);
    }
  }, [disputeId]);

  // Fetch AMELIA suggestions
  const fetchSuggestions = useCallback(async () => {
    if (!disputeId || !letterContent) return;

    setIsLoadingSuggestions(true);
    try {
      const res = await fetch(`/api/disputes/${disputeId}/amelia/suggestions`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
        setAmeliaConfidence(data.metrics?.confidence || 85);
        setEoscarRisk(100 - (data.metrics?.eoscarRisk || 25)); // Invert for UI display
      }
    } catch (error) {
      console.error("Failed to fetch suggestions:", error);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [disputeId, letterContent]);

  // Initial load
  useEffect(() => {
    if (disputeId) {
      fetchLetterData();
    } else if (!letterContent && disputedAccounts.length > 0) {
      // Generate sample content if no dispute ID
      const account = disputedAccounts[0];
      const sampleContent = generateSampleLetterContent(selectedType, account, bureauInfo, clientName, round);
      setLetterContent(sampleContent);
    }
  }, [disputeId]);

  // Fetch suggestions when letter content changes
  useEffect(() => {
    if (letterContent && disputeId) {
      fetchSuggestions();
    }
  }, [letterContent, disputeId, fetchSuggestions]);

  // Generate letter using AMELIA API
  const handleGenerateLetter = async () => {
    if (!disputeId) {
      toast({ title: "Error", description: "No dispute ID provided", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch(`/api/disputes/${disputeId}/amelia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate: true }),
      });

      if (res.ok) {
        const data = await res.json();
        setLetterContent(data.letterContent);

        // Add to version history
        setVersions(prev => [
          {
            id: `v${Date.now()}`,
            version: `v${(prev.length + 1).toFixed(1)}`,
            timestamp: "Now",
            isCurrent: true,
            content: data.letterContent,
          },
          ...prev.map(v => ({ ...v, isCurrent: false })),
        ]);

        toast({ title: "Letter Generated", description: "AMELIA has created a new dispute letter." });
        onGenerate?.(selectedType);
      } else {
        const error = await res.json();
        toast({ title: "Error", description: error.message || "Failed to generate letter", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate letter", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  // Apply a single suggestion
  const handleApplySuggestion = async (suggestion: AmeliaSuggestion) => {
    if (!disputeId) return;

    setIsApplyingSuggestion(suggestion.id);
    try {
      const res = await fetch(`/api/disputes/${disputeId}/amelia/suggestions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestionId: suggestion.id,
          action: suggestion.replacementText ? "apply" : "insert",
          originalText: suggestion.originalText,
          replacementText: suggestion.replacementText,
          insertionPoint: suggestion.insertionPoint,
          insertionText: suggestion.insertionText,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setLetterContent(data.letterContent);
        setAmeliaConfidence(data.metrics?.confidence || ameliaConfidence + 2);
        setEoscarRisk(100 - (data.metrics?.eoscarRisk || 25));

        // Mark suggestion as applied
        setSuggestions(prev =>
          prev.map(s => s.id === suggestion.id ? { ...s, applied: true } : s)
        );

        toast({ title: "Suggestion Applied", description: "The letter has been updated." });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to apply suggestion", variant: "destructive" });
    } finally {
      setIsApplyingSuggestion(null);
    }
  };

  // Apply all suggestions
  const handleApplyAll = async () => {
    const unappliedSuggestions = suggestions.filter(s => !s.applied);
    for (const suggestion of unappliedSuggestions) {
      await handleApplySuggestion(suggestion);
    }
  };

  // Save edited content
  const handleSaveEdit = async () => {
    if (!disputeId) {
      setLetterContent(editedContent);
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/disputes/${disputeId}/amelia/suggestions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ letterContent: editedContent }),
      });

      if (res.ok) {
        const data = await res.json();
        setLetterContent(editedContent);
        setAmeliaConfidence(data.metrics?.confidence || 85);
        setEoscarRisk(100 - (data.metrics?.eoscarRisk || 25));
        setIsEditing(false);

        // Add to version history
        setVersions(prev => [
          {
            id: `v${Date.now()}`,
            version: `v${(prev.length + 1).toFixed(1)}`,
            timestamp: "Now",
            isCurrent: true,
            content: editedContent,
          },
          ...prev.map(v => ({ ...v, isCurrent: false })),
        ]);

        toast({ title: "Letter Saved", description: "Your changes have been saved." });
        onSave?.(editedContent);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to save changes", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // Copy to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(letterContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied", description: "Letter copied to clipboard." });
  };

  // Print
  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Dispute Letter - ${clientName}</title>
            <style>
              body { font-family: 'Times New Roman', serif; padding: 40px; max-width: 800px; margin: 0 auto; }
              pre { white-space: pre-wrap; font-family: inherit; }
            </style>
          </head>
          <body><pre>${letterContent}</pre></body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Download as text (in production, this would be DOCX)
  const handleDownload = async () => {
    // Try to get DOCX from API first
    if (disputeId) {
      try {
        const res = await fetch(`/api/disputes/${disputeId}/download?format=docx`);
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `dispute-letter-${bureau.toLowerCase()}-round${round}.docx`;
          a.click();
          URL.revokeObjectURL(url);
          return;
        }
      } catch {
        // Fall back to text download
      }
    }

    // Fallback to text
    const blob = new Blob([letterContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dispute-letter-${bureau.toLowerCase()}-round${round}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Revert to a previous version
  const handleRevertVersion = (version: LetterVersion) => {
    if (version.content) {
      setLetterContent(version.content);
      setVersions(prev =>
        prev.map(v => ({ ...v, isCurrent: v.id === version.id }))
      );
      toast({ title: "Reverted", description: `Reverted to ${version.version}` });
    }
  };

  // Undo last change
  const handleUndo = () => {
    const previousVersion = versions.find(v => !v.isCurrent);
    if (previousVersion) {
      handleRevertVersion(previousVersion);
    }
  };

  // Get EOSCAR risk color
  const getEoscarRiskColor = (risk: number) => {
    if (risk >= 80) return "text-emerald-400";
    if (risk >= 60) return "text-amber-400";
    if (risk >= 40) return "text-orange-400";
    return "text-red-400";
  };

  const getEoscarRiskLabel = (risk: number) => {
    if (risk >= 80) return "Low detection risk";
    if (risk >= 60) return "Medium detection risk";
    if (risk >= 40) return "Elevated detection risk";
    return "High detection risk";
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground hover:text-foreground">
              ← Back
            </Button>
          )}
          <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30">
            AMELIA-Powered
          </Badge>
          <h1 className="text-lg font-semibold text-foreground">
            {isEditing ? "Edit Letter" : "Generate Dispute Letter"}
          </h1>
          <span className="text-sm text-muted-foreground">
            {clientName} • {bureau} • Round {round}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(false)} className="border-border text-muted-foreground">
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveEdit} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Changes
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => { setEditedContent(letterContent); setIsEditing(true); }} className="border-border text-muted-foreground">
                <Edit3 className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopy} className={`border-border ${copied ? "bg-emerald-600 border-emerald-600 text-white" : "text-muted-foreground"}`}>
                {copied ? <CheckCircle className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? "Copied!" : "Copy"}
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint} className="border-border text-muted-foreground">
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              <Button size="sm" onClick={handleDownload} className="bg-primary hover:bg-primary/90">
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Letter Type Selector */}
        <div className="w-64 border-r border-border p-4 overflow-y-auto">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Letter Type</h3>
          <div className="space-y-2">
            {LETTER_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={`w-full text-left p-3 rounded-xl transition-all ${
                  selectedType === type.id
                    ? "bg-primary/20 border border-blue-500/50"
                    : "bg-card border border-border hover:bg-card"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-medium ${selectedType === type.id ? "text-primary" : "text-foreground"}`}>
                    {type.label}
                  </span>
                  <Badge variant="outline" className={`text-xs ${selectedType === type.id ? "border-blue-500/50 text-primary" : "border-input text-muted-foreground"}`}>
                    {type.round}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{type.description}</p>
              </button>
            ))}
          </div>

          {/* Legal Citations */}
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-8 mb-4">Legal Citations</h3>
          <div className="space-y-2">
            {LEGAL_CITATIONS.map((cite) => (
              <button
                key={cite.code}
                onClick={() => {
                  navigator.clipboard.writeText(cite.code);
                  toast({ title: "Copied", description: `${cite.code} copied to clipboard` });
                }}
                className="w-full text-left p-2 rounded-lg bg-card border border-border hover:bg-card transition-all group"
              >
                <span className="text-sm text-primary group-hover:underline">{cite.code}</span>
                <p className="text-xs text-muted-foreground">{cite.label}</p>
              </button>
            ))}
          </div>

          {/* EOSCAR Risk Meter */}
          <div className="mt-8 p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">EOSCAR Risk</span>
              <span className={`text-lg font-bold ${getEoscarRiskColor(eoscarRisk)}`}>
                {eoscarRisk}%
              </span>
            </div>
            <Progress value={eoscarRisk} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">{getEoscarRiskLabel(eoscarRisk)}</p>
          </div>
        </div>

        {/* Center - Letter Preview/Editor */}
        <div className="flex-1 p-6 overflow-y-auto bg-background">
          <div className="max-w-2xl mx-auto">
            {isEditing ? (
              /* Edit Mode */
              <div className="bg-card rounded-xl border border-border p-4">
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="min-h-[600px] bg-background border-border text-foreground font-mono text-sm"
                  placeholder="Edit your dispute letter..."
                />
                <p className="text-xs text-muted-foreground mt-2">{editedContent.length} characters</p>
              </div>
            ) : (
              /* Preview Mode */
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white text-slate-900 rounded-lg shadow-2xl p-8 min-h-[800px]"
              >
                {letterContent ? (
                  <div className="whitespace-pre-wrap font-serif text-sm leading-relaxed">
                    {letterContent}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <FileText className="w-12 h-12 mb-4" />
                    <p>No letter content yet</p>
                    <Button onClick={handleGenerateLetter} className="mt-4" disabled={isGenerating}>
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate with AMELIA
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>

        {/* Right Panel - AMELIA Assistant */}
        <div className="w-80 border-l border-border p-4 overflow-y-auto">
          {/* AMELIA Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <Bot className="w-6 h-6 text-foreground" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-foreground" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">AMELIA</h3>
              <p className="text-xs text-muted-foreground">AI Writing Assistant</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-2xl font-bold text-emerald-400">{ameliaConfidence}%</p>
              <p className="text-xs text-muted-foreground">Confidence</p>
            </div>
          </div>

          {/* Suggestions */}
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Suggestions
            {isLoadingSuggestions && <Loader2 className="w-3 h-3 ml-2 inline animate-spin" />}
          </h4>
          <div className="space-y-2 mb-4">
            {suggestions.length === 0 && !isLoadingSuggestions && (
              <p className="text-sm text-muted-foreground">No suggestions available. Generate a letter first.</p>
            )}
            {suggestions.map((suggestion) => (
              <motion.div
                key={suggestion.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-xl border transition-all ${
                  suggestion.applied
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : "bg-card border-border"
                }`}
              >
                <div className="flex items-start gap-3">
                  {suggestion.applied ? (
                    <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  ) : suggestion.impact === "high" ? (
                    <Zap className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                  ) : (
                    <Sparkles className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${suggestion.applied ? "text-emerald-300" : "text-foreground"}`}>
                      {suggestion.text}
                    </p>
                    {suggestion.reasoning && !suggestion.applied && (
                      <p className="text-xs text-muted-foreground mt-1">{suggestion.reasoning}</p>
                    )}
                  </div>
                  {!suggestion.applied && (
                    <Button
                      size="sm"
                      onClick={() => handleApplySuggestion(suggestion)}
                      disabled={isApplyingSuggestion === suggestion.id}
                      className="bg-primary hover:bg-primary/90 text-xs h-7 flex-shrink-0"
                    >
                      {isApplyingSuggestion === suggestion.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        "Apply"
                      )}
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Apply All Button */}
          {suggestions.some((s) => !s.applied) && (
            <Button onClick={handleApplyAll} className="w-full bg-emerald-600 hover:bg-emerald-700 mb-6">
              <Sparkles className="w-4 h-4 mr-2" />
              Apply All ({suggestions.filter(s => !s.applied).length})
            </Button>
          )}

          {/* Version History */}
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Version History</h4>
          <div className="space-y-2 mb-4">
            {versions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No versions yet</p>
            ) : (
              versions.slice(0, 5).map((version) => (
                <button
                  key={version.id}
                  onClick={() => handleRevertVersion(version)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                    version.isCurrent
                      ? "bg-primary/20 border border-blue-500/50"
                      : "bg-card border border-border hover:bg-card"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${version.isCurrent ? "text-primary" : "text-foreground"}`}>
                      {version.version}
                    </span>
                    {version.isCurrent && (
                      <Badge className="bg-primary/20 text-primary text-[10px]">current</Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{version.timestamp}</span>
                </button>
              ))
            )}
          </div>

          {/* Undo Button */}
          <button
            onClick={handleUndo}
            disabled={versions.length <= 1}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-card border border-border hover:bg-card transition-all text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Undo2 className="w-4 h-4" />
            <span className="text-sm">Undo Last Change</span>
          </button>

          {/* Regenerate Button */}
          <Button
            onClick={handleGenerateLetter}
            disabled={isGenerating}
            variant="outline"
            className="w-full mt-4 border-border"
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

// Helper function to generate sample letter content (used when no disputeId)
function generateSampleLetterContent(
  letterType: string,
  account: DisputedAccount,
  bureauInfo: { name: string; address: string },
  clientName: string,
  round: number
): string {
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const letterTemplates: Record<string, string> = {
    initial: `${today}

${bureauInfo.name}
${bureauInfo.address}

Re: Dispute of Inaccurate Information

To Whom It May Concern:

I am writing to dispute inaccurate information that appears on my credit report. After reviewing my report, I have identified the following account that contains errors:

DISPUTED ACCOUNT
${account.creditorName}
Account #: ${account.accountNumber}
${account.balance ? `Reported Balance: $${account.balance.toLocaleString()}` : ""}

I am exercising my rights under the Fair Credit Reporting Act to request that you investigate this matter. The information being reported is inaccurate for the following reasons:

• The account status is incorrectly reported
• The balance information does not reflect accurate figures
• I do not recognize this account as belonging to me

Please conduct a thorough investigation and provide me with the results within 30 days as required by law.

Sincerely,

${clientName}`,

    mov: `${today}

${bureauInfo.name}
${bureauInfo.address}

Re: Request for Method of Verification - Second Notice

To Whom It May Concern:

I am writing to formally request the method of verification used during your investigation of my dispute. Pursuant to 15 U.S.C. § 1681i(a)(6)(B)(iii), you are required to provide this information upon request.

DISPUTED ACCOUNT
${account.creditorName}
Account #: ${account.accountNumber}

Following my initial dispute, you reported that the information was "verified." However, you have not provided me with:

• Name, address, and telephone number of the furnisher contacted
• Summary of the verification method used
• Copies of any documents relied upon during the investigation

I am entitled to this information under federal law. Please provide the method of verification within 15 days of receipt of this letter.

Sincerely,

${clientName}`,

    violation: `${today}

${bureauInfo.name}
${bureauInfo.address}

Re: Notice of FCRA Violations

To Whom It May Concern:

This letter serves as formal notice that you have violated the Fair Credit Reporting Act in your handling of my dispute.

DISPUTED ACCOUNT
${account.creditorName}
Account #: ${account.accountNumber}

Specifically, you have violated:

1. 15 U.S.C. § 1681i(a)(1)(A) - Failure to conduct a reasonable reinvestigation
2. 15 U.S.C. § 1681i(a)(6)(B)(iii) - Failure to provide method of verification upon request
3. 15 U.S.C. § 1681e(b) - Failure to maintain reasonable procedures to assure maximum possible accuracy

Despite multiple written requests, you have failed to provide adequate verification of this disputed information. Your continued reporting of unverified information is causing harm to my creditworthiness.

I demand immediate deletion of this inaccurate information from my credit file.

Sincerely,

${clientName}`,

    final: `${today}

${bureauInfo.name}
${bureauInfo.address}

Re: Final Demand Before Legal Action

CERTIFIED MAIL - RETURN RECEIPT REQUESTED

To Whom It May Concern:

This is my final demand before I am forced to pursue legal remedies.

DISPUTED ACCOUNT
${account.creditorName}
Account #: ${account.accountNumber}

Over the past several months, I have:
• Submitted multiple written disputes
• Requested method of verification
• Documented your violations of the FCRA

You have failed to:
• Conduct a reasonable investigation
• Provide the method of verification as required by law
• Remove unverified information from my credit report

This letter constitutes formal notice that I intend to pursue all available legal remedies if this matter is not resolved within 15 days. This includes filing a complaint with the Consumer Financial Protection Bureau and pursuing statutory damages under the FCRA.

Govern yourself accordingly.

Sincerely,

${clientName}`,
  };

  return letterTemplates[letterType] || letterTemplates.initial;
}
